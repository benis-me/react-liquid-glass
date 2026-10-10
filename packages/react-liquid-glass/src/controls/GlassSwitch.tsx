import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type InputHTMLAttributes } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { LiquidGlass } from "../liquid-glass/LiquidGlass.js";
import { liquidTheme, liquidTrackSource, subscribeLiquidTheme } from "../liquid-glass/source.js";
import { usePointerReleaseFallback, useGlassContact, rubberBand } from "../apple-motion/react.js";
import { SWITCH_FLICK_PROJECTION, SWITCH_RELEASE_SPRING } from "../apple-motion/presets.js";
import { LIFTED_MODEL, liftedLens, settleThumb, useLiftedOptics, useLiftedShadow, useThumbMotion } from "./use-thumb-motion.js";

/** Native input attributes (id, aria-*, required, form, onBlur…) pass through to the switch's checkbox. */
type NativeSwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role" | "checked" | "defaultChecked" | "disabled" | "name" | "value" | "onChange" | "onClick" | "onKeyDown" | "size" | "children" | "className" | "style">;
export interface GlassSwitchProps extends NativeSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  ariaLabel?: string;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  style?: CSSProperties;
  size?: "default" | "small";
}

export function GlassSwitch({
  checked,
  defaultChecked = false,
  disabled,
  name,
  value,
  ariaLabel,
  onCheckedChange,
  className,
  style,
  size = "default",
  ...inputProps
}: GlassSwitchProps) {
  const reduce = useReducedMotion() ?? false;
  const [local, setLocal] = useState(defaultChecked);
  const current = checked ?? local;
  const currentRef = useRef(current); currentRef.current = current;
  // The thumb brightens slightly on dark pages; follow theme changes, not just the first render.
  const dark = useSyncExternalStore(subscribeLiquidTheme, liquidTheme, () => "light").startsWith("dark");
  const compact = size === "small";
  const width = compact ? 52 : 74;
  const height = compact ? 20 : 28;
  const inset = compact ? 2 : 3;
  const thumbWidth = Math.round(width * 0.6);
  const thumbHeight = height - inset * 2;
  const travel = width - thumbWidth - inset * 2;
  const halfThumbWidth = thumbWidth / 2;
  const halfThumbHeight = thumbHeight / 2;
  const overshoot = width * 0.15;
  const padding = Math.ceil(0.5 * Math.max(halfThumbWidth, halfThumbHeight) + overshoot) + 2;
  const filterWidth = width + padding * 2;
  const filterHeight = height + padding * 2;
  const refractedTrackHeight = Math.round(height * 0.75);
  const restTintBlur = compact ? 0 : 4;
  const pressEase = [0.22, 1.15, 0.36, 1.06] as const;
  const travelTransition = reduce ? { duration: 0 } : { ease: pressEase, duration: 0.6 };

  const offset = useMotionValue(current ? travel : 0);
  const x = useTransform(offset, (position) => (padding + inset + thumbWidth / 2 + position) / filterWidth);
  const { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, still, setDeformationBoost, expand, collapse, drag } = useThumbMotion(offset, halfThumbWidth, halfThumbHeight, restTintBlur, reduce);
  // Held, the thumb is iOS 27's lifted lens; its refracted track already magnifies.
  const held = useTransform(tintOpacity, opacity => 1 - opacity);
  const { band, bulge } = useLiftedOptics(lensW, lensH, held);
  // Held, the thumb casts the lifted lens's shadow, as a pressed tab does; at rest it keeps its own.
  const liftShadow = useLiftedShadow(lensH, held, dark, { strength: .04, offset: Math.min(18, filterHeight * .12), blur: Math.min(26, filterHeight * .2) });

  const rootRef = useRef<HTMLLabelElement>(null);
  const contact = useGlassContact(rootRef, { deform: false, enabled: !disabled });
  const contactX = useTransform(() => ((contact.contactX.get() + 1) * width / 2 - inset - halfThumbWidth - offset.get()) / lensW.get());
  const contactY = useTransform(() => contact.contactY.get() * height / 2 / lensH.get());
  // The lifted lens barely lights where it is touched, and not at all once the press drags.
  const touchLight = useTransform(() => contact.contactStrength.get() * .3 * still.get());
  const thumbRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerId = useRef<number | null>(null);
  const pointerStart = useRef(0);
  const offsetStart = useRef(0);
  const dragged = useRef(false);
  const suppressNative = useRef(false);
  const mode = useRef<"idle" | "pending" | "hold" | "tap" | "release">("idle");
  const holdTimer = useRef<number | null>(null);
  const restoreTimer = useRef<number | null>(null);
  const travelAnimation = useRef<{ stop: () => void } | null>(null);
  const alive = useRef(true);

  const emit = (next: boolean) => {
    if (checked === undefined) setLocal(next);
    onCheckedChange?.(next);
  };
  const pulseAndToggle = (next: boolean) => {
    if (suppressNative.current) return;
    emit(next);
    if (mode.current !== "idle") return;
    mode.current = "tap";
    expand();
    if (restoreTimer.current !== null) clearTimeout(restoreTimer.current);
    restoreTimer.current = window.setTimeout(collapse, 330);
    travelAnimation.current?.stop();
    travelAnimation.current = animate(offset, next ? travel : 0, {
      ...travelTransition,
      onComplete: () => { if (alive.current && mode.current === "tap") mode.current = "idle"; },
    });
  };
  const cancelPointerInteraction = () => {
    const activePointerId = pointerId.current;
    if (activePointerId === null) return;
    pointerId.current = null;
    if (thumbRef.current?.hasPointerCapture(activePointerId)) {
      try { thumbRef.current.releasePointerCapture(activePointerId); } catch {}
    }
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    dragged.current = false;
    mode.current = "idle";
    setDeformationBoost(0);
    suppressNative.current = false;
    collapse();
    travelAnimation.current?.stop();
    travelAnimation.current = animate(offset, current ? travel : 0, travelTransition);
  };
  const { arm: armPointerFallback, disarm: disarmPointerFallback } = usePointerReleaseFallback(cancelPointerInteraction);

  useEffect(() => {
    if (pointerId.current === null && mode.current !== "tap" && mode.current !== "release") {
      travelAnimation.current?.stop();
      travelAnimation.current = animate(offset, current ? travel : 0, travelTransition);
    }
  }, [current, offset, travel]);
  useEffect(() => offset.on("change", (position) => {
    rootRef.current?.style.setProperty("--dg-switch-progress", String(Math.max(0, Math.min(1, position / travel))));
  }), [offset, travel]);
  useEffect(() => () => {
    alive.current = false;
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    if (restoreTimer.current !== null) clearTimeout(restoreTimer.current);
    travelAnimation.current?.stop();
    if (pointerId.current !== null && thumbRef.current) {
      try { thumbRef.current.releasePointerCapture(pointerId.current); } catch {}
    }
  }, []);

  const sourceFactory = useMemo(() => liquidTrackSource({
    kind: "switch", width,
    trackHeight: refractedTrackHeight, travel, offset,
    scaleX: targetScaleX, scaleY: targetScaleY,
  }), [width, height, padding, refractedTrackHeight, thumbWidth, travel, offset, targetScaleX, targetScaleY]);
  // Keep a thin refracting band and shallow cap at both thumb sizes.
  const lens = liftedLens(dark, { depth: thumbHeight / 11, domeDepth: thumbHeight * (6 / 22) });

  return (
    <label ref={rootRef} data-size={size} className={["dg-switch", className].filter(Boolean).join(" ")} style={{ ...style, width, height, "--dg-switch-progress": current ? 1 : 0 } as React.CSSProperties}>
      <input
        {...inputProps}
        ref={inputRef}
        type="checkbox"
        role="switch"
        className="dg-switch__input"
        checked={current}
        disabled={disabled}
        name={name}
        value={value}
        // A label of the host's own (id with <label htmlFor>, or aria-labelledby) replaces the fallback name.
        aria-label={ariaLabel ?? inputProps["aria-label"] ?? (inputProps.id || inputProps["aria-labelledby"] ? undefined : "Switch")}
        onClick={(event) => { if (suppressNative.current) event.preventDefault(); }}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); pulseAndToggle(!current); } }}
        onChange={(event) => pulseAndToggle(event.currentTarget.checked)}
      />
      <LiquidGlass
        contact={{ ...contact, contactX, contactY, contactStrength: touchLight }}
        sourceFactory={sourceFactory}
        backdropRoot={rootRef}
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
          <div className="dg-control__padded-target" style={{ padding, height }}>
            <motion.div className="dg-switch__refracted-track" style={{ width, height: refractedTrackHeight, borderRadius: refractedTrackHeight / 2, scaleX: targetScaleX, scaleY: targetScaleY }} />
          </div>
        }
      >
        <div style={{ padding }}>
          <div className="dg-switch__track" style={{ width, height, borderRadius: height / 2 }} aria-hidden>
            <motion.div
              ref={thumbRef}
              className="dg-switch__thumb-hit"
              style={{ x: offset, width: thumbWidth, height: thumbHeight, left: inset, top: inset }}
              onPointerDown={(event) => {
                if (disabled || pointerId.current !== null) return;
                pointerId.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                armPointerFallback(event.pointerId);
                pointerStart.current = event.clientX;
                offsetStart.current = offset.get();
                dragged.current = false;
                suppressNative.current = true;
                mode.current = "pending";
                if (holdTimer.current !== null) clearTimeout(holdTimer.current);
                holdTimer.current = window.setTimeout(() => {
                  if (mode.current === "pending") {
                    mode.current = "hold";
                    travelAnimation.current?.stop();
                    expand();
                    setDeformationBoost(0.175);
                  }
                }, 200);
              }}
              onPointerMove={(event) => {
                if (event.pointerId !== pointerId.current) return;
                const delta = event.clientX - pointerStart.current;
                if (!dragged.current) {
                  if (Math.abs(delta) < 3) return;
                  dragged.current = true;
                  travelAnimation.current?.stop();
                  offsetStart.current = offset.get();
                  pointerStart.current = event.clientX;
                  if (holdTimer.current !== null) clearTimeout(holdTimer.current);
                  setDeformationBoost(0);
                  if (mode.current !== "hold") { mode.current = "hold"; expand(); }
                  drag();
                }
                let next = offsetStart.current + (event.clientX - pointerStart.current);
                if (next < 0) next = -rubberBand(-next, overshoot, overshoot * 10);
                else if (next > travel) next = travel + rubberBand(next - travel, overshoot, overshoot * 10);
                offset.set(next);
              }}
              onPointerUp={(event) => {
                if (event.pointerId !== pointerId.current) return;
                disarmPointerFallback();
                pointerId.current = null;
                if (holdTimer.current !== null) clearTimeout(holdTimer.current);
                if (dragged.current) {
                  collapse();
                  setDeformationBoost(0);
                  // A flick chooses its side like a thrown thumb: project briefly along the
                  // release velocity. A thumb held still before release has no velocity.
                  const velocity = offset.getVelocity();
                  const next = Math.max(0, Math.min(travel, offset.get() + velocity * SWITCH_FLICK_PROJECTION)) > travel / 2;
                  mode.current = "release";
                  const run = settleThumb(offset, next ? travel : 0, SWITCH_RELEASE_SPRING, reduce);
                  travelAnimation.current = run;
                  void run.finished.then(() => {
                    if (!alive.current || mode.current !== "release") return;
                    mode.current = "idle";
                    // A controlled owner may have kept the previous state; settle where it is.
                    const rest = currentRef.current ? travel : 0;
                    if (offset.get() !== rest) travelAnimation.current = animate(offset, rest, travelTransition);
                  });
                  if (next !== current) emit(next);
                  requestAnimationFrame(() => { suppressNative.current = false; });
                } else if (mode.current === "pending" || mode.current === "tap") {
                  mode.current = "tap";
                  suppressNative.current = false;
                  expand();
                  if (restoreTimer.current !== null) clearTimeout(restoreTimer.current);
                  restoreTimer.current = window.setTimeout(collapse, 330);
                  const next = !current;
                  travelAnimation.current = animate(offset, next ? travel : 0, {
                    ...travelTransition,
                    onComplete: () => { if (alive.current && mode.current === "tap") mode.current = "idle"; },
                  });
                } else {
                  mode.current = "idle";
                  setDeformationBoost(0);
                  collapse();
                  travelAnimation.current = animate(offset, current ? travel : 0, travelTransition);
                  requestAnimationFrame(() => { suppressNative.current = false; });
                }
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
            />
          </div>
        </div>
      </LiquidGlass>
    </label>
  );
}
