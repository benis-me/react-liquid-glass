import type { GlassRendererBackend } from "./renderer";
import type { LiquidLightSource } from "./light";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type GlassMaterial = Partial<
  Record<
    | "refractionStrength"
    | "chromaAmount"
    | "blurStrength"
    | "edgeDepth"
    | "domeDepth"
    | "specularStrength"
    | "specularRotation"
    | "glowStrength"
    | "edgeStrength"
    | "tintStrength"
    | "magnification"
    | "brightness"
    | "glowSpread"
    | "glowExponent"
    | "edgeWidth"
    | "edgeExponent"
    | "shadowStrength"
    | "shadowOffset"
    | "shadowBlur"
    | "pixelRatio"
    | "mergeDistance",
    number
  >
> & {
  debug?: boolean; hdr?: boolean; refractionModel?: "dome" | "bevel"; lightSource?: LiquidLightSource;
  /** Publish `data-dg-tone="light" | "dark"` on surfaces from their backdrop luminance. Off by default. */
  tone?: boolean;
};

/** Clear, chromatic UI glass. Large surfaces supply their own frost. */
export const PRISM_MATERIAL = {
  blurStrength: .2, chromaAmount: 1.2, refractionStrength: .2,
  specularStrength: .9, tintStrength: .02,
} as const satisfies GlassMaterial;

/**
 * Shared defaults for ordinary glass. Calibrated lenses (Switch/Slider thumbs,
 * Tabs, Spotlight, the Morph Menu) keep their own dispersion and dome depth.
 */
export const DEFAULT_MATERIAL = { chromaAmount: .33, domeDepth: 28 } as const satisfies GlassMaterial;

/** SDR base highlight while the HDR presenter lifts reflections above SDR white. */
export const HDR_SPECULAR_STRENGTH = .48;

const BackendContext = createContext<GlassRendererBackend>("auto");
export const useGlassBackend = () => useContext(BackendContext);

const MaterialContext = createContext<GlassMaterial>({});
/** Whether surfaces below publish `data-dg-tone`. */
export const useGlassTone = () => useContext(MaterialContext).tone === true;

/** Optional optical overrides, inherited through nested providers. */
export function LiquidGlassProvider({
  material,
  backend,
  inherit = true,
  children,
}: {
  material: GlassMaterial;
  backend?: GlassRendererBackend;
  /** `false` ignores parent optical overrides; the parent's `hdr` preference still applies. */
  inherit?: boolean;
  children: ReactNode;
}) {
  const parent = useContext(MaterialContext);
  const parentBackend = useContext(BackendContext);
  const value = useMemo(() => inherit
    ? { ...parent, ...material }
    : { ...(parent.hdr === undefined ? {} : { hdr: parent.hdr }), ...material }, [parent, material, inherit]);
  return (
    <BackendContext.Provider value={backend ?? parentBackend}>
    <MaterialContext.Provider value={value}>
      {children}
    </MaterialContext.Provider>
    </BackendContext.Provider>
  );
}

// Read the query on demand so display changes and test emulation are never stale.
const HIGH_RANGE = "(dynamic-range: high)";
const readDisplayHDR = () => typeof matchMedia === "function" && matchMedia(HIGH_RANGE).matches;
function subscribeDisplayHDR(notify: () => void) {
  if (typeof matchMedia !== "function") return () => undefined;
  const query = matchMedia(HIGH_RANGE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

/** Whether the current display reports high dynamic range. */
export function useDisplayHDR() {
  return useSyncExternalStore(subscribeDisplayHDR, readDisplayHDR, () => false);
}

/**
 * Explicit provider overrides, plus the HDR highlight default when HDR is enabled
 * and the display supports it. Calibrated components apply these above their own
 * values; they intentionally omit the shared ordinary-glass defaults.
 */
export function useGlassMaterialOverrides(): GlassMaterial {
  const material = useContext(MaterialContext);
  const displayHDR = useDisplayHDR();
  return useMemo(() => ({
    ...(material.hdr !== false && displayHDR ? { specularStrength: HDR_SPECULAR_STRENGTH } : {}),
    ...material,
  }), [material, displayHDR]);
}

/** Ordinary glass: shared defaults beneath the explicit overrides above. */
export function useGlassMaterial(): GlassMaterial {
  const overrides = useGlassMaterialOverrides();
  return useMemo(() => ({ ...DEFAULT_MATERIAL, ...overrides }), [overrides]);
}
