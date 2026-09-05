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

export function retargetLiquidFrames(start: number, target: number, duration: number, velocity: number) {
  // Preserve live momentum, but brake an outgoing trajectory in 40ms rather than
  // letting its Hermite tangent inflate the body for the whole new transition.
  const distance = target - start;
  const movingAway = distance * velocity <= 0;
  if (velocity !== 0 && (movingAway || Math.abs(velocity) * duration > Math.abs(distance) * 3)) {
    const brakeTime = movingAway ? 0.04 : Math.min(0.04, Math.abs(distance / velocity) * 1.6);
    return { values: [start, start + velocity * brakeTime / 2, target], times: [0, brakeTime / duration, 1] };
  }
  return { values: [start, target], times: [0, 1] };
}

export const OPEN_MORPH_TIMES = [0, 0.06, 0.28, 0.6, 1];
// Defocus/bunch -> anchored head and neck -> two-lobed absorption -> one impact.
export const CLOSE_FUSION_TIMES = [0, 0.14, 0.48, 0.7, 0.84, 1];

export function openWidthFrames(start: number, target: number) {
  return [start, Math.min(28, start), target * 0.86, target * 1.012, target];
}

export function openHeightFrames(start: number, target: number) {
  return [start, Math.min(28, start), target * 0.7, target * 1.008, target];
}

export function openRadiusFrames(start: number, target: number, width: number, height: number) {
  return [start, Math.min(28, start), Math.min(width * 0.86, height * 0.7), target * 1.12, target];
}

export function closeMenuWidthFrames(start: number) {
  return [start, start * 0.985, start * 0.4, 32, 6, 1];
}

export function closeMenuHeightFrames(start: number) {
  return [start, start * 1.008, start * 0.25, 41, 6, 1];
}

export function closeMenuRadiusFrames(start: number, width: number, height: number) {
  return [start, Math.min(width, height) * 0.37, Math.min(width * 0.4, height * 0.25) * 0.98, 32, 6, 1];
}

export function closeButtonFrames(start: number) {
  return [start, 1, 16, 33, 34.6, 34];
}

/** Content optics follow actual shape recovery, independently of the opacity reveal. */
export function liquidContentOptics(
  [halfWidth, halfHeight, radius]: number[],
  layout: { panelWidth: number; panelHeight: number; panelRadius: number },
) {
  const shape = Math.min(1, Math.max(
    Math.abs(1 - halfWidth * 2 / layout.panelWidth),
    Math.abs(1 - halfHeight * 2 / layout.panelHeight),
    Math.abs(radius - layout.panelRadius) / Math.max(1, layout.panelWidth / 2),
  ));
  return { refraction: Math.min(1, shape * 2.4), blur: Math.min(2.4, shape * 4) };
}

/** Map the panel's content and clip into the same moving rounded body as the SDF. */
export function liquidContentPose(
  [right, bottom, halfWidth, halfHeight, radius, velocityX, velocityY]: number[],
  layout: { panelLeft: number; panelTop: number; panelWidth: number; panelHeight: number },
) {
  const speed = Math.hypot(velocityX, velocityY);
  const amount = Math.min(speed / 1100, 1);
  const dx = amount > 0.001 ? velocityX / speed : 1;
  const dy = amount > 0.001 ? velocityY / speed : 0;
  const stretch = 1 + amount * 0.52;
  const squash = 1 / Math.sqrt(stretch);
  // Inverse of LiquidGlassCanvas.movingBlobLocal, including diagonal travel.
  const a = stretch * dx * dx + squash * dy * dy;
  const b = (stretch - squash) * dx * dy;
  const d = stretch * dy * dy + squash * dx * dx;
  const scaleX = halfWidth * 2 / layout.panelWidth;
  const scaleY = halfHeight * 2 / layout.panelHeight;
  const x = right - halfWidth - layout.panelLeft - a * halfWidth - b * halfHeight;
  const y = bottom - halfHeight - layout.panelTop - b * halfWidth - d * halfHeight;
  const corner = Math.min(radius, halfWidth, halfHeight);
  return {
    transform: `matrix(${a * scaleX}, ${b * scaleX}, ${b * scaleY}, ${d * scaleY}, ${x}, ${y})`,
    clipPath: `inset(0 round ${corner / scaleX}px / ${corner / scaleY}px)`,
  };
}
