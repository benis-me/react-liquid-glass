import { useEffect, useRef } from "react";
import { springTo, useVelocityDeformation, type SpringRun } from "../apple-motion/react.js";
import type { PhysicalSpring } from "../apple-motion/index.js";
import { LIFT_SPRING, SEGMENTED_PRESS_SPRING, SEGMENTED_RELEASE_SPRING, THUMB_DEFORMATION, THUMB_FILL_SPRING } from "../apple-motion/presets.js";
import { useMotionValue, useTransform, type MotionValue } from "motion/react";

type Readable = { get(): number };
const unit = (value: number) => Math.min(1, Math.max(0, value));
/**
 * The lifted lens magnifies what lies under it for the whole press, held or dragged, as both
 * iOS 27 screenshots show, while its rim pulls in what surrounds it. It never shrinks back mid-drag.
 */
export const LIFT_MAGNIFICATION = 1.155;
/**
 * A lifted lens's ends draw in what passes through them by about a fifth of its height at the rim
 * (the band's squeeze, 1.5 × 0.147 of the radius). A track drawn this much taller meets the rim at
 * its own height and swells toward the middle, as through a magnifier, instead of narrowing there.
 */
export const LIFT_END_PINCH = 1 + 1.5 * 0.147;
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
export function settleThumb(value: MotionValue<number>, target: number, spring: PhysicalSpring, reduce: boolean, velocity?: number): SpringRun {
  if (!reduce) return springTo(value, target, spring, velocity);
  value.jump(target);
  const finished = Promise.resolve();
  return { stop() {}, finished, then: (onResolve, onReject) => finished.then(onResolve, onReject) };
}

export function useThumbMotion(offset: MotionValue<number>, halfThumbWidth: number, halfThumbHeight: number, restTintBlur: number, reduce = false) {
  // The thumb lifts into the lens and settles back on a pressed tab's springs. The white fills back
  // in quickly (THUMB_FILL_SPRING) as the lens starts to sink, then the white thumb settles: what the
  // lens shows of the track has no counterpart on the resting thumb, so filling in with the sinking
  // left it lingering as a grey ghost inside a half-white thumb.
  const lift = LIFT_SPRING, settle = SEGMENTED_RELEASE_SPRING, fill = THUMB_FILL_SPRING;
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
  // The held thumb is a soft body on a spring, as a dragged tab is: it stretches along its motion and
  // flattens with speed, easing off toward a fifth, then overshoots into a brief squash when it
  // stops and rebounds once. Squashing narrower and taller while it moved read as unnatural, and
  // a taller lens drew the track's edges into the pull of its rim band.
  const { deformation } = useVelocityDeformation(offset, {
    target: speed => reduce ? 0 : THUMB_DEFORMATION.max * Math.tanh(speed / THUMB_DEFORMATION.speed),
    smoothing: THUMB_DEFORMATION.smoothing,
    stiffness: THUMB_DEFORMATION.stiffness,
    damping: (position, target) => position > target ? THUMB_DEFORMATION.settleDamping : THUMB_DEFORMATION.damping,
  });
  const lensW = useTransform(() => baseLensW.get() * (1 + 0.6 * deformation.get()));
  const lensH = useTransform(() => baseLensH.get() * (1 - 0.45 * deformation.get()));

  const to = (value: MotionValue<number>, target: number, spring: PhysicalSpring) => { settleThumb(value, target, spring, reduce); };
  const expand = () => {
    still.jump(1);
    to(baseLensW, halfThumbWidth * 1.5, lift);
    to(baseLensH, halfThumbHeight * 1.5, lift);
    to(radius, halfThumbHeight * 1.5, lift);
    to(tintOpacity, 0, lift);
    to(tintBlur, 0, lift);
    // Held, the lens shows the track at its own size, as a pressed tab shows the bar, and magnifies it.
    to(targetScaleX, 1, lift);
    to(targetScaleY, 1, lift);
  };
  const collapse = () => {
    to(baseLensW, halfThumbWidth, settle);
    to(baseLensH, halfThumbHeight, settle);
    to(radius, halfThumbHeight, settle);
    to(tintOpacity, 1, fill);
    to(tintBlur, restTintBlur, fill);
    to(targetScaleX, 0.85, settle);
    to(targetScaleY, 0.525, settle);
  };
  // Once a press drags, the lens goes still as a dragged tab's does.
  const drag = () => to(still, 0, SEGMENTED_PRESS_SPRING);
  return { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, still, expand, collapse, drag };
}
