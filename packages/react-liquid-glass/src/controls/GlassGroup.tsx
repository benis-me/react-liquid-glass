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
import { glassEdgeDepth, liquidThickness } from "../liquid-glass/material.js";
import { FusionTriggerContext } from "./GlassSurface.js";

export interface GlassGroupProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * CSS-pixel distance at which neighbouring shapes begin to fuse, like a
   * glass effect container's spacing. Default 20; 0 keeps shapes separate.
   */
  spacing?: number;
}

const PAD = 40;
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

  useLayoutEffect(() => {
    const element = root.current, list = items.current;
    if (!element || !list) return;
    let following = false, quiet = 0, signature = "";
    // Each visible child owns one shape; a press grows the child, and with it its shape, as a Button grows.
    const owners = new Map<Element, Shape>();
    const scales = new Map<HTMLElement, { scale: MotionValue<number>; run?: SpringRun }>();
    const press = (child: HTMLElement) => {
      let state = scales.get(child);
      if (!state) {
        const scale = liveValue(1);
        scale.on("change", value => { child.style.scale = Math.abs(value - 1) < 1e-4 ? "" : String(value); });
        state = { scale }; scales.set(child, state);
      }
      const target = child.hasAttribute("data-pressed") ? GLASS_PRESS_SCALE : 1;
      state.run?.stop();
      if (reduceRef.current) state.scale.jump(target); else state.run = springTo(state.scale, target, SURFACE_PRESS_SPRING);
    };
    /** Measures every shape and returns a geometry signature for rest detection. */
    const measure = () => {
      const box = element.getBoundingClientRect();
      const width = element.offsetWidth, height = element.offsetHeight;
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
        shape.x.set((rect.left - box.left + PAD + half[0]) / (width + PAD * 2));
        shape.y.set((rect.top - box.top + PAD + half[1]) / (height + PAD * 2));
        shape.halfWidth.set(half[0]); shape.halfHeight.set(half[1]);
        shape.radius.set(corner); shape.cornerRadius.set(corner);
        // Each shape refracts like a standalone surface of its own size.
        shape.refractionRatio[0] = (rect.width + 28) / (width + PAD * 2);
        shape.refractionRatio[1] = (rect.height + 28) / (height + PAD * 2);
        if (Math.min(rect.width, rect.height) < Math.min(smallest.width, smallest.height)) smallest = { width: rect.width, height: rect.height };
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
      const rect = element.getBoundingClientRect();
      return { left: rect.left - PAD, top: rect.top - PAD, width: element.offsetWidth + PAD * 2, height: element.offsetHeight + PAD * 2 };
    }, canvas => {
      source.current = canvas;
      revision.set(revision.get() + 1);
      const width = element.offsetWidth, height = element.offsetHeight;
      if (width && height) publishTone(canvas, { left: PAD / (width + PAD * 2), top: PAD / (height + PAD * 2), width: width / (width + PAD * 2), height: height / (height + PAD * 2) });
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
    const events = ["transitionrun", "transitionstart", "transitionend", "transitioncancel", "animationstart", "animationiteration", "animationend", "animationcancel"] as const;
    for (const type of events) list.addEventListener(type, wake);
    // The touched shape lights where it is pressed, following the pointer, and fades on release.
    let grip: { id: number; shape: Shape; x: number; y: number; clientX: number; clientY: number; width: number; height: number } | null = null;
    let light: Array<{ stop: () => void }> = [];
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
      light.forEach(run => run.stop());
      light = [animate(shape.contactStrength, 0, { duration: reduceRef.current ? .1 : .22, ease: "easeOut" })];
    };
    const down = (event: PointerEvent) => {
      if (grip || event.button !== 0 || !event.isPrimary) return;
      const target = event.target as Element;
      const child = [...list.children].find(node => node.contains(target)), shape = child && owners.get(child);
      if (!child || !shape || target.closest(':disabled, [aria-disabled="true"], [inert]')) return;
      const rect = child.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = unit((event.clientX - rect.left) / rect.width * 2 - 1), y = unit((event.clientY - rect.top) / rect.height * 2 - 1);
      shape.contactX.set(x); shape.contactY.set(y);
      light.forEach(run => run.stop());
      light = [animate(shape.contactStrength, 1, { duration: .12, ease: "easeOut" })];
      if (reduceRef.current) shape.contactSpread.jump(1);
      else { shape.contactSpread.jump(0); light.push(springTo(shape.contactSpread, 1, PRESS_GLOW_SPRING, 0)); }
      grip = { id: event.pointerId, shape, x, y, clientX: event.clientX, clientY: event.clientY, width: rect.width, height: rect.height };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release); window.addEventListener("blur", release);
    };
    list.addEventListener("pointerdown", down);
    return () => {
      cancelFrame(follow);
      backdrop.dispose(); resize.disconnect(); attributes.disconnect(); children.disconnect();
      for (const type of events) list.removeEventListener(type, wake);
      release(); list.removeEventListener("pointerdown", down);
      for (const [child, state] of scales) { state.run?.stop(); child.style.scale = ""; }
    };
  }, [revision, publishTone]);

  const blobs = useMemo(() => shapes.current.slice(0, count), [count]);
  const thickness = liquidThickness(smallest.width, smallest.height);
  return (
    <div {...props} ref={root} className={`dg-glass-group ${className}`}>
      {size.width > 0 && count > 0 && (
        <span className="dg-glass-group__optics" aria-hidden="true" style={{ inset: -PAD }}>
          <LiquidGlassCanvas
            thickness={thickness}
            shared
            pixelRatio={2}
            sourceRef={source}
            sourceRevision={revision}
            width={size.width + PAD * 2}
            height={size.height + PAD * 2}
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
