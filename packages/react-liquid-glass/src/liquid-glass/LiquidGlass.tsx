import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { cancelFrame, frame } from "motion";
import { LiquidGlassCanvas } from "./LiquidGlassCanvas";
import { LIQUID_GLASS_MATERIAL, type LiquidGlassFrame } from "./renderer";
import { captureLiquidSource, liquidRgb, liquidTheme, subscribeLiquidTheme, type LiquidSourceFactory, type LiquidSourcePainter } from "./source";
import { isMotionValue, motionValue, readMotion, type MotionInput } from "../shared/values";
import { useGlassMaterial } from "./provider";
import type { LensParams } from "../types";

/** LensParams spelling for callers migrating from Glass. No second optical preset. */
export const LIQUID_LENS: Partial<LensParams> = {
  depth: LIQUID_GLASS_MATERIAL.edgeDepth, domeDepth: LIQUID_GLASS_MATERIAL.domeDepth,
  scaleX: LIQUID_GLASS_MATERIAL.refractionStrength, scaleY: LIQUID_GLASS_MATERIAL.refractionStrength,
  chromaAmount: LIQUID_GLASS_MATERIAL.chromaAmount, blurAmount: LIQUID_GLASS_MATERIAL.blurStrength,
  specularStrength: LIQUID_GLASS_MATERIAL.specularStrength, brightness: LIQUID_GLASS_MATERIAL.brightness,
  specularRotation: LIQUID_GLASS_MATERIAL.specularRotation, glowStrength: LIQUID_GLASS_MATERIAL.glowStrength,
  glowSpread: LIQUID_GLASS_MATERIAL.glowSpread, glowExponent: LIQUID_GLASS_MATERIAL.glowExponent,
  edgeStrength: LIQUID_GLASS_MATERIAL.edgeStrength, edgeWidth: LIQUID_GLASS_MATERIAL.edgeWidth,
  edgeExponent: LIQUID_GLASS_MATERIAL.edgeExponent,
};

export interface LiquidGlassProps {
  children?: ReactNode;
  /** Existing DOM layout to snapshot once; interactive children remain native. */
  refractionTarget?: ReactNode;
  /** For live tracks/procedural content: prepare once, then repaint from MotionValues. */
  sourceFactory?: LiquidSourceFactory;
  /** Explicit substrate underneath captured foreground ink. */
  sourceBackground?: LiquidSourceFactory;
  sourceValues?: readonly MotionInput[];
  lens?: Partial<LensParams>;
  x?: MotionInput; y?: MotionInput;
  lensW?: MotionInput; lensH?: MotionInput; borderRadius?: MotionInput;
  autoBorderRadius?: boolean;
  tintColor?: string; tintOpacity?: MotionInput; tintBlur?: MotionInput;
  shadowOpacity?: MotionInput;
  filterResolution?: number;
  /** Align small control canvases to physical pixels, avoiding a second compositor resample. */
  pixelAlign?: boolean;
  /** CSS-pixel displacement gain; independent of the padded source's dimensions. */
  refractionPixels?: number;
  zoom?: MotionInput; depth?: MotionInput;
  debug?: boolean;
  material?: Partial<LiquidGlassFrame>;
  className?: string; style?: CSSProperties;
}

export function LiquidGlass(props: LiquidGlassProps) {
  const inheritedMaterial = useGlassMaterial();
  const material = { ...props.material, ...inheritedMaterial };
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const painterRef = useRef<LiquidSourcePainter | null>(null);
  const sourceRevision = useRef(motionValue(0)).current;
  const config = useRef(props); config.current = props;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tint, setTint] = useState<readonly [number, number, number]>([1, 1, 1]);
  const generation = useRef(0);
  const theme = useSyncExternalStore(subscribeLiquidTheme, liquidTheme, () => "light");
  const drawSource = useCallback(() => {
    const canvas = sourceRef.current;
    const painter = painterRef.current;
    if (!canvas || !painter || document.hidden) return;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
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
  useEffect(() => {
    const root = targetRef.current ?? contentRef.current;
    if (!root || !size.width || !size.height) return;
    let cancelled = false;
    const capture = () => {
      const token = ++generation.current;
      if (props.sourceFactory) {
        const canvas = sourceRef.current ?? document.createElement("canvas");
        canvas.width = Math.round(size.width * 2); canvas.height = Math.round(size.height * 2);
        sourceRef.current = canvas;
        painterRef.current = props.sourceFactory(root, size.width, size.height);
        scheduleSource();
      } else {
        painterRef.current = null;
        void captureLiquidSource(root, size.width, size.height, props.sourceBackground?.(root, size.width, size.height)).then(canvas => {
          if (cancelled || generation.current !== token) return;
          sourceRef.current = canvas;
          sourceRevision.set(sourceRevision.get() + 1);
        }).catch(error => { if (!cancelled) console.error("Liquid source capture failed", error); });
      }
      setTint(liquidRgb(root, config.current.tintColor ?? "white"));
    };
    capture();
    const changes = props.sourceFactory ? null : new MutationObserver(capture);
    changes?.observe(root, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["src", "class", "data-selected"],
    });
    root.addEventListener("load", capture, true);
    root.addEventListener("scroll", capture, true);
    root.addEventListener("focusin", capture);
    const settledStyle = (event: TransitionEvent) => {
      if (["color", "fill", "stroke", "background-color"].includes(event.propertyName)) capture();
    };
    root.addEventListener("transitionend", settledStyle);
    document.fonts.addEventListener("loadingdone", capture);
    return () => {
      cancelled = true;
      changes?.disconnect();
      cancelFrame(drawSource);
      root.removeEventListener("load", capture, true);
      root.removeEventListener("scroll", capture, true);
      root.removeEventListener("focusin", capture);
      root.removeEventListener("transitionend", settledStyle);
      document.fonts.removeEventListener("loadingdone", capture);
    };
  }, [props.sourceFactory, props.sourceBackground, props.tintColor, hasTarget, theme, size, scheduleSource, drawSource, sourceRevision]);

  useEffect(() => {
    const stops: Array<() => void> = [];
    for (const value of props.sourceValues ?? []) if (isMotionValue(value)) stops.push(value.on("change", scheduleSource));
    return () => stops.forEach(stop => stop());
  }, [props.sourceValues, scheduleSource]);

  const lens = { ...LIQUID_LENS, ...props.lens };
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
      sourceRef={sourceRef} sourceRevision={sourceRevision} width={size.width} height={size.height}
      blobs={[{ x: props.x ?? .5, y: props.y ?? .5, radius, halfWidth: width, halfHeight: height }]}
      mergeDistance={0}
      refractionRatio={props.refractionPixels !== undefined ? [1 / size.width, 1 / size.height]
        : scale ? [(lens.scaleX ?? scale) / scale, (lens.scaleY ?? scale) / scale] : [1, 1]}
      chromaAmount={lens.chromaAmount} specularStrength={lens.specularStrength}
      edgeDepth={props.depth ?? lens.depth} domeDepth={lens.domeDepth}
      brightness={lens.brightness} specularRotation={lens.specularRotation}
      glowStrength={lens.glowStrength} glowSpread={lens.glowSpread} glowExponent={lens.glowExponent}
      edgeStrength={lens.edgeStrength} edgeWidth={lens.edgeWidth} edgeExponent={lens.edgeExponent}
      tintColor={tint}
      shadowStrength={shadow} shadowBlur={Math.min(26, size.height * .2)} shadowOffset={Math.min(18, size.height * .12)}
      magnification={props.zoom}
      transparentOutside={!props.debug} debug={props.debug}
      {...material}
      refractionStrength={props.refractionPixels !== undefined && material.refractionStrength !== undefined ? scale * readMotion(material.refractionStrength) / .11 : material.refractionStrength ?? scale}
      // Provider tuning changes the optical material, not the opaque rest endpoint.
      tintStrength={tintStrength} blurStrength={blur}
      pixelRatio={props.tintOpacity !== undefined ? 2 : material.pixelRatio ?? props.filterResolution ?? 2}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} /> : null}
  </div>;
}
