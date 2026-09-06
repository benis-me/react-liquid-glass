import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
import { createLiquidBackdrop } from "../liquid-glass/backdrop";
import { PRISM_MATERIAL } from "../liquid-glass/provider";
import { paintLiquidGrid } from "../liquid-glass/source";

export type GlassBackground = "grid" | "lines" | "plain";
// Compact controls need less broad shading than the original, deep menu lens.
export const SURFACE_MATERIAL = {
  ...PRISM_MATERIAL,
  glowStrength: .1, glowSpread: .6, edgeStrength: .26, edgeWidth: 1.2,
  shadowStrength: .055, shadowBlur: 14, shadowOffset: 4,
} as const;
export const StageContext = createContext(false);

/** Visible demo substrate; all glass reads it through the shared DOM backdrop. */
export function GlassStage({
  children,
  background = "grid",
  className = "",
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { background?: GlassBackground }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
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
      ctx.fillStyle = dark ? "#202020" : "#f3f3f1";
      ctx.fillRect(0, 0, width, height);
      if (background === "grid") {
        paintLiquidGrid(ctx, width, height, dark);
      } else if (background === "lines") {
        ctx.lineWidth = 8;
        ctx.strokeStyle = dark ? "#ffffff18" : "#00000018";
        ctx.beginPath();
        for (let x = -height; x < width + height; x += 32) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x + height, height);
        }
        ctx.stroke();
      }
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
  return (
    <div
      {...props}
      ref={root}
      className={`dg-stage ${className}`}
      style={style}
    >
      <canvas ref={canvas} className="dg-stage__substrate" aria-hidden="true" />
      <StageContext.Provider value={true}>
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
  /** Frost strength in CSS pixels, for larger surfaces such as inspectors. */
  blurStrength?: number;
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
  blurStrength,
}: GlassSurfaceProps) {
  const root = useRef<HTMLSpanElement>(null);
  const contact = useGlassContact(root, { enabled: interactive !== false, deform: interactive !== "light" });
  const source = useRef<HTMLCanvasElement | null>(null);
  const revision = useMotionValue(0);
  const scale = useMotionValue(1);
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const widthValue = useMotionValue(0),
    heightValue = useMotionValue(0);
  const halfWidth = useTransform(() => (widthValue.get() * scale.get()) / 2);
  const halfHeight = useTransform(() => (heightValue.get() * scale.get()) / 2);
  const transform = useTransform(() => {
    const s = scale.get();
    const [a, b, c, d, x, y] = contactTransform(Math.max(1, widthValue.get() * s), Math.max(1, heightValue.get() * s), contact.anchorX.get(), contact.anchorY.get(), contact.pullX.get(), contact.pullY.get());
    return `matrix(${a * s},${b * s},${c * s},${d * s},${x},${y})`;
  });
  useEffect(() => {
    if (reduce) {
      scale.jump(pressed ? 1.025 : 1);
      return;
    }
    const run = springTo(scale, pressed ? 1.025 : 1, SURFACE_PRESS_SPRING);
    return () => run.stop();
  }, [pressed, reduce, scale]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    return createLiquidBackdrop(element, () => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - 40, top: rect.top - 40, width: element.offsetWidth + 80, height: element.offsetHeight + 80 };
    }, canvas => {
      const width = element.offsetWidth,
        height = element.offsetHeight;
      if (!width || !height) return;
      setSize((old) =>
        old.width === width && old.height === height ? old : { width, height },
      );
      widthValue.set(width);
      heightValue.set(height);
      source.current = canvas;
      revision.set(revision.get() + 1);
    }).dispose;
  }, [revision, widthValue, heightValue]);
  return (
    <span
      ref={root}
      className={`dg-surface ${className}`}
      style={{ ...style, borderRadius: radius }}
    >
      {size.width > 0 && (
        <span className="dg-surface__optics" aria-hidden="true" style={{ inset: -40 }}>
          <LiquidGlassCanvas
            {...SURFACE_MATERIAL}
            blurStrength={blurStrength ?? SURFACE_MATERIAL.blurStrength}
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
            refractionRatio={[(size.width + 28) / (size.width + 80), (size.height + 28) / (size.height + 80)]}
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
