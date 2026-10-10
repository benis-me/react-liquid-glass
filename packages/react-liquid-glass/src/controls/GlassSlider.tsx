import { SLIDER_CLICK_SPRING } from "../apple-motion/presets.js";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type InputHTMLAttributes } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { LiquidGlass } from "../liquid-glass/LiquidGlass.js";
import { liquidTheme, liquidTrackSource, subscribeLiquidTheme } from "../liquid-glass/source.js";
import { usePointerReleaseFallback, useGlassContact, rubberBand, type SpringRun } from "../apple-motion/react.js";
import { LIFTED_MODEL, liftedLens, settleThumb, useLiftedOptics, useLiftedShadow, useThumbMotion } from "./use-thumb-motion.js";

/** Native input attributes (id, aria-*, required, form, onBlur…) pass through to the slider's range input. */
type NativeSliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "min" | "max" | "step" | "value" | "defaultValue" | "disabled" | "name" | "onChange" | "size" | "children" | "className" | "style">;

export interface GlassSliderProps extends NativeSliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  name?: string;
  ariaLabel?: string;
  onValueChange?: (value: number) => void;
  className?: string;
  style?: CSSProperties;
  size?: "default" | "small";
}

export function GlassSlider({
  value,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  name,
  ariaLabel,
  onValueChange,
  className,
  style,
  size = "default",
  ...inputProps
}: GlassSliderProps) {
  const reduce = useReducedMotion() ?? false;
  const [local, setLocal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : local;
  // The thumb brightens slightly on dark pages; follow theme changes, not just the first render.
  const dark = useSyncExternalStore(subscribeLiquidTheme, liquidTheme, () => "light").startsWith("dark");
  // Within one gesture, report each snapped value once rather than once per pointer
  // event. Each gesture starts from the owner's value, so a rejected value can be
  // requested again.
  const currentRef = useRef(current); currentRef.current = current;
  const reported = useRef(current);
  const compact = size === "small";
  const width = compact ? 120 : 240;
  const thumbHeight = compact ? 16 : 22;
  const thumbWidth = Math.round(thumbHeight * 2);
  const trackHeight = compact ? 4 : 6;
  const travel = width - thumbWidth;
  const halfThumbWidth = thumbWidth / 2;
  const halfThumbHeight = thumbHeight / 2;
  const overshoot = width * 0.05;
  const padding = Math.ceil(0.5 * Math.max(halfThumbWidth, halfThumbHeight) + overshoot) + 2;
  const filterWidth = width + padding * 2;
  const filterHeight = thumbHeight + padding * 2;
  const refractedTrackHeight = Math.round(thumbHeight * 0.75);
  const restTintBlur = compact ? 0 : 4;
  const releaseTransition = reduce ? { duration: 0 } : { ease: [0.22, 1, 0.36, 1] as const, duration: 0.52 };
  const toOffset = (next: number) => max > min ? ((next - min) / (max - min)) * travel : 0;
  const fromOffset = (position: number) => {
    const clamped = Math.max(0, Math.min(travel, position));
    const raw = travel > 0 ? min + (clamped / travel) * (max - min) : min;
    return step > 0 ? Math.round((raw - min) / step) * step + min : raw;
  };
  const emit = (next: number) => {
    const snapped = step > 0 ? Math.round((next - min) / step) * step + min : next;
    const clamped = Math.max(min, Math.min(max, snapped));
    if (clamped === reported.current) return;
    reported.current = clamped;
    if (!controlled) setLocal(clamped);
    onValueChange?.(clamped);
  };

  const offset = useMotionValue(toOffset(current));
  const x = useTransform(offset, (position) => (padding + thumbWidth / 2 + position) / filterWidth);
  const { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, still, setDeformationBoost, expand, collapse, drag } = useThumbMotion(offset, halfThumbWidth, halfThumbHeight, restTintBlur, reduce);
  // Held, the thumb is iOS 27's lifted lens; its refracted track already magnifies.
  const held = useTransform(tintOpacity, opacity => 1 - opacity);
  const { band, bulge } = useLiftedOptics(lensW, lensH, held);
  // Held, the thumb casts the lifted lens's shadow, as a pressed tab does; at rest it keeps its own.
  const liftShadow = useLiftedShadow(lensH, held, dark, { strength: .04, offset: Math.min(18, filterHeight * .12), blur: Math.min(26, filterHeight * .2) });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const contact = useGlassContact(wrapperRef, { deform: false, enabled: !disabled });
  const contactX = useTransform(() => ((contact.contactX.get() + 1) * width / 2 - halfThumbWidth - offset.get()) / lensW.get());
  const contactY = useTransform(() => contact.contactY.get() * thumbHeight / 2 / lensH.get());
  // The lifted lens barely lights where it is touched, and not at all once the press drags.
  const touchLight = useTransform(() => contact.contactStrength.get() * .3 * still.get());
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerId = useRef<number | null>(null);
  const pointerStart = useRef(0);
  const offsetStart = useRef(0);
  const dragging = useRef(false);
  const pointerMoved = useRef(false);
  const clickAnimation = useRef<SpringRun | null>(null);

  const cancelPointerInteraction = () => {
    const activePointerId = pointerId.current;
    if (activePointerId === null) return;
    pointerId.current = null;
    if (trackRef.current?.hasPointerCapture(activePointerId)) {
      try { trackRef.current.releasePointerCapture(activePointerId); } catch {}
    }
    dragging.current = false;
    pointerMoved.current = false;
    clickAnimation.current?.stop();
    setDeformationBoost(0);
    animate(offset, Math.max(0, Math.min(travel, offset.get())), releaseTransition);
    collapse();
  };
  const { arm: armPointerFallback, disarm: disarmPointerFallback } = usePointerReleaseFallback(cancelPointerInteraction);

  useEffect(() => {
    if (!dragging.current) {
      clickAnimation.current?.stop();
      offset.set(toOffset(current));
    }
  }, [current, offset]);
  useEffect(() => offset.on("change", (position) => {
    const fill = thumbWidth / 2 + position;
    const progress = travel > 0 ? position / travel : 0;
    wrapperRef.current?.style.setProperty("--dg-slider-fill", `${fill}px`);
    wrapperRef.current?.style.setProperty("--dg-slider-progress", String(Math.max(0, Math.min(1, progress))));
  }), [offset, thumbWidth, travel]);
  useEffect(() => () => {
    clickAnimation.current?.stop();
    if (pointerId.current !== null && trackRef.current) {
      try { trackRef.current.releasePointerCapture(pointerId.current); } catch {}
    }
  }, []);

  const sourceFactory = useMemo(() => liquidTrackSource({
    kind: "slider", width,
    trackHeight: refractedTrackHeight, travel, offset,
    scaleX: targetScaleX, scaleY: targetScaleY,
  }), [width, thumbHeight, padding, refractedTrackHeight, thumbWidth, travel, offset, targetScaleX, targetScaleY]);
  const lens = liftedLens(dark, { depth: thumbHeight / 11, domeDepth: thumbHeight * (5 / 22) });

  return (
    <div ref={wrapperRef} data-size={size} className={["dg-slider", className].filter(Boolean).join(" ")} style={{ ...style, width, height: thumbHeight, "--dg-slider-fill": `${thumbWidth / 2 + toOffset(current)}px`, "--dg-slider-progress": toOffset(current) / travel } as React.CSSProperties}>
      <LiquidGlass
        contact={{ ...contact, contactX, contactY, contactStrength: touchLight }}
        sourceFactory={sourceFactory}
        backdropRoot={wrapperRef}
        sourceValues={[offset, targetScaleX, targetScaleY]}
        refractionPixels={1}
        zoom={bulge}
        depth={band}
        material={{ ...LIFTED_MODEL, shadowStrength: liftShadow.strength, shadowOffset: liftShadow.offset, shadowBlur: liftShadow.blur }}
        lens={lens}
        x={x}
        y={0.5}
        lensW={lensW}
        lensH={lensH}
        borderRadius={radius}
        tintColor="white"
        tintOpacity={tintOpacity}
        tintBlur={tintBlur}
        shadowBleed
        pixelRatio={2}
        pixelAlign
        style={{ width: filterWidth, height: filterHeight, overflow: "visible", margin: -padding }}
        refractionTarget={
          <div className="dg-control__padded-target" style={{ padding, height: thumbHeight }}>
            <motion.div className="dg-slider__refracted-track" style={{ width, height: refractedTrackHeight, borderRadius: refractedTrackHeight / 2, scaleX: targetScaleX, scaleY: targetScaleY }}>
              <div className="dg-slider__track-base" />
              <div className="dg-slider__refracted-fill" />
            </motion.div>
          </div>
        }
      >
        <div style={{ padding }}>
          <input
            {...inputProps}
            ref={inputRef}
            type="range"
            className="dg-slider__input"
            min={min}
            max={max}
            step={step}
            value={current}
            disabled={disabled}
            name={name}
            aria-label={ariaLabel ?? inputProps["aria-label"] ?? (inputProps.id || inputProps["aria-labelledby"] ? undefined : "Value")}
            onChange={(event) => {
              const next = event.currentTarget.valueAsNumber;
              clickAnimation.current?.stop();
              reported.current = currentRef.current;
              emit(next);
              offset.set(toOffset(next));
            }}
          />
          <div
            ref={trackRef}
            className="dg-slider__root"
            style={{ width, height: thumbHeight }}
            aria-hidden
            onPointerDown={(event) => {
              if (disabled || pointerId.current !== null) return;
              pointerId.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              armPointerFallback(event.pointerId);
              dragging.current = true;
              pointerMoved.current = false;
              inputRef.current?.focus({ preventScroll: true });
              const rect = event.currentTarget.getBoundingClientRect();
              reported.current = currentRef.current;
              const clickedValue = fromOffset(event.clientX - rect.left - thumbWidth / 2);
              const next = toOffset(clickedValue);
              clickAnimation.current?.stop();
              clickAnimation.current = settleThumb(offset, next, SLIDER_CLICK_SPRING, reduce);
              emit(clickedValue);
              pointerStart.current = event.clientX;
              offsetStart.current = offset.get();
              expand();
              setDeformationBoost(0.175);
            }}
            onPointerMove={(event) => {
              if (event.pointerId !== pointerId.current) return;
              if (!pointerMoved.current && Math.abs(event.clientX - pointerStart.current) < 3) return;
              if (!pointerMoved.current) {
                clickAnimation.current?.stop();
                pointerMoved.current = true;
                pointerStart.current = event.clientX;
                offsetStart.current = offset.get();
                drag();
              }
              let next = offsetStart.current + (event.clientX - pointerStart.current);
              if (next < 0) next = -rubberBand(-next, overshoot, overshoot * 30);
              else if (next > travel) next = travel + rubberBand(next - travel, overshoot, overshoot * 30);
              offset.set(next);
              emit(fromOffset(next));
            }}
            onPointerUp={(event) => {
              if (event.pointerId !== pointerId.current) return;
              disarmPointerFallback();
              pointerId.current = null;
              dragging.current = false;
              setDeformationBoost(0);
              if (pointerMoved.current) {
                animate(offset, Math.max(0, Math.min(travel, offset.get())), releaseTransition);
              }
              collapse();
            }}
            onPointerCancel={(event) => {
              if (event.pointerId !== pointerId.current) return;
              disarmPointerFallback();
              cancelPointerInteraction();
            }}
            onLostPointerCapture={(event) => {
              if (event.pointerId !== pointerId.current) return;
              disarmPointerFallback();
              cancelPointerInteraction();
            }}
            onDragStart={(event) => event.preventDefault()}
          >
            <div className="dg-slider__track" style={{ height: trackHeight, borderRadius: trackHeight / 2 }}>
              <div className="dg-slider__track-base" />
              <div className="dg-slider__fill" />
            </div>
            <motion.div className="dg-slider__thumb-hit" style={{ x: offset, width: thumbWidth, height: thumbHeight }} />
          </div>
        </div>
      </LiquidGlass>
    </div>
  );
}
