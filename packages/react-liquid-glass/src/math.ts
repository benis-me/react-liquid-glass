/**
 * Math helpers recovered from the Dezin Glass runtime.
 *
 * The edge falloff uses a Gaussian-CDF-shaped profile built on a cheap erf
 * approximation; the dome profile treats the lens surface as a spherical cap
 * whose radius comes from the sagitta formula.
 */

/** erf(x) ≈ tanh(√π · x) — the exact approximation the production bundle ships. */
export function erf(x: number): number {
  return Math.tanh(1.7724538509 * x);
}

/**
 * Mean slope of a circle of radius `r` sampled over [0, half].
 * Trapezoidal integration, 200 steps — matches the original's normalization
 * so the average displacement of a dome equals the flat-gradient case (0.5).
 */
function meanCircleSlope(r: number, half: number): number {
  let sum = 0;
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * half;
    const s = a / Math.sqrt(r * r - a * a);
    sum += i === 0 || i === N ? 0.5 * s : s;
  }
  return sum / N;
}

export interface DomeConstants {
  Rx: number;
  Ry: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Spherical-cap constants for a dome of height `domeDepth` spanning the lens.
 * R = (half² + d²) / 2d is the circle through the lens edge with sagitta d.
 */
export function computeDomeConstants(
  domeDepth: number,
  halfW: number,
  halfH: number,
): DomeConstants {
  const d = Math.max(0.01, Math.min(domeDepth, Math.min(halfW, halfH) - 1));
  const Rx = (halfW * halfW + d * d) / (2 * d);
  const Ry = (halfH * halfH + d * d) / (2 * d);
  const mx = meanCircleSlope(Rx, halfW);
  const my = meanCircleSlope(Ry, halfH);
  return {
    Rx,
    Ry,
    scaleX: mx > 0 ? 0.5 / mx : 1,
    scaleY: my > 0 ? 0.5 / my : 1,
  };
}

/** Normalized slope of the dome surface at distance `dist` from the lens center. */
export function domeGradient(dist: number, r: number, scale: number): number {
  const c = Math.min(dist, 0.999 * r);
  return (c / Math.sqrt(r * r - c * c)) * scale;
}
