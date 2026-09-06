/** CSS affine matrix. The side opposite the grip stays pinned as the grip moves. */
export function contactTransform(width: number, height: number, x: number, y: number, dx: number, dy: number) {
  if (![width, height, x, y, dx, dy].every(Number.isFinite) || width <= 0 || height <= 0) throw new RangeError("Invalid glass contact geometry");
  if (Math.hypot(dx, dy) < .00001) return [1, 0, 0, 1, 0, 0] as const;
  const ax = Math.max(-1, Math.min(1, x)) * width / 2, ay = Math.max(-1, Math.min(1, y)) * height / 2;
  // A centered grip keeps one fixed axis through recoil; release velocity must
  // not flip the pin to the other side when the spring crosses zero.
  const direction = Math.hypot(ax, ay) > 1 ? [ax, ay] : [1, 0];
  const norm = Math.hypot(...direction), ux = direction[0] / norm, uy = direction[1] / norm;
  const lever = Math.max(Math.hypot(ax, ay) * 1.8, Math.min(width, height) * .9);
  const bound = Math.min(1, lever * .48 / Math.max(.001, Math.hypot(dx, dy)));
  const rx = ux + dx * bound / lever, ry = uy + dy * bound / lever;
  const squash = 1 / Math.sqrt(Math.hypot(rx, ry));
  const a = rx * ux + uy * uy * squash, b = ry * ux - ux * uy * squash;
  const c = rx * uy - ux * uy * squash, d = ry * uy + ux * ux * squash;
  const fx = ax - ux * lever, fy = ay - uy * lever;
  return [a, b, c, d, fx - a * fx - c * fy, fy - b * fx - d * fy] as const;
}
