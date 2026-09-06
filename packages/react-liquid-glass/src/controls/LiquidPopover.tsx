import { cloneElement, createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useTransform } from "motion/react";
import { usePopoverMotion, type PopoverLayout } from "../apple-motion/use-popover-motion";
import { paintLiquidMenuContent } from "../liquid-glass/menu-content";
import { liquidContentOptics } from "../liquid-glass/geometry";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";
import { StageContext, FusionTriggerContext } from "./GlassSurface";

const ClosePopoverContext = createContext<() => void>(() => undefined);
export const useClosePopover = () => useContext(ClosePopoverContext);
const openLayers: HTMLDivElement[] = [];
const PAD = 28;
const TRIGGER = "button, a[href], input, select, textarea, [tabindex]";
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

/** One stable compositor moves into the native top layer with its trigger and popup. */
export function LiquidPopover({ trigger, children, label, role = "dialog", open: controlled, onOpenChange, tooltip = false, className = "", multiple, id: suppliedId }: {
  trigger: ReactElement<ComponentProps<"button">>;
  children: ReactNode;
  label: string;
  role?: "dialog" | "menu" | "listbox" | "tooltip";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tooltip?: boolean;
  multiple?: boolean;
  className?: string;
  id?: string;
}) {
  const generatedId = useId(), id = suppliedId ?? generatedId;
  const [local, setLocal] = useState(false);
  const open = controlled ?? local;
  const liveOpen = useRef(open); liveOpen.current = open;
  const [active, setActive] = useState(false);
  const [host] = useState(() => typeof document === "undefined" ? null : document.createElement("span"));
  const anchor = useRef<HTMLSpanElement>(null), topLayer = useRef<HTMLDivElement>(null), panel = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLCanvasElement | null>(null);
  const revision = useMotionValue(0);
  const ink = useRef<HTMLCanvasElement | null>(null);
  const inkRevision = useMotionValue(0), inkActive = useMotionValue(0);
  const settled = useRef(false);
  const stage = useContext(StageContext);
  const model = usePopoverMotion();
  const layoutRef = useRef<PopoverLayout | null>(null);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 1, height: 1, tx: 0, ty: 0, tw: 1, th: 1, tr: 16, px: 0, py: 0, pw: 1, ph: 1 });
  const callback = useRef(onOpenChange); callback.current = onOpenChange;
  const change = (next: boolean) => { setLocal(next); callback.current?.(next); };
  const changeRef = useRef(change); changeRef.current = change;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusTrigger = useRef(false);
  const mirror = useRef<HTMLDivElement>(null);
  const bodyX = useTransform(model.x, value => value / frame.width), bodyY = useTransform(model.y, value => value / frame.height);
  const triggerW = useTransform(model.trigger, value => frame.tw / 2 * value);
  const triggerH = useTransform(model.trigger, value => frame.th / 2 / Math.sqrt(value));
  const contentTransform = useTransform(() => `translate(${model.x.get() - frame.px}px, ${model.y.get() - frame.py}px) scale(${Math.max(.001, model.w.get() * 2 / frame.pw)}, ${Math.max(.001, model.h.get() * 2 / frame.ph)})`);
  const contentOpacity = useTransform(() => model.reveal.get() * inkActive.get());
  const nativeOpacity = useTransform(() => model.reveal.get() * (1 - inkActive.get()));
  const opticalShape = useTransform(() => liquidContentOptics([model.w.get(), model.h.get(), model.radius.get()], { panelWidth: frame.pw, panelHeight: frame.ph, panelRadius: tooltip ? 14 : 22 }));
  const contentRefraction = useTransform(opticalShape, shape => shape.refraction);
  const contentBlur = useTransform(() => Math.max(opticalShape.get().blur, (1 - model.reveal.get()) * 2));
  const capture = () => {
    if (!panel.current) return;
    const canvas = ink.current ?? document.createElement("canvas"); ink.current = canvas;
    // ponytail: text/icon popups reuse the menu snapshot; forms and canvases stay native during morphs.
    if (panel.current.querySelector("input, textarea, select, canvas")) { inkActive.set(0); return; }
    if (paintLiquidMenuContent(panel.current, canvas)) { inkRevision.set(inkRevision.get() + 1); inkActive.set(1); }
  };
  const contentFilter = useTransform(model.reveal, value => `blur(${(1 - value) * 3}px)`);
  const measureRef = useRef<() => void>(() => undefined);
  measureRef.current = () => {
    const button = anchor.current?.querySelector<HTMLElement>(TRIGGER), element = panel.current;
    if (!button || !anchor.current || !host || !element) return;
    const rect = button.getBoundingClientRect();
    const showing = topLayer.current?.matches(":popover-open") ?? false;
    if (role === "listbox") element.style.minWidth = `${Math.min(innerWidth - 24, rect.width)}px`;
    const pw = showing ? element.offsetWidth : 1, ph = showing ? element.offsetHeight : 1;
    let left = Math.max(12, Math.min(innerWidth - pw - 12, tooltip ? rect.left + (rect.width - pw) / 2 : rect.left));
    const below = rect.bottom + 10, above = rect.top - ph - 10;
    let top = tooltip && above >= 12 ? above : below + ph <= innerHeight - 12 ? below : Math.max(12, above);
    if (!showing) { left = rect.left; top = rect.top; }
    const fl = Math.floor(Math.min(left, rect.left) - PAD), ft = Math.floor(Math.min(top, rect.top) - PAD);
    const fw = Math.ceil(Math.max(left + pw, rect.right) + PAD - fl), fh = Math.ceil(Math.max(top + ph, rect.bottom) + PAD - ft);
    const tx = rect.left + rect.width / 2 - fl, ty = rect.top + rect.height / 2 - ft;
    const style = getComputedStyle(button);
    const tr = Math.min(parseFloat(style.borderRadius) || 16, rect.width / 2, rect.height / 2);
    const layout: PopoverLayout = { triggerX: tx, triggerY: ty, triggerWidth: rect.width, triggerHeight: rect.height, triggerRadius: tr, panelX: left + pw / 2 - fl, panelY: top + ph / 2 - ft, panelWidth: pw, panelHeight: ph, panelRadius: tooltip ? 14 : 22 };
    layoutRef.current = layout;
    if (showing && settled.current) {
      model.x.jump(layout.panelX); model.y.jump(layout.panelY);
      model.w.jump(pw / 2); model.h.jump(ph / 2); model.radius.jump(layout.panelRadius);
    }
    setFrame({ left: fl, top: ft, width: fw, height: fh, tx, ty, tw: rect.width, th: rect.height, tr, px: layout.panelX, py: layout.panelY, pw, ph });
    element.style.left = `${left}px`; element.style.top = `${top}px`;
    if (mirror.current) {
      const copy = button.cloneNode(true) as HTMLElement;
      for (const element of [copy, ...copy.querySelectorAll<HTMLElement>("[id], [tabindex]")]) { element.removeAttribute("id"); element.removeAttribute("tabindex"); }
      Object.assign(copy.style, { width: "100%", height: "100%" });
      mirror.current.replaceChildren(copy);
      Object.assign(mirror.current.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, font: style.font, letterSpacing: style.letterSpacing, color: style.color });
    }
    const parent = showing ? topLayer.current! : anchor.current;
    if (host.parentElement !== parent) parent.appendChild(host);
    const origin = showing ? { left: 0, top: 0 } : anchor.current.getBoundingClientRect();
    Object.assign(host.style, { position: "absolute", left: `${fl - origin.left}px`, top: `${ft - origin.top}px`, width: `${fw}px`, height: `${fh}px`, pointerEvents: "none", zIndex: "0" });
    const canvas = source.current ?? document.createElement("canvas"); source.current = canvas;
    canvas.width = fw * 2; canvas.height = fh * 2;
    const ctx = canvas.getContext("2d")!;
    const dark = style.colorScheme.includes("dark");
    ctx.fillStyle = dark ? "#202020" : "#eeeeec"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (stage?.canvas?.width && stage.root) {
      const substrate = stage.root.getBoundingClientRect();
      ctx.drawImage(stage.canvas, (substrate.left - fl) * 2, (substrate.top - ft) * 2);
    }
    revision.set(revision.get() + 1);
  };
  useLayoutEffect(() => {
    measureRef.current();
    const resize = new ResizeObserver(() => measureRef.current());
    if (anchor.current) resize.observe(anchor.current);
    if (panel.current) resize.observe(panel.current);
    const update = () => measureRef.current();
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { resize.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); host?.remove(); };
  }, [host, stage]);
  useLayoutEffect(() => { measureRef.current(); }, [trigger]);
  useLayoutEffect(() => {
    const element = topLayer.current;
    if (!element) return;
    settled.current = false;
    if (open) {
      element.showPopover(); setActive(true);
      const previous = openLayers.indexOf(element); if (previous >= 0) openLayers.splice(previous, 1);
      openLayers.push(element);
    } else if (!element.matches(":popover-open")) return;
    measureRef.current();
    if (!layoutRef.current) return;
    capture();
    model.transition(layoutRef.current, open, () => {
      settled.current = true; inkActive.jump(0);
      if (!liveOpen.current) {
        element.hidePopover(); setActive(false);
        const index = openLayers.indexOf(element); if (index >= 0) openLayers.splice(index, 1); measureRef.current();
        if (focusTrigger.current) anchor.current?.querySelector<HTMLElement>(TRIGGER)?.focus({ preventScroll: true });
      } else if (!tooltip && !panel.current?.contains(document.activeElement)) {
        panel.current?.querySelector<HTMLElement>('[aria-selected="true"], ' + FOCUSABLE)?.focus({ preventScroll: true });
      }
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (anchor.current?.contains(event.target as Node) || panel.current?.contains(event.target as Node)) return;
      focusTrigger.current = false; changeRef.current(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openLayers.at(-1) === topLayer.current) { event.preventDefault(); focusTrigger.current = !tooltip; changeRef.current(false); }
    };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key); };
  }, [open, tooltip]);
  useEffect(() => {
    const element = topLayer.current;
    return () => { clearTimeout(timer.current); if (element) { const index = openLayers.indexOf(element); if (index >= 0) openLayers.splice(index, 1); } };
  }, []);
  const hover = (next: boolean) => {
    if (!tooltip) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => changeRef.current(next), next ? 180 : 100);
  };
  const close = () => { focusTrigger.current = true; changeRef.current(false); };
  return <>
    <span ref={anchor} className={`dg-popover-anchor ${className}`} data-open={active || undefined}
      onPointerEnter={event => { if (event.pointerType !== "touch") hover(true); }} onPointerLeave={() => hover(false)}
      onFocus={() => { if (tooltip) { clearTimeout(timer.current); change(true); } }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !topLayer.current?.contains(event.relatedTarget)) { if (tooltip) hover(false); } }}>
      <FusionTriggerContext.Provider value={model.press}>
        {cloneElement(trigger, {
          "aria-haspopup": tooltip ? undefined : role as "dialog" | "menu" | "listbox",
          "aria-expanded": tooltip ? undefined : open,
          "aria-controls": tooltip ? undefined : id,
          "aria-describedby": tooltip ? [trigger.props["aria-describedby"], id].filter(Boolean).join(" ") : trigger.props["aria-describedby"],
          onClick: event => { trigger.props.onClick?.(event); if (!tooltip && !event.defaultPrevented) { focusTrigger.current = true; change(!open); } },
          onKeyDown: event => { trigger.props.onKeyDown?.(event); if (!tooltip && !event.defaultPrevented && ["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); change(true); } },
        })}
      </FusionTriggerContext.Provider>
    </span>
    <div ref={topLayer} popover="manual" className="dg-popover-layer" data-open={open || undefined}
      onKeyDown={event => {
        if (event.key !== "Tab" || tooltip) return;
        if (role === "menu" || role === "listbox") {
          anchor.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
          focusTrigger.current = false; change(false); return;
        }
        const focusables = [...panel.current!.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if ((!event.shiftKey && document.activeElement === focusables.at(-1)) || (event.shiftKey && document.activeElement === focusables[0])) {
          focusTrigger.current = false; change(false);
        }
      }}>
      <div ref={mirror} className="dg-popover__trigger-ink" aria-hidden="true" inert />
      <motion.div ref={panel} id={id} role={role} aria-label={tooltip ? undefined : label} aria-multiselectable={role === "listbox" ? multiple : undefined}
        className={`dg-popover__panel ${tooltip ? "dg-popover__panel--tooltip" : ""}`}
        inert={!open} aria-hidden={!open || undefined}
        style={{ opacity: nativeOpacity, transform: contentTransform, filter: contentFilter, borderRadius: tooltip ? 14 : 22 }}
        onPointerEnter={() => { if (tooltip) clearTimeout(timer.current); }} onPointerLeave={() => hover(false)}>
        <ClosePopoverContext.Provider value={close}>{children}</ClosePopoverContext.Provider>
      </motion.div>
    </div>
    {host && createPortal(<LiquidGlassCanvas shared sourceRef={source} sourceRevision={revision}
      contentRef={ink} contentRevision={inkRevision} contentOpacity={contentOpacity} contentRefraction={contentRefraction} contentBlur={contentBlur}
      width={frame.width} height={frame.height} pixelRatio={2} transparentOutside
      blobs={[
        ...(active ? [{ x: bodyX, y: bodyY, radius: model.radius, cornerRadius: model.radius, halfWidth: model.w, halfHeight: model.h }] : []),
        { x: frame.tx / frame.width, y: frame.ty / frame.height, radius: frame.tr, cornerRadius: frame.tr, halfWidth: triggerW, halfHeight: triggerH },
      ]}
      mergeDistance={model.merge} edgeDepth={10} domeDepth={18} refractionStrength={.11}
      chromaAmount={.24} blurStrength={.8} tintStrength={.055} shadowStrength={.11} shadowBlur={18} shadowOffset={6}
      style={{ display: "block", width: "100%", height: "100%" }} />, host)}
  </>;
}
