import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  cancelFrame,
  frame,
  motionValue,
  useReducedMotion,
} from "motion/react";
import { LiquidGlassCanvas, paintLiquidGrid } from "rglass/liquid-glass";
import { stepSpring } from "rglass/apple-motion";
import {
  GlassButton,
  GlassButtonGroup,
  GlassSlider,
  GlassSwitch,
} from "rglass/controls";
import type { PageProps } from "../site/Pages";
const MIN = 0.18, MAX = 0.82;
const clamp = (value: number) => Math.max(MIN, Math.min(MAX, value));
// Past the board margin a held body meets UIScrollView-style resistance,
// approaching (never crossing) the board edge.
const band = (offset: number) => (1 - 1 / ((offset * 0.55) / MIN + 1)) * MIN;
const rubber = (value: number) =>
  value < MIN ? MIN - band(MIN - value) : value > MAX ? MAX + band(value - MAX) : value;
// A released body glides as far as a decelerating scroll view would (seconds of
// travel at release speed); higher viscosity decelerates sooner.
const projection = (viscosity: number) => {
  const rate = 0.995 - viscosity * 0.0001;
  return rate / (1 - rate) / 1000;
};
type Sample = { t: number; x: number; y: number };
/** Least-squares velocity over the recent pointer window, in board units per second. */
function trackVelocity(samples: Sample[]) {
  const n = samples.length;
  if (n < 2) return [0, 0];
  const origin = samples[n - 1].t;
  let st = 0, sx = 0, sy = 0, stt = 0, stx = 0, sty = 0;
  for (const sample of samples) {
    const t = (sample.t - origin) / 1000;
    st += t; sx += sample.x; sy += sample.y;
    stt += t * t; stx += t * sample.x; sty += t * sample.y;
  }
  const determinant = n * stt - st * st;
  if (determinant < 1e-9) return [0, 0];
  return [(n * stx - st * sx) / determinant, (n * sty - st * sy) / determinant];
}
/**
 * Neighbouring droplets lean together. A bond formed near contact stretches
 * farther before it lets go, so pulling two bodies apart ends in a small snap.
 * Shifts derive from targets rather than live positions, so bodies still settle.
 */
function surfaceTension(points: number[][], radii: number[], merge: number, bonds: Set<string>) {
  const shifts = points.map(() => [0, 0]);
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const dx = points[j][0] - points[i][0], dy = points[j][1] - points[i][1], distance = Math.hypot(dx, dy);
    const gap = distance - radii[i] - radii[j], key = `${i}-${j}`;
    if (gap < merge * 0.25) bonds.add(key);
    else if (gap > merge * 1.6) bonds.delete(key);
    const range = bonds.has(key) ? merge * 1.6 : merge, overlap = Math.min(radii[i], radii[j]) * 0.35;
    const weight = gap >= 0 ? Math.max(0, 1 - gap / range) : Math.max(0, 1 + gap / overlap);
    if (!weight || distance < 1e-3) continue;
    // Larger bodies pull harder, like the surface energy of a bigger droplet.
    const pull = (merge * 0.45 * weight) / distance / (radii[i] + radii[j]);
    shifts[i][0] += dx * pull * radii[j]; shifts[i][1] += dy * pull * radii[j];
    shifts[j][0] -= dx * pull * radii[i]; shifts[j][1] -= dy * pull * radii[i];
  }
  return shifts;
}
export function Orbit({ locale, theme }: PageProps) {
  const zh = locale === "zh",
    reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null),
    source = useRef<HTMLCanvasElement | null>(null),
    revision = useRef(motionValue(0)).current;
  const [size, setSize] = useState({ width: 640, height: 440 }),
    [viscosity, setViscosity] = useState(40),
    [orbiting, setOrbiting] = useState(false);
  const [bodies] = useState(() =>
    [0.28, 0.5, 0.72].map((x, index) => ({
      x: motionValue(x),
      y: motionValue(0.5),
      velocityX: motionValue(0),
      velocityY: motionValue(0),
      radius: [48, 60, 42][index],
      tx: x,
      ty: 0.5,
      vx: 0,
      vy: 0,
    })),
  );
  const handles = useRef<(HTMLButtonElement | null)[]>([]),
    dimensions = useRef(size),
    wake = useRef(() => {}),
    phase = useRef(0),
    bonds = useRef(new Set<string>()),
    settings = useRef({ viscosity, orbiting, reduce });
  const dragging = useRef<{
    index: number;
    pointer: number;
    last: number;
    capture: HTMLButtonElement;
    samples: Sample[];
  } | null>(null);
  dimensions.current = size;
  settings.current = { viscosity, orbiting, reduce };
  const positionHandles = () =>
    bodies.forEach((body, index) => {
      const element = handles.current[index];
      const transform = `translate3d(${body.x.get() * dimensions.current.width}px, ${body.y.get() * dimensions.current.height}px, 0) translate(-50%, -50%)`;
      if (element && element.style.transform !== transform) element.style.transform = transform;
    });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const resize = new ResizeObserver(() => {
      const width = element.clientWidth,
        height = element.clientHeight;
      dimensions.current = { width, height };
      setSize({ width, height });
      positionHandles();
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    const canvas = source.current;
    if (!canvas) return;
    canvas.width = size.width * 2;
    canvas.height = size.height * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    paintLiquidGrid(ctx, size.width, size.height, theme === "dark");
    ctx.strokeStyle = theme === "dark" ? "#ffffff1a" : "#00000016";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(
      size.width / 2,
      size.height / 2,
      Math.min(size.width, size.height) * 0.28,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    revision.set(revision.get() + 1);
    positionHandles();
  }, [size, theme, revision]);
  useEffect(() => {
    let running = false,
      visible = true,
      previous = 0;
    const tick = ({ timestamp }: { timestamp: number }) => {
      if (!visible || document.hidden) {
        running = false;
        cancelFrame(tick);
        return;
      }
      const dt = Math.min(0.04, Math.max(0.001, (timestamp - previous) / 1000));
      previous = timestamp;
      const {
        orbiting: moving,
        viscosity: damping,
        reduce: reduced,
      } = settings.current;
      if (moving && !reduced) phase.current += dt * 0.55;
      let active = moving && !reduced;
      const config = { mass: 1, stiffness: 90, damping: 10 + damping * 0.28 };
      if (moving && !reduced) bodies.forEach((body, index) => {
        if (dragging.current?.index === index) return;
        body.tx = 0.5 + Math.cos(phase.current + (index * Math.PI * 2) / 3) * 0.19;
        body.ty = 0.5 + Math.sin(phase.current + (index * Math.PI * 2) / 3) * 0.24;
      });
      const { width, height } = dimensions.current, scale = Math.min(1, width / 600);
      const shifts = surfaceTension(
        bodies.map((body, index) => dragging.current?.index === index
          ? [body.x.get() * width, body.y.get() * height]
          : [body.tx * width, body.ty * height]),
        bodies.map((body) => body.radius * scale), 38 * scale, bonds.current,
      );
      bodies.forEach((body, index) => {
        if (dragging.current?.index === index) {
          if (timestamp - dragging.current.last > 32) {
            const decay = Math.exp(-20 * dt);
            const vx = body.velocityX.get() * decay,
              vy = body.velocityY.get() * decay;
            body.velocityX.set(Math.abs(vx) < 0.1 ? 0 : vx);
            body.velocityY.set(Math.abs(vy) < 0.1 ? 0 : vy);
          }
          active ||= body.velocityX.get() !== 0 || body.velocityY.get() !== 0;
          return;
        }
        const targetX = clamp(body.tx + shifts[index][0] / width),
          targetY = clamp(body.ty + shifts[index][1] / height);
        let x: number, y: number;
        if (reduced) {
          x = targetX;
          y = targetY;
          body.vx = 0;
          body.vy = 0;
        } else {
          [x, body.vx] = stepSpring(body.x.get(), body.vx, targetX, config, dt);
          [y, body.vy] = stepSpring(body.y.get(), body.vy, targetY, config, dt);
        }
        body.x.set(x);
        body.y.set(y);
        body.velocityX.set(body.vx * width);
        body.velocityY.set(body.vy * height);
        active ||=
          x !== targetX || y !== targetY || body.vx !== 0 || body.vy !== 0;
      });
      positionHandles();
      if (!active) {
        running = false;
        cancelFrame(tick);
      }
    };
    wake.current = () => {
      if (!running && visible && !document.hidden) {
        running = true;
        previous = performance.now();
        frame.update(tick, true);
      }
    };
    const visibility = () => {
      if (document.hidden) {
        dragging.current = null;
        running = false;
        cancelFrame(tick);
      } else wake.current();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake.current();
      else {
        running = false;
        cancelFrame(tick);
      }
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", visibility);
    wake.current();
    return () => {
      cancelFrame(tick);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      wake.current = () => {};
    };
  }, [bodies]);
  useEffect(() => {
    wake.current();
  }, [orbiting, viscosity, reduce]);
  const release = () => {
    const drag = dragging.current;
    if (!drag) return;
    const body = bodies[drag.index];
    // A pointer that paused before lifting releases without momentum.
    const now = performance.now();
    [body.vx, body.vy] = now - drag.last > 80 ? [0, 0]
      : trackVelocity(drag.samples.filter((sample) => now - sample.t <= 100)).map((value) => Math.max(-4, Math.min(4, value)));
    const glide = settings.current.reduce ? 0 : projection(settings.current.viscosity);
    body.tx = clamp(body.x.get() + body.vx * glide);
    body.ty = clamp(body.y.get() + body.vy * glide);
    dragging.current = null;
    const element = drag.capture;
    if (element?.hasPointerCapture(drag.pointer))
      element.releasePointerCapture(drag.pointer);
    wake.current();
  };
  useEffect(() => {
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [bodies]);
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragging.current;
    if (!drag || event.pointerId !== drag.pointer) return;
    const rect = root.current!.getBoundingClientRect(),
      body = bodies[drag.index],
      now = event.timeStamp || performance.now();
    const x = rubber((event.clientX - rect.left) / rect.width),
      y = rubber((event.clientY - rect.top) / rect.height);
    drag.samples.push({ t: now, x, y });
    while (drag.samples.length > 8 || now - drag.samples[0].t > 100) drag.samples.shift();
    [body.vx, body.vy] = trackVelocity(drag.samples).map((value) => Math.max(-4, Math.min(4, value)));
    body.x.set(x);
    body.y.set(y);
    body.tx = x;
    body.ty = y;
    body.velocityX.set(reduce ? 0 : body.vx * rect.width);
    body.velocityY.set(reduce ? 0 : body.vy * rect.height);
    drag.last = now;
    positionHandles();
    wake.current();
  };
  const arrange = (merged: boolean) => {
    setOrbiting(false);
    bodies.forEach((body, index) => {
      body.tx = 0.5 + (index - 1) * (merged ? 0.07 : 0.24);
      body.ty = 0.5;
    });
    wake.current();
  };
  return (
    <div className="orbit-scene">
      <div className="orbit-board" ref={root}>
        <canvas ref={source} className="orbit-substrate" aria-hidden="true" />
        <LiquidGlassCanvas
          sourceRef={source}
          sourceRevision={revision}
          width={size.width}
          height={size.height}
          blobs={bodies.map((body) => ({
            ...body,
            radius: body.radius * Math.min(1, size.width / 600),
          }))}
          mergeDistance={38 * Math.min(1, size.width / 600)}
          refractionStrength={0.14}
          edgeDepth={14}
          domeDepth={24}
          chromaAmount={0.55}
          blurStrength={0.8}
          specularStrength={0.72}
          glowStrength={0.3}
          shadowStrength={0.11}
          shadowBlur={26}
          shadowOffset={18}
          transparentOutside
          style={{ width: "100%", height: "100%" }}
          ariaLabel={
            zh ? "三个可融合的液态玻璃体" : "Three merging liquid glass bodies"
          }
        />
        {bodies.map((body, index) => (
          <button
            key={index}
            ref={(element) => {
              handles.current[index] = element;
            }}
            className="orbit-handle"
            aria-label={`${zh ? "玻璃体" : "Glass body"} ${index + 1}`}
            style={{
              width: body.radius * 2 * Math.min(1, size.width / 600),
              height: body.radius * 2 * Math.min(1, size.width / 600),
            }}
            onPointerDown={(event) => {
              if (dragging.current) return;
              event.preventDefault();
              const rect = root.current!.getBoundingClientRect();
              const nearest = bodies.reduce(
                (best, candidate, candidateIndex) =>
                  Math.hypot(
                    candidate.x.get() * rect.width + rect.left - event.clientX,
                    candidate.y.get() * rect.height + rect.top - event.clientY,
                  ) <
                  Math.hypot(
                    bodies[best].x.get() * rect.width +
                      rect.left -
                      event.clientX,
                    bodies[best].y.get() * rect.height +
                      rect.top -
                      event.clientY,
                  )
                    ? candidateIndex
                    : best,
                index,
              );
              handles.current[nearest]?.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              setOrbiting(false);
              const start = event.timeStamp || performance.now();
              dragging.current = {
                index: nearest,
                pointer: event.pointerId,
                last: start,
                capture: event.currentTarget,
                samples: [{ t: start, x: bodies[nearest].x.get(), y: bodies[nearest].y.get() }],
              };
              bodies[nearest].vx = bodies[nearest].vy = 0;
              wake.current();
            }}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              setOrbiting(false);
              body.tx = clamp(
                body.tx +
                  (event.key === "ArrowRight"
                    ? 0.035
                    : event.key === "ArrowLeft"
                      ? -0.035
                      : 0),
              );
              body.ty = clamp(
                body.ty +
                  (event.key === "ArrowDown"
                    ? 0.035
                    : event.key === "ArrowUp"
                      ? -0.035
                      : 0),
              );
              wake.current();
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
          </button>
        ))}
        <span className="orbit-board__label">
          Liquid / {zh ? "动量实验" : "a study in momentum"}
        </span>
      </div>
      <div className="orbit-toolbar">
        <GlassButtonGroup label={zh ? "排列玻璃体" : "Arrange bodies"}>
          <GlassButton onClick={() => arrange(true)}>
            {zh ? "融合" : "Gather"}
          </GlassButton>
          <GlassButton onClick={() => arrange(false)}>
            {zh ? "散开" : "Scatter"}
          </GlassButton>
        </GlassButtonGroup>
        <label className="example-between">
          {zh ? "环绕" : "Orbit"}
          <GlassSwitch
            size="small"
            disabled={!!reduce}
            checked={orbiting}
            onCheckedChange={setOrbiting}
            ariaLabel={zh ? "环绕运动" : "Orbit motion"}
          />
        </label>
        <label className="orbit-viscosity">
          <span>
            {zh ? "粘滞感" : "Viscosity"}
            <output>{viscosity}</output>
          </span>
          <GlassSlider
            size="small"
            value={viscosity}
            onValueChange={setViscosity}
            ariaLabel={zh ? "粘滞感" : "Viscosity"}
          />
        </label>
      </div>
      <p className="doc-note">
        {zh
          ? "直接拖动玻璃体，或者聚焦后使用方向键。靠近时，它们会通过同一片折射表面融合。"
          : "Drag a body, or focus it and use the arrow keys. Bring them together to merge through one refractive surface."}
      </p>
    </div>
  );
}
