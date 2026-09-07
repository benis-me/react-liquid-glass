/** Geometry and optical parameters consumed by the Liquid GPU material. */
export interface LiquidLens {
  /** Half-extents and corner radius in CSS pixels. */
  lensW?: number;
  lensH?: number;
  borderRadius?: number;
  /** Width of the refracting edge band in CSS pixels. */
  depth?: number;
  /** Refraction gain along each source axis. Controls use refractionPixels. */
  scaleX?: number;
  scaleY?: number;
  chromaAmount?: number;
  /** Frost radius in CSS pixels. */
  blurAmount?: number;
  brightness?: number;
  specularStrength?: number;
  /** Directional highlight angle in degrees. */
  specularRotation?: number;
  glowStrength?: number;
  glowSpread?: number;
  glowExponent?: number;
  tint?: number;
  edgeStrength?: number;
  edgeWidth?: number;
  edgeExponent?: number;
  /** Spherical-cap height in CSS pixels. */
  domeDepth?: number;
}
