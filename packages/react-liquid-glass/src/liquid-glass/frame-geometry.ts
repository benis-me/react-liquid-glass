import { computeDomeConstants } from "./dome";
import { contactTransform } from "../shared/contact";
import { readMotion } from "../shared/values";
import { MAX_BLOBS, LIQUID_GLASS_MATERIAL, type LiquidGlassFrame, type LiquidFrameRegion } from "./render-frame";

export function createFrameGeometry() {
  const blobs = new Float32Array(MAX_BLOBS * 3);
  const sizes = new Float32Array(MAX_BLOBS * 2);
  const corners = new Float32Array(MAX_BLOBS);
  const velocities = new Float32Array(MAX_BLOBS * 2);
  const contacts = new Float32Array(MAX_BLOBS * 3);
  const contactInverses = new Float32Array(MAX_BLOBS * 4);
  const contactOffsets = new Float32Array(MAX_BLOBS * 2);
  const domes = new Float32Array(MAX_BLOBS * 4);
  const refractionRatios = new Float32Array(MAX_BLOBS * 2);
  return {
    blobs, sizes, corners, velocities, contacts, contactInverses, contactOffsets, domes, refractionRatios,
    prepare(p: LiquidGlassFrame, ratio: number) {
    const count = Math.min(MAX_BLOBS, p.blobs.length);
    const clipped = p.transparentOutside && !p.debug;
    const regions: LiquidFrameRegion[] = [];
    let left = p.width, top = p.height, right = 0, bottom = 0;
    // Bound the same transformed rounded SDF, including its fusion expansion,
    // antialiasing and the full three-sigma shadow used by the fragment shader.
    const shadowBlur = Number.isFinite(p.shadowBlur) ? p.shadowBlur! : LIQUID_GLASS_MATERIAL.shadowBlur;
    const mergeDistance = readMotion(p.mergeDistance ?? LIQUID_GLASS_MATERIAL.mergeDistance);
    const padding = Math.max(18, shadowBlur * 3)
      + Math.max(.001, Number.isFinite(mergeDistance) ? mergeDistance : LIQUID_GLASS_MATERIAL.mergeDistance) * Math.max(0, count - 1) / 4 + 2 / ratio;
    const shadowOffset = Number.isFinite(p.shadowOffset) ? p.shadowOffset! : LIQUID_GLASS_MATERIAL.shadowOffset;
    for (let i = 0; i < count; i++) {
      const b = p.blobs[i];
      const ratio = b.refractionRatio ?? [1, 1];
      if (!ratio.every(value => Number.isFinite(value) && value >= 0)) return null;
      refractionRatios.set(ratio, i * 2);
      const radius = Math.max(0, readMotion(b.radius));
      blobs[i*3] = readMotion(b.x) * p.width;
      blobs[i*3+1] = readMotion(b.y) * p.height;
      blobs[i*3+2] = radius;
      sizes[i*2] = Math.max(.001, readMotion(b.halfWidth ?? radius));
      sizes[i*2+1] = Math.max(.001, readMotion(b.halfHeight ?? radius));
      corners[i] = Math.max(0, readMotion(b.cornerRadius ?? radius));
      velocities[i*2] = readMotion(b.velocityX ?? 0);
      velocities[i*2+1] = readMotion(b.velocityY ?? 0);
      if (![blobs[i*3], blobs[i*3+1], radius, sizes[i*2], sizes[i*2+1], corners[i], velocities[i*2], velocities[i*2+1]].every(Number.isFinite)) return null;
      const cx = readMotion(b.contactX ?? 0), cy = readMotion(b.contactY ?? 0), strength = readMotion(b.contactStrength ?? 0);
      const ax = readMotion(b.anchorX ?? cx), ay = readMotion(b.anchorY ?? cy);
      const px = readMotion(b.pullX ?? 0), py = readMotion(b.pullY ?? 0);
      if (![cx, cy, ax, ay, strength, px, py].every(Number.isFinite)) return null;
      contacts.set([Math.max(-1, Math.min(1, cx)), Math.max(-1, Math.min(1, cy)), Math.max(0, Math.min(1, strength))], i * 3);
      const [m00, m10, m01, m11, tx, ty] = contactTransform(sizes[i*2] * 2, sizes[i*2+1] * 2, ax, ay, px, py);
      const determinant = m00 * m11 - m01 * m10;
      contactInverses.set([m11 / determinant, -m10 / determinant, -m01 / determinant, m00 / determinant], i * 4);
      contactOffsets.set([tx, ty], i * 2);
      if (clipped && (i === 0 || Math.min(sizes[i*2], sizes[i*2+1]) > .001)) {
        const speed = Math.hypot(velocities[i*2], velocities[i*2+1]);
        const dx = speed > 1.1 ? velocities[i*2] / speed : 1, dy = speed > 1.1 ? velocities[i*2+1] / speed : 0;
        const stretch = 1 + Math.min(1, speed / 1100) * .52, squash = 1 / Math.sqrt(stretch);
        const v00 = dx * dx * stretch + dy * dy * squash, v01 = dx * dy * (stretch - squash), v11 = dy * dy * stretch + dx * dx * squash;
        const a = m00 * v00 + m01 * v01, c = m00 * v01 + m01 * v11;
        const b = m10 * v00 + m11 * v01, d = m10 * v01 + m11 * v11;
        const corner = Math.min(corners[i], sizes[i*2], sizes[i*2+1]), ix = sizes[i*2] - corner, iy = sizes[i*2+1] - corner;
        const ex = Math.abs(a) * ix + Math.abs(c) * iy + Math.hypot(a, c) * (corner + padding);
        const ey = Math.abs(b) * ix + Math.abs(d) * iy + Math.hypot(b, d) * (corner + padding);
        left = Math.min(left, blobs[i*3] + tx - ex); right = Math.max(right, blobs[i*3] + tx + ex);
        top = Math.min(top, blobs[i*3+1] + ty - ey + Math.min(0, shadowOffset));
        bottom = Math.max(bottom, blobs[i*3+1] + ty + ey + Math.max(0, shadowOffset));
        const x0 = Math.max(0, blobs[i*3] + tx - ex), y0 = Math.max(0, blobs[i*3+1] + ty - ey + Math.min(0, shadowOffset));
        const x1 = Math.min(p.width, blobs[i*3] + tx + ex), y1 = Math.min(p.height, blobs[i*3+1] + ty + ey + Math.max(0, shadowOffset));
        if (x1 > x0 && y1 > y0) regions.push({ left: x0 / p.width, top: y0 / p.height, width: (x1 - x0) / p.width, height: (y1 - y0) / p.height });
      }
      const dome = computeDomeConstants(p.domeDepth ?? LIQUID_GLASS_MATERIAL.domeDepth, sizes[i*2], sizes[i*2+1]);
      domes[i*4] = dome.Rx; domes[i*4+1] = dome.Ry;
      domes[i*4+2] = dome.scaleX; domes[i*4+3] = dome.scaleY;
    }
      return { count, clipped, regions, left, top, right, bottom };
    },
  };
}
