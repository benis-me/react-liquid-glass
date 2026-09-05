import { Glass as GlassComponent, type GlassProps, type LensInstance } from "./glass";
import { GlassProvider, RefractionGroup, RefractionTarget, useGlassContext, useSharedLens } from "./group";

export { erf, computeDomeConstants, domeGradient, type DomeConstants } from "./math";
export {
  generateDisplacementMap,
  createMapGenerator,
  type MapGenerator,
} from "./displacement-map";
export { motionValue, isMotionValue, readMotion } from "./shared/values";
export type { MotionInput, MotionValueLike, WritableMotionValue } from "./shared/values";
export { axisScaleMatrix, roundedRectUri, TRANSPARENT_PIXEL } from "./rounded-rect";
export {
  DEFAULT_LENS_PARAMS,
  DOME_CIRCLE,
  FLAT_CIRCLE,
  PLAYGROUND_DEFAULTS,
  CONTROL_PILL,
} from "./presets";
export { GLASS_SELECTOR } from "./context";
export type { GlassContextValue, SharedLens, TargetRect } from "./context";
export type { LensParams, MapParams, GenerationStats, FilterStats } from "./types";
export type { GlassProps, LensInstance };
export { GlassProvider, RefractionGroup, RefractionTarget, useGlassContext, useSharedLens };

/** `Glass.General` mirrors the original bundle's attachment point. */
type GlassWithStatics = typeof GlassComponent & {
  General: {
    Provider: typeof GlassProvider;
    RefractionTarget: typeof RefractionTarget;
    RefractionGroup: typeof RefractionGroup;
  };
};

export const Glass: GlassWithStatics = Object.assign(GlassComponent, {
  General: {
    Provider: GlassProvider,
    RefractionTarget,
    RefractionGroup,
  },
});

/** Alias matching the original export name. */
export const DezinGlass = Glass;

export { GlassCanvas } from "./liquid-glass/GlassCanvas";
export type { GlassCanvasProps } from "./liquid-glass/GlassCanvas";
export { GlassSegmented, GlassSlider, GlassSwitch } from "./controls";
export type { GlassSegmentedProps, GlassSliderProps, GlassSwitchProps } from "./controls";
export type GlassLens = Partial<import("./types").LensParams>;

export { LiquidGlass, LIQUID_LENS } from "./liquid-glass/LiquidGlass";
export type { LiquidGlassProps } from "./liquid-glass/LiquidGlass";
export { LiquidGlassCanvas } from "./liquid-glass/LiquidGlassCanvas";
export type { LiquidGlassCanvasProps } from "./liquid-glass/LiquidGlassCanvas";
export { createLiquidGlassRenderer, LIQUID_GLASS_MATERIAL } from "./liquid-glass/renderer";
export type { LiquidGlassBlob, LiquidGlassFrame, LiquidGlassSource, LiquidRendererStats } from "./liquid-glass/renderer";
export type { LiquidSourceFactory, LiquidSourcePainter } from "./liquid-glass/source";

export { LiquidMenu, type LiquidMenuProps } from "./controls";
