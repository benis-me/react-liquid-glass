import { tween } from "./lib/apple-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PLAYGROUND_DEFAULTS } from "./lib/presets";
import { motionValue } from "./lib/shared/values";
import type { LensParams } from "./lib/types";
import { LiquidGlass as Glass, LIQUID_LENS } from "./lib/liquid-glass/LiquidGlass";

interface HeroGlassDemoProps {
  variant?: "primary" | "secondary";
  interactive?: boolean;
  backgroundImage?: string;
  lens?: Partial<LensParams>;
}

function useMobileScale() {
  const [mobile, setMobile] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const query = matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile ? 2 / 3 : 1;
}

export function HeroGlassDemo({
  variant = "primary",
  interactive = true,
  backgroundImage,
  lens: lensOverrides,
}: HeroGlassDemoProps) {
  const scale = useMobileScale();
  const sourceLens = { ...PLAYGROUND_DEFAULTS, ...LIQUID_LENS, ...lensOverrides };
  const targetW = sourceLens.lensW * scale;
  const targetH = sourceLens.lensH * scale;
  const targetRadius = sourceLens.borderRadius * scale;
  const x = useRef(motionValue(0.5)).current;
  const y = useRef(motionValue(0.5)).current;
  const lensW = useRef(motionValue(targetW)).current;
  const lensH = useRef(motionValue(targetH)).current;
  const radius = useRef(motionValue(targetRadius)).current;
  const rootRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const hoverTarget = useRef({ x: 0.5, y: 0.5 });
  const direction = useRef({ x: 1, y: 1 });
  const restoreTimer = useRef<number | null>(null);
  const animationStops = useRef<Array<() => void>>([]);
  const visible = useRef(true);
  const driftFrame = useRef(0);
  const wakeDrift = useRef<() => void>(() => undefined);
  const viewport = useRef({ width: 0, height: 0 });

  const stopTweens = () => {
    animationStops.current.forEach((stop) => stop());
    animationStops.current = [];
  };

  useEffect(() => {
    if (hovering.current) return;
    stopTweens();
    animationStops.current.push(
      tween(lensW, targetW, 300),
      tween(lensH, targetH, 300),
      tween(radius, targetRadius, 300),
    );
  }, [targetW, targetH, targetRadius, lensW, lensH, radius]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (visible.current) wakeDrift.current();
      else { cancelAnimationFrame(driftFrame.current); driftFrame.current = 0; }
    }, { rootMargin: "80px 0px" });
    observer.observe(root);
    const measure = () => { viewport.current = { width: root.clientWidth, height: root.clientHeight }; };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    return () => { observer.disconnect(); resize.disconnect(); };
  }, []);

  useEffect(() => {
    if (!interactive) {
      x.set(0.5);
      y.set(0.5);
      return;
    }
    let previous = 0;
    const update = (now: number) => {
      driftFrame.current = 0;
      if (!visible.current || document.hidden) return;
      driftFrame.current = requestAnimationFrame(update);
      if (previous === 0) { previous = now; return; }
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const rect = viewport.current;
      if (!rect?.width || !rect.height) return;
      const marginX = (lensW.get() + 2) / rect.width;
      const marginY = (lensH.get() + 2) / rect.height;
      if (hovering.current) {
        const follow = 1 - Math.exp(-12 * dt);
        const nextX = Math.max(marginX, Math.min(1 - marginX, hoverTarget.current.x));
        const nextY = Math.max(marginY, Math.min(1 - marginY, hoverTarget.current.y));
        x.set(x.get() + (nextX - x.get()) * follow);
        y.set(y.get() + (nextY - y.get()) * follow);
        return;
      }
      let nextX = x.get() + (90 / rect.width) * direction.current.x * dt;
      let nextY = y.get() + (90 / rect.height) * direction.current.y * dt;
      if (nextX <= marginX) { nextX = marginX; direction.current.x = 1; }
      else if (nextX >= 1 - marginX) { nextX = 1 - marginX; direction.current.x = -1; }
      if (nextY <= marginY) { nextY = marginY; direction.current.y = 1; }
      else if (nextY >= 1 - marginY) { nextY = 1 - marginY; direction.current.y = -1; }
      x.set(nextX);
      y.set(nextY);
    };
    wakeDrift.current = () => {
      if (!driftFrame.current && visible.current && !document.hidden) {
        previous = 0;
        driftFrame.current = requestAnimationFrame(update);
      }
    };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(driftFrame.current); driftFrame.current = 0; }
      else wakeDrift.current();
    };
    document.addEventListener("visibilitychange", visibility);
    wakeDrift.current();
    return () => {
      cancelAnimationFrame(driftFrame.current);
      document.removeEventListener("visibilitychange", visibility);
      wakeDrift.current = () => undefined;
    };
  }, [interactive, x, y, lensW, lensH]);

  useEffect(() => () => {
    stopTweens();
    if (restoreTimer.current !== null) clearTimeout(restoreTimer.current);
  }, []);

  const move = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const marginX = (lensW.get() + 2) / rect.width;
    const marginY = (lensH.get() + 2) / rect.height;
    hoverTarget.current = {
      x: Math.max(marginX, Math.min(1 - marginX, (event.clientX - rect.left) / rect.width)),
      y: Math.max(marginY, Math.min(1 - marginY, (event.clientY - rect.top) / rect.height)),
    };
  }, [interactive, lensW, lensH]);

  const lens: Partial<LensParams> = {
    ...sourceLens,
    lensW: targetW,
    lensH: targetH,
    borderRadius: targetRadius,
    domeDepth: (sourceLens.domeDepth / Math.max(1, sourceLens.lensW)) * Math.min(targetW, targetH),
  };

  return (
    <div
      ref={rootRef}
      className="dg-hero"
      data-variant={variant}
      onPointerEnter={interactive ? () => {
        if (restoreTimer.current !== null) clearTimeout(restoreTimer.current);
        hovering.current = true;
        hoverTarget.current = { x: x.get(), y: y.get() };
        stopTweens();
        animationStops.current.push(
          tween(radius, 103 * scale),
          tween(lensW, 95 * scale),
          tween(lensH, 95 * scale),
        );
      } : undefined}
      onPointerMove={interactive ? move : undefined}
      onPointerLeave={interactive ? () => {
        if (restoreTimer.current !== null) clearTimeout(restoreTimer.current);
        restoreTimer.current = window.setTimeout(() => {
          hovering.current = false;
          stopTweens();
          animationStops.current.push(
            tween(radius, targetRadius),
            tween(lensW, targetW),
            tween(lensH, targetH),
          );
        }, 400);
      } : undefined}
    >
      <Glass
        lens={lens}
        lensW={lensW}
        lensH={lensH}
        borderRadius={radius}
        x={x}
        y={y}
      >
        <div className="dg-hero__content">
          <div className="dg-hero__background-frame">
            {backgroundImage ? (
              <img
                className="dg-hero__background"
                src={backgroundImage}
                crossOrigin="anonymous"
                alt=""
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              <div className="dg-hero__background" />
            )}
          </div>
        </div>
      </Glass>
    </div>
  );
}
