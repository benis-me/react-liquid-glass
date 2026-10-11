import type { GlassRendererBackend } from "./renderer.js";
import type { LiquidLightSource } from "./light.js";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { isMotionValue } from "../shared/values.js";

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
    | "lensMagnification"
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
  debug?: boolean; hdr?: boolean; lightSource?: LiquidLightSource;
  /** Publish `data-dg-tone="light" | "dark"` on surfaces from their backdrop luminance. Off by default. */
  tone?: boolean;
};

/** Clear, chromatic UI glass. Large surfaces supply their own frost. */
export const PRISM_MATERIAL = {
  blurStrength: .2, chromaAmount: 1.2, refractionStrength: .2,
  specularStrength: .9, tintStrength: .02,
} as const satisfies GlassMaterial;

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
 * The provider's material, plus the HDR highlight default when HDR is enabled and the display
 * supports it. Glass applies these above its own values (see resolveGlassMaterial).
 */
export function useGlassMaterial(hdr?: boolean): GlassMaterial {
  const material = useContext(MaterialContext);
  const displayHDR = useDisplayHDR();
  // An instance `hdr` flag wins over the provider's, including for the HDR highlight default.
  const highlight = (hdr ?? material.hdr) !== false && displayHDR;
  return useMemo(() => ({
    ...(highlight ? { specularStrength: HDR_SPECULAR_STRENGTH } : {}),
    ...material,
  }), [material, highlight]);
}

/**
 * One precedence rule for every glass: its own values, then the provider's material above them.
 * A provider constant replaces a value the glass sets as a constant, never one it animates (a
 * MotionValue), so lifting lenses, morphs and fusion necks keep moving under any material.
 * Glass fills what neither sets from its size (see glassMaterial).
 */
export function resolveGlassMaterial<T extends object>(instance: T, overrides: GlassMaterial): T {
  const merged = { ...instance } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) if (value !== undefined && !isMotionValue(merged[key])) merged[key] = value;
  return merged as T;
}
