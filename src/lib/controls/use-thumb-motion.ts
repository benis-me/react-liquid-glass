import { useEffect, useRef } from "react";
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
  const deformation = useMotionValue(0);
  const deformationBoost = useRef(0);
  const deformationWake = useRef<() => void>(() => undefined);
  const lensW = useTransform(() => baseLensW.get() * (1 - 0.2 * deformation.get()));
  const lensH = useTransform(() => baseLensH.get() * (1 + 0.4 * deformation.get()));

  useEffect(() => {
    let frame = 0;
    let amount = 0;
    let amountVelocity = 0;
    let previousTime = 0;
    let previousPosition = offset.get();
    let running = false;
    const tick = (now: number) => {
      const elapsed = (now - previousTime) / 1_000;
      const dt = Math.min(elapsed, 0.033);
      previousTime = now;
      const position = offset.get();
      const velocity = (position - previousPosition) / Math.min(Math.max(elapsed, 0.008), 0.03);
      previousPosition = position;
      const speed = Math.abs(velocity);
      const target = Math.min(0.35, Math.max(Math.min(0.35, 0.012 * speed ** 0.75), deformationBoost.current));
      const force = -180 * (amount - target) - 14 * amountVelocity;
      amountVelocity += force * dt;
      amount += amountVelocity * dt;
      deformation.set(amount);
      if (Math.abs(amount) < 0.0005 && Math.abs(amountVelocity) < 0.005 && speed < 0.005 && deformationBoost.current === 0) {
        running = false;
        deformation.set(0);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (running) return;
      running = true;
      previousTime = performance.now();
      previousPosition = offset.get();
      frame = requestAnimationFrame(tick);
    };
    const unsubscribe = offset.on("change", wake);
    deformationWake.current = wake;
    return () => { unsubscribe(); cancelAnimationFrame(frame); deformationWake.current = () => undefined; };
  }, [offset, deformation]);

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
  return { lensW, lensH, radius, tintOpacity, targetScaleX, targetScaleY, tintBlur, shadowOpacity, deformationBoost, deformationWake, expand, collapse };
}
