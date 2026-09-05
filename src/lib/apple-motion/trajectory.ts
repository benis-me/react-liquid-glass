/** C1-continuous easing through a shape's keyframes, with no stop at an interior knot. */
export function liquidEasings(values: number[], times: number[], duration: number, velocity = 0) {
  if (!(duration > 0) || !Number.isFinite(duration + velocity)
    || values.length < 2 || values.length !== times.length
    || values.some(value => !Number.isFinite(value))
    || times[0] !== 0 || times[times.length - 1] !== 1
    || times.some((time, index) => !Number.isFinite(time) || (index > 0 && time <= times[index - 1]))) {
    throw new RangeError("A trajectory needs finite values, positive duration, and increasing times from 0 to 1.");
  }
  const slopes = values.slice(1).map((value, index) =>
    (value - values[index]) / (times[index + 1] - times[index]));
  const tangents = values.map((_, index) => {
    if (index === 0) return velocity * duration;
    if (index === values.length - 1) return 0;
    const before = slopes[index - 1];
    const after = slopes[index];
    // An actual reversal (press, swell, recoil) comes to rest exactly once.
    if (before * after <= 0) return 0;
    return 2 * before * after / (before + after);
  });
  return slopes.map((slope, index) => {
    if (slope === 0) return (progress: number) => progress;
    const incoming = tangents[index] / slope;
    const outgoing = tangents[index + 1] / slope;
    return (progress: number) => {
      const squared = progress * progress;
      const cubed = squared * progress;
      return (-2 * cubed + 3 * squared)
        + (cubed - 2 * squared + progress) * incoming
        + (cubed - squared) * outgoing;
    };
  });
}

export function retargetLiquidFrames(start: number, target: number, duration: number, velocity: number) {
  if (!(duration > 0) || !Number.isFinite(start + target + duration + velocity)) {
    throw new RangeError("Retargeting needs finite state and positive duration.");
  }
  // Preserve live momentum, but brake an outgoing trajectory in 40ms rather than
  // letting its Hermite tangent inflate the body for the whole new transition.
  const distance = target - start;
  const movingAway = distance * velocity <= 0;
  if (velocity !== 0 && (movingAway || Math.abs(velocity) * duration > Math.abs(distance) * 3)) {
    const brakeLimit = Math.min(0.04, duration / 2);
    const brakeTime = movingAway ? brakeLimit : Math.min(brakeLimit, Math.abs(distance / velocity) * 1.6);
    return { values: [start, start + velocity * brakeTime / 2, target], times: [0, brakeTime / duration, 1] };
  }
  return { values: [start, target], times: [0, 1] };
}
