import { springTo, useVelocityDeformation, type SpringRun } from "../apple-motion/react.js";
import type { PhysicalSpring } from "../apple-motion/index.js";
import { animate, useMotionValue, useTransform, type MotionValue, type ValueAnimationTransition } from "motion/react";
import { LIQUID_LENS } from "../liquid-glass/LiquidGlass.js";
import type { LiquidLens } from "../liquid-glass/lens.js";

/** Thumb glass shared by Switch, Slider and Segmented: low dispersion, a fine rim, a theme-aware lift. */
export const thumbLens = (dark: boolean, lens: LiquidLens): LiquidLens => ({
  ...LIQUID_LENS, chromaAmount: .24, edgeWidth: .9, brightness: dark ? .035 : .015, ...lens,
});

/** Reduced motion settles a thumb at once instead of springing it there. */
export function settleThumb(value: MotionValue<number>, target: number, spring: PhysicalSpring, reduce: boolean): SpringRun {
  if (!reduce) return springTo(value, target, spring);
  value.jump(target);
  return { stop() {}, finished: Promise.resolve() };
}

export function useThumbMotion(offset: MotionValue<number>, halfThumbWidth: number, halfThumbHeight: number, restTintBlur: number, reduce = false) {
  const pressTransition = { ease: [0.22, 1.15, 0.36, 1.06] as const, duration: 0.32 };
  const releaseTransition = { ease: [0.22, 1, 0.36, 1] as const, duration: 0.52 };
  const baseLensW = useMotionValue(halfThumbWidth);
  const baseLensH = useMotionValue(halfThumbHeight);
  const radius = useMotionValue(halfThumbHeight);
  const tintOpacity = useMotionValue(1);
  const targetScaleX = useMotionValue(0.85);
  const targetScaleY = useMotionValue(0.525);
  const tintBlur = useMotionValue(restTintBlur);
  const shadowOpacity = useMotionValue(0);
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
    to(baseLensW, halfThumbWidth * 1.5, pressTransition);
    to(baseLensH, halfThumbHeight * 1.5, pressTransition);
    to(radius, halfThumbHeight * 1.5, pressTransition);
    to(tintOpacity, 0, pressTransition);
    to(tintBlur, 0, pressTransition);
    to(targetScaleX, 0.95, pressTransition);
    to(targetScaleY, 0.975, pressTransition);
    to(shadowOpacity, 1, pressTransition);
  };
  const collapse = () => {
    to(baseLensW, halfThumbWidth, releaseTransition);
    to(baseLensH, halfThumbHeight, releaseTransition);
    to(radius, halfThumbHeight, releaseTransition);
    to(tintOpacity, 1, releaseTransition);
    to(tintBlur, restTintBlur, releaseTransition);
    to(targetScaleX, 0.85, releaseTransition);
    to(targetScaleY, 0.525, releaseTransition);
    to(shadowOpacity, 0, releaseTransition);
  };
  return { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, shadowOpacity, setDeformationBoost: reduce ? () => undefined : setDeformationBoost, expand, collapse };
}
