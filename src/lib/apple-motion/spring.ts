export type PhysicalSpring = { mass: number; stiffness: number; damping: number };

/** Exact damped-spring evolution in seconds; position and velocity survive retargeting. */
export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  config: PhysicalSpring,
  elapsed: number,
  settle = true,
) {
  const { mass, stiffness, damping } = config;
  if (!(mass > 0 && stiffness > 0 && damping >= 0 && elapsed >= 0)
    || !Number.isFinite(value + velocity + target + mass + stiffness + damping + elapsed)) {
    throw new RangeError("A spring needs finite state/time, positive mass/stiffness, and nonnegative damping/time.");
  }
  if (elapsed === 0) return [value, velocity] as const;
  const displacement = value - target;
  const decay = damping / (2 * mass);
  const frequencySquared = stiffness / mass;
  const discriminant = decay * decay - frequencySquared;
  if (!Number.isFinite(discriminant)) throw new RangeError("Spring coefficients exceed numeric precision.");
  let nextDisplacement: number;
  let nextVelocity: number;
  if (Math.abs(discriminant) < frequencySquared * 1e-8) {
    const envelope = Math.exp(-decay * elapsed);
    const tangent = velocity + decay * displacement;
    nextDisplacement = envelope * (displacement + tangent * elapsed);
    nextVelocity = envelope * (velocity - decay * tangent * elapsed);
  } else if (discriminant < 0) {
    const frequency = Math.sqrt(-discriminant);
    const envelope = Math.exp(-decay * elapsed);
    const sin = Math.sin(frequency * elapsed);
    const cos = Math.cos(frequency * elapsed);
    nextDisplacement = envelope * (displacement * cos + (velocity + decay * displacement) / frequency * sin);
    nextVelocity = envelope * (velocity * cos - (decay * velocity + frequencySquared * displacement) / frequency * sin);
  } else {
    const root = Math.sqrt(discriminant);
    // Avoid cancellation in the slow root and exp/cosh overflow for stiff overdamping.
    const slow = -frequencySquared / (decay + root);
    const fast = -decay - root;
    const slowAmount = (velocity - fast * displacement) / (slow - fast);
    const fastAmount = displacement - slowAmount;
    const slowDecay = slowAmount * Math.exp(slow * elapsed);
    const fastDecay = fastAmount * Math.exp(fast * elapsed);
    nextDisplacement = slowDecay + fastDecay;
    nextVelocity = slow * slowDecay + fast * fastDecay;
  }
  const nextValue = target + nextDisplacement;
  if (settle && Math.abs(nextDisplacement) < 0.0005 && Math.abs(nextVelocity) < 0.005) {
    return [target, 0] as const;
  }
  return [nextValue, nextVelocity] as const;
}
