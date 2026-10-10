import { useSyncExternalStore } from "react";
import { useTransform, type MotionValue } from "motion/react";
import { LIQUID_GLASS_MATERIAL } from "../liquid-glass/render-frame.js";
import { DEFAULT_MATERIAL, type GlassMaterial } from "../liquid-glass/provider.js";
import { liquidHostTheme, subscribeLiquidTheme } from "../liquid-glass/source.js";
import { SURFACE_MATERIAL } from "./GlassSurface.js";

// Glass reads thicker as it grows, as Apple's does: a deeper, richer shadow, stronger lensing
// and softer light. Both ends are calibrated materials: the compact controls (Button, a closed
// trigger) at a 48px short side and the open Morph Menu from 320px; see liquidThickness.
export const THIN_GLASS = {
  refractionStrength: SURFACE_MATERIAL.refractionStrength,
  chromaAmount: DEFAULT_MATERIAL.chromaAmount,
  specularStrength: SURFACE_MATERIAL.specularStrength,
  domeDepth: DEFAULT_MATERIAL.domeDepth,
  brightness: LIQUID_GLASS_MATERIAL.brightness,
  glowStrength: SURFACE_MATERIAL.glowStrength,
  glowSpread: SURFACE_MATERIAL.glowSpread,
  edgeStrength: SURFACE_MATERIAL.edgeStrength,
  edgeWidth: SURFACE_MATERIAL.edgeWidth,
  tintStrength: SURFACE_MATERIAL.tintStrength,
  magnification: 1,
  shadowStrength: SURFACE_MATERIAL.shadowStrength,
  shadowOffset: SURFACE_MATERIAL.shadowOffset,
  shadowBlur: SURFACE_MATERIAL.shadowBlur,
} as const;
type ThicknessKey = keyof typeof THIN_GLASS;
const KEYS = Object.keys(THIN_GLASS) as ThicknessKey[];

export const THICK_GLASS: Record<ThicknessKey, number> = {
  refractionStrength: LIQUID_GLASS_MATERIAL.refractionStrength,
  chromaAmount: LIQUID_GLASS_MATERIAL.chromaAmount,
  specularStrength: LIQUID_GLASS_MATERIAL.specularStrength,
  domeDepth: LIQUID_GLASS_MATERIAL.domeDepth,
  brightness: LIQUID_GLASS_MATERIAL.brightness,
  glowStrength: LIQUID_GLASS_MATERIAL.glowStrength,
  glowSpread: LIQUID_GLASS_MATERIAL.glowSpread,
  edgeStrength: LIQUID_GLASS_MATERIAL.edgeStrength,
  edgeWidth: LIQUID_GLASS_MATERIAL.edgeWidth,
  tintStrength: .035,
  magnification: 1.38,
  shadowStrength: LIQUID_GLASS_MATERIAL.shadowStrength,
  shadowOffset: LIQUID_GLASS_MATERIAL.shadowOffset,
  shadowBlur: LIQUID_GLASS_MATERIAL.shadowBlur,
};
/** Over a dark host, thick glass keeps a little more light and a firmer edge. */
export const THICK_GLASS_DARK: Record<ThicknessKey, number> = { ...THICK_GLASS, brightness: .035, glowStrength: .38, edgeStrength: .42 };
/** Dark hosts tint glass toward their own surface instead of white. */
export const DARK_GLASS_TINT = [74 / 255, 74 / 255, 70 / 255] as const;
/** A thin edge follows the control's short side, as GlassSurface's does; a thick one is fixed. */
export const glassEdgeDepth = (shortSide: number, thickness: number) => {
  const thin = Math.min(12, shortSide * .12);
  return thin + (26 - thin) * thickness;
};
/** The reach of the soft shadow at this thickness, for reserving canvas padding. */
export function glassShadowReach(thickness: number, overrides: GlassMaterial = {}) {
  const blur = overrides.shadowBlur ?? THIN_GLASS.shadowBlur + (THICK_GLASS.shadowBlur - THIN_GLASS.shadowBlur) * thickness;
  const offset = overrides.shadowOffset ?? THIN_GLASS.shadowOffset + (THICK_GLASS.shadowOffset - THIN_GLASS.shadowOffset) * thickness;
  return Math.ceil(Math.max(28, blur * 3 + Math.abs(offset)));
}

/** Whether the host page is dark: data-theme="dark", or class="dark" (next-themes, shadcn). */
export function useHostDark() {
  return useSyncExternalStore(subscribeLiquidTheme, () => liquidHostTheme() === "dark", () => false);
}

// Lengths, in the canvas's own units.
const LENGTHS = new Set<ThicknessKey>(["domeDepth", "edgeWidth", "shadowOffset", "shadowBlur"]);

/**
 * Material for glass whose live thickness (0 thin, 1 thick) is `thickness`. A key the host
 * sets through LiquidGlassProvider keeps the host's value. A canvas drawn at `scale` (the
 * small Morph Menu) keeps thin lengths in CSS pixels, so its closed trigger matches a Button.
 */
export function useGlassThickness(thickness: MotionValue<number>, dark: boolean, overrides: GlassMaterial, scale = 1) {
  const thick = dark ? THICK_GLASS_DARK : THICK_GLASS;
  const material = {} as Record<ThicknessKey, MotionValue<number> | number>;
  // KEYS never changes, so the hooks below run in the same order on every render.
  for (const key of KEYS) {
    const thin = LENGTHS.has(key) ? THIN_GLASS[key] / scale : THIN_GLASS[key];
    const value = useTransform(thickness, t => thin + (thick[key] - thin) * t);
    material[key] = overrides[key] ?? value;
  }
  return material;
}
