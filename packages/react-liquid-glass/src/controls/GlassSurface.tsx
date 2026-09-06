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
import { springTo, useGlassContact } from "../apple-motion/react";
import { contactTransform } from "../apple-motion/contact";
import { SURFACE_PRESS_SPRING } from "../apple-motion/presets";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";

export type GlassBackground = "grid" | "lines" | "plain";
export const StageContext = createContext<{
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
  /** Contact light and elastic pull; use "light" to keep application-owned dragging. */
  interactive?: boolean | "light";
}

export const FusionTriggerContext = createContext<((pressed: boolean) => void) | null>(null);

export function GlassSurface(props: GlassSurfaceProps) {
  const fused = useContext(FusionTriggerContext);
  useEffect(() => { fused?.(props.pressed ?? false); }, [fused, props.pressed]);
  return fused ? <span className={`dg-surface ${props.className ?? ""}`} style={{ ...props.style, borderRadius: props.radius ?? 18 }}><span className="dg-surface__content">{props.children}</span></span> : <OpticalSurface {...props} />;
}

/** The shared optical surface for library components. Text and native controls stay interactive. */
function OpticalSurface({
  children,
  className = "",
  style,
  radius = 18,
  pressed = false,
  interactive = true,
}: GlassSurfaceProps) {
  const root = useRef<HTMLSpanElement>(null);
  const contact = useGlassContact(root, { enabled: interactive !== false, deform: interactive !== "light" });
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
  const transform = useTransform(() => {
    const s = scale.get();
    const [a, b, c, d, x, y] = contactTransform(Math.max(1, widthValue.get() * s), Math.max(1, heightValue.get() * s), contact.contactX.get(), contact.contactY.get(), contact.pullX.get(), contact.pullY.get());
    return `matrix(${a * s},${b * s},${c * s},${d * s},${x},${y})`;
  });
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
      canvas.width = (width + 80) * 2;
      canvas.height = (height + 80) * 2;
      const ctx = canvas.getContext("2d")!;
      const dark = getComputedStyle(element).colorScheme.includes("dark");
      ctx.fillStyle = dark ? "#202020" : "#eeeeec";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (stage?.canvas?.width && stage.root) {
        const rect = element.getBoundingClientRect(),
          parent = stage.root.getBoundingClientRect();
        ctx.drawImage(
          stage.canvas,
          (rect.left - parent.left - 40) * 2,
          (rect.top - parent.top - 40) * 2,
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
        <span className="dg-surface__optics" aria-hidden="true" style={{ inset: -40 }}>
          <LiquidGlassCanvas
            shared
            pixelRatio={2}
            sourceRef={source}
            sourceRevision={revision}
            width={size.width + 80}
            height={size.height + 80}
            blobs={[
              {
                x: 0.5,
                y: 0.5,
                radius,
                cornerRadius: radius,
                halfWidth,
                halfHeight,
                ...contact,
              },
            ]}
            domeDepth={Math.min(18, size.height * 0.25)}
            edgeDepth={Math.min(12, size.height * 0.12)}
            refractionStrength={0.11}
            refractionRatio={[(size.width + 28) / (size.width + 80), (size.height + 28) / (size.height + 80)]}
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
      <motion.span className="dg-surface__content" style={{ transform }}>
        {children}
      </motion.span>
    </span>
  );
}
