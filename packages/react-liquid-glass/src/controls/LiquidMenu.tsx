import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import type { LensParams } from "../types";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas";
import { LIQUID_LENS } from "../liquid-glass/LiquidGlass";
import { liquidContentPose, liquidContentOptics } from "../liquid-glass/geometry";
import { paintLiquidMenuContent } from "../liquid-glass/menu-content";
import { createLiquidBackdrop } from "../liquid-glass/backdrop";
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
  size?: "default" | "small";
  onOpenChange?: (open: boolean) => void;
}

export function LiquidMenu({ theme, menuLabel, openLabel, trigger, children, className, onOpenChange, size = "default" }: LiquidMenuProps) {
  const scale = size === "small" ? .65 : 1;
  const renderLayout = (width: number, height: number) => Object.fromEntries(
    Object.entries(menuLayout(width, height)).map(([key, value]) => [key, value * scale]),
  ) as unknown as MenuLayout;
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

  const { open, stageSize, stageRef, triggerRef, rightEdge: rawRightEdge, bottomEdge: rawBottomEdge, halfWidth: rawHalfWidth, halfHeight: rawHalfHeight, cornerRadius: rawCornerRadius, centerX, centerY, buttonCenterX, buttonCenterY, buttonHalf: rawButtonHalf, menuVelocityX: rawMenuVelocityX, menuVelocityY: rawMenuVelocityY, buttonVelocityX: rawButtonVelocityX, buttonVelocityY: rawButtonVelocityY, mergeDistance: rawMergeDistance, reveal, triggerOpacity, triggerScale, triggerOffsetX: rawTriggerOffsetX, triggerOffsetY: rawTriggerOffsetY, setExpanded, pressTrigger } = useMenuMotion({
    getLayout: menuLayout,
    coordinateScale: scale,
    onBegin: ({ interrupted, reducedMotion }) => { if (!reducedMotion && !interrupted) contentActive.set(captureContent() ? 1 : 0); },
    onTransition: transition,
    onPress: press,
    onRest: () => { contentActive.jump(0); closingBlur.jump(0); },
    onOpenChange,
  });
  const rightEdge = useTransform(rawRightEdge, value => value * scale);
  const bottomEdge = useTransform(rawBottomEdge, value => value * scale);
  const halfWidth = useTransform(rawHalfWidth, value => value * scale);
  const halfHeight = useTransform(rawHalfHeight, value => value * scale);
  const cornerRadius = useTransform(rawCornerRadius, value => value * scale);
  const menuVelocityX = useTransform(rawMenuVelocityX, value => value * scale);
  const menuVelocityY = useTransform(rawMenuVelocityY, value => value * scale);
  const triggerOffsetX = useTransform(rawTriggerOffsetX, value => value * scale);
  const triggerOffsetY = useTransform(rawTriggerOffsetY, value => value * scale);
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;
  const contentOpacity = useTransform([reveal, contentActive], ([opacity, active]: number[]) => opacity * active);
  const domContentOpacity = useTransform([reveal, contentActive], ([opacity, active]: number[]) => opacity * (1 - active));
  const materialProgress = useTransform(halfWidth, (value) => {
    const target = renderLayout(stageSizeRef.current.width, stageSizeRef.current.height).panelWidth / 2;
    return clamp(
      (value - TRIGGER_RADIUS * scale) / Math.max(1, target - TRIGGER_RADIUS * scale),
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
    liquidContentOptics(values as number[], renderLayout(stageSizeRef.current.width, stageSizeRef.current.height)));
  const contentRefraction = useTransform(contentOptics, (optics) => optics.refraction);
  const contentBlur = useTransform(() => Math.max(contentOptics.get().blur, closingBlur.get()));
  const contentFilter = useTransform(contentBlur, (blur) => `blur(${blur}px)`);
  // Render in the original menu coordinates; the CSS size and render ratio scale
  // together, preserving optical depth, shadow, AA and the original trajectory.
  const fusionBlobs = useMemo(
    () => [
      {
        x: centerX,
        y: centerY,
        radius: rawCornerRadius,
        halfWidth: rawHalfWidth,
        halfHeight: rawHalfHeight,
        cornerRadius: rawCornerRadius,
        velocityX: rawMenuVelocityX,
        velocityY: rawMenuVelocityY,
      },
      {
        x: buttonCenterX,
        y: buttonCenterY,
        radius: rawButtonHalf,
        halfWidth: rawButtonHalf,
        halfHeight: rawButtonHalf,
        cornerRadius: rawButtonHalf,
        velocityX: rawButtonVelocityX,
        velocityY: rawButtonVelocityY,
      },
    ],
    [
      centerX,
      centerY,
      rawCornerRadius,
      rawHalfHeight,
      rawHalfWidth,
      rawMenuVelocityX,
      rawMenuVelocityY,
      buttonCenterX,
      buttonCenterY,
      rawButtonHalf,
      rawButtonVelocityX,
      rawButtonVelocityY,
    ],
  );
  const contentPose = useTransform(
    [rightEdge, bottomEdge, halfWidth, halfHeight, cornerRadius, menuVelocityX, menuVelocityY],
    (values) => liquidContentPose(values as number[], renderLayout(stageSizeRef.current.width, stageSizeRef.current.height)),
  );
  const contentTransform = useTransform(contentPose, (pose) => pose.transform);
  const contentClip = useTransform(contentPose, (pose) => pose.clipPath);

  useEffect(() => {
    if (contentActive.get()) captureContent();
  }, [captureContent, contentActive, children, stageSize, theme]);

  useEffect(() => {
    const owner = stageRef.current;
    if (!owner) return;
    return createLiquidBackdrop(owner, () => owner.getBoundingClientRect(), canvas => {
      fusionSourceRef.current = canvas;
      setFusionSourceRevision(revision => revision + 1);
    }).dispose;
  }, [stageSize.height, stageSize.width, theme]);

  const layout = renderLayout(stageSize.width, stageSize.height);

  return (
    <div ref={stageRef} className={["dg-liquid-glass", size === "small" && "dg-liquid-glass--small", className].filter(Boolean).join(" ")} data-liquid-theme={theme}>
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
          mergeDistance={rawMergeDistance}
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
          pixelRatio={2 * scale}
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
          width: TRIGGER_RADIUS * 2 * scale,
          height: TRIGGER_RADIUS * 2 * scale,
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

/** The original liquid menu, at component-library density. */
export function GlassMorphMenu(props: LiquidMenuProps) {
  return <LiquidMenu {...props} size={props.size ?? "small"} />;
}
