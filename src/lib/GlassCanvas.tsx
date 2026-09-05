import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { LiquidGlassCanvas } from "./LiquidGlassCanvas";
import { LIQUID_LENS } from "./LiquidGlass";
import { motionValue } from "./motion";
import type { LensParams } from "./types";

export interface GlassCanvasProps {
  sourceRef: RefObject<HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | null>;
  width: number;
  height: number;
  lens: Partial<LensParams>;
  x?: number;
  y?: number;
  active?: number | boolean;
  transparentOutside?: boolean;
  sourceRevision?: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}


/** Compatibility geometry adapter; all optics now come from the Liquid foundation. */
export function GlassCanvas({
  sourceRef, width, height, lens: inputLens, x = .5, y = .5, active = true,
  transparentOutside = false, sourceRevision = 0, className, style, ariaLabel = "Refracted canvas",
}: GlassCanvasProps) {
  const revision = useRef(motionValue(0)).current;
  useEffect(() => { revision.set(revision.get() + 1); }, [sourceRevision, revision]);
  useEffect(() => {
    const video = sourceRef.current;
    if (!(video instanceof HTMLVideoElement)) return;
    let handle = 0, fallback = 0, disposed = false;
    const cancel = () => { video.cancelVideoFrameCallback?.(handle); cancelAnimationFrame(fallback); handle = fallback = 0; };
    const schedule = () => {
      if (disposed || document.hidden || video.paused || handle || fallback) return;
      const tick = () => { handle = fallback = 0; revision.set(revision.get() + 1); schedule(); };
      if (video.requestVideoFrameCallback) handle = video.requestVideoFrameCallback(tick);
      else fallback = requestAnimationFrame(tick);
    };
    const seeked = () => { revision.set(revision.get() + 1); schedule(); };
    const visibility = () => { if (document.hidden) cancel(); else schedule(); };
    video.addEventListener("play", schedule); video.addEventListener("pause", cancel);
    video.addEventListener("seeked", seeked); video.addEventListener("loadeddata", seeked);
    document.addEventListener("visibilitychange", visibility);
    schedule();
    return () => {
      disposed = true; cancel();
      video.removeEventListener("play", schedule); video.removeEventListener("pause", cancel);
      video.removeEventListener("seeked", seeked); video.removeEventListener("loadeddata", seeked);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [sourceRef, revision]);
  const lens = { lensW: 80, lensH: 80, borderRadius: 80, ...LIQUID_LENS, ...inputLens };
  const strength = typeof active === "boolean" ? Number(active) : active;
  const scale = Math.max(Math.abs(lens.scaleX ?? .11), Math.abs(lens.scaleY ?? .11));
  return <LiquidGlassCanvas sourceRef={sourceRef} sourceRevision={revision} width={width} height={height}
    blobs={strength > .001 ? [{ x, y, radius: lens.borderRadius, halfWidth: lens.lensW, halfHeight: lens.lensH }] : []}
    opacity={strength} mergeDistance={0} refractionStrength={scale}
    refractionRatio={scale ? [(lens.scaleX ?? scale) / scale, (lens.scaleY ?? scale) / scale] : [1, 1]}
    chromaAmount={lens.chromaAmount} specularStrength={lens.specularStrength} blurStrength={lens.blurAmount}
    edgeDepth={lens.depth} domeDepth={lens.domeDepth} brightness={lens.brightness}
    specularRotation={lens.specularRotation} glowStrength={lens.glowStrength}
    glowSpread={lens.glowSpread} glowExponent={lens.glowExponent}
    edgeStrength={lens.edgeStrength} edgeWidth={lens.edgeWidth} edgeExponent={lens.edgeExponent}
    tintStrength={lens.tint} transparentOutside={transparentOutside}
    className={className} style={style} ariaLabel={ariaLabel} />;
}
