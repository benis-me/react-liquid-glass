export type PhysicalSpring = { mass: number; stiffness: number; damping: number };

export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  config: PhysicalSpring,
  elapsed: number,
) {
  const steps = Math.max(1, Math.ceil(elapsed / 0.008));
  const dt = elapsed / steps;
  let nextValue = value;
  let nextVelocity = velocity;
  for (let index = 0; index < steps; index += 1) {
    const acceleration = (-config.stiffness * (nextValue - target) - config.damping * nextVelocity) / config.mass;
    nextVelocity += acceleration * dt;
    nextValue += nextVelocity * dt;
  }
  if (Math.abs(nextValue - target) < 0.0005 && Math.abs(nextVelocity) < 0.005) {
    return [target, 0] as const;
  }
  return [nextValue, nextVelocity] as const;
}

