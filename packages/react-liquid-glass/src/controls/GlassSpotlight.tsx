import { useReducedMotion } from "motion/react";
import { tween } from "../apple-motion";
import { stepSpring } from "../apple-motion/spring";
import { SPOTLIGHT_DRIFT_SPEED, SPOTLIGHT_FOLLOW_SPRING, SPOTLIGHT_IDLE_MS } from "../apple-motion/presets";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motionValue } from "../shared/values";
import type { LiquidLens } from "../liquid-glass/lens";
import { LiquidGlass } from "../liquid-glass/LiquidGlass";

export interface GlassSpotlightProps {
  variant?: "primary" | "secondary";
  interactive?: boolean;
  backgroundImage?: string;
  /** Responsive candidates for the background image, as for `<img srcset>`. */
  backgroundSrcSet?: string;
  backgroundSizes?: string;
  lens?: LiquidLens;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

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

export function GlassSpotlight({
  variant = "primary",
  interactive = true,
  backgroundImage,
  backgroundSrcSet,
  backgroundSizes,
  lens: lensOverrides,
}: GlassSpotlightProps) {
  // A missing or blocked image falls back to the plain frame instead of a broken image.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [backgroundImage, backgroundSrcSet]);
  const scale = useMobileScale();
  const reduce = useReducedMotion();
  // Only calibrated values are passed on; LiquidGlass fills the shared defaults.
  const sourceLens = { lensW: 80, lensH: 80, borderRadius: 80, tint: 0, ...lensOverrides };
  const targetW = sourceLens.lensW * scale;
  const targetH = sourceLens.lensH * scale;
  const targetRadius = sourceLens.borderRadius * scale;
  const x = useRef(motionValue(0.5)).current;
  const y = useRef(motionValue(0.5)).current;
  // Lens velocity in CSS pixels per second, for the shader's squash and stretch.
  const velocityX = useRef(motionValue(0)).current;
  const velocityY = useRef(motionValue(0)).current;
  const velocity = useRef({ x: 0, y: 0 });
  const heading = useRef(Math.PI / 4);
  const lastActivity = useRef(0);
  const lensW = useRef(motionValue(targetW)).current;
  const lensH = useRef(motionValue(targetH)).current;
  const radius = useRef(motionValue(targetRadius)).current;
  const rootRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const hoverTarget = useRef({ x: 0.5, y: 0.5 });
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
      tween(lensW, targetW, reduce ? 0 : 300),
      tween(lensH, targetH, reduce ? 0 : 300),
      tween(radius, targetRadius, reduce ? 0 : 300),
    );
  }, [targetW, targetH, targetRadius, lensW, lensH, radius, reduce]);

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
    if (!interactive || reduce) {
      x.set(0.5);
      y.set(0.5);
      velocityX.set(0);
      velocityY.set(0);
      return;
    }
    let previous = 0, wander = Math.random() * 10, drift = 1;
    lastActivity.current = performance.now();
    const update = (now: number) => {
      driftFrame.current = 0;
      if (!visible.current || document.hidden) return;
      if (previous === 0) { previous = now; driftFrame.current = requestAnimationFrame(update); return; }
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const rect = viewport.current;
      if (!rect?.width || !rect.height) { driftFrame.current = requestAnimationFrame(update); return; }
      const marginX = (lensW.get() + 2) / rect.width;
      const marginY = (lensH.get() + 2) / rect.height;
      const v = velocity.current;
      let nextX: number, nextY: number, running: boolean;
      if (hovering.current) {
        // The lens is a damped mass pulled toward the pointer; it keeps its momentum.
        const targetX = clamp(hoverTarget.current.x, marginX, 1 - marginX);
        const targetY = clamp(hoverTarget.current.y, marginY, 1 - marginY);
        [nextX, v.x] = stepSpring(x.get(), v.x, targetX, SPOTLIGHT_FOLLOW_SPRING, dt);
        [nextY, v.y] = stepSpring(y.get(), v.y, targetY, SPOTLIGHT_FOLLOW_SPRING, dt);
        // At rest under a still pointer, stop drawing until the pointer moves again.
        running = nextX !== targetX || nextY !== targetY || v.x !== 0 || v.y !== 0;
      } else {
        // Ambient drift meanders smoothly and turns away from the edges instead of
        // reversing instantly; it eases to rest while the page is idle.
        const idle = now - lastActivity.current > SPOTLIGHT_IDLE_MS;
        drift = clamp(drift + (idle ? -dt / 1.2 : dt / 0.8), 0, 1);
        wander += dt;
        let angle = heading.current + (0.45 * Math.sin(wander * 0.53) + 0.25 * Math.sin(wander * 1.37 + 1.7)) * dt;
        const px = x.get() * rect.width, py = y.get() * rect.height;
        const mx = marginX * rect.width, my = marginY * rect.height, band = Math.min(rect.width, rect.height) * 0.2;
        const push = (distance: number) => clamp(1 - distance / band, 0, 1);
        const steerX = push(px - mx) - push(rect.width - mx - px), steerY = push(py - my) - push(rect.height - my - py);
        if (steerX || steerY) {
          const inward = Math.atan2(steerY, steerX);
          angle += Math.atan2(Math.sin(inward - angle), Math.cos(inward - angle)) * Math.min(1, dt * 5 * Math.hypot(steerX, steerY));
        }
        heading.current = angle;
        const speed = SPOTLIGHT_DRIFT_SPEED * drift;
        // Hand the hover momentum over to the drift gradually.
        const blend = 1 - Math.exp(-4 * dt);
        v.x += (Math.cos(angle) * speed / rect.width - v.x) * blend;
        v.y += (Math.sin(angle) * speed / rect.height - v.y) * blend;
        nextX = clamp(x.get() + v.x * dt, marginX, 1 - marginX);
        nextY = clamp(y.get() + v.y * dt, marginY, 1 - marginY);
        running = drift > 0 || Math.hypot(v.x * rect.width, v.y * rect.height) > 0.5;
        if (!running) v.x = v.y = 0;
      }
      x.set(nextX);
      y.set(nextY);
      velocityX.set(v.x * rect.width);
      velocityY.set(v.y * rect.height);
      if (running) driftFrame.current = requestAnimationFrame(update);
    };
    wakeDrift.current = () => {
      if (!driftFrame.current && visible.current && !document.hidden) {
        previous = 0;
        driftFrame.current = requestAnimationFrame(update);
      }
    };
    const activity = () => {
      lastActivity.current = performance.now();
      wakeDrift.current();
    };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(driftFrame.current); driftFrame.current = 0; }
      else activity();
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;
    for (const type of events) window.addEventListener(type, activity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", visibility);
    wakeDrift.current();
    return () => {
      cancelAnimationFrame(driftFrame.current);
      driftFrame.current = 0;
      for (const type of events) window.removeEventListener(type, activity, { capture: true });
      document.removeEventListener("visibilitychange", visibility);
      wakeDrift.current = () => undefined;
    };
  }, [interactive, reduce, x, y, lensW, lensH, velocityX, velocityY]);

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
    if (reduce) { x.set(hoverTarget.current.x); y.set(hoverTarget.current.y); }
    else wakeDrift.current();
  }, [interactive, reduce, x, y, lensW, lensH]);

  const lens: LiquidLens = {
    ...sourceLens,
    lensW: targetW,
    lensH: targetH,
    borderRadius: targetRadius,
    ...(sourceLens.domeDepth === undefined ? {} : { domeDepth: (sourceLens.domeDepth / Math.max(1, sourceLens.lensW)) * Math.min(targetW, targetH) }),
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
          tween(radius, 103 * scale, reduce ? 0 : 300),
          tween(lensW, 95 * scale, reduce ? 0 : 300),
          tween(lensH, 95 * scale, reduce ? 0 : 300),
        );
      } : undefined}
      onPointerMove={interactive ? move : undefined}
      onPointerLeave={interactive ? () => {
        if (restoreTimer.current !== null) clearTimeout(restoreTimer.current);
        restoreTimer.current = window.setTimeout(() => {
          hovering.current = false;
          wakeDrift.current();
          stopTweens();
          animationStops.current.push(
            tween(radius, targetRadius, reduce ? 0 : 300),
            tween(lensW, targetW, reduce ? 0 : 300),
            tween(lensH, targetH, reduce ? 0 : 300),
          );
        }, 400);
      } : undefined}
    >
      <LiquidGlass
        lens={lens}
        lensW={lensW}
        lensH={lensH}
        borderRadius={radius}
        x={x}
        y={y}
        velocity={{ x: velocityX, y: velocityY }}
      >
        <div className="dg-hero__content">
          <div className="dg-hero__background-frame">
            {backgroundImage && !imageFailed ? (
              <img
                className="dg-hero__background"
                src={backgroundImage}
                srcSet={backgroundSrcSet}
                sizes={backgroundSizes}
                crossOrigin="anonymous"
                alt=""
                fetchPriority="high"
                decoding="async"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="dg-hero__background" />
            )}
          </div>
        </div>
      </LiquidGlass>
    </div>
  );
}
