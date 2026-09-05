import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { springTo } from "../apple-motion/react";
import { SURFACE_PRESS_SPRING } from "../apple-motion/presets";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";

export type GlassBackground = "grid" | "lines" | "plain";
const StageContext = createContext<{
  canvas: HTMLCanvasElement | null;
  root: HTMLDivElement | null;
  revision: number;
} | null>(null);

/** A real, explicit shared substrate. Children sample its pixels, not arbitrary browser DOM. */
export function GlassStage({
  children,
  background = "grid",
  className = "",
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { background?: GlassBackground }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [revision, setRevision] = useState(0);
  useLayoutEffect(() => {
    const element = root.current,
      output = canvas.current;
    if (!element || !output) return;
    const draw = () => {
      const width = element.clientWidth,
        height = element.clientHeight;
      if (!width || !height) return;
      output.width = width * 2;
      output.height = height * 2;
      const ctx = output.getContext("2d")!;
      ctx.scale(2, 2);
      const dark = getComputedStyle(element).colorScheme.includes("dark");
      ctx.fillStyle = dark ? "#202020" : "#eeeeec";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = dark ? "#ffffff18" : "#00000018";
      ctx.lineWidth = 1;
      if (background === "grid") {
        ctx.beginPath();
        for (let x = (width / 2) % 48; x < width; x += 48) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = (height / 2) % 48; y < height; y += 48) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      } else if (background === "lines") {
        ctx.lineWidth = 8;
        ctx.strokeStyle = dark ? "#ffffff30" : "#00000030";
        ctx.beginPath();
        for (let x = -height; x < width + height; x += 32) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x + height, height);
        }
        ctx.stroke();
      }
      setRevision((value) => value + 1);
    };
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(element);
    const theme = new MutationObserver(draw);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    return () => {
      resize.disconnect();
      theme.disconnect();
    };
  }, [background]);
  const value = useMemo(
    () => ({ root: root.current, canvas: canvas.current, revision }),
    [revision],
  );
  return (
    <div
      {...props}
      ref={root}
      className={`dg-stage ${className}`}
      style={style}
    >
      <canvas ref={canvas} className="dg-stage__substrate" aria-hidden="true" />
      <StageContext.Provider value={value}>
        <div className="dg-stage__contents">{children}</div>
      </StageContext.Provider>
    </div>
  );
}

export interface GlassSurfaceProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  radius?: number;
  pressed?: boolean;
}

/** The shared optical surface for library components. Text and native controls stay interactive. */
export function GlassSurface({
  children,
  className = "",
  style,
  radius = 18,
  pressed = false,
}: GlassSurfaceProps) {
  const root = useRef<HTMLSpanElement>(null);
  const source = useRef<HTMLCanvasElement | null>(null);
  const revision = useMotionValue(0);
  const scale = useMotionValue(1);
  const stage = useContext(StageContext);
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const widthValue = useMotionValue(0),
    heightValue = useMotionValue(0);
  const halfWidth = useTransform(() => (widthValue.get() * scale.get()) / 2);
  const halfHeight = useTransform(() => (heightValue.get() * scale.get()) / 2);
  useEffect(() => {
    if (reduce) {
      scale.jump(pressed ? 0.96 : 1);
      return;
    }
    const run = springTo(scale, pressed ? 0.96 : 1, SURFACE_PRESS_SPRING);
    return () => run.stop();
  }, [pressed, reduce, scale]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const paint = () => {
      const width = element.offsetWidth,
        height = element.offsetHeight;
      if (!width || !height) return;
      setSize((old) =>
        old.width === width && old.height === height ? old : { width, height },
      );
      widthValue.set(width);
      heightValue.set(height);
      const canvas = source.current ?? document.createElement("canvas");
      source.current = canvas;
      canvas.width = (width + 28) * 2;
      canvas.height = (height + 28) * 2;
      const ctx = canvas.getContext("2d")!;
      const dark = getComputedStyle(element).colorScheme.includes("dark");
      ctx.fillStyle = dark ? "#202020" : "#eeeeec";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (stage?.canvas?.width && stage.root) {
        const rect = element.getBoundingClientRect(),
          parent = stage.root.getBoundingClientRect();
        ctx.drawImage(
          stage.canvas,
          (rect.left - parent.left - 14) * 2,
          (rect.top - parent.top - 14) * 2,
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      }
      revision.set(revision.get() + 1);
    };
    paint();
    const resize = new ResizeObserver(paint);
    resize.observe(element);
    const theme = new MutationObserver(paint);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    document.fonts.addEventListener("loadingdone", paint);
    window.addEventListener("resize", paint);
    return () => {
      resize.disconnect();
      theme.disconnect();
      document.fonts.removeEventListener("loadingdone", paint);
      window.removeEventListener("resize", paint);
    };
  }, [stage, revision, widthValue, heightValue]);
  return (
    <span
      ref={root}
      className={`dg-surface ${className}`}
      style={{ ...style, borderRadius: radius }}
    >
      {size.width > 0 && (
        <span className="dg-surface__optics" aria-hidden="true">
          <LiquidGlassCanvas
            shared
            pixelRatio={2}
            sourceRef={source}
            sourceRevision={revision}
            width={size.width + 28}
            height={size.height + 28}
            blobs={[
              {
                x: 0.5,
                y: 0.5,
                radius,
                cornerRadius: radius,
                halfWidth,
                halfHeight,
              },
            ]}
            domeDepth={Math.min(18, size.height * 0.25)}
            edgeDepth={Math.min(12, size.height * 0.12)}
            refractionStrength={0.11}
            chromaAmount={0.24}
            blurStrength={0.5}
            tintStrength={0.055}
            shadowStrength={0.07}
            shadowBlur={14}
            shadowOffset={4}
            transparentOutside
            style={{ width: "100%", height: "100%" }}
          />
        </span>
      )}
      <motion.span className="dg-surface__content" style={{ scale }}>
        {children}
      </motion.span>
    </span>
  );
}
