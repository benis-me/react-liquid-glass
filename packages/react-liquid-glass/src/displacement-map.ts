import { computeDomeConstants, domeGradient, erf } from "./math";
import type { MapParams } from "./types";

/**
 * Displacement-map generation.
 *
 * The map is a square RGBA texture in "lens space":
 *   R = 0.5 − 0.5·dx·falloff   → sampled by feDisplacementMap xChannelSelector=R
 *   G = 0.5 − 0.5·dy·falloff   → yChannelSelector=G
 *   B = 128 + 127·specular     → consumed by a feColorMatrix as a highlight mask
 *   A = 255
 *
 * (dx, dy) is the refraction direction: a clamped linear gradient across the
 * lens, or the slope of a spherical cap when domeDepth > 0. The falloff is a
 * Gaussian-CDF (erf) profile of the *inner* rounded-rect SDF (lens inset by
 * `depth`), which keeps the center optically flat and bends only the rim.
 */

const SQRT2 = Math.SQRT2;

/** Rounded-rect signed distance, given |p| already folded into the +/+ quadrant. */
function roundedRectSDF(ax: number, ay: number, halfW: number, halfH: number, r: number): number {
  const qx = ax - halfW + r;
  const qy = ay - halfH + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const outer = ox * ox + oy * oy;
  return (outer > 0 ? Math.sqrt(outer) : 0) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Full-quality async generator. Renders row blocks of 64 and yields to the
 * event loop between blocks, then encodes to a PNG object URL.
 * Caller owns the URL (revoke it when replaced).
 */
export async function generateDisplacementMap(
  canvas: HTMLCanvasElement,
  opts: MapParams & { canvasSize: number },
): Promise<string | null> {
  const {
    canvasSize: size,
    lensHalfWidth: hw,
    lensHalfHeight: hh,
    borderRadius,
    depth,
    sdfBoundary,
    edgeFalloff,
    specularRotation = 45,
    glowStrength = 0,
    glowSpread = 1,
    glowExponent = 1.5,
    edgeStrength = 0,
    edgeWidth = 3,
    edgeExponent = 1.5,
    domeDepth = 0,
    splayAmount = 1,
  } = opts;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const radius = Math.min(borderRadius, Math.min(hw, hh));
  // Inner rect (lens inset by depth) drives the falloff SDF.
  const innerW = Math.max(0, hw - depth);
  const innerH = Math.max(0, hh - depth);
  const innerR = Math.max(0, Math.min(borderRadius, Math.min(innerW, innerH)));
  const invDepth = depth > 0 ? 1 / (depth * SQRT2) : 1e6;

  const hasSpec = glowStrength > 0 || edgeStrength > 0;
  const theta = (specularRotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const glowLo = (1 - glowSpread) * SQRT2;
  const glowSpan = glowSpread * SQRT2;

  const dome = domeDepth > 0 ? computeDomeConstants(domeDepth, hw, hh) : null;
  const splayed = splayAmount < 1;
  const splayBand = 0.5 * Math.min(hw, hh);
  const invSplayBand = splayBand > 0 ? 1 / splayBand : 0;

  for (let rowStart = 0; rowStart < size; rowStart += 64) {
    const rowEnd = Math.min(rowStart + 64, size);
    for (let y = rowStart; y < rowEnd; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const px = ((x + 0.5) / size) * (2 * hw) - hw;
        const py = ((y + 0.5) / size) * (2 * hh) - hh;
        const ax = Math.abs(px);
        const ay = Math.abs(py);
        const sd = roundedRectSDF(ax, ay, hw, hh, radius);

        const insideLens = !sdfBoundary || sd < 0;
        if (insideLens) {
          let dx: number;
          let dy: number;
          if (dome) {
            dx = Math.sign(px) * domeGradient(ax, dome.Rx, dome.scaleX);
            dy = Math.sign(py) * domeGradient(ay, dome.Ry, dome.scaleY);
          } else {
            dx = Math.max(-1, Math.min(1, px / hw));
            dy = Math.max(-1, Math.min(1, py / hh));
          }

          if (splayed) {
            // Near an edge, damp the tangential component but keep the
            // vector magnitude, so corners don't smear diagonally.
            const nearY = Math.max(0, 1 - (hh - ay) * invSplayBand) * (1 - splayAmount);
            const nearX = Math.max(0, 1 - (hw - ax) * invSplayBand) * (1 - splayAmount);
            if (nearY > 0.001 || nearX > 0.001) {
              const ox = dx;
              const oy = dy;
              dx = ox * (1 - nearY);
              dy = oy * (1 - nearX);
              const before = Math.sqrt(ox * ox + oy * oy);
              const after = Math.sqrt(dx * dx + dy * dy);
              if (after > 0.001) {
                const k = before / after;
                dx *= k;
                dy *= k;
              }
            }
          }

          let falloff: number;
          if (edgeFalloff) {
            const sdInner = roundedRectSDF(ax, ay, innerW, innerH, innerR);
            falloff = 0.5 * (1 + erf(sdInner * invDepth));
          } else {
            falloff = 1;
          }

          data[idx] = Math.round((0.5 - 0.5 * dx * falloff) * 255);
          data[idx + 1] = Math.round((0.5 - 0.5 * dy * falloff) * 255);

          if (hasSpec) {
            const cx = Math.max(-1, Math.min(1, px / hw));
            const cy = Math.max(-1, Math.min(1, py / hh));
            const align = Math.abs(cx * cosT + cy * sinT);
            let spec = 0;
            if (glowStrength > 0) {
              const t = glowSpan > 0.001 ? Math.min(1, Math.max(0, align - glowLo) / glowSpan) : 0;
              spec += glowStrength * Math.pow(t, glowExponent) * falloff;
            }
            if (edgeStrength > 0) {
              const rim = sd < 0 ? Math.max(0, 1 + sd / edgeWidth) : 0;
              spec += edgeStrength * rim * Math.pow(align, edgeExponent);
            }
            spec = Math.min(1, spec);
            data[idx + 2] = Math.round(127 * spec + 128);
          } else {
            data[idx + 2] = 128;
          }
        } else {
          data[idx] = 128;
          data[idx + 1] = 128;
          data[idx + 2] = 128;
        }
        data[idx + 3] = insideLens ? 255 : 0;
      }
    }
    if (rowStart + 64 < size) await new Promise((r) => setTimeout(r, 0));
  }

  ctx.putImageData(img, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  return blob ? URL.createObjectURL(blob) : null;
}

export interface MapGenerator {
  generate(params: MapParams): { dataUrl: string; loopMs: number; encodeMs: number };
  dispose(): void;
}

/**
 * Pooled synchronous generator for animated lens geometry (drag-resize,
 * hover-grow). Exploits the 4-fold symmetry of the map — computes only the
 * top-left quadrant and mirrors R/G/B into the other three — and caches the
 * dome-slope row as a Float32Array LUT between frames.
 */
export function createMapGenerator(size: number): MapGenerator {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let img: ImageData | null = null;
  let domeLUT: Float32Array | null = null;
  let lutDome = -Infinity;
  let lutHw = -Infinity;
  let lutHh = -Infinity;
  let lutSize = 0;
  let cachedDome: ReturnType<typeof computeDomeConstants> | null = null;
  let lutDirty = true;

  return {
    generate(params: MapParams) {
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        ctx = canvas.getContext("2d")!;
        img = ctx.createImageData(size, size);
      }
      const data = img!.data;
      const {
        lensHalfWidth: hw,
        lensHalfHeight: hh,
        borderRadius,
        depth,
        sdfBoundary,
        edgeFalloff,
        specularRotation = 45,
        glowStrength = 0,
        glowSpread = 1,
        glowExponent = 1.5,
        edgeStrength = 0,
        edgeWidth = 3,
        edgeExponent = 1.5,
        domeDepth = 0,
        splayAmount = 1,
      } = params;

      const half = size >> 1;
      const radius = Math.min(borderRadius, Math.min(hw, hh));
      const innerW = Math.max(0, hw - depth);
      const innerH = Math.max(0, hh - depth);
      const innerR = Math.max(0, Math.min(borderRadius, Math.min(innerW, innerH)));
      const invDepth = depth > 0 ? 1 / (depth * SQRT2) : 1e6;
      const hasSpec = glowStrength > 0 || edgeStrength > 0;
      const theta = (specularRotation * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const glowLo = (1 - glowSpread) * SQRT2;
      const glowSpan = glowSpread * SQRT2;
      const invGlowSpan = glowSpan > 0.001 ? 1 / glowSpan : 0;
      const invEdgeW = edgeWidth > 0 ? 1 / edgeWidth : 0;
      const stepX = (2 * hw) / size;
      const stepY = (2 * hh) / size;
      const invHw = 1 / hw;
      const invHh = 1 / hh;
      const hasDome = domeDepth > 0;
      const splayed = splayAmount < 1;

      if (hasDome) {
        if (
          !cachedDome ||
          Math.abs(domeDepth - lutDome) > 0.5 ||
          Math.abs(hw - lutHw) > 1 ||
          Math.abs(hh - lutHh) > 1
        ) {
          cachedDome = computeDomeConstants(domeDepth, hw, hh);
          lutDome = domeDepth;
          lutHw = hw;
          lutHh = hh;
          lutDirty = true;
        }
        if (lutSize !== half) {
          domeLUT = new Float32Array(half);
          lutSize = half;
          lutDirty = true;
        }
        if (lutDirty) {
          const lut = domeLUT!;
          const d = cachedDome;
          const r2 = d.Rx * d.Rx;
          const cap = 0.999 * d.Rx;
          for (let i = 0; i < half; i++) {
            const a = -((i + 0.5) * stepX - hw); // distance from center along +x
            const c = a < cap ? a : cap;
            lut[i] = (c / Math.sqrt(r2 - c * c)) * d.scaleX;
          }
          lutDirty = false;
        }
      }
      const lut = hasDome ? domeLUT : null;

      const splayBand = 0.5 * Math.min(hw, hh);
      const invSplayBand = splayBand > 0 ? 1 / splayBand : 0;

      const t0 = performance.now();
      for (let row = 0; row < half; row++) {
        const mirrorRow = size - 1 - row;
        const dy0 = -((row + 0.5) * stepY - hh); // positive distance from center
        const qy = dy0 - hh + radius;
        const qyInner = edgeFalloff ? dy0 - innerH + innerR : 0;
        const domeY = hasDome && cachedDome
          ? domeGradient(dy0, cachedDome.Ry, cachedDome.scaleY)
          : dy0 * invHh > 1 ? 1 : dy0 * invHh;
        const cyClamped = dy0 * invHh > 1 ? 1 : dy0 * invHh;
        const splayNearY = splayed ? Math.max(0, 1 - (hh - dy0) * invSplayBand) : 0;

        for (let col = 0; col < half; col++) {
          const mirrorCol = size - 1 - col;
          const dx0 = -((col + 0.5) * stepX - hw);
          const qx = dx0 - hw + radius;
          const ox = qx > 0 ? qx : 0;
          const oy = qy > 0 ? qy : 0;
          const outer = ox * ox + oy * oy;
          const sd =
            (outer > 0 ? Math.sqrt(outer) : 0) +
            (qx > qy ? (qx > 0 ? 0 : qx) : qy > 0 ? 0 : qy) -
            radius;

          const iTL = (row * size + col) * 4;
          const iTR = (row * size + mirrorCol) * 4;
          const iBL = (mirrorRow * size + col) * 4;
          const iBR = (mirrorRow * size + mirrorCol) * 4;

          const insideLens = !sdfBoundary || sd < 0;
          if (insideLens) {
            let dx = lut ? lut[col] : dx0 * invHw > 1 ? 1 : dx0 * invHw;
            let dy = domeY;

            if (splayed) {
              const damp = 1 - splayAmount;
              const nearY = splayNearY * damp;
              const nearX = Math.max(0, 1 - (hw - dx0) * invSplayBand) * damp;
              if (nearY > 0.001 || nearX > 0.001) {
                const bx = dx;
                const by = dy;
                dx = bx * (1 - nearY);
                dy = by * (1 - nearX);
                const before = Math.sqrt(bx * bx + by * by);
                const after = Math.sqrt(dx * dx + dy * dy);
                if (after > 0.001) {
                  const k = before / after;
                  dx *= k;
                  dy *= k;
                }
              }
            }

            let falloff: number;
            if (edgeFalloff) {
              const ex = dx0 - innerW + innerR;
              const ox2 = ex > 0 ? ex : 0;
              const oy2 = qyInner > 0 ? qyInner : 0;
              const sdInner =
                Math.sqrt(ox2 * ox2 + oy2 * oy2) +
                (ex > qyInner ? (ex > 0 ? 0 : ex) : qyInner > 0 ? 0 : qyInner) -
                innerR;
              falloff = 0.5 * (1 + erf(sdInner * invDepth));
            } else {
              falloff = 1;
            }

            const hx = 0.5 * dx * falloff;
            const hy = 0.5 * dy * falloff;
            // Left half samples toward +x (px negative → dx negative in full-grid
            // terms), so the quadrant fold writes (0.5+h) left / (0.5−h) right.
            const rL = ((0.5 + hx) * 255 + 0.5) | 0;
            const rR = ((0.5 - hx) * 255 + 0.5) | 0;
            const gT = ((0.5 + hy) * 255 + 0.5) | 0;
            const gB = ((0.5 - hy) * 255 + 0.5) | 0;

            let bTL = 128;
            let bTR = 128;
            let bBL = 128;
            let bBR = 128;
            if (hasSpec) {
              const cx = dx0 * invHw > 1 ? 1 : dx0 * invHw;
              const nx = cx * cosT;
              const ny = cyClamped * sinT;
              const alignSum = Math.abs(nx + ny); // TL and BR diagonal pair
              const alignDiff = Math.abs(nx - ny); // TR and BL diagonal pair
              let rim = 0;
              if (edgeStrength > 0) {
                rim = sd < 0 ? 1 + sd * invEdgeW : 0;
                if (rim < 0) rim = 0;
              }
              let specSum = 0;
              let specDiff = 0;
              if (glowStrength > 0) {
                const tS = Math.min(1, Math.max(0, (alignSum - glowLo) * invGlowSpan));
                specSum += glowStrength * Math.pow(tS, glowExponent) * falloff;
                const tD = Math.min(1, Math.max(0, (alignDiff - glowLo) * invGlowSpan));
                specDiff += glowStrength * Math.pow(tD, glowExponent) * falloff;
              }
              if (edgeStrength > 0) {
                specSum += edgeStrength * rim * Math.pow(alignSum, edgeExponent);
                specDiff += edgeStrength * rim * Math.pow(alignDiff, edgeExponent);
              }
              if (specSum > 1) specSum = 1;
              if (specDiff > 1) specDiff = 1;
              bTL = (127 * specSum + 128 + 0.5) | 0;
              bBR = (127 * specSum + 128 + 0.5) | 0;
              bTR = (127 * specDiff + 128 + 0.5) | 0;
              bBL = (127 * specDiff + 128 + 0.5) | 0;
            }

            data[iTL] = rL; data[iTL + 1] = gT; data[iTL + 2] = bTL; data[iTL + 3] = 255;
            data[iTR] = rR; data[iTR + 1] = gT; data[iTR + 2] = bTR; data[iTR + 3] = 255;
            data[iBL] = rL; data[iBL + 1] = gB; data[iBL + 2] = bBL; data[iBL + 3] = 255;
            data[iBR] = rR; data[iBR + 1] = gB; data[iBR + 2] = bBR; data[iBR + 3] = 255;
          } else {
            data[iTL] = 128; data[iTL + 1] = 128; data[iTL + 2] = 128; data[iTL + 3] = 0;
            data[iTR] = 128; data[iTR + 1] = 128; data[iTR + 2] = 128; data[iTR + 3] = 0;
            data[iBL] = 128; data[iBL + 1] = 128; data[iBL + 2] = 128; data[iBL + 3] = 0;
            data[iBR] = 128; data[iBR + 1] = 128; data[iBR + 2] = 128; data[iBR + 3] = 0;
          }
        }
      }
      const loopMs = performance.now() - t0;
      ctx!.putImageData(img!, 0, 0);
      const t1 = performance.now();
      const dataUrl = canvas!.toDataURL();
      return { dataUrl, loopMs, encodeMs: performance.now() - t1 };
    },
    dispose() {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
      }
      ctx = null;
      img = null;
      domeLUT = null;
      cachedDome = null;
      lutDome = lutHw = lutHh = -Infinity;
      lutSize = 0;
      lutDirty = true;
    },
  };
}
