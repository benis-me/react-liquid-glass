import { useCallback, useEffect, useRef, useState } from "react";
import { animate, cancelFrame, frame, useMotionValue, useReducedMotion, useTransform, type MotionValue, type AnimationPlaybackControlsWithThen } from "motion/react";
import { liquidEasings, retargetLiquidFrames } from "./trajectory";
import { TRIGGER_RADIUS, MIN_LENS_HALF, OPEN_MORPH_DURATION, OPEN_CONTENT_DURATION, CLOSE_CONTENT_DURATION, CLOSE_FUSION_DURATION, CLOSE_IMPACT_DISTANCE, OPEN_MORPH_EASES, CLOSE_FUSION_EASES, PRESS_EASE, RELEASE_EASE, OPEN_MORPH_TIMES, CLOSE_FUSION_TIMES, openWidthFrames, openHeightFrames, openRadiusFrames, closeMenuWidthFrames, closeMenuHeightFrames, closeMenuRadiusFrames, closeButtonFrames } from "./menu";
import { cubicBezier } from "motion";

export interface StageSize {
  width: number;
  height: number;
}

export interface MenuLayout {
  panelLeft: number;
  panelTop: number;
  panelRight: number;
  panelBottom: number;
  panelWidth: number;
  panelHeight: number;
  panelRadius: number;
  triggerCenterX: number;
  triggerCenterY: number;
  triggerLeft: number;
  triggerTop: number;
}

export type AnimationControl = Pick<AnimationPlaybackControlsWithThen, "stop" | "then">;

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

function directionToButton(layout: MenuLayout) {
  const dx = layout.triggerCenterX - (layout.panelLeft + layout.panelWidth / 2);
  const dy = layout.triggerCenterY - (layout.panelTop + layout.panelHeight / 2);
  const magnitude = Math.hypot(dx, dy) || 1;
  return { x: dx / magnitude, y: dy / magnitude };
}

function closeImpactVector(layout: MenuLayout) {
  const direction = directionToButton(layout);
  return {
    x: direction.x * CLOSE_IMPACT_DISTANCE,
    y: direction.y * CLOSE_IMPACT_DISTANCE,
  };
}

function closeContactCenter(
  layout: MenuLayout,
  menuHalfWidth: number,
  menuHalfHeight: number,
  buttonHalf: number,
  gap = 0,
) {
  const direction = directionToButton(layout);
  const menuReach = Math.sqrt(
    (menuHalfWidth * direction.x) ** 2 + (menuHalfHeight * direction.y) ** 2,
  );
  const distance = menuReach + buttonHalf + gap;
  return {
    x: layout.triggerCenterX - direction.x * distance,
    y: layout.triggerCenterY - direction.y * distance,
  };
}

export interface MenuTransition {
  open: boolean;
  interrupted: boolean;
  duration: number;
  reducedMotion: boolean;
}
export interface MenuMotionOptions {
  getLayout: (width: number, height: number) => MenuLayout;
  coordinateScale?: number;
  onBegin?: (transition: Omit<MenuTransition, "duration">) => void;
  onTransition?: (transition: MenuTransition) => AnimationControl[];
  onPress?: (pressed: boolean) => AnimationControl[];
  onRest?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function useMenuMotion(options: MenuMotionOptions) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const getLayout = (width: number, height: number) => callbacks.current.getLayout(width, height);
  const stageRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const stageSizeRef = useRef<StageSize>({ width: 1, height: 1 });
  const animations = useRef<AnimationControl[]>([]);
  const transitionRevision = useRef(0);
  const focusTimer = useRef<number | null>(null);
  const openRef = useRef(false);
  const transitioningRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 1, height: 1 });
  const rightEdge = useMotionValue(MIN_LENS_HALF * 2);
  const bottomEdge = useMotionValue(MIN_LENS_HALF * 2);
  const halfWidth = useMotionValue(MIN_LENS_HALF);
  const halfHeight = useMotionValue(MIN_LENS_HALF);
  const cornerRadius = useMotionValue(MIN_LENS_HALF);
  const centerX = useMotionValue(0.5);
  const centerY = useMotionValue(0.5);
  const reveal = useMotionValue(0);
  const triggerOpacity = useMotionValue(1);
  const triggerScale = useMotionValue(1);
  const buttonCenterX = useMotionValue(0.5);
  const buttonCenterY = useMotionValue(0.5);
  const triggerOffsetX = useTransform(buttonCenterX, (value) =>
    value * stageSizeRef.current.width - getLayout(stageSizeRef.current.width, stageSizeRef.current.height).triggerCenterX);
  const triggerOffsetY = useTransform(buttonCenterY, (value) =>
    value * stageSizeRef.current.height - getLayout(stageSizeRef.current.width, stageSizeRef.current.height).triggerCenterY);
  const buttonHalf = useMotionValue(TRIGGER_RADIUS);
  const menuVelocityX = useMotionValue(0);
  const menuVelocityY = useMotionValue(0);
  const buttonVelocityX = useMotionValue(0);
  const buttonVelocityY = useMotionValue(0);
  const mergeDistance = useMotionValue(0);
  const stopAnimations = useCallback(() => {
    transitionRevision.current += 1;
    animations.current.forEach((control) => control.stop());
    animations.current = [];
  }, []);

  const clearFocusTimer = useCallback(() => {
    if (focusTimer.current === null) return;
    window.clearTimeout(focusTimer.current);
    focusTimer.current = null;
  }, []);

  useEffect(() => () => {
    stopAnimations();
    clearFocusTimer();
  }, [clearFocusTimer, stopAnimations]);

  const syncCenters = useCallback(() => {
    const { width, height } = stageSizeRef.current;
    centerX.set((rightEdge.get() - halfWidth.get()) / Math.max(1, width));
    centerY.set((bottomEdge.get() - halfHeight.get()) / Math.max(1, height));
    // During opening, park the fully absorbed button inside the growing body.
    // A visible button on an interrupted close keeps its live position instead.
    if (openRef.current && buttonHalf.get() <= MIN_LENS_HALF) {
      buttonCenterX.set(centerX.get());
      buttonCenterY.set(centerY.get());
    }
  }, [bottomEdge, buttonCenterX, buttonCenterY, buttonHalf, centerX, centerY, halfHeight, halfWidth, rightEdge]);

  useEffect(() => {
    const unsubscribe = [
      rightEdge.on("change", syncCenters),
      bottomEdge.on("change", syncCenters),
      halfWidth.on("change", syncCenters),
      halfHeight.on("change", syncCenters),
      buttonHalf.on("change", syncCenters),
    ];
    syncCenters();
    return () => unsubscribe.forEach((stop) => stop());
  }, [bottomEdge, buttonHalf, halfHeight, halfWidth, rightEdge, syncCenters]);

  useEffect(() => {
    const updateVelocity = () => {
      const moving = transitioningRef.current && !reduceMotion;
      const vx = moving ? rightEdge.getVelocity() - halfWidth.getVelocity() : 0;
      const vy = moving ? bottomEdge.getVelocity() - halfHeight.getVelocity() : 0;
      const speed = Math.hypot(vx, vy);
      const gain = Math.min(openRef.current ? 0.055 : 0.11, 180 / Math.max(1, speed));
      menuVelocityX.set(vx * gain);
      menuVelocityY.set(vy * gain);
      // Absorption deforms the anchored button; recoil cannot excite a new wave.
      const absorption = moving && !openRef.current
        ? Math.min(130, Math.max(0, buttonHalf.getVelocity()) * 0.9)
        : 0;
      const direction = directionToButton(getLayout(stageSizeRef.current.width, stageSizeRef.current.height));
      buttonVelocityX.set(direction.x * absorption);
      buttonVelocityY.set(direction.y * absorption);
    };
    const schedule = () => frame.preRender(updateVelocity);
    const unsubscribe = [rightEdge, bottomEdge, halfWidth, halfHeight, buttonHalf]
      .map((value) => value.on("change", schedule));
    return () => {
      unsubscribe.forEach((stop) => stop());
      cancelFrame(updateVelocity);
    };
  }, [
    bottomEdge, buttonHalf, buttonVelocityX, buttonVelocityY, halfHeight, halfWidth,
    menuVelocityX, menuVelocityY, reduceMotion, rightEdge,
  ]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.round(rect.width / (callbacks.current.coordinateScale ?? 1))),
        height: Math.max(1, Math.round(rect.height / (callbacks.current.coordinateScale ?? 1))),
      };
      stageSizeRef.current = next;
      setStageSize((current) => current.width === next.width && current.height === next.height
        ? current
        : next);
      const layout = getLayout(next.width, next.height);
      const expanded = openRef.current;
      const nextHalfWidth = expanded ? layout.panelWidth / 2 : MIN_LENS_HALF;
      const nextHalfHeight = expanded ? layout.panelHeight / 2 : MIN_LENS_HALF;
      const nextRight = expanded ? layout.panelRight : layout.triggerCenterX + MIN_LENS_HALF;
      const nextBottom = expanded ? layout.panelBottom : layout.triggerCenterY + MIN_LENS_HALF;
      halfWidth.jump(nextHalfWidth);
      halfHeight.jump(nextHalfHeight);
      cornerRadius.jump(expanded ? layout.panelRadius : MIN_LENS_HALF);
      rightEdge.jump(nextRight);
      bottomEdge.jump(nextBottom);
      centerX.jump((nextRight - nextHalfWidth) / next.width);
      centerY.jump((nextBottom - nextHalfHeight) / next.height);
      buttonCenterX.jump(expanded ? centerX.get() : layout.triggerCenterX / next.width);
      buttonCenterY.jump(expanded ? centerY.get() : layout.triggerCenterY / next.height);
      buttonHalf.jump(expanded ? MIN_LENS_HALF : TRIGGER_RADIUS);
    };

    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(stage);
    return () => observer.disconnect();
  }, [
    bottomEdge,
    buttonCenterX,
    buttonCenterY,
    buttonHalf,
    centerX,
    centerY,
    cornerRadius,
    halfHeight,
    halfWidth,
    rightEdge,
  ]);

  const setExpanded = useCallback((nextOpen: boolean, restoreFocus = false) => {
    if (openRef.current === nextOpen) return;
    const interrupted = transitioningRef.current;
    // Snapshot only at a transition boundary; every animated frame reuses the texture.
    callbacks.current.onBegin?.({ open: nextOpen, interrupted, reducedMotion: !!reduceMotion });
    clearFocusTimer();
    stopAnimations();
    const revision = transitionRevision.current;
    openRef.current = nextOpen;
    setOpen(nextOpen);
    callbacks.current.onOpenChange?.(nextOpen);
    if (nextOpen) triggerRef.current?.blur();

    const size = stageSizeRef.current;
    const layout = getLayout(size.width, size.height);
    const target = nextOpen
      ? {
          right: layout.panelRight,
          bottom: layout.panelBottom,
          halfWidth: layout.panelWidth / 2,
          halfHeight: layout.panelHeight / 2,
          radius: layout.panelRadius,
        }
      : {
          right: layout.triggerCenterX + MIN_LENS_HALF,
          bottom: layout.triggerCenterY + MIN_LENS_HALF,
          halfWidth: MIN_LENS_HALF,
          halfHeight: MIN_LENS_HALF,
          radius: MIN_LENS_HALF,
        };
    const buttonTarget = nextOpen
      ? { half: MIN_LENS_HALF }
      : {
          half: TRIGGER_RADIUS,
        };

    // A partially opened body must not spend a full panel's time returning.
    // Keep one clock for geometry, optics and focus, with room for momentum braking.
    const transitionDuration = nextOpen ? OPEN_MORPH_DURATION : CLOSE_FUSION_DURATION * (interrupted
      ? clamp(Math.max(halfWidth.get() * 2 / layout.panelWidth, halfHeight.get() * 2 / layout.panelHeight), 0.55, 1)
      : 1);

    const materialAnimations = callbacks.current.onTransition?.({ open: nextOpen, interrupted, duration: transitionDuration, reducedMotion: !!reduceMotion }) ?? [];

    const morph = (value: MotionValue<number>, keyframes: number[], positive = false) => {
      const duration = transitionDuration;
      // The initial Hermite tangent peaks at 4/27; keep shrinking extents above zero.
      const velocity = positive
        ? Math.max(value.getVelocity(), -(value.get() - MIN_LENS_HALF) * 6.75 / duration)
        : value.getVelocity();
      // A reversal starts at the live shape and velocity, not at the press/swell pose.
      let { values, times } = interrupted
        ? retargetLiquidFrames(value.get(), keyframes[keyframes.length - 1], duration, velocity)
        : { values: keyframes, times: nextOpen ? OPEN_MORPH_TIMES : CLOSE_FUSION_TIMES };
      if (interrupted && value === cornerRadius && times.length === 2) {
        // A reversed shrinking body still gathers into a capsule, not a tiny sharp panel.
        const roundBody = Math.min(
          Math.max(halfWidth.get(), target.halfWidth * 0.5),
          Math.max(halfHeight.get(), target.halfHeight * 0.5),
        );
        values = [value.get(), Math.max(value.get(), roundBody * 0.92), target.radius];
        times = [0, 0.3, 1];
      }
      return animate(value, values, {
        duration,
        times,
        ease: liquidEasings(values, times, duration, velocity),
      });
    };

    const finishTransition = () => {
      if (transitionRevision.current !== revision || openRef.current !== nextOpen) return;
      transitioningRef.current = false;
      menuVelocityX.jump(0);
      menuVelocityY.jump(0);
      buttonVelocityX.jump(0);
      buttonVelocityY.jump(0);
      mergeDistance.jump(0);
      callbacks.current.onRest?.();
      animations.current = [];
    };

    if (reduceMotion) {
      transitioningRef.current = false;
      rightEdge.jump(target.right);
      bottomEdge.jump(target.bottom);
      halfWidth.jump(target.halfWidth);
      halfHeight.jump(target.halfHeight);
      cornerRadius.jump(target.radius);
      reveal.jump(nextOpen ? 1 : 0);
      triggerOpacity.jump(nextOpen ? 0 : 1);
      triggerScale.jump(nextOpen ? 0.78 : 1);
      buttonCenterX.jump(nextOpen ? centerX.get() : layout.triggerCenterX / size.width);
      buttonCenterY.jump(nextOpen ? centerY.get() : layout.triggerCenterY / size.height);
      buttonHalf.jump(buttonTarget.half);
      finishTransition();
    } else if (nextOpen) {
      if (!interrupted) {
        const startHalf = buttonHalf.get();
        halfWidth.jump(startHalf);
        halfHeight.jump(startHalf);
        cornerRadius.jump(startHalf);
        rightEdge.jump(layout.triggerCenterX + startHalf);
        bottomEdge.jump(layout.triggerCenterY + startHalf);
        buttonHalf.jump(MIN_LENS_HALF);
      }
      transitioningRef.current = true;
      const widthStart = halfWidth.get();
      const heightStart = halfHeight.get();
      const radiusStart = cornerRadius.get();
      const widthFrames = openWidthFrames(widthStart, target.halfWidth);
      const heightFrames = openHeightFrames(heightStart, target.halfHeight);
      const targetCenterX = target.right - target.halfWidth;
      const targetCenterY = target.bottom - target.halfHeight;
      animations.current = [
        ...materialAnimations,
        morph(rightEdge, [
          rightEdge.get(),
          layout.triggerCenterX + widthFrames[1],
          targetCenterX + (layout.triggerCenterX - targetCenterX) * 0.16 + widthFrames[2],
          targetCenterX - 1.5 + widthFrames[3],
          target.right,
        ]),
        morph(bottomEdge, [
          bottomEdge.get(),
          layout.triggerCenterY + heightFrames[1],
          targetCenterY + (layout.triggerCenterY - targetCenterY) * 0.14 + heightFrames[2],
          targetCenterY - 4 + heightFrames[3],
          target.bottom,
        ]),
        morph(halfWidth, widthFrames, true),
        morph(halfHeight, heightFrames, true),
        morph(cornerRadius, openRadiusFrames(radiusStart, target.radius, target.halfWidth, target.halfHeight), true),
        animate(reveal, [reveal.get(), reveal.get(), Math.max(reveal.get(), 0.94), 1], {
          duration: OPEN_CONTENT_DURATION,
          times: [0, 0.06, 0.62, 1],
          ease: OPEN_MORPH_EASES,
        }),
        animate(triggerOpacity, 0, {
          duration: 0.1,
          ease: PRESS_EASE,
        }),
        morph(triggerScale, [triggerScale.get(), 0.82, 0.8, 0.76, 0.76]),
        morph(buttonHalf, [buttonHalf.get(), 1, 1, 1, 1], true),
        morph(mergeDistance, [mergeDistance.get(), 12, 8, 0, 0]),
      ];
    } else {
      transitioningRef.current = true;
      const widthStart = halfWidth.get();
      const heightStart = halfHeight.get();
      const radiusStart = cornerRadius.get();
      const widthFrames = closeMenuWidthFrames(widthStart);
      const heightFrames = closeMenuHeightFrames(heightStart);
      const buttonFrames = closeButtonFrames(buttonHalf.get());
      const impact = closeImpactVector(layout);
      // Let the anchored head lead outside the body before their lobes overlap.
      const approachCenter = closeContactCenter(
        layout,
        widthFrames[2],
        heightFrames[2],
        buttonFrames[2],
        21,
      );
      const contactCenter = closeContactCenter(
        layout,
        widthFrames[3],
        heightFrames[3],
        buttonFrames[3],
        -8,
      );
      const buttonBaseX = layout.triggerCenterX / size.width;
      const buttonBaseY = layout.triggerCenterY / size.height;
      if (buttonHalf.get() <= MIN_LENS_HALF) {
        buttonCenterX.jump(buttonBaseX);
        buttonCenterY.jump(buttonBaseY);
      }
      animations.current = [
        ...materialAnimations,
        morph(rightEdge, [
          rightEdge.get(),
          rightEdge.get() - 1,
          approachCenter.x + widthFrames[2],
          contactCenter.x + widthFrames[3],
          layout.triggerCenterX + widthFrames[4] + impact.x,
          target.right,
        ]),
        morph(bottomEdge, [
          bottomEdge.get(),
          bottomEdge.get() + 3,
          approachCenter.y + heightFrames[2],
          contactCenter.y + heightFrames[3],
          layout.triggerCenterY + heightFrames[4] + impact.y,
          target.bottom,
        ]),
        morph(halfWidth, widthFrames, true),
        morph(halfHeight, heightFrames, true),
        morph(cornerRadius, closeMenuRadiusFrames(radiusStart, widthStart, heightStart), true),
        // Ink loses focus while the body is still large; the glass gathers afterwards.
        animate(reveal, [reveal.get(), reveal.get() * 0.3, reveal.get() * 0.02, 0], {
          duration: CLOSE_CONTENT_DURATION * transitionDuration / CLOSE_FUSION_DURATION,
          times: [0, 0.28, 0.52, 1],
          ease: [PRESS_EASE, cubicBezier(0.3, 0, 0.45, 0.7), RELEASE_EASE],
        }),
        animate(triggerOpacity, interrupted ? [triggerOpacity.get(), 1] : [triggerOpacity.get(), 0, 0.2, 0.94, 1, 1], {
          duration: transitionDuration,
          times: interrupted ? [0, 1] : CLOSE_FUSION_TIMES,
          ease: interrupted ? RELEASE_EASE : CLOSE_FUSION_EASES,
        }),
        morph(triggerScale, [triggerScale.get(), 0.25, 0.47, 0.97, 1.02, 1]),
        morph(buttonCenterX, [
          buttonCenterX.get(),
          buttonBaseX,
          buttonBaseX,
          buttonBaseX,
          (layout.triggerCenterX + impact.x) / size.width,
          buttonBaseX,
        ]),
        morph(buttonCenterY, [
          buttonCenterY.get(),
          buttonBaseY,
          buttonBaseY,
          buttonBaseY,
          (layout.triggerCenterY + impact.y) / size.height,
          buttonBaseY,
        ]),
        morph(buttonHalf, buttonFrames, true),
        morph(mergeDistance, [mergeDistance.get(), 0, 40, 28, 2, 0]),
      ];
    }

    if (!reduceMotion) void Promise.all(animations.current).then(finishTransition);

    if (restoreFocus) {
      const focusDelay = reduceMotion
        ? 0
        : transitionDuration * 1000 + 32;
      focusTimer.current = window.setTimeout(() => {
        focusTimer.current = null;
        if (!openRef.current) triggerRef.current?.focus({ preventScroll: true });
      }, focusDelay);
    }
  }, [
    bottomEdge,
    buttonCenterX,
    buttonCenterY,
    buttonHalf,
    buttonVelocityX,
    buttonVelocityY,
    centerX,
    centerY,
    clearFocusTimer,
    cornerRadius,
    halfHeight,
    halfWidth,
    mergeDistance,
    menuVelocityX,
    menuVelocityY,
    reduceMotion,
    reveal,
    rightEdge,
    stopAnimations,
    triggerOpacity,
    triggerScale,
  ]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setExpanded(false, true);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, setExpanded]);

  const pressTrigger = useCallback((pressed: boolean) => {
    if (openRef.current || transitioningRef.current) return;
    stopAnimations();
    const duration = pressed ? 0.08 : 0.16;
    const ease = pressed ? PRESS_EASE : RELEASE_EASE;
    const pressHalf = pressed ? TRIGGER_RADIUS * 1.025 : TRIGGER_RADIUS;
    animations.current = [
      ...callbacks.current.onPress?.(pressed) ?? [],
      animate(buttonHalf, pressHalf, { duration, ease }),
        animate(triggerScale, pressed ? 1.025 : 1, {
        duration,
        ease,
      }),
    ];
  }, [
    buttonHalf,
    stopAnimations,
    triggerScale,
  ]);

  return { open, stageSize, stageRef, triggerRef, rightEdge, bottomEdge, halfWidth, halfHeight, cornerRadius, centerX, centerY, buttonCenterX, buttonCenterY, buttonHalf, menuVelocityX, menuVelocityY, buttonVelocityX, buttonVelocityY, mergeDistance, reveal, triggerOpacity, triggerScale, triggerOffsetX, triggerOffsetY, setExpanded, pressTrigger };
}
