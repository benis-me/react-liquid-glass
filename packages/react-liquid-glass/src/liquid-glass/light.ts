import { useSyncExternalStore } from "react";
import { frame } from "motion";

export type LiquidLightSource = "fixed" | "pointer" | "device";

// One pair of global listeners serves every surface, and notifications are
// batched into Motion's read phase so each surface measures once per frame.
let pointer: { x: number; y: number } | undefined;
let tilt: { x: number; y: number } | undefined;
const listeners = { pointer: new Set<() => void>(), device: new Set<() => void>() };
const queued = { pointer: false, device: false };
const notify = (source: "pointer" | "device") => {
  if (queued[source]) return;
  queued[source] = true;
  frame.read(() => { queued[source] = false; listeners[source].forEach(listener => listener()); });
};
const onPointer = (event: PointerEvent) => {
  // Touch has no hover position; its light stays where the last pointer left it.
  if (event.pointerType === "touch") return;
  pointer = { x: event.clientX, y: event.clientY };
  notify("pointer");
};
const onOrientation = (event: DeviceOrientationEvent) => {
  if (event.beta === null || event.gamma === null) return;
  // Relative to a phone held at a natural reading angle; the scene light stays
  // put while the device turns, so reflections move against the tilt.
  tilt = { x: -event.gamma / 45, y: (event.beta - 40) / 45 };
  notify("device");
};

export function subscribeLiquidLight(source: "pointer" | "device", listener: () => void) {
  const set = listeners[source];
  if (!set.size) {
    if (source === "pointer") window.addEventListener("pointermove", onPointer, { passive: true });
    else window.addEventListener("deviceorientation", onOrientation);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size) return;
    if (source === "pointer") window.removeEventListener("pointermove", onPointer);
    else window.removeEventListener("deviceorientation", onOrientation);
  };
}

/**
 * Highlight axis in degrees for `specularRotation`, or undefined before the
 * first event. Uses the rim light's y-up convention.
 */
export function readLiquidLightAngle(source: "pointer" | "device", rect: DOMRect) {
  const vector = source === "pointer"
    ? pointer && { x: pointer.x - (rect.left + rect.width / 2), y: pointer.y - (rect.top + rect.height / 2) }
    : tilt;
  if (!vector || Math.hypot(vector.x, vector.y) < 1e-3) return undefined;
  return Math.atan2(-vector.y, vector.x) * 180 / Math.PI;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (notify: () => void) => {
  if (typeof matchMedia !== "function") return () => undefined;
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const readReducedMotion = () => typeof matchMedia === "function" && matchMedia(REDUCED_MOTION).matches;
/** Live reduced-motion preference; a moving light must stop when it turns on. */
export const useReducedMotionPreference = () => useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
