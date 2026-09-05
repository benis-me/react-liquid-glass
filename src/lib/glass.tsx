import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { GlassContext, type TargetRect } from "./context";
import { generateDisplacementMap } from "./displacement-map";
import { isMotionValue, readMotion, type MotionInput, type MotionValueLike } from "./shared/values";
import { DEFAULT_LENS_PARAMS } from "./presets";
import { axisScaleMatrix, roundedRectUri, TRANSPARENT_PIXEL } from "./rounded-rect";
import type { FilterStats, GenerationStats, LensParams } from "./types";
import { useMapRegen } from "./use-map-regen";

/*
 * Architecture (recovered from the production bundle):
 *
 * The lens is NOT a backdrop-filter. The container's content is wrapped in a
 * div that gets `filter: url(#...)`. Inside the filter, the displaced result
 * is clipped by the generated map's rounded alpha and composited back over
 * the untouched source. This keeps blur and other full-frame primitives out
 * of the transparent corners of a rounded lens.
 *
 * Moving the lens only rewrites x/y attributes on the `data-lens` primitives
 * and bumps the filter id (forces WebKit to invalidate); the displacement map
 * is regenerated only when the lens changes shape.
 */

export interface LensInstance {
  id: string;
  /** Half-extents in px. */
  lensW: number;
  lensH: number;
  lens?: Partial<LensParams>;
  /** Center, as fractions of the container. */
  x: MotionValueLike;
  y: MotionValueLike;
  regionScale: MotionValueLike;
  regionOriginX: MotionValueLike;
  regionOriginY: MotionValueLike;
  displScale: MotionValueLike;
  maxDisplScale?: number;
}

export interface GlassProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className" | "style"> {
  children?: ReactNode;
  lens?: Partial<LensParams>;
  /** Lens center as fractions of the container (0–1). */
  x?: MotionInput;
  y?: MotionInput;
  /** Half-extent overrides (px); motion values enable animated regeneration. */
  lensW?: MotionInput;
  lensH?: MotionInput;
  borderRadius?: MotionInput;
  /** borderRadius = min(lensW, lensH) — a capsule/circle. */
  autoBorderRadius?: boolean;
  /** Bring your own map (skips generation). */
  displacementMapUrl?: string;
  /** Alternate content revealed through the lens instead of refracting children. */
  overlay?: ReactNode;
  showOutline?: boolean;
  onLensMapChange?: (url: string | null) => void;
  /** Restyled copy of the content that the lens samples from (children stay unfiltered). */
  refractionTarget?: ReactNode;
  tintColor?: string;
  tintOpacity?: MotionInput;
  tintBlur?: MotionInput;
  shadowOpacity?: MotionInput;
  restShadowOpacity?: MotionInput;
  /** Multiplies the lens specular response without regenerating its map. */
  specularOpacity?: MotionInput;
  /** Inset (px) of the filter subregion relative to the lens rect. Default 0.5. */
  edgeBias?: MotionInput;
  onGenerationTime?: (stats: GenerationStats) => void;
  /** Settle delay (ms) for a final high-quality regen after animation stops. */
  regenSettle?: number;
  /** Run the filter at a different resolution (content is pre-scaled). */
  filterResolution?: number;
  /** Keep material tint/shadow mounted while disabling SVG refraction. */
  filterEnabled?: boolean;
  /** Displacement multiplier applied at the filter stage (magnifier zoom). */
  zoom?: MotionInput;
  depth?: MotionInput;
  /** Overrides lens.scaleX and lens.scaleY at once. */
  scale?: number;
  /** Magnified-region transform (regionScale ≠ 1 grows the sampled rect). */
  regionScale?: MotionInput;
  regionOriginX?: MotionInput;
  regionOriginY?: MotionInput;
  onFilterStats?: (stats: FilterStats) => void;
  /** Multiple independent lenses over the same content. */
  lenses?: LensInstance[];
  pauseOffscreen?: boolean;
  offscreenMargin?: string;
  className?: string;
  style?: CSSProperties;
}

interface TargetPool {
  filterEl: SVGFilterElement | null;
  lensEls: Element[];
  dispEls: SVGFEDisplacementMapElement[];
  mapMatrixEl: SVGFEColorMatrixElement | null;
  feImageEl: SVGFEImageElement | null;
  version: number;
  assignedTo: HTMLElement | null;
  assignedRect: TargetRect | null;
}

interface MultiSubSlot {
  feImageEl: SVGFEImageElement | null;
  feColorMatrixEl: SVGFEColorMatrixElement | null;
  feMaskEl: SVGFEImageElement | null;
  feMaskColorMatrixEl: SVGFEColorMatrixElement | null;
  assignedLensId: string | null;
  lastHref: string;
  lastX: string;
  lastY: string;
  lastW: string;
  lastH: string;
  lastColorMatrix: string;
  lastMaskKey: string;
  lastMaskColorMatrix: string;
}

interface MultiPool {
  filterEl: SVGFilterElement | null;
  feDispEl: SVGFEDisplacementMapElement | null;
  subSlots: MultiSubSlot[];
  assignedTo: HTMLElement | null;
  version: number;
  lastDispScale: string;
  lastFilterW: string;
  lastFilterH: string;
}

const makeTargetPool = (): TargetPool => ({
  filterEl: null,
  lensEls: [],
  dispEls: [],
  mapMatrixEl: null,
  feImageEl: null,
  version: 0,
  assignedTo: null,
  assignedRect: null,
});

const makeSubSlot = (): MultiSubSlot => ({
  feImageEl: null,
  feColorMatrixEl: null,
  feMaskEl: null,
  feMaskColorMatrixEl: null,
  assignedLensId: null,
  lastHref: "",
  lastX: "",
  lastY: "",
  lastW: "",
  lastH: "",
  lastColorMatrix: "",
  lastMaskKey: "",
  lastMaskColorMatrix: "",
});

const resetSubSlot = (s: MultiSubSlot) => {
  s.lastHref = "";
  s.lastX = "";
  s.lastY = "";
  s.lastW = "";
  s.lastH = "";
  s.lastColorMatrix = "";
  s.lastMaskKey = "";
  s.lastMaskColorMatrix = "";
};

const makeMultiPool = (): MultiPool => ({
  filterEl: null,
  feDispEl: null,
  subSlots: Array.from({ length: 4 }, makeSubSlot),
  assignedTo: null,
  version: 0,
  lastDispScale: "",
  lastFilterW: "",
  lastFilterH: "",
});

const releaseTargetPool = (p: TargetPool) => {
  if (p.assignedTo) {
    p.assignedTo.style.filter = "";
    p.assignedTo.style.willChange = "";
    p.assignedTo = null;
    p.assignedRect = null;
  }
};

const releaseMultiPool = (p: MultiPool) => {
  if (p.assignedTo) {
    p.assignedTo.style.filter = "";
    p.assignedTo.style.willChange = "";
    p.assignedTo = null;
  }
  for (const s of p.subSlots) {
    s.assignedLensId = null;
    resetSubSlot(s);
  }
  p.lastDispScale = "";
  p.lastFilterW = "";
  p.lastFilterH = "";
};

const darkSpecularMatrix = (strength: number) =>
  `0 0 ${-strength} 0 ${1 + (128 * strength) / 255}  0 0 ${-strength} 0 ${1 + (128 * strength) / 255}  0 0 ${-strength} 0 ${1 + (128 * strength) / 255}  0 0 0 0 1`;

function useOffscreenPause(
  ref: React.RefObject<HTMLElement | null>,
  margin: string,
  enabled: boolean,
): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: margin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, enabled]);
  return !enabled || visible;
}

export function Glass({
  children,
  lens,
  x = 0.5,
  y = 0.5,
  lensW: lensWProp,
  lensH: lensHProp,
  borderRadius: borderRadiusProp,
  autoBorderRadius,
  displacementMapUrl,
  overlay,
  showOutline = false,
  onLensMapChange,
  refractionTarget,
  tintColor,
  tintOpacity,
  tintBlur,
  shadowOpacity,
  restShadowOpacity,
  specularOpacity,
  edgeBias,
  onGenerationTime,
  regenSettle,
  filterResolution = 1,
  filterEnabled = true,
  zoom,
  depth: depthProp,
  scale,
  regionScale,
  regionOriginX,
  regionOriginY,
  onFilterStats,
  lenses,
  pauseOffscreen = false,
  offscreenMargin = "300px 0px",
  className,
  style,
  ...rest
}: GlassProps) {
  const multiLens = !!(lenses && lenses.length > 0);

  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    setIsIOS(
      typeof navigator !== "undefined" &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)),
    );
  }, []);
  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(
      typeof navigator !== "undefined" &&
        /^((?!chrome|chromium|android).)*safari/i.test(navigator.userAgent),
    );
  }, []);

  const groupCtx = useContext(GlassContext);
  const groupVersionSeen = useRef(0);
  const targetVersionSeen = useRef(0);

  const hasExternalMap = !!displacementMapUrl;
  const merged: LensParams = { ...DEFAULT_LENS_PARAMS, ...lens };
  const effScaleX = scale ?? merged.scaleX;
  const effScaleY = scale ?? merged.scaleY;

  const uid = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const visible = useOffscreenPause(containerRef, offscreenMargin, pauseOffscreen);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const idCounter = useRef(0);
  const staticUrlRef = useRef<string | null>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const onLensMapChangeRef = useRef(onLensMapChange);
  onLensMapChangeRef.current = onLensMapChange;
  const onGenerationTimeRef = useRef(onGenerationTime);
  onGenerationTimeRef.current = onGenerationTime;
  const onFilterStatsRef = useRef(onFilterStats);
  onFilterStatsRef.current = onFilterStats;

  const lensWIn = lensWProp ?? merged.lensW;
  const lensHIn = lensHProp ?? merged.lensH;
  const depthIn = depthProp ?? merged.depth;
  const radiusIn = borderRadiusProp ?? merged.borderRadius;
  const animated = isMotionValue(lensWIn) || isMotionValue(lensHIn) || isMotionValue(radiusIn);

  // --- DOM refs written imperatively by applyLayout ---
  const contentRef = useRef<HTMLDivElement | null>(null);
  const mainFilterRef = useRef<SVGFilterElement | null>(null);
  const mainLensEls = useRef<Element[]>([]);
  const mainDispEls = useRef<SVGFEDisplacementMapElement[]>([]);
  const mainFeImageRef = useRef<SVGFEImageElement | null>(null);
  const mainMatrixRef = useRef<SVGFEColorMatrixElement | null>(null);
  const mainSpecularRef = useRef<SVGFECompositeElement | null>(null);
  const mainDarkSpecularRef = useRef<SVGFEColorMatrixElement | null>(null);
  const currentMapRef = useRef<string | null>(null);
  const overlayWrapRef = useRef<HTMLDivElement | null>(null);
  const outlineRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const restShadowRef = useRef<HTMLDivElement | null>(null);
  const tintBackdropRef = useRef<HTMLDivElement | null>(null);
  const maskKeyRef = useRef<string | null>(null);
  const brightnessRef = useRef<HTMLDivElement | null>(null);
  const tintRectRef = useRef<SVGRectElement | null>(null);
  const tintColorRef = useRef<HTMLDivElement | null>(null);
  const refractCopyRef = useRef<HTMLDivElement | null>(null);

  const tintColorPropRef = useRef(tintColor);
  tintColorPropRef.current = tintColor;
  const chromaRef = useRef(merged.chromaAmount);
  chromaRef.current = merged.chromaAmount;

  // --- live values driven by motion subscriptions ---
  const tintOpacityRef = useRef(1);
  const tintBlurRef = useRef(0);
  const shadowOpacityRef = useRef(1);
  const restShadowOpacityRef = useRef(0);
  const edgeBiasRef = useRef(0.5);
  const xRef = useRef(0.5);
  const yRef = useRef(0.5);
  const lensWRef = useRef(0);
  const lensHRef = useRef(0);
  const radiusRef = useRef(0);
  const scaleXRef = useRef(0);
  const scaleYRef = useRef(0);
  const zoomRef = useRef(1);
  const regionScaleRef = useRef(1);
  const regionOriginXRef = useRef<number | null>(null);
  const regionOriginYRef = useRef<number | null>(null);
  const ratioXRef = useRef(1);
  const ratioYRef = useRef(0);
  const dispScalesRef = useRef<number[]>([]);
  const lastLeftRef = useRef(NaN);
  const lastTopRef = useRef(NaN);
  const lastScaleRef = useRef(NaN);
  const layoutQueuedRef = useRef(0);
  const staticSetRef = useRef(false);
  const animatedGeneratedRef = useRef(false);

  const targetRectsRef = useRef<TargetRect[]>([]);
  const hasTargetsRef = useRef(false);
  const targetPools = useRef<TargetPool[]>(Array.from({ length: 4 }, makeTargetPool));
  const multiPools = useRef<MultiPool[]>(Array.from({ length: 8 }, makeMultiPool));
  const lensGeomRef = useRef(
    new Map<
      string,
      {
        x: number;
        y: number;
        regionScale: number;
        regionOriginX: number | null;
        regionOriginY: number | null;
        displScale: number;
      }
    >(),
  );
  const [lensMaps, setLensMaps] = useState<Map<string, string>>(() => new Map());
  const lensMapsRef = useRef(lensMaps);
  lensMapsRef.current = lensMaps;

  const poolFilterRefs = useRef(
    Array.from({ length: 4 }, (_, i) => ({
      get current() {
        return targetPools.current[i].filterEl;
      },
      set current(el: SVGFilterElement | null) {
        targetPools.current[i].filterEl = el;
      },
    })),
  );

  const { w: cw, h: ch } = containerSize;
  const resolutionScaled = filterResolution !== 1 && cw > 0 && ch > 0;
  const scaledPlain = resolutionScaled && !overlay && !refractionTarget;
  const scaledCopy = resolutionScaled && !!refractionTarget;
  const scaledOverlay = resolutionScaled && !!overlay;

  // --- container size tracking ---
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainerSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  // --- discover [data-refraction-target] children (non-group mode) ---
  useLayoutEffect(() => {
    if (groupCtx) return;
    const el = containerRef.current;
    if (!el || cw === 0) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-refraction-target]"));
    if (targets.length === 0) {
      targetRectsRef.current = [];
      hasTargetsRef.current = false;
      return;
    }
    hasTargetsRef.current = true;
    const measure = () => {
      const cr = el.getBoundingClientRect();
      targetRectsRef.current = targets.map((t) => {
        const r = t.getBoundingClientRect();
        return { el: t, left: r.left - cr.left, top: r.top - cr.top, width: r.width, height: r.height };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    targets.forEach((t) => ro.observe(t));
    return () => {
      ro.disconnect();
      for (const p of targetPools.current) releaseTargetPool(p);
    };
  }, [cw, ch, groupCtx]);

  // --- static (non-animated) map generation ---
  useEffect(() => {
    if (!filterEnabled || hasExternalMap || animated || multiLens || lenses !== undefined) return;
    let cancelled = false;
    const t0 = performance.now();
    if (!staticCanvasRef.current) staticCanvasRef.current = document.createElement("canvas");
    generateDisplacementMap(staticCanvasRef.current, {
      canvasSize: merged.mapSize,
      lensHalfWidth: merged.lensW,
      lensHalfHeight: merged.lensH,
      borderRadius: merged.borderRadius,
      depth: merged.depth,
      sdfBoundary: merged.sdfBoundary,
      edgeFalloff: merged.edgeFalloff,
      specularRotation: merged.specularRotation,
      glowStrength: merged.glowStrength,
      glowSpread: merged.glowSpread,
      glowExponent: merged.glowExponent,
      edgeStrength: merged.edgeStrength,
      edgeWidth: merged.edgeWidth,
      edgeExponent: merged.edgeExponent,
      domeDepth: merged.domeDepth,
      splayAmount: merged.splayAmount,
    }).then((url) => {
      if (cancelled || !url) return;
      if (staticUrlRef.current) URL.revokeObjectURL(staticUrlRef.current);
      staticUrlRef.current = url;
      setStaticMapUrl(url);
      onLensMapChangeRef.current?.(url);
      const total = performance.now() - t0;
      onGenerationTimeRef.current?.({ total, loopMs: total, encodeMs: 0 });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterEnabled,
    hasExternalMap,
    animated,
    multiLens,
    lenses !== undefined,
    merged.mapSize,
    merged.depth,
    merged.borderRadius,
    merged.lensW,
    merged.lensH,
    merged.sdfBoundary,
    merged.edgeFalloff,
    merged.specularRotation,
    merged.glowStrength,
    merged.glowSpread,
    merged.glowExponent,
    merged.edgeStrength,
    merged.edgeWidth,
    merged.edgeExponent,
    merged.domeDepth,
    merged.splayAmount,
  ]);
  useEffect(
    () => () => {
      if (staticUrlRef.current) URL.revokeObjectURL(staticUrlRef.current);
      onLensMapChangeRef.current?.(null);
      if (staticCanvasRef.current) {
        staticCanvasRef.current.width = 0;
        staticCanvasRef.current.height = 0;
        staticCanvasRef.current = null;
      }
    },
    [],
  );
  staticSetRef.current = !!staticMapUrl;

  // --- multi-lens map generation (one map per lens signature) ---
  const lensSigRef = useRef(new Map<string, string>());
  useEffect(() => {
    if (!multiLens) return;
    let cancelled = false;
    const sigs = lensSigRef.current;
    for (const inst of lenses ?? []) {
      const p: LensParams = { ...DEFAULT_LENS_PARAMS, ...inst.lens };
      const sig = JSON.stringify([
        p.mapSize, p.borderRadius, p.depth, p.sdfBoundary, p.edgeFalloff,
        p.specularRotation, p.glowStrength, p.glowSpread, p.glowExponent,
        p.edgeStrength, p.edgeWidth, p.edgeExponent, p.domeDepth, p.splayAmount,
        inst.lensW, inst.lensH,
      ]);
      if (sigs.get(inst.id) === sig) continue;
      sigs.set(inst.id, sig);
      generateDisplacementMap(document.createElement("canvas"), {
        canvasSize: p.mapSize,
        lensHalfWidth: inst.lensW,
        lensHalfHeight: inst.lensH,
        borderRadius: p.borderRadius,
        depth: p.depth,
        sdfBoundary: p.sdfBoundary,
        edgeFalloff: p.edgeFalloff,
        specularRotation: p.specularRotation,
        glowStrength: p.glowStrength,
        glowSpread: p.glowSpread,
        glowExponent: p.glowExponent,
        edgeStrength: p.edgeStrength,
        edgeWidth: p.edgeWidth,
        edgeExponent: p.edgeExponent,
        domeDepth: p.domeDepth,
        splayAmount: p.splayAmount,
      }).then((url) => {
        if (cancelled || !url) return;
        if (sigs.get(inst.id) !== sig) {
          URL.revokeObjectURL(url);
          return;
        }
        // Decode before swapping in, so the filter never samples a half-loaded map.
        const img = new Image();
        img.onload = () => {
          if (cancelled || sigs.get(inst.id) !== sig) {
            URL.revokeObjectURL(url);
            return;
          }
          setLensMaps((prev) => {
            const next = new Map(prev);
            const old = next.get(inst.id);
            if (old) URL.revokeObjectURL(old);
            next.set(inst.id, url);
            return next;
          });
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      });
    }
    return () => {
      cancelled = true;
    };
  }, [multiLens, lenses]);

  // --- animated regeneration (motion-valued lens geometry) ---
  useMapRegen({
    animated: animated && !hasExternalMap && (filterEnabled || animatedGeneratedRef.current),
    containerReady: cw > 0 && ch > 0,
    lensW: lensWIn,
    lensH: lensHIn,
    borderRadius: radiusIn,
    depth: depthIn,
    mapSize: merged.mapSize,
    sdfBoundary: merged.sdfBoundary,
    edgeFalloff: merged.edgeFalloff,
    specularRotation: merged.specularRotation,
    glowStrength: merged.glowStrength,
    glowSpread: merged.glowSpread,
    glowExponent: merged.glowExponent,
    edgeStrength: merged.edgeStrength,
    edgeWidth: merged.edgeWidth,
    edgeExponent: merged.edgeExponent,
    domeDepth: merged.domeDepth,
    splayAmount: merged.splayAmount,
    autoBorderRadius: !!autoBorderRadius,
    regenSettle,
    feImageRef: mainFeImageRef,
    onGenerationTime,
    onMapGenerated: (url) => {
      currentMapRef.current = url;
      animatedGeneratedRef.current = true;
      queueMicrotask(() => onLensMapChangeRef.current?.(url));
      idCounter.current++;
      if (mainFilterRef.current) mainFilterRef.current.id = `${uid}-v${idCounter.current}`;
      for (let i = 0; i < 4; i++) {
        const p = targetPools.current[i];
        if (p.assignedTo && p.filterEl) {
          p.feImageEl?.setAttribute("href", url);
          p.version++;
          p.filterEl.id = `${uid}-pool-${i}-v${p.version}`;
        }
      }
      lastLeftRef.current = NaN;
      applyLayoutRef.current();
    },
  });

  // --- the geometry pass: positions every imperative layer, assigns pools ---
  const applyLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!visibleRef.current) {
      if (contentRef.current) contentRef.current.style.filter = "";
      if (refractCopyRef.current) refractCopyRef.current.style.filter = "";
      return;
    }
    const sx = scaleXRef.current;
    const sy = scaleYRef.current;
    const maxS = Math.max(sx, sy);
    ratioXRef.current = maxS > 0 ? sx / maxS : 0;
    ratioYRef.current = maxS > 0 ? sy / maxS : 0;
    const chroma = chromaRef.current;
    const ds = dispScalesRef.current;
    if (chroma > 0) {
      ds[0] = maxS * (1 + 0.2 * chroma);
      ds[1] = maxS * (1 + 0.1 * chroma);
      ds[2] = maxS;
      ds.length = 3;
    } else {
      ds[0] = maxS;
      ds.length = 1;
    }

    if (groupCtx && groupCtx.version.current !== groupVersionSeen.current) {
      groupVersionSeen.current = groupCtx.version.current;
      lastLeftRef.current = NaN;
    }
    if (groupCtx && groupCtx.targetVersion.current !== targetVersionSeen.current) {
      targetVersionSeen.current = groupCtx.targetVersion.current;
      const map = groupCtx.targets.current;
      if (map.size > 0) {
        hasTargetsRef.current = true;
        targetRectsRef.current = Array.from(map.values());
      } else {
        hasTargetsRef.current = false;
        targetRectsRef.current = [];
      }
      for (const p of targetPools.current) {
        if (p.assignedTo && !map.has(p.assignedTo)) releaseTargetPool(p);
      }
      for (const p of multiPools.current) {
        if (p.assignedTo && !map.has(p.assignedTo)) releaseMultiPool(p);
      }
    }

    // ---------- multi-lens path ----------
    if (multiLens) {
      if (!filterEnabled) {
        for (const pool of multiPools.current) releaseMultiPool(pool);
        return;
      }
      if (!hasTargetsRef.current || targetRectsRef.current.length === 0) return;
      const cr = container.getBoundingClientRect();
      const w = cr.width || cw;
      const h = cr.height || ch;
      interface Geom {
        id: string;
        imgX: number;
        imgY: number;
        fullW: number;
        fullH: number;
        displScale: number;
        pad: number;
        mapUrl: string;
        borderRadius: number;
        maxDisplScale: number;
      }
      const geoms: Geom[] = [];
      let maxPad = 0;
      for (const inst of lenses!) {
        const g = lensGeomRef.current.get(inst.id);
        if (!g) continue;
        const mapUrl = lensMapsRef.current.get(inst.id);
        if (!mapUrl) continue;
        const cx = g.x * w;
        const cy = g.y * h;
        let left = cx - inst.lensW;
        let top = cy - inst.lensH;
        let fullW = 2 * inst.lensW;
        let fullH = 2 * inst.lensH;
        const maxD = inst.maxDisplScale ?? g.displScale;
        const pad = Math.ceil(maxD * Math.max(fullW, fullH) * 0.5);
        if (g.regionScale !== 1) {
          const ox = g.regionOriginX ?? cx;
          const oy = g.regionOriginY ?? cy;
          left = ox + (left - ox) * g.regionScale;
          top = oy + (top - oy) * g.regionScale;
          fullW *= g.regionScale;
          fullH *= g.regionScale;
        }
        if (pad > maxPad) maxPad = pad;
        geoms.push({
          id: inst.id,
          imgX: left,
          imgY: top,
          fullW,
          fullH,
          displScale: g.displScale,
          pad,
          mapUrl,
          borderRadius: inst.lens?.borderRadius ?? DEFAULT_LENS_PARAMS.borderRadius,
          maxDisplScale: maxD,
        });
      }
      if (groupCtx) {
        const prev = groupCtx.bleedRef.current;
        groupCtx.bleedRef.current = maxPad;
        if (maxPad !== prev && hasTargetsRef.current) {
          for (const t of targetRectsRef.current) {
            if (!t.nested) {
              t.el.style.padding = `${maxPad}px`;
              t.el.style.margin = `${-maxPad}px`;
              t.el.style.boxSizing = "content-box";
            }
          }
        }
      }
      const geomById = new Map(geoms.map((g) => [g.id, g]));
      interface Cand {
        target: TargetRect;
        overlapping: { geom: Geom; area: number }[];
        totalArea: number;
      }
      const cands: Cand[] = [];
      for (const t of targetRectsRef.current) {
        const r = t.el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const local: TargetRect = {
          el: t.el,
          left: r.left - cr.left,
          top: r.top - cr.top,
          width: r.width,
          height: r.height,
        };
        const overlapping: { geom: Geom; area: number }[] = [];
        let totalArea = 0;
        for (const g of geoms) {
          const ow = Math.min(g.imgX + g.fullW, local.left + local.width) - Math.max(g.imgX, local.left);
          const oh = Math.min(g.imgY + g.fullH, local.top + local.height) - Math.max(g.imgY, local.top);
          if (ow > 0 && oh > 0) {
            const area = ow * oh;
            if (area >= 1000) {
              overlapping.push({ geom: g, area });
              totalArea += area;
            }
          }
        }
        if (overlapping.length > 0) cands.push({ target: local, overlapping, totalArea });
      }
      cands.sort((a, b) => b.totalArea - a.totalArea);
      if (cands.length > 8) cands.length = 8;
      const keep = new Set(cands.map((c) => c.target.el));
      for (const p of multiPools.current) {
        if (p.assignedTo && !keep.has(p.assignedTo)) releaseMultiPool(p);
      }
      for (const cand of cands) {
        let pool: MultiPool | null = null;
        let poolIdx = -1;
        for (let i = 0; i < multiPools.current.length; i++) {
          if (multiPools.current[i].assignedTo === cand.target.el) {
            pool = multiPools.current[i];
            poolIdx = i;
            break;
          }
        }
        if (!pool) {
          for (let i = 0; i < multiPools.current.length; i++) {
            if (multiPools.current[i].assignedTo === null) {
              pool = multiPools.current[i];
              poolIdx = i;
              break;
            }
          }
        }
        if (!pool) continue;
        if (pool.assignedTo !== cand.target.el) {
          pool.assignedTo = cand.target.el;
          cand.target.el.style.willChange = "filter";
        }
        const byArea = [...cand.overlapping].sort((a, b) => b.area - a.area);
        if (byArea.length > 4) byArea.length = 4;
        const keepIds = new Set(byArea.map((o) => o.geom.id));
        for (const s of pool.subSlots) {
          if (s.assignedLensId && !keepIds.has(s.assignedLensId)) {
            s.assignedLensId = null;
            resetSubSlot(s);
          }
        }
        for (const o of byArea) {
          let slot = pool.subSlots.find((s) => s.assignedLensId === o.geom.id);
          if (!slot) slot = pool.subSlots.find((s) => s.assignedLensId === null);
          if (slot && slot.assignedLensId !== o.geom.id) {
            slot.assignedLensId = o.geom.id;
            resetSubSlot(slot);
          }
        }
        const tw = cand.target.width;
        const th = cand.target.height;
        const maxDim = Math.max(tw, th);
        const scaleBasis = isIOS ? 1 : maxDim;
        let maxSlotScale = 0;
        const slotScale = new Map<string, number>();
        for (const s of pool.subSlots) {
          if (!s.assignedLensId) continue;
          const g = geomById.get(s.assignedLensId);
          if (!g) continue;
          const lensDim = Math.max(g.fullW, g.fullH);
          const v = scaleBasis > 0 ? (g.displScale * lensDim) / scaleBasis : 0;
          slotScale.set(g.id, v);
          if (v > maxSlotScale) maxSlotScale = v;
        }
        let dirty = false;
        if (isIOS) {
          const ws = String(tw);
          const hs = String(th);
          if (pool.lastFilterW !== ws) {
            pool.filterEl?.setAttribute("width", ws);
            pool.lastFilterW = ws;
            dirty = true;
          }
          if (pool.lastFilterH !== hs) {
            pool.filterEl?.setAttribute("height", hs);
            pool.lastFilterH = hs;
            dirty = true;
          }
        }
        const emptyW = isIOS ? "1" : "0.001";
        const emptyH = isIOS ? "1" : "0.001";
        for (const s of pool.subSlots) {
          if (!s.assignedLensId) {
            if (s.lastX !== "0" || s.lastY !== "0" || s.lastW !== emptyW || s.lastH !== emptyH) {
              s.feImageEl?.setAttribute("x", "0");
              s.feImageEl?.setAttribute("y", "0");
              s.feImageEl?.setAttribute("width", emptyW);
              s.feImageEl?.setAttribute("height", emptyH);
              s.feMaskEl?.setAttribute("x", "0");
              s.feMaskEl?.setAttribute("y", "0");
              s.feMaskEl?.setAttribute("width", emptyW);
              s.feMaskEl?.setAttribute("height", emptyH);
              s.lastX = "0";
              s.lastY = "0";
              s.lastW = emptyW;
              s.lastH = emptyH;
              dirty = true;
            }
            continue;
          }
          const g = geomById.get(s.assignedLensId);
          if (!g) continue;
          if (s.lastHref !== g.mapUrl) {
            s.feImageEl?.setAttribute("href", g.mapUrl);
            s.lastHref = g.mapUrl;
            dirty = true;
          }
          const lx = g.imgX - cand.target.left;
          const ly = g.imgY - cand.target.top;
          const xs = isIOS ? String(lx) : tw > 0 ? String(lx / tw) : "0";
          const ys = isIOS ? String(ly) : th > 0 ? String(ly / th) : "0";
          const ws = isIOS ? String(g.fullW) : tw > 0 ? String(g.fullW / tw) : "0";
          const hs = isIOS ? String(g.fullH) : th > 0 ? String(g.fullH / th) : "0";
          if (s.lastX !== xs) {
            s.feImageEl?.setAttribute("x", xs);
            s.feMaskEl?.setAttribute("x", xs);
            s.lastX = xs;
            dirty = true;
          }
          if (s.lastY !== ys) {
            s.feImageEl?.setAttribute("y", ys);
            s.feMaskEl?.setAttribute("y", ys);
            s.lastY = ys;
            dirty = true;
          }
          if (s.lastW !== ws) {
            s.feImageEl?.setAttribute("width", ws);
            s.feMaskEl?.setAttribute("width", ws);
            s.lastW = ws;
            dirty = true;
          }
          if (s.lastH !== hs) {
            s.feImageEl?.setAttribute("height", hs);
            s.feMaskEl?.setAttribute("height", hs);
            s.lastH = hs;
            dirty = true;
          }
          const { uri, key } = roundedRectUri(g.fullW, g.fullH, g.borderRadius);
          if (s.lastMaskKey !== key) {
            s.feMaskEl?.setAttribute("href", uri);
            s.lastMaskKey = key;
            dirty = true;
          }
          const v = slotScale.get(g.id) ?? 0;
          const ratio = maxSlotScale > 0 ? v / maxSlotScale : 0;
          const off = 0.5 * (1 - ratio);
          const cm = `${ratio} 0 0 0 ${off}  0 ${ratio} 0 0 ${off}  0 0 0 0 0  0 0 0 1 0`;
          if (s.lastColorMatrix !== cm) {
            s.feColorMatrixEl?.setAttribute("values", cm);
            s.lastColorMatrix = cm;
            dirty = true;
          }
          const alpha = g.maxDisplScale > 0 ? Math.max(0, Math.min(1, g.displScale / g.maxDisplScale)) : 0;
          const mm = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${alpha.toFixed(4)} 0`;
          if (s.lastMaskColorMatrix !== mm) {
            s.feMaskColorMatrixEl?.setAttribute("values", mm);
            s.lastMaskColorMatrix = mm;
            dirty = true;
          }
        }
        const scaleStr = String(maxSlotScale);
        if (pool.lastDispScale !== scaleStr) {
          pool.feDispEl?.setAttribute("scale", scaleStr);
          pool.lastDispScale = scaleStr;
          dirty = true;
        }
        if (dirty) pool.version++;
        const fid = `${uid}-ml-${poolIdx}-v${pool.version}`;
        if (dirty && pool.filterEl) pool.filterEl.id = fid;
        const url = `url(#${fid})`;
        if (cand.target.el.style.filter !== url) cand.target.el.style.filter = url;
      }
      if (contentRef.current?.style.filter) contentRef.current.style.filter = "";
      if (refractCopyRef.current?.style.filter) refractCopyRef.current.style.filter = "";
      return;
    }
    if (lenses !== undefined) return;

    // ---------- single-lens path ----------
    const hw = lensWRef.current;
    const hh = lensHRef.current;
    const cr = container.getBoundingClientRect();
    const w = cr.width || cw;
    const h = cr.height || ch;
    let pxBasis = 0;
    let fx = 1;
    let fy = 1;
    if (isIOS) {
      const pxX = sx * w;
      const pxY = sy * h;
      pxBasis = Math.max(pxX, pxY);
      fx = pxBasis > 0 ? pxX / pxBasis : 1;
      fy = pxBasis > 0 ? pxY / pxBasis : 1;
    }
    const cx = xRef.current * w;
    const cy = yRef.current * h;
    const res = filterResolution !== 1 && cw > 0 && ch > 0 ? filterResolution : 1;
    let radius = autoBorderRadius ? Math.min(hw, hh) : radiusRef.current;
    let lw = 2 * hw;
    let lh = 2 * hh;
    let left = cx - hw;
    let top = cy - hh;
    const maxDim = Math.max(lw, lh);
    const bleed = Math.ceil(maxS * maxDim * 0.5);
    const rs = regionScaleRef.current;
    if (rs !== 1) {
      const ox = regionOriginXRef.current ?? cx;
      const oy = regionOriginYRef.current ?? cy;
      left = ox + (left - ox) * rs;
      top = oy + (top - oy) * rs;
      lw *= rs;
      lh *= rs;
      radius *= rs;
    }
    if (groupCtx) {
      const prev = groupCtx.bleedRef.current;
      groupCtx.bleedRef.current = bleed;
      if (bleed !== prev && hasTargetsRef.current) {
        for (const t of targetRectsRef.current) {
          if (!t.nested) {
            t.el.style.padding = `${bleed}px`;
            t.el.style.margin = `${-bleed}px`;
            t.el.style.boxSizing = "content-box";
          }
        }
      }
    }
    const moved = left !== lastLeftRef.current || top !== lastTopRef.current;
    lastLeftRef.current = left;
    lastTopRef.current = top;
    const scaleChanged = maxS !== lastScaleRef.current;
    lastScaleRef.current = maxS;

    if (moved || scaleChanged) {
      const active = filterEnabled && (hasExternalMap
        ? !!displacementMapUrl
        : staticSetRef.current || animatedGeneratedRef.current);
      if (hasTargetsRef.current && targetRectsRef.current.length > 0) {
        // Per-element pooled filters: refraction only touches the targets.
        const hits: { target: TargetRect; area: number }[] = [];
        for (const t of targetRectsRef.current) {
          const ow = Math.min(left + lw, t.left + t.width) - Math.max(left, t.left);
          const oh = Math.min(top + lh, t.top + t.height) - Math.max(top, t.top);
          if (ow > 0 && oh > 0 && ow * oh >= 1000) hits.push({ target: t, area: ow * oh });
        }
        if (hits.length > 1) hits.sort((a, b) => b.area - a.area);
        if (hits.length > 4) hits.length = 4;
        const pools = targetPools.current;
        for (const p of pools) {
          if (p.assignedTo && !hits.some((c) => c.target.el === p.assignedTo)) releaseTargetPool(p);
        }
        for (const { target } of hits) {
          let pool: TargetPool | undefined;
          let idx = -1;
          let free = -1;
          for (let i = 0; i < pools.length; i++) {
            if (pools[i].assignedTo === target.el) {
              pool = pools[i];
              idx = i;
              break;
            }
            if (free === -1 && pools[i].assignedTo === null) free = i;
          }
          if (!pool && free !== -1) {
            pool = pools[free];
            idx = free;
            pool.assignedTo = target.el;
            pool.assignedRect = target;
            target.el.style.willChange = "filter";
          }
          if (!pool || !pool.filterEl) continue;
          const lx = left - target.left + bleed;
          const ly = top - target.top + bleed;
          for (const el of pool.lensEls) {
            el.setAttribute("x", String(lx));
            el.setAttribute("y", String(ly));
            el.setAttribute("width", String(lw));
            el.setAttribute("height", String(lh));
          }
          pool.filterEl.setAttribute("x", "0");
          pool.filterEl.setAttribute("y", "0");
          pool.filterEl.setAttribute("width", String(target.width + 2 * bleed));
          pool.filterEl.setAttribute("height", String(target.height + 2 * bleed));
          for (let i = 0; i < pool.dispEls.length; i++) {
            pool.dispEls[i].setAttribute("scale", String((ds[i] ?? 0) * maxDim));
          }
          if (pool.mapMatrixEl) {
            const z = zoomRef.current;
            pool.mapMatrixEl.setAttribute(
              "values",
              axisScaleMatrix(ratioXRef.current * z, ratioYRef.current * z),
            );
          }
          pool.version++;
          pool.filterEl.id = `${uid}-pool-${idx}-v${pool.version}`;
          const url = active ? `url(#${pool.filterEl.id})` : "";
          if (target.el.style.filter !== url) target.el.style.filter = url;
        }
        if (contentRef.current) contentRef.current.style.filter = "";
        if (refractCopyRef.current) refractCopyRef.current.style.filter = "";
        if (onFilterStatsRef.current) {
          let n = 0;
          let px = 0;
          for (const p of pools) {
            if (p.assignedRect) {
              n++;
              px += p.assignedRect.width * p.assignedRect.height;
            }
          }
          onFilterStatsRef.current({ activeTargets: n, totalPixels: px });
        }
      } else {
        // Whole-content filter: lens subregion attributes + id bump.
        const bias = edgeBiasRef.current;
        let xa: string;
        let ya: string;
        let wa: string;
        let ha: string;
        if (isIOS) {
          xa = String((left + bias) * res);
          ya = String((top + bias) * res);
          wa = String(Math.max(0, lw - 2 * bias) * res);
          ha = String(Math.max(0, lh - 2 * bias) * res);
          if (mainFilterRef.current) {
            mainFilterRef.current.setAttribute("x", "0");
            mainFilterRef.current.setAttribute("y", "0");
            mainFilterRef.current.setAttribute("width", String(w * res));
            mainFilterRef.current.setAttribute("height", String(h * res));
          }
          const perUnit = maxS > 0 ? (zoomRef.current * res * pxBasis) / maxS : 0;
          for (let i = 0; i < mainDispEls.current.length; i++) {
            mainDispEls.current[i].setAttribute("scale", String((ds[i] ?? 0) * perUnit));
          }
          void fx;
          void fy;
        } else {
          xa = String((left + bias) / w);
          ya = String((top + bias) / h);
          wa = String(Math.max(0, lw - 2 * bias) / w);
          ha = String(Math.max(0, lh - 2 * bias) / h);
          if (scaleChanged) {
            for (let i = 0; i < mainDispEls.current.length; i++) {
              mainDispEls.current[i].setAttribute("scale", String(ds[i] ?? 0));
            }
          }
        }
        for (const el of mainLensEls.current) {
          el.setAttribute("x", xa);
          el.setAttribute("y", ya);
          el.setAttribute("width", wa);
          el.setAttribute("height", ha);
        }
        idCounter.current++;
        const fid = `${uid}-v${idCounter.current}`;
        if (mainFilterRef.current) mainFilterRef.current.id = fid;
        const url = active ? `url(#${fid})` : "";
        if (refractCopyRef.current) {
          if (refractCopyRef.current.style.filter !== url) refractCopyRef.current.style.filter = url;
          if (contentRef.current) contentRef.current.style.filter = "";
          const it = Math.max(0, top * res);
          const il = Math.max(0, left * res);
          const ir = Math.max(0, (w - (left + lw)) * res);
          const ib = Math.max(0, (h - (top + lh)) * res);
          refractCopyRef.current.style.clipPath = `inset(${it}px ${ir}px ${ib}px ${il}px round ${radius * res}px)`;
        } else if (contentRef.current && contentRef.current.style.filter !== url) {
          contentRef.current.style.filter = url;
        }
      }
    }

    // --- decorative layers follow the lens rect every pass ---
    if (outlineRef.current) {
      outlineRef.current.style.transform = `translate(${left}px, ${top}px)`;
      outlineRef.current.style.width = `${lw}px`;
      outlineRef.current.style.height = `${lh}px`;
      outlineRef.current.style.borderRadius = `${radius}px`;
    }
    const placeShadow = (el: HTMLDivElement | null, opacity: number) => {
      if (!el) return;
      el.style.transform = `translate(${left}px, ${top}px)`;
      el.style.width = `${lw}px`;
      el.style.height = `${lh}px`;
      el.style.borderRadius = `${radius}px`;
      el.style.opacity = String(opacity);
    };
    placeShadow(shadowRef.current, shadowOpacityRef.current);
    placeShadow(restShadowRef.current, restShadowOpacityRef.current);
    if (tintBackdropRef.current) {
      const el = tintBackdropRef.current;
      el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      el.style.width = `${lw}px`;
      el.style.height = `${lh}px`;
      el.style.borderRadius = `${radius}px`;
      const { uri, key } = roundedRectUri(lw, lh, radius);
      if (maskKeyRef.current !== key) {
        const u = `url("${uri}")`;
        el.style.maskImage = u;
        el.style.setProperty("-webkit-mask-image", u);
        el.style.maskSize = "100% 100%";
        el.style.setProperty("-webkit-mask-size", "100% 100%");
        maskKeyRef.current = key;
      }
    }
    if (brightnessRef.current && !overlayWrapRef.current) {
      brightnessRef.current.style.clipPath = `inset(${top}px ${w - (left + lw)}px ${h - (top + lh)}px ${left}px round ${radius}px)`;
    }
    if (tintRectRef.current) {
      tintRectRef.current.setAttribute("x", String(left));
      tintRectRef.current.setAttribute("y", String(top));
      tintRectRef.current.setAttribute("width", String(lw));
      tintRectRef.current.setAttribute("height", String(lh));
      tintRectRef.current.setAttribute("rx", String(radius));
    }
    if (tintColorRef.current) {
      const el = tintColorRef.current;
      el.style.transform = `translate(${left}px, ${top}px)`;
      el.style.width = `${lw}px`;
      el.style.height = `${lh}px`;
      el.style.borderRadius = `${radius}px`;
      const c = tintColorPropRef.current ?? "white";
      el.style.background = `color-mix(in srgb, ${c} ${100 * tintOpacityRef.current}%, transparent)`;
      el.style.opacity = "1";
      const blur = tintBlurRef.current > 0 ? `blur(${tintBlurRef.current}px)` : "none";
      el.style.backdropFilter = blur;
      el.style.setProperty("-webkit-backdrop-filter", blur);
    }
    if (overlayWrapRef.current && brightnessRef.current) {
      brightnessRef.current.style.clipPath = `inset(${Math.max(0, top * res)}px ${Math.max(0, (w - left - lw) * res)}px ${Math.max(0, (h - top - lh) * res)}px ${Math.max(0, left * res)}px round ${radius * res}px)`;
    }
    if (mainMatrixRef.current && !hasTargetsRef.current) {
      if (isIOS) {
        mainMatrixRef.current.setAttribute("values", axisScaleMatrix(ratioXRef.current, ratioYRef.current));
      } else {
        const z = zoomRef.current;
        mainMatrixRef.current.setAttribute(
          "values",
          axisScaleMatrix(ratioXRef.current * z, ratioYRef.current * z),
        );
      }
    }
  }, [
    uid,
    cw,
    ch,
    hasExternalMap,
    displacementMapUrl,
    multiLens,
    lenses,
    lensMaps,
    autoBorderRadius,
    filterResolution,
    isIOS,
    groupCtx,
    filterEnabled,
  ]);
  const applyLayoutRef = useRef(applyLayout);
  applyLayoutRef.current = applyLayout;

  const scheduleLayout = useCallback(() => {
    if (layoutQueuedRef.current) return;
    layoutQueuedRef.current = 1;
    queueMicrotask(() => {
      layoutQueuedRef.current = 0;
      applyLayoutRef.current();
    });
  }, []);

  useEffect(() => {
    if (!pauseOffscreen) return;
    if (visible) {
      lastLeftRef.current = NaN;
      lastTopRef.current = NaN;
      lastScaleRef.current = NaN;
    }
    applyLayoutRef.current();
  }, [visible, pauseOffscreen]);

  // --- bind motion inputs to live refs ---
  useLayoutEffect(() => {
    const unsubs: Array<() => void> = [];
    const bind = (
      v: MotionInput | undefined,
      ref: React.MutableRefObject<number>,
      fallback: number,
    ) => {
      if (v === undefined) {
        ref.current = fallback;
        return;
      }
      if (isMotionValue(v)) {
        ref.current = v.get();
        unsubs.push(
          v.on("change", (nv) => {
            ref.current = nv;
            scheduleLayout();
          }),
        );
      } else {
        ref.current = v;
      }
    };
    const bindNullable = (
      v: MotionInput | undefined,
      ref: React.MutableRefObject<number | null>,
    ) => {
      if (v === undefined) {
        ref.current = null;
        return;
      }
      const norm = (n: number) => (Number.isFinite(n) ? n : null);
      if (isMotionValue(v)) {
        ref.current = norm(v.get());
        unsubs.push(
          v.on("change", (nv) => {
            ref.current = norm(nv);
            scheduleLayout();
          }),
        );
      } else {
        ref.current = norm(v);
      }
    };
    const shared = groupCtx?.activeLens.current;
    if (shared) {
      groupVersionSeen.current = groupCtx!.version.current;
      bind(shared.x, xRef, 0);
      bind(shared.y, yRef, 0);
      bind(shared.lensW, lensWRef, 0);
      bind(shared.lensH, lensHRef, 0);
      bind(shared.borderRadius, radiusRef, 0);
      bind(shared.scaleX, scaleXRef, 0);
      bind(shared.scaleY, scaleYRef, 0);
    } else {
      bind(x, xRef, 0);
      bind(y, yRef, 0);
      bind(lensWIn, lensWRef, 0);
      bind(lensHIn, lensHRef, 0);
      bind(radiusIn, radiusRef, 0);
      bind(effScaleX, scaleXRef, 0);
      bind(effScaleY, scaleYRef, 0);
    }
    bind(tintOpacity, tintOpacityRef, 1);
    bind(tintBlur, tintBlurRef, 0);
    bind(shadowOpacity, shadowOpacityRef, 1);
    bind(restShadowOpacity, restShadowOpacityRef, 0);
    bind(edgeBias, edgeBiasRef, 0.5);
    bind(zoom, zoomRef, 1);
    bind(regionScale, regionScaleRef, 1);
    bindNullable(regionOriginX, regionOriginXRef);
    bindNullable(regionOriginY, regionOriginYRef);
    applyLayout();
    return () => {
      unsubs.forEach((u) => u());
      layoutQueuedRef.current = 0;
    };
  }, [
    x,
    y,
    lensWIn,
    lensHIn,
    radiusIn,
    effScaleX,
    effScaleY,
    tintOpacity,
    tintBlur,
    shadowOpacity,
    restShadowOpacity,
    edgeBias,
    zoom,
    regionScale,
    regionOriginX,
    regionOriginY,
    applyLayout,
    scheduleLayout,
    groupCtx,
  ]);

  // --- multi-lens geometry subscriptions ---
  useLayoutEffect(() => {
    if (!multiLens) return;
    const unsubs: Array<() => void> = [];
    const geoms = lensGeomRef.current;
    const seen = new Set<string>();
    const ensure = (id: string) => {
      let g = geoms.get(id);
      if (!g) {
        g = { x: 0, y: 0, regionScale: 1, regionOriginX: null, regionOriginY: null, displScale: 0 };
        geoms.set(id, g);
      }
      return g;
    };
    for (const inst of lenses!) {
      seen.add(inst.id);
      const g = ensure(inst.id);
      g.x = inst.x.get();
      g.y = inst.y.get();
      g.regionScale = inst.regionScale.get();
      const ox = inst.regionOriginX.get();
      const oy = inst.regionOriginY.get();
      g.regionOriginX = Number.isFinite(ox) ? ox : null;
      g.regionOriginY = Number.isFinite(oy) ? oy : null;
      g.displScale = inst.displScale.get();
      unsubs.push(inst.x.on("change", (v) => ((g.x = v), scheduleLayout())));
      unsubs.push(inst.y.on("change", (v) => ((g.y = v), scheduleLayout())));
      unsubs.push(inst.regionScale.on("change", (v) => ((g.regionScale = v), scheduleLayout())));
      unsubs.push(
        inst.regionOriginX.on("change", (v) => {
          g.regionOriginX = Number.isFinite(v) ? v : null;
          scheduleLayout();
        }),
      );
      unsubs.push(
        inst.regionOriginY.on("change", (v) => {
          g.regionOriginY = Number.isFinite(v) ? v : null;
          scheduleLayout();
        }),
      );
      unsubs.push(inst.displScale.on("change", (v) => ((g.displScale = v), scheduleLayout())));
    }
    for (const id of Array.from(geoms.keys())) if (!seen.has(id)) geoms.delete(id);
    scheduleLayout();
    return () => unsubs.forEach((u) => u());
  }, [multiLens, lenses, scheduleLayout]);

  // --- derived filter-structure flags ---
  const maxScale = Math.max(effScaleX, effScaleY);
  const ratioX = maxScale > 0 ? effScaleX / maxScale : 0;
  const ratioY = maxScale > 0 ? effScaleY / maxScale : 0;
  const matrixValues = axisScaleMatrix(ratioX, ratioY);
  const hasBlur = merged.blurAmount > 0;
  const tintFallback = merged.tint !== 0 && maxScale === 0;
  const hasChroma = merged.chromaAmount > 0;
  const hasSpec = merged.glowStrength > 0 || merged.edgeStrength > 0;
  const unityRatios = ratioX === 1 && ratioY === 1;
  const specularGain = merged.specularStrength * readMotion(specularOpacity ?? 1);

  // --- re-query imperative elements whenever the filter JSX shape changes ---
  useLayoutEffect(() => {
    if (mainFilterRef.current) {
      mainLensEls.current = Array.from(mainFilterRef.current.querySelectorAll("[data-lens]"));
      mainDispEls.current = Array.from(mainFilterRef.current.querySelectorAll("feDisplacementMap"));
    } else {
      mainLensEls.current = [];
      mainDispEls.current = [];
    }
    for (const p of targetPools.current) {
      if (p.filterEl) {
        p.lensEls = Array.from(p.filterEl.querySelectorAll("[data-lens]"));
        p.dispEls = Array.from(p.filterEl.querySelectorAll("feDisplacementMap"));
        p.mapMatrixEl = p.filterEl.querySelector("[data-map-matrix]");
        p.feImageEl = p.filterEl.querySelector("[data-map-image]");
        if (p.feImageEl && currentMapRef.current) {
          p.feImageEl.setAttribute("href", currentMapRef.current);
        }
      }
    }
    idCounter.current++;
    if (mainFilterRef.current) mainFilterRef.current.id = `${uid}-v${idCounter.current}`;
    for (let i = 0; i < 4; i++) {
      const p = targetPools.current[i];
      if (p.filterEl) {
        p.version++;
        p.filterEl.id = `${uid}-pool-${i}-v${p.version}`;
        if (p.assignedTo) p.assignedTo.style.filter = `url(#${p.filterEl.id})`;
      }
    }
    if (tintBackdropRef.current) {
      const blur = merged.blurAmount > 0 ? `blur(${merged.blurAmount}px)` : "none";
      tintBackdropRef.current.style.backdropFilter = blur;
      tintBackdropRef.current.style.setProperty("-webkit-backdrop-filter", blur);
    }
    lastLeftRef.current = NaN;
    applyLayout();
  }, [
    uid,
    applyLayout,
    hasExternalMap,
    displacementMapUrl,
    staticMapUrl,
    cw,
    ch,
    hasBlur,
    hasChroma,
    hasSpec,
    unityRatios,
    merged.specularDark,
    merged.specularStrength,
    merged.chromaAmount,
    merged.blurAmount,
    merged.brightness,
    tintFallback,
    merged.edgeShadow,
    merged.edgeInsetShadow,
    filterEnabled,
    multiLens,
    isIOS,
  ]);

  useLayoutEffect(() => {
    const applySpecularOpacity = (opacity: number) => {
      const strength = merged.specularStrength * opacity;
      mainSpecularRef.current?.setAttribute("k2", String(strength));
      mainDarkSpecularRef.current?.setAttribute("values", darkSpecularMatrix(strength));
    };
    applySpecularOpacity(readMotion(specularOpacity ?? 1));
    if (!isMotionValue(specularOpacity)) return;
    return specularOpacity.on("change", applySpecularOpacity);
  }, [merged.specularDark, merged.specularStrength, specularOpacity]);

  const filterActive = filterEnabled && (hasExternalMap
    ? displacementMapUrl != null && cw > 0 && ch > 0
    : (staticMapUrl != null || animated) && cw > 0 && ch > 0);
  const mapHref = hasExternalMap
    ? displacementMapUrl
    : staticMapUrl ?? (animated ? currentMapRef.current ?? undefined : undefined);

  // --- the recovered filter chain ---
  const renderLensFilter = (
    filterRef: React.Ref<SVGFilterElement>,
    feImageRef: React.RefObject<SVGFEImageElement | null> | undefined,
    matrixRef: React.RefObject<SVGFEColorMatrixElement | null> | undefined,
    isPool?: boolean,
  ) => {
    const units = isPool || isIOS ? "userSpaceOnUse" : "objectBoundingBox";
    const source = !isPool && hasBlur ? "blurred" : "SourceGraphic";
    const withMatrix = (!isPool && isIOS) || !unityRatios;
    const mapIn = withMatrix ? "scaledMap" : "map";
    return (
      <filter
        ref={filterRef}
        filterUnits={units}
        primitiveUnits={units}
        colorInterpolationFilters="sRGB"
        x={0}
        y={0}
        width={1}
        height={1}
      >
        {filterActive && (
          <Fragment>
            <feFlood floodColor="rgb(128,128,128)" floodOpacity="1" result="mapBg" />
            <feImage
              ref={feImageRef as React.Ref<SVGFEImageElement>}
              data-lens=""
              data-map-image=""
              href={mapHref}
              preserveAspectRatio="none"
              result="rawMap"
            />
            <feComposite in="rawMap" in2="mapBg" operator="over" result="map" />
            {withMatrix && (
              <feColorMatrix
                ref={matrixRef as React.Ref<SVGFEColorMatrixElement>}
                data-map-matrix=""
                in="map"
                type="matrix"
                values={matrixValues}
                result="scaledMap"
              />
            )}
            {!isPool && hasBlur && cw > 0 && ch > 0 && (
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={`${merged.blurAmount / cw} ${merged.blurAmount / ch}`}
                result="blurred"
              />
            )}
            {!isPool && hasChroma ? (
              <Fragment>
                <feDisplacementMap
                  data-lens=""
                  in={source}
                  in2={mapIn}
                  scale={maxScale * (1 + 0.2 * merged.chromaAmount)}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
                <feColorMatrix
                  type="matrix"
                  values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                  result="dispR"
                />
                <feDisplacementMap
                  data-lens=""
                  in={source}
                  in2={mapIn}
                  scale={maxScale * (1 + 0.1 * merged.chromaAmount)}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
                  result="dispG"
                />
                <feDisplacementMap
                  data-lens=""
                  in={source}
                  in2={mapIn}
                  scale={maxScale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
                  result="dispB"
                />
                <feComposite in="dispR" in2="dispG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
                <feComposite in2="dispB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lensResult" />
              </Fragment>
            ) : (
              <feDisplacementMap
                data-lens=""
                in={source}
                in2={mapIn}
                scale={maxScale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="lensResult"
              />
            )}
            {!isPool &&
              hasSpec &&
              (merged.specularDark ? (
                <Fragment>
                  <feColorMatrix
                    ref={mainDarkSpecularRef}
                    in="map"
                    type="matrix"
                    values={darkSpecularMatrix(specularGain)}
                    result="specMask"
                  />
                  <feComposite
                    in="specMask"
                    in2="lensResult"
                    operator="arithmetic"
                    k1="1"
                    k2="0"
                    k3="0"
                    k4="0"
                    result="lensResult"
                  />
                </Fragment>
              ) : (
                <Fragment>
                  <feColorMatrix
                    in={isSafari ? "rawMap" : "map"}
                    type="matrix"
                    values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 ${-128 / 255}`}
                    result="specMask"
                  />
                  <feComposite
                    ref={mainSpecularRef}
                    in="specMask"
                    in2="lensResult"
                    operator="arithmetic"
                    k1="0"
                    k2={specularGain}
                    k3="1"
                    k4="0"
                    result="lensResult"
                  />
                </Fragment>
              ))}
            <feComposite in="lensResult" in2="rawMap" operator="in" result="clippedLensResult" />
            <feComposite in="SourceGraphic" in2="rawMap" operator="out" result="holedSG" />
            <feComposite in="clippedLensResult" in2="holedSG" operator="over" />
          </Fragment>
        )}
      </filter>
    );
  };

  const renderShadowLayer = (
    ref: React.MutableRefObject<HTMLDivElement | null>,
    outer?: string,
    inset?: string,
  ) =>
    outer || inset ? (
      <div
        ref={ref}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          willChange: "transform",
          boxSizing: "border-box",
          boxShadow: [outer, inset ? `inset ${inset}` : null].filter(Boolean).join(", "),
        }}
      />
    ) : null;

  return (
    <div
      ref={containerRef}
      data-dg-glass-surface=""
      className={className}
      style={{
        contain: "layout",
        width: "100%",
        position: "relative",
        overflow: "visible",
        ...style,
        ...(scaledPlain ? { minHeight: ch } : undefined),
      }}
      {...rest}
    >
      {scaledPlain ? (
        <div
          ref={contentRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: cw * filterResolution,
            height: ch * filterResolution,
            transform: `scale(${1 / filterResolution})`,
            transformOrigin: "top left",
            willChange: filterEnabled ? "filter" : undefined,
          }}
        >
          <div
            style={{
              transform: `scale(${filterResolution})`,
              transformOrigin: "top left",
              width: cw,
              height: ch,
            }}
          >
            {children}
          </div>
        </div>
      ) : (
        <div
          ref={overlay ? undefined : contentRef}
          style={overlay ? undefined : { willChange: filterEnabled ? "filter" : undefined }}
        >
          {children}
        </div>
      )}
      {refractionTarget && scaledCopy ? (
        <div
          ref={refractCopyRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: cw * filterResolution,
            height: ch * filterResolution,
            transform: `scale(${1 / filterResolution})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            willChange: filterEnabled ? "filter, clip-path" : undefined,
            background: "var(--body-bg, var(--bg-max, #fff))",
          }}
        >
          <div
            style={{
              transform: `scale(${filterResolution})`,
              transformOrigin: "top left",
              width: cw,
              height: ch,
            }}
          >
            {refractionTarget}
          </div>
        </div>
      ) : refractionTarget ? (
        <div
          ref={refractCopyRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            willChange: filterEnabled ? "filter, clip-path" : undefined,
            background: "var(--body-bg, var(--bg-max, #fff))",
          }}
        >
          {refractionTarget}
        </div>
      ) : null}
      {overlay && scaledOverlay ? (
        <div
          ref={overlayWrapRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: cw * filterResolution,
            height: ch * filterResolution,
            transform: `scale(${1 / filterResolution})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        >
          <div ref={contentRef} style={{ willChange: filterEnabled ? "filter" : undefined, width: "100%", height: "100%" }}>
            <div
              style={{
                transform: `scale(${filterResolution})`,
                transformOrigin: "top left",
                width: cw,
                height: ch,
              }}
            >
              {overlay}
            </div>
          </div>
          {merged.brightness !== 0 && (
            <div
              ref={brightnessRef}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: merged.brightness > 0 ? "white" : "black",
                opacity: Math.abs(merged.brightness),
              }}
            />
          )}
        </div>
      ) : overlay ? (
        <div ref={overlayWrapRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div ref={contentRef} style={{ willChange: filterEnabled ? "filter" : undefined }}>
            {overlay}
          </div>
          {merged.brightness !== 0 && (
            <div
              ref={brightnessRef}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: merged.brightness > 0 ? "white" : "black",
                opacity: Math.abs(merged.brightness),
              }}
            />
          )}
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <svg
          viewBox={`0 0 ${cw} ${ch}`}
          width="100%"
          height="100%"
          style={{ maxWidth: "none", height: "100%" }}
        >
          <defs>
            {renderLensFilter(mainFilterRef, mainFeImageRef, mainMatrixRef)}
            {poolFilterRefs.current.map((ref, i) => (
              <Fragment key={i}>
                {renderLensFilter(
                  (el: SVGFilterElement | null) => {
                    ref.current = el;
                  },
                  undefined,
                  undefined,
                  true,
                )}
              </Fragment>
            ))}
            {multiLens &&
              Array.from({ length: 8 }).map((_, n) => (
                <filter
                  key={`ml-${n}`}
                  ref={(el) => {
                    multiPools.current[n].filterEl = el;
                  }}
                  id={`${uid}-ml-${n}`}
                  filterUnits={isIOS ? "userSpaceOnUse" : "objectBoundingBox"}
                  primitiveUnits={isIOS ? "userSpaceOnUse" : "objectBoundingBox"}
                  colorInterpolationFilters="sRGB"
                  x={0}
                  y={0}
                  width={isIOS ? undefined : 1}
                  height={isIOS ? undefined : 1}
                >
                  {Array.from({ length: 4 }).map((_, s) => {
                    const slotId = multiPools.current[n].subSlots[s].assignedLensId;
                    const href = slotId ? lensMaps.get(slotId) : undefined;
                    return (
                      <Fragment key={s}>
                        <feImage
                          ref={(el) => {
                            multiPools.current[n].subSlots[s].feImageEl = el;
                          }}
                          href={href ?? TRANSPARENT_PIXEL}
                          preserveAspectRatio="none"
                          result={`mlRaw-${s}`}
                        />
                        <feColorMatrix
                          ref={(el) => {
                            multiPools.current[n].subSlots[s].feColorMatrixEl = el;
                          }}
                          in={`mlRaw-${s}`}
                          type="matrix"
                          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
                          result={`mlScaled-${s}`}
                        />
                        <feImage
                          ref={(el) => {
                            multiPools.current[n].subSlots[s].feMaskEl = el;
                          }}
                          href={TRANSPARENT_PIXEL}
                          preserveAspectRatio="none"
                          result={`mlMaskRaw-${s}`}
                        />
                        <feColorMatrix
                          ref={(el) => {
                            multiPools.current[n].subSlots[s].feMaskColorMatrixEl = el;
                          }}
                          in={`mlMaskRaw-${s}`}
                          type="matrix"
                          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
                          result={`mlFlood-${s}`}
                        />
                      </Fragment>
                    );
                  })}
                  <feMerge result="mlMergedMap">
                    <feMergeNode in="mlScaled-0" />
                    <feMergeNode in="mlScaled-1" />
                    <feMergeNode in="mlScaled-2" />
                    <feMergeNode in="mlScaled-3" />
                  </feMerge>
                  <feMerge result="mlUnionMask">
                    <feMergeNode in="mlFlood-0" />
                    <feMergeNode in="mlFlood-1" />
                    <feMergeNode in="mlFlood-2" />
                    <feMergeNode in="mlFlood-3" />
                  </feMerge>
                  <feDisplacementMap
                    ref={(el) => {
                      multiPools.current[n].feDispEl = el;
                    }}
                    in="SourceGraphic"
                    in2="mlMergedMap"
                    scale={0}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="mlLensRaw"
                  />
                  <feComposite in="mlLensRaw" in2="mlUnionMask" operator="in" result="mlLensResult" />
                  <feComposite in="SourceGraphic" in2="mlUnionMask" operator="out" result="mlHoledSG" />
                  <feComposite in="mlLensResult" in2="mlHoledSG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
                </filter>
              ))}
          </defs>
          {tintFallback && (
            <rect
              ref={tintRectRef}
              fill={merged.tint > 0 ? "white" : "black"}
              opacity={Math.abs(merged.tint)}
              pointerEvents="none"
            />
          )}
        </svg>
        {merged.brightness !== 0 && !overlay && (
          <div
            ref={brightnessRef}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: merged.brightness > 0 ? "white" : "black",
              opacity: Math.abs(merged.brightness),
            }}
          />
        )}
        {tintColor !== undefined && (
          <div
            ref={tintColorRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              overflow: "hidden",
              willChange: "transform",
            }}
          />
        )}
      </div>
      <div
        ref={tintBackdropRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          willChange: "backdrop-filter, transform",
        }}
      />
      {renderShadowLayer(shadowRef, merged.edgeShadow, merged.edgeInsetShadow)}
      {renderShadowLayer(restShadowRef, merged.restEdgeShadow, merged.restEdgeInsetShadow)}
      {showOutline && (
        <div
          ref={outlineRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            border: "2px solid var(--border-2, rgba(0,0,0,0.2))",
            pointerEvents: "none",
            willChange: "transform",
            boxSizing: "border-box",
          }}
        />
      )}
    </div>
  );
}
