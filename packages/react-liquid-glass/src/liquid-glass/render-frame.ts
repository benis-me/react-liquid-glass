import type { MotionInput } from "../shared/values";

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
  magnification: 1, shadowStrength: .11, shadowOffset: 18, shadowBlur: 26,
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
  width: number;
  height: number;
  blobs: readonly LiquidGlassBlob[];
  mergeDistance?: MotionInput;
  refractionStrength?: MotionInput;
  refractionRatio?: readonly [number, number];
  chromaAmount?: number;
  specularStrength?: MotionInput;
  blurStrength?: MotionInput;
  edgeDepth?: MotionInput;
  domeDepth?: number;
  brightness?: number;
  specularRotation?: number;
  glowStrength?: number;
  glowSpread?: number;
  glowExponent?: number;
  edgeStrength?: number;
  edgeWidth?: number;
  edgeExponent?: number;
  tintColor?: readonly [number, number, number];
  tintStrength?: MotionInput;
  magnification?: MotionInput;
  shadowStrength?: MotionInput;
  shadowOffset?: number;
  shadowBlur?: number;
  opacity?: MotionInput;
  transparentOutside?: boolean;
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
