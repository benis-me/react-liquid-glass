import { useEffect, useRef, type RefObject } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { springTo } from "./react";
import { contactPull } from "./contact";
import { usePointerReleaseFallback } from "./use-pointer-release-fallback";

const RETURN = { stiffness: 420, damping: 24, mass: 1 };
const PRESS = { stiffness: 700, damping: 42, mass: 1 };

/** Adds material feedback without replacing a control's native pointer/keyboard action. */
export function useGlassContact(root: RefObject<HTMLElement | null>, { deform = true, enabled = true }: { deform?: boolean; enabled?: boolean } = {}) {
  const contactX = useMotionValue(0), contactY = useMotionValue(0), contactStrength = useMotionValue(0);
  const pullX = useMotionValue(0), pullY = useMotionValue(0);
  const reduce = useReducedMotion();
  const active = useRef<{ id: number; x: number; y: number; px: number; py: number; width: number; height: number; elastic: boolean; moved: boolean } | null>(null);
  const runs = useRef<Array<{ stop: () => void }>>([]);
  const cleanMove = useRef(() => {}), suppressClick = useRef(false);
  const stop = () => { runs.current.forEach(run => run.stop()); runs.current = []; };
  const release = () => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = null;
    suppressClick.current = gesture.elastic && gesture.moved;
    cleanMove.current();
    root.current?.removeAttribute("data-dg-contact-active");
    stop();
    if (document.hidden || reduce) { pullX.jump(0); pullY.jump(0); }
    else runs.current.push(springTo(pullX, 0, RETURN), springTo(pullY, 0, RETURN));
    runs.current.push(animate(contactStrength, 0, { duration: reduce ? .1 : .22, ease: "easeOut" }));
  };
  const { arm, disarm } = usePointerReleaseFallback(release);
  useEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    element.setAttribute("data-dg-contact", "");
    const down = (event: PointerEvent) => {
      const target = event.target as Element;
      if (active.current || event.button !== 0 || !event.isPrimary || target.closest("[data-dg-contact]") !== element || target.closest(':disabled, [aria-disabled="true"], [inert]')) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      stop();
      if (Math.hypot(pullX.get(), pullY.get()) > .1) runs.current.push(springTo(contactX, x, PRESS), springTo(contactY, y, PRESS));
      else { contactX.jump(x); contactY.jump(y); }
      runs.current.push(animate(contactStrength, 1, { duration: .12, ease: "easeOut" }));
      const elastic = deform && !target.closest('input, textarea, select, [contenteditable="true"], pre, code');
      active.current = { id: event.pointerId, x: event.clientX, y: event.clientY, px: pullX.get(), py: pullY.get(), width: rect.width, height: rect.height, elastic, moved: false };
      suppressClick.current = false;
      element.setAttribute("data-dg-contact-active", "");
      const move = (next: PointerEvent) => {
        const grip = active.current;
        if (!grip || next.pointerId !== grip.id) return;
        const dx = next.clientX - grip.x, dy = next.clientY - grip.y;
        if (Math.hypot(dx, dy) > 4) grip.moved = true;
        if (!grip.elastic) { contactX.set(Math.max(-1, Math.min(1, x + dx / grip.width * 2))); contactY.set(Math.max(-1, Math.min(1, y + dy / grip.height * 2))); return; }
        if (reduce) return;
        const [px, py] = contactPull(dx, dy, grip.width, grip.height, grip.px, grip.py);
        pullX.set(px); pullY.set(py);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("lostpointercapture", lost);
      cleanMove.current = () => { window.removeEventListener("pointermove", move); window.removeEventListener("lostpointercapture", lost); };
      // Existing sliders and text fields retain their own capture and scrolling.
      if (elastic) {
        const capture = target.closest<HTMLElement>("button, a") ?? element;
        try { capture.setPointerCapture(event.pointerId); } catch { /* A cancelled or synthetic pointer still uses the window release fallback. */ }
      }
      arm(event.pointerId);
    };
    const click = (event: MouseEvent) => {
      if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
    };
    const lost = (event: PointerEvent) => { if (active.current?.id === event.pointerId) { release(); disarm(); } };
    const action = element.closest("button, a") ?? element;
    const drag = (event: DragEvent) => { if (active.current?.elastic) event.preventDefault(); };
    element.addEventListener("pointerdown", down);
    action.addEventListener("click", click as EventListener, true);
    action.addEventListener("dragstart", drag as EventListener);
    return () => {
      cleanMove.current(); disarm(); stop(); active.current = null;
      contactStrength.jump(0); pullX.jump(0); pullY.jump(0);
      element.removeAttribute("data-dg-contact"); element.removeAttribute("data-dg-contact-active");
      element.removeEventListener("pointerdown", down); action.removeEventListener("click", click as EventListener, true); action.removeEventListener("dragstart", drag as EventListener);
    };
  }, [root, enabled, deform, reduce, arm, disarm, contactX, contactY, contactStrength, pullX, pullY]);
  return { contactX, contactY, contactStrength, pullX, pullY };
}
