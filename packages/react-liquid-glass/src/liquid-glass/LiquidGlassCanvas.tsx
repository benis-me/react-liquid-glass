import { useCallback, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { cancelFrame, frame } from "motion";
import { isMotionValue, readMotion, type MotionInput } from "../shared/values";
import { createLiquidGlassRenderer, type GlassRendererBackend, type LiquidGlassFrame, type LiquidGlassSource } from "./renderer";
import { useGlassMaterial } from "./provider";
import { useRendererBackend } from "./use-renderer-backend";
import { readLiquidLightAngle, subscribeLiquidLight, useReducedMotionPreference, type LiquidLightSource } from "./light";

export type { LiquidGlassBlob } from "./renderer";
export interface LiquidGlassCanvasProps extends Omit<LiquidGlassFrame, "source" | "content" | "sourceRevision" | "contentRevision"> {
  sourceRef: RefObject<LiquidGlassSource | null>;
  contentRef?: RefObject<HTMLCanvasElement | null>;
  sourceRevision?: MotionInput;
  contentRevision?: MotionInput;
  /** Share a context for many small surfaces; direct media rendering avoids copies. */
  shared?: boolean;
  backend?: GlassRendererBackend;
  /** Interaction adapters resolve the provider before composing their live state. */
  inheritMaterial?: boolean;
  /** Enable extended highlights on supported HDR displays. Default: true. */
  hdr?: boolean;
  /**
   * Highlight direction: `fixed` uses `specularRotation` (default); `pointer`
   * follows a mouse or pen; `device` follows orientation events where the
   * platform grants them. Reduced motion keeps the fixed light.
   */
  lightSource?: LiquidLightSource;
  className?: string;
  style?: CSSProperties;
  /** Describes a meaningful canvas as an image; without it the glass is decorative and hidden from assistive tech. */
  ariaLabel?: string;
}

export function LiquidGlassCanvas(props: LiquidGlassCanvasProps) {
  const material = useGlassMaterial();
  const { requested, backend, fallback, onFallback } = useRendererBackend(props.backend);
  props = props.inheritMaterial === false ? props : { ...props, ...material, hdr: props.hdr ?? material.hdr };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = useRef(props);
  config.current = props;
  const drawRef = useRef<() => void>(() => undefined);
  const lightAngle = useRef<number | undefined>(undefined);
  const drawFrame = useCallback(() => drawRef.current(), []);
  const scheduleDraw = useCallback(() => frame.render(drawFrame), [drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: ReturnType<typeof createLiquidGlassRenderer>;
    try { renderer = createLiquidGlassRenderer(canvas, { backend, shared: props.shared, onReady: scheduleDraw, onRestore: scheduleDraw, onFallback }); }
    catch (error) { canvas.dataset.dgRenderer = "unavailable"; console.error(error); return; }
    let visible = false, unrendered = false;
    const dynamicRange = matchMedia("(dynamic-range: high)");
    const draw = () => {
      const p = config.current;
      const source = p.sourceRef.current;
      // Chromium does not report a canvas again after it was moved while not
      // rendered, such as into a popover before it opens; observe it afresh.
      if (unrendered && !document.hidden) { unrendered = false; observer.unobserve(canvas); observer.observe(canvas); }
      if (!visible || document.hidden || !source) return;
      renderer.draw({
        ...p, source, content: p.contentRef?.current,
        specularRotation: lightAngle.current ?? p.specularRotation,
        sourceRevision: readMotion(p.sourceRevision ?? 0),
        contentRevision: readMotion(p.contentRevision ?? 0),
        pixelRatio: Math.min(2, p.pixelRatio ?? window.devicePixelRatio ?? 1),
      });
    };
    drawRef.current = draw;
    // Keep the first draw lazy. Dozens of offscreen experiment controls do no GPU work.
    const observer = new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1];
      visible = entry.isIntersecting;
      // An empty box means display: none or detached, not merely offscreen.
      unrendered = !visible && !entry.boundingClientRect.width && !entry.boundingClientRect.height;
      if (visible) scheduleDraw(); else { cancelFrame(drawFrame); renderer.suspend(); }
    }, { rootMargin: "80px 0px" });
    observer.observe(canvas);
    const visibility = () => { if (document.hidden) { cancelFrame(drawFrame); renderer.suspend(); } else scheduleDraw(); };
    document.addEventListener("visibilitychange", visibility);
    dynamicRange.addEventListener("change", scheduleDraw);
    return () => {
      cancelFrame(drawFrame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      dynamicRange.removeEventListener("change", scheduleDraw);
      drawRef.current = () => undefined;
      renderer.dispose();
    };
  }, [backend, props.shared, drawFrame, scheduleDraw, onFallback]);

  const lightSource = props.lightSource ?? "fixed";
  const reduceMotion = useReducedMotionPreference();
  useEffect(() => {
    lightAngle.current = undefined;
    if (lightSource === "fixed" || reduceMotion) return;
    const stop = subscribeLiquidLight(lightSource, () => {
      // Read the live canvas: a backend or sharing change remounts it.
      const canvas = canvasRef.current;
      if (!canvas?.isConnected) return;
      const angle = readLiquidLightAngle(lightSource, canvas.getBoundingClientRect());
      if (angle === undefined || Math.abs(angle - (lightAngle.current ?? Infinity)) < .5) return;
      lightAngle.current = angle;
      scheduleDraw();
    });
    return () => { stop(); lightAngle.current = undefined; scheduleDraw(); };
  }, [lightSource, reduceMotion, scheduleDraw]);

  useEffect(() => {
    const values = new Set<unknown>([
      ...Object.values(props),
      ...props.blobs.flatMap(blob => Object.values(blob)),
    ]);
    const stops: Array<() => void> = [];
    for (const value of values) if (isMotionValue(value)) stops.push(value.on("change", scheduleDraw));
    scheduleDraw();
    return () => stops.forEach(stop => stop());
  }, [props, scheduleDraw]);

  return <canvas key={`${requested}:${backend}:${Boolean(props.shared)}`} ref={canvasRef} data-dg-renderer-fallback={fallback?.message} className={props.className} style={props.style}
    role={props.ariaLabel ? "img" : undefined} aria-label={props.ariaLabel} aria-hidden={props.ariaLabel ? undefined : true} />;
}
