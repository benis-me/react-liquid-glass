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
> & { debug?: boolean };

const MaterialContext = createContext<GlassMaterial>({});

/** Optional optical overrides. An empty provider preserves each control's calibration. */
export function LiquidGlassProvider({
  material,
  children,
}: {
  material: GlassMaterial;
  children: ReactNode;
}) {
  const parent = useContext(MaterialContext);
  const value = useMemo(() => ({ ...parent, ...material }), [parent, material]);
  return (
    <MaterialContext.Provider value={value}>
      {children}
    </MaterialContext.Provider>
  );
}

export function useGlassMaterial() {
  return useContext(MaterialContext);
}
