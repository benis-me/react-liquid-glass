import { useCallback, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { cancelFrame, frame } from "motion";
import { isMotionValue, readMotion, type MotionInput } from "../shared/values";
import { createLiquidGlassRenderer, type GlassRendererBackend, type LiquidGlassFrame, type LiquidGlassSource } from "./renderer";
import { useGlassMaterial } from "./provider";
import { useRendererBackend } from "./use-renderer-backend";

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
  className?: string;
  style?: CSSProperties;
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
  const drawFrame = useCallback(() => drawRef.current(), []);
  const scheduleDraw = useCallback(() => frame.render(drawFrame), [drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: ReturnType<typeof createLiquidGlassRenderer>;
    try { renderer = createLiquidGlassRenderer(canvas, { backend, shared: props.shared, onReady: scheduleDraw, onRestore: scheduleDraw, onFallback }); }
    catch (error) { canvas.dataset.dgRenderer = "unavailable"; console.error(error); return; }
    let visible = false;
    const dynamicRange = matchMedia("(dynamic-range: high)");
    const draw = () => {
      const p = config.current;
      const source = p.sourceRef.current;
      if (!visible || document.hidden || !source) return;
      renderer.draw({
        ...p, source, content: p.contentRef?.current,
        sourceRevision: readMotion(p.sourceRevision ?? 0),
        contentRevision: readMotion(p.contentRevision ?? 0),
        pixelRatio: Math.min(2, p.pixelRatio ?? window.devicePixelRatio ?? 1),
      });
    };
    drawRef.current = draw;
    // Keep the first draw lazy. Dozens of offscreen experiment controls do no GPU work.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
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
    role="img" aria-label={props.ariaLabel ?? "Liquid glass surface"} />;
}
