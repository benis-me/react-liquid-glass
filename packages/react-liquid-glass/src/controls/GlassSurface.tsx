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
  useTransform,
} from "motion/react";
import { springTo, useGlassContact } from "../apple-motion/react.js";
import { contactTransform } from "../apple-motion/contact.js";
import { GLASS_PRESS_SCALE, SURFACE_PRESS_SPRING } from "../apple-motion/presets.js";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas.js";
import { createLiquidBackdrop } from "../liquid-glass/backdrop.js";
import { useGlassTone } from "../liquid-glass/provider.js";
import { useLiquidToneTracker } from "../liquid-glass/tone.js";
import { liquidScreenScale, paintLiquidGrid } from "../liquid-glass/source.js";
import { glassCanvasReach, liquidSurfaceBlur, liquidThickness, type GlassLook } from "../liquid-glass/material.js";
import { useReducedMotionPreference } from "../shared/reduced-motion.js";

export type GlassBackground = "grid" | "lines" | "plain";
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
      attributeFilter: ["data-theme", "class", "style"],
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
  /**
   * Frost, in CSS pixels, at a panel's thickness; smaller surfaces scale it down with their
   * size, as all glass does. Default 12. Inspectors use more.
   */
  blurStrength?: number;
  pressed?: boolean;
  /** Contact light and elastic pull; use "light" to keep application-owned dragging. */
  interactive?: boolean | "light";
  /** How the glass reads: its variant, clarity and tint (see GlassLook). */
  glass?: GlassLook;
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
  glass,
}: GlassSurfaceProps) {
  const root = useRef<HTMLSpanElement>(null);
  const publishTone = useLiquidToneTracker(root, useGlassTone());
  const contact = useGlassContact(root, { enabled: interactive !== false, deform: interactive !== "light" });
  const source = useRef<HTMLCanvasElement | null>(null);
  const revision = useMotionValue(0);
  const scale = useMotionValue(1);
  const reduce = useReducedMotionPreference();
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
      scale.jump(pressed ? GLASS_PRESS_SCALE : 1);
      return;
    }
    const run = springTo(scale, pressed ? GLASS_PRESS_SCALE : 1, SURFACE_PRESS_SPRING);
    return () => run.stop();
  }, [pressed, reduce, scale]);
  // The canvas reaches as far as the visible shadow of glass this thick: 40px for a control.
  const pad = (width: number, height: number) => glassCanvasReach(liquidThickness(width, height));
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const backdrop = createLiquidBackdrop(element, () => {
      // On screen, so a surface under a scaled ancestor still samples what lies behind it.
      const rect = element.getBoundingClientRect(), scale = liquidScreenScale(element, rect);
      const reach = pad(element.offsetWidth, element.offsetHeight);
      return { left: rect.left - reach * scale.x, top: rect.top - reach * scale.y, width: (element.offsetWidth + reach * 2) * scale.x, height: (element.offsetHeight + reach * 2) * scale.y };
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
      const reach = pad(width, height);
      publishTone(canvas, { left: reach / (width + reach * 2), top: reach / (height + reach * 2), width: width / (width + reach * 2), height: height / (height + reach * 2) });
    });
    return () => backdrop.dispose();
  }, [revision, widthValue, heightValue, publishTone]);
  const reach = pad(size.width, size.height);
  return (
    <span
      ref={root}
      className={`dg-surface ${className}`}
      style={{ ...style, borderRadius: radius }}
    >
      {size.width > 0 && (
        <span className="dg-surface__optics" aria-hidden="true" style={{ inset: -reach }}>
          <LiquidGlassCanvas
            variant={glass?.variant}
            clarity={glass?.clarity}
            tint={glass?.tint}
            blurStrength={blurStrength === undefined ? undefined : liquidSurfaceBlur(size.width, size.height) * blurStrength / 12}
            shared
            pixelRatio={2}
            sourceRef={source}
            sourceRevision={revision}
            width={size.width + reach * 2}
            height={size.height + reach * 2}
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
            refractionRatio={[(size.width + 28) / (size.width + reach * 2), (size.height + 28) / (size.height + reach * 2)]}
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
