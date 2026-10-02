import { readLiquidSource } from "./canvas-sources";
import { cancelFrame, frame } from "motion";
import { paintLiquidSvg, paintLiquidText } from "./menu-content";
import { liquidBackground, paintLiquidHatch } from "./source";
import { subscribeLiquidFrames } from "./renderer";

type Bounds = { left: number; top: number; width: number; height: number };
declare const process: { env: { NODE_ENV?: string } };
// Development builds name each element the adapter cannot draw, once. Bundlers replace
// process.env.NODE_ENV; unbundled ESM has no process and stays quiet.
let development = false;
try { development = process.env.NODE_ENV !== "production"; } catch { /* no process */ }
const warned = new WeakSet<Element>();
const warnSkipped = (element: Element, what: string) => {
  if (!development || warned.has(element)) return;
  warned.add(element);
  console.warn(`rglass: ${what} cannot show through liquid glass. Paint it into a canvas for LiquidGlassCanvas, or see the README for what the DOM backdrop draws.`, element);
};
const pending = new Set<() => void>();
let batchLayout: WeakMap<Element, { rect: DOMRect; css?: CSSStyleDeclaration }> | undefined;
const layout = (element: Element) => {
  let value = batchLayout?.get(element);
  if (!value) { value = { rect: element.getBoundingClientRect() }; batchLayout?.set(element, value); }
  return value;
};
const style = (element: Element) => { const value = layout(element); return value.css ??= getComputedStyle(element); };
// Each flush is one batch; a surface paints at most once per batch.
let batch = 0;
const flush = () => {
  const work = [...pending]; pending.clear();
  batch++;
  batchLayout = new WeakMap();
  try { for (const refresh of work) refresh(); }
  finally { batchLayout = undefined; }
};
/** One layout snapshot per render batch, never a stale cache across DOM edits. */
export function scheduleLiquidBackdrop(refresh: () => void) { pending.add(refresh); frame.preRender(flush); }
export function cancelLiquidBackdrop(refresh: () => void) { pending.delete(refresh); if (!pending.size) cancelFrame(flush); }
const intersects = (a: Bounds, b: Bounds) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 && a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
// Normal surfaces only read preceding paint layers, never themselves or later
// glass. This also prevents two overlapping surfaces from invalidating each other.
const behind = (element: Element, before?: Element) => !before || (element !== before && !(before.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));

// An opaque ancestor fully covering the sample bounds cuts off everything behind
// it. Keep the same DOM painter, but do not walk the entire page for every control.
function backdropRoot(owner: HTMLElement, bounds: Bounds) {
  for (let node = owner.parentElement; node && node !== document.body; node = node.parentElement) {
    const rect = layout(node).rect;
    if (rect.left > bounds.left || rect.top > bounds.top || rect.right < bounds.left + bounds.width || rect.bottom < bounds.top + bounds.height) continue;
    const css = style(node), inset = parseFloat(css.borderRadius) || 0;
    if (/^rgb\(/.test(css.backgroundColor) && Number(css.opacity) === 1 && rect.left + inset <= bounds.left && rect.top + inset <= bounds.top && rect.right - inset >= bounds.left + bounds.width && rect.bottom - inset >= bounds.top + bounds.height) return node;
  }
  return document.body;
}

/** Redraw the visible DOM region beneath a glass overlay into its existing material. */
export function paintLiquidBackdrop(root: HTMLElement, canvas: HTMLCanvasElement, bounds: Bounds, exclude: readonly Element[] = [], region: Bounds = bounds, before?: Element) {
  if (!Object.values(bounds).every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const width = Math.max(1, Math.round(bounds.width * 2)), height = Math.max(1, Math.round(bounds.height * 2));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.globalAlpha = 1;
  ctx.save(); ctx.beginPath(); ctx.rect(region.left - bounds.left, region.top - bounds.top, region.width, region.height); ctx.clip();
  ctx.fillStyle = liquidBackground(root); ctx.fillRect(0, 0, bounds.width, bounds.height);
  const visit = (element: Element) => {
    // Sample the SDR optical base once. Reading its additive HDR presentation
    // through a 2D canvas stalls WebKit and tone-maps that light a second time.
    if (!behind(element, before) || exclude.includes(element) || element.matches("script, style, link, template, [popover], [data-dg-highlight-hdr], dialog:not([open])")) return;
    const rect = layout(element).rect;
    // Reject off-region boxes before resolving all their computed styles.
    if ((rect.width || rect.height) && !intersects(rect, region)) return;
    const css = style(element);
    if (css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0 || (!rect.width && !rect.height && css.display !== "contents")) return;
    const x = rect.left - bounds.left, y = rect.top - bounds.top;
    const radius = (value: string) => value.endsWith("%") ? Math.min(rect.width, rect.height) * parseFloat(value) / 100 : parseFloat(value) || 0;
    const corners = [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map(radius);
    ctx.save(); ctx.globalAlpha *= Number(css.opacity);
    ctx.fillStyle = css.backgroundColor;
    ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, corners); ctx.fill();
    ctx.save(); ctx.clip();
    if (!paintLiquidHatch(ctx, css, rect, bounds) && css.backgroundImage !== "none") warnSkipped(element, "A CSS background-image (gradient or url())");
    ctx.restore();
    const border = parseFloat(css.borderTopWidth);
    if (border > 0 && css.borderTopStyle !== "none") {
      ctx.lineWidth = border; ctx.strokeStyle = css.borderTopColor; ctx.stroke();
    }
    if (/(hidden|clip|scroll|auto)/.test(`${css.overflowX} ${css.overflowY}`)) { ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, corners); ctx.clip(); }
    // ponytail: this adapter covers DOM text/boxes, Lucide SVG, same-origin or CORS media and canvases.
    // Arbitrary CSS effects, cross-origin frames and browser compositor layers need a native backdrop API.
    if (element instanceof HTMLCanvasElement || element instanceof HTMLImageElement || element instanceof HTMLVideoElement) {
      const sw = element instanceof HTMLImageElement ? element.naturalWidth : element instanceof HTMLVideoElement ? element.videoWidth : element.width;
      const sh = element instanceof HTMLImageElement ? element.naturalHeight : element instanceof HTMLVideoElement ? element.videoHeight : element.height;
      // crossorigin media either passed CORS or failed to load with zero size.
      // ponytail: adding crossorigin to an already loaded image trusts its old pixels until the CORS reload settles.
      const safe = element instanceof HTMLCanvasElement || element.crossOrigin !== null || !element.currentSrc || new URL(element.currentSrc, location.href).origin === location.origin;
      if (!safe) warnSkipped(element, "Cross-origin media without crossorigin and CORS");
      if (sw && sh && safe) {
        const scale = css.objectFit === "cover" ? Math.max(rect.width / sw, rect.height / sh) : css.objectFit === "contain" ? Math.min(rect.width / sw, rect.height / sh) : 0;
        const w = scale ? sw * scale : rect.width, h = scale ? sh * scale : rect.height;
        ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, corners); ctx.clip(); ctx.filter = css.filter;
        ctx.drawImage(element instanceof HTMLCanvasElement ? readLiquidSource(element) : element, x + (rect.width - w) / 2, y + (rect.height - h) / 2, w, h); ctx.restore();
      }
    } else if (element instanceof SVGSVGElement) {
      const alpha = ctx.globalAlpha;
      paintLiquidSvg(element, ctx, bounds, () => alpha);
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const text = element.type === "password" ? "•".repeat(element.value.length) : element.value || element.placeholder;
      ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      ctx.letterSpacing = css.letterSpacing === "normal" ? "0px" : css.letterSpacing;
      ctx.fillStyle = element.value ? css.color : getComputedStyle(element, "::placeholder").color;
      const metrics = ctx.measureText(text), padding = parseFloat(css.paddingLeft) || 0;
      const lineHeight = parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.2;
      const top = element instanceof HTMLTextAreaElement ? y + (parseFloat(css.paddingTop) || 0) - element.scrollTop : y + (rect.height - lineHeight) / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(x + padding, y, rect.width - padding - (parseFloat(css.paddingRight) || 0), rect.height); ctx.clip();
      text.split("\n").forEach((line, index) => ctx.fillText(line, x + padding - element.scrollLeft, top + index * lineHeight + (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent));
      ctx.restore();
    } else {
      for (const child of element.childNodes) {
        if (child instanceof Element) visit(child);
        else if (child.nodeType === Node.TEXT_NODE) paintLiquidText(child, ctx, bounds);
      }
    }
    ctx.restore();
  };
  visit(root);
  ctx.restore();
  return true;
}

type Invalidation = (element: Element, regions?: readonly Bounds[]) => void;
const WATCHED_EVENTS = ["input", "change", "load", "seeked"] as const;
// One MutationObserver and one set of listeners per root, shared by every glass
// surface. Records are deduplicated by element before each subscriber filters them.
const hubs = new Map<HTMLElement, { subscribers: Set<{ invalidate: Invalidation; update: () => void }>; stop: () => void }>();
function joinHub(root: HTMLElement, subscriber: { invalidate: Invalidation; update: () => void }) {
  let hub = hubs.get(root);
  if (!hub) {
    const subscribers = new Set<{ invalidate: Invalidation; update: () => void }>();
    const dispatch = (node: Node, regions?: readonly Bounds[]) => {
      if (document.hidden) return;
      const element = node instanceof Element ? node : node.parentElement;
      if (!element || !root.contains(element) || element.closest("[popover], [data-dg-highlight-hdr]")) return;
      for (const item of subscribers) item.invalidate(element, regions);
    };
    const observer = new MutationObserver(records => {
      const targets = new Set<Node>();
      for (const record of records) targets.add(record.target);
      for (const target of targets) dispatch(target);
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "src", "width", "height", "hidden", "value", "checked", "data-theme"] });
    const stopFrames = subscribeLiquidFrames(dispatch);
    const event = (event: Event) => { if (event.target instanceof Node) dispatch(event.target); };
    const update = () => { for (const item of subscribers) item.update(); };
    for (const type of WATCHED_EVENTS) root.addEventListener(type, event, true);
    document.fonts.addEventListener("loadingdone", update);
    document.addEventListener("visibilitychange", update);
    hub = { subscribers, stop: () => {
      observer.disconnect(); stopFrames();
      for (const type of WATCHED_EVENTS) root.removeEventListener(type, event, true);
      document.fonts.removeEventListener("loadingdone", update); document.removeEventListener("visibilitychange", update);
    } };
    hubs.set(root, hub);
  }
  hub.subscribers.add(subscriber);
  return () => {
    hub.subscribers.delete(subscriber);
    if (!hub.subscribers.size) { hub.stop(); hubs.delete(root); }
  };
}

/** Coalesce visible source changes; no polling or work while the page is hidden. */
export function observeLiquidBackdrop(root: HTMLElement, bounds: () => Bounds, exclude: readonly Element[], refresh: () => void, before?: () => Element | undefined) {
  const changes = new Map<Element, readonly Bounds[] | undefined>();
  let force = false;
  const check = () => {
    const requested = force; force = false;
    const target = document.hidden ? undefined : bounds();
    const changed = [...changes]; changes.clear();
    if (!target || !intersects(target, { left: 0, top: 0, width: innerWidth, height: innerHeight })) return;
    if (requested || changed.some(([element, regions]) => {
      const rect = layout(element).rect;
      if (regions) return regions.some(region => intersects({ left: rect.left + region.left * rect.width, top: rect.top + region.top * rect.height,
        width: region.width * rect.width, height: region.height * rect.height }, target));
      return intersects(rect.width && rect.height ? rect : element.parentElement ? layout(element.parentElement).rect : rect, target);
    })) refresh();
  };
  // Collect notifications without forcing layout in mutation/renderer callbacks.
  // All observers share the same fresh layout snapshot in the next pre-render batch.
  const invalidate: Invalidation = (element, regions) => {
    if (!behind(element, before?.()) || exclude.some(item => item.contains(element))) return;
    const previous = changes.get(element);
    changes.set(element, changes.has(element) ? previous && regions ? [...previous, ...regions] : undefined : regions);
    scheduleLiquidBackdrop(check);
  };
  const leave = joinHub(root, { invalidate, update: () => { force = true; scheduleLiquidBackdrop(check); } });
  return () => { leave(); changes.clear(); cancelLiquidBackdrop(check); cancelLiquidBackdrop(refresh); };
}

// Scroll and viewport listeners are shared too; each surface checks itself in the
// next batched frame, against the same layout snapshot as every other surface.
const scrollers = new Set<() => void>();
const onScroll = () => { for (const scroll of scrollers) scroll(); };
function watchScroll(scroll: () => void) {
  if (!scrollers.size) window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  scrollers.add(scroll);
  return () => { scrollers.delete(scroll); if (!scrollers.size) window.removeEventListener("scroll", onScroll, { capture: true }); };
}

/** Retain the same bounded DOM backdrop for inline controls and explicit lenses. */
export function createLiquidBackdrop(owner: HTMLElement, bounds: () => Bounds, changed: (canvas: HTMLCanvasElement) => void, visible: () => boolean = () => true) {
  const canvas = document.createElement("canvas");
  canvas.getContext("2d");
  let sourceRoot: HTMLElement | undefined, offsetX = 0, offsetY = 0, painted = -1;
  const refresh = () => {
    // A scroll check and a resize in the same frame must not rasterize the DOM twice.
    if (painted === batch) return;
    const rect = bounds();
    if (!visible() || document.hidden || !owner.isConnected || !owner.getClientRects().length || !intersects(rect, { left: 0, top: 0, width: innerWidth, height: innerHeight })) return;
    sourceRoot = backdropRoot(owner, rect);
    const sourceRect = layout(sourceRoot).rect;
    offsetX = rect.left - sourceRect.left; offsetY = rect.top - sourceRect.top;
    painted = batch;
    if (paintLiquidBackdrop(sourceRoot, canvas, rect, [owner], rect, owner)) changed(canvas);
  };
  const update = () => scheduleLiquidBackdrop(refresh);
  const scrolled = () => {
    if (!visible() || painted === batch) return;
    const rect = bounds();
    // Offscreen source changes are intentionally skipped; repaint on return.
    if (!intersects(rect, { left: 0, top: 0, width: innerWidth, height: innerHeight })) { sourceRoot = undefined; return; }
    if (sourceRoot) {
      const parent = layout(sourceRoot).rect;
      // A page-flow scene and its lens move together during page scrolling.
      // DOM changes and canvas frames still invalidate the retained pixels.
      if (Math.abs(rect.left - parent.left - offsetX) < .01 && Math.abs(rect.top - parent.top - offsetY) < .01) return;
    }
    refresh();
  };
  const scroll = () => scheduleLiquidBackdrop(scrolled);
  const stop = observeLiquidBackdrop(document.documentElement, bounds, [owner], refresh, () => owner);
  const resize = new ResizeObserver(update); resize.observe(owner);
  const stopScroll = watchScroll(scroll);
  window.addEventListener("resize", update);
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update);
  update();
  return { refresh: update, dispose() {
    stop(); stopScroll(); resize.disconnect(); cancelLiquidBackdrop(refresh); cancelLiquidBackdrop(scrolled);
    window.removeEventListener("resize", update);
    viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update);
  } };
}

export type LiquidTone = "light" | "dark";
let toneContext: CanvasRenderingContext2D | null | undefined;
const toLinear = (value: number) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
/**
 * Mean relative luminance of a normalized region of a backdrop canvas, with
 * hysteresis around mid-gray. Returns `previous` when the region is empty or
 * too close to call, so ink never flickers between tones.
 */
export function readLiquidTone(canvas: HTMLCanvasElement, region: Bounds, previous?: LiquidTone): LiquidTone | undefined {
  if (!canvas.width || !canvas.height) return previous;
  toneContext ??= Object.assign(document.createElement("canvas"), { width: 8, height: 8 }).getContext("2d", { willReadFrequently: true });
  if (!toneContext) return previous;
  toneContext.clearRect(0, 0, 8, 8);
  toneContext.drawImage(canvas, region.left * canvas.width, region.top * canvas.height, Math.max(1, region.width * canvas.width), Math.max(1, region.height * canvas.height), 0, 0, 8, 8);
  const data = toneContext.getImageData(0, 0, 8, 8).data;
  let luminance = 0, weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    luminance += alpha * (.2126 * toLinear(data[i]) + .7152 * toLinear(data[i + 1]) + .0722 * toLinear(data[i + 2]));
    weight += alpha;
  }
  if (weight < .5) return previous;
  const mean = luminance / weight;
  return mean > .23 ? "light" : mean < .14 ? "dark" : previous ?? (mean >= .18 ? "light" : "dark");
}

/**
 * Publishes `data-dg-tone` on a surface from its latest backdrop. Reads are
 * debounced off the scroll and animation path; styling ink with the attribute
 * is left to the application.
 */
export function createLiquidToneTracker(element: HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | undefined, latest: [HTMLCanvasElement, Bounds] | undefined;
  const apply = () => {
    timer = undefined;
    if (!latest || !element.isConnected) return;
    const tone = readLiquidTone(latest[0], latest[1], element.dataset.dgTone as LiquidTone | undefined);
    if (tone && element.dataset.dgTone !== tone) element.dataset.dgTone = tone;
  };
  return {
    update(canvas: HTMLCanvasElement, region: Bounds = { left: 0, top: 0, width: 1, height: 1 }) {
      latest = [canvas, region];
      timer ??= setTimeout(apply, element.dataset.dgTone ? 120 : 0);
    },
    dispose() { if (timer) clearTimeout(timer); timer = undefined; latest = undefined; },
  };
}
