import { useEffect, useMemo, useRef } from "react";

export function usePointerReleaseFallback(onRelease: () => void) {
  const releaseRef = useRef(onRelease);
  const cleanupRef = useRef<(() => void) | null>(null);
  releaseRef.current = onRelease;

  const controls = useMemo(() => {
    const disarm = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    const arm = (pointerId: number) => {
      disarm();
      let active = true;
      const finish = () => {
        if (!active) return;
        disarm();
        releaseRef.current();
      };
      const finishPointer = (event: PointerEvent) => {
        if (event.pointerId === pointerId) finish();
      };
      const finishWhenHidden = () => {
        if (document.hidden) finish();
      };
      window.addEventListener("pointerup", finishPointer);
      window.addEventListener("pointercancel", finishPointer);
      window.addEventListener("blur", finish);
      document.addEventListener("visibilitychange", finishWhenHidden);
      cleanupRef.current = () => {
        active = false;
        window.removeEventListener("pointerup", finishPointer);
        window.removeEventListener("pointercancel", finishPointer);
        window.removeEventListener("blur", finish);
        document.removeEventListener("visibilitychange", finishWhenHidden);
      };
    };
    return { arm, disarm };
  }, []);

  useEffect(() => controls.disarm, [controls]);
  return controls;
}
