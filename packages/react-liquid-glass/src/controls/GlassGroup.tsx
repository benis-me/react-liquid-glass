import { useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import { cancelFrame, frame } from "motion";
import { motionValue } from "../shared/values.js";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas.js";
import { createLiquidBackdrop } from "../liquid-glass/backdrop.js";
import { useGlassTone } from "../liquid-glass/provider.js";
import { useLiquidToneTracker } from "../liquid-glass/tone.js";
import { MAX_BLOBS } from "../liquid-glass/render-frame.js";
import { FusionTriggerContext, SURFACE_MATERIAL } from "./GlassSurface.js";

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
  const publishTone = useLiquidToneTracker(root, useGlassTone());

  useLayoutEffect(() => {
    const element = root.current, list = items.current;
    if (!element || !list) return;
    let following = false, quiet = 0, signature = "";
    /** Measures every shape and returns a geometry signature for rest detection. */
    const measure = () => {
      const box = element.getBoundingClientRect();
      const width = element.offsetWidth, height = element.offsetHeight;
      if (!width || !height) return "";
      let geometry = `${width}x${height}`;
      const children = [...list.children].filter(child => child.getClientRects().length).slice(0, MAX_BLOBS);
      while (shapes.current.length < children.length) shapes.current.push(createShape());
      let smallest = Infinity;
      children.forEach((child, index) => {
        const rect = child.getBoundingClientRect(), shape = shapes.current[index];
        geometry += `|${(rect.left - box.left).toFixed(2)},${(rect.top - box.top).toFixed(2)},${rect.width.toFixed(2)},${rect.height.toFixed(2)}`;
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
    // (for example without transitions under reduced motion).
    const attributes = new MutationObserver(() => wake());
    const filter = { attributes: true, attributeFilter: ["class", "style", "hidden"] };
    const watch = () => { for (const child of list.children) { resize.observe(child); attributes.observe(child, filter); } };
    resize.observe(element); resize.observe(list);
    attributes.observe(element, filter); attributes.observe(list, filter);
    const children = new MutationObserver(() => { watch(); wake(); });
    children.observe(list, { childList: true });
    watch();
    const events = ["transitionrun", "transitionstart", "transitionend", "transitioncancel", "animationstart", "animationiteration", "animationend", "animationcancel"] as const;
    for (const type of events) list.addEventListener(type, wake);
    return () => {
      cancelFrame(follow);
      backdrop.dispose(); resize.disconnect(); attributes.disconnect(); children.disconnect();
      for (const type of events) list.removeEventListener(type, wake);
    };
  }, [revision, publishTone]);

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
