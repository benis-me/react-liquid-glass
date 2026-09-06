import { cancelFrame, frame } from "motion";
import { paintLiquidSvg, paintLiquidText } from "./menu-content";
import { liquidBackground, paintLiquidHatch } from "./source";
import { subscribeLiquidFrames } from "./renderer";

type Bounds = { left: number; top: number; width: number; height: number };
const pending = new Set<() => void>();
let batchLayout: WeakMap<Element, { rect: DOMRect; css?: CSSStyleDeclaration }> | undefined;
const layout = (element: Element) => {
  let value = batchLayout?.get(element);
  if (!value) { value = { rect: element.getBoundingClientRect() }; batchLayout?.set(element, value); }
  return value;
};
const style = (element: Element) => { const value = layout(element); return value.css ??= getComputedStyle(element); };
const flush = () => {
  const work = [...pending]; pending.clear();
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
    ctx.save(); ctx.clip(); paintLiquidHatch(ctx, css, rect, bounds); ctx.restore();
    const border = parseFloat(css.borderTopWidth);
    if (border > 0 && css.borderTopStyle !== "none") {
      ctx.lineWidth = border; ctx.strokeStyle = css.borderTopColor; ctx.stroke();
    }
    if (/(hidden|clip|scroll|auto)/.test(`${css.overflowX} ${css.overflowY}`)) { ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, corners); ctx.clip(); }
    // ponytail: this adapter covers DOM text/boxes, Lucide SVG and same-origin media/canvases.
    // Arbitrary CSS effects, cross-origin frames and browser compositor layers need a native backdrop API.
    if (element instanceof HTMLCanvasElement || element instanceof HTMLImageElement || element instanceof HTMLVideoElement) {
      const sw = element instanceof HTMLImageElement ? element.naturalWidth : element instanceof HTMLVideoElement ? element.videoWidth : element.width;
      const sh = element instanceof HTMLImageElement ? element.naturalHeight : element instanceof HTMLVideoElement ? element.videoHeight : element.height;
      const safe = element instanceof HTMLCanvasElement || !element.currentSrc || new URL(element.currentSrc, location.href).origin === location.origin;
      if (sw && sh && safe) {
        const scale = css.objectFit === "cover" ? Math.max(rect.width / sw, rect.height / sh) : css.objectFit === "contain" ? Math.min(rect.width / sw, rect.height / sh) : 0;
        const w = scale ? sw * scale : rect.width, h = scale ? sh * scale : rect.height;
        ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, corners); ctx.clip(); ctx.filter = css.filter;
        ctx.drawImage(element, x + (rect.width - w) / 2, y + (rect.height - h) / 2, w, h); ctx.restore();
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
  const invalidate = (node: Node, regions?: readonly Bounds[]) => {
    if (document.hidden) return;
    const element = node instanceof Element ? node : node.parentElement;
    if (!element || !root.contains(element) || !behind(element, before?.()) || element.closest("[popover], [data-dg-highlight-hdr]") || exclude.some(item => item.contains(element))) return;
    const previous = changes.get(element);
    changes.set(element, changes.has(element) ? previous && regions ? [...previous, ...regions] : undefined : regions);
    scheduleLiquidBackdrop(check);
  };
  const update = () => { force = true; scheduleLiquidBackdrop(check); };
  const observer = new MutationObserver(records => { for (const record of records) invalidate(record.target); });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "src", "width", "height", "hidden", "value", "checked", "data-theme"] });
  const sourceFrame = subscribeLiquidFrames(invalidate);
  const event = (event: Event) => { if (event.target instanceof Node) invalidate(event.target); };
  for (const type of ["input", "change", "load", "seeked"]) root.addEventListener(type, event, true);
  document.fonts.addEventListener("loadingdone", update);
  document.addEventListener("visibilitychange", update);
  return () => {
    observer.disconnect(); sourceFrame(); changes.clear(); cancelLiquidBackdrop(check); cancelLiquidBackdrop(refresh);
    for (const type of ["input", "change", "load", "seeked"]) root.removeEventListener(type, event, true);
    document.fonts.removeEventListener("loadingdone", update); document.removeEventListener("visibilitychange", update);
  };
}

/** Retain the same bounded DOM backdrop for inline controls and explicit lenses. */
export function createLiquidBackdrop(owner: HTMLElement, bounds: () => Bounds, changed: (canvas: HTMLCanvasElement) => void, visible: () => boolean = () => true) {
  const canvas = document.createElement("canvas");
  let sourceRoot: HTMLElement | undefined, offsetX = 0, offsetY = 0;
  const refresh = () => {
    const rect = bounds();
    if (!visible() || document.hidden || !owner.isConnected || !owner.getClientRects().length || !intersects(rect, { left: 0, top: 0, width: innerWidth, height: innerHeight })) return;
    sourceRoot = backdropRoot(owner, rect);
    const sourceRect = layout(sourceRoot).rect;
    offsetX = rect.left - sourceRect.left; offsetY = rect.top - sourceRect.top;
    if (paintLiquidBackdrop(sourceRoot, canvas, rect, [owner], rect, owner)) changed(canvas);
  };
  const update = () => scheduleLiquidBackdrop(refresh);
  const scroll = () => {
    if (!visible()) return;
    const rect = bounds();
    // Offscreen source changes are intentionally skipped; repaint on return.
    if (!intersects(rect, { left: 0, top: 0, width: innerWidth, height: innerHeight })) { sourceRoot = undefined; return; }
    if (sourceRoot) {
      const parent = sourceRoot.getBoundingClientRect();
      // A page-flow scene and its lens move together during page scrolling.
      // DOM changes and canvas frames still invalidate the retained pixels.
      if (Math.abs(rect.left - parent.left - offsetX) < .01 && Math.abs(rect.top - parent.top - offsetY) < .01) return;
    }
    update();
  };
  const stop = observeLiquidBackdrop(document.documentElement, bounds, [owner], refresh, () => owner);
  const resize = new ResizeObserver(update); resize.observe(owner);
  window.addEventListener("resize", update); window.addEventListener("scroll", scroll, true);
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update);
  update();
  return { refresh: update, dispose() {
    stop(); resize.disconnect(); cancelLiquidBackdrop(refresh);
    window.removeEventListener("resize", update); window.removeEventListener("scroll", scroll, true);
    viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update);
  } };
}
