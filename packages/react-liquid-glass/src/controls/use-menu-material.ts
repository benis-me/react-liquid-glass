import { animate, useMotionValue } from "motion/react";
import type { MenuTransition } from "../apple-motion/use-menu-motion";
import { OPEN_MORPH_DURATION, CONTENT_MORPH_TIMES, OPEN_MORPH_EASES, CLOSE_FUSION_TIMES, CLOSE_FUSION_EASES, PRESS_EASE, RELEASE_EASE } from "../apple-motion/menu";

export function useMenuMaterial() {
  const depth = useMotionValue(10);
  const tintOpacity = useMotionValue(0.16);
  const zoom = useMotionValue(1.35);
  const closingBlur = useMotionValue(0);
  const buttonDepth = useMotionValue(10);
  const buttonTintOpacity = useMotionValue(0.16);
  const buttonZoom = useMotionValue(1.35);
  const transition = ({ open: nextOpen, duration: transitionDuration, reducedMotion }: MenuTransition) => {
    const target = nextOpen ? { depth: 26, tint: 0.035, zoom: 1.38 } : { depth: 10, tint: 0.16, zoom: 1.35 };
    const buttonTarget = nextOpen ? { depth: 10, tint: 0, zoom: 1 } : { depth: 10, tint: 0.16, zoom: 1.35 };
    if (reducedMotion) {
      depth.jump(target.depth); tintOpacity.jump(target.tint); zoom.jump(target.zoom);
      buttonDepth.jump(buttonTarget.depth); buttonTintOpacity.jump(buttonTarget.tint); buttonZoom.jump(buttonTarget.zoom);
      closingBlur.jump(0);
      return [];
    }
    return nextOpen ? [
      animate(depth, [depth.get(), 14, 27, target.depth], {
        duration: OPEN_MORPH_DURATION,
        times: CONTENT_MORPH_TIMES,
        ease: OPEN_MORPH_EASES,
      }),
      animate(tintOpacity, [tintOpacity.get(), 0.1, 0.055, target.tint], {
        duration: OPEN_MORPH_DURATION,
        times: CONTENT_MORPH_TIMES,
        ease: OPEN_MORPH_EASES,
      }),
      animate(zoom, [zoom.get(), 1.68, 1.4, target.zoom], {
        duration: OPEN_MORPH_DURATION,
        times: CONTENT_MORPH_TIMES,
        ease: OPEN_MORPH_EASES,
      }),
      animate(closingBlur, 0, { duration: 0.16, ease: RELEASE_EASE }),
      animate(buttonDepth, buttonTarget.depth, { duration: 0.1, ease: PRESS_EASE }),
      animate(buttonTintOpacity, buttonTarget.tint, { duration: 0.1, ease: PRESS_EASE }),
      animate(buttonZoom, buttonTarget.zoom, { duration: 0.1, ease: PRESS_EASE }),
    ] : [
      animate(depth, [depth.get(), 29, 22, 16, 10, target.depth], {
        duration: transitionDuration,
        times: CLOSE_FUSION_TIMES,
        ease: CLOSE_FUSION_EASES,
      }),
      animate(tintOpacity, [tintOpacity.get(), 0.02, 0.055, 0.1, 0.04, target.tint], {
        duration: transitionDuration,
        times: CLOSE_FUSION_TIMES,
        ease: CLOSE_FUSION_EASES,
      }),
      animate(zoom, [zoom.get(), 1.46, 1.52, 1.45, 1.2, target.zoom], {
        duration: transitionDuration,
        times: CLOSE_FUSION_TIMES,
        ease: CLOSE_FUSION_EASES,
      }),
      animate(closingBlur, 3.2, { duration: 0.08, ease: PRESS_EASE }),
      animate(buttonDepth, [buttonDepth.get(), 10, 14, 18, 22, buttonTarget.depth], {
        duration: transitionDuration,
        times: CLOSE_FUSION_TIMES,
        ease: CLOSE_FUSION_EASES,
      }),
      animate(buttonTintOpacity, [buttonTintOpacity.get(), 0, 0.03, 0.075, 0.12, buttonTarget.tint], {
        duration: transitionDuration,
        times: CLOSE_FUSION_TIMES,
        ease: CLOSE_FUSION_EASES,
      }),
      animate(buttonZoom, [buttonZoom.get(), 1, 1.35, 1.55, 1.48, buttonTarget.zoom], {
        duration: transitionDuration,
        times: CLOSE_FUSION_TIMES,
        ease: CLOSE_FUSION_EASES,
      }),
    ];
  };
  const press = (pressed: boolean) => {
    const duration = pressed ? 0.08 : 0.16;
    const ease = pressed ? PRESS_EASE : RELEASE_EASE;
    return [
      animate(buttonDepth, pressed ? 16 : 10, { duration, ease }),
      animate(buttonTintOpacity, pressed ? 0.025 : 0.16, { duration, ease }),
      animate(buttonZoom, pressed ? 1.82 : 1.35, { duration, ease }),
    ];
  };
  return { depth, tintOpacity, zoom, buttonDepth, buttonTintOpacity, buttonZoom, closingBlur, transition, press };
}
