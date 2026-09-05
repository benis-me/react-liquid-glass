import { SLIDER_CLICK_SPRING } from "../apple-motion/presets";
import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { LiquidGlass as Glass, LIQUID_LENS } from "../liquid-glass/LiquidGlass";
import { liquidTrackSource } from "../liquid-glass/source";
import type { LensParams } from "../types";
import { usePointerReleaseFallback, rubberBand, springTo, type SpringRun } from "../apple-motion/react";
import { useThumbMotion } from "./use-thumb-motion";

function darkTheme() {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
}

export interface GlassSliderProps {
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
  ariaLabel = "数值",
  onValueChange,
  className,
  size = "default",
}: GlassSliderProps) {
  const [local, setLocal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : local;
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
  const releaseTransition = { ease: [0.22, 1, 0.36, 1] as const, duration: 0.52 };
  const toOffset = (next: number) => max > min ? ((next - min) / (max - min)) * travel : 0;
  const fromOffset = (position: number) => {
    const clamped = Math.max(0, Math.min(travel, position));
    const raw = travel > 0 ? min + (clamped / travel) * (max - min) : min;
    return step > 0 ? Math.round((raw - min) / step) * step + min : raw;
  };
  const emit = (next: number) => {
    const snapped = step > 0 ? Math.round((next - min) / step) * step + min : next;
    const clamped = Math.max(min, Math.min(max, snapped));
    if (!controlled) setLocal(clamped);
    onValueChange?.(clamped);
  };

  const offset = useMotionValue(toOffset(current));
  const x = useTransform(offset, (position) => (padding + thumbWidth / 2 + position) / filterWidth);
  const { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, shadowOpacity, setDeformationBoost, expand, collapse } = useThumbMotion(offset, halfThumbWidth, halfThumbHeight, restTintBlur);

  const wrapperRef = useRef<HTMLDivElement>(null);
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
  const lens: Partial<LensParams> = {
    ...LIQUID_LENS, depth: thumbHeight / 11, domeDepth: thumbHeight * (5 / 22),
    chromaAmount: .24, edgeWidth: .9,
    brightness: darkTheme() ? .035 : .015,
  };

  return (
    <div ref={wrapperRef} data-size={size} className={["dg-slider", className].filter(Boolean).join(" ")} style={{ width, height: thumbHeight, "--dg-slider-fill": `${thumbWidth / 2 + toOffset(current)}px`, "--dg-slider-progress": toOffset(current) / travel } as React.CSSProperties}>
      <Glass
        sourceFactory={sourceFactory}
        sourceValues={[offset, targetScaleX, targetScaleY]}
        refractionPixels={thumbHeight * .22}
        lens={lens}
        x={x}
        y={0.5}
        lensW={lensW}
        lensH={lensH}
        borderRadius={radius}
        tintColor="white"
        tintOpacity={tintOpacity}
        tintBlur={tintBlur}
        shadowOpacity={shadowOpacity}
        filterResolution={2}
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
            ref={inputRef}
            type="range"
            className="dg-slider__input"
            min={min}
            max={max}
            step={step}
            value={current}
            disabled={disabled}
            name={name}
            aria-label={ariaLabel}
            onChange={(event) => {
              const next = event.currentTarget.valueAsNumber;
              clickAnimation.current?.stop();
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
              const clickedValue = fromOffset(event.clientX - rect.left - thumbWidth / 2);
              const next = toOffset(clickedValue);
              clickAnimation.current?.stop();
              clickAnimation.current = springTo(offset, next, SLIDER_CLICK_SPRING);
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
      </Glass>
    </div>
  );
}
