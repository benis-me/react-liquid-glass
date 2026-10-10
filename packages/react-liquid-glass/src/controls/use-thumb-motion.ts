import { useEffect, useRef } from "react";
import { springTo, useVelocityDeformation, type SpringRun } from "../apple-motion/react.js";
import type { PhysicalSpring } from "../apple-motion/index.js";
import { animate, useMotionValue, useTransform, type MotionValue, type ValueAnimationTransition } from "motion/react";
import { LIQUID_LENS } from "../liquid-glass/LiquidGlass.js";
import type { LiquidLens } from "../liquid-glass/lens.js";

/** Thumb glass shared by Switch, Slider and Segmented: low dispersion, a fine rim, a theme-aware lift. */
export const thumbLens = (dark: boolean, lens: LiquidLens): LiquidLens => ({
  ...LIQUID_LENS, chromaAmount: .24, edgeWidth: .9, brightness: dark ? .035 : .015, ...lens,
});

/**
 * iOS 27's lifted lens, a pressed tab or thumb, calibrated against a native screenshot: clear
 * glass with no glow, tint or brightening and a thick rim: a fine dark contour, a white rim
 * line all the way round, and an outer slope that mirrors what lies inside it, gathering warm
 * and cool crescents at opposite ends.
 */
// Its rim line rides on edge strength, so the lower SDR highlight an HDR display uses keeps it.
export const liftedLens = (dark: boolean, lens: LiquidLens): LiquidLens => thumbLens(dark, {
  chromaAmount: 1.5, blurAmount: .7, edgeWidth: 1.2, edgeStrength: .81, specularStrength: 1,
  glowStrength: 0, brightness: 0, tint: 0, ...lens,
});
type Readable = { get(): number };
const unit = (value: number) => Math.min(1, Math.max(0, value));
/** The lifted lens draws with the lens refraction model. */
export const LIFTED_MODEL = { refractionModel: "lens" } as const;
/**
 * The native light-mode lens's soft shadow: about 5% darker at most, offset and blurred by a fifth
 * and a quarter of its half-height (8pt and 10pt on its 36.5pt half-height). On dark pages it
 * casts none.
 */
export const LIFT_SHADOW = .06;
export const LIFT_SHADOW_OFFSET = 8 / 36.5;
export const LIFT_SHADOW_BLUR = 10 / 36.5;
/**
 * A thumb's shadow as it lifts: from its resting shadow to the lifted lens's, as a pressed tab's.
 * Give the three values to the material's shadow strength, offset and blur.
 */
export function useLiftedShadow(lensH: Readable, lift: Readable, dark: boolean, rest: { strength: number; offset: number; blur: number }) {
  const light = useMotionValue(dark ? 0 : 1);
  useEffect(() => { light.set(dark ? 0 : 1); }, [dark, light]);
  const resting = useRef(rest);
  resting.current = rest;
  const mix = (from: number, to: number) => from + (to - from) * unit(lift.get());
  const strength = useTransform(() => mix(resting.current.strength, LIFT_SHADOW * light.get()));
  const offset = useTransform(() => mix(resting.current.offset, lensH.get() * LIFT_SHADOW_OFFSET));
  const blur = useTransform(() => mix(resting.current.blur, lensH.get() * LIFT_SHADOW_BLUR));
  return { strength, offset, blur };
}
/**
 * The lifted lens's optics as it lifts from resting glass (0) to a held lens (1): its rim band,
 * 0.33 of its radius wide, bulges out by 0.147 of its radius, pulling in what surrounds it, and
 * its middle magnifies by `magnification`. Give `band` to the edge depth, `bulge` to the zoom
 * with one refraction pixel, and `magnify` to the lens model's magnification.
 */
export function useLiftedOptics(lensW: Readable, lensH: Readable, lift: Readable, magnification = 1) {
  const band = useTransform(() => 2.5 + (Math.min(lensW.get(), lensH.get()) * .33 - 2.5) * unit(lift.get()));
  const bulge = useTransform(() => Math.min(lensW.get(), lensH.get()) * .147 * unit(lift.get()));
  const magnify = useTransform(() => 1 + (magnification - 1) * unit(lift.get()));
  return { band, bulge, magnify };
}

/** Reduced motion settles a thumb at once instead of springing it there. */
export function settleThumb(value: MotionValue<number>, target: number, spring: PhysicalSpring, reduce: boolean): SpringRun {
  if (!reduce) return springTo(value, target, spring);
  value.jump(target);
  return { stop() {}, finished: Promise.resolve() };
}

export function useThumbMotion(offset: MotionValue<number>, halfThumbWidth: number, halfThumbHeight: number, restTintBlur: number, reduce = false) {
  const pressTransition = { ease: [0.22, 1.15, 0.36, 1.06] as const, duration: 0.32 };
  const releaseTransition = { ease: [0.22, 1, 0.36, 1] as const, duration: 0.52 };
  // The white fills back in quickly as the lens starts to sink, then the white thumb settles: what
  // the lens shows of the track has no counterpart on the resting thumb, so filling in with the
  // sinking left it lingering as a grey ghost inside a half-white thumb.
  const fillTransition = { ease: [0.22, 1, 0.36, 1] as const, duration: 0.24 };
  const baseLensW = useMotionValue(halfThumbWidth);
  const baseLensH = useMotionValue(halfThumbHeight);
  const radius = useMotionValue(halfThumbHeight);
  const tintOpacity = useMotionValue(1);
  const targetScaleX = useMotionValue(0.85);
  const targetScaleY = useMotionValue(0.525);
  const tintBlur = useMotionValue(restTintBlur);
  // 1 while a press stays put; it eases to 0 once the press drags, and the touch light with it,
  // as a dragged tab's lens does: the lifted lens never glows while it moves.
  const still = useMotionValue(1);
  const { deformation, setBoost: setDeformationBoost } = useVelocityDeformation(offset, {
    target: speed => reduce ? 0 : Math.min(0.35, 0.012 * speed ** 0.75),
    stiffness: 180,
    damping: 14,
  });
  const lensW = useTransform(() => baseLensW.get() * (1 - 0.2 * deformation.get()));
  const lensH = useTransform(() => baseLensH.get() * (1 + 0.4 * deformation.get()));

  const to = (value: MotionValue<number>, target: number, transition: ValueAnimationTransition) => {
    if (reduce) value.jump(target); else animate(value, target, transition);
  };
  const expand = () => {
    still.jump(1);
    to(baseLensW, halfThumbWidth * 1.5, pressTransition);
    to(baseLensH, halfThumbHeight * 1.5, pressTransition);
    to(radius, halfThumbHeight * 1.5, pressTransition);
    to(tintOpacity, 0, pressTransition);
    to(tintBlur, 0, pressTransition);
    to(targetScaleX, 0.95, pressTransition);
    to(targetScaleY, 0.975, pressTransition);
  };
  const collapse = () => {
    to(baseLensW, halfThumbWidth, releaseTransition);
    to(baseLensH, halfThumbHeight, releaseTransition);
    to(radius, halfThumbHeight, releaseTransition);
    to(tintOpacity, 1, fillTransition);
    to(tintBlur, restTintBlur, fillTransition);
    to(targetScaleX, 0.85, releaseTransition);
    to(targetScaleY, 0.525, releaseTransition);
  };
  const drag = () => to(still, 0, { duration: 0.2, ease: [0.4, 0, 0.2, 1] });
  return { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, still, setDeformationBoost: reduce ? () => undefined : setDeformationBoost, expand, collapse, drag };
}
