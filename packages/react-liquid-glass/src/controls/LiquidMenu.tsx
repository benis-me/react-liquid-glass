import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { LiquidGlassCanvas } from "../liquid-glass/LiquidGlassCanvas.js";
import { liquidContentPose, liquidContentOptics, liquidSurfaceBlur, liquidThickness } from "../liquid-glass/geometry.js";
import { paintLiquidMenuContent } from "../liquid-glass/menu-content.js";
import { createLiquidBackdrop } from "../liquid-glass/backdrop.js";
import { useMenuMotion, type MenuLayout } from "../apple-motion/use-menu-motion.js";
import { TRIGGER_RADIUS } from "../apple-motion/menu.js";
import { useMenuMaterial } from "./use-menu-material.js";
import { DARK_GLASS_TINT, THIN_GLASS, glassEdgeDepth, useGlassThickness } from "./glass-thickness.js";
import { useGlassContact } from "../apple-motion/use-glass-contact.js";
import { ScrollArea } from "./ScrollArea.js";
import { moveMenuFocus } from "./menu-keys.js";
import { useGlassMaterialOverrides } from "../liquid-glass/provider.js";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const menuId = useId();
  const fusionSourceRef = useRef<HTMLCanvasElement>(null);
  const contentSourceRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fusionSourceRevision = useMotionValue(0);
  const contentActive = useMotionValue(0);
  const contentRevision = useMotionValue(0);
  const { depth, tintOpacity, zoom, closingBlur, transition } = useMenuMaterial();
  // The menu follows the shared thickness rule, not the ordinary-glass defaults; explicit host values still apply.
  const materialOverrides = useGlassMaterialOverrides();
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
  // The live body sets the glass thickness: the closed trigger is a compact control, the open menu thick glass.
  const thickness = useTransform([halfWidth, halfHeight], ([width, height]: number[]) => liquidThickness(width * 2, height * 2));
  const { tintStrength: _thicknessTint, magnification: _thicknessZoom, ...material } = useGlassThickness(thickness, theme === "dark", materialOverrides, scale);
  // Frost matches popups of the same CSS size; the canvas draws in menu units.
  const materialBlur = useTransform([halfWidth, halfHeight], ([width, height]: number[]) => liquidSurfaceBlur(width * 2, height * 2) / scale);
  // The morph's own depth, tint and zoom ride on the thick end, so a closed trigger rests as thin glass.
  const thinDepth = glassEdgeDepth(TRIGGER_RADIUS * 2, 0);
  const materialDepth = useTransform([thickness, depth], ([t, value]: number[]) => thinDepth + (value - thinDepth) * t);
  const materialTintOpacity = useTransform([thickness, tintOpacity], ([t, value]: number[]) => THIN_GLASS.tintStrength + (value - THIN_GLASS.tintStrength) * t);
  const materialZoom = useTransform([thickness, zoom], ([t, value]: number[]) => 1 + (value - 1) * t);
  // Pressing the trigger lights it where it is touched, as every other glass button does.
  const contact = useGlassContact(triggerRef, { deform: false });
  // Refraction scales with each body's own size (the body plus 28 CSS px, as Button's does), not the stage's;
  // the panel keeps the stage scale it was calibrated at.
  const triggerOptics = TRIGGER_RADIUS * 2 + 28 / scale;
  const triggerRatioX = triggerOptics / Math.max(1, stageSize.width), triggerRatioY = triggerOptics / Math.max(1, stageSize.height);
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
        contactX: contact.contactX,
        contactY: contact.contactY,
        contactStrength: contact.contactStrength,
        refractionRatio: [triggerRatioX, triggerRatioY] as const,
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
      contact.contactX,
      contact.contactY,
      contact.contactStrength,
      triggerRatioX,
      triggerRatioY,
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
      fusionSourceRevision.set(fusionSourceRevision.get() + 1);
    }).dispose;
  }, [stageSize.height, stageSize.width, theme]);

  // Opening moves focus into the menu, onto its checked item when there is one, as other popups do.
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel || panel.contains(document.activeElement)) return;
    (panel.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel.querySelector<HTMLElement>("button:not([disabled])"))?.focus({ preventScroll: true });
  }, [open]);

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
          {...material}
          edgeDepth={materialDepth}
          tintColor={theme === "dark" ? DARK_GLASS_TINT : [1, 1, 1]}
          sourceRevision={fusionSourceRevision}
          pixelRatio={2 * scale}
          className="dg-liquid-menu__fusion-canvas"
          inheritMaterial={false}
          {...materialOverrides}
          // The morph animates these; a provider constant must not freeze them.
          blurStrength={materialBlur}
          tintStrength={materialTintOpacity}
          magnification={materialZoom}
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
        inert={!open}
        onKeyDown={moveMenuFocus}
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
        <ScrollArea className="dg-liquid-menu__scroll" contentClassName="dg-liquid-menu__scroll-content" viewportProps={{ tabIndex: open ? 0 : -1, "aria-label": menuLabel }}>
          {children(open)}
        </ScrollArea>
      </motion.div>
    </div>
  );
}

/** The original liquid menu, at component-library density. */
export function GlassMorphMenu(props: LiquidMenuProps) {
  return <LiquidMenu {...props} size={props.size ?? "small"} />;
}
