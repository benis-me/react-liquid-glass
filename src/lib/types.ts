/**
 * The full lens parameter set recovered from the production bundle
 * (`DEFAULT_LENS_PARAMS` export). All lengths are CSS pixels.
 */
export interface LensParams {
  /** Lens half-width — the rendered lens spans 2 × lensW. */
  lensW: number;
  /** Lens half-height — the rendered lens spans 2 × lensH. */
  lensH: number;
  /** Corner radius of the lens rounded-rect, px. */
  borderRadius: number;
  /** Width of the refracting rim, px. Displacement ramps up over this band (erf profile). */
  depth: number;
  /** Displacement strength per axis, in SVG objectBoundingBox scale units (≈ fraction of container diagonal). */
  scaleX: number;
  scaleY: number;
  /** Resolution of the generated displacement-map texture (square). */
  mapSize: number;
  /** 0–1. Splits refraction into three passes at scale ·(1+0.2c) / ·(1+0.1c) / ·1 for R/G/B — chromatic aberration. */
  chromaAmount: number;
  /** Gaussian blur of the refracted content, px. */
  blurAmount: number;
  /** Zero displacement outside the rounded-rect SDF (hard lens boundary). */
  sdfBoundary: boolean;
  /** Apply the erf rim falloff (flat center, refracting rim). */
  edgeFalloff: boolean;
  /** -1..1 — black/white wash over the lens area. */
  brightness: number;
  /** Multiplier for the specular field stored in the map's blue channel. */
  specularStrength: number;
  /** Direction of the specular sweep, degrees. */
  specularRotation: number;
  /** Multiply (darken) instead of screen (brighten) with the specular mask. */
  specularDark: boolean;
  /** Broad diagonal glow: strength / spread (1 = widest) / exponent. */
  glowStrength: number;
  glowSpread: number;
  glowExponent: number;
  /** -1..1 white/black tint drawn when the lens has no displacement (fallback). */
  tint: number;
  /** Bright rim line hugging the SDF boundary: strength / width px / exponent. */
  edgeStrength: number;
  edgeWidth: number;
  edgeExponent: number;
  /** Spherical-cap height, px. 0 = linear gradient profile, >0 = dome refraction. */
  domeDepth: number;
  /** 0–1. <1 pulls displacement toward the axes near edges (reduces corner smear). */
  splayAmount: number;
  /** box-shadow applied by the floating shadow layer at the lens rect. */
  edgeShadow?: string;
  edgeInsetShadow?: string;
  /** Shadow pair shown at `restShadowOpacity` (e.g. while not hovered). */
  restEdgeShadow?: string;
  restEdgeInsetShadow?: string;
}

/** Input of the displacement-map generators — geometry + surface subset of LensParams. */
export interface MapParams {
  lensHalfWidth: number;
  lensHalfHeight: number;
  borderRadius: number;
  depth: number;
  sdfBoundary: boolean;
  edgeFalloff: boolean;
  specularRotation?: number;
  glowStrength?: number;
  glowSpread?: number;
  glowExponent?: number;
  edgeStrength?: number;
  edgeWidth?: number;
  edgeExponent?: number;
  domeDepth?: number;
  splayAmount?: number;
}

export interface GenerationStats {
  total: number;
  loopMs: number;
  encodeMs: number;
}

export interface FilterStats {
  activeTargets: number;
  totalPixels: number;
}
