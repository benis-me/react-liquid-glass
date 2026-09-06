import { useCallback, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { cancelFrame, frame } from "motion";
import { isMotionValue, readMotion, type MotionInput } from "../shared/values";
import { createLiquidGlassRenderer, type LiquidGlassFrame, type LiquidGlassSource } from "./renderer";
import { useGlassMaterial } from "./provider";

export type { LiquidGlassBlob } from "./renderer";
export interface LiquidGlassCanvasProps extends Omit<LiquidGlassFrame, "source" | "content" | "sourceRevision" | "contentRevision"> {
  sourceRef: RefObject<LiquidGlassSource | null>;
  contentRef?: RefObject<HTMLCanvasElement | null>;
  sourceRevision?: MotionInput;
  contentRevision?: MotionInput;
  /** Share a context for many small surfaces; direct media rendering avoids copies. */
  shared?: boolean;
  /** Interaction adapters resolve the provider before composing their live state. */
  inheritMaterial?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function LiquidGlassCanvas(props: LiquidGlassCanvasProps) {
  const material = useGlassMaterial();
  props = props.inheritMaterial === false ? props : { ...props, ...material };
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
    try { renderer = createLiquidGlassRenderer(canvas, { shared: props.shared, onRestore: scheduleDraw }); }
    catch (error) { canvas.dataset.dgRenderer = "unavailable"; console.error(error); return; }
    canvas.dataset.dgRenderer = "liquid-webgl2";
    let visible = false;
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
      if (visible) scheduleDraw(); else cancelFrame(drawFrame);
    }, { rootMargin: "80px 0px" });
    observer.observe(canvas);
    const visibility = () => { if (document.hidden) cancelFrame(drawFrame); else scheduleDraw(); };
    document.addEventListener("visibilitychange", visibility);
    const glCanvas = renderer.context.canvas;
    const lost = (event: Event) => { event.preventDefault(); cancelFrame(drawFrame); };
    glCanvas.addEventListener("webglcontextlost", lost);
    return () => {
      cancelFrame(drawFrame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      glCanvas.removeEventListener("webglcontextlost", lost);
      drawRef.current = () => undefined;
      renderer.dispose();
    };
  }, [props.shared, drawFrame, scheduleDraw]);

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

  return <canvas ref={canvasRef} className={props.className} style={props.style}
    role="img" aria-label={props.ariaLabel ?? "Liquid glass surface"} />;
}
