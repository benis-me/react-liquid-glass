import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { LiquidGlass as Glass, LIQUID_LENS } from "../liquid-glass/LiquidGlass";
import { liquidTrackSource } from "../liquid-glass/source";
import type { LensParams } from "../types";
import { usePointerReleaseFallback, rubberBand } from "../apple-motion/react";
import { useThumbMotion } from "./use-thumb-motion";

function darkTheme() {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
}

export interface GlassSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  ariaLabel?: string;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  size?: "default" | "small";
}

export function GlassSwitch({
  checked,
  defaultChecked = false,
  disabled,
  name,
  value,
  ariaLabel = "开关",
  onCheckedChange,
  className,
  size = "default",
}: GlassSwitchProps) {
  const [local, setLocal] = useState(defaultChecked);
  const current = checked ?? local;
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
  const travelTransition = { ease: pressEase, duration: 0.6 };

  const offset = useMotionValue(current ? travel : 0);
  const x = useTransform(offset, (position) => (padding + inset + thumbWidth / 2 + position) / filterWidth);
  const { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, shadowOpacity, deformationBoost, deformationWake, expand, collapse } = useThumbMotion(offset, halfThumbWidth, halfThumbHeight, restTintBlur);

  const rootRef = useRef<HTMLLabelElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerId = useRef<number | null>(null);
  const pointerStart = useRef(0);
  const offsetStart = useRef(0);
  const dragged = useRef(false);
  const suppressNative = useRef(false);
  const mode = useRef<"idle" | "pending" | "hold" | "tap">("idle");
  const holdTimer = useRef<number | null>(null);
  const restoreTimer = useRef<number | null>(null);
  const travelAnimation = useRef<ReturnType<typeof animate> | null>(null);
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
    deformationBoost.current = 0;
    suppressNative.current = false;
    collapse();
    travelAnimation.current?.stop();
    travelAnimation.current = animate(offset, current ? travel : 0, travelTransition);
  };
  const { arm: armPointerFallback, disarm: disarmPointerFallback } = usePointerReleaseFallback(cancelPointerInteraction);

  useEffect(() => {
    if (pointerId.current === null && mode.current !== "tap") {
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
  const lens: Partial<LensParams> = {
    ...LIQUID_LENS, depth: thumbHeight / 11, domeDepth: thumbHeight * (6 / 22),
    chromaAmount: .24, edgeWidth: .9,
    brightness: darkTheme() ? .035 : .015,
  };

  return (
    <label ref={rootRef} data-size={size} className={["dg-switch", className].filter(Boolean).join(" ")} style={{ width, height, "--dg-switch-progress": current ? 1 : 0 } as React.CSSProperties}>
      <input
        ref={inputRef}
        type="checkbox"
        role="switch"
        className="dg-switch__input"
        checked={current}
        disabled={disabled}
        name={name}
        value={value}
        aria-label={ariaLabel}
        onClick={(event) => { if (suppressNative.current) event.preventDefault(); }}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); pulseAndToggle(!current); } }}
        onChange={(event) => pulseAndToggle(event.currentTarget.checked)}
      />
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
                    deformationBoost.current = 0.175;
                    deformationWake.current();
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
                  deformationBoost.current = 0;
                  if (mode.current !== "hold") { mode.current = "hold"; expand(); }
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
                  mode.current = "idle";
                  collapse();
                  deformationBoost.current = 0;
                  const next = Math.max(0, Math.min(travel, offset.get())) > travel / 2;
                  travelAnimation.current = animate(offset, next ? travel : 0, travelTransition);
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
                  deformationBoost.current = 0;
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
      </Glass>
    </label>
  );
}

