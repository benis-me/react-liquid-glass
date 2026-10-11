import { useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  if (typeof matchMedia !== "function") return () => undefined;
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const read = () => typeof matchMedia === "function" && matchMedia(REDUCED_MOTION).matches;

/**
 * The reader's live reduced-motion preference, shared by every control and both cores: motion,
 * moving light and spreading glow stop as soon as it turns on, not on the next mount.
 */
export const useReducedMotionPreference = () => useSyncExternalStore(subscribe, read, () => false);
