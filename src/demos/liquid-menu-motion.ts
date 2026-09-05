/** C1-continuous easing through a shape's keyframes, with no stop at an interior knot. */
export function liquidEasings(values: number[], times: number[], duration: number, velocity = 0) {
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

export const OPEN_MORPH_TIMES = [0, 0.1, 0.34, 0.8, 1];
export const CLOSE_FUSION_TIMES = [0, 0.08, 0.41, 0.6, 0.76, 1];

export function openWidthFrames(start: number, target: number) {
  return [start, Math.min(28, start * 0.82), target * 0.45, target * 1.012, target];
}

export function openHeightFrames(start: number, target: number) {
  return [start, Math.min(28, start * 0.82), target * 0.3, target * 1.008, target];
}

export function openRadiusFrames(start: number, target: number, width: number, height: number) {
  return [start, Math.min(28, start * 0.82), Math.min(width * 0.45, height * 0.3), target * 1.12, target];
}

export function closeMenuWidthFrames(start: number) {
  return [start, start * 0.994, start * 0.6, 38, 6, 1];
}

export function closeMenuHeightFrames(start: number) {
  return [start, start * 1.012, start * 0.38, 48, 6, 1];
}

export function closeMenuRadiusFrames(start: number, width: number, height: number) {
  return [start, Math.min(width * 0.46, height * 0.46), Math.min(width * 0.6, height * 0.38) * 0.96, 38, 6, 1];
}

export function closeButtonFrames(start: number) {
  return [start, 1, 6, 28, 34.6, 34];
}
