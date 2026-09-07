import type { createWebGL2GlassRenderer } from "./webgl2-renderer";
import { readMotion } from "../shared/values";
import { LIQUID_GLASS_MATERIAL, type LiquidGlassFrame, type LiquidRendererStats } from "./render-frame";
import type { createWebGPUGlassRenderer } from "./webgpu-renderer";
import type { createHighlightHDR } from "./highlight-hdr";
export * from "./render-frame";
export { subscribeLiquidFrames } from "./frame-events";

export type GlassRendererBackend = "auto" | "webgpu" | "webgl2";
type ActualBackend = Exclude<GlassRendererBackend, "auto">;
type WebGLRenderer = ReturnType<typeof createWebGL2GlassRenderer>;
type WebGPURenderer = Awaited<ReturnType<typeof createWebGPUGlassRenderer>>;
type Highlight = Awaited<ReturnType<typeof createHighlightHDR>>;
export interface LiquidRendererOptions {
  backend?: GlassRendererBackend;
  /** WebGL2 fallback only: many small surfaces share a device and copy their output. */
  shared?: boolean;
  onReady?: () => void;
  onRestore?: () => void;
  /** React hosts remount their canvas when its GPU context cannot be reused. */
  onFallback?: (error: Error) => void;
  onError?: (error: Error) => void;
}
export interface LiquidGlassRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly backend: ActualBackend | "pending" | "unavailable";
  readonly ready: Promise<ActualBackend | null>;
  readonly error: Error | undefined;
  readonly context: WebGL2RenderingContext | GPUCanvasContext | null;
  readonly stats: LiquidRendererStats;
  /** Queues the latest frame while the backend initializes; false means it is not presented yet. */
  draw(frame: LiquidGlassFrame): boolean;
  suspend(): void;
  dispose(): void;
}

/** WebGPU first. The WebGL2 implementation stays available for explicit use and recovery. */
export function createLiquidGlassRenderer(initialCanvas: HTMLCanvasElement, options: LiquidRendererOptions = {}): LiquidGlassRenderer {
  let canvas = initialCanvas, backend: LiquidGlassRenderer["backend"] = "pending";
  let engine: WebGLRenderer | WebGPURenderer | undefined, error: Error | undefined;
  let disposed = false, suspended = false, lastFrame: LiquidGlassFrame | undefined;
  let recovery: Promise<void> | undefined;
  let hdr: Highlight = null, requestedHDR = false;
  let dynamicRange: MediaQueryList | undefined, stopContextLoss = () => {};
  const emptyStats = { draws: 0, emissionDraws: 0, sourceUploads: 0, contentUploads: 0 };
  const mark = () => { if (canvas.dataset) { canvas.dataset.dgRenderer = backend === "pending" || backend === "unavailable" ? backend : `liquid-${backend}`; if (error) canvas.dataset.dgRendererFallback = error.message; } };
  const unavailable = (reason: Error) => { error = reason; backend = "unavailable"; mark(); options.onError?.(reason); };
  const webgl = async () => {
    const { createWebGL2GlassRenderer } = await import("./webgl2-renderer");
    if (disposed) return false;
    engine = createWebGL2GlassRenderer(canvas, { shared: options.shared, onRestore: options.onRestore });
    dynamicRange = typeof matchMedia === "function" ? matchMedia("(dynamic-range: high)") : undefined;
    const target = engine.context.canvas, lost = () => hdr?.hide();
    target.addEventListener("webglcontextlost", lost);
    stopContextLoss = () => target.removeEventListener("webglcontextlost", lost);
    backend = "webgl2"; mark();
    return true;
  };
  // A validation event and an initialization rejection can report the same loss.
  // Share their recovery, including the ready promise, rather than replacing twice.
  const fallback = (reason: Error, locked: boolean) => recovery ??= (async () => {
    if (disposed) return;
    error = reason; engine?.dispose(); engine = undefined;
    if (options.backend === "webgpu") { unavailable(reason); return; }
    if (locked) {
      if (options.onFallback) { backend = "unavailable"; mark(); options.onFallback(reason); return; }
      // A canvas cannot change context type. Imperative users follow renderer.canvas
      // after recovery; React hosts instead remount through onFallback above.
      const next = document.createElement("canvas");
      for (const attribute of Array.from(canvas.attributes)) next.setAttribute(attribute.name, attribute.value);
      next.width = canvas.width; next.height = canvas.height;
      canvas.replaceWith(next); canvas = next;
    }
    backend = "pending"; mark();
    try { if (!await webgl() || disposed) return; if (lastFrame && !suspended) draw(lastFrame); options.onReady?.(); }
    catch (failure) { unavailable(failure instanceof Error ? failure : new Error(String(failure))); }
  })();
  function draw(frame: LiquidGlassFrame) {
    if (disposed) return false;
    suspended = false; lastFrame = frame;
    if (!engine) return false;
    if (backend === "webgpu") {
      return (engine as WebGPURenderer).draw(frame);
    }
    const lit = (readMotion(frame.specularStrength ?? LIQUID_GLASS_MATERIAL.specularStrength) * (frame.edgeStrength ?? LIQUID_GLASS_MATERIAL.edgeStrength) > .001 || frame.blobs.some(blob => readMotion(blob.contactStrength ?? 0) > .001))
      && readMotion(frame.tintStrength ?? 0) < .999 && readMotion(frame.opacity ?? 1) > .001;
    const highRange = frame.hdr !== false && !frame.debug && lit && dynamicRange?.matches && !(engine as WebGLRenderer).context.isContextLost();
    if (highRange && !requestedHDR) {
      requestedHDR = true;
      void import("./highlight-hdr").then(module => module.createHighlightHDR(canvas)).then(next => {
        if (disposed) next?.dispose(); else { hdr = next; if (next && lastFrame && !suspended) draw(lastFrame); }
      }).catch(() => { /* HDR is optional; retain the SDR material. */ });
    }
    if (highRange) hdr?.show(); else hdr?.hide();
    return (engine as WebGLRenderer).draw(frame, highRange && hdr ? hdr.draw : undefined);
  }
  const useGPU = options.backend !== "webgl2" && typeof navigator !== "undefined" && !!navigator.gpu;
  let ready: Promise<ActualBackend | null>;
  if (!useGPU) {
    if (options.backend === "webgpu") { unavailable(new Error("WebGPU unavailable")); ready = Promise.resolve(null); }
    else {
      mark(); ready = webgl().then(ok => {
        if (!ok || disposed) return null;
        if (lastFrame && !suspended) draw(lastFrame);
        options.onReady?.(); return "webgl2" as const;
      }).catch(async reason => { if (!disposed) unavailable(reason instanceof Error ? reason : new Error(String(reason))); return null; });
    }
  } else {
    mark();
    let locked = false, failed = false;
    ready = import("./webgpu-renderer").then(async module => {
      if (disposed) return null;
      const gpu = await module.createWebGPUGlassRenderer(canvas, reason => { failed = true; void fallback(reason, locked); }, () => { locked = true; });
      if (disposed || failed) { gpu.dispose(); return null; }
      engine = gpu; backend = "webgpu"; mark();
      if (lastFrame && !suspended) draw(lastFrame);
      options.onReady?.(); return "webgpu" as const;
    }).catch(async reason => {
      // Shader/device initialization happens before acquiring the canvas context.
      // If context setup itself failed, recreating it is the only legal fallback.
      await fallback(reason instanceof Error ? reason : new Error(String(reason)), locked);
      return backend === "webgl2" ? "webgl2" : null;
    });
  }
  return {
    get canvas() { return canvas; }, get backend() { return backend; }, ready,
    get error() { return error; }, get context() { return engine?.context ?? null; },
    get stats() { return engine?.stats ?? emptyStats; }, draw,
    suspend() { suspended = true; lastFrame = undefined; if (engine && "suspend" in engine) engine.suspend(); hdr?.hide(); },
    dispose() { if (disposed) return; disposed = true; lastFrame = undefined; stopContextLoss(); hdr?.dispose(); engine?.dispose(); },
  };
}
