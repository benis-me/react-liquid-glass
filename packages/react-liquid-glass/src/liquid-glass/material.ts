import { useSyncExternalStore } from "react";
import { liquidHostTheme, subscribeLiquidTheme } from "./source.js";

/**
 * Regular glass is frosted UI glass that adapts to its host's theme; clear glass is for
 * media-rich content, as Apple's: no frost or tint, and lensing kept to a narrow rim without
 * extra magnification, so what lies beneath stays vivid and legible at any size.
 */
export type GlassVariant = "regular" | "clear";

// One liquid glass material. It thickens with size, as Apple's does: larger glass casts a
// deeper, softer shadow, lenses more strongly, scatters light more softly and diffuses busy
// content more. Both ends are calibrated: a compact control (a Button) and a panel (the open
// Morph Menu); liquidThickness blends between them by the live body's short side.
export const THIN_GLASS = Object.freeze({
  refractionStrength: .2, chromaAmount: .33, specularStrength: .9, domeDepth: 28, blurStrength: .2,
  brightness: .015, glowStrength: .1, glowSpread: .6, edgeStrength: .26, edgeWidth: 1.2,
  tintStrength: .02, magnification: 1, shadowStrength: .055, shadowOffset: 4, shadowBlur: 14,
});
export type GlassThicknessKey = keyof typeof THIN_GLASS;
const KEYS = Object.keys(THIN_GLASS) as GlassThicknessKey[];
export const THICK_GLASS: Readonly<Record<GlassThicknessKey, number>> = Object.freeze({
  refractionStrength: .11, chromaAmount: .55, specularStrength: .72, domeDepth: 58, blurStrength: 12,
  brightness: .015, glowStrength: .3, glowSpread: .72, edgeStrength: .36, edgeWidth: 1.6,
  tintStrength: .035, magnification: 1.38, shadowStrength: .11, shadowOffset: 18, shadowBlur: 26,
});
/** Over a dark host, thick glass keeps a little more light and a firmer edge. */
export const THICK_GLASS_DARK: Readonly<Record<GlassThicknessKey, number>> = Object.freeze({ ...THICK_GLASS, brightness: .035, glowStrength: .38, edgeStrength: .42 });
/** Dark hosts tint regular glass toward their own surface instead of white. */
export const DARK_GLASS_TINT = Object.freeze([74 / 255, 74 / 255, 70 / 255] as const);
const WHITE = Object.freeze([1, 1, 1] as const);
/** Clear glass keeps only the light frost that steadies fine detail it refracts. */
const CLEAR_FROST = .5;
// Lengths, in the canvas's own units.
const LENGTHS = new Set<GlassThicknessKey>(["domeDepth", "edgeWidth", "shadowOffset", "shadowBlur"]);

/**
 * iOS 27's lifted lens, a pressed tab or a held thumb, calibrated against native screenshots:
 * clear glass with no glow, tint or brightening and a thick rim, a fine dark contour, a white rim
 * line all the way round, and an outer slope that mirrors what lies inside it, gathering warm and
 * cool crescents at opposite ends. It is the interactive state of the same glass, drawn with the
 * `lens` refraction model; its rim line rides on edge strength, so the lower SDR highlight an HDR
 * display uses keeps it.
 */
export const LIFTED_GLASS = Object.freeze({
  refractionModel: "lens" as const, chromaAmount: 1.5, blurStrength: .7, specularStrength: 1, brightness: 0,
  glowStrength: 0, edgeStrength: .81, edgeWidth: 1.2, tintStrength: 0,
});

/**
 * How thick glass of this size reads, as Apple's thickens when it grows: 0 for a control
 * (a 48px short side or less), 1 for a panel (320px or more), eased between. CSS pixels.
 */
export function liquidThickness(width: number, height: number) {
  const thickness = Math.max(0, Math.min(1, (Math.min(width, height) - 48) / 272));
  return thickness * thickness * (3 - 2 * thickness);
}

/** Regular glass's frost at this size: a control's light frost, a panel's diffusion. CSS pixels. */
export function liquidSurfaceBlur(width: number, height: number) {
  const thickness = liquidThickness(width, height);
  return THIN_GLASS.blurStrength + (THICK_GLASS.blurStrength - THIN_GLASS.blurStrength) * thickness;
}

/** The rim's refracting band: a control's follows its short side, a panel's is fixed. Clear glass keeps a control's. */
export function glassEdgeDepth(shortSide: number, thickness: number, variant: GlassVariant = "regular") {
  const thin = Math.min(12, shortSide * .12);
  return variant === "clear" ? thin : thin + (26 - thin) * thickness;
}

/** The reach of the soft shadow at this thickness, for reserving canvas padding. */
export function glassShadowReach(thickness: number, overrides: { shadowBlur?: number; shadowOffset?: number } = {}) {
  const blur = overrides.shadowBlur ?? THIN_GLASS.shadowBlur + (THICK_GLASS.shadowBlur - THIN_GLASS.shadowBlur) * thickness;
  const offset = overrides.shadowOffset ?? THIN_GLASS.shadowOffset + (THICK_GLASS.shadowOffset - THIN_GLASS.shadowOffset) * thickness;
  return Math.ceil(Math.max(28, blur * 3 + Math.abs(offset)));
}

export interface GlassMaterialOptions {
  variant?: GlassVariant;
  /** Whether the host is dark; regular glass tints toward it. */
  dark?: boolean;
  /** Canvas units per CSS pixel. A canvas drawn smaller keeps a control's lengths in CSS pixels. */
  scale?: number;
}

/** One material value at a thickness (0 a control, 1 a panel). */
export function glassValue(key: GlassThicknessKey, thickness: number, { variant = "regular", dark = false, scale = 1 }: GlassMaterialOptions = {}) {
  if (variant === "clear" && key === "tintStrength") return 0;
  if (variant === "clear" && key === "magnification") return 1;
  const thick = dark && variant === "regular" ? THICK_GLASS_DARK : THICK_GLASS;
  const thin = LENGTHS.has(key) ? THIN_GLASS[key] / scale : THIN_GLASS[key];
  const value = thin + (thick[key] - thin) * Math.max(0, Math.min(1, thickness));
  return variant === "clear" && key === "blurStrength" ? Math.min(value, CLEAR_FROST) : value;
}

/** The glass material at a thickness (0 a control, 1 a panel), with its tint color. */
export function glassMaterial(thickness: number, options: GlassMaterialOptions = {}) {
  const material = {} as Record<GlassThicknessKey, number>;
  for (const key of KEYS) material[key] = glassValue(key, thickness, options);
  return { ...material, tintColor: options.variant !== "clear" && options.dark ? DARK_GLASS_TINT : WHITE };
}
export const GLASS_THICKNESS_KEYS: readonly GlassThicknessKey[] = KEYS;

/** Whether the host page is dark: data-theme="dark", or class="dark" (next-themes, shadcn). */
export function useHostDark() {
  return useSyncExternalStore(subscribeLiquidTheme, () => liquidHostTheme() === "dark", () => false);
}
