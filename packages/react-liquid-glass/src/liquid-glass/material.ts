import { useSyncExternalStore } from "react";
import { liquidHostTheme, subscribeLiquidTheme } from "./source.js";
import { readMotion, type MotionInput } from "../shared/values.js";

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

/** How far a surface's canvas reaches past its box: the visible shadow of glass this thick, at least 40px. */
export function glassCanvasReach(thickness: number) {
  return Math.max(40, Math.ceil(glassValue("shadowBlur", thickness) * 2.5 + glassValue("shadowOffset", thickness)));
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

/**
 * Glass in Apple's terms. Everything else follows from these and the glass's size: pick a variant,
 * then move clarity between more tinted (more legible) and more clear, as Apple's Liquid Glass
 * setting does, and tint glass that marks a prominent action.
 */
export interface GlassLook {
  /** `regular` (default) frosted UI glass, or `clear` glass for media. */
  variant?: GlassVariant;
  /** From -1, more tinted and frosted, through 0 (the calibrated default), to 1, more clear. */
  clarity?: number;
  /** A CSS color the glass takes on, as Apple's tinted glass does for a prominent action. */
  tint?: string;
}
/** How far the most tinted glass mixes toward its tint: still glass, but legible over anything. */
const MOST_TINTED = .36;
/** How strongly tinted glass shows its color. */
export const TINTED_GLASS = .42;
/** Frost doubles a little more than once from 0 clarity to -1, and falls as much toward 1. */
const CLARITY_FROST = 1.2;

export interface GlassPerception {
  variant?: GlassVariant;
  clarity?: number;
  /** The tint color as 0-1 RGB, like tintColor. */
  tint?: readonly [number, number, number];
  /** Whether the reader asked for more contrast. */
  contrast?: boolean;
}
/**
 * The glass's look applied to its resolved material values, in place: the variant, the clarity, a
 * tint and the reader's contrast preference. The lifted lens keeps its own calibration, and an
 * opaque fill (a resting thumb's white) is not glass to clear or tint.
 */
export function perceiveGlass(values: Record<string, unknown>, { variant = "regular", clarity = 0, tint, contrast = false }: GlassPerception) {
  if (values.refractionModel === "lens" || (variant === "regular" && !clarity && !tint && !contrast)) return values;
  const read = (key: string, fallback: number) => { const value = readMotion((values[key] ?? fallback) as MotionInput); return Number.isFinite(value) ? value : fallback; };
  let blur = read("blurStrength", THIN_GLASS.blurStrength), strength = read("tintStrength", THIN_GLASS.tintStrength);
  if (strength >= .999) return values;
  if (variant === "clear") {
    blur = Math.min(blur, CLEAR_FROST);
    strength = 0;
    values.magnification = 1;
  }
  const c = Math.max(-1, Math.min(1, clarity - (contrast ? 1 : 0)));
  if (c) {
    blur *= 2 ** (-CLARITY_FROST * c);
    strength = c < 0 ? strength + Math.max(0, MOST_TINTED - strength) * -c : strength * (1 - c);
  }
  // Tinted glass keeps its color however clear the rest: it marks a prominent action.
  if (tint) {
    values.tintColor = tint;
    strength = Math.max(strength, TINTED_GLASS);
  }
  // More contrast firms up the edge that defines the glass.
  if (contrast) values.edgeStrength = Math.min(1, read("edgeStrength", THIN_GLASS.edgeStrength) * 1.6);
  values.blurStrength = blur;
  values.tintStrength = strength;
  return values;
}

const subscribeQuery = (query: string) => (notify: () => void) => {
  if (typeof matchMedia !== "function") return () => undefined;
  const list = matchMedia(query);
  list.addEventListener("change", notify);
  return () => list.removeEventListener("change", notify);
};
const readQuery = (query: string) => () => typeof matchMedia === "function" && matchMedia(query).matches;
const REDUCED_TRANSPARENCY = "(prefers-reduced-transparency: reduce)", MORE_CONTRAST = "(prefers-contrast: more)";
const subscribeTransparency = subscribeQuery(REDUCED_TRANSPARENCY), readTransparency = readQuery(REDUCED_TRANSPARENCY);
const subscribeContrast = subscribeQuery(MORE_CONTRAST), readContrast = readQuery(MORE_CONTRAST);
/**
 * The reader's live display preferences, as Apple's glass honors them: reduced transparency makes
 * glass its most tinted and frosted, and increased contrast does too and firms its edge.
 */
export function useGlassAccessibility() {
  const reduceTransparency = useSyncExternalStore(subscribeTransparency, readTransparency, () => false);
  const contrast = useSyncExternalStore(subscribeContrast, readContrast, () => false);
  return { reduceTransparency, contrast };
}

/** Whether the host page is dark: data-theme="dark", or class="dark" (next-themes, shadcn). */
export function useHostDark() {
  return useSyncExternalStore(subscribeLiquidTheme, () => liquidHostTheme() === "dark", () => false);
}
