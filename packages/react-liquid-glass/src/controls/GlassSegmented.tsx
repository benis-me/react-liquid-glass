import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { LiquidGlass as Glass, LIQUID_LENS } from "../liquid-glass/LiquidGlass";
import { GlassSurface } from "./GlassSurface";
import type { LensParams } from "../types";
import { springTo, useGlassContact, usePointerReleaseFallback, waitForRest, useDerivedMotion, useDerivedMotion2, useVelocityDeformation, type SpringRun } from "../apple-motion/react";
import { SEGMENTED_TRAVEL_SPRING, SEGMENTED_PRESS_SPRING, SEGMENTED_DRAG_CATCHUP_SPRING, SEGMENTED_RELEASE_SPRING, SEGMENTED_HEIGHT_RELEASE_SPRING, SEGMENTED_IMPACT_RETENTION, SEGMENTED_TRAIL_BIAS, SEGMENTED_HOLD_IMPACT_SCRIPT } from "../apple-motion/presets";

function darkTheme() {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
}

type IconProps = { className?: string };
const IconFrame = ({ className, children }: IconProps & { children: ReactNode }) => <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">{children}</svg>;
const HubsIcon = memo(({ className }: IconProps) => {
  const id = useId();
  return <IconFrame className={className}><defs><mask id={id}><rect width="16" height="16" fill="white"/><path d="M9.998 3.79a1 1 0 0 1 1 0l2.899 1.674a1 1 0 0 1 .5.866v3.347a1 1 0 0 1-.5.866l-2.899 1.674a1 1 0 0 1-1 0L7.1 10.543a1 1 0 0 1-.5-.866V6.33a1 1 0 0 1 .5-.866L9.998 3.79Z" fill="black" stroke="black" strokeWidth="3" strokeLinejoin="round"/></mask></defs><path d="M4.902 2.948a1.2 1.2 0 0 1 1.2 0L9.58 4.956a1.2 1.2 0 0 1 .6 1.04v4.016a1.2 1.2 0 0 1-.6 1.04L6.102 13.06a1.2 1.2 0 0 1-1.2 0l-3.479-2.008a1.2 1.2 0 0 1-.6-1.04V5.996a1.2 1.2 0 0 1 .6-1.04l3.479-2.008Z" fill="var(--dg-icon-color-1)" mask={`url(#${id})`}/><path d="M9.998 3.79a1 1 0 0 1 1 0l2.899 1.674a1 1 0 0 1 .5.866v3.347a1 1 0 0 1-.5.866l-2.899 1.674a1 1 0 0 1-1 0L7.1 10.543a1 1 0 0 1-.5-.866V6.33a1 1 0 0 1 .5-.866L9.998 3.79Z" fill="var(--dg-icon-color-2)"/></IconFrame>;
});
const SpokesIcon = memo(({ className }: IconProps) => <IconFrame className={className}><path d="M5.053 2.219c-.185-.365-.041-.815.34-.962a7.3 7.3 0 0 1 4.346-.274c.397.099.596.527.458.912l-.355.987c-.139.385-.563.578-.965.501a4.1 4.1 0 0 0-2.327.147c-.39.126-.835-.013-1.02-.377l-.477-.934ZM10.945 13.782c.185.364.041.814-.34.961a7.3 7.3 0 0 1-4.346.274c-.397-.099-.596-.527-.458-.912l.355-.987c.139-.385.563-.578.965-.501a4.1 4.1 0 0 0 2.327-.147c.39-.126.835.013 1.02.377l.477.935ZM1.52 7.66c-.409-.02-.727-.37-.664-.775a7.3 7.3 0 0 1 1.937-3.9c.284-.295.754-.253 1.018.059l.677.801c.264.313.22.777-.048 1.087a4.1 4.1 0 0 0-1.037 2.089c-.085.4-.428.716-.836.694L1.52 7.66ZM11.534 2.559c.223-.343.684-.444 1.003-.187a7.3 7.3 0 0 1 2.41 3.627c.113.393-.159.78-.561.852l-1.032.186c-.403.073-.782-.198-.917-.584a4.1 4.1 0 0 0-1.791-1.943c-.304-.274-.406-.729-.183-1.072l.571-.879ZM14.48 8.34c.409.02.727.37.664.775a7.3 7.3 0 0 1-1.937 3.9c-.284.295-.754.253-1.018-.059l-.677-.801c-.264-.313-.22-.777.048-1.087a4.1 4.1 0 0 0 1.037-2.089c.085-.4.428-.716.836-.694l1.047.055ZM4.466 13.441c-.223.343-.684.444-1.003.187a7.3 7.3 0 0 1-2.41-3.627c-.113-.393.159-.78.561-.852l1.032-.186c.403-.073.782.198.917.584a4.1 4.1 0 0 0 1.291 1.943c.304.274.406.729.183 1.072l-.571.879Z" fill="var(--dg-icon-color-1)"/><circle cx="8" cy="8" r="3" fill="var(--dg-icon-color-2)"/></IconFrame>);
const ReservesIcon = memo(({ className }: IconProps) => {
  const id = useId();
  return <IconFrame className={className}><defs><mask id={id}><rect width="16" height="16" fill="white"/><circle cx="5.5" cy="6" r="5.125" fill="black" stroke="black" strokeWidth="3"/></mask></defs><circle cx="10.5" cy="10" r="4.5" fill="var(--dg-icon-color-2)" mask={`url(#${id})`}/><circle cx="5.5" cy="6" r="5.125" fill="var(--dg-icon-color-1)"/></IconFrame>;
});
const AssetsIcon = memo(({ className }: IconProps) => <IconFrame className={className}><path d="M7.97 15.015c-3.053 0-5.53-1.486-5.53-3.318v-.955c.299.281.63.529.978.737 1.225.736 2.838 1.15 4.553 1.15 1.714 0 3.327-.414 4.553-1.15.347-.208.678-.456.976-.737v.955c0 1.832-2.475 3.318-5.53 3.318ZM7.97 11.379c-3.053 0-5.53-1.485-5.53-3.318v-.954c.299.281.63.529.978.737 1.225.735 2.838 1.15 4.553 1.15 1.714 0 3.327-.415 4.553-1.15.347-.208.678-.456.976-.737v.954c0 1.833-2.475 3.318-5.53 3.318Z" fill="var(--dg-icon-color-1)"/><ellipse cx="7.97" cy="4.426" rx="5.53" ry="3.318" fill="var(--dg-icon-color-2)"/></IconFrame>);
const ChainsIcon = memo(({ className }: IconProps) => <IconFrame className={className}><circle cx="12.5" cy="8" r="2.5" fill="var(--dg-icon-color-1)"/><circle cx="4.5" cy="3.5" r="2.5" fill="var(--dg-icon-color-1)"/><circle cx="4.5" cy="12.5" r="2.5" fill="var(--dg-icon-color-1)"/><circle cx="8.377" cy="10.293" r="1.273" fill="var(--dg-icon-color-2)"/><circle cx="4.301" cy="8" r="1.273" fill="var(--dg-icon-color-2)"/><circle cx="8.377" cy="5.707" r="1.273" fill="var(--dg-icon-color-2)"/></IconFrame>);

const DEFAULT_SEGMENTS = [
  { value: "hubs", label: "中心", Icon: HubsIcon, color1: "#00aeff", color2: "#008aff" },
  { value: "spokes", label: "分支", Icon: SpokesIcon, color1: "#bdbbff", color2: "#9896ff" },
  { value: "reserves", label: "储备", Icon: ReservesIcon, color1: "#39beb7", color2: "#00827b" },
  { value: "assets", label: "资产", Icon: AssetsIcon, color1: "#ff8130", color2: "#f00" },
  { value: "chains", label: "网络", Icon: ChainsIcon, color1: "#ffd400", color2: "#ffb400" },
] as const;

const SEGMENTED_PAD_X = 80;
const SEGMENTED_PAD_Y = 80;
export interface GlassSegmentItem { value: string; label: string; href?: string; Icon?: ComponentType<{ className?: string }>; color1?: string; color2?: string; }
export interface GlassSegmentedProps {
  items?: readonly GlassSegmentItem[];
  tablist?: boolean;
  idPrefix?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onNavigate?: (href: string) => void;
  className?: string;
  labels?: Partial<Record<string, string>>;
  ariaLabel?: string;
}

export function GlassSegmented({ value, defaultValue = "hubs", onValueChange, onNavigate, className, labels, items: suppliedItems, tablist = false, idPrefix, ariaLabel = "选项" }: GlassSegmentedProps) {
  const reduce = useReducedMotion();
  const segments = useMemo<readonly GlassSegmentItem[]>(() => suppliedItems?.length ? suppliedItems.map(item => ({ color1: "currentColor", color2: "currentColor", ...item })) : DEFAULT_SEGMENTS, [suppliedItems]);
  const [local, setLocal] = useState(defaultValue);
  const current = value ?? local;
  const hasLinks = segments.some(item => item.href);
  const selected = segments.some((item) => item.value === current) ? current : hasLinks ? "" : segments[0].value;
  const rootRef = useRef<HTMLDivElement>(null);
  const contact = useGlassContact(rootRef, { deform: false });
  const solidThumbRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement | HTMLAnchorElement>());
  const dragPointer = useRef<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffsetX = useRef(0);
  const dragClientX = useRef(0);
  const dragMoved = useRef(false);
  const suppressDragClick = useRef(false);
  const releaseTimer = useRef<number | null>(null);
  const impactTargetX = useRef(0.5);
  const impactDirection = useRef(0);
  const impactLanded = useRef(false);
  const impactKickRef = useRef<(impulse: number) => void>(() => undefined);
  const impactWidth = useRef(1);
  const selectedRef = useRef(selected);
  if (!hasLinks || dragPointer.current === null) selectedRef.current = selected;
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const lensW = useMotionValue(50);
  const lensH = useMotionValue(20);
  const interaction = useMotionValue(0);
  const glassOpacity = useMotionValue(0);
  const solidOpacity = useMotionValue(1);
  const glassHeight = useMotionValue(0);
  const pointerX = useMotionValue(0);
  const dragCatchup = useMotionValue(0);
  const stationaryPress = () => dragPointer.current !== null && !dragMoved.current;
  const { deformation, kick: kickDeformation } = useVelocityDeformation(pointerX, {
    target: (speed) => {
      const direction = impactDirection.current;
      const trackingPointer = dragPointer.current !== null && dragMoved.current;
      if (!trackingPointer && direction !== 0) {
        if (!impactLanded.current && (x.get() - impactTargetX.current) * direction >= 0) {
          impactLanded.current = true;
          if (stationaryPress()) impactKickRef.current(SEGMENTED_HOLD_IMPACT_SCRIPT.impulse);
        }
        if (impactLanded.current) return 0;
      }
      return Math.min(0.18, speed ** 0.62 * 0.0045);
    },
    stiffness: () => impactLanded.current && stationaryPress() ? SEGMENTED_HOLD_IMPACT_SCRIPT.stiffness : 210,
    damping: () => {
      if (!impactLanded.current) return 26;
      if (stationaryPress()) return SEGMENTED_HOLD_IMPACT_SCRIPT.damping;
      return 30;
    },
  });
  impactKickRef.current = kickDeformation;
  const impactX = useDerivedMotion2(x, deformation, (position, amount) => {
    const direction = impactDirection.current;
    if (direction === 0) return position;
    const target = impactTargetX.current;
    const overshoot = (position - target) * direction;
    const retainedOvershoot = impactLanded.current || overshoot > 0 ? overshoot * SEGMENTED_IMPACT_RETENTION : overshoot;
    const softened = target + direction * retainedOvershoot;
    const velocityStretch = lensW.get() * (1 + interaction.get() * 0.10) * Math.max(0, amount) * 0.75;
    return softened - direction * velocityStretch * SEGMENTED_TRAIL_BIAS / Math.max(1, impactWidth.current);
  });
  const stretchedLensW = useDerivedMotion2(lensW, deformation, (width, amount) => width * (1 + amount * 0.75));
  const stretchedLensH = useDerivedMotion2(lensH, deformation, (height, amount) => height * (1 - amount * 0.52));
  const renderedLensW = useDerivedMotion2(stretchedLensW, interaction, (width, amount) => width * (1 + amount * 0.10));
  const contactX = useDerivedMotion2(contact.contactX, impactX, (fraction, position) => ((fraction + 1) * (impactWidth.current - SEGMENTED_PAD_X * 2) / 2 + SEGMENTED_PAD_X - position * impactWidth.current) / renderedLensW.get());
  const expandedLensH = useDerivedMotion2(stretchedLensH, interaction, (height, amount) => height * (1 + amount * 0.22));
  const heightBoost = useDerivedMotion2(glassHeight, deformation, (active, amount) =>
    active * (0.18 - Math.min(0.10, Math.max(0, amount) * 0.55)));
  const minimumGlassH = useDerivedMotion2(lensH, heightBoost, (height, boost) => height * (1 + boost));
  const renderedLensH = useDerivedMotion2(expandedLensH, minimumGlassH, (height, minimum) => Math.max(height, minimum));
  const zoom = useDerivedMotion(deformation, (amount) => 1 + amount * 0.55);
  const boostedDepth = useDerivedMotion2(deformation, interaction, (amount, pressed) => 2.5 * (1 + amount * 0.7 + pressed * 0.08));
  const stops = useRef<SpringRun[]>([]);
  const interactionStop = useRef<SpringRun | null>(null);
  const heightStop = useRef<SpringRun | null>(null);
  const glassAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const solidAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const dragCatchupAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const transitionToken = useRef(0);
  const travelSettled = useRef<Promise<void>>(Promise.resolve());

  const updateSolidThumb = (targetValue: string) => {
    const item = itemRefs.current.get(targetValue);
    const thumb = solidThumbRef.current;
    if (!item || !thumb || item.offsetParent === null) return;
    thumb.style.width = `${item.offsetWidth}px`;
    thumb.style.height = `${item.offsetHeight}px`;
    thumb.style.transform = `translate3d(${item.offsetLeft}px, ${item.offsetTop}px, 0)`;
  };
  const updateGeometry = (targetValue = selectedRef.current, instant = false) => {
    const root = rootRef.current;
    let item = itemRefs.current.get(targetValue);
    if (!root || (hasLinks && !targetValue)) return Promise.resolve();
    if (!item || item.offsetParent === null) {
      const firstVisible = segments.map((segment) => ({ segment, node: itemRefs.current.get(segment.value) })).find(({ node }) => node?.offsetParent != null);
      if (firstVisible && firstVisible.segment.value !== targetValue) {
        selectedRef.current = firstVisible.segment.value;
        if (value === undefined) setLocal(firstVisible.segment.value);
        onValueChange?.(firstVisible.segment.value);
      }
      return Promise.resolve();
    }
    updateSolidThumb(targetValue);
    const rootRect = root.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const expanded = {
      left: rootRect.left - SEGMENTED_PAD_X,
      top: rootRect.top - SEGMENTED_PAD_Y,
      width: rootRect.width + SEGMENTED_PAD_X * 2,
      height: rootRect.height + SEGMENTED_PAD_Y * 2,
    };
    const nextX = (itemRect.left + itemRect.width / 2 - expanded.left) / expanded.width;
    const nextY = (itemRect.top + itemRect.height / 2 - expanded.top) / expanded.height;
    const nextDirection = Math.sign(nextX - x.get());
    impactTargetX.current = nextX;
    impactLanded.current = false;
    impactWidth.current = expanded.width;
    if (nextDirection !== 0) impactDirection.current = nextDirection;
    stops.current.forEach((run) => run.stop());
    stops.current = [];
    if (instant || reduce) {
      impactDirection.current = 0;
      x.set(nextX); y.set(nextY); lensW.set(itemRect.width / 2); lensH.set(itemRect.height / 2);
      return Promise.resolve();
    } else {
      const runs = [
        springTo(x, nextX, SEGMENTED_TRAVEL_SPRING),
        springTo(y, nextY, SEGMENTED_TRAVEL_SPRING),
        springTo(lensW, itemRect.width / 2, SEGMENTED_TRAVEL_SPRING),
        springTo(lensH, itemRect.height / 2, SEGMENTED_TRAVEL_SPRING),
      ];
      stops.current = runs;
      return Promise.all(runs.map((run) => run.finished)).then(() => undefined);
    }
  };
  const updateGeometryRef = useRef(updateGeometry);
  updateGeometryRef.current = updateGeometry;

  const mounted = useRef(false);
  useLayoutEffect(() => {
    updateSolidThumb(selected);
    if (dragPointer.current === null) updateGeometry(selected, !mounted.current);
    mounted.current = true;
  }, [selected]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      if (dragPointer.current === null) updateGeometryRef.current(selectedRef.current, true);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    return x.on("change", (position) => {
      const root = rootRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const expandedLeft = rootRect.left - SEGMENTED_PAD_X;
      const expandedWidth = rootRect.width + SEGMENTED_PAD_X * 2;
      pointerX.set(expandedLeft + position * expandedWidth);
    });
  }, [x, pointerX]);
  useEffect(() => () => {
    transitionToken.current++;
    stops.current.forEach((run) => run.stop());
    interactionStop.current?.stop();
    heightStop.current?.stop();
    glassAnimation.current?.stop();
    solidAnimation.current?.stop();
    dragCatchupAnimation.current?.stop();
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
  }, []);

  const choose = (next: string) => {
    if (next === selectedRef.current) return;
    selectedRef.current = next;
    updateSolidThumb(next);
    if (dragPointer.current !== null) {
      const item = itemRefs.current.get(next);
      if (item) {
        lensW.set(item.getBoundingClientRect().width / 2);
        lensH.set(item.getBoundingClientRect().height / 2);
      }
    }
    if (value === undefined) setLocal(next);
    onValueChange?.(next);
  };

  const nearestSegment = (clientX: number) => {
    let nearest: { value: string; rect: DOMRect; distance: number } | null = null;
    for (const segment of segments) {
      const item = itemRefs.current.get(segment.value);
      if (!item || item.offsetParent === null) continue;
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (!nearest || distance < nearest.distance) nearest = { value: segment.value, rect, distance };
    }
    return nearest;
  };
  const trackLens = (clientX: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const expandedLeft = rootRect.left - SEGMENTED_PAD_X;
    const expandedWidth = rootRect.width + SEGMENTED_PAD_X * 2;
    const visible = segments.flatMap((segment) => {
      const item = itemRefs.current.get(segment.value);
      if (!item || item.offsetParent === null) return [];
      return [{ value: segment.value, rect: item.getBoundingClientRect() }];
    });
    if (visible.length === 0) return;
    const firstCenter = visible[0].rect.left + visible[0].rect.width / 2;
    const last = visible[visible.length - 1].rect;
    const lastCenter = last.left + last.width / 2;
    const centerX = Math.max(firstCenter, Math.min(lastCenter, clientX - dragOffsetX.current - dragCatchup.get()));
    const nextX = (centerX - expandedLeft) / expandedWidth;
    const nextDirection = Math.sign(nextX - x.get());
    impactTargetX.current = nextX;
    impactLanded.current = false;
    impactWidth.current = expandedWidth;
    if (nextDirection !== 0) impactDirection.current = nextDirection;
    pointerX.set(centerX);
    x.set(nextX);
  };
  const moveDrag = (clientX: number) => {
    dragClientX.current = clientX;
    const centerX = clientX - dragOffsetX.current - dragCatchup.get();
    const nearest = nearestSegment(centerX);
    if (nearest) choose(nearest.value);
    trackLens(clientX);
  };
  const stopDragCatchup = () => {
    dragCatchupAnimation.current?.stop();
    dragCatchupAnimation.current = null;
    dragCatchup.set(0);
  };
  const startDragCatchup = (clientX: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const expandedLeft = rootRect.left - SEGMENTED_PAD_X;
    const expandedWidth = rootRect.width + SEGMENTED_PAD_X * 2;
    const currentCenter = expandedLeft + x.get() * expandedWidth;
    dragClientX.current = clientX;
    dragOffsetX.current = 0;
    dragCatchupAnimation.current?.stop();
    dragCatchup.set(clientX - currentCenter);
    dragCatchupAnimation.current = animate(dragCatchup, 0, {
      type: "spring",
      ...SEGMENTED_DRAG_CATCHUP_SPRING,
      velocity: 0,
      restDelta: 0.1,
      restSpeed: 1,
      onUpdate: () => moveDrag(dragClientX.current),
    });
  };
  const releaseInteraction = (delay = 0, settle = true) => {
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
    if (delay > 0) {
      releaseTimer.current = window.setTimeout(() => {
        releaseTimer.current = null;
        releaseInteraction(0, settle);
      }, delay);
      return;
    }
    const token = ++transitionToken.current;
    interactionStop.current?.stop();
    const shape = springTo(interaction, 0, SEGMENTED_RELEASE_SPRING);
    interactionStop.current = shape;
    heightStop.current?.stop();
    const height = springTo(glassHeight, 0, SEGMENTED_HEIGHT_RELEASE_SPRING);
    heightStop.current = height;
    const travel = settle ? updateGeometry(selectedRef.current, false) : travelSettled.current;
    if (settle) travelSettled.current = travel;
    // Fade in the visual spring tail, not after several mathematical rest waits.
    // Pixel-space error also prevents a zero crossing from cutting off the recoil.
    void waitForRest([renderedLensW, renderedLensH, impactX, deformation, interaction, glassHeight], () => Math.max(
      Math.abs(renderedLensW.get() - lensW.get()),
      Math.abs(renderedLensH.get() - lensH.get()),
      Math.abs(impactX.get() - impactTargetX.current) * impactWidth.current,
      Math.abs(x.getVelocity()) * impactWidth.current * SEGMENTED_IMPACT_RETENTION * .02,
    ))
      .then(() => {
        if (token !== transitionToken.current) return;
        glassAnimation.current?.stop();
        solidAnimation.current?.stop();
        solidOpacity.set(1);
        rootRef.current?.setAttribute("data-crossfading", "");
        const fade = animate(glassOpacity, 0, { duration: 0.12, ease: [0.22, 1, 0.36, 1] });
        glassAnimation.current = fade;
        return fade.then(() => {
          if (token === transitionToken.current) {
            rootRef.current?.removeAttribute("data-interacting");
            rootRef.current?.removeAttribute("data-crossfading");
          }
        });
      });
  };
  const finishDrag = (pointerId: number, target: HTMLDivElement) => {
    if (dragPointer.current !== pointerId) return;
    dragPointer.current = null;
    disarmPointerFallback();
    stopDragCatchup();
    try { target.releasePointerCapture(pointerId); } catch {}
    releaseInteraction(0, dragMoved.current);
    if (dragMoved.current) {
      suppressDragClick.current = true;
      requestAnimationFrame(() => { suppressDragClick.current = false; });
    }
  };
  const { arm: armPointerFallback, disarm: disarmPointerFallback } = usePointerReleaseFallback(() => {
    if (dragPointer.current === null) return;
    dragPointer.current = null;
    stopDragCatchup();
    releaseInteraction(0, dragMoved.current);
  });
  const lens: Partial<LensParams> = {
    ...LIQUID_LENS, lensW: 50, lensH: 20, borderRadius: 16, depth: 2.5, domeDepth: 8,
    chromaAmount: .24, edgeWidth: .9, brightness: darkTheme() ? .035 : .015,
  };

  const items = (interactive: boolean, refracted = false) => segments.map((segment) => {
    const { value: itemValue, label, Icon, color1, color2 } = segment;
    const href = segment.href;
    const Item = interactive && href ? "a" : "button";
    const displayLabel = labels?.[itemValue] ?? label;
    return <Item
      key={itemValue}
      ref={interactive ? (node: HTMLButtonElement | HTMLAnchorElement | null) => { if (node) itemRefs.current.set(itemValue, node); else itemRefs.current.delete(itemValue); } : undefined}
      type={href ? undefined : "button"}
      href={interactive ? href : undefined}
      role={interactive && !href ? (tablist ? "tab" : "radio") : undefined}
      aria-current={interactive && href && selected === itemValue ? "page" : undefined}
      aria-hidden={!interactive || undefined}
      id={interactive && idPrefix ? `${idPrefix}-${itemValue}` : undefined}
      aria-controls={interactive && tablist && idPrefix ? `${idPrefix}-panel-${itemValue}` : undefined}
      aria-selected={interactive && !href && tablist ? selected === itemValue : undefined}
      aria-checked={interactive && !href && !tablist ? selected === itemValue : undefined}
      tabIndex={interactive && (href || selected === itemValue) ? 0 : -1}
      data-value={itemValue}
      data-selected={selected === itemValue ? "" : undefined}
      className={["dg-tabs__item", refracted ? "dg-tabs__item--overlay" : ""].filter(Boolean).join(" ")}
      style={{
        "--dg-icon-color-1": refracted ? color1 : "#bcbbbb",
        "--dg-icon-color-2": refracted ? color2 : "#8f8f8f",
        "--dg-icon-active-1": color1,
        "--dg-icon-active-2": color2,
      } as React.CSSProperties}
      onClick={interactive ? (event) => {
        if (suppressDragClick.current) { event.preventDefault(); return; }
        if (href && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
        choose(itemValue);
        if (href && onNavigate) { event.preventDefault(); onNavigate(href); }
      } : undefined}
    >{Icon && <Icon className="dg-tabs__icon"/>}<span>{displayLabel}</span></Item>;
  });

  return (
    <div ref={rootRef} data-custom={suppliedItems ? "true" : undefined} className={["dg-tabs", className].filter(Boolean).join(" ")}>
      <GlassSurface className="dg-tabs__container" radius={999} />
      <div
        className="dg-tabs__group"
        role={hasLinks ? "group" : tablist ? "tablist" : "radiogroup"}
        aria-label={ariaLabel}
        onPointerDown={(event) => {
          if ((event.pointerType === "mouse" && event.button !== 0) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || dragPointer.current !== null) return;
          if (reduce) return;
          const nearest = nearestSegment(event.clientX);
          if (!nearest) return;
          dragStart.current = { x: event.clientX, y: event.clientY };
          stopDragCatchup();
          dragOffsetX.current = event.clientX - (nearest.rect.left + nearest.rect.width / 2);
          dragMoved.current = false;
          if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current);
          transitionToken.current += 1;
          rootRef.current?.setAttribute("data-interacting", "");
          rootRef.current?.removeAttribute("data-crossfading");
          heightStop.current?.stop();
          glassHeight.set(1);
          glassAnimation.current?.stop();
          glassAnimation.current = animate(glassOpacity, 1, { duration: 0.1, ease: [0.22, 1, 0.36, 1] });
          solidAnimation.current?.stop();
          solidAnimation.current = animate(solidOpacity, 0, { duration: 0.1, ease: [0.22, 1, 0.36, 1] });
          interactionStop.current?.stop();
          interactionStop.current = springTo(interaction, 1, SEGMENTED_PRESS_SPRING);
          choose(nearest.value);
          travelSettled.current = updateGeometry(nearest.value, hasLinks && !selected);
          dragPointer.current = event.pointerId;
          armPointerFallback(event.pointerId);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.pointerId !== dragPointer.current) return;
          if (!dragMoved.current && Math.hypot(event.clientX - dragStart.current.x, event.clientY - dragStart.current.y) > 2) {
            dragMoved.current = true;
            stops.current.forEach((run) => run.stop());
            stops.current = [];
            startDragCatchup(event.clientX);
          }
          if (!dragMoved.current) return;
          moveDrag(event.clientX);
          event.preventDefault();
        }}
        onPointerUp={(event) => {
          if (event.pointerId !== dragPointer.current) return;
          if (dragMoved.current) moveDrag(event.clientX);
          const destination = hasLinks ? segments.find(item => item.value === selectedRef.current)?.href : undefined;
          finishDrag(event.pointerId, event.currentTarget);
          if (destination) {
            suppressDragClick.current = true;
            requestAnimationFrame(() => { suppressDragClick.current = false; });
            if (onNavigate) onNavigate(destination); else window.location.assign(destination);
          }
        }}
        onPointerCancel={(event) => finishDrag(event.pointerId, event.currentTarget)}
        onLostPointerCapture={(event) => {
          if (event.pointerId === dragPointer.current) {
            dragPointer.current = null;
            stopDragCatchup();
            releaseInteraction(0, dragMoved.current);
          }
        }}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const focused = (event.target as HTMLElement).closest<HTMLElement>(".dg-tabs__item")?.dataset.value;
          const index = segments.findIndex((item) => item.value === (hasLinks ? focused : selected));
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? segments.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + segments.length) % segments.length;
          const next = segments[nextIndex];
          if (!hasLinks) choose(next.value);
          requestAnimationFrame(() => itemRefs.current.get(next.value)?.focus());
        }}
      >
        <motion.span ref={solidThumbRef} className="dg-tabs__solid-thumb" aria-hidden style={{ opacity: selected ? solidOpacity : 0 }} />
        {items(true)}
      </div>
      <motion.div className="dg-tabs__glass-layer" aria-hidden style={{ opacity: glassOpacity }}>
        <Glass
          contact={{ ...contact, contactX }}
          className="dg-tabs__glass"
          backdropRoot={rootRef}
          refractionPixels={5.5}
          lens={lens}
          x={impactX}
          y={y}
          lensW={renderedLensW}
          lensH={renderedLensH}
          autoBorderRadius
          zoom={zoom}
          depth={boostedDepth}
          style={{
            position: "absolute",
            inset: 0,
            padding: `${SEGMENTED_PAD_Y}px ${SEGMENTED_PAD_X}px`,
            margin: `-${SEGMENTED_PAD_Y}px -${SEGMENTED_PAD_X}px`,
            boxSizing: "content-box",
          }}
          refractionTarget={<div className="dg-tabs__overlay"><div className="dg-tabs__group dg-tabs__group--overlay">{items(false, true)}</div></div>}
        >
          <div className="dg-tabs__group dg-tabs__group--glass-base">{items(false)}</div>
        </Glass>
      </motion.div>
    </div>
  );
}
