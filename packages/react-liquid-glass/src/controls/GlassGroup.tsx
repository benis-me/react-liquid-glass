import { useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import { cancelFrame, frame } from "motion";
import { motionValue } from "../shared/values";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";
import { createLiquidBackdrop, createLiquidToneTracker } from "../liquid-glass/backdrop";
import { MAX_BLOBS } from "../liquid-glass/render-frame";
import { FusionTriggerContext, SURFACE_MATERIAL } from "./GlassSurface";

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
});
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
  // Optics follow the smallest member, like a standalone surface of that height.
  const [smallest, setSmallest] = useState(42);

  useLayoutEffect(() => {
    const element = root.current, list = items.current;
    if (!element || !list) return;
    let moving = 0;
    const measure = () => {
      const box = element.getBoundingClientRect();
      const width = element.offsetWidth, height = element.offsetHeight;
      if (!width || !height) return;
      const children = [...list.children].filter(child => child.getClientRects().length).slice(0, MAX_BLOBS);
      while (shapes.current.length < children.length) shapes.current.push(createShape());
      let smallest = Infinity;
      children.forEach((child, index) => {
        const rect = child.getBoundingClientRect(), shape = shapes.current[index];
        const half = [rect.width / 2, rect.height / 2], corner = Math.min(cornerOf(child), half[0], half[1]);
        shape.x.set((rect.left - box.left + PAD + half[0]) / (width + PAD * 2));
        shape.y.set((rect.top - box.top + PAD + half[1]) / (height + PAD * 2));
        shape.halfWidth.set(half[0]); shape.halfHeight.set(half[1]);
        shape.radius.set(corner); shape.cornerRadius.set(corner);
        // Each shape refracts like a standalone surface of its own size.
        shape.refractionRatio[0] = (rect.width + 28) / (width + PAD * 2);
        shape.refractionRatio[1] = (rect.height + 28) / (height + PAD * 2);
        smallest = Math.min(smallest, rect.height);
      });
      setCount(children.length);
      setSize(old => old.width === width && old.height === height ? old : { width, height });
      if (Number.isFinite(smallest)) setSmallest(Math.round(smallest));
    };
    // Positions change without resizing during transitions; follow them per frame.
    const follow = () => { measure(); if (moving > 0) frame.read(follow); };
    const start = () => { if (moving++ === 0) frame.read(follow); };
    const end = () => { moving = Math.max(0, moving - 1); if (!moving) frame.read(measure); };
    const tone = createLiquidToneTracker(element);
    const backdrop = createLiquidBackdrop(element, () => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - PAD, top: rect.top - PAD, width: element.offsetWidth + PAD * 2, height: element.offsetHeight + PAD * 2 };
    }, canvas => {
      source.current = canvas;
      revision.set(revision.get() + 1);
      const width = element.offsetWidth, height = element.offsetHeight;
      if (width && height) tone.update(canvas, { left: PAD / (width + PAD * 2), top: PAD / (height + PAD * 2), width: width / (width + PAD * 2), height: height / (height + PAD * 2) });
    });
    measure();
    const resize = new ResizeObserver(() => frame.read(measure));
    resize.observe(element); resize.observe(list);
    const mutations = new MutationObserver(() => {
      for (const child of list.children) resize.observe(child);
      frame.read(measure);
    });
    for (const child of list.children) resize.observe(child);
    mutations.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    list.addEventListener("transitionrun", start);
    list.addEventListener("transitionend", end);
    list.addEventListener("transitioncancel", end);
    list.addEventListener("animationstart", start);
    list.addEventListener("animationend", end);
    list.addEventListener("animationcancel", end);
    return () => {
      cancelFrame(follow); cancelFrame(measure);
      backdrop.dispose(); tone.dispose(); resize.disconnect(); mutations.disconnect();
      list.removeEventListener("transitionrun", start);
      list.removeEventListener("transitionend", end);
      list.removeEventListener("transitioncancel", end);
      list.removeEventListener("animationstart", start);
      list.removeEventListener("animationend", end);
      list.removeEventListener("animationcancel", end);
    };
  }, [revision]);

  const blobs = useMemo(() => shapes.current.slice(0, count), [count]);
  return (
    <div {...props} ref={root} className={`dg-glass-group ${className}`}>
      {size.width > 0 && count > 0 && (
        <span className="dg-glass-group__optics" aria-hidden="true" style={{ inset: -PAD }}>
          <LiquidGlassCanvas
            {...SURFACE_MATERIAL}
            shared
            pixelRatio={2}
            sourceRef={source}
            sourceRevision={revision}
            width={size.width + PAD * 2}
            height={size.height + PAD * 2}
            blobs={blobs}
            mergeDistance={Math.max(0, spacing)}
            domeDepth={Math.min(18, smallest * .25)}
            edgeDepth={Math.min(12, smallest * .12)}
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
