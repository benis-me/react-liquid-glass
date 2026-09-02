import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  GLASS_SELECTOR,
  GlassContext,
  RefractionGroupContext,
  type GlassContextValue,
  type SharedLens,
  type TargetRect,
} from "./context";

/**
 * Provider — hosts a shared lens (one lens roaming over several Glass
 * containers) and the registry of RefractionTarget rects.
 */
export function GlassProvider({ children }: { children?: ReactNode }) {
  const activeLens = useRef<SharedLens | null>(null);
  const version = useRef(0);
  const targets = useRef(new Map<HTMLElement, TargetRect>());
  const targetVersion = useRef(0);
  const bleedRef = useRef(0);

  const register = useCallback((lens: SharedLens) => {
    activeLens.current = lens;
    version.current++;
  }, []);
  const deregister = useCallback(() => {
    activeLens.current = null;
    version.current++;
  }, []);
  const upsertTarget = useCallback((el: HTMLElement, rect: TargetRect) => {
    targets.current.set(el, rect);
    targetVersion.current++;
  }, []);
  const deregisterTarget = useCallback((el: HTMLElement) => {
    targets.current.delete(el);
    targetVersion.current++;
  }, []);

  const value = useMemo<GlassContextValue>(
    () => ({
      register,
      deregister,
      activeLens,
      version,
      upsertTarget,
      deregisterTarget,
      targets,
      targetVersion,
      bleedRef,
    }),
    [register, deregister, upsertTarget, deregisterTarget],
  );
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

/** Register a shared lens with the nearest GlassProvider for its lifetime. */
export function useSharedLens(lens: SharedLens): void {
  const ctx = useContext(GlassContext);
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.register(lens);
    return () => ctx.deregister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, ...Object.values(lens)]);
}

/**
 * RefractionTarget — marks a subtree as an individually-filtered refraction
 * target. The pooled per-element filters attach only to these, so a lens can
 * roam over a full page while the filter only ever runs on small rects.
 */
export function RefractionTarget({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const ctx = useContext(GlassContext);
  const { inGroup, gap } = useContext(RefractionGroupContext);
  const padRef = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ctx) return;
    const nested = (() => {
      if (inGroup) return true;
      let p = el.parentElement;
      while (p) {
        if (p.dataset.refractionTarget !== undefined) return true;
        p = p.parentElement;
      }
      return false;
    })();
    // Nested targets inside a gapped group carry half the gap as bleed so
    // displaced pixels can cross the gap without clipping.
    const groupPad = nested && gap > 0 ? gap / 2 : 0;
    if (groupPad > 0) {
      el.style.padding = `${groupPad}px`;
      el.style.margin = `${-groupPad}px`;
      el.style.boxSizing = "content-box";
      padRef.current = groupPad;
    }
    const container = el.closest<HTMLElement>(GLASS_SELECTOR.container);
    const measure = (): TargetRect => {
      const cr = container?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const r = el.getBoundingClientRect();
      const pad = padRef.current;
      return {
        el,
        left: r.left - cr.left + pad,
        top: r.top - cr.top + pad,
        width: r.width - 2 * pad,
        height: r.height - 2 * pad,
        nested,
      };
    };
    // Top-level targets follow the provider's live bleed value.
    const syncBleed = (): boolean => {
      if (nested) return false;
      const bleed = ctx.bleedRef.current;
      if (bleed === padRef.current) return false;
      padRef.current = bleed;
      el.style.padding = `${bleed}px`;
      el.style.margin = `${-bleed}px`;
      el.style.boxSizing = "content-box";
      ctx.upsertTarget(el, measure());
      return true;
    };
    if (!syncBleed()) ctx.upsertTarget(el, measure());
    const ro = new ResizeObserver(() => {
      if (!syncBleed()) ctx.upsertTarget(el, measure());
    });
    ro.observe(el);
    const io = new IntersectionObserver(
      () => {
        if (!syncBleed()) ctx.upsertTarget(el, measure());
      },
      { root: container, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
      if (!nested || padRef.current > 0) {
        el.style.padding = "";
        el.style.margin = "";
        el.style.boxSizing = "";
      }
      ctx.deregisterTarget(el);
    };
  }, [ctx, inGroup, gap]);

  return (
    <div ref={ref} className={className} data-refraction-target="" style={style}>
      {children}
    </div>
  );
}

/** Flex wrapper whose children are nested RefractionTargets sharing a gap. */
export function RefractionGroup({
  children,
  flexDirection = "column",
  gap = 0,
  className,
  style,
  ...rest
}: {
  children?: ReactNode;
  flexDirection?: CSSProperties["flexDirection"];
  gap?: number;
  className?: string;
  style?: CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className" | "style">) {
  const value = useMemo(() => ({ inGroup: true, gap }), [gap]);
  return (
    <RefractionGroupContext.Provider value={value}>
      <div
        {...rest}
        className={className}
        style={{ display: "flex", flexDirection, ...(gap !== 0 ? { gap } : {}), ...style }}
      >
        {children}
      </div>
    </RefractionGroupContext.Provider>
  );
}

/** Access the nearest GlassProvider context (null when absent). */
export function useGlassContext() {
  return useContext(GlassContext);
}
