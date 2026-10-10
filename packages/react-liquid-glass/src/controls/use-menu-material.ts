import { animate, useMotionValue } from "motion/react";
import type { MenuTransition } from "../apple-motion/use-menu-motion.js";
import { OPEN_MORPH_DURATION, CONTENT_MORPH_TIMES, OPEN_MORPH_EASES, CLOSE_FUSION_TIMES, CLOSE_FUSION_EASES, PRESS_EASE, RELEASE_EASE } from "../apple-motion/menu.js";

/**
 * The morph's own depth, tint and zoom. They shape the thick menu body; LiquidMenu blends them in by
 * thickness, so the closed values sit under a thin trigger and never show on their own.
 */
export function useMenuMaterial() {
  const depth = useMotionValue(10);
  const tintOpacity = useMotionValue(0.16);
  const zoom = useMotionValue(1.35);
  const closingBlur = useMotionValue(0);
  const transition = ({ open: nextOpen, duration: transitionDuration, reducedMotion }: MenuTransition) => {
    const target = nextOpen ? { depth: 26, tint: 0.035, zoom: 1.38 } : { depth: 10, tint: 0.16, zoom: 1.35 };
    if (reducedMotion) {
      depth.jump(target.depth); tintOpacity.jump(target.tint); zoom.jump(target.zoom);
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
    ];
  };
  return { depth, tintOpacity, zoom, closingBlur, transition };
}
