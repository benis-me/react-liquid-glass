import { useEffect, useRef } from "react";
import { animate, cancelFrame, frame, useMotionValue, type MotionValue } from "motion/react";
import { motionValue, type WritableMotionValue } from "../shared/values";
import { stepSpring, type PhysicalSpring } from "./spring";

export type SpringRun = { stop: () => void; finished: Promise<void> };

export function springTo(value: MotionValue<number>, target: number, config: PhysicalSpring): SpringRun {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const distance = Math.abs(target - value.get());
  const animation = animate(value, target, {
    type: "spring",
    ...config,
    velocity: value.getVelocity(),
    restDelta: Math.max(0.0005, distance * 0.001),
    restSpeed: Math.max(0.01, distance * 0.025),
  });
  void animation.then(finish, finish);
  return {
    stop: () => { animation.stop(); finish(); },
    finished,
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
  const deformation = useMotionValue(0);
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
    let running = false;
    let previousTime = 0;
    let previousPosition = source.get();
    let position = deformation.get();
    let velocity = 0;
    const tick = ({ timestamp: now }: { timestamp: number }) => {
      const elapsed = Math.max(0.000001, (now - previousTime) / 1_000);
      previousTime = now;
      const current = source.get();
      const sourceVelocity = (current - previousPosition) / elapsed;
      previousPosition = current;
      const options = configRef.current;
      const target = Math.max(options.target(Math.abs(sourceVelocity)), boostRef.current);
      const stiffness = typeof options.stiffness === "function" ? options.stiffness() : options.stiffness;
      const damping = typeof options.damping === "function" ? options.damping() : options.damping;
      velocity += velocityImpulseRef.current;
      velocityImpulseRef.current = 0;
      [position, velocity] = stepSpring(position, velocity, target, { mass: 1, stiffness, damping }, elapsed);
      deformation.set(position);
      if (position === target && velocity === 0 && Math.abs(sourceVelocity) < 0.005) {
        running = false;
        cancelFrame(tick);
      }
    };
    const wake = () => {
      if (running) return;
      running = true;
      previousTime = performance.now();
      previousPosition = source.get();
      position = deformation.get();
      frame.update(tick, true);
    };
    wakeRef.current = wake;
    const unsubscribe = source.on("change", wake);
    return () => {
      unsubscribe();
      cancelFrame(tick);
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

export { usePopoverMotion, popoverFrames, type PopoverLayout } from "./use-popover-motion";
