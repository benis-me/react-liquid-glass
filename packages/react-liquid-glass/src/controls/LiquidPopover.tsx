import { cloneElement, createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useTransform } from "motion/react";
import { cancelFrame, frame as motionFrame } from "motion";
import { usePopoverMotion, type PopoverLayout } from "../apple-motion/use-popover-motion";
import { useGlassContact } from "../apple-motion/use-glass-contact";
import { paintLiquidMenuContent } from "../liquid-glass/menu-content";
import { liquidContentOptics, liquidSurfaceBlur } from "../liquid-glass/geometry";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";
import { paintLiquidBackdrop, observeLiquidBackdrop, scheduleLiquidBackdrop, cancelLiquidBackdrop } from "../liquid-glass/backdrop";
import { useGlassMaterial } from "../liquid-glass/provider";
import { StageContext, FusionTriggerContext, SURFACE_MATERIAL } from "./GlassSurface";

const ClosePopoverContext = createContext<() => void>(() => undefined);
export const useClosePopover = () => useContext(ClosePopoverContext);
const openLayers: HTMLElement[] = [];
const TRIGGER = "button, a[href], input, select, textarea, [tabindex]";
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

/** One stable compositor moves into the native top layer with its trigger and popup. */
export function LiquidPopover({ trigger, children, label, role = "dialog", open: controlled, onOpenChange, tooltip = false, className = "", multiple, id: suppliedId, morphTrigger = false, placement, descriptionId, blurStrength }: {
  trigger?: ReactElement<ComponentProps<"button">>;
  children: ReactNode;
  label: string;
  role?: "dialog" | "menu" | "listbox" | "tooltip";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tooltip?: boolean;
  multiple?: boolean;
  className?: string;
  id?: string;
  morphTrigger?: boolean;
  placement?: "dialog" | "sheet";
  descriptionId?: string;
  blurStrength?: number;
}) {
  const modal = !!placement, absorbsTrigger = modal || morphTrigger;
  const Layer = modal ? "dialog" : "div";
  const opener = useRef<HTMLElement | null>(null), point = useRef({ x: .5, y: .5 });
  const originalVisibility = useRef("");
  const generatedId = useId(), id = suppliedId ?? generatedId;
  const [local, setLocal] = useState(false);
  const open = controlled ?? local;
  const liveOpen = useRef(open); liveOpen.current = open;
  const [active, setActive] = useState(false);
  const [host] = useState(() => typeof document === "undefined" ? null : document.createElement("span"));
  const anchor = useRef<HTMLSpanElement>(null), topLayer = useRef<HTMLDivElement | HTMLDialogElement>(null), panel = useRef<HTMLDivElement>(null);
  const showing = () => topLayer.current instanceof HTMLDialogElement ? topLayer.current.open : topLayer.current?.matches(":popover-open") ?? false;
  const contact = useGlassContact(anchor, { deform: false });
  const source = useRef<HTMLCanvasElement | null>(null);
  const revision = useMotionValue(0);
  const ink = useRef<HTMLCanvasElement | null>(null);
  const inkRevision = useMotionValue(0), inkActive = useMotionValue(0);
  const settled = useRef(false);
  const hasOpened = useRef(false);
  const stage = useContext(StageContext);
  const material = useGlassMaterial();
  const padding = Math.ceil(Math.max(28, (material.shadowBlur ?? 18) * 3 + Math.abs(material.shadowOffset ?? 6)));
  const model = usePopoverMotion();
  const layoutRef = useRef<PopoverLayout | null>(null);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 1, height: 1, tx: 0, ty: 0, tw: 1, th: 1, tr: 16, px: 0, py: 0, pw: 1, ph: 1 });
  const callback = useRef(onOpenChange); callback.current = onOpenChange;
  const change = (next: boolean) => { setLocal(next); callback.current?.(next); };
  const changeRef = useRef(change); changeRef.current = change;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusTrigger = useRef(false);
  const mirror = useRef<HTMLDivElement>(null);
  const mirrorDirty = useRef(true);
  const frameRef = useRef(frame);
  const bodyX = useTransform(model.x, value => value / frame.width), bodyY = useTransform(model.y, value => value / frame.height);
  const triggerW = useTransform(model.trigger, value => frame.tw / 2 * value);
  const triggerH = useTransform(model.trigger, value => frame.th / 2 * value);
  const triggerOpacity = useTransform(model.trigger, value => absorbsTrigger ? Math.min(1, value) : 1);
  const contentTransform = useTransform(() => `translate(${model.x.get() - frame.px}px, ${model.y.get() - frame.py}px) scale(${Math.max(.001, model.w.get() * 2 / frame.pw)}, ${Math.max(.001, model.h.get() * 2 / frame.ph)})`);
  const contentOpacity = useTransform(() => model.reveal.get() * inkActive.get());
  const nativeOpacity = useTransform(() => model.reveal.get() * (1 - inkActive.get()));
  const opticalShape = useTransform(() => liquidContentOptics([model.w.get(), model.h.get(), model.radius.get()], { panelWidth: frame.pw, panelHeight: frame.ph, panelRadius: modal ? 28 : tooltip ? 14 : 22 }));
  const contentRefraction = useTransform(opticalShape, shape => shape.refraction);
  const contentBlur = useTransform(() => Math.max(opticalShape.get().blur, (1 - model.reveal.get()) * 2));
  const backgroundBlur = useTransform(() => liquidSurfaceBlur(model.w.get() * 2, model.h.get() * 2) * (blurStrength ?? (modal ? 18 : 12)) / 12);
  const triggerClip = useTransform(() => {
    if (!active) return "none";
    const w = Math.max(0, model.w.get()), h = Math.max(0, model.h.get());
    const r = Math.min(w, h, Math.max(0, model.radius.get()));
    const x = model.x.get() - w - frame.tx + frame.tw / 2, y = model.y.get() - h - frame.ty + frame.th / 2;
    // Keep the returning trigger ink, except where the live panel covers it.
    return `path(evenodd, "M0 0H${frame.tw}V${frame.th}H0Z M${x + r} ${y}h${2 * (w - r)}a${r} ${r} 0 0 1 ${r} ${r}v${2 * (h - r)}a${r} ${r} 0 0 1 ${-r} ${r}h${-2 * (w - r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-2 * (h - r)}a${r} ${r} 0 0 1 ${r} ${-r}Z")`;
  });
  const capture = () => {
    if (!panel.current) return;
    const canvas = ink.current ?? document.createElement("canvas"); ink.current = canvas;
    // ponytail: text/icon popups reuse the menu snapshot; forms and canvases stay native during morphs.
    if (panel.current.querySelector("input, textarea, select, canvas")) { inkActive.set(0); return; }
    if (paintLiquidMenuContent(panel.current, canvas)) { inkRevision.set(inkRevision.get() + 1); inkActive.set(1); }
  };
  const refreshInk = () => { if (!settled.current && inkActive.get()) capture(); };
  const contentFilter = useTransform(model.reveal, value => `blur(${(1 - value) * 3}px)`);
  const measureRef = useRef<() => void>(() => undefined);
  const backdropBounds = useRef({ left: 0, top: 0, width: 1, height: 1 });
  const paintBackdrop = () => {
    if (!source.current || !anchor.current || !topLayer.current) return;
    const rect = (opener.current ?? anchor.current).getBoundingClientRect();
    // Custom frost/refraction may sample farther; retain their full source area.
    const full = showing() || material.blurStrength !== undefined || material.refractionStrength !== undefined;
    const region = full ? backdropBounds.current : { left: rect.left - 24, top: rect.top - 24, width: rect.width + 48, height: rect.height + 48 };
    if (paintLiquidBackdrop(document.body, source.current, backdropBounds.current, [anchor.current, topLayer.current, ...(opener.current ? [opener.current] : [])], region, showing() ? undefined : anchor.current)) revision.set(revision.get() + 1);
  };
  const paintBackdropRef = useRef(paintBackdrop); paintBackdropRef.current = paintBackdrop;
  const refreshBackdrop = useCallback(() => paintBackdropRef.current(), []);
  measureRef.current = () => {
    const button = anchor.current?.querySelector<HTMLElement>(TRIGGER) ?? opener.current, element = panel.current;
    if ((!button && !modal) || !anchor.current || !host || !element) return;
    const rect = button?.getBoundingClientRect() ?? new DOMRect(innerWidth / 2 - 24, innerHeight / 2 - 18, 48, 36);
    if (!rect.width || !rect.height) return;
    const isShowing = showing();
    opener.current = button;
    const viewport = window.visualViewport;
    const vl = viewport?.offsetLeft ?? 0, vt = viewport?.offsetTop ?? 0;
    const vw = viewport?.width ?? innerWidth, vh = viewport?.height ?? innerHeight;
    const layerOrigin = isShowing ? topLayer.current!.getBoundingClientRect() : { left: 0, top: 0 };
    if (role === "listbox") element.style.minWidth = `${Math.min(vw - 24, rect.width)}px`;
    // Retain the opened frame at rest. Resizing its last bitmap down to the trigger
    // before Motion draws the next frame caused a one-frame closing flash.
    const pw = isShowing ? element.offsetWidth : layoutRef.current?.panelWidth ?? 1;
    const ph = isShowing ? element.offsetHeight : layoutRef.current?.panelHeight ?? 1;
    let left = Math.max(vl + 12, Math.min(vl + vw - pw - 12, tooltip ? rect.left + (rect.width - pw) / 2 : rect.left));
    const below = rect.bottom + 10, above = rect.top - ph - 10;
    let top = tooltip && above >= vt + 12 ? above : below + ph <= vt + vh - 12 ? below : Math.max(vt + 12, above);
    if (modal) {
      left = placement === "sheet" ? vl + vw - pw - 16 : vl + (vw - pw) / 2;
      top = placement === "sheet" ? vt + 16 : vt + (vh - ph) / 2;
    }
    if (!isShowing && !hasOpened.current) { left = rect.left; top = rect.top; }
    const fl = Math.floor(Math.min(left, rect.left) - padding), ft = Math.floor(Math.min(top, rect.top) - padding);
    const fw = Math.ceil(Math.max(left + pw, rect.right) + padding - fl), fh = Math.ceil(Math.max(top + ph, rect.bottom) + padding - ft);
    const tx = rect.left + rect.width / 2 - fl, ty = rect.top + rect.height / 2 - ft;
    const style = getComputedStyle(button ?? anchor.current);
    const tr = Math.min(parseFloat(style.borderRadius) || 16, rect.width / 2, rect.height / 2);
    const layout: PopoverLayout = { triggerX: tx, triggerY: ty, triggerWidth: rect.width, triggerHeight: rect.height, triggerRadius: tr, panelX: left + pw / 2 - fl, panelY: top + ph / 2 - ft, panelWidth: pw, panelHeight: ph, panelRadius: modal ? 28 : tooltip ? 14 : 22,
      ...(modal ? { originX: tx + rect.width * (point.current.x - .5), originY: ty + rect.height * (point.current.y - .5) } : {}),
    };
    layoutRef.current = layout;
    const nextFrame = { left: fl, top: ft, width: fw, height: fh, tx, ty, tw: rect.width, th: rect.height, tr, px: layout.panelX, py: layout.panelY, pw, ph };
    const changed = (Object.keys(nextFrame) as Array<keyof typeof nextFrame>).some(key => nextFrame[key] !== frameRef.current[key]);
    if (changed && isShowing && settled.current) {
      model.x.jump(layout.panelX); model.y.jump(layout.panelY);
      model.w.jump(pw / 2); model.h.jump(ph / 2); model.radius.jump(layout.panelRadius);
    }
    if (changed) { frameRef.current = nextFrame; setFrame(nextFrame); }
    element.style.left = `${left - layerOrigin.left}px`; element.style.top = `${top - layerOrigin.top}px`;
    if (button && mirror.current && mirrorDirty.current) {
      mirrorDirty.current = false;
      const copy = button.cloneNode(true) as HTMLElement;
      // Computed `font` can be empty for variable fonts. Copy the longhands so
      // moving into the top layer preserves both trigger metrics and local styles.
      const originals = [button, ...button.querySelectorAll<HTMLElement>("*")];
      const copies = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
      originals.forEach((node, index) => {
        const computed = getComputedStyle(node);
        for (const property of ["font-family", "font-size", "font-weight", "font-style", "font-stretch", "font-variant", "font-feature-settings", "font-variation-settings", "font-kerning", "font-optical-sizing", "line-height", "letter-spacing", "text-transform", "color", "white-space"]) {
          copies[index].style.setProperty(property, computed.getPropertyValue(property));
        }
      });
      for (const element of [copy, ...copy.querySelectorAll<HTMLElement>("[id], [tabindex]")]) { element.removeAttribute("id"); element.removeAttribute("tabindex"); }
      copy.querySelectorAll(".dg-surface__optics").forEach(element => element.remove());
      Object.assign(copy.style, { width: "100%", height: "100%", visibility: "visible" });
      mirror.current.replaceChildren(copy);
    }
    if (mirror.current && (changed || isShowing)) Object.assign(mirror.current.style, { left: `${rect.left - layerOrigin.left}px`, top: `${rect.top - layerOrigin.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    const parent = isShowing ? topLayer.current! : anchor.current;
    if (host.parentElement !== parent) parent.appendChild(host);
    const origin = isShowing ? layerOrigin : anchor.current.getBoundingClientRect();
    Object.assign(host.style, { position: "absolute", left: `${fl - origin.left}px`, top: `${ft - origin.top}px`, width: `${fw}px`, height: `${fh}px`, pointerEvents: "none", zIndex: "0" });
    const canvas = source.current ?? document.createElement("canvas"); source.current = canvas;
    backdropBounds.current = { left: fl, top: ft, width: fw, height: fh };
    scheduleLiquidBackdrop(refreshBackdrop);
  };
  useLayoutEffect(() => {
    measureRef.current();
    const measure = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (document.hidden || !rect || (!liveOpen.current && (rect.bottom < 0 || rect.top > innerHeight))) return;
      measureRef.current();
    };
    const update = () => motionFrame.read(measure);
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      update();
    };
    const resize = new ResizeObserver(() => { mirrorDirty.current = true; update(); });
    if (anchor.current) resize.observe(anchor.current);
    if (panel.current) resize.observe(panel.current);
    window.addEventListener("resize", update); window.addEventListener("scroll", scroll, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update);
    return () => {
      cancelFrame(measure); cancelLiquidBackdrop(refreshBackdrop); resize.disconnect();
      window.removeEventListener("resize", update); window.removeEventListener("scroll", scroll, true);
      viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update); host?.remove();
    };
  }, [host, stage]);
  useEffect(() => {
    if (!anchor.current || !topLayer.current) return;
    return observeLiquidBackdrop(document.documentElement,
      () => liveOpen.current ? backdropBounds.current : anchor.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 },
      [anchor.current, topLayer.current], refreshBackdrop, () => liveOpen.current ? undefined : anchor.current ?? undefined);
  }, [stage]);
  useLayoutEffect(() => { mirrorDirty.current = true; measureRef.current(); }, [trigger, padding]);
  useLayoutEffect(() => {
    const element = topLayer.current;
    if (!element) return;
    settled.current = false;
    if (open) {
      hasOpened.current = true;
      if (modal && !showing()) {
        if (!trigger && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) { opener.current = document.activeElement; point.current = { x: .5, y: .5 }; }
        (element as HTMLDialogElement).showModal();
      } else if (!modal) element.showPopover();
      setActive(true);
      const previous = openLayers.indexOf(element); if (previous >= 0) openLayers.splice(previous, 1);
      openLayers.push(element);
    } else if (!showing()) return;
    measureRef.current();
    if (!layoutRef.current) return;
    // Focus styling belongs in the captured ink from the start, not just after
    // the native DOM returns at the end of opening.
    if (open && !tooltip && !panel.current?.contains(document.activeElement)) {
      panel.current?.querySelector<HTMLElement>('[aria-selected="true"], ' + FOCUSABLE)?.focus({ preventScroll: true });
    }
    capture();
    if (modal && !trigger && opener.current && opener.current.style.visibility !== "hidden") {
      originalVisibility.current = opener.current.style.visibility; opener.current.style.visibility = "hidden";
    }
    model.transition(layoutRef.current, open, () => {
      settled.current = true; inkActive.jump(0);
      if (!liveOpen.current) {
        anchor.current?.removeAttribute("data-open");
        anchor.current?.removeAttribute("inert");
        if (modal) (element as HTMLDialogElement).close(); else element.hidePopover();
        if (modal && !trigger && opener.current) opener.current.style.visibility = originalVisibility.current;
        setActive(false);
        const index = openLayers.indexOf(element); if (index >= 0) openLayers.splice(index, 1); measureRef.current();
        if (modal || focusTrigger.current) opener.current?.focus({ preventScroll: true });
      } else if (!tooltip && !panel.current?.contains(document.activeElement)) {
        panel.current?.querySelector<HTMLElement>('[aria-selected="true"], ' + FOCUSABLE)?.focus({ preventScroll: true });
      }
    }, { morphTrigger: absorbsTrigger, duration: modal ? .5 : undefined });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (anchor.current?.contains(event.target as Node) || panel.current?.contains(event.target as Node)) return;
      focusTrigger.current = false; changeRef.current(false);
    };
    const key = (event: KeyboardEvent) => {
      if (!modal && event.key === "Escape" && openLayers.at(-1) === topLayer.current) { event.preventDefault(); focusTrigger.current = !tooltip; changeRef.current(false); }
    };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key); };
  }, [open, tooltip, modal]);
  useEffect(() => {
    const element = topLayer.current;
    return () => { clearTimeout(timer.current); if (modal && !trigger && opener.current) opener.current.style.visibility = originalVisibility.current; if (element) { const index = openLayers.indexOf(element); if (index >= 0) openLayers.splice(index, 1); } };
  }, []);
  const hover = (next: boolean) => {
    if (!tooltip) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => changeRef.current(next), next ? 180 : 100);
  };
  const close = () => { focusTrigger.current = true; changeRef.current(false); };
  return <>
    <span ref={anchor} className={`dg-popover-anchor ${className}`} data-open={active || undefined} inert={absorbsTrigger && active}
      onPointerEnter={event => { if (event.pointerType !== "touch") hover(true); }} onPointerLeave={() => hover(false)}
      onFocus={() => { if (tooltip) { clearTimeout(timer.current); change(true); } }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !topLayer.current?.contains(event.relatedTarget)) { if (tooltip) hover(false); } }}>
      <FusionTriggerContext.Provider value={model.press}>
        {trigger && cloneElement(trigger, {
          "aria-haspopup": tooltip ? undefined : role as "dialog" | "menu" | "listbox",
          "aria-expanded": tooltip ? undefined : open,
          "aria-controls": tooltip ? undefined : id,
          "aria-describedby": tooltip ? [trigger.props["aria-describedby"], id].filter(Boolean).join(" ") : trigger.props["aria-describedby"],
          onClick: event => { trigger.props.onClick?.(event); if (!tooltip && !event.defaultPrevented) {
            opener.current = event.currentTarget;
            const rect = event.currentTarget.getBoundingClientRect();
            point.current = event.detail && rect.width && rect.height ? { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height } : { x: .5, y: .5 };
            focusTrigger.current = true; change(!open);
          } },
          onKeyDown: event => { trigger.props.onKeyDown?.(event); if (!tooltip && !event.defaultPrevented && ["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); change(true); } },
        })}
      </FusionTriggerContext.Provider>
    </span>
    <Layer ref={(element: HTMLDivElement | HTMLDialogElement | null) => { topLayer.current = element; }} id={modal ? id : undefined} popover={modal ? undefined : "manual"} className={modal ? `dg-dialog dg-dialog--${placement}` : "dg-popover-layer"} data-open={open || undefined}
      aria-label={modal ? label : undefined} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); change(false); }}
      onClose={event => { if (modal && liveOpen.current && !(event.currentTarget as HTMLDialogElement).open) change(false); }}
      onPointerDown={event => { if (modal && event.target === event.currentTarget) change(false); }}
      onKeyDown={event => {
        if (event.key !== "Tab" || tooltip || modal) return;
        if (role === "menu" || role === "listbox") {
          anchor.current?.removeAttribute("inert");
          anchor.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
          focusTrigger.current = false; change(false); return;
        }
        const focusables = [...panel.current!.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if ((!event.shiftKey && document.activeElement === focusables.at(-1)) || (event.shiftKey && document.activeElement === focusables[0])) {
          focusTrigger.current = false; change(false);
        }
      }}>
      <motion.div ref={mirror} className="dg-popover__trigger-ink" aria-hidden="true" inert style={{ clipPath: triggerClip, opacity: triggerOpacity, scale: absorbsTrigger ? model.trigger : 1 }} />
      <motion.div ref={panel} id={modal ? `${id}-body` : id} role={modal ? undefined : role} aria-label={tooltip || modal ? undefined : label} aria-multiselectable={role === "listbox" ? multiple : undefined}
        className={modal ? "dg-dialog__body" : `dg-popover__panel ${tooltip ? "dg-popover__panel--tooltip" : ""}`}
        inert={!open} aria-hidden={!open || undefined}
        style={{ opacity: nativeOpacity, transform: contentTransform, filter: contentFilter, borderRadius: modal ? 28 : tooltip ? 14 : 22 }}
        onFocus={refreshInk} onPointerOver={refreshInk} onPointerOut={refreshInk}
        onScroll={refreshInk}
        onPointerEnter={() => { if (tooltip) clearTimeout(timer.current); }} onPointerLeave={() => hover(false)}>
        <ClosePopoverContext.Provider value={close}>{children}</ClosePopoverContext.Provider>
      </motion.div>
    </Layer>
    {/* Viewport overlays present directly: copying their large WebGL frame into
        a 2D canvas stalls WebKit. Embedded controls still share one GPU device. */}
    {host && frame.width > 1 && (trigger || active) && createPortal(<LiquidGlassCanvas {...SURFACE_MATERIAL} shared={!!stage && !modal} sourceRef={source} sourceRevision={revision}
      contentRef={ink} contentRevision={inkRevision} contentOpacity={contentOpacity} contentRefraction={contentRefraction} contentBlur={contentBlur}
      width={frame.width} height={frame.height} pixelRatio={2} transparentOutside
      blobs={[
        ...(active ? [{ x: bodyX, y: bodyY, radius: model.radius, cornerRadius: model.radius, halfWidth: model.w, halfHeight: model.h, refractionRatio: [(frame.pw + 56) / frame.width, (frame.ph + 56) / frame.height] as const }] : []),
        { x: frame.tx / frame.width, y: frame.ty / frame.height, radius: frame.tr, cornerRadius: frame.tr, halfWidth: triggerW, halfHeight: triggerH, refractionRatio: [(frame.tw + 28) / frame.width, (frame.th + 28) / frame.height], ...contact },
      ]}
      mergeDistance={model.merge} edgeDepth={10} domeDepth={18}
      blurStrength={backgroundBlur} shadowStrength={.08} shadowBlur={18} shadowOffset={6}
      style={{ display: "block", width: "100%", height: "100%" }} />, host)}
  </>;
}
