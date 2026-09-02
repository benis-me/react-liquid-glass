import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { Glass } from "./glass";
import { motionValue, type WritableMotionValue } from "./motion";
import type { LensParams } from "./types";
import { usePointerReleaseFallback } from "./use-pointer-release-fallback";

type PhysicalSpring = { mass: number; stiffness: number; damping: number };
type SpringRun = { stop: () => void; finished: Promise<void> };

function springTo(value: MotionValue<number>, target: number, config: PhysicalSpring): SpringRun {
  const distance = Math.abs(target - value.get());
  const animation = animate(value, target, {
    type: "spring",
    ...config,
    velocity: value.getVelocity(),
    restDelta: Math.max(0.0005, distance * 0.001),
    restSpeed: Math.max(0.01, distance * 0.025),
  });
  return {
    stop: () => animation.stop(),
    finished: animation.then(() => undefined, () => undefined),
  };
}

function waitForRest(value: WritableMotionValue<number>, epsilon = 0.015, timeoutMs = 900, holdMs = 50) {
  return new Promise<void>((resolve) => {
    let timeout = 0;
    let restTimer = 0;
    let unsubscribe: () => void = () => undefined;
    const finish = () => {
      window.clearTimeout(timeout);
      window.clearTimeout(restTimer);
      unsubscribe();
      resolve();
    };
    const check = (current: number) => {
      if (Math.abs(current) <= epsilon) {
        if (restTimer === 0) restTimer = window.setTimeout(finish, holdMs);
      } else if (restTimer !== 0) {
        window.clearTimeout(restTimer);
        restTimer = 0;
      }
    };
    unsubscribe = value.on("change", check);
    check(value.get());
    timeout = window.setTimeout(finish, timeoutMs);
  });
}

function useDerivedMotion(source: WritableMotionValue<number>, map: (value: number) => number) {
  const mapRef = useRef(map);
  mapRef.current = map;
  const derived = useRef(motionValue(map(source.get()))).current;
  useEffect(() => {
    derived.set(mapRef.current(source.get()));
    return source.on("change", (value) => derived.set(mapRef.current(value)));
  }, [source, derived]);
  return derived;
}

function useDerivedMotion2(
  first: WritableMotionValue<number>,
  second: WritableMotionValue<number>,
  map: (first: number, second: number) => number,
) {
  const mapRef = useRef(map);
  mapRef.current = map;
  const derived = useRef(motionValue(map(first.get(), second.get()))).current;
  useEffect(() => {
    const update = () => derived.set(mapRef.current(first.get(), second.get()));
    update();
    const firstStop = first.on("change", update);
    const secondStop = second.on("change", update);
    return () => { firstStop(); secondStop(); };
  }, [first, second, derived]);
  return derived;
}

function useVelocityDeformation(
  source: WritableMotionValue<number>,
  config: {
    target: (speed: number) => number;
    stiffness: number | (() => number);
    damping: number | (() => number);
  },
) {
  const configRef = useRef(config);
  configRef.current = config;
  const deformation = useRef(motionValue(0)).current;
  const boostRef = useRef(0);
  const velocityImpulseRef = useRef(0);
  const wakeRef = useRef<() => void>(() => undefined);
  const setBoost = useRef((value: number) => {
    boostRef.current = value;
    wakeRef.current();
  }).current;
  const kick = useRef((impulse: number) => {
    velocityImpulseRef.current = impulse;
    wakeRef.current();
  }).current;

  useEffect(() => {
    let frame = 0;
    let running = false;
    let previousTime = 0;
    let previousPosition = source.get();
    let position = deformation.get();
    let velocity = 0;
    const tick = (now: number) => {
      const elapsed = previousTime === 0 ? 1 / 60 : (now - previousTime) / 1_000;
      const dt = Math.min(elapsed, 0.033);
      previousTime = now;
      const current = source.get();
      const sourceVelocity = (current - previousPosition) / Math.min(Math.max(elapsed, 0.008), 0.03);
      previousPosition = current;
      const options = configRef.current;
      const target = Math.max(options.target(Math.abs(sourceVelocity)), boostRef.current);
      const stiffness = typeof options.stiffness === "function" ? options.stiffness() : options.stiffness;
      const damping = typeof options.damping === "function" ? options.damping() : options.damping;
      velocity += velocityImpulseRef.current;
      velocityImpulseRef.current = 0;
      const acceleration = -stiffness * (position - target) - damping * velocity;
      velocity += acceleration * dt;
      position += velocity * dt;
      deformation.set(position);
      if (Math.abs(position) < 0.0005 && Math.abs(velocity) < 0.005 && Math.abs(sourceVelocity) < 0.005 && boostRef.current === 0) {
        running = false;
        deformation.set(0);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (running) return;
      running = true;
      previousTime = performance.now();
      position = deformation.get();
      frame = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;
    const unsubscribe = source.on("change", wake);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      wakeRef.current = () => undefined;
    };
  }, [source, deformation]);

  return { deformation, setBoost, kick };
}

function rubberBand(distance: number, limit: number, dampening: number) {
  return limit * (1 - (1 - Math.min(1, distance / dampening)) ** 3);
}

function darkTheme() {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
}

function safariBrowser() {
  return typeof navigator !== "undefined" && /^((?!chrome|chromium|android).)*safari/i.test(navigator.userAgent);
}

const SWITCH_BASE: Partial<LensParams> = {
  mapSize: 256,
  depth: 2,
  chromaAmount: 1,
  scaleX: 0.25,
  scaleY: 0.25,
  sdfBoundary: true,
  edgeFalloff: true,
  domeDepth: 6,
  splayAmount: 0.4,
  blurAmount: 0,
  brightness: 0.06,
  specularStrength: 1,
  specularRotation: 45,
  tint: 0,
  glowStrength: 0,
  glowSpread: 0.5,
  glowExponent: 1.5,
  edgeStrength: 0,
  edgeWidth: 2,
  edgeExponent: 1.5,
  edgeShadow: "0 2px 6px rgba(0,0,0,.16)",
  edgeInsetShadow: "0 -4px 10px rgba(0,0,0,.12)",
};

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
  const [smallOpticsActive, setSmallOpticsActive] = useState(false);
  const opticsActive = !compact || smallOpticsActive;
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
  const pressTransition = { ease: pressEase, duration: 0.32 };
  const releaseTransition = { ease: [0.22, 1, 0.36, 1] as const, duration: 0.52 };
  const travelTransition = { ease: pressEase, duration: 0.6 };

  const offset = useMotionValue(current ? travel : 0);
  const x = useTransform(offset, (position) => (padding + inset + thumbWidth / 2 + position) / filterWidth);
  const baseLensW = useMotionValue(halfThumbWidth);
  const baseLensH = useMotionValue(halfThumbHeight);
  const radius = useMotionValue(halfThumbHeight);
  const tintOpacity = useMotionValue(1);
  const targetScaleX = useMotionValue(0.85);
  const targetScaleY = useMotionValue(0.525);
  const tintBlur = useMotionValue(restTintBlur);
  const shadowOpacity = useMotionValue(0);
  const deformation = useMotionValue(0);
  const deformationBoost = useRef(0);
  const deformationWake = useRef<() => void>(() => undefined);
  const lensW = useTransform(() => baseLensW.get() * (1 - 0.2 * deformation.get()));
  const lensH = useTransform(() => baseLensH.get() * (1 + 0.4 * deformation.get()));
  const edgeBias = useTransform(tintOpacity, (opacity) => opacity * 0.5);

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
  const opticsTimer = useRef<number | null>(null);
  const travelAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    let frame = 0;
    let amount = 0;
    let amountVelocity = 0;
    let previousTime = 0;
    let previousPosition = offset.get();
    let running = false;
    const tick = (now: number) => {
      const elapsed = (now - previousTime) / 1_000;
      const dt = Math.min(elapsed, 0.033);
      previousTime = now;
      const position = offset.get();
      const velocity = (position - previousPosition) / Math.min(Math.max(elapsed, 0.008), 0.03);
      previousPosition = position;
      const speed = Math.abs(velocity);
      const target = Math.min(0.35, Math.max(Math.min(0.35, 0.012 * speed ** 0.75), deformationBoost.current));
      const force = -180 * (amount - target) - 14 * amountVelocity;
      amountVelocity += force * dt;
      amount += amountVelocity * dt;
      deformation.set(amount);
      if (Math.abs(amount) < 0.0005 && Math.abs(amountVelocity) < 0.005 && speed < 0.005 && deformationBoost.current === 0) {
        running = false;
        deformation.set(0);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (running) return;
      running = true;
      previousTime = performance.now();
      previousPosition = offset.get();
      frame = requestAnimationFrame(tick);
    };
    const unsubscribe = offset.on("change", wake);
    deformationWake.current = wake;
    return () => { unsubscribe(); cancelAnimationFrame(frame); deformationWake.current = () => undefined; };
  }, [offset, deformation]);

  const wakeDeformation = () => deformationWake.current();
  const expand = () => {
    if (opticsTimer.current !== null) clearTimeout(opticsTimer.current);
    if (compact) setSmallOpticsActive(true);
    animate(baseLensW, halfThumbWidth * 1.5, pressTransition);
    animate(baseLensH, halfThumbHeight * 1.5, pressTransition);
    animate(radius, halfThumbHeight * 1.5, pressTransition);
    animate(tintOpacity, 0, pressTransition);
    animate(tintBlur, 0, pressTransition);
    animate(targetScaleX, 0.95, pressTransition);
    animate(targetScaleY, 0.975, pressTransition);
    animate(shadowOpacity, 1, pressTransition);
  };
  const collapse = () => {
    animate(baseLensW, halfThumbWidth, releaseTransition);
    animate(baseLensH, halfThumbHeight, releaseTransition);
    animate(radius, halfThumbHeight, releaseTransition);
    animate(tintOpacity, 1, releaseTransition);
    animate(tintBlur, restTintBlur, releaseTransition);
    animate(targetScaleX, 0.85, releaseTransition);
    animate(targetScaleY, 0.525, releaseTransition);
    animate(shadowOpacity, 0, releaseTransition);
    if (compact) {
      if (opticsTimer.current !== null) clearTimeout(opticsTimer.current);
      opticsTimer.current = window.setTimeout(() => setSmallOpticsActive(false), 560);
    }
  };
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
    if (opticsTimer.current !== null) clearTimeout(opticsTimer.current);
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

  const lensBase = compact ? { ...SWITCH_BASE, mapSize: 128 } : SWITCH_BASE;
  const lens: Partial<LensParams> = darkTheme()
    ? { ...lensBase, brightness: 0.12, glowStrength: 0.4, edgeStrength: 0.5, specularDark: false }
    : { ...lensBase, brightness: -0.02, specularRotation: 30, specularStrength: 1.5, glowStrength: 0.4, glowExponent: 2, edgeStrength: 0.5, edgeWidth: 1.5, edgeExponent: 1, specularDark: true };

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
        edgeBias={edgeBias}
        filterEnabled={opticsActive}
        filterResolution={compact ? 1 : 2}
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
                    wakeDeformation();
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

const SLIDER_BASE: Partial<LensParams> = {
  mapSize: 256,
  depth: 2,
  chromaAmount: 0.65,
  scaleX: 0.06,
  scaleY: 0.06,
  sdfBoundary: true,
  edgeFalloff: true,
  domeDepth: 5,
  splayAmount: 0.5,
  blurAmount: 0,
  brightness: 0.06,
  specularStrength: 1.5,
  specularRotation: 45,
  glowStrength: 0.4,
  glowSpread: 0.5,
  glowExponent: 1.5,
  edgeStrength: 0,
  edgeWidth: 3,
  edgeExponent: 1.5,
  edgeShadow: "0 2px 6px rgba(0,0,0,.16)",
  edgeInsetShadow: "0 -4px 10px rgba(0,0,0,.12)",
  restEdgeShadow: "0 1.333px 5.333px var(--shadow-strong)",
};
const SLIDER_CLICK_SPRING = { mass: 0.8, stiffness: 300, damping: 24 };

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
  const [smallOpticsActive, setSmallOpticsActive] = useState(false);
  const opticsActive = !compact || smallOpticsActive;
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
  const pressTransition = { ease: [0.22, 1.15, 0.36, 1.06] as const, duration: 0.32 };
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
  const baseLensW = useMotionValue(halfThumbWidth);
  const baseLensH = useMotionValue(halfThumbHeight);
  const radius = useMotionValue(halfThumbHeight);
  const tintOpacity = useMotionValue(1);
  const targetScaleX = useMotionValue(0.85);
  const targetScaleY = useMotionValue(0.525);
  const tintBlur = useMotionValue(restTintBlur);
  const shadowOpacity = useMotionValue(0);
  const restShadowOpacity = useTransform(shadowOpacity, (opacity) => 1 - opacity);
  const deformation = useMotionValue(0);
  const deformationBoost = useRef(0);
  const deformationWake = useRef<() => void>(() => undefined);
  const lensW = useTransform(() => baseLensW.get() * (1 - 0.2 * deformation.get()));
  const lensH = useTransform(() => baseLensH.get() * (1 + 0.4 * deformation.get()));

  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerId = useRef<number | null>(null);
  const pointerStart = useRef(0);
  const offsetStart = useRef(0);
  const dragging = useRef(false);
  const pointerMoved = useRef(false);
  const clickAnimation = useRef<SpringRun | null>(null);
  const opticsTimer = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;
    let amount = 0;
    let amountVelocity = 0;
    let previousTime = 0;
    let previousPosition = offset.get();
    let running = false;
    const tick = (now: number) => {
      const elapsed = (now - previousTime) / 1_000;
      const dt = Math.min(elapsed, 0.033);
      previousTime = now;
      const position = offset.get();
      const velocity = (position - previousPosition) / Math.min(Math.max(elapsed, 0.008), 0.03);
      previousPosition = position;
      const speed = Math.abs(velocity);
      const target = Math.min(0.35, Math.max(Math.min(0.35, 0.012 * speed ** 0.75), deformationBoost.current));
      const force = -180 * (amount - target) - 14 * amountVelocity;
      amountVelocity += force * dt;
      amount += amountVelocity * dt;
      deformation.set(amount);
      if (Math.abs(amount) < 0.0005 && Math.abs(amountVelocity) < 0.005 && speed < 0.005 && deformationBoost.current === 0) {
        running = false;
        deformation.set(0);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (running) return;
      running = true;
      previousTime = performance.now();
      previousPosition = offset.get();
      frame = requestAnimationFrame(tick);
    };
    deformationWake.current = wake;
    const unsubscribe = offset.on("change", wake);
    return () => { unsubscribe(); cancelAnimationFrame(frame); deformationWake.current = () => undefined; };
  }, [offset, deformation]);

  const expand = () => {
    if (opticsTimer.current !== null) clearTimeout(opticsTimer.current);
    if (compact) setSmallOpticsActive(true);
    animate(baseLensW, halfThumbWidth * 1.5, pressTransition);
    animate(baseLensH, halfThumbHeight * 1.5, pressTransition);
    animate(radius, halfThumbHeight * 1.5, pressTransition);
    animate(tintOpacity, 0, pressTransition);
    animate(tintBlur, 0, pressTransition);
    animate(targetScaleX, 0.95, pressTransition);
    animate(targetScaleY, 0.975, pressTransition);
    animate(shadowOpacity, 1, pressTransition);
  };
  const collapse = () => {
    animate(baseLensW, halfThumbWidth, releaseTransition);
    animate(baseLensH, halfThumbHeight, releaseTransition);
    animate(radius, halfThumbHeight, releaseTransition);
    animate(tintOpacity, 1, releaseTransition);
    animate(tintBlur, restTintBlur, releaseTransition);
    animate(targetScaleX, 0.85, releaseTransition);
    animate(targetScaleY, 0.525, releaseTransition);
    animate(shadowOpacity, 0, releaseTransition);
    if (compact) {
      if (opticsTimer.current !== null) clearTimeout(opticsTimer.current);
      opticsTimer.current = window.setTimeout(() => setSmallOpticsActive(false), 560);
    }
  };
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
    deformationBoost.current = 0;
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
    if (opticsTimer.current !== null) clearTimeout(opticsTimer.current);
    clickAnimation.current?.stop();
    if (pointerId.current !== null && trackRef.current) {
      try { trackRef.current.releasePointerCapture(pointerId.current); } catch {}
    }
  }, []);

  const lensBase = compact ? { ...SLIDER_BASE, mapSize: 128 } : SLIDER_BASE;
  const lens: Partial<LensParams> = darkTheme()
    ? { ...lensBase, scaleX: 0.133, scaleY: 0.135, brightness: 0.12, edgeStrength: 0.5, edgeWidth: 1, specularDark: false }
    : { ...lensBase, scaleX: 0.1, scaleY: safariBrowser() ? 0.25 : 0.1, brightness: -0.02, specularRotation: 30, glowExponent: 2, edgeStrength: 0.5, edgeWidth: 1, edgeExponent: 1, specularDark: true };

  return (
    <div ref={wrapperRef} data-size={size} className={["dg-slider", className].filter(Boolean).join(" ")} style={{ width, height: thumbHeight, "--dg-slider-fill": `${thumbWidth / 2 + toOffset(current)}px`, "--dg-slider-progress": toOffset(current) / travel } as React.CSSProperties}>
      <Glass
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
        restShadowOpacity={restShadowOpacity}
        filterEnabled={opticsActive}
        filterResolution={compact ? 1 : 2}
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
              deformationBoost.current = 0.175;
              deformationWake.current();
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
              deformationBoost.current = 0;
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

type IconProps = { className?: string };
const IconFrame = ({ className, children }: IconProps & { children: ReactNode }) => <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">{children}</svg>;
const HubsIcon = memo(({ className }: IconProps) => {
  const id = useId();
  return <IconFrame className={className}><defs><mask id={id}><rect width="16" height="16" fill="white"/><path d="M9.998 3.79a1 1 0 0 1 1 0l2.899 1.674a1 1 0 0 1 .5.866v3.347a1 1 0 0 1-.5.866l-2.899 1.674a1 1 0 0 1-1 0L7.1 10.543a1 1 0 0 1-.5-.866V6.33a1 1 0 0 1 .5-.866L9.998 3.79Z" fill="black" stroke="black" strokeWidth="3" strokeLinejoin="round"/></mask></defs><path d="M4.902 2.948a1.2 1.2 0 0 1 1.2 0L9.58 4.956a1.2 1.2 0 0 1 .6 1.04v4.016a1.2 1.2 0 0 1-.6 1.04L6.102 13.06a1.2 1.2 0 0 1-1.2 0l-3.479-2.008a1.2 1.2 0 0 1-.6-1.04V5.996a1.2 1.2 0 0 1 .6-1.04l3.479-2.008Z" fill="var(--dg-icon-color-1)" mask={`url(#${id})`}/><path d="M9.998 3.79a1 1 0 0 1 1 0l2.899 1.674a1 1 0 0 1 .5.866v3.347a1 1 0 0 1-.5.866l-2.899 1.674a1 1 0 0 1-1 0L7.1 10.543a1 1 0 0 1-.5-.866V6.33a1 1 0 0 1 .5-.866L9.998 3.79Z" fill="var(--dg-icon-color-2)"/></IconFrame>;
});
const SpokesIcon = memo(({ className }: IconProps) => <IconFrame className={className}><path d="M5.053 2.219c-.185-.365-.041-.815.34-.962a7.3 7.3 0 0 1 4.346-.274c.397.099.596.527.458.912l-.355.987c-.139.385-.563.578-.965.501a4.1 4.1 0 0 0-2.327.147c-.39.126-.835-.013-1.02-.377l-.477-.934ZM10.945 13.782c.185.364.041.814-.34.961a7.3 7.3 0 0 1-4.346.274c-.397-.099-.596-.527-.458-.912l.355-.987c.139-.385.563-.578.965-.501a4.1 4.1 0 0 0 2.327-.147c.39-.126.835.013 1.02.377l.477.935ZM1.52 7.66c-.409-.02-.727-.37-.664-.775a7.3 7.3 0 0 1 1.937-3.9c.284-.295.754-.253 1.018.059l.677.801c.264.313.22.777-.048 1.087a4.1 4.1 0 0 0-1.037 2.089c-.085.4-.428.716-.836.694L1.52 7.66ZM11.534 2.559c.223-.343.684-.444 1.003-.187a7.3 7.3 0 0 1 2.41 3.627c.113.393-.159.78-.561.852l-1.032.186c-.403.073-.782-.198-.917-.584a4.1 4.1 0 0 0-1.791-1.943c-.304-.274-.406-.729-.183-1.072l.571-.879ZM14.48 8.34c.409.02.727.37.664.775a7.3 7.3 0 0 1-1.937 3.9c-.284.295-.754.253-1.018-.059l-.677-.801c-.264-.313-.22-.777.048-1.087a4.1 4.1 0 0 0 1.037-2.089c.085-.4.428-.716.836-.694l1.047.055ZM4.466 13.441c-.223.343-.684.444-1.003.187a7.3 7.3 0 0 1-2.41-3.627c-.113-.393.159-.78.561-.852l1.032-.186c.403-.073.782.198.917.584a4.1 4.1 0 0 0 1.291 1.943c.304.274.406.729.183 1.072l-.571.879Z" fill="var(--dg-icon-color-1)"/><circle cx="8" cy="8" r="3" fill="var(--dg-icon-color-2)"/></IconFrame>);
const ReservesIcon = memo(({ className }: IconProps) => {
  const id = useId();
  return <IconFrame className={className}><defs><mask id={id}><rect width="16" height="16" fill="white"/><circle cx="5.5" cy="6" r="5.125" fill="black" stroke="black" strokeWidth="3"/></mask></defs><circle cx="10.5" cy="10" r="4.5" fill="var(--dg-icon-color-2)" mask={`url(#${id})`}/><circle cx="5.5" cy="6" r="5.125" fill="var(--dg-icon-color-1)"/></IconFrame>;
});
const AssetsIcon = memo(({ className }: IconProps) => <IconFrame className={className}><path d="M7.97 15.015c-3.053 0-5.53-1.486-5.53-3.318v-.955c.299.281.63.529.978.737 1.225.736 2.838 1.15 4.553 1.15 1.714 0 3.327-.414 4.553-1.15.347-.208.678-.456.976-.737v.955c0 1.832-2.475 3.318-5.53 3.318ZM7.97 11.379c-3.053 0-5.53-1.485-5.53-3.318v-.954c.299.281.63.529.978.737 1.225.735 2.838 1.15 4.553 1.15 1.714 0 3.327-.415 4.553-1.15.347-.208.678-.456.976-.737v.954c0 1.833-2.475 3.318-5.53 3.318Z" fill="var(--dg-icon-color-1)"/><ellipse cx="7.97" cy="4.426" rx="5.53" ry="3.318" fill="var(--dg-icon-color-2)"/></IconFrame>);
const ChainsIcon = memo(({ className }: IconProps) => <IconFrame className={className}><circle cx="12.5" cy="8" r="2.5" fill="var(--dg-icon-color-1)"/><circle cx="4.5" cy="3.5" r="2.5" fill="var(--dg-icon-color-1)"/><circle cx="4.5" cy="12.5" r="2.5" fill="var(--dg-icon-color-1)"/><circle cx="8.377" cy="10.293" r="1.273" fill="var(--dg-icon-color-2)"/><circle cx="4.301" cy="8" r="1.273" fill="var(--dg-icon-color-2)"/><circle cx="8.377" cy="5.707" r="1.273" fill="var(--dg-icon-color-2)"/></IconFrame>);

const DEFAULT_SEGMENTS = [
  { value: "hubs", label: "中心", Icon: HubsIcon, color1: "#00aeff", color2: "#008aff" },
  { value: "spokes", label: "分支", Icon: SpokesIcon, color1: "#bdbbff", color2: "#9896ff" },
  { value: "reserves", label: "储备", Icon: ReservesIcon, color1: "#39beb7", color2: "#00827b" },
  { value: "assets", label: "资产", Icon: AssetsIcon, color1: "#ff8130", color2: "#f00" },
  { value: "chains", label: "网络", Icon: ChainsIcon, color1: "#ffd400", color2: "#ffb400" },
] as const;

const SEGMENTED_PAD_X = 80;
const SEGMENTED_PAD_Y = 80;
const SEGMENTED_CHROMA_AMOUNT = 0.24;
const SEGMENTED_TRAVEL_SPRING = { mass: 1, stiffness: 157.9, damping: 17.6 };
const SEGMENTED_PRESS_SPRING = { mass: 0.9, stiffness: 190, damping: 18 };
const SEGMENTED_DRAG_CATCHUP_SPRING = { mass: 0.7, stiffness: 360, damping: 28 };
const SEGMENTED_RELEASE_SPRING = { mass: 1, stiffness: 150, damping: 19 };
const SEGMENTED_HEIGHT_RELEASE_SPRING = { mass: 0.8, stiffness: 260, damping: 23.6 };
const SEGMENTED_IMPACT_RETENTION = 0.18;
const SEGMENTED_TRAIL_BIAS = 0.82;
const SEGMENTED_HOLD_IMPACT_SCRIPT = {
  stiffness: 360,
  damping: 24,
  impulse: -7,
} as const;

export interface GlassSegmentedProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  labels?: Partial<Record<string, string>>;
  ariaLabel?: string;
}

export function GlassSegmented({ value, defaultValue = "hubs", onValueChange, className, labels, ariaLabel = "选项" }: GlassSegmentedProps) {
  const [local, setLocal] = useState(defaultValue);
  const current = value ?? local;
  const selected = DEFAULT_SEGMENTS.some((item) => item.value === current) ? current : "hubs";
  const rootRef = useRef<HTMLDivElement>(null);
  const solidThumbRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragPointer = useRef<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffsetX = useRef(0);
  const dragClientX = useRef(0);
  const dragMoved = useRef(false);
  const suppressDragClick = useRef(false);
  const releaseTimer = useRef<number | null>(null);
  const impactTargetX = useRef(0.5);
  const impactDirection = useRef(0);
  const impactLanded = useRef(false);
  const impactKickRef = useRef<(impulse: number) => void>(() => undefined);
  const impactWidth = useRef(1);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const lensW = useMotionValue(50);
  const lensH = useMotionValue(20);
  const interaction = useMotionValue(0);
  const glassOpacity = useMotionValue(0);
  const solidOpacity = useMotionValue(1);
  const glassHeight = useMotionValue(0);
  const pointerX = useMotionValue(0);
  const dragCatchup = useMotionValue(0);
  const stationaryPress = () => dragPointer.current !== null && !dragMoved.current;
  const { deformation, kick: kickDeformation } = useVelocityDeformation(pointerX, {
    target: (speed) => {
      const direction = impactDirection.current;
      const trackingPointer = dragPointer.current !== null && dragMoved.current;
      if (!trackingPointer && direction !== 0) {
        if (!impactLanded.current && (x.get() - impactTargetX.current) * direction >= 0) {
          impactLanded.current = true;
          if (stationaryPress()) impactKickRef.current(SEGMENTED_HOLD_IMPACT_SCRIPT.impulse);
        }
        if (impactLanded.current) return 0;
      }
      return Math.min(0.46, speed ** 0.62 * 0.0095);
    },
    stiffness: () => impactLanded.current && stationaryPress() ? SEGMENTED_HOLD_IMPACT_SCRIPT.stiffness : 210,
    damping: () => {
      if (!impactLanded.current) return 15.5;
      if (stationaryPress()) return SEGMENTED_HOLD_IMPACT_SCRIPT.damping;
      return 19.5;
    },
  });
  impactKickRef.current = kickDeformation;
  const impactX = useDerivedMotion2(x, deformation, (position, amount) => {
    const direction = impactDirection.current;
    if (direction === 0) return position;
    const target = impactTargetX.current;
    const overshoot = (position - target) * direction;
    const retainedOvershoot = impactLanded.current || overshoot > 0 ? overshoot * SEGMENTED_IMPACT_RETENTION : overshoot;
    const softened = target + direction * retainedOvershoot;
    const velocityStretch = lensW.get() * (1 + interaction.get() * 0.32) * Math.max(0, amount) * 1.45;
    return softened - direction * velocityStretch * SEGMENTED_TRAIL_BIAS / Math.max(1, impactWidth.current);
  });
  const stretchedLensW = useDerivedMotion2(lensW, deformation, (width, amount) => width * (1 + amount * 1.45));
  const stretchedLensH = useDerivedMotion2(lensH, deformation, (height, amount) => height * (1 - amount * 0.52));
  const renderedLensW = useDerivedMotion2(stretchedLensW, interaction, (width, amount) => width * (1 + amount * 0.32));
  const expandedLensH = useDerivedMotion2(stretchedLensH, interaction, (height, amount) => height * (1 + amount * 0.48));
  const heightBoost = useDerivedMotion2(glassHeight, deformation, (active, amount) =>
    active * (0.34 - Math.min(0.22, Math.max(0, amount) * 0.72)));
  const minimumGlassH = useDerivedMotion2(lensH, heightBoost, (height, boost) => height * (1 + boost));
  const renderedLensH = useDerivedMotion2(expandedLensH, minimumGlassH, (height, minimum) => Math.max(height, minimum));
  const zoom = useDerivedMotion(deformation, (amount) => 1 + amount * 3.5);
  const boostedDepth = useDerivedMotion2(deformation, interaction, (amount, pressed) => 2.5 * (1 + amount * 5 + pressed * 0.2));
  const stops = useRef<SpringRun[]>([]);
  const interactionStop = useRef<SpringRun | null>(null);
  const heightStop = useRef<SpringRun | null>(null);
  const glassAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const solidAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const dragCatchupAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const transitionToken = useRef(0);
  const travelSettled = useRef<Promise<void>>(Promise.resolve());

  const updateSolidThumb = (targetValue: string) => {
    const item = itemRefs.current.get(targetValue);
    const thumb = solidThumbRef.current;
    if (!item || !thumb || item.offsetParent === null) return;
    thumb.style.width = `${item.offsetWidth}px`;
    thumb.style.height = `${item.offsetHeight}px`;
    thumb.style.transform = `translate3d(${item.offsetLeft}px, ${item.offsetTop}px, 0)`;
  };
  const updateGeometry = (targetValue = selectedRef.current, instant = false) => {
    const root = rootRef.current;
    let item = itemRefs.current.get(targetValue);
    if (!root) return Promise.resolve();
    if (!item || item.offsetParent === null) {
      const firstVisible = DEFAULT_SEGMENTS.map((segment) => ({ segment, node: itemRefs.current.get(segment.value) })).find(({ node }) => node?.offsetParent != null);
      if (firstVisible && firstVisible.segment.value !== targetValue) {
        selectedRef.current = firstVisible.segment.value;
        if (value === undefined) setLocal(firstVisible.segment.value);
        onValueChange?.(firstVisible.segment.value);
      }
      return Promise.resolve();
    }
    updateSolidThumb(targetValue);
    const rootRect = root.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const expanded = {
      left: rootRect.left - SEGMENTED_PAD_X,
      top: rootRect.top - SEGMENTED_PAD_Y,
      width: rootRect.width + SEGMENTED_PAD_X * 2,
      height: rootRect.height + SEGMENTED_PAD_Y * 2,
    };
    const nextX = (itemRect.left + itemRect.width / 2 - expanded.left) / expanded.width;
    const nextY = (itemRect.top + itemRect.height / 2 - expanded.top) / expanded.height;
    const nextDirection = Math.sign(nextX - x.get());
    impactTargetX.current = nextX;
    impactLanded.current = false;
    impactWidth.current = expanded.width;
    if (nextDirection !== 0) impactDirection.current = nextDirection;
    stops.current.forEach((run) => run.stop());
    stops.current = [];
    if (instant) {
      impactDirection.current = 0;
      x.set(nextX); y.set(nextY); lensW.set(itemRect.width / 2); lensH.set(itemRect.height / 2);
      return Promise.resolve();
    } else {
      const runs = [
        springTo(x, nextX, SEGMENTED_TRAVEL_SPRING),
        springTo(y, nextY, SEGMENTED_TRAVEL_SPRING),
        springTo(lensW, itemRect.width / 2, SEGMENTED_TRAVEL_SPRING),
        springTo(lensH, itemRect.height / 2, SEGMENTED_TRAVEL_SPRING),
      ];
      stops.current = runs;
      return Promise.all(runs.map((run) => run.finished)).then(() => undefined);
    }
  };
  const updateGeometryRef = useRef(updateGeometry);
  updateGeometryRef.current = updateGeometry;

  const mounted = useRef(false);
  useLayoutEffect(() => {
    updateSolidThumb(selected);
    if (dragPointer.current === null) updateGeometry(selected, !mounted.current);
    mounted.current = true;
  }, [selected]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      if (dragPointer.current === null) updateGeometryRef.current(selectedRef.current, true);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    return x.on("change", (position) => {
      const root = rootRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const expandedLeft = rootRect.left - SEGMENTED_PAD_X;
      const expandedWidth = rootRect.width + SEGMENTED_PAD_X * 2;
      pointerX.set(expandedLeft + position * expandedWidth);
    });
  }, [x, pointerX]);
  useEffect(() => () => {
    stops.current.forEach((run) => run.stop());
    interactionStop.current?.stop();
    heightStop.current?.stop();
    glassAnimation.current?.stop();
    solidAnimation.current?.stop();
    dragCatchupAnimation.current?.stop();
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
  }, []);

  const choose = (next: string) => {
    if (next === selectedRef.current) return;
    selectedRef.current = next;
    updateSolidThumb(next);
    if (dragPointer.current !== null) {
      const item = itemRefs.current.get(next);
      if (item) {
        lensW.set(item.getBoundingClientRect().width / 2);
        lensH.set(item.getBoundingClientRect().height / 2);
      }
    }
    if (value === undefined) setLocal(next);
    onValueChange?.(next);
  };

  const nearestSegment = (clientX: number) => {
    let nearest: { value: string; rect: DOMRect; distance: number } | null = null;
    for (const segment of DEFAULT_SEGMENTS) {
      const item = itemRefs.current.get(segment.value);
      if (!item || item.offsetParent === null) continue;
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (!nearest || distance < nearest.distance) nearest = { value: segment.value, rect, distance };
    }
    return nearest;
  };
  const trackLens = (clientX: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const expandedLeft = rootRect.left - SEGMENTED_PAD_X;
    const expandedWidth = rootRect.width + SEGMENTED_PAD_X * 2;
    const visible = DEFAULT_SEGMENTS.flatMap((segment) => {
      const item = itemRefs.current.get(segment.value);
      if (!item || item.offsetParent === null) return [];
      return [{ value: segment.value, rect: item.getBoundingClientRect() }];
    });
    if (visible.length === 0) return;
    const firstCenter = visible[0].rect.left + visible[0].rect.width / 2;
    const last = visible[visible.length - 1].rect;
    const lastCenter = last.left + last.width / 2;
    const centerX = Math.max(firstCenter, Math.min(lastCenter, clientX - dragOffsetX.current - dragCatchup.get()));
    const nextX = (centerX - expandedLeft) / expandedWidth;
    const nextDirection = Math.sign(nextX - x.get());
    impactTargetX.current = nextX;
    impactLanded.current = false;
    impactWidth.current = expandedWidth;
    if (nextDirection !== 0) impactDirection.current = nextDirection;
    pointerX.set(centerX);
    x.set(nextX);
  };
  const moveDrag = (clientX: number) => {
    dragClientX.current = clientX;
    const centerX = clientX - dragOffsetX.current - dragCatchup.get();
    const nearest = nearestSegment(centerX);
    if (nearest) choose(nearest.value);
    trackLens(clientX);
  };
  const stopDragCatchup = () => {
    dragCatchupAnimation.current?.stop();
    dragCatchupAnimation.current = null;
    dragCatchup.set(0);
  };
  const startDragCatchup = (clientX: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const expandedLeft = rootRect.left - SEGMENTED_PAD_X;
    const expandedWidth = rootRect.width + SEGMENTED_PAD_X * 2;
    const currentCenter = expandedLeft + x.get() * expandedWidth;
    dragClientX.current = clientX;
    dragOffsetX.current = 0;
    dragCatchupAnimation.current?.stop();
    dragCatchup.set(clientX - currentCenter);
    dragCatchupAnimation.current = animate(dragCatchup, 0, {
      type: "spring",
      ...SEGMENTED_DRAG_CATCHUP_SPRING,
      velocity: 0,
      restDelta: 0.1,
      restSpeed: 1,
      onUpdate: () => moveDrag(dragClientX.current),
    });
  };
  const releaseInteraction = (delay = 0, settle = true) => {
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    if (delay > 0) {
      releaseTimer.current = window.setTimeout(() => {
        releaseTimer.current = null;
        releaseInteraction(0, settle);
      }, delay);
      return;
    }
    const token = ++transitionToken.current;
    interactionStop.current?.stop();
    const shape = springTo(interaction, 0, SEGMENTED_RELEASE_SPRING);
    interactionStop.current = shape;
    heightStop.current?.stop();
    const height = springTo(glassHeight, 0, SEGMENTED_HEIGHT_RELEASE_SPRING);
    heightStop.current = height;
    const travel = settle ? updateGeometry(selectedRef.current, false) : travelSettled.current;
    if (settle) travelSettled.current = travel;
    void Promise.all([shape.finished, height.finished])
      .then(() => waitForRest(deformation, 0.045, 500, 16))
      .then(() => {
        if (token !== transitionToken.current) return;
        glassAnimation.current?.stop();
        solidAnimation.current?.stop();
        solidOpacity.set(1);
        rootRef.current?.setAttribute("data-crossfading", "");
        const fade = animate(glassOpacity, 0, { duration: 0.265, ease: [0.4, 0, 0.2, 1] });
        glassAnimation.current = fade;
        return fade.then(() => {
          if (token === transitionToken.current) {
            rootRef.current?.removeAttribute("data-interacting");
            rootRef.current?.removeAttribute("data-crossfading");
          }
        });
      });
  };
  const finishDrag = (pointerId: number, target: HTMLDivElement) => {
    if (dragPointer.current !== pointerId) return;
    dragPointer.current = null;
    stopDragCatchup();
    try { target.releasePointerCapture(pointerId); } catch {}
    releaseInteraction(dragMoved.current ? 0 : 90, dragMoved.current);
    if (dragMoved.current) {
      suppressDragClick.current = true;
      requestAnimationFrame(() => { suppressDragClick.current = false; });
    }
  };
  const lens: Partial<LensParams> = darkTheme()
    ? { lensW: 50, lensH: 20, borderRadius: 16, mapSize: 256, depth: 2.5, chromaAmount: SEGMENTED_CHROMA_AMOUNT, scaleX: 0.045, scaleY: 0.025, sdfBoundary: true, edgeFalloff: true, splayAmount: 1, brightness: 0.06, specularStrength: 1, specularRotation: 45, glowStrength: 0.5, glowSpread: 0.3, glowExponent: 1.5, edgeStrength: 0.6, edgeWidth: 1, edgeExponent: 1.5, specularDark: false }
    : { lensW: 50, lensH: 20, borderRadius: 16, mapSize: 256, depth: 2.5, chromaAmount: SEGMENTED_CHROMA_AMOUNT, scaleX: 0.045, scaleY: safariBrowser() ? 0.075 : 0.025, sdfBoundary: true, edgeFalloff: true, splayAmount: 1, brightness: -0.04, specularStrength: 1, specularRotation: 28, glowStrength: 0, glowSpread: 0.5, glowExponent: 3, edgeStrength: 0.15, edgeWidth: 1.5, edgeExponent: 1, specularDark: true };

  const items = (interactive: boolean, refracted = false) => DEFAULT_SEGMENTS.map(({ value: itemValue, label, Icon, color1, color2 }) => {
    const displayLabel = labels?.[itemValue] ?? label;
    return <button
      key={itemValue}
      ref={interactive ? (node) => { if (node) itemRefs.current.set(itemValue, node); else itemRefs.current.delete(itemValue); } : undefined}
      type="button"
      role={interactive ? "radio" : undefined}
      aria-checked={interactive ? selected === itemValue : undefined}
      tabIndex={interactive && selected === itemValue ? 0 : -1}
      data-selected={selected === itemValue ? "" : undefined}
      className={["dg-tabs__item", refracted ? "dg-tabs__item--overlay" : ""].filter(Boolean).join(" ")}
      style={{
        "--dg-icon-color-1": refracted ? color1 : "#bcbbbb",
        "--dg-icon-color-2": refracted ? color2 : "#8f8f8f",
        "--dg-icon-active-1": color1,
        "--dg-icon-active-2": color2,
      } as React.CSSProperties}
      onClick={interactive ? (event) => {
        if (suppressDragClick.current) { event.preventDefault(); return; }
        choose(itemValue);
      } : undefined}
    ><Icon className="dg-tabs__icon"/><span>{displayLabel}</span></button>;
  });

  return (
    <div ref={rootRef} className={["dg-tabs", className].filter(Boolean).join(" ")}>
      <div
        className="dg-tabs__group"
        role="radiogroup"
        aria-label={ariaLabel}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0 || dragPointer.current !== null) return;
          const nearest = nearestSegment(event.clientX);
          if (!nearest) return;
          dragStart.current = { x: event.clientX, y: event.clientY };
          stopDragCatchup();
          dragOffsetX.current = event.clientX - (nearest.rect.left + nearest.rect.width / 2);
          dragMoved.current = false;
          if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
          transitionToken.current += 1;
          rootRef.current?.setAttribute("data-interacting", "");
          rootRef.current?.removeAttribute("data-crossfading");
          heightStop.current?.stop();
          glassHeight.set(1);
          glassAnimation.current?.stop();
          glassAnimation.current = animate(glassOpacity, 1, { duration: 0.1, ease: [0.22, 1, 0.36, 1] });
          solidAnimation.current?.stop();
          solidAnimation.current = animate(solidOpacity, 0, { duration: 0.1, ease: [0.22, 1, 0.36, 1] });
          interactionStop.current?.stop();
          interactionStop.current = springTo(interaction, 1, SEGMENTED_PRESS_SPRING);
          choose(nearest.value);
          travelSettled.current = updateGeometry(nearest.value, false);
          dragPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.pointerId !== dragPointer.current) return;
          if (!dragMoved.current && Math.hypot(event.clientX - dragStart.current.x, event.clientY - dragStart.current.y) > 2) {
            dragMoved.current = true;
            stops.current.forEach((run) => run.stop());
            stops.current = [];
            startDragCatchup(event.clientX);
          }
          if (!dragMoved.current) return;
          moveDrag(event.clientX);
          event.preventDefault();
        }}
        onPointerUp={(event) => {
          if (event.pointerId !== dragPointer.current) return;
          if (dragMoved.current) moveDrag(event.clientX);
          finishDrag(event.pointerId, event.currentTarget);
        }}
        onPointerCancel={(event) => finishDrag(event.pointerId, event.currentTarget)}
        onLostPointerCapture={(event) => {
          if (event.pointerId === dragPointer.current) {
            dragPointer.current = null;
            stopDragCatchup();
            releaseInteraction(dragMoved.current ? 0 : 90, dragMoved.current);
          }
        }}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const index = DEFAULT_SEGMENTS.findIndex((item) => item.value === selected);
          const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + DEFAULT_SEGMENTS.length) % DEFAULT_SEGMENTS.length;
          const next = DEFAULT_SEGMENTS[nextIndex];
          choose(next.value);
          requestAnimationFrame(() => itemRefs.current.get(next.value)?.focus());
        }}
      >
        <motion.span ref={solidThumbRef} className="dg-tabs__solid-thumb" aria-hidden style={{ opacity: solidOpacity }} />
        {items(true)}
      </div>
      <motion.div className="dg-tabs__glass-layer" aria-hidden style={{ opacity: glassOpacity }}>
        <Glass
          className="dg-tabs__glass"
          lens={lens}
          x={impactX}
          y={y}
          lensW={renderedLensW}
          lensH={renderedLensH}
          autoBorderRadius
          zoom={zoom}
          depth={boostedDepth}
          style={{
            position: "absolute",
            inset: 0,
            padding: `${SEGMENTED_PAD_Y}px ${SEGMENTED_PAD_X}px`,
            margin: `-${SEGMENTED_PAD_Y}px -${SEGMENTED_PAD_X}px`,
            boxSizing: "content-box",
          }}
          refractionTarget={<div className="dg-tabs__overlay"><div className="dg-tabs__group dg-tabs__group--overlay">{items(false, true)}</div></div>}
        >
          <div className="dg-tabs__group dg-tabs__group--glass-base">{items(false)}</div>
        </Glass>
      </motion.div>
    </div>
  );
}
