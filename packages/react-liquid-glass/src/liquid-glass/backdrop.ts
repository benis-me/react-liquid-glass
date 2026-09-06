import { cancelFrame, frame } from "motion";
import { paintLiquidSvg, paintLiquidText } from "./menu-content";
import { liquidBackground } from "./source";
import { subscribeLiquidFrames } from "./renderer";

type Bounds = { left: number; top: number; width: number; height: number };
const intersects = (a: Bounds, b: Bounds) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 && a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

/** Redraw the visible DOM region beneath a glass overlay into its existing material. */
export function paintLiquidBackdrop(root: HTMLElement, canvas: HTMLCanvasElement, bounds: Bounds, exclude: readonly Element[] = []) {
  if (!Object.values(bounds).every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const width = Math.max(1, Math.round(bounds.width * 2)), height = Math.max(1, Math.round(bounds.height * 2));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = liquidBackground(root); ctx.fillRect(0, 0, bounds.width, bounds.height);
  const visit = (element: Element) => {
    if (exclude.includes(element) || element.matches("script, style, link, template, [popover], dialog:not([open])")) return;
    const css = getComputedStyle(element);
    if (css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0) return;
    const rect = element.getBoundingClientRect();
    if (css.display !== "contents" && (!rect.width || !rect.height || !intersects(rect, bounds))) return;
    const x = rect.left - bounds.left, y = rect.top - bounds.top;
    const radius = (value: string) => value.endsWith("%") ? Math.min(rect.width, rect.height) * parseFloat(value) / 100 : parseFloat(value) || 0;
    const corners = [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map(radius);
    ctx.save(); ctx.globalAlpha *= Number(css.opacity);
    ctx.fillStyle = css.backgroundColor;
    ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, corners); ctx.fill();
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
  return true;
}

/** Coalesce visible source changes; no polling or work while the page is hidden. */
export function observeLiquidBackdrop(root: HTMLElement, bounds: () => Bounds, exclude: readonly Element[], refresh: () => void) {
  const relevant = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement;
    return element && !exclude.some(item => item.contains(element)) && intersects(element.getBoundingClientRect(), bounds());
  };
  const update = () => { if (!document.hidden && intersects(bounds(), { left: 0, top: 0, width: innerWidth, height: innerHeight })) frame.preRender(refresh); };
  const observer = new MutationObserver(records => { if (records.some(record => relevant(record.target))) update(); });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "src", "value", "checked", "data-theme"] });
  const sourceFrame = subscribeLiquidFrames(canvas => { if (relevant(canvas)) update(); });
  const event = (event: Event) => { if (event.target instanceof Node && relevant(event.target)) update(); };
  for (const type of ["input", "change", "load", "seeked"]) root.addEventListener(type, event, true);
  document.fonts.addEventListener("loadingdone", update);
  document.addEventListener("visibilitychange", update);
  return () => {
    observer.disconnect(); sourceFrame(); cancelFrame(refresh);
    for (const type of ["input", "change", "load", "seeked"]) root.removeEventListener(type, event, true);
    document.fonts.removeEventListener("loadingdone", update); document.removeEventListener("visibilitychange", update);
  };
}
