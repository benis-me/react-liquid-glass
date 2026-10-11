import { useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import { animate, cancelFrame, frame, motionValue as liveValue, type MotionValue } from "motion";
import { motionValue } from "../shared/values.js";
import { springTo, type SpringRun } from "../apple-motion/react.js";
import { GLASS_PRESS_SCALE, PRESS_GLOW_SPRING, SURFACE_PRESS_SPRING } from "../apple-motion/presets.js";
import { useReducedMotionPreference } from "../shared/reduced-motion.js";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas.js";
import { createLiquidBackdrop } from "../liquid-glass/backdrop.js";
import { useGlassTone } from "../liquid-glass/provider.js";
import { useLiquidToneTracker } from "../liquid-glass/tone.js";
import { MAX_BLOBS } from "../liquid-glass/render-frame.js";
import { glassCanvasReach, glassEdgeDepth, liquidThickness } from "../liquid-glass/material.js";
import { FusionTriggerContext } from "./GlassSurface.js";

export interface GlassGroupProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * CSS-pixel distance at which neighbouring shapes begin to fuse, like a
   * glass effect container's spacing. Default 20; 0 keeps shapes separate.
   */
  spacing?: number;
}

// Children render as plain content; the group owns one fused optical body.
const joinedSurface = () => {};
type Shape = ReturnType<typeof createShape>;
const createShape = () => ({
  x: motionValue(.5), y: motionValue(.5), halfWidth: motionValue(0), halfHeight: motionValue(0),
  radius: motionValue(0), cornerRadius: motionValue(0), refractionRatio: [1, 1] as [number, number],
  // A press lights the shape where it is touched; the glow spreads through it and onto fused neighbours.
  contactX: motionValue(0), contactY: motionValue(0), contactStrength: liveValue(0), contactSpread: liveValue(1),
});
const unit = (value: number) => Math.max(-1, Math.min(1, value));
const cornerOf = (element: Element) => {
  for (const node of [element, element.querySelector(".dg-surface")]) {
    const radius = node ? parseFloat(getComputedStyle(node).borderTopLeftRadius) : 0;
    if (radius > 0) return radius;
  }
  return 0;
};

/**
 * Up to eight glass shapes (its direct children) in one optical canvas. Shapes
 * within `spacing` of each other fuse through the shared SDF, so layout and CSS
 * transitions that move them together read as merging liquid. Children keep
 * their native semantics, focus and events.
 */
export function GlassGroup({ spacing = 20, children, className = "", ...props }: GlassGroupProps) {
  const root = useRef<HTMLDivElement>(null), items = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLCanvasElement | null>(null);
  const revision = useMemo(() => motionValue(0), []);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [count, setCount] = useState(0);
  const shapes = useRef<Shape[]>([]);
  // The fused glass is as thick as its smallest member, so a toolbar's buttons stay control glass.
  const [smallest, setSmallest] = useState({ width: 42, height: 42 });
  const publishTone = useLiquidToneTracker(root, useGlassTone());
  const reduce = useReducedMotionPreference();
  const reduceRef = useRef(reduce); reduceRef.current = reduce;
  const thickness = liquidThickness(smallest.width, smallest.height);
  // The canvas reaches as far as the shadow of glass this thick, as a surface's does. Measuring
  // reads it live, so a change re-measures rather than rebuilding the group mid-press.
  const pad = glassCanvasReach(thickness);
  const padRef = useRef(pad); padRef.current = pad;
  const refreshRef = useRef<() => void>(() => undefined);

  useLayoutEffect(() => {
    const element = root.current, list = items.current;
    if (!element || !list) return;
    let following = false, quiet = 0, signature = "";
    // Each visible child owns one shape; a press grows the child, and with it its shape, as a Button grows.
    const owners = new Map<Element, Shape>();
    const scales = new Map<HTMLElement, { scale: MotionValue<number>; own: string; base: number[]; run?: SpringRun }>();
    const press = (child: HTMLElement) => {
      let state = scales.get(child);
      if (!state) {
        const entry = { scale: liveValue(1), own: "", base: [1] };
        entry.scale.on("change", value => {
          child.style.scale = Math.abs(value - 1) < 1e-4 ? entry.own : entry.base.map(part => part * value).join(" ");
        });
        state = entry; scales.set(child, state);
      }
      // At rest the child shows its own scale, inline or styled; a press grows it from there.
      if (!state.run && Math.abs(state.scale.get() - 1) < 1e-4) {
        state.own = child.style.scale;
        const computed = getComputedStyle(child).scale;
        state.base = !computed || computed === "none" ? [1] : computed.trim().split(/\s+/).map(part => parseFloat(part) / (part.endsWith("%") ? 100 : 1));
      }
      const target = child.hasAttribute("data-pressed") ? GLASS_PRESS_SCALE : 1;
      state.run?.stop();
      if (reduceRef.current) { state.run = undefined; state.scale.jump(target); }
      else {
        const run = springTo(state.scale, target, SURFACE_PRESS_SPRING), owner = state;
        owner.run = run;
        void run.finished.then(() => { if (owner.run === run) owner.run = undefined; });
      }
    };
    /** Measures every shape and returns a geometry signature for rest detection. */
    const measure = () => {
      const box = element.getBoundingClientRect();
      const width = element.offsetWidth, height = element.offsetHeight, pad = padRef.current;
      if (!width || !height) return "";
      let geometry = `${width}x${height}`;
      const children = [...list.children].filter(child => child.getClientRects().length).slice(0, MAX_BLOBS);
      while (shapes.current.length < children.length) shapes.current.push(createShape());
      let smallest = { width: Infinity, height: Infinity };
      owners.clear();
      children.forEach((child, index) => {
        const rect = child.getBoundingClientRect(), shape = shapes.current[index];
        owners.set(child, shape);
        geometry += `|${(rect.left - box.left).toFixed(2)},${(rect.top - box.top).toFixed(2)},${rect.width.toFixed(2)},${rect.height.toFixed(2)}`;
        const half = [rect.width / 2, rect.height / 2], corner = Math.min(cornerOf(child), half[0], half[1]);
        shape.x.set((rect.left - box.left + pad + half[0]) / (width + pad * 2));
        shape.y.set((rect.top - box.top + pad + half[1]) / (height + pad * 2));
        shape.halfWidth.set(half[0]); shape.halfHeight.set(half[1]);
        shape.radius.set(corner); shape.cornerRadius.set(corner);
        // Each shape refracts like a standalone surface of its own size.
        shape.refractionRatio[0] = (rect.width + 28) / (width + pad * 2);
        shape.refractionRatio[1] = (rect.height + 28) / (height + pad * 2);
        // Thickness follows a member's layout size, so a press's growth never changes the glass.
        const layout = { width: (child as HTMLElement).offsetWidth || rect.width, height: (child as HTMLElement).offsetHeight || rect.height };
        if (Math.min(layout.width, layout.height) < Math.min(smallest.width, smallest.height)) smallest = layout;
      });
      setCount(children.length);
      setSize(old => old.width === width && old.height === height ? old : { width, height });
      if (Number.isFinite(smallest.width)) {
        const next = { width: Math.round(smallest.width), height: Math.round(smallest.height) };
        setSmallest(old => old.width === next.width && old.height === next.height ? old : next);
      }
      return geometry;
    };
    // Positions change without resizing during transitions: follow them per frame
    // until the geometry has held still for a few frames. Only the list and its
    // direct children move shapes; descendant animations such as spinning icons,
    // or an end event that never arrives, cannot keep this loop alive.
    const follow = () => {
      const next = measure();
      quiet = next === signature ? quiet + 1 : 0;
      signature = next;
      if (quiet < 12) frame.read(follow); else following = false;
    };
    const wake = (event?: Event) => {
      if (event && event.target !== list && (event.target as Element | null)?.parentElement !== list) return;
      quiet = 0;
      if (!following) { following = true; frame.read(follow); }
    };
    const backdrop = createLiquidBackdrop(element, () => {
      const rect = element.getBoundingClientRect(), pad = padRef.current;
      return { left: rect.left - pad, top: rect.top - pad, width: element.offsetWidth + pad * 2, height: element.offsetHeight + pad * 2 };
    }, canvas => {
      source.current = canvas;
      revision.set(revision.get() + 1);
      const width = element.offsetWidth, height = element.offsetHeight, pad = padRef.current;
      if (width && height) publishTone(canvas, { left: pad / (width + pad * 2), top: pad / (height + pad * 2), width: width / (width + pad * 2), height: height / (height + pad * 2) });
    });
    signature = measure();
    const resize = new ResizeObserver(() => wake());
    // Class and style changes on the group or a shape can move shapes instantly
    // (for example without transitions under reduced motion). A pressed child grows.
    const attributes = new MutationObserver(records => {
      for (const record of records) if (record.attributeName === "data-pressed" && record.target.parentElement === list) press(record.target as HTMLElement);
      wake();
    });
    const filter = { attributes: true, attributeFilter: ["class", "style", "hidden", "data-pressed"] };
    const watch = () => { for (const child of list.children) { resize.observe(child); attributes.observe(child, filter); } };
    resize.observe(element); resize.observe(list);
    attributes.observe(element, filter); attributes.observe(list, filter);
    const children = new MutationObserver(() => { watch(); wake(); });
    children.observe(list, { childList: true });
    watch();
    for (const child of list.children) if (child.hasAttribute("data-pressed")) press(child as HTMLElement);
    refreshRef.current = () => { backdrop.refresh(); wake(); };
    const events = ["transitionrun", "transitionstart", "transitionend", "transitioncancel", "animationstart", "animationiteration", "animationend", "animationcancel"] as const;
    for (const type of events) list.addEventListener(type, wake);
    // The touched shape lights where it is pressed, following the pointer, and fades on release.
    let grip: { id: number; shape: Shape; x: number; y: number; clientX: number; clientY: number; width: number; height: number } | null = null;
    const lights = new Map<Shape, Array<{ stop: () => void }>>();
    const settle = (shape: Shape) => { lights.get(shape)?.forEach(run => run.stop()); lights.delete(shape); };
    const move = (event: PointerEvent) => {
      if (!grip || event.pointerId !== grip.id) return;
      grip.shape.contactX.set(unit(grip.x + (event.clientX - grip.clientX) / grip.width * 2));
      grip.shape.contactY.set(unit(grip.y + (event.clientY - grip.clientY) / grip.height * 2));
    };
    const release = (event?: Event) => {
      if (!grip || (event instanceof PointerEvent && event.pointerId !== grip.id)) return;
      const { shape } = grip;
      grip = null;
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release); window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hidden);
      settle(shape);
      lights.set(shape, [animate(shape.contactStrength, 0, { duration: reduceRef.current ? .1 : .22, ease: "easeOut" })]);
    };
    // A page hidden mid-press releases it, as the shared pointer-release fallback does, even when
    // neither blur nor pointercancel arrives; a press left held would ignore every later one.
    const hidden = () => { if (document.hidden) release(); };
    const down = (event: PointerEvent) => {
      if (grip || event.button !== 0 || !event.isPrimary) return;
      const target = event.target as Element;
      const child = [...list.children].find(node => node.contains(target)), shape = child && owners.get(child);
      if (!child || !shape || target.closest(':disabled, [aria-disabled="true"], [inert]')) return;
      const rect = child.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = unit((event.clientX - rect.left) / rect.width * 2 - 1), y = unit((event.clientY - rect.top) / rect.height * 2 - 1);
      shape.contactX.set(x); shape.contactY.set(y);
      settle(shape);
      const runs: Array<{ stop: () => void }> = [animate(shape.contactStrength, 1, { duration: .12, ease: "easeOut" })];
      if (reduceRef.current) shape.contactSpread.jump(1);
      else { shape.contactSpread.jump(0); runs.push(springTo(shape.contactSpread, 1, PRESS_GLOW_SPRING, 0)); }
      lights.set(shape, runs);
      grip = { id: event.pointerId, shape, x, y, clientX: event.clientX, clientY: event.clientY, width: rect.width, height: rect.height };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release); window.addEventListener("blur", release);
      document.addEventListener("visibilitychange", hidden);
    };
    list.addEventListener("pointerdown", down);
    return () => {
      cancelFrame(follow);
      backdrop.dispose(); resize.disconnect(); attributes.disconnect(); children.disconnect();
      for (const type of events) list.removeEventListener(type, wake);
      release(); list.removeEventListener("pointerdown", down);
      for (const shape of [...lights.keys()]) settle(shape);
      for (const [child, state] of scales) { state.run?.stop(); child.style.scale = state.own; }
      refreshRef.current = () => undefined;
    };
  }, [revision, publishTone]);
  // A new reach re-measures the shapes and recaptures the backdrop over the new bounds.
  useLayoutEffect(() => { refreshRef.current(); }, [pad]);

  const blobs = useMemo(() => shapes.current.slice(0, count), [count]);
  return (
    <div {...props} ref={root} className={`dg-glass-group ${className}`}>
      {size.width > 0 && count > 0 && (
        <span className="dg-glass-group__optics" aria-hidden="true" style={{ inset: -pad }}>
          <LiquidGlassCanvas
            thickness={thickness}
            shared
            pixelRatio={2}
            sourceRef={source}
            sourceRevision={revision}
            width={size.width + pad * 2}
            height={size.height + pad * 2}
            blobs={blobs}
            mergeDistance={Math.max(0, spacing)}
            edgeDepth={glassEdgeDepth(Math.min(smallest.width, smallest.height), thickness)}
            transparentOutside
            style={{ width: "100%", height: "100%" }}
          />
        </span>
      )}
      <FusionTriggerContext.Provider value={joinedSurface}>
        <div ref={items} className="dg-glass-group__items">{children}</div>
      </FusionTriggerContext.Provider>
    </div>
  );
}
