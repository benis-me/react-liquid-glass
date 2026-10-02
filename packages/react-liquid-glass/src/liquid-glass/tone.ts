import { useCallback, useEffect, useRef, type RefObject } from "react";
import { createLiquidToneTracker } from "./backdrop.js";

type Region = { left: number; top: number; width: number; height: number };

/**
 * Publishes `data-dg-tone` on the element while `enabled` (the `tone` material
 * flag). The returned recorder is stable; with tone off it only keeps the latest
 * backdrop, so enabling tone later reads it at once. Disabling removes the attribute.
 */
export function useLiquidToneTracker(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const latest = useRef<[HTMLCanvasElement, Region | undefined] | undefined>(undefined);
  const tracker = useRef<ReturnType<typeof createLiquidToneTracker> | undefined>(undefined);
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const current = createLiquidToneTracker(element);
    tracker.current = current;
    if (latest.current) current.update(...latest.current);
    return () => { current.dispose(); tracker.current = undefined; delete element.dataset.dgTone; };
  }, [enabled, ref]);
  return useCallback((canvas: HTMLCanvasElement, region?: Region) => {
    latest.current = [canvas, region];
    tracker.current?.update(canvas, region);
  }, []);
}
