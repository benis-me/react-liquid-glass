import { useEffect, useRef } from "react";
import { animate, cancelFrame, frame, useMotionValue, type MotionValue } from "motion/react";
import { motionValue, type WritableMotionValue } from "../shared/values.js";
import { stepSpring, type PhysicalSpring } from "./spring.js";

export type SpringRun = { stop: () => void; finished: Promise<void> };

/**
 * Spring `value` to `target`, carrying its current velocity. Pass `velocity` when the value was
 * set straight from pointer events: two of them a fraction of a millisecond apart, as a release
 * often arrives right after its last move, read as a huge velocity and flung the spring.
 */
export function springTo(value: MotionValue<number>, target: number, config: PhysicalSpring, velocity = value.getVelocity()): SpringRun {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const distance = Math.abs(target - value.get());
  const animation = animate(value, target, {
    type: "spring",
    ...config,
    velocity,
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

const MAX_SOURCE_SPEED = 8000;
const SOURCE_GRACE_MS = 120;

export function useVelocityDeformation(
  source: WritableMotionValue<number>,
  config: {
    target: (speed: number) => number;
    /** A function receives the deformation and its current target, so a spring can relax differently than it builds. */
    stiffness: number | ((position: number, target: number) => number);
    damping: number | ((position: number, target: number) => number);
    /**
     * Seconds over which the source's speed is averaged before it sets the target. Pointer input
     * that arrives less often than frames otherwise reads as no motion on one frame and twice the
     * speed on the next, so the shape depends on the display's frame rate. 0 (the default) uses
     * each frame's raw speed.
     */
    smoothing?: number;
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
    let sourceVelocity = 0;
    let lastChange = 0;
    const tick = ({ timestamp: now }: { timestamp: number }) => {
      const elapsed = Math.max(0.000001, (now - previousTime) / 1_000);
      previousTime = now;
      const current = source.get();
      const options = configRef.current;
      const raw = (current - previousPosition) / elapsed;
      if (current !== previousPosition) lastChange = now;
      previousPosition = current;
      if (options.smoothing) {
        // A burst of input a few milliseconds after a frame is not a real speed.
        sourceVelocity += (Math.max(-MAX_SOURCE_SPEED, Math.min(MAX_SOURCE_SPEED, raw)) - sourceVelocity) * (1 - Math.exp(-elapsed / options.smoothing));
      } else sourceVelocity = raw;
      const target = Math.max(options.target(Math.abs(sourceVelocity)), boostRef.current);
      const stiffness = typeof options.stiffness === "function" ? options.stiffness(position, target) : options.stiffness;
      const damping = typeof options.damping === "function" ? options.damping(position, target) : options.damping;
      velocity += velocityImpulseRef.current;
      velocityImpulseRef.current = 0;
      [position, velocity] = stepSpring(position, velocity, target, { mass: 1, stiffness, damping }, elapsed);
      deformation.set(position);
      // Input arriving once a frame wakes the loop with the new value already in place, so the
      // frame after it sees no change: keep listening a little after the source last moved.
      if (position === target && velocity === 0 && Math.abs(sourceVelocity) < 0.005 && now - lastChange > SOURCE_GRACE_MS) {
        running = false;
        cancelFrame(tick);
      }
    };
    const wake = () => {
      if (running) return;
      running = true;
      previousTime = performance.now();
      lastChange = previousTime;
      previousPosition = source.get();
      position = deformation.get();
      sourceVelocity = 0;
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


export { usePointerReleaseFallback } from "./use-pointer-release-fallback.js";
export { useGlassContact } from "./use-glass-contact.js";
export { useMenuMotion, type MenuMotionOptions, type MenuLayout, type MenuTransition } from "./use-menu-motion.js";

export { usePopoverMotion, popoverFrames, type PopoverLayout } from "./use-popover-motion.js";
