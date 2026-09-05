import type { LensParams } from "./types";

/** Defaults recovered from the production bundle's DEFAULT_LENS_PARAMS export. */
export const DEFAULT_LENS_PARAMS: LensParams = {
  lensW: 90,
  lensH: 60,
  depth: 0,
  chromaAmount: 0,
  scaleX: 0,
  scaleY: 0,
  mapSize: 256,
  borderRadius: 0,
  blurAmount: 0,
  sdfBoundary: false,
  edgeFalloff: false,
  brightness: 0,
  specularStrength: 0,
  specularRotation: 0,
  glowStrength: 0,
  glowSpread: 1,
  glowExponent: 1.5,
  tint: 0,
  edgeStrength: 0,
  edgeWidth: 3,
  edgeExponent: 1.5,
  specularDark: false,
  domeDepth: 0,
  splayAmount: 0,
};

/**
 * Dome-profile circular lens — parameter set used by the article's draggable
 * circle demo (60×60 half-size, full-sphere dome, chroma 0.3).
 */
export const DOME_CIRCLE: LensParams = {
  ...DEFAULT_LENS_PARAMS,
  lensW: 60,
  lensH: 60,
  borderRadius: 30,
  scaleX: 0.08,
  scaleY: 0.08,
  mapSize: 512,
  depth: 8,
  chromaAmount: 0.3,
  domeDepth: 60,
  splayAmount: 1,
  sdfBoundary: true,
  edgeFalloff: true,
  brightness: 0.1,
  specularStrength: 1,
  specularRotation: 45,
  glowStrength: 0.15,
  glowSpread: 1,
  glowExponent: 0.5,
  edgeStrength: 0.25,
  edgeExponent: 1.5,
  edgeShadow: "0 0 0 1px var(--bg-max, #fff), 0 8px 24px rgba(0, 0, 0, 0.4)",
};

/** Flat-profile variant of the same circle (linear gradient, softer specular). */
export const FLAT_CIRCLE: LensParams = {
  ...DOME_CIRCLE,
  domeDepth: 0,
  chromaAmount: 0.2,
  brightness: 0.05,
  specularStrength: 0.6,
  glowStrength: 0.1,
  edgeStrength: 0.2,
};

/** Playground defaults recovered from the article's control panel. */
export const PLAYGROUND_DEFAULTS: LensParams = {
  ...DEFAULT_LENS_PARAMS,
  lensW: 80,
  lensH: 80,
  borderRadius: 80,
  depth: 40,
  domeDepth: 80, // curvature 1 × min(lensW, lensH)
  scaleX: 0.07,
  scaleY: 0.07,
  chromaAmount: 0.4,
  splayAmount: 1,
  blurAmount: 0.5,
  brightness: 0.12,
  tint: 0,
  specularStrength: 1,
  specularRotation: 45,
  glowStrength: 0.1,
  glowSpread: 1,
  glowExponent: 0.5,
  edgeStrength: 0.25,
  edgeWidth: 3,
  edgeExponent: 1.5,
  sdfBoundary: true,
  edgeFalloff: true,
  mapSize: 512,
};

/** Soft pill for UI controls (switch knobs, slider handles, tab pills). */
export const CONTROL_PILL: LensParams = {
  ...DEFAULT_LENS_PARAMS,
  lensW: 90,
  lensH: 60,
  borderRadius: 30,
  depth: 12,
  scaleX: 0.04,
  scaleY: 0.04,
  mapSize: 256,
  chromaAmount: 0.15,
  domeDepth: 24,
  splayAmount: 1,
  sdfBoundary: true,
  edgeFalloff: true,
  specularStrength: 0.8,
  specularRotation: 45,
  glowStrength: 0.12,
  glowSpread: 1,
  glowExponent: 0.5,
  edgeStrength: 0.2,
  edgeWidth: 3,
  edgeExponent: 1.5,
};
