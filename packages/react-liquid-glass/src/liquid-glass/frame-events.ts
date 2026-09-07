import type { LiquidFrameRegion } from "./render-frame";

const frameListeners = new Set<(canvas: HTMLCanvasElement, regions: readonly LiquidFrameRegion[]) => void>();
export function subscribeLiquidFrames(listener: (canvas: HTMLCanvasElement, regions: readonly LiquidFrameRegion[]) => void) {
  frameListeners.add(listener);
  return () => { frameListeners.delete(listener); };
}
export function notifyLiquidFrame(canvas: HTMLCanvasElement, regions: readonly LiquidFrameRegion[]) {
  for (const listener of frameListeners) listener(canvas, regions);
}
