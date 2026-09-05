import { cubicBezier } from "motion";

export const TRIGGER_RADIUS = 34;
export const MIN_LENS_HALF = 1;
export const OPEN_MORPH_DURATION = 0.38;
export const OPEN_CONTENT_DURATION = 0.34;
export const CLOSE_CONTENT_DURATION = 0.24;
export const CONTENT_MORPH_TIMES = [0, 0.1, 0.79, 1];
export const OPEN_MORPH_EASES = [
  cubicBezier(0.42, 0, 0.58, 1),
  cubicBezier(0.32, 0, 0.18, 1),
  cubicBezier(0.22, 0, 0.18, 1),
];
export const CLOSE_FUSION_DURATION = 0.38;
export const CLOSE_IMPACT_DISTANCE = 2;
export const CLOSE_FUSION_EASES = [
  cubicBezier(0.42, 0, 0.58, 1),
  cubicBezier(0.35, 0, 0.7, 0.7),
  cubicBezier(0.24, 0.2, 0.65, 0.72),
  cubicBezier(0.12, 0.12, 0.18, 1),
  cubicBezier(0.16, 0, 0.18, 1),
];
export const PRESS_EASE = cubicBezier(0.3, 0, 0.2, 1);
export const RELEASE_EASE = cubicBezier(0.16, 0.72, 0.18, 1);

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

