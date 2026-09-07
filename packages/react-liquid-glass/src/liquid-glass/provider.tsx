import type { GlassRendererBackend } from "./renderer";
import { createContext, useContext, useMemo, type ReactNode } from "react";

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
> & { debug?: boolean; hdr?: boolean };

/** Clear, chromatic UI glass. Large surfaces supply their own frost. */
export const PRISM_MATERIAL = {
  blurStrength: .2, chromaAmount: 1.2, refractionStrength: .2,
  specularStrength: .9, tintStrength: .02,
} as const satisfies GlassMaterial;

/** Shared defaults; individual controls retain their own frost and edge calibration. */
export const DEFAULT_MATERIAL = { chromaAmount: .33, domeDepth: 28 } as const satisfies GlassMaterial;

const BackendContext = createContext<GlassRendererBackend>("auto");
export const useGlassBackend = () => useContext(BackendContext);

const MaterialContext = createContext<GlassMaterial>({});

/** Optional optical overrides, inherited through nested providers. */
export function LiquidGlassProvider({
  material,
  backend,
  children,
}: {
  material: GlassMaterial;
  backend?: GlassRendererBackend;
  children: ReactNode;
}) {
  const parent = useContext(MaterialContext);
  const parentBackend = useContext(BackendContext);
  const value = useMemo(() => ({ ...parent, ...material }), [parent, material]);
  return (
    <BackendContext.Provider value={backend ?? parentBackend}>
    <MaterialContext.Provider value={value}>
      {children}
    </MaterialContext.Provider>
    </BackendContext.Provider>
  );
}

export function useGlassMaterial(): GlassMaterial {
  const material = useContext(MaterialContext);
  return useMemo(() => ({
    ...DEFAULT_MATERIAL,
    ...(material.hdr !== false ? { specularStrength: .48 } : {}),
    ...material,
  }), [material]);
}
