import { useVelocityDeformation } from "../apple-motion/react";
import { animate, useMotionValue, useTransform, type MotionValue } from "motion/react";

export function useThumbMotion(offset: MotionValue<number>, halfThumbWidth: number, halfThumbHeight: number, restTintBlur: number) {
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
    target: speed => Math.min(0.35, 0.012 * speed ** 0.75),
    stiffness: 180,
    damping: 14,
  });
  const lensW = useTransform(() => baseLensW.get() * (1 - 0.2 * deformation.get()));
  const lensH = useTransform(() => baseLensH.get() * (1 + 0.4 * deformation.get()));

  const expand = () => {
    animate(baseLensW, halfThumbWidth * 1.5, pressTransition);
    animate(baseLensH, halfThumbHeight * 1.5, pressTransition);
    animate(radius, halfThumbHeight * 1.5, pressTransition);
    animate(tintOpacity, 0, pressTransition);
    animate(tintBlur, 0, pressTransition);
    animate(targetScaleX, 0.95, pressTransition);
    animate(targetScaleY, 0.975, pressTransition);
    animate(shadowOpacity, 1, pressTransition);
  };
  const collapse = () => {
    animate(baseLensW, halfThumbWidth, releaseTransition);
    animate(baseLensH, halfThumbHeight, releaseTransition);
    animate(radius, halfThumbHeight, releaseTransition);
    animate(tintOpacity, 1, releaseTransition);
    animate(tintBlur, restTintBlur, releaseTransition);
    animate(targetScaleX, 0.85, releaseTransition);
    animate(targetScaleY, 0.525, releaseTransition);
    animate(shadowOpacity, 0, releaseTransition);
  };
  return { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, shadowOpacity, setDeformationBoost, expand, collapse };
}
