/** Clear controls become more frosted as the live popup body grows. CSS pixels. */
export function liquidSurfaceBlur(width: number, height: number) {
  const thickness = Math.max(0, Math.min(1, (Math.min(width, height) - 48) / 272));
  return .4 + 11.6 * thickness * thickness * (3 - 2 * thickness);
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
