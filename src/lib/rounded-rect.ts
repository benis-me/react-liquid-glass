/** Cached rounded-rect SVG data URIs, used as CSS mask-image and feImage masks. */
const cache = new Map<string, string>();

export function roundedRectUri(
  w: number,
  h: number,
  radius: number,
): { uri: string; key: string } {
  const wi = Math.max(1, Math.round(w));
  const hi = Math.max(1, Math.round(h));
  const r = Math.max(0, Math.min(Math.round(radius), Math.min(wi, hi) / 2));
  const key = `${wi}|${hi}|${r}`;
  const hit = cache.get(key);
  if (hit) return { uri: hit, key };
  const rw = Math.max(0, wi - 1);
  const rh = Math.max(0, hi - 1);
  const rr = Math.max(0, r - 0.5);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${wi} ${hi}' preserveAspectRatio='none'><rect x='0.5' y='0.5' width='${rw}' height='${rh}' rx='${rr}' ry='${rr}' fill='black'/></svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, uri);
  return { uri, key };
}

/**
 * feColorMatrix values that rescale the map's R/G displacement channels
 * around the 128 neutral point — this is how one shared map gets per-axis
 * scale attenuation without regeneration.
 */
export function axisScaleMatrix(sx: number, sy: number): string {
  return `${sx} 0 0 0 ${0.5 * (1 - sx)}  0 ${sy} 0 0 ${0.5 * (1 - sy)}  0 0 1 0 0  0 0 0 1 0`;
}

/** 1×1 transparent PNG — placeholder href for unassigned feImage slots. */
export const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
