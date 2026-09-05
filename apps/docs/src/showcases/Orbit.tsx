import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  cancelFrame,
  frame,
  motionValue,
  useReducedMotion,
} from "motion/react";
import { LiquidGlassCanvas } from "refractive-glass-react/liquid-glass";
import { stepSpring } from "refractive-glass-react/apple-motion";
import {
  GlassButton,
  GlassSlider,
  GlassSwitch,
} from "refractive-glass-react/controls";
import type { PageProps } from "../site/Pages";
const clamp = (value: number) => Math.max(0.18, Math.min(0.82, value));
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
    settings = useRef({ viscosity, orbiting, reduce });
  const dragging = useRef<{
    index: number;
    pointer: number;
    last: number;
    capture: HTMLButtonElement;
  } | null>(null);
  dimensions.current = size;
  settings.current = { viscosity, orbiting, reduce };
  const positionHandles = () =>
    bodies.forEach((body, index) => {
      const element = handles.current[index];
      if (element)
        element.style.transform = `translate3d(${body.x.get() * dimensions.current.width}px, ${body.y.get() * dimensions.current.height}px, 0) translate(-50%, -50%)`;
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
    const canvas = source.current ?? document.createElement("canvas");
    source.current = canvas;
    canvas.width = size.width * 2;
    canvas.height = size.height * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.fillStyle = theme === "dark" ? "#1b1b1b" : "#eaeae7";
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.strokeStyle = theme === "dark" ? "#ffffff26" : "#00000030";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (size.width / 2) % 36; x < size.width; x += 36) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
    }
    for (let y = (size.height / 2) % 36; y < size.height; y += 36) {
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = theme === "dark" ? "#ffffff4a" : "#00000065";
    ctx.lineWidth = 2;
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
        if (moving && !reduced) {
          body.tx =
            0.5 + Math.cos(phase.current + (index * Math.PI * 2) / 3) * 0.19;
          body.ty =
            0.5 + Math.sin(phase.current + (index * Math.PI * 2) / 3) * 0.24;
        }
        const config = { mass: 1, stiffness: 90, damping: 10 + damping * 0.28 };
        let x: number, y: number;
        if (reduced) {
          x = body.tx;
          y = body.ty;
          body.vx = 0;
          body.vy = 0;
        } else {
          [x, body.vx] = stepSpring(body.x.get(), body.vx, body.tx, config, dt);
          [y, body.vy] = stepSpring(body.y.get(), body.vy, body.ty, config, dt);
        }
        body.x.set(x);
        body.y.set(y);
        body.velocityX.set(body.vx * dimensions.current.width);
        body.velocityY.set(body.vy * dimensions.current.height);
        active ||=
          x !== body.tx || y !== body.ty || body.vx !== 0 || body.vy !== 0;
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
    if (performance.now() - drag.last > 80) {
      body.vx = 0;
      body.vy = 0;
    }
    body.tx = clamp(body.x.get() + body.vx * 0.12);
    body.ty = clamp(body.y.get() + body.vy * 0.12);
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
      now = performance.now(),
      dt = Math.max(0.008, (now - drag.last) / 1000);
    const x = clamp((event.clientX - rect.left) / rect.width),
      y = clamp((event.clientY - rect.top) / rect.height);
    body.vx = Math.max(-2, Math.min(2, (x - body.x.get()) / dt));
    body.vy = Math.max(-2, Math.min(2, (y - body.y.get()) / dt));
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
              dragging.current = {
                index: nearest,
                pointer: event.pointerId,
                last: performance.now(),
                capture: event.currentTarget,
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
          LIQUID / {zh ? "动量实验" : "A STUDY IN MOMENTUM"}
        </span>
      </div>
      <div className="orbit-toolbar">
        <div className="example-row">
          <GlassButton onClick={() => arrange(true)}>
            {zh ? "融合" : "Gather"}
          </GlassButton>
          <GlassButton onClick={() => arrange(false)}>
            {zh ? "散开" : "Scatter"}
          </GlassButton>
        </div>
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
