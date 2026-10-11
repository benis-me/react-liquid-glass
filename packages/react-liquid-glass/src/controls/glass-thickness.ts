import { useTransform, type MotionValue } from "motion/react";
import { GLASS_THICKNESS_KEYS, glassValue, type GlassThicknessKey } from "../liquid-glass/material.js";
import type { GlassMaterial } from "../liquid-glass/provider.js";

/**
 * The glass material for a live thickness (0 a control, 1 a panel), as MotionValues, for glass
 * whose body grows and shrinks. A key the host sets through LiquidGlassProvider keeps the host's
 * value. A canvas drawn at `scale` (the small Morph Menu) keeps a control's lengths in CSS pixels,
 * so its closed trigger matches a Button.
 */
export function useGlassThickness(thickness: MotionValue<number>, dark: boolean, overrides: GlassMaterial, scale = 1) {
  const material = {} as Record<GlassThicknessKey, MotionValue<number> | number>;
  // The keys never change, so the hooks below run in the same order on every render.
  for (const key of GLASS_THICKNESS_KEYS) {
    const value = useTransform(thickness, t => glassValue(key, t, { dark, scale }));
    material[key] = overrides[key] ?? value;
  }
  return material;
}
