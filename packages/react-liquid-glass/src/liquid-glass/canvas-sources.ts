import type { LiquidGlassSource } from "./render-frame";
// Canvas swapchain contents expire after presentation. The optical DOM adapter
// reads a retained SDR snapshot only when another surface actually needs it.
let transparent: HTMLCanvasElement | undefined;
export function transparentLiquidSource(): HTMLCanvasElement {
  if (!transparent) {
    transparent = document.createElement("canvas"); transparent.width = transparent.height = 1;
    transparent.getContext("2d");
  }
  return transparent;
}
const sources = new WeakMap<HTMLCanvasElement, () => HTMLCanvasElement>();
export function registerLiquidCanvas(canvas: HTMLCanvasElement, read: () => HTMLCanvasElement) {
  sources.set(canvas, read);
  return () => { sources.delete(canvas); };
}
export function readLiquidSource(source: LiquidGlassSource): LiquidGlassSource {
  const read = sources.get(source as HTMLCanvasElement);
  if (read) return read();
  // Never claim a pending output's context merely to read its empty first frame.
  if ((source as HTMLCanvasElement).dataset?.dgRenderer === "pending") return transparentLiquidSource();
  return source;
}
