import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cancelFrame, frame as motionFrame } from "motion";
import { usePopoverMotion, type PopoverLayout } from "../apple-motion/use-popover-motion";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";
import { liquidContentOptics, liquidSurfaceBlur } from "../liquid-glass/geometry";
import { paintLiquidMenuContent } from "../liquid-glass/menu-content";
import { observeLiquidBackdrop, paintLiquidBackdrop, scheduleLiquidBackdrop, cancelLiquidBackdrop } from "../liquid-glass/backdrop";
import { useGlassMaterial } from "../liquid-glass/provider";
import { SURFACE_MATERIAL } from "./GlassSurface";

export interface GlassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  closeLabel?: string;
  /** Captures the pointer position; keyboard activation uses the trigger center. */
  trigger?: ReactElement<ComponentProps<"button">>;
}

/** Native modal semantics, with the same liquid trajectory and optics as popovers. */
export function GlassDialog({ open, onOpenChange, title, description, children, closeLabel = "Close", trigger, placement = "dialog" }: GlassDialogProps & { placement?: "dialog" | "sheet" }) {
  const dialog = useRef<HTMLDialogElement>(null), panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null), point = useRef({ x: .5, y: .5 });
  const id = useId(), reduce = useReducedMotion(), material = useGlassMaterial();
  const current = useRef(open); current.current = open;
  const model = usePopoverMotion(), mask = useMotionValue(0);
  const source = useRef<HTMLCanvasElement | null>(null), revision = useMotionValue(0);
  const ink = useRef<HTMLCanvasElement | null>(null), inkRevision = useMotionValue(0), inkActive = useMotionValue(0);
  const settled = useRef(false), layout = useRef<PopoverLayout | null>(null);
  const [frame, setFrame] = useState({ left: 0, top: 0, width: 1, height: 1, originX: 0, originY: 0, tx: 0, ty: 0, tw: 1, th: 1, px: 0, py: 0, pw: 1, ph: 1 });
  const bounds = useRef(frame);
  const bodyX = useTransform(model.x, x => (x - frame.left) / frame.width), bodyY = useTransform(model.y, y => (y - frame.top) / frame.height);
  const headW = useTransform(model.trigger, value => frame.tw / 2 * value), headH = useTransform(model.trigger, value => frame.th / 2 * value);
  const transform = useTransform(() => `translate(${model.x.get() - frame.px}px, ${model.y.get() - frame.py}px) scale(${Math.max(.001, model.w.get() * 2 / frame.pw)}, ${Math.max(.001, model.h.get() * 2 / frame.ph)})`);
  const corners = useTransform(() => `${model.radius.get() / Math.max(.001, model.w.get() * 2 / frame.pw)}px / ${model.radius.get() / Math.max(.001, model.h.get() * 2 / frame.ph)}px`);
  const nativeOpacity = useTransform(() => model.reveal.get() * (1 - inkActive.get()));
  const contentOpacity = useTransform(() => model.reveal.get() * inkActive.get());
  const shape = useTransform(() => liquidContentOptics([model.w.get(), model.h.get(), model.radius.get()], { panelWidth: frame.pw, panelHeight: frame.ph, panelRadius: 28 }));
  const contentRefraction = useTransform(shape, value => value.refraction), contentBlur = useTransform(shape, value => value.blur);
  const contentFilter = useTransform(model.reveal, value => `blur(${(1 - value) * 3}px)`);
  const blur = useTransform(() => material.blurStrength ?? liquidSurfaceBlur(model.w.get() * 2, model.h.get() * 2));
  // Match the black mask under the glass without rerasterizing the page every fade frame.
  const backdropDim = useTransform(mask, value => value * 7 / 15);
  const capture = () => {
    const element = panel.current;
    if (!element) return;
    // ponytail: keep live form/media controls native; text menus use the shared ink snapshot.
    if (element.querySelector("input, textarea, select, canvas")) { inkActive.jump(0); return; }
    const canvas = ink.current ?? document.createElement("canvas"); ink.current = canvas;
    if (paintLiquidMenuContent(element, canvas)) { inkRevision.set(inkRevision.get() + 1); inkActive.jump(1); }
  };
  const repaint = useCallback(() => {
    const element = dialog.current;
    if (!element?.open || document.hidden) return;
    const canvas = source.current ?? document.createElement("canvas"); source.current = canvas;
    if (paintLiquidBackdrop(document.body, canvas, bounds.current, [element])) revision.set(revision.get() + 1);
  }, [revision]);
  const measure = () => {
    const element = panel.current, layer = dialog.current;
    if (!element || !layer?.open) return;
    const viewport = window.visualViewport;
    const vl = viewport?.offsetLeft ?? 0, vt = viewport?.offsetTop ?? 0, vw = viewport?.width ?? innerWidth, vh = viewport?.height ?? innerHeight;
    const pw = element.offsetWidth, ph = element.offsetHeight;
    const rect = opener.current?.isConnected ? opener.current.getBoundingClientRect() : null;
    const tx = Math.max(vl + 12, Math.min(vl + vw - 12, rect ? rect.left + rect.width * point.current.x : vl + vw / 2));
    const ty = Math.max(vt + 12, Math.min(vt + vh - 12, rect ? rect.top + rect.height * point.current.y : vt + vh / 2));
    const tw = Math.min(80, rect?.width || 48), th = Math.min(44, rect?.height || 36);
    const left = placement === "sheet" ? vl + vw - pw - 16 : vl + (vw - pw) / 2;
    const top = placement === "sheet" ? vt + 16 : vt + (vh - ph) / 2;
    const padding = Math.ceil(Math.max(40, (material.shadowBlur ?? 18) * 3 + Math.abs(material.shadowOffset ?? 6)));
    const fl = Math.floor(Math.min(left, tx - tw / 2) - padding), ft = Math.floor(Math.min(top, ty - th / 2) - padding);
    const fw = Math.ceil(Math.max(left + pw, tx + tw / 2) + padding - fl), fh = Math.ceil(Math.max(top + ph, ty + th / 2) + padding - ft);
    const origin = layer.getBoundingClientRect();
    const next = { left: fl, top: ft, width: fw, height: fh, originX: origin.left, originY: origin.top, tx, ty, tw, th, px: left + pw / 2, py: top + ph / 2, pw, ph };
    const changed = Object.keys(next).some(key => next[key as keyof typeof next] !== bounds.current[key as keyof typeof next]);
    bounds.current = next;
    if (changed) setFrame(next);
    layout.current = { triggerX: tx, triggerY: ty, triggerWidth: tw, triggerHeight: th, triggerRadius: Math.min(tw, th) / 2, panelX: next.px, panelY: next.py, panelWidth: pw, panelHeight: ph, panelRadius: 28 };
    element.style.left = `${left - origin.left}px`; element.style.top = `${top - origin.top}px`;
    if (settled.current && current.current) { model.x.jump(next.px); model.y.jump(next.py); model.w.jump(pw / 2); model.h.jump(ph / 2); model.radius.jump(28); }
    scheduleLiquidBackdrop(repaint);
    return changed;
  };
  const measureRef = useRef(measure); measureRef.current = measure;
  const finish = () => {
    settled.current = true; inkActive.jump(0);
    if (!current.current) {
      dialog.current?.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    }
  };
  const retargetRef = useRef(() => {});
  retargetRef.current = () => { if (measureRef.current() && !settled.current && layout.current) model.transition(layout.current, current.current, finish, { morphTrigger: true, duration: .5 }); };
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || (!open && !element.open)) return;
    if (open && !element.open) {
      if ((!trigger || !opener.current?.isConnected) && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) { opener.current = document.activeElement; point.current = { x: .5, y: .5 }; }
      element.showModal();
    }
    settled.current = false;
    measureRef.current(); capture();
    const fade = animate(mask, open ? 1 : 0, { duration: reduce ? 0 : .2, ease: [.23, 1, .32, 1] });
    if (layout.current) model.transition(layout.current, open, finish, { morphTrigger: true, duration: .5 });
    return () => fade.stop();
  }, [open]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const resize = () => { if (element.open) retargetRef.current(); };
    const schedule = () => motionFrame.read(resize);
    const scroll = () => { if (element.open) scheduleLiquidBackdrop(repaint); };
    const observer = new ResizeObserver(schedule); if (panel.current) observer.observe(panel.current);
    const stop = observeLiquidBackdrop(document.documentElement, () => bounds.current, [element], repaint);
    window.addEventListener("resize", schedule); window.addEventListener("scroll", scroll, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule); viewport?.addEventListener("scroll", schedule);
    return () => { observer.disconnect(); stop(); cancelFrame(resize); cancelLiquidBackdrop(repaint); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", scroll, true); viewport?.removeEventListener("resize", schedule); viewport?.removeEventListener("scroll", schedule); };
  }, [repaint]);
  const refreshInk = () => { if (!settled.current && inkActive.get()) capture(); };
  return <>
    {trigger && cloneElement(trigger, { "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": id, onClick: event => {
      trigger.props.onClick?.(event); if (event.defaultPrevented) return;
      opener.current = event.currentTarget;
      const rect = event.currentTarget.getBoundingClientRect();
      point.current = event.detail && rect.width && rect.height ? { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height } : { x: .5, y: .5 };
      onOpenChange(true);
    } })}
    <dialog ref={dialog} id={id} className={`dg-dialog dg-dialog--${placement}`} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
      onCancel={event => { event.preventDefault(); onOpenChange(false); }} onClose={() => { if (current.current) onOpenChange(false); }}>
      <motion.div className="dg-dialog__mask" aria-hidden="true" style={{ opacity: mask }} onClick={() => onOpenChange(false)} />
      {frame.width > 1 && <div className="dg-dialog__optics" aria-hidden="true" style={{ left: frame.left - frame.originX, top: frame.top - frame.originY, width: frame.width, height: frame.height }}>
        <LiquidGlassCanvas {...SURFACE_MATERIAL} {...material} inheritMaterial={false} sourceRef={source} sourceRevision={revision}
          contentRef={ink} contentRevision={inkRevision} contentOpacity={contentOpacity} contentRefraction={contentRefraction} contentBlur={contentBlur}
          width={frame.width} height={frame.height} pixelRatio={material.pixelRatio ?? 2} transparentOutside
          blobs={[
            { x: bodyX, y: bodyY, radius: model.radius, cornerRadius: model.radius, halfWidth: model.w, halfHeight: model.h, refractionRatio: [(frame.pw + 56) / frame.width, (frame.ph + 56) / frame.height] },
            { x: (frame.tx - frame.left) / frame.width, y: (frame.ty - frame.top) / frame.height, radius: Math.min(frame.tw, frame.th) / 2, halfWidth: headW, halfHeight: headH },
          ]} mergeDistance={model.merge} edgeDepth={material.edgeDepth ?? 10} domeDepth={material.domeDepth ?? 18}
          blurStrength={blur} backdropDim={backdropDim} shadowStrength={material.shadowStrength ?? .08} shadowBlur={material.shadowBlur ?? 18} shadowOffset={material.shadowOffset ?? 6}
          style={{ display: "block", width: "100%", height: "100%" }} />
      </div>}
      <motion.div ref={panel} className="dg-dialog__body" inert={!open} style={{ transform, opacity: nativeOpacity, filter: contentFilter, borderRadius: corners }} onFocus={refreshInk} onPointerOver={refreshInk} onScroll={refreshInk}>
        <header><h2 id={`${id}-title`}>{title}</h2><button type="button" className="dg-dismiss" aria-label={closeLabel} onClick={() => onOpenChange(false)}>×</button></header>
        {description && <p id={`${id}-description`} className="dg-dialog__description">{description}</p>}
        {children}
      </motion.div>
    </dialog>
  </>;
}

export function GlassSheet(props: GlassDialogProps) { return <GlassDialog {...props} placement="sheet" />; }
