import { useEffect, useRef } from "react";
import { animate, type MotionValue } from "motion/react";
import { motionValue, type WritableMotionValue } from "../shared/values";
import type { PhysicalSpring } from "./spring";

export type SpringRun = { stop: () => void; finished: Promise<void> };

export function springTo(value: MotionValue<number>, target: number, config: PhysicalSpring): SpringRun {
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

export function waitForRest(values: readonly WritableMotionValue<number>[], error: () => number, epsilon = 1, timeoutMs = 900, holdMs = 32) {
  return new Promise<void>((resolve) => {
    let timeout = 0;
    let restTimer = 0;
    let unsubscribes: Array<() => void> = [];
    const finish = () => {
      window.clearTimeout(timeout);
      window.clearTimeout(restTimer);
      unsubscribes.forEach(stop => stop());
      resolve();
    };
    const check = () => {
      if (error() <= epsilon) {
        if (restTimer === 0) restTimer = window.setTimeout(finish, holdMs);
      } else if (restTimer !== 0) {
        window.clearTimeout(restTimer);
        restTimer = 0;
      }
    };
    unsubscribes = values.map(value => value.on("change", check));
    check();
    timeout = window.setTimeout(finish, timeoutMs);
  });
}

export function useDerivedMotion(source: WritableMotionValue<number>, map: (value: number) => number) {
  const mapRef = useRef(map);
  mapRef.current = map;
  const derived = useRef(motionValue(map(source.get()))).current;
  useEffect(() => {
    derived.set(mapRef.current(source.get()));
    return source.on("change", (value) => derived.set(mapRef.current(value)));
  }, [source, derived]);
  return derived;
}

export function useDerivedMotion2(
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

export function useVelocityDeformation(
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

export function rubberBand(distance: number, limit: number, dampening: number) {
  return limit * (1 - (1 - Math.min(1, distance / dampening)) ** 3);
}


export { usePointerReleaseFallback } from "./use-pointer-release-fallback";
export { useMenuMotion, type MenuMotionOptions, type MenuLayout, type MenuTransition } from "./use-menu-motion";
