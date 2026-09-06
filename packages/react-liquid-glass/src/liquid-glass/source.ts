import { readMotion, type MotionInput } from "../shared/values";

export type LiquidSourcePainter = (context: CanvasRenderingContext2D) => void;
export type LiquidSourceFactory = (root: HTMLElement, width: number, height: number) => LiquidSourcePainter;

/** The centered, one-CSS-pixel grid shared by stages and explicit canvas scenes. */
export function paintLiquidGrid(ctx: CanvasRenderingContext2D, width: number, height: number, dark: boolean) {
  ctx.fillStyle = dark ? "#202020" : "#f3f3f1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = dark ? "#ffffff10" : "#e5e5e2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.round((width / 2) % 54) + .5; x < width; x += 54) {
    ctx.moveTo(x, 0); ctx.lineTo(x, height);
  }
  for (let y = Math.round((height / 2) % 54) + .5; y < height; y += 54) {
    ctx.moveTo(0, y); ctx.lineTo(width, y);
  }
  ctx.stroke();
}

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | undefined;
let themeRevision = 0;
const notifyTheme = () => { themeRevision++; themeListeners.forEach(listener => listener()); };
const themeTransitionEnd = (event: TransitionEvent) => {
  if ((event.target === document.body || event.target === document.documentElement)
    && (event.propertyName === "background-color" || event.propertyName === "color")) notifyTheme();
};
export function subscribeLiquidTheme(notify: () => void) {
  themeListeners.add(notify);
  if (!themeObserver) {
    themeObserver = new MutationObserver(notifyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("transitionend", themeTransitionEnd);
  }
  return () => {
    themeListeners.delete(notify);
    if (!themeListeners.size) {
      themeObserver?.disconnect(); themeObserver = undefined;
      document.removeEventListener("transitionend", themeTransitionEnd);
    }
  };
}
export const liquidTheme = () => `${document.documentElement.dataset.theme ?? "light"}:${themeRevision}`;

/** Resolve CSS tokens once when a source is prepared, never in an animation loop. */
export function liquidCssColor(root: HTMLElement, value: string): string {
  const css = getComputedStyle(root);
  const host = document.createElement("span");
  const probe = document.createElement("span");
  // Never probe the live source: changing its color starts inherited transitions,
  // whose transitionend listener captures the source and probes its color again.
  host.style.cssText = "position:fixed;visibility:hidden;contain:strict;width:0;height:0;pointer-events:none";
  host.style.color = css.color;
  host.style.colorScheme = css.colorScheme;
  for (const property of css) {
    if (property.startsWith("--")) host.style.setProperty(property, css.getPropertyValue(property));
  }
  probe.style.setProperty("transition", "none", "important");
  probe.style.setProperty("animation", "none", "important");
  probe.style.color = value;
  host.appendChild(probe);
  document.body.appendChild(host);
  try { return getComputedStyle(probe).color; }
  finally { host.remove(); }
}

export function liquidBackground(root: HTMLElement): string {
  const colors: string[] = [];
  for (let node: HTMLElement | null = root; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color !== "transparent" && color !== "rgba(0, 0, 0, 0)") colors.push(color);
    // The usual opaque page needs no canvas allocation or synchronous pixel readback.
    if (/^rgb\(/.test(color)) { if (colors.length === 1) return color; break; }
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1, 1);
  // Translucent ancestor surfaces must composite over the page, not become a white source.
  for (const color of colors.reverse()) { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); }
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r} ${g} ${b})`;
}

type BackgroundBounds = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** Match a thin 135deg CSS hatch, with its phase anchored to the background box. */
export function paintLiquidHatch(ctx: CanvasRenderingContext2D, css: CSSStyleDeclaration, rect: BackgroundBounds, bounds: BackgroundBounds) {
  // ponytail: only this two-color repeating gradient is supported; other CSS backgrounds need an explicit source.
  const stripe = css.backgroundImage.match(/^repeating-linear-gradient\(135deg, (rgba?\([^)]+\)) 0px, \1 ([\d.]+)px, rgba\(0, 0, 0, 0\) \2px, rgba\(0, 0, 0, 0\) ([\d.]+)px\)$/);
  if (!stripe) return;
  const width = Number(stripe[2]), period = Number(stripe[3]);
  if (!(width > 0 && period > width)) return;
  const step = period * Math.SQRT2, origin = bounds.left - rect.left + bounds.top - rect.top;
  const lines = new Path2D();
  for (let d = Math.floor(origin / step) * step; d < origin + bounds.width + bounds.height; d += step) {
    const y = d + width / Math.SQRT2 - origin;
    lines.moveTo(0, y); lines.lineTo(bounds.width, y - bounds.width);
  }
  ctx.save(); ctx.strokeStyle = stripe[1]; ctx.lineWidth = width; ctx.stroke(lines); ctx.restore();
}

/** Ancestor colors and supported background patterns, in viewport coordinates. */
export function paintLiquidBackground(root: HTMLElement, ctx: CanvasRenderingContext2D, bounds: BackgroundBounds) {
  const layers: HTMLElement[] = [];
  for (let node: HTMLElement | null = root; node; node = node.parentElement) layers.push(node);
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, bounds.width, bounds.height);
  for (const node of layers.reverse()) {
    const css = getComputedStyle(node);
    ctx.fillStyle = css.backgroundColor; ctx.fillRect(0, 0, bounds.width, bounds.height);
    paintLiquidHatch(ctx, css, node.getBoundingClientRect(), bounds);
  }
}

export function liquidRgb(root: HTMLElement, value: string): readonly [number, number, number] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = liquidCssColor(root, value);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/** Retained analytic track painting uses the very same live values as the native control. */
export function liquidTrackSource(options: {
  kind: "switch" | "slider"; width: number; trackHeight: number; travel: number;
  offset: MotionInput; scaleX: MotionInput; scaleY: MotionInput;
}): LiquidSourceFactory {
  return (root, width, height) => {
    const off = liquidCssColor(root, options.kind === "switch" ? "var(--dg-switch-off)" : "var(--dg-control-track)");
    const on = liquidCssColor(root, options.kind === "switch" ? "var(--dg-switch-on)" : "var(--dg-control-accent)");
    const rounded = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
    };
    return ctx => {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      const w = options.width * readMotion(options.scaleX);
      const h = options.trackHeight * readMotion(options.scaleY);
      const progress = Math.max(0, Math.min(1, readMotion(options.offset) / Math.max(1, options.travel)));
      ctx.fillStyle = off; rounded(ctx, w, h);
      ctx.fillStyle = on;
      if (options.kind === "switch") { ctx.globalAlpha = progress; rounded(ctx, w, h); }
      else {
        ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.clip();
        // Match the native refracted fill: slide a complete capsule under the clip.
        ctx.translate((progress - 1) * w, 0); rounded(ctx, w, h);
      }
      ctx.restore();
    };
  };
}

const svgImages = new Map<string, Promise<HTMLImageElement>>();
async function rasterSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = [svg, ...svg.querySelectorAll("*")];
  const target = [clone, ...clone.querySelectorAll("*")];
  source.forEach((node, index) => {
    const css = getComputedStyle(node);
    for (const key of ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "opacity", "mask"]) {
      const value = css.getPropertyValue(key).replace(/url\(["']?[^#)]*#([^"')]+)["']?\)/g, "url(#$1)");
      (target[index] as SVGElement).style.setProperty(key, value);
    }
  });
  const data = new XMLSerializer().serializeToString(clone);
  let pending = svgImages.get(data);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = reject;
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
    });
    if (svgImages.size >= 64) svgImages.delete(svgImages.keys().next().value!);
    svgImages.set(data, pending);
  }
  return pending;
}

/**
 * Snapshot the existing specimen, not a duplicate React layout. This is called at
 * content/theme/font/resize boundaries; lens movement only samples the retained texture.
 * ponytail: supports this project's images, grid, text and SVG; use an explicit
 * source factory/Canvas for arbitrary CSS effects instead of guessing their pixels.
 */
export async function captureLiquidSource(root: HTMLElement, width: number, height: number, background?: LiquidSourcePainter) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * 2));
  canvas.height = Math.max(1, Math.round(height * 2));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = liquidBackground(root.parentElement!); ctx.fillRect(0, 0, width, height);
  background?.(ctx);
  const bounds = root.getBoundingClientRect();
  for (const element of root.querySelectorAll<HTMLElement>("div, span, button, img")) {
    if (element.closest("svg")) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const css = getComputedStyle(element);
    if (css.display === "none" || css.visibility === "hidden") continue;
    const x = rect.left - bounds.left, y = rect.top - bounds.top;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, parseFloat(css.borderRadius) || 0);
    ctx.clip();
    ctx.fillStyle = css.backgroundColor; ctx.fillRect(x, y, rect.width, rect.height);
    paintLiquidHatch(ctx, css, rect, bounds);
    if (element instanceof HTMLImageElement && element.complete && element.naturalWidth) {
      const ratio = css.objectFit === "cover" ? Math.max(rect.width / element.naturalWidth, rect.height / element.naturalHeight) : 0;
      const w = ratio ? element.naturalWidth * ratio : rect.width;
      const h = ratio ? element.naturalHeight * ratio : rect.height;
      ctx.filter = css.filter;
      ctx.drawImage(element, x + (rect.width - w) / 2, y + (rect.height - h) / 2, w, h);
    }
    ctx.restore();
  }
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!text.trim() || !node.parentElement || node.parentElement.closest("svg")) continue;
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const css = getComputedStyle(node.parentElement);
    ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    ctx.letterSpacing = css.letterSpacing === "normal" ? "0px" : css.letterSpacing;
    ctx.fillStyle = css.color;
    const metrics = ctx.measureText(text);
    const baseline = rect.top - bounds.top + (rect.height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;
    ctx.fillText(text, rect.left - bounds.left, baseline);
  }
  await Promise.all([...root.querySelectorAll("svg")].map(async svg => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const image = await rasterSvg(svg);
    ctx.drawImage(image, rect.left - bounds.left, rect.top - bounds.top, rect.width, rect.height);
  }));
  return canvas;
}
