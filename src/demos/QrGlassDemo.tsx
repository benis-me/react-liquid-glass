import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ScanQrCode } from "lucide-react";
import type { Locale } from "../i18n";
import { buildQrGeometry, QR_SIZE } from "./qr-geometry";
import { createLiquidGlassRenderer, type LiquidGlassBlob } from "../lib/liquid-glass-renderer";
import { QrPaintTexture } from "./qr-paint";
import { QrWebglRenderer } from "./qr-renderer";

const WAVE_DURATION = 6_000;
const MAX_HALF_SIZE = 162 * 2.2;
const COLORS: Array<[number, number, number]> = [
  [0.596078, 0.588235, 1],
  [0.223529, 0.819608, 0.976471],
  [1, 0.705882, 0],
  [1, 0.196078, 0],
];

function cubicBezier(progress: number) {
  const x1 = 0.22;
  const y1 = 1;
  const x2 = 0.36;
  const y2 = 1;
  let t = progress;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const one = 1 - t;
    const x = 3 * one * one * t * x1 + 3 * one * t * t * x2 + t ** 3;
    const derivative = 3 * one * one * x1 + 6 * one * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(derivative) < 1e-6) break;
    t = Math.max(0, Math.min(1, t - (x - progress) / derivative));
  }
  const one = 1 - t;
  return 3 * one * one * t * y1 + 3 * one * t * t * y2 + t ** 3;
}

function resolveColor(element: HTMLElement, color: string) {
  const previous = element.style.color;
  element.style.color = color;
  const resolved = getComputedStyle(element).color;
  element.style.color = previous;
  return resolved;
}

const copy = {
  zh: { canvas: "交互式玻璃二维码", trigger: "触发二维码折射" },
  en: { canvas: "Interactive glass QR code", trigger: "Trigger QR refraction" },
} as const;

export function QrGlassDemo({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const geometry = useMemo(buildQrGeometry, []);
  const stageRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const liquidCanvasRef = useRef<HTMLCanvasElement>(null);
  const triggerRef = useRef<() => void>(() => undefined);
  const pointerMoveRef = useRef<(event: ReactPointerEvent<HTMLDivElement>) => void>(() => undefined);
  const pointerLeaveRef = useRef<() => void>(() => undefined);
  const frameRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const qr = qrRef.current;
    const colorCanvas = colorCanvasRef.current;
    const glCanvas = glCanvasRef.current;
    const liquidCanvas = liquidCanvasRef.current;
    if (!stage || !qr || !colorCanvas || !glCanvas || !liquidCanvas) return;

    let renderer: QrWebglRenderer;
    let colorPaint: QrPaintTexture;
    let scalePaint: QrPaintTexture;
    let liquid: ReturnType<typeof createLiquidGlassRenderer>;
    let sourceRevision = 0;
    try {
      const foreground = resolveColor(glCanvas, "var(--fg-1)");
      const background = resolveColor(glCanvas, "var(--bg-max)");
      colorPaint = new QrPaintTexture({
        canvas: colorCanvas,
        size: QR_SIZE / 22.2,
        maxAge: 240,
        radius: QR_SIZE / 333,
        intensity: 0.8,
        useColor: true,
        clearColor: foreground,
        splashSpeed: 10,
        ringStart: document.documentElement.dataset.theme === "dark" ? 0.15 : 0.45,
        ringEnd: 0.9,
      });
      scalePaint = new QrPaintTexture({
        size: QR_SIZE / 22.2,
        maxAge: 48,
        radius: QR_SIZE / 426,
        intensity: 0.4,
        clearColor: "#000000",
        splashSpeed: 10,
        ringStart: document.documentElement.dataset.theme === "dark" ? 0.15 : 0.45,
        ringEnd: 0.9,
      });
      renderer = new QrWebglRenderer({
        canvas: glCanvas,
        size: QR_SIZE,
        eyes: geometry.eyes,
        occupancy: geometry.occupancy,
        matrixLength: geometry.matrixLength,
        gridOriginUv: geometry.gridOriginUv,
        cellUv: geometry.cellUv,
        dotRadius: geometry.dotRadius,
        dotColor: "var(--fg-1)",
        backgroundColor: "var(--bg-max)",
      });
      liquid = createLiquidGlassRenderer(liquidCanvas, { shared: true });
      liquidCanvas.dataset.dgRenderer = "liquid-webgl2";
      renderer.updatePaintingTexture(scalePaint.canvas);
      renderer.updatePaintingColorTexture(colorPaint.canvas);
      renderer.draw();
      liquid.draw({ source: glCanvas, sourceRevision: ++sourceRevision, width: QR_SIZE, height: QR_SIZE, blobs: [], pixelRatio: 1.5 });
      setReady(true);
    } catch (error) {
      console.error(error);
      return;
    }

    const waves: Array<{ slot: number; started: number }> = [];
    let nextSlot = 0;
    let lastFrame = performance.now();
    let lastPointer = -Infinity;
    let hoverGroup = -1;
    let clickColor: [number, number, number] | null = null;
    let colorIndex = 0;
    let colorTimer: number | null = null;
    let lastClick = 0;
    const pulseTimers: number[] = [];
    let visible = true;
    const eye = {
      currentScale: [1, 1, 1],
      targetScale: [1, 1, 1],
      currentColor: [
        renderer.resolveCssColor("var(--fg-1)"),
        renderer.resolveCssColor("var(--fg-1)"),
        renderer.resolveCssColor("var(--fg-1)"),
      ] as Array<[number, number, number]>,
      defaultColor: renderer.resolveCssColor("var(--fg-1)"),
    };

    const inView = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) ensureLoop();
    }, { rootMargin: "300px 0px" });
    inView.observe(stage);

    const updateTheme = () => {
      const foreground = resolveColor(glCanvas, "var(--fg-1)");
      colorPaint.updateClearColor(foreground);
      const ringStart = document.documentElement.dataset.theme === "dark" ? 0.15 : 0.45;
      colorPaint.updateRings(ringStart, 0.9);
      scalePaint.updateRings(ringStart, 0.9);
      renderer.updateBackgroundColor("var(--bg-max)");
      eye.defaultColor = renderer.resolveCssColor("var(--fg-1)");
      ensureLoop();
    };
    const themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const eyeBounds = geometry.eyes.filter((_, index) => index % 3 === 0).map((rect) => [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]);
    const setHoverGroup = (group: number) => {
      hoverGroup = group;
      for (let index = 0; index < 3; index += 1) eye.targetScale[index] = index === group ? 0.92 : 1;
      ensureLoop();
    };

    function render(now: number) {
      frameRef.current = 0;
      if (!visible) return;
      const delta = Math.min(((now - lastFrame) / 1_000) * 100, 2);
      lastFrame = now;
      for (let index = waves.length - 1; index >= 0; index -= 1) {
        if (now - waves[index].started >= WAVE_DURATION) waves.splice(index, 1);
      }
      const activeWaves = waves.map((wave) => {
        const progress = Math.min(1, (now - wave.started) / WAVE_DURATION);
        return { slot: wave.slot, radius: 4 + (MAX_HALF_SIZE - 4) * cubicBezier(progress) };
      });
      const blobs: LiquidGlassBlob[] = activeWaves.map(wave => ({
        x: .5, y: .5, radius: wave.radius, halfWidth: wave.radius, halfHeight: wave.radius,
      }));

      const painting = now - lastPointer < 1_000;
      colorPaint.update(delta, painting);
      scalePaint.update(delta, painting);
      renderer.updatePaintingColorTexture(colorPaint.canvas);
      renderer.updatePaintingTexture(scalePaint.canvas);

      let eyeMoving = false;
      for (let group = 0; group < 3; group += 1) {
        const scaleDelta = eye.targetScale[group] - eye.currentScale[group];
        if (Math.abs(scaleDelta) > 0.001) {
          eye.currentScale[group] += scaleDelta * 0.18;
          eyeMoving = true;
        } else eye.currentScale[group] = eye.targetScale[group];
        renderer.updateEyeScale(group, eye.currentScale[group]);
        const target = hoverGroup === group ? COLORS[(colorIndex + 1) % COLORS.length] : clickColor ?? eye.defaultColor;
        for (let channel = 0; channel < 3; channel += 1) {
          const colorDelta = target[channel] - eye.currentColor[group][channel];
          if (Math.abs(colorDelta) > 0.002) {
            eye.currentColor[group][channel] += colorDelta * 0.18;
            eyeMoving = true;
          } else eye.currentColor[group][channel] = target[channel];
        }
        renderer.updateEyeColor(group, eye.currentColor[group]);
      }
      renderer.draw();
      liquid.draw({
        source: renderer.canvas, sourceRevision: ++sourceRevision,
        width: QR_SIZE, height: QR_SIZE, blobs, pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        mergeDistance: 28, edgeDepth: 12, domeDepth: 58,
        tintStrength: .025, blurStrength: .5, shadowStrength: .06,
      });
      if (waves.length > 0 || painting || colorPaint.active || scalePaint.active || eyeMoving) ensureLoop();
    }

    function ensureLoop() {
      if (!frameRef.current && visible) {
        lastFrame = performance.now();
        frameRef.current = requestAnimationFrame(render);
      }
    }

    triggerRef.current = () => {
      const clickedAt = performance.now();
      const rapid = clickedAt - lastClick < 2_000;
      lastClick = clickedAt;
      nextSlot = (nextSlot + 1) % 5;
      const existing = waves.findIndex((wave) => wave.slot === nextSlot);
      if (existing >= 0) waves.splice(existing, 1);
      waves.push({ slot: nextSlot, started: performance.now() });
      colorPaint.click();
      scalePaint.click();
      clickColor = COLORS[colorIndex];
      colorIndex = (colorIndex + 1) % COLORS.length;
      setSpin((value) => value + 1);
      if (!rapid) {
        pulseTimers.push(window.setTimeout(() => {
          eye.targetScale.fill(0.9);
          ensureLoop();
        }, 300));
        pulseTimers.push(window.setTimeout(() => {
          eye.targetScale.fill(1);
          ensureLoop();
        }, 450));
      }
      if (colorTimer !== null) clearTimeout(colorTimer);
      colorTimer = window.setTimeout(() => {
        clickColor = null;
        ensureLoop();
      }, 2_000);
      ensureLoop();
    };

    pointerMoveRef.current = (event) => {
      if (event.pointerType === "touch") return;
      const stageRect = stage.getBoundingClientRect();
      const tiltX = (event.clientX - stageRect.left) / stageRect.width - 0.5;
      const tiltY = (event.clientY - stageRect.top) / stageRect.height - 0.5;
      stage.style.transform = `rotateX(${-12 * tiltY}deg) rotateY(${12 * tiltX}deg)`;
      const rect = qr.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * QR_SIZE;
      const y = ((event.clientY - rect.top) / rect.height) * QR_SIZE;
      colorPaint.updateMouse({ x: x / QR_SIZE, y: 1 - y / QR_SIZE });
      scalePaint.updateMouse({ x: x / QR_SIZE, y: 1 - y / QR_SIZE });
      lastPointer = performance.now();
      let group = -1;
      for (let index = 0; index < eyeBounds.length; index += 1) {
        const bounds = eyeBounds[index];
        if (x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]) group = index;
      }
      if (group !== hoverGroup) setHoverGroup(group);
      ensureLoop();
    };

    pointerLeaveRef.current = () => {
      stage.style.transform = "rotateX(0deg) rotateY(0deg)";
      lastPointer = -Infinity;
      setHoverGroup(-1);
    };

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (colorTimer !== null) clearTimeout(colorTimer);
      pulseTimers.forEach((timer) => clearTimeout(timer));
      triggerRef.current = () => undefined;
      pointerMoveRef.current = () => undefined;
      pointerLeaveRef.current = () => undefined;
      inView.disconnect();
      themeObserver.disconnect();
      renderer.dispose();
      colorPaint.dispose();
      scalePaint.dispose();
      liquid.dispose();
    };
  }, [geometry]);

  return (
    <div className="dg-qr-tilt" onPointerMove={(event) => pointerMoveRef.current(event)} onPointerLeave={() => pointerLeaveRef.current()}>
      <div ref={stageRef} className="dg-qr-stage">
        <div ref={qrRef} className="dg-qr" style={{ opacity: ready ? 1 : 0 }}>
          <div className="dg-qr__wrapper">
            <canvas ref={colorCanvasRef} className="dg-qr__canvas dg-qr__fallback" aria-hidden="true" />
            <canvas ref={glCanvasRef} className="dg-qr__canvas" style={{ visibility: "hidden" }} aria-hidden="true" />
            <canvas ref={liquidCanvasRef} className="dg-qr__canvas dg-qr__webgl" aria-label={text.canvas} role="img" />
            <button type="button" className="dg-qr__icon-button" aria-label={text.trigger} onClick={() => triggerRef.current()}>
              <span className="dg-qr__icon-content">
                <span key={spin} className="dg-qr__icon-rotator">
                  <span className="dg-qr__icon-face dg-qr__icon-face--front"><span className="dg-qr__neutral-face"><ScanQrCode aria-hidden="true" /></span></span>
                  <span className="dg-qr__icon-face dg-qr__icon-face--back"><span className="dg-qr__neutral-face"><ScanQrCode aria-hidden="true" /></span></span>
                  <span className="dg-qr__icon-edge" />
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
