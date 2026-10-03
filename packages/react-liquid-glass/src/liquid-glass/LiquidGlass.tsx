import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cancelFrame, frame } from "motion";
import { LiquidGlassCanvas } from "./LiquidGlassCanvas.js";
import { LIQUID_GLASS_MATERIAL, type LiquidGlassFrame, type LiquidGlassBlob } from "./renderer.js";
import { captureLiquidSource, liquidRgb, liquidTheme, subscribeLiquidTheme, type LiquidSourceFactory, type LiquidSourcePainter } from "./source.js";
import { isMotionValue, motionValue, readMotion, type MotionInput } from "../shared/values.js";
import { DEFAULT_MATERIAL, useGlassMaterialOverrides } from "./provider.js";
import { createLiquidBackdrop } from "./backdrop.js";
import { useLiquidToneTracker } from "./tone.js";
import type { LiquidLens } from "./lens.js";

/** Shared Liquid material defaults for DOM-backed lenses. */
export const LIQUID_LENS = {
  depth: LIQUID_GLASS_MATERIAL.edgeDepth, domeDepth: LIQUID_GLASS_MATERIAL.domeDepth,
  scaleX: LIQUID_GLASS_MATERIAL.refractionStrength, scaleY: LIQUID_GLASS_MATERIAL.refractionStrength,
  chromaAmount: LIQUID_GLASS_MATERIAL.chromaAmount, blurAmount: LIQUID_GLASS_MATERIAL.blurStrength,
  specularStrength: LIQUID_GLASS_MATERIAL.specularStrength, brightness: LIQUID_GLASS_MATERIAL.brightness,
  specularRotation: LIQUID_GLASS_MATERIAL.specularRotation, glowStrength: LIQUID_GLASS_MATERIAL.glowStrength,
  glowSpread: LIQUID_GLASS_MATERIAL.glowSpread, glowExponent: LIQUID_GLASS_MATERIAL.glowExponent,
  edgeStrength: LIQUID_GLASS_MATERIAL.edgeStrength, edgeWidth: LIQUID_GLASS_MATERIAL.edgeWidth,
  edgeExponent: LIQUID_GLASS_MATERIAL.edgeExponent,
} satisfies LiquidLens;

export interface LiquidGlassProps {
  children?: ReactNode;
  /** Existing DOM layout to snapshot once; interactive children remain native. */
  refractionTarget?: ReactNode;
  /** Keep the captured DOM's text and icons sharp: they refract and disperse with the backdrop, which alone takes the material's blur. */
  sharpInk?: boolean;
  /** For live tracks/procedural content: prepare once, then repaint from MotionValues. */
  sourceFactory?: LiquidSourceFactory;
  /** Explicit substrate underneath captured foreground ink. */
  sourceBackground?: LiquidSourceFactory;
  /** Exclude a composite control's native ink when it supplies its own foreground. */
  backdropRoot?: RefObject<HTMLElement | null>;
  sourceValues?: readonly MotionInput[];
  lens?: LiquidLens;
  x?: MotionInput; y?: MotionInput;
  lensW?: MotionInput; lensH?: MotionInput; borderRadius?: MotionInput;
  autoBorderRadius?: boolean;
  tintColor?: string; tintOpacity?: MotionInput; tintBlur?: MotionInput;
  shadowOpacity?: MotionInput;
  /** Draw past this element by the shadow's reach, so a lens that grows or travels to the edge never cuts its shadow. */
  shadowBleed?: boolean;
  pixelRatio?: number;
  /** Align small control canvases to physical pixels, avoiding a second compositor resample. */
  pixelAlign?: boolean;
  /** CSS-pixel displacement gain; independent of the padded source's dimensions. */
  refractionPixels?: number;
  zoom?: MotionInput; depth?: MotionInput;
  debug?: boolean;
  /** Enable extended highlights on supported HDR displays. Default: true. */
  hdr?: boolean;
  material?: Partial<LiquidGlassFrame> & { hdr?: boolean };
  contact?: Pick<LiquidGlassBlob, "contactX" | "contactY" | "anchorX" | "anchorY" | "contactStrength" | "pullX" | "pullY">;
  /** Lens velocity in CSS pixels per second; drives volume-preserving squash and stretch. */
  velocity?: { x: MotionInput; y: MotionInput };
  className?: string; style?: CSSProperties;
}

export function LiquidGlass(props: LiquidGlassProps) {
  // Explicit provider values override this lens; shared defaults only fill in
  // parameters that the lens does not calibrate (see `lens` below).
  const material = { ...props.material, ...useGlassMaterialOverrides(props.hdr) };
  const rootRef = useRef<HTMLDivElement>(null);
  const publishTone = useLiquidToneTracker(rootRef, material.tone === true);
  const contentRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const painterRef = useRef<LiquidSourcePainter | null>(null);
  const backdropRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<(reuseInk?: boolean) => void>(() => undefined);
  const sourceRevision = useRef(motionValue(0)).current;
  const config = useRef(props); config.current = props;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const sizeRef = useRef(size); sizeRef.current = size;
  const measured = size.width > 0 && size.height > 0;
  const shadowBlur = Math.min(26, size.height * .2), shadowOffset = Math.min(18, size.height * .12);
  // Extra canvas on every side; the source and backdrop grow with it so the lens stays in place.
  const bleed = props.shadowBleed ? Math.ceil(shadowBlur * 2.5 + shadowOffset) : 0;
  const bleedRef = useRef(bleed); bleedRef.current = bleed;
  const backdropHandle = useRef<{ refresh: () => void } | null>(null);
  const capturedKey = useRef("");
  const [tint, setTint] = useState<readonly [number, number, number]>([1, 1, 1]);
  const generation = useRef(0);
  const theme = useSyncExternalStore(subscribeLiquidTheme, liquidTheme, () => "light");
  const drawSource = useCallback(() => {
    const canvas = sourceRef.current;
    const painter = painterRef.current;
    if (!canvas || !painter || document.hidden) return;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
    if (backdropRef.current) ctx.drawImage(backdropRef.current, 0, 0, canvas.width / 2, canvas.height / 2);
    ctx.translate(bleedRef.current, bleedRef.current);
    painter(ctx);
    sourceRevision.set(sourceRevision.get() + 1);
  }, [sourceRevision]);
  const scheduleSource = useCallback(() => frame.preRender(drawSource), [drawSource]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let alignment = { x: 0, y: 0 };
    const measure = () => {
      if (config.current.pixelAlign) {
        const rect = root.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
        const left = rect.left - alignment.x, top = rect.top - alignment.y;
        alignment = { x: Math.round(left * ratio) / ratio - left, y: Math.round(top * ratio) / ratio - top };
        root.style.translate = `${alignment.x}px ${alignment.y}px`;
      }
      const width = root.clientWidth, height = root.clientHeight;
      // A hidden native popover reports zero. Keep its measured surface and GPU
      // resources for the next opening; IntersectionObserver pauses the canvas.
      if (!width || !height) return;
      setSize(old => old.width === width && old.height === height ? old : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); document.fonts.removeEventListener("loadingdone", measure); };
  }, []);

  // Retain content textures across optical/geometry updates. Never rasterize DOM per frame.
  const hasTarget = !!props.refractionTarget;
  const themeRef = useRef(theme); themeRef.current = theme;
  // Observers live as long as the source configuration; size and theme changes
  // only re-capture (below) instead of rebuilding every listener.
  useEffect(() => {
    const root = targetRef.current ?? contentRef.current;
    if (!root || !measured) return;
    let cancelled = false;
    // A backdrop change reuses the DOM ink; only the target's own changes repaint it.
    const capture = (reuseInk = false) => {
      const token = ++generation.current;
      const { width, height } = sizeRef.current, bleed = bleedRef.current;
      capturedKey.current = `${width}x${height}:${themeRef.current}`;
      if (props.sourceFactory) {
        const canvas = sourceRef.current ?? document.createElement("canvas");
        canvas.width = Math.round((width + bleed * 2) * 2); canvas.height = Math.round((height + bleed * 2) * 2);
        sourceRef.current = canvas;
        painterRef.current = props.sourceFactory(root, width, height);
        scheduleSource();
      } else {
        painterRef.current = null;
        const background = props.sourceBackground?.(root, width, height);
        // The backdrop continues into the bleed margins; ink stays transparent there.
        const pad = (inner: HTMLCanvasElement, backdrop: boolean) => {
          if (!bleed) return inner;
          const canvas = document.createElement("canvas");
          canvas.width = inner.width + bleed * 4; canvas.height = inner.height + bleed * 4;
          const ctx = canvas.getContext("2d")!;
          if (backdrop && backdropRef.current) ctx.drawImage(backdropRef.current, 0, 0, canvas.width, canvas.height);
          ctx.drawImage(inner, bleed * 2, bleed * 2);
          return canvas;
        };
        const retained = props.sharpInk && reuseInk ? inkRef.current : null;
        void Promise.all([
          captureLiquidSource(root, width, height, ctx => {
            if (backdropRef.current) ctx.drawImage(backdropRef.current, bleed * 2, bleed * 2, width * 2, height * 2, 0, 0, width, height);
            background?.(ctx);
          }, props.sharpInk ? "base" : "all"),
          // Sharp ink is a separate layer, so the material's frost never reaches it.
          props.sharpInk && !retained ? captureLiquidSource(root, width, height, undefined, "ink") : undefined,
        ]).then(([canvas, ink]) => {
          if (cancelled || generation.current !== token) return;
          sourceRef.current = pad(canvas, true);
          inkRef.current = ink ? pad(ink, false) : retained;
          sourceRevision.set(sourceRevision.get() + 1);
        }).catch(error => { if (!cancelled) console.error("Liquid source capture failed", error); });
      }
    };
    const recapture = () => capture();
    captureRef.current = capture;
    capture();
    const changes = props.sourceFactory ? null : new MutationObserver(recapture);
    changes?.observe(root, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["src", "class", "data-selected"],
    });
    root.addEventListener("load", recapture, true);
    root.addEventListener("scroll", recapture, true);
    root.addEventListener("focusin", recapture);
    const settledStyle = (event: TransitionEvent) => {
      if (["color", "fill", "stroke", "background-color"].includes(event.propertyName)) capture();
    };
    root.addEventListener("transitionend", settledStyle);
    document.fonts.addEventListener("loadingdone", recapture);
    return () => {
      cancelled = true;
      captureRef.current = () => undefined;
      changes?.disconnect();
      cancelFrame(drawSource);
      root.removeEventListener("load", recapture, true);
      root.removeEventListener("scroll", recapture, true);
      root.removeEventListener("focusin", recapture);
      root.removeEventListener("transitionend", settledStyle);
      document.fonts.removeEventListener("loadingdone", recapture);
    };
  }, [props.sourceFactory, props.sourceBackground, props.sharpInk, hasTarget, measured, scheduleSource, drawSource, sourceRevision]);
  useEffect(() => {
    if (measured && capturedKey.current !== `${size.width}x${size.height}:${theme}`) captureRef.current();
    backdropHandle.current?.refresh();
  }, [size, theme, measured]);
  useEffect(() => {
    const root = targetRef.current ?? contentRef.current;
    if (root && measured) setTint(liquidRgb(root, props.tintColor ?? "white"));
  }, [props.tintColor, theme, measured, hasTarget]);

  useEffect(() => {
    const owner = rootRef.current;
    if (!owner || !measured) return;
    const visible = () => readMotion(config.current.tintOpacity ?? 0) < 1;
    const backdrop = createLiquidBackdrop(props.backdropRoot?.current ?? owner, () => {
      const rect = owner.getBoundingClientRect(), bleed = bleedRef.current;
      return { left: rect.left - bleed, top: rect.top - bleed, width: sizeRef.current.width + bleed * 2, height: sizeRef.current.height + bleed * 2 };
    }, canvas => {
      backdropRef.current = canvas;
      const { width, height } = sizeRef.current, bleed = bleedRef.current;
      publishTone(canvas, bleed ? { left: bleed / (width + bleed * 2), top: bleed / (height + bleed * 2), width: width / (width + bleed * 2), height: height / (height + bleed * 2) } : undefined);
      if (painterRef.current) scheduleSource(); else captureRef.current(true);
    }, visible);
    backdropHandle.current = backdrop;
    let wasVisible = visible();
    const stop = isMotionValue(props.tintOpacity) ? props.tintOpacity.on("change", () => {
      const next = visible();
      if (next && !wasVisible) backdrop.refresh();
      wasVisible = next;
    }) : undefined;
    return () => { stop?.(); backdrop.dispose(); backdropHandle.current = null; };
  }, [measured, props.backdropRoot, props.tintOpacity, scheduleSource, publishTone]);

  useEffect(() => {
    const stops: Array<() => void> = [];
    for (const value of props.sourceValues ?? []) if (isMotionValue(value)) stops.push(value.on("change", scheduleSource));
    return () => stops.forEach(stop => stop());
  }, [props.sourceValues, scheduleSource]);

  const lens = { ...LIQUID_LENS, chromaAmount: DEFAULT_MATERIAL.chromaAmount, domeDepth: DEFAULT_MATERIAL.domeDepth, ...props.lens };
  const width = props.lensW ?? lens.lensW ?? 34, height = props.lensH ?? lens.lensH ?? 34;
  // Derived views subscribe to the same upstream values; no per-frame React state.
  const derived = (get: () => number, inputs: MotionInput[]) => ({
    get, on: (_: "change", notify: (value: number) => void) => {
      const stops = inputs.flatMap(input => isMotionValue(input) ? [input.on("change", () => notify(get()))] : []);
      return () => stops.forEach(stop => stop());
    },
  });
  const radius = props.autoBorderRadius
    ? derived(() => Math.min(readMotion(width), readMotion(height)), [width, height])
    : props.borderRadius ?? lens.borderRadius ?? 34;
  const tintStrength = derived(() => {
    const base = readMotion(material.tintStrength ?? lens.tint ?? .055);
    return base + (1 - base) * Math.max(0, Math.min(1, readMotion(props.tintOpacity ?? 0)));
  }, [props.tintOpacity ?? 0, material.tintStrength ?? 0]);
  const blur = derived(() => readMotion(material.blurStrength ?? lens.blurAmount ?? .5) + readMotion(props.tintBlur ?? 0) * .4, [props.tintBlur ?? 0, material.blurStrength ?? 0]);
  const shadow = derived(() => .04 + .07 * readMotion(props.shadowOpacity ?? 1), [props.shadowOpacity ?? 1]);
  const canvasWidth = size.width + bleed * 2, canvasHeight = size.height + bleed * 2;
  const toCanvas = (value: MotionInput, extent: number, total: number) => bleed ? derived(() => (readMotion(value) * extent + bleed) / total, [value]) : value;
  const scale = props.refractionPixels === undefined
    ? Math.max(Math.abs(lens.scaleX ?? .11), Math.abs(lens.scaleY ?? .11))
    : Math.max(0, props.refractionPixels) * 2;
  return <div ref={rootRef} data-dg-glass-surface="" data-dg-liquid-surface="" className={props.className}
    style={{ position: "relative", ...props.style }}>
    {/* Keep positioned native children below the refracted pixels, not over their ink. */}
    <div ref={contentRef} style={{ position: "relative", zIndex: 0 }}>{props.children}</div>
    {props.refractionTarget ? <div ref={targetRef} inert aria-hidden="true"
      style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}>{props.refractionTarget}</div> : null}
    {size.width > 0 && size.height > 0 ? <LiquidGlassCanvas shared inheritMaterial={false}
      sourceRef={sourceRef} sourceRevision={sourceRevision} width={canvasWidth} height={canvasHeight}
      contentRef={inkRef} contentOpacity={props.sharpInk ? 1 : 0} contentSpace="source"
      blobs={[{ x: toCanvas(props.x ?? .5, size.width, canvasWidth), y: toCanvas(props.y ?? .5, size.height, canvasHeight), radius, halfWidth: width, halfHeight: height, velocityX: props.velocity?.x, velocityY: props.velocity?.y, ...props.contact }]}
      mergeDistance={0}
      refractionRatio={props.refractionPixels !== undefined ? [1 / canvasWidth, 1 / canvasHeight]
        : scale ? [(lens.scaleX ?? scale) / scale * size.width / canvasWidth, (lens.scaleY ?? scale) / scale * size.height / canvasHeight] : [size.width / canvasWidth, size.height / canvasHeight]}
      chromaAmount={lens.chromaAmount} specularStrength={lens.specularStrength}
      edgeDepth={props.depth ?? lens.depth} domeDepth={lens.domeDepth}
      brightness={lens.brightness} specularRotation={lens.specularRotation}
      glowStrength={lens.glowStrength} glowSpread={lens.glowSpread} glowExponent={lens.glowExponent}
      edgeStrength={lens.edgeStrength} edgeWidth={lens.edgeWidth} edgeExponent={lens.edgeExponent}
      tintColor={tint}
      shadowStrength={shadow} shadowBlur={shadowBlur} shadowOffset={shadowOffset}
      magnification={props.zoom}
      transparentOutside={!props.debug} debug={props.debug}
      {...material}
      hdr={props.hdr ?? material.hdr}
      refractionStrength={props.refractionPixels !== undefined && material.refractionStrength !== undefined ? scale * readMotion(material.refractionStrength) / .11 : material.refractionStrength ?? scale}
      // Provider tuning changes the optical material, not the opaque rest endpoint.
      tintStrength={tintStrength} blurStrength={blur}
      pixelRatio={props.tintOpacity !== undefined ? 2 : material.pixelRatio ?? props.pixelRatio ?? 2}
      style={bleed ? { position: "absolute", left: -bleed, top: -bleed, width: canvasWidth, height: canvasHeight, pointerEvents: "none" }
        : { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} /> : null}
  </div>;
}
