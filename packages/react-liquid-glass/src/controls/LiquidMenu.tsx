import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import type { LensParams } from "../types";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";
import { LIQUID_LENS } from "../liquid-glass/LiquidGlass";
import { liquidContentPose, liquidContentOptics } from "../liquid-glass/geometry";
import { paintLiquidMenuContent } from "../liquid-glass/menu-content";
import { useMenuMotion, type MenuLayout } from "../apple-motion/use-menu-motion";
import { TRIGGER_RADIUS } from "../apple-motion/menu";
import { useMenuMaterial } from "./use-menu-material";

const BASE_MENU_LENS = LIQUID_LENS;

const LIGHT_MENU_LENS: Partial<LensParams> = {
  ...BASE_MENU_LENS,
  brightness: 0.015,
  glowStrength: 0.3,
  edgeStrength: 0.36,
  specularDark: false,
};

const DARK_MENU_LENS: Partial<LensParams> = {
  ...BASE_MENU_LENS,
  brightness: 0.035,
  glowStrength: 0.38,
  edgeStrength: 0.42,
  specularDark: false,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function blendMaterialValue(values: unknown[]) {
  const [progress, menuValue, buttonValue] = values as number[];
  return buttonValue + (menuValue - buttonValue) * progress;
}

function menuLayout(width: number, height: number): MenuLayout {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const compact = safeWidth < 560;
  const insetX = compact ? 12 : 30;
  const insetY = compact ? 18 : 25;
  const panelWidth = Math.max(1, Math.min(404, safeWidth - insetX * 2));
  const panelHeight = Math.max(1, Math.min(compact ? 690 : 748, safeHeight - insetY * 2));
  const panelLeft = (safeWidth - panelWidth) / 2;
  const panelTop = (safeHeight - panelHeight) / 2;
  const panelRight = panelLeft + panelWidth;
  const panelBottom = panelTop + panelHeight;
  const panelRadius = Math.min(compact ? 40 : 44, panelWidth / 2, panelHeight / 2);
  const triggerCenterX = clamp(panelRight - 38, TRIGGER_RADIUS, safeWidth - TRIGGER_RADIUS);
  const triggerCenterY = clamp(panelBottom - 38, TRIGGER_RADIUS, safeHeight - TRIGGER_RADIUS);

  return {
    panelLeft,
    panelTop,
    panelRight,
    panelBottom,
    panelWidth,
    panelHeight,
    panelRadius,
    triggerCenterX,
    triggerCenterY,
    triggerLeft: triggerCenterX - TRIGGER_RADIUS,
    triggerTop: triggerCenterY - TRIGGER_RADIUS,
  };
}

export interface LiquidMenuProps {
  theme: "light" | "dark";
  menuLabel: string;
  openLabel: string;
  trigger: ReactNode;
  children: (open: boolean) => ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export function LiquidMenu({ theme, menuLabel, openLabel, trigger, children, className, onOpenChange }: LiquidMenuProps) {
  const menuLens = theme === "dark" ? DARK_MENU_LENS : LIGHT_MENU_LENS;
  const menuId = useId();
  const fusionSourceRef = useRef<HTMLCanvasElement>(null);
  const contentSourceRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [fusionSourceRevision, setFusionSourceRevision] = useState(0);
  const contentActive = useMotionValue(0);
  const contentRevision = useMotionValue(0);
  const { depth, tintOpacity, zoom, buttonDepth, buttonTintOpacity, buttonZoom, closingBlur, transition, press } = useMenuMaterial();
  const captureContent = useCallback(() => {
    const panel = panelRef.current;
    const canvas = contentSourceRef.current;
    if (!panel || !canvas) return false;
    try {
      if (!paintLiquidMenuContent(panel, canvas)) return false;
    } catch (error) {
      console.warn("Liquid menu content capture failed; retaining DOM content.", error);
      return false;
    }
    contentRevision.set(contentRevision.get() + 1);
    return true;
  }, [contentRevision]);
  const refreshMovingContent = useCallback(() => {
    if (contentActive.get()) captureContent();
  }, [captureContent, contentActive]);

  const { open, stageSize, stageRef, triggerRef, rightEdge, bottomEdge, halfWidth, halfHeight, cornerRadius, centerX, centerY, buttonCenterX, buttonCenterY, buttonHalf, menuVelocityX, menuVelocityY, buttonVelocityX, buttonVelocityY, mergeDistance, reveal, triggerOpacity, triggerScale, triggerOffsetX, triggerOffsetY, setExpanded, pressTrigger } = useMenuMotion({
    getLayout: menuLayout,
    onBegin: ({ interrupted, reducedMotion }) => { if (!reducedMotion && !interrupted) contentActive.set(captureContent() ? 1 : 0); },
    onTransition: transition,
    onPress: press,
    onRest: () => { contentActive.jump(0); closingBlur.jump(0); },
    onOpenChange,
  });
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;
  const contentOpacity = useTransform([reveal, contentActive], ([opacity, active]: number[]) => opacity * active);
  const domContentOpacity = useTransform([reveal, contentActive], ([opacity, active]: number[]) => opacity * (1 - active));
  const materialProgress = useTransform(halfWidth, (value) => {
    const target = menuLayout(stageSizeRef.current.width, stageSizeRef.current.height).panelWidth / 2;
    return clamp(
      (value - TRIGGER_RADIUS) / Math.max(1, target - TRIGGER_RADIUS),
      0,
      1,
    );
  });
  const materialBlur = useTransform(materialProgress, (progress) => 0.5 + progress * 1.1);
  const materialDepth = useTransform([materialProgress, depth, buttonDepth], blendMaterialValue);
  const materialTintOpacity = useTransform(
    [materialProgress, tintOpacity, buttonTintOpacity],
    blendMaterialValue,
  );
  const materialZoom = useTransform([materialProgress, zoom, buttonZoom], blendMaterialValue);
  const contentOptics = useTransform([halfWidth, halfHeight, cornerRadius], (values) =>
    liquidContentOptics(values as number[], menuLayout(stageSizeRef.current.width, stageSizeRef.current.height)));
  const contentRefraction = useTransform(contentOptics, (optics) => optics.refraction);
  const contentBlur = useTransform(() => Math.max(contentOptics.get().blur, closingBlur.get()));
  const contentFilter = useTransform(contentBlur, (blur) => `blur(${blur}px)`);
  const fusionBlobs = useMemo(
    () => [
      {
        x: centerX,
        y: centerY,
        radius: cornerRadius,
        halfWidth,
        halfHeight,
        cornerRadius,
        velocityX: menuVelocityX,
        velocityY: menuVelocityY,
      },
      {
        x: buttonCenterX,
        y: buttonCenterY,
        radius: buttonHalf,
        halfWidth: buttonHalf,
        halfHeight: buttonHalf,
        cornerRadius: buttonHalf,
        velocityX: buttonVelocityX,
        velocityY: buttonVelocityY,
      },
    ],
    [
      centerX,
      centerY,
      cornerRadius,
      halfHeight,
      halfWidth,
      menuVelocityX,
      menuVelocityY,
      buttonCenterX,
      buttonCenterY,
      buttonHalf,
      buttonVelocityX,
      buttonVelocityY,
    ],
  );
  const contentPose = useTransform(
    [rightEdge, bottomEdge, halfWidth, halfHeight, cornerRadius, menuVelocityX, menuVelocityY],
    (values) => liquidContentPose(values as number[], menuLayout(stageSizeRef.current.width, stageSizeRef.current.height)),
  );
  const contentTransform = useTransform(contentPose, (pose) => pose.transform);
  const contentClip = useTransform(contentPose, (pose) => pose.clipPath);

  useEffect(() => {
    if (contentActive.get()) captureContent();
  }, [captureContent, contentActive, children, stageSize, theme]);

  useEffect(() => {
    const canvas = fusionSourceRef.current;
    if (!canvas) return;

    const width = Math.max(1, stageSize.width);
    const height = Math.max(1, stageSize.height);
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dark = theme === "dark";
    const spacing = 72;
    const phaseX = ((width / 2 - spacing / 2) % spacing + spacing) % spacing;
    const phaseY = ((height / 2 - spacing / 2) % spacing + spacing) % spacing;
    context.fillStyle = dark ? "#1a1a1a" : "#ebebe8";
    context.fillRect(0, 0, width, height);
    context.fillStyle = dark ? "rgb(255 255 255 / 8.5%)" : "rgb(0 0 0 / 7.5%)";
    for (let x = phaseX; x < width; x += spacing) context.fillRect(x, 0, 1, height);
    for (let y = phaseY; y < height; y += spacing) context.fillRect(0, y, width, 1);
    setFusionSourceRevision((revision) => revision + 1);
  }, [stageSize.height, stageSize.width, theme]);

  const layout = menuLayout(stageSize.width, stageSize.height);

  return (
    <div ref={stageRef} className={["dg-liquid-glass", className].filter(Boolean).join(" ")} data-liquid-theme={theme}>
      <canvas
        ref={fusionSourceRef}
        className="dg-liquid-menu__fusion-source"
        aria-hidden="true"
      />
      <canvas ref={contentSourceRef} className="dg-liquid-menu__fusion-source" aria-hidden="true" />
      <div className="dg-liquid-menu__fusion-layer" aria-hidden="true">
        <LiquidGlassCanvas
          sourceRef={fusionSourceRef}
          contentRef={contentSourceRef}
          contentRevision={contentRevision}
          contentOpacity={contentOpacity}
          contentRefraction={contentRefraction}
          contentBlur={contentBlur}
          width={stageSize.width}
          height={stageSize.height}
          blobs={fusionBlobs}
          mergeDistance={mergeDistance}
          refractionStrength={menuLens.scaleX}
          chromaAmount={menuLens.chromaAmount}
          specularStrength={menuLens.specularStrength}
          blurStrength={materialBlur}
          edgeDepth={materialDepth}
          domeDepth={menuLens.domeDepth}
          brightness={menuLens.brightness}
          specularRotation={menuLens.specularRotation}
          glowStrength={menuLens.glowStrength}
          glowSpread={menuLens.glowSpread}
          glowExponent={menuLens.glowExponent}
          edgeStrength={menuLens.edgeStrength}
          edgeWidth={menuLens.edgeWidth}
          edgeExponent={menuLens.edgeExponent}
          tintColor={theme === "dark" ? [74 / 255, 74 / 255, 70 / 255] : [1, 1, 1]}
          tintStrength={materialTintOpacity}
          magnification={materialZoom}
          shadowStrength={0.11}
          sourceRevision={fusionSourceRevision}
          pixelRatio={2}
          className="dg-liquid-menu__fusion-canvas"
          ariaLabel={menuLabel}
        />
      </div>

      <div
        className="dg-liquid-menu__dismiss"
        data-open={open ? "true" : "false"}
        onPointerDown={() => setExpanded(false, true)}
      />

      <motion.button
        ref={triggerRef}
        className="dg-liquid-menu__trigger"
        type="button"
        aria-label={openLabel}
        aria-expanded={open}
        aria-controls={menuId}
        tabIndex={open ? -1 : 0}
        style={{
          left: layout.triggerLeft,
          top: layout.triggerTop,
          opacity: triggerOpacity,
          scale: triggerScale,
          x: triggerOffsetX,
          y: triggerOffsetY,
          pointerEvents: open ? "none" : "auto",
        }}
        onPointerDown={() => pressTrigger(true)}
        onPointerUp={() => pressTrigger(false)}
        onPointerCancel={() => pressTrigger(false)}
        onPointerLeave={() => pressTrigger(false)}
        onClick={() => setExpanded(true)}
      >
        {trigger}
      </motion.button>

      <motion.div
        ref={panelRef}
        id={menuId}
        className="dg-liquid-menu__panel"
        onScrollCapture={refreshMovingContent}
        onFocusCapture={refreshMovingContent}
        onBlurCapture={refreshMovingContent}
        role="menu"
        aria-label={menuLabel}
        aria-hidden={!open}
        data-open={open ? "true" : "false"}
        style={{
          left: layout.panelLeft,
          top: layout.panelTop,
          width: layout.panelWidth,
          height: layout.panelHeight,
          borderRadius: layout.panelRadius,
          opacity: domContentOpacity,
          transform: contentTransform,
          transformOrigin: "0 0",
          filter: contentFilter,
          clipPath: contentClip,
        }}
      >
        {children(open)}
      </motion.div>
    </div>
  );
}
