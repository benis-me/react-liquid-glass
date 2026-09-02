import { useEffect, useLayoutEffect, useRef } from "react";
import { createMapGenerator, type MapGenerator } from "./displacement-map";
import { isMotionValue, readMotion, type MotionInput } from "./motion";
import type { GenerationStats } from "./types";

export interface MapRegenOptions {
  /** Regenerate synchronously while motion values animate the lens geometry. */
  animated: boolean;
  containerReady: boolean;
  lensW: MotionInput;
  lensH: MotionInput;
  borderRadius: MotionInput;
  depth: MotionInput;
  mapSize: number;
  sdfBoundary: boolean;
  edgeFalloff: boolean;
  specularRotation: number;
  glowStrength: number;
  glowSpread: number;
  glowExponent: number;
  edgeStrength: number;
  edgeWidth: number;
  edgeExponent: number;
  domeDepth: number;
  splayAmount: number;
  autoBorderRadius: boolean;
  /** ms of quiet time before a final settled regeneration. */
  regenSettle?: number;
  feImageRef: React.RefObject<SVGFEImageElement | null>;
  onMapGenerated: (dataUrl: string) => void;
  onGenerationTime?: (stats: GenerationStats) => void;
}

/**
 * Drives the pooled sync generator while lens geometry is animated by motion
 * values: at most one regeneration per animation frame, direct
 * `feImage.setAttribute("href")` writes (no React), plus an optional settle
 * pass once values stop changing.
 */
export function useMapRegen(opts: MapRegenOptions): void {
  const {
    animated,
    containerReady,
    lensW,
    lensH,
    borderRadius,
    depth,
    mapSize,
    autoBorderRadius,
    regenSettle = 0,
    feImageRef,
    onMapGenerated,
    onGenerationTime,
  } = opts;

  const genRef = useRef<MapGenerator | null>(null);
  const genSizeRef = useRef(0);
  const rafRef = useRef(0);
  const settlingRef = useRef(false);
  const lastChangeRef = useRef(0);
  const deferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredUrlRef = useRef<string | null>(null);

  const cbRef = useRef(onMapGenerated);
  cbRef.current = onMapGenerated;
  const statsRef = useRef(onGenerationTime);
  statsRef.current = onGenerationTime;
  const autoRadiusRef = useRef(autoBorderRadius);
  autoRadiusRef.current = autoBorderRadius;
  const settleRef = useRef(regenSettle);
  settleRef.current = regenSettle;

  // Non-geometry surface params, readable without re-subscribing.
  const surfaceRef = useRef(opts);
  surfaceRef.current = opts;
  const wRef = useRef(lensW);
  const hRef = useRef(lensH);
  const rRef = useRef(borderRadius);
  const dRef = useRef(depth);
  wRef.current = lensW;
  hRef.current = lensH;
  rRef.current = borderRadius;
  dRef.current = depth;

  const commitMap = (url: string) => {
    feImageRef.current?.setAttribute("href", url);
    cbRef.current(url);
  };

  useLayoutEffect(() => {
    if (!animated) return;
    genRef.current?.dispose();
    genRef.current = createMapGenerator(mapSize);
    genSizeRef.current = mapSize;
    return () => {
      genRef.current?.dispose();
      genRef.current = null;
      genSizeRef.current = 0;
    };
  }, [animated, mapSize]);

  const runRef = useRef<(defer: boolean) => void>(() => {});
  runRef.current = (defer: boolean) => {
    if (!genRef.current || genSizeRef.current !== mapSize) {
      genRef.current?.dispose();
      genRef.current = createMapGenerator(mapSize);
      genSizeRef.current = mapSize;
    }
    const s = surfaceRef.current;
    const hw = readMotion(wRef.current);
    const hh = readMotion(hRef.current);
    const { dataUrl, loopMs, encodeMs } = genRef.current.generate({
      lensHalfWidth: hw,
      lensHalfHeight: hh,
      borderRadius: autoRadiusRef.current ? Math.min(hw, hh) : readMotion(rRef.current),
      depth: readMotion(dRef.current),
      sdfBoundary: s.sdfBoundary,
      edgeFalloff: s.edgeFalloff,
      specularRotation: s.specularRotation,
      glowStrength: s.glowStrength,
      glowSpread: s.glowSpread,
      glowExponent: s.glowExponent,
      edgeStrength: s.edgeStrength,
      edgeWidth: s.edgeWidth,
      edgeExponent: s.edgeExponent,
      domeDepth: s.domeDepth,
      splayAmount: s.splayAmount,
    });
    statsRef.current?.({ total: loopMs + encodeMs, loopMs, encodeMs });
    if (defer) {
      // Batch the DOM write onto a macrotask so a burst of settle regens
      // collapses into one attribute update.
      deferredUrlRef.current = dataUrl;
      if (deferTimerRef.current === null) {
        deferTimerRef.current = setTimeout(() => {
          deferTimerRef.current = null;
          const url = deferredUrlRef.current;
          deferredUrlRef.current = null;
          if (url) commitMap(url);
        }, 0);
      }
    } else {
      if (deferTimerRef.current !== null) {
        clearTimeout(deferTimerRef.current);
        deferTimerRef.current = null;
        deferredUrlRef.current = null;
      }
      commitMap(dataUrl);
    }
  };

  useLayoutEffect(() => {
    if (animated && containerReady) runRef.current(false);
  }, [animated, containerReady, mapSize]);

  useEffect(() => {
    if (!animated) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const idle = performance.now() - lastChangeRef.current;
      if (settlingRef.current && idle >= settleRef.current) {
        settlingRef.current = false;
        runRef.current(true);
      }
      if (idle < 150) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = 0;
    };
    const onChange = () => {
      if (!settlingRef.current) {
        settlingRef.current = true;
        lastChangeRef.current = performance.now();
      }
      if (rafRef.current === 0) {
        settlingRef.current = false;
        runRef.current(false);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    const unsubs: Array<() => void> = [];
    for (const v of [lensW, lensH, borderRadius, depth]) {
      if (isMotionValue(v)) unsubs.push(v.on("change", onChange));
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      if (deferTimerRef.current !== null) {
        clearTimeout(deferTimerRef.current);
        deferTimerRef.current = null;
      }
      deferredUrlRef.current = null;
      unsubs.forEach((u) => u());
    };
  }, [animated, lensW, lensH, borderRadius, depth]);

  // Surface changes can arrive much faster than paint while a native range
  // input is dragged. Coalesce them so the 512² map is rebuilt at most once
  // per frame, using the latest values already held in surfaceRef.
  const surfaceRafRef = useRef(0);
  const firstSurfaceRun = useRef(true);
  const surfaceDeps = [
    opts.lensW,
    opts.lensH,
    opts.borderRadius,
    opts.depth,
    opts.sdfBoundary,
    opts.edgeFalloff,
    opts.specularRotation,
    opts.glowStrength,
    opts.glowSpread,
    opts.glowExponent,
    opts.edgeStrength,
    opts.edgeWidth,
    opts.edgeExponent,
    opts.domeDepth,
    opts.splayAmount,
  ];
  useEffect(() => {
    if (!animated) return;
    if (firstSurfaceRun.current) {
      firstSurfaceRun.current = false;
      return;
    }
    if (surfaceRafRef.current === 0) {
      surfaceRafRef.current = requestAnimationFrame(() => {
        surfaceRafRef.current = 0;
        runRef.current(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, ...surfaceDeps]);
  useEffect(
    () => () => {
      if (surfaceRafRef.current) cancelAnimationFrame(surfaceRafRef.current);
    },
    [],
  );
}
