/** Rasterize this menu's existing DOM, not a second hard-coded menu layout. */
export function paintLiquidMenuContent(panel: HTMLElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context || !panel.clientWidth || !panel.clientHeight) return false;
  const transform = panel.style.transform;
  // Measure once in layout coordinates. Restore synchronously, before any paint.
  panel.style.transform = "none";
  try {
    const bounds = panel.getBoundingClientRect();
    canvas.width = Math.round(bounds.width * 2);
    canvas.height = Math.round(bounds.height * 2);
    context.scale(2, 2);
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height };
    };
    const opacity = (element: Element) => {
      let alpha = 1;
      for (let node: Element | null = element; node && node !== panel; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.visibility === "hidden" || style.display === "none") return 0;
        alpha *= Number(style.opacity);
      }
      return alpha;
    };
    for (const element of panel.querySelectorAll<HTMLElement>("button, .dg-liquid-menu__divider")) {
      const rect = box(element);
      const style = getComputedStyle(element);
      context.globalAlpha = opacity(element);
      context.fillStyle = style.backgroundColor;
      context.beginPath();
      const radius = parseFloat(style.borderRadius) || 0;
      context.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
      context.fill();
      if (element.matches(":focus-visible")) {
        const width = parseFloat(style.outlineWidth);
        const inset = parseFloat(style.outlineOffset) + width / 2;
        context.lineWidth = width;
        context.strokeStyle = style.outlineColor;
        context.beginPath();
        context.roundRect(rect.x - inset, rect.y - inset, rect.width + inset * 2, rect.height + inset * 2, radius + inset);
        context.stroke();
      }
    }
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement || node.parentElement.closest("svg")) continue;
      context.globalAlpha = opacity(node.parentElement);
      paintLiquidText(node, context, bounds);
    }
    for (const svg of panel.querySelectorAll("svg")) paintLiquidSvg(svg, context, bounds, opacity);
    return true;
  } finally {
    panel.style.transform = transform;
  }
}

/** Browser-measured line breaks, shared by menu ink and the bounded backdrop adapter. */
export function paintLiquidText(node: Node, context: CanvasRenderingContext2D, bounds: { left: number; top: number }) {
  const text = node.textContent ?? "", parent = node.parentElement;
  if (!text.trim() || !parent) return;
  const style = getComputedStyle(parent), range = document.createRange();
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
  context.fillStyle = style.color;
  context.textBaseline = "alphabetic";
  range.selectNodeContents(node);
  const rects = range.getClientRects();
  if (rects.length === 1) {
    let rect = rects[0], line = text;
    if (/^(normal|nowrap|pre-line)$/.test(style.whiteSpace)) {
      const first = text.search(/\S/);
      range.setStart(node, first); range.setEnd(node, first + 1);
      rect = range.getBoundingClientRect();
      line = text.slice(first).replace(/\s+/g, " ");
    }
    const metrics = context.measureText(line);
    context.fillText(line, rect.left - bounds.left, rect.top - bounds.top
      + (rect.height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent);
    return;
  }
  // Read browser line breaks and baselines, including localized/wrapped labels.
  let start = 0;
  while (start < text.length) {
    range.setStart(node, start);
    range.setEnd(node, start + 1);
    const first = range.getBoundingClientRect();
    let end = start + 1;
    while (end < text.length) {
      range.setStart(node, end);
      range.setEnd(node, end + 1);
      if (Math.abs(range.getBoundingClientRect().top - first.top) > 1) break;
      end += 1;
    }
    const line = text.slice(start, end);
    const metrics = context.measureText(line);
    const baseline = first.top - bounds.top
      + (first.height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
      + metrics.fontBoundingBoxAscent;
    context.fillText(line, first.left - bounds.left, baseline);
    start = end;
  }
}

export function paintLiquidSvg(svg: SVGSVGElement, context: CanvasRenderingContext2D, bounds: { left: number; top: number }, opacity: (element: Element) => number) {
  const r = svg.getBoundingClientRect(), rect = { x: r.left - bounds.left, y: r.top - bounds.top, width: r.width, height: r.height };
  if (!rect.width || !rect.height || !svg.viewBox.baseVal.width || !svg.viewBox.baseVal.height) return;
  const view = svg.viewBox.baseVal;
  context.save();
  context.translate(rect.x, rect.y);
  context.scale(rect.width / view.width, rect.height / view.height);
  context.translate(-view.x, -view.y);
  // ponytail: this painter covers the menu's Lucide geometry, not arbitrary SVG/CSS.
  for (const shape of svg.children) {
    const attr = (name: string) => Number(shape.getAttribute(name) ?? 0);
    const path = new Path2D(shape.getAttribute("d") ?? "");
    if (shape.tagName === "circle") path.arc(attr("cx"), attr("cy"), attr("r"), 0, Math.PI * 2);
    else if (shape.tagName === "rect") path.roundRect(attr("x"), attr("y"), attr("width"), attr("height"), attr("rx"));
    else if (shape.tagName === "line") { path.moveTo(attr("x1"), attr("y1")); path.lineTo(attr("x2"), attr("y2")); }
    else if (shape.tagName === "polyline" || shape.tagName === "polygon") {
      const points = (shape.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < points.length; i += 2) {
        if (i === 0) path.moveTo(points[i], points[i + 1]);
        else path.lineTo(points[i], points[i + 1]);
      }
      if (shape.tagName === "polygon") path.closePath();
    }
    const style = getComputedStyle(shape);
    context.globalAlpha = opacity(shape);
    context.lineWidth = parseFloat(style.strokeWidth);
    context.lineCap = style.strokeLinecap as CanvasLineCap;
    context.lineJoin = style.strokeLinejoin as CanvasLineJoin;
    if (style.fill !== "none") { context.fillStyle = style.fill; context.fill(path); }
    if (style.stroke !== "none") { context.strokeStyle = style.stroke; context.stroke(path); }
  }
  context.restore();
}
