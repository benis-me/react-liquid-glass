/**
 * Minimal motion-value contract.
 *
 * The original component duck-types framer-motion's MotionValue as
 * `{ get(), on("change") }`, so anything matching this interface (including a
 * real framer-motion MotionValue) can drive lens geometry at 60fps without
 * React re-renders. `motionValue()` is a dependency-free implementation for
 * consumers who don't use framer-motion.
 */
export interface MotionValueLike<T = number> {
  get(): T;
  on(event: "change", cb: (v: T) => void): () => void;
}

export type MotionInput<T = number> = T | MotionValueLike<T>;

export function isMotionValue<T>(v: unknown): v is MotionValueLike<T> {
  return typeof v === "object" && v !== null && "get" in v && "on" in v;
}

export function readMotion<T>(v: MotionInput<T>): T {
  return isMotionValue<T>(v) ? v.get() : v;
}

export interface WritableMotionValue<T = number> extends MotionValueLike<T> {
  set(v: T): void;
}

export function motionValue<T = number>(initial: T): WritableMotionValue<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(v: T) {
      if (v === value) return;
      value = v;
      subs.forEach((cb) => cb(v));
    },
    on(_event, cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}
