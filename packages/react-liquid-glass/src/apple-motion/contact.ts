/** Bounded radial resistance: no directional corners or hard travel stops. */
export function contactPull(x: number, y: number, width: number, height: number, fromX = 0, fromY = 0) {
  if (![x, y, width, height, fromX, fromY].every(Number.isFinite) || width <= 0 || height <= 0) throw new RangeError("Invalid glass pull");
  const limit = Math.min(4, Math.min(width, height) * .065);
  // Invert the resistance at re-grab so the next pointer sample is continuous.
  const inverse = limit / Math.max(.001, limit - Math.hypot(fromX, fromY));
  x += fromX * inverse; y += fromY * inverse;
  const gain = limit / Math.max(.001, limit + Math.hypot(x, y));
  return [x * gain, y * gain] as const;
}

export { contactTransform } from "../shared/contact";
