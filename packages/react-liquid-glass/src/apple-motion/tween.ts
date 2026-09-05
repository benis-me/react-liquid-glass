import type { WritableMotionValue } from "../shared/values";

export function tween(value: WritableMotionValue<number>, target: number, duration = 200) {
  const start = value.get();
  const startedAt = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    value.set(start + (target - start) * eased);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

