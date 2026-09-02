import { Glass as GlassComponent, type GlassProps, type LensInstance } from "./glass";
import { GlassProvider, RefractionGroup, RefractionTarget, useGlassContext, useSharedLens } from "./group";
import "./style.css";

export { erf, computeDomeConstants, domeGradient, type DomeConstants } from "./math";
export {
  generateDisplacementMap,
  createMapGenerator,
  type MapGenerator,
} from "./displacement-map";
export { motionValue, isMotionValue, readMotion } from "./motion";
export type { MotionInput, MotionValueLike, WritableMotionValue } from "./motion";
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

export { GlassCanvas } from "./GlassCanvas";
export type { GlassCanvasProps } from "./GlassCanvas";
export { GlassSegmented, GlassSlider, GlassSwitch } from "./components";
export type { GlassSegmentedProps, GlassSliderProps, GlassSwitchProps } from "./components";
export type GlassLens = Partial<import("./types").LensParams>;
