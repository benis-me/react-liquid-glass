import type { MotionInput } from "../shared/values.js";

export const MAX_BLOBS = 8;
/** Changed output region, normalized to the canvas, with a top-left origin. */
export type LiquidFrameRegion = { left: number; top: number; width: number; height: number };
export interface LiquidGlassBlob {
  /** Normalized center coordinates in the source, from 0 to 1. */
  x: MotionInput;
  y: MotionInput;
  /** Radius in CSS pixels. */
  radius: MotionInput;
  /** Optional rounded-rectangle half extents. Omit both for a circle. */
  halfWidth?: MotionInput;
  halfHeight?: MotionInput;
  /** Optional rounded-rectangle corner radius. Defaults to `radius`. */
  cornerRadius?: MotionInput;
  /** Optional CSS-pixel velocity used for squash and stretch. */
  velocityX?: MotionInput;
  velocityY?: MotionInput;
  /** Live light position relative to the lens center, normalized to -1..1. */
  contactX?: MotionInput;
  contactY?: MotionInput;
  /** Original grip stays fixed while the light follows the pointer. */
  anchorX?: MotionInput;
  anchorY?: MotionInput;
  contactStrength?: MotionInput;
  /** Resisted grip displacement in CSS pixels. */
  pullX?: MotionInput;
  pullY?: MotionInput;
  /** Per-body optical scale, independent of a shared canvas's padding/size. */
  refractionRatio?: readonly [number, number];
}


export type LiquidGlassSource = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;

/** The accepted menu material. Geometry, interaction and substrates stay independent. */
export const LIQUID_GLASS_MATERIAL = Object.freeze({
  mergeDistance: 40, refractionStrength: .11, chromaAmount: .55,
  specularStrength: .72, blurStrength: .5, edgeDepth: 10, domeDepth: 58,
  brightness: .015, specularRotation: 90, glowStrength: .30, glowSpread: .72,
  glowExponent: 1.4, edgeStrength: .36, edgeWidth: 1.6, edgeExponent: 1.2,
  tintColor: [1, 1, 1] as readonly [number, number, number], tintStrength: .055,
  magnification: 1, lensMagnification: 1, shadowStrength: .11, shadowOffset: 18, shadowBlur: 26,
  opacity: 1, refractionRatio: [1, 1] as readonly [number, number],
});

export interface LiquidGlassFrame {
  source: LiquidGlassSource;
  /** Change only when the source's pixels change, not when its lens moves. */
  sourceRevision?: number;
  content?: HTMLCanvasElement | null;
  contentRevision?: number;
  contentOpacity?: MotionInput;
  contentRefraction?: MotionInput;
  contentBlur?: MotionInput;
  /**
   * `lens` (default) pins `content` to the first body, like ink on the glass. `source`
   * lays it over the source instead: refracted and dispersed exactly like the source,
   * but at `contentBlur` rather than the material's frost.
   */
  contentSpace?: "lens" | "source";
  width: number;
  height: number;
  blobs: readonly LiquidGlassBlob[];
  mergeDistance?: MotionInput;
  refractionStrength?: MotionInput;
  refractionRatio?: readonly [number, number];
  chromaAmount?: MotionInput;
  specularStrength?: MotionInput;
  blurStrength?: MotionInput;
  edgeDepth?: MotionInput;
  domeDepth?: MotionInput;
  brightness?: MotionInput;
  specularRotation?: MotionInput;
  glowStrength?: MotionInput;
  glowSpread?: MotionInput;
  glowExponent?: MotionInput;
  edgeStrength?: MotionInput;
  edgeWidth?: MotionInput;
  edgeExponent?: MotionInput;
  tintColor?: readonly [number, number, number];
  tintStrength?: MotionInput;
  magnification?: MotionInput;
  /** How much the `lens` model magnifies what lies under its middle; 1 leaves it unscaled. */
  lensMagnification?: MotionInput;
  shadowStrength?: MotionInput;
  shadowOffset?: MotionInput;
  shadowBlur?: MotionInput;
  opacity?: MotionInput;
  transparentOutside?: boolean;
  /**
   * `dome` (default) is the calibrated spherical-cap lens. `bevel` models a flat
   * slab with a rounded rim: Snell refraction at the rim, a clear top, and
   * physical dispersion order. Rim width is twice `edgeDepth`. `lens` is a lifted
   * lens, as iOS 27's pressed tab: it magnifies its middle by `lensMagnification`,
   * and along its long sides its rim band (`edgeDepth` wide) bulges outward by
   * `refractionStrength`, pulling in what surrounds the glass, before meeting the
   * surface flush at the rim, while its ends stay clear; its rim's outer slope mirrors
   * what lies just inside it, red reaching furthest on one diagonal and blue on the
   * other, so warm and cool crescents gather at opposite ends of the rim.
   */
  refractionModel?: "dome" | "bevel" | "lens";
  /** Visualize this exact shader's live displacement and coverage, without CPU maps. */
  debug?: boolean;
  pixelRatio?: number;
  /** Extended highlights when the display supports HDR. */
  hdr?: boolean;
}
export interface LiquidRendererStats {
  draws: number;
  emissionDraws: number;
  sourceUploads: number;
  contentUploads: number;
}
