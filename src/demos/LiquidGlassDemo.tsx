import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronRight,
  Clock3,
  Ellipsis,
  Gamepad2,
  Grid2X2,
  Layers3,
  Network,
  Smartphone,
  UsersRound,
  WifiOff,
} from "lucide-react";
import {
  animate,
  cancelFrame,
  cubicBezier,
  frame,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import type { Locale } from "../i18n";
import type { LensParams } from "../lib";
import { LiquidGlassCanvas } from "../lib/LiquidGlassCanvas";
import { paintLiquidMenuContent } from "./liquid-menu-content";
import {
  CLOSE_FUSION_TIMES,
  OPEN_MORPH_TIMES,
  closeButtonFrames,
  closeMenuHeightFrames,
  closeMenuRadiusFrames,
  closeMenuWidthFrames,
  liquidContentPose,
  liquidContentOptics,
  liquidEasings,
  openHeightFrames,
  openRadiusFrames,
  openWidthFrames,
  retargetLiquidFrames,
} from "./liquid-menu-motion";

const TRIGGER_RADIUS = 34;
const MIN_LENS_HALF = 1;

const BASE_MENU_LENS: Partial<LensParams> = {
  domeDepth: 58,
  scaleX: 0.11,
  chromaAmount: 0.55,
  specularStrength: 0.72,
  specularRotation: 90,
  glowSpread: 0.72,
  glowExponent: 1.4,
  edgeWidth: 1.6,
  edgeExponent: 1.2,
};

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

const OPEN_MORPH_DURATION = 0.38;
const OPEN_CONTENT_DURATION = 0.34;
const CLOSE_CONTENT_DURATION = 0.24;
const CONTENT_MORPH_TIMES = [0, 0.1, 0.79, 1];
const OPEN_MORPH_EASES = [
  cubicBezier(0.42, 0, 0.58, 1),
  cubicBezier(0.32, 0, 0.18, 1),
  cubicBezier(0.22, 0, 0.18, 1),
];
const CLOSE_FUSION_DURATION = 0.42;
const CLOSE_IMPACT_DISTANCE = 2;
const CLOSE_FUSION_EASES = [
  cubicBezier(0.42, 0, 0.58, 1),
  cubicBezier(0.35, 0, 0.7, 0.7),
  cubicBezier(0.24, 0.2, 0.65, 0.72),
  cubicBezier(0.12, 0.12, 0.18, 1),
  cubicBezier(0.16, 0, 0.18, 1),
];
const PRESS_EASE = cubicBezier(0.3, 0, 0.2, 1);
const RELEASE_EASE = cubicBezier(0.16, 0.72, 0.18, 1);

const copy = {
  zh: {
    menu: "游戏排序与筛选菜单",
    open: "打开菜单",
    sortHeading: "排序",
    filterHeading: "筛选",
    recentDetail: "按日期降序",
    sorts: {
      recent: "最近玩过的游戏",
      name: "游戏名",
      size: "大小",
      updated: "上次更新",
    },
    filters: {
      device: "本机",
      unplayed: "从未玩过",
      friends: "在玩的朋友",
      controller: "控制器支持",
      subscription: "游戏订阅",
      category: "类别",
      offline: "离线可用",
      multiplayer: "多人游戏",
    },
  },
  en: {
    menu: "Game sorting and filter menu",
    open: "Open menu",
    sortHeading: "Sort",
    filterHeading: "Filter",
    recentDetail: "Newest first",
    sorts: {
      recent: "Recently played",
      name: "Game name",
      size: "Size",
      updated: "Last updated",
    },
    filters: {
      device: "On this device",
      unplayed: "Never played",
      friends: "Friends playing",
      controller: "Controller support",
      subscription: "Game subscription",
      category: "Categories",
      offline: "Available offline",
      multiplayer: "Multiplayer",
    },
  },
} as const;

type MenuCopy = (typeof copy)[Locale];
const SORT_OPTIONS = ["recent", "name", "size", "updated"] as const;
type SortId = (typeof SORT_OPTIONS)[number];

const FILTER_OPTIONS = [
  { id: "device", icon: Smartphone },
  { id: "unplayed", icon: Clock3 },
  { id: "friends", icon: UsersRound },
  { id: "controller", icon: Gamepad2 },
  { id: "subscription", icon: Layers3 },
  { id: "category", icon: Grid2X2, trailing: true },
  { id: "offline", icon: WifiOff },
  { id: "multiplayer", icon: Network },
] as const;

type FilterId = (typeof FILTER_OPTIONS)[number]["id"];

interface StageSize {
  width: number;
  height: number;
}

interface MenuLayout {
  panelLeft: number;
  panelTop: number;
  panelRight: number;
  panelBottom: number;
  panelWidth: number;
  panelHeight: number;
  panelRadius: number;
  triggerCenterX: number;
  triggerCenterY: number;
  triggerLeft: number;
  triggerTop: number;
}

interface AnimationControl {
  stop: () => void;
}

interface MenuContentsProps {
  text: MenuCopy;
  open: boolean;
  sort: SortId;
  filters: Set<FilterId>;
  onSort?: (id: SortId) => void;
  onFilter?: (id: FilterId) => void;
}

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

function directionToButton(layout: MenuLayout) {
  const dx = layout.triggerCenterX - (layout.panelLeft + layout.panelWidth / 2);
  const dy = layout.triggerCenterY - (layout.panelTop + layout.panelHeight / 2);
  const magnitude = Math.hypot(dx, dy) || 1;
  return { x: dx / magnitude, y: dy / magnitude };
}

function closeImpactVector(layout: MenuLayout) {
  const direction = directionToButton(layout);
  return {
    x: direction.x * CLOSE_IMPACT_DISTANCE,
    y: direction.y * CLOSE_IMPACT_DISTANCE,
  };
}

function closeContactCenter(
  layout: MenuLayout,
  menuHalfWidth: number,
  menuHalfHeight: number,
  buttonHalf: number,
  gap = 0,
) {
  const direction = directionToButton(layout);
  const menuReach = Math.sqrt(
    (menuHalfWidth * direction.x) ** 2 + (menuHalfHeight * direction.y) ** 2,
  );
  const distance = menuReach + buttonHalf + gap;
  return {
    x: layout.triggerCenterX - direction.x * distance,
    y: layout.triggerCenterY - direction.y * distance,
  };
}

function MenuContents({
  text,
  open,
  sort,
  filters,
  onSort,
  onFilter,
}: MenuContentsProps) {
  return (
    <div className="dg-liquid-menu__scroll">
      <p className="dg-liquid-menu__heading">{text.sortHeading}</p>
      <div className="dg-liquid-menu__section" role="group" aria-label={text.sortHeading}>
        {SORT_OPTIONS.map((id) => {
          const selected = sort === id;
          return (
            <button
              key={id}
              className="dg-liquid-menu__sort-row"
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              tabIndex={open ? 0 : -1}
              data-selected={selected ? "true" : "false"}
              onClick={() => onSort?.(id)}
            >
              <span className="dg-liquid-menu__check" aria-hidden="true">
                {selected ? <Check /> : null}
              </span>
              <span className="dg-liquid-menu__label-block">
                <span>{text.sorts[id]}</span>
                {id === "recent" ? <small>{text.recentDetail}</small> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="dg-liquid-menu__divider" />
      <p className="dg-liquid-menu__heading">{text.filterHeading}</p>
      <div className="dg-liquid-menu__section" role="group" aria-label={text.filterHeading}>
        {FILTER_OPTIONS.map(({ id, icon: Icon, ...option }) => {
          const active = filters.has(id);
          return (
            <button
              key={id}
              className="dg-liquid-menu__filter-row"
              type="button"
              role="menuitemcheckbox"
              aria-checked={active}
              tabIndex={open ? 0 : -1}
              data-active={active ? "true" : "false"}
              onClick={() => onFilter?.(id)}
            >
              <Icon aria-hidden="true" />
              <span>{text.filters[id]}</span>
              {"trailing" in option
                ? <ChevronRight className="dg-liquid-menu__chevron" aria-hidden="true" />
                : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LiquidGlassDemo({
  locale,
  theme,
}: {
  locale: Locale;
  theme: "light" | "dark";
}) {
  const text = copy[locale];
  const menuLens = theme === "dark" ? DARK_MENU_LENS : LIGHT_MENU_LENS;
  const menuId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fusionSourceRef = useRef<HTMLCanvasElement>(null);
  const contentSourceRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stageSizeRef = useRef<StageSize>({ width: 1, height: 1 });
  const animations = useRef<AnimationControl[]>([]);
  const transitionRevision = useRef(0);
  const focusTimer = useRef<number | null>(null);
  const openRef = useRef(false);
  const transitioningRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 1, height: 1 });
  const [fusionSourceRevision, setFusionSourceRevision] = useState(0);
  const [sort, setSort] = useState<SortId>("recent");
  const [filters, setFilters] = useState<Set<FilterId>>(() => new Set(["device"]));

  const rightEdge = useMotionValue(MIN_LENS_HALF * 2);
  const bottomEdge = useMotionValue(MIN_LENS_HALF * 2);
  const halfWidth = useMotionValue(MIN_LENS_HALF);
  const halfHeight = useMotionValue(MIN_LENS_HALF);
  const cornerRadius = useMotionValue(MIN_LENS_HALF);
  const centerX = useMotionValue(0.5);
  const centerY = useMotionValue(0.5);
  const depth = useMotionValue(10);
  const tintOpacity = useMotionValue(0.16);
  const zoom = useMotionValue(1.35);
  const reveal = useMotionValue(0);
  const contentActive = useMotionValue(0);
  const contentRevision = useMotionValue(0);
  const contentOpacity = useTransform([reveal, contentActive], ([opacity, active]: number[]) => opacity * active);
  const domContentOpacity = useTransform([reveal, contentActive], ([opacity, active]: number[]) => opacity * (1 - active));
  const triggerOpacity = useMotionValue(1);
  const triggerScale = useMotionValue(1);
  const buttonCenterX = useMotionValue(0.5);
  const buttonCenterY = useMotionValue(0.5);
  const triggerOffsetX = useTransform(buttonCenterX, (value) =>
    value * stageSizeRef.current.width - menuLayout(stageSizeRef.current.width, stageSizeRef.current.height).triggerCenterX);
  const triggerOffsetY = useTransform(buttonCenterY, (value) =>
    value * stageSizeRef.current.height - menuLayout(stageSizeRef.current.width, stageSizeRef.current.height).triggerCenterY);
  const buttonHalf = useMotionValue(TRIGGER_RADIUS);
  const buttonDepth = useMotionValue(10);
  const buttonTintOpacity = useMotionValue(0.16);
  const buttonZoom = useMotionValue(1.35);
  const menuVelocityX = useMotionValue(0);
  const menuVelocityY = useMotionValue(0);
  const buttonVelocityX = useMotionValue(0);
  const buttonVelocityY = useMotionValue(0);
  const mergeDistance = useMotionValue(0);
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
  const contentBlur = useTransform(contentOptics, (optics) => optics.blur);
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

  useEffect(() => {
    if (contentActive.get()) captureContent();
  }, [captureContent, contentActive, filters, locale, sort, stageSize, theme]);

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

  const stopAnimations = useCallback(() => {
    transitionRevision.current += 1;
    animations.current.forEach((control) => control.stop());
    animations.current = [];
  }, []);

  const clearFocusTimer = useCallback(() => {
    if (focusTimer.current === null) return;
    window.clearTimeout(focusTimer.current);
    focusTimer.current = null;
  }, []);

  useEffect(() => () => {
    stopAnimations();
    clearFocusTimer();
  }, [clearFocusTimer, stopAnimations]);

  const syncCenters = useCallback(() => {
    const { width, height } = stageSizeRef.current;
    centerX.set((rightEdge.get() - halfWidth.get()) / Math.max(1, width));
    centerY.set((bottomEdge.get() - halfHeight.get()) / Math.max(1, height));
    // During opening, park the fully absorbed button inside the growing body.
    // A visible button on an interrupted close keeps its live position instead.
    if (openRef.current && buttonHalf.get() <= MIN_LENS_HALF) {
      buttonCenterX.set(centerX.get());
      buttonCenterY.set(centerY.get());
    }
  }, [bottomEdge, buttonCenterX, buttonCenterY, buttonHalf, centerX, centerY, halfHeight, halfWidth, rightEdge]);

  useEffect(() => {
    const unsubscribe = [
      rightEdge.on("change", syncCenters),
      bottomEdge.on("change", syncCenters),
      halfWidth.on("change", syncCenters),
      halfHeight.on("change", syncCenters),
      buttonHalf.on("change", syncCenters),
    ];
    syncCenters();
    return () => unsubscribe.forEach((stop) => stop());
  }, [bottomEdge, buttonHalf, halfHeight, halfWidth, rightEdge, syncCenters]);

  useEffect(() => {
    const updateVelocity = () => {
      const moving = transitioningRef.current && !reduceMotion;
      const vx = moving ? rightEdge.getVelocity() - halfWidth.getVelocity() : 0;
      const vy = moving ? bottomEdge.getVelocity() - halfHeight.getVelocity() : 0;
      const speed = Math.hypot(vx, vy);
      const gain = Math.min(openRef.current ? 0.055 : 0.11, 180 / Math.max(1, speed));
      menuVelocityX.set(vx * gain);
      menuVelocityY.set(vy * gain);
      // Absorption deforms the anchored button; recoil cannot excite a new wave.
      const absorption = moving && !openRef.current
        ? Math.min(130, Math.max(0, buttonHalf.getVelocity()) * 0.9)
        : 0;
      const direction = directionToButton(menuLayout(stageSizeRef.current.width, stageSizeRef.current.height));
      buttonVelocityX.set(direction.x * absorption);
      buttonVelocityY.set(direction.y * absorption);
    };
    const schedule = () => frame.preRender(updateVelocity);
    const unsubscribe = [rightEdge, bottomEdge, halfWidth, halfHeight, buttonHalf]
      .map((value) => value.on("change", schedule));
    return () => {
      unsubscribe.forEach((stop) => stop());
      cancelFrame(updateVelocity);
    };
  }, [
    bottomEdge, buttonHalf, buttonVelocityX, buttonVelocityY, halfHeight, halfWidth,
    menuVelocityX, menuVelocityY, reduceMotion, rightEdge,
  ]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      };
      stageSizeRef.current = next;
      setStageSize((current) => current.width === next.width && current.height === next.height
        ? current
        : next);
      const layout = menuLayout(next.width, next.height);
      const expanded = openRef.current;
      const nextHalfWidth = expanded ? layout.panelWidth / 2 : MIN_LENS_HALF;
      const nextHalfHeight = expanded ? layout.panelHeight / 2 : MIN_LENS_HALF;
      const nextRight = expanded ? layout.panelRight : layout.triggerCenterX + MIN_LENS_HALF;
      const nextBottom = expanded ? layout.panelBottom : layout.triggerCenterY + MIN_LENS_HALF;
      halfWidth.jump(nextHalfWidth);
      halfHeight.jump(nextHalfHeight);
      cornerRadius.jump(expanded ? layout.panelRadius : MIN_LENS_HALF);
      rightEdge.jump(nextRight);
      bottomEdge.jump(nextBottom);
      centerX.jump((nextRight - nextHalfWidth) / next.width);
      centerY.jump((nextBottom - nextHalfHeight) / next.height);
      buttonCenterX.jump(expanded ? centerX.get() : layout.triggerCenterX / next.width);
      buttonCenterY.jump(expanded ? centerY.get() : layout.triggerCenterY / next.height);
      buttonHalf.jump(expanded ? MIN_LENS_HALF : TRIGGER_RADIUS);
    };

    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(stage);
    return () => observer.disconnect();
  }, [
    bottomEdge,
    buttonCenterX,
    buttonCenterY,
    buttonHalf,
    centerX,
    centerY,
    cornerRadius,
    halfHeight,
    halfWidth,
    rightEdge,
  ]);

  const setExpanded = useCallback((nextOpen: boolean, restoreFocus = false) => {
    if (openRef.current === nextOpen) return;
    const interrupted = transitioningRef.current;
    // Snapshot only at a transition boundary; every animated frame reuses the texture.
    if (!reduceMotion && !interrupted) contentActive.set(captureContent() ? 1 : 0);
    clearFocusTimer();
    stopAnimations();
    const revision = transitionRevision.current;
    openRef.current = nextOpen;
    setOpen(nextOpen);
    if (nextOpen) triggerRef.current?.blur();

    const size = stageSizeRef.current;
    const layout = menuLayout(size.width, size.height);
    const target = nextOpen
      ? {
          right: layout.panelRight,
          bottom: layout.panelBottom,
          halfWidth: layout.panelWidth / 2,
          halfHeight: layout.panelHeight / 2,
          radius: layout.panelRadius,
          depth: 26,
          tint: 0.035,
          zoom: 1.38,
        }
      : {
          right: layout.triggerCenterX + MIN_LENS_HALF,
          bottom: layout.triggerCenterY + MIN_LENS_HALF,
          halfWidth: MIN_LENS_HALF,
          halfHeight: MIN_LENS_HALF,
          radius: MIN_LENS_HALF,
          depth: 10,
          tint: 0.16,
          zoom: 1.35,
        };
    const buttonTarget = nextOpen
      ? { half: MIN_LENS_HALF, depth: 10, tint: 0, zoom: 1 }
      : {
          half: TRIGGER_RADIUS,
          depth: 10,
          tint: 0.16,
          zoom: 1.35,
        };

    const morph = (value: MotionValue<number>, keyframes: number[], positive = false) => {
      const duration = nextOpen ? OPEN_MORPH_DURATION : CLOSE_FUSION_DURATION;
      // The initial Hermite tangent peaks at 4/27; keep shrinking extents above zero.
      const velocity = positive
        ? Math.max(value.getVelocity(), -(value.get() - MIN_LENS_HALF) * 6.75 / duration)
        : value.getVelocity();
      // A reversal starts at the live shape and velocity, not at the press/swell pose.
      let { values, times } = interrupted
        ? retargetLiquidFrames(value.get(), keyframes[keyframes.length - 1], duration, velocity)
        : { values: keyframes, times: nextOpen ? OPEN_MORPH_TIMES : CLOSE_FUSION_TIMES };
      if (interrupted && value === cornerRadius && times.length === 2) {
        // A reversed shrinking body still gathers into a capsule, not a tiny sharp panel.
        const roundBody = Math.min(
          Math.max(halfWidth.get(), target.halfWidth * 0.5),
          Math.max(halfHeight.get(), target.halfHeight * 0.5),
        );
        values = [value.get(), Math.max(value.get(), roundBody * 0.92), target.radius];
        times = [0, 0.3, 1];
      }
      return animate(value, values, {
        duration,
        times,
        ease: liquidEasings(values, times, duration, velocity),
      });
    };

    const finishTransition = () => {
      if (transitionRevision.current !== revision || openRef.current !== nextOpen) return;
      transitioningRef.current = false;
      menuVelocityX.jump(0);
      menuVelocityY.jump(0);
      buttonVelocityX.jump(0);
      buttonVelocityY.jump(0);
      mergeDistance.jump(0);
      contentActive.jump(0);
      animations.current = [];
    };

    if (reduceMotion) {
      transitioningRef.current = false;
      rightEdge.jump(target.right);
      bottomEdge.jump(target.bottom);
      halfWidth.jump(target.halfWidth);
      halfHeight.jump(target.halfHeight);
      cornerRadius.jump(target.radius);
      depth.jump(target.depth);
      tintOpacity.jump(target.tint);
      zoom.jump(target.zoom);
      reveal.jump(nextOpen ? 1 : 0);
      triggerOpacity.jump(nextOpen ? 0 : 1);
      triggerScale.jump(nextOpen ? 0.78 : 1);
      buttonCenterX.jump(nextOpen ? centerX.get() : layout.triggerCenterX / size.width);
      buttonCenterY.jump(nextOpen ? centerY.get() : layout.triggerCenterY / size.height);
      buttonHalf.jump(buttonTarget.half);
      buttonDepth.jump(buttonTarget.depth);
      buttonTintOpacity.jump(buttonTarget.tint);
      buttonZoom.jump(buttonTarget.zoom);
      finishTransition();
    } else if (nextOpen) {
      if (!interrupted) {
        const startHalf = buttonHalf.get();
        halfWidth.jump(startHalf);
        halfHeight.jump(startHalf);
        cornerRadius.jump(startHalf);
        rightEdge.jump(layout.triggerCenterX + startHalf);
        bottomEdge.jump(layout.triggerCenterY + startHalf);
        buttonHalf.jump(MIN_LENS_HALF);
      }
      transitioningRef.current = true;
      const widthStart = halfWidth.get();
      const heightStart = halfHeight.get();
      const radiusStart = cornerRadius.get();
      const widthFrames = openWidthFrames(widthStart, target.halfWidth);
      const heightFrames = openHeightFrames(heightStart, target.halfHeight);
      const targetCenterX = target.right - target.halfWidth;
      const targetCenterY = target.bottom - target.halfHeight;
      animations.current = [
        morph(rightEdge, [
          rightEdge.get(),
          layout.triggerCenterX + widthFrames[1],
          targetCenterX + (layout.triggerCenterX - targetCenterX) * 0.16 + widthFrames[2],
          targetCenterX - 1.5 + widthFrames[3],
          target.right,
        ]),
        morph(bottomEdge, [
          bottomEdge.get(),
          layout.triggerCenterY + heightFrames[1],
          targetCenterY + (layout.triggerCenterY - targetCenterY) * 0.14 + heightFrames[2],
          targetCenterY - 4 + heightFrames[3],
          target.bottom,
        ]),
        morph(halfWidth, widthFrames, true),
        morph(halfHeight, heightFrames, true),
        morph(cornerRadius, openRadiusFrames(radiusStart, target.radius, target.halfWidth, target.halfHeight), true),
        animate(depth, [depth.get(), 14, 27, target.depth], {
          duration: OPEN_MORPH_DURATION,
          times: CONTENT_MORPH_TIMES,
          ease: OPEN_MORPH_EASES,
        }),
        animate(tintOpacity, [tintOpacity.get(), 0.1, 0.055, target.tint], {
          duration: OPEN_MORPH_DURATION,
          times: CONTENT_MORPH_TIMES,
          ease: OPEN_MORPH_EASES,
        }),
        animate(zoom, [zoom.get(), 1.68, 1.4, target.zoom], {
          duration: OPEN_MORPH_DURATION,
          times: CONTENT_MORPH_TIMES,
          ease: OPEN_MORPH_EASES,
        }),
        animate(reveal, [reveal.get(), reveal.get(), Math.max(reveal.get(), 0.94), 1], {
          duration: OPEN_CONTENT_DURATION,
          times: [0, 0.06, 0.62, 1],
          ease: OPEN_MORPH_EASES,
        }),
        animate(triggerOpacity, 0, {
          duration: 0.1,
          ease: PRESS_EASE,
        }),
        morph(triggerScale, [triggerScale.get(), 0.82, 0.8, 0.76, 0.76]),
        morph(buttonHalf, [buttonHalf.get(), 1, 1, 1, 1], true),
        animate(buttonDepth, buttonTarget.depth, { duration: 0.1, ease: PRESS_EASE }),
        animate(buttonTintOpacity, buttonTarget.tint, { duration: 0.1, ease: PRESS_EASE }),
        animate(buttonZoom, buttonTarget.zoom, { duration: 0.1, ease: PRESS_EASE }),
        morph(mergeDistance, [mergeDistance.get(), 12, 8, 0, 0]),
      ];
    } else {
      transitioningRef.current = true;
      const widthStart = halfWidth.get();
      const heightStart = halfHeight.get();
      const radiusStart = cornerRadius.get();
      const widthFrames = closeMenuWidthFrames(widthStart);
      const heightFrames = closeMenuHeightFrames(heightStart);
      const buttonFrames = closeButtonFrames(buttonHalf.get());
      const impact = closeImpactVector(layout);
      const approachCenter = closeContactCenter(
        layout,
        widthFrames[2],
        heightFrames[2],
        buttonFrames[2],
        -12,
      );
      const contactCenter = closeContactCenter(
        layout,
        widthFrames[3],
        heightFrames[3],
        buttonFrames[3],
        -20,
      );
      const buttonBaseX = layout.triggerCenterX / size.width;
      const buttonBaseY = layout.triggerCenterY / size.height;
      if (buttonHalf.get() <= MIN_LENS_HALF) {
        buttonCenterX.jump(buttonBaseX);
        buttonCenterY.jump(buttonBaseY);
      }
      animations.current = [
        morph(rightEdge, [
          rightEdge.get(),
          rightEdge.get() - 1,
          approachCenter.x + widthFrames[2],
          contactCenter.x + widthFrames[3],
          layout.triggerCenterX + widthFrames[4] + impact.x,
          target.right,
        ]),
        morph(bottomEdge, [
          bottomEdge.get(),
          bottomEdge.get() + 3,
          approachCenter.y + heightFrames[2],
          contactCenter.y + heightFrames[3],
          layout.triggerCenterY + heightFrames[4] + impact.y,
          target.bottom,
        ]),
        morph(halfWidth, widthFrames, true),
        morph(halfHeight, heightFrames, true),
        morph(cornerRadius, closeMenuRadiusFrames(radiusStart, widthStart, heightStart), true),
        animate(depth, [depth.get(), 29, 22, 16, 10, target.depth], {
          duration: CLOSE_FUSION_DURATION,
          times: CLOSE_FUSION_TIMES,
          ease: CLOSE_FUSION_EASES,
        }),
        animate(tintOpacity, [tintOpacity.get(), 0.02, 0.055, 0.1, 0.04, target.tint], {
          duration: CLOSE_FUSION_DURATION,
          times: CLOSE_FUSION_TIMES,
          ease: CLOSE_FUSION_EASES,
        }),
        animate(zoom, [zoom.get(), 1.46, 1.52, 1.45, 1.2, target.zoom], {
          duration: CLOSE_FUSION_DURATION,
          times: CLOSE_FUSION_TIMES,
          ease: CLOSE_FUSION_EASES,
        }),
        animate(reveal, [reveal.get(), reveal.get() * 0.92, reveal.get() * 0.46, 0], {
          duration: CLOSE_CONTENT_DURATION,
          times: [0, 0.25, 0.72, 1],
          ease: [PRESS_EASE, cubicBezier(0.3, 0, 0.45, 0.7), RELEASE_EASE],
        }),
        animate(triggerOpacity, interrupted ? [triggerOpacity.get(), 1] : [triggerOpacity.get(), 0, 0.18, 0.64, 1, 1], {
          duration: CLOSE_FUSION_DURATION,
          times: interrupted ? [0, 1] : CLOSE_FUSION_TIMES,
          ease: interrupted ? RELEASE_EASE : CLOSE_FUSION_EASES,
        }),
        morph(triggerScale, [triggerScale.get(), 0.25, 0.48, 0.82, 1.02, 1]),
        morph(buttonCenterX, [
          buttonCenterX.get(),
          buttonBaseX,
          buttonBaseX,
          buttonBaseX,
          (layout.triggerCenterX + impact.x) / size.width,
          buttonBaseX,
        ]),
        morph(buttonCenterY, [
          buttonCenterY.get(),
          buttonBaseY,
          buttonBaseY,
          buttonBaseY,
          (layout.triggerCenterY + impact.y) / size.height,
          buttonBaseY,
        ]),
        morph(buttonHalf, buttonFrames, true),
        animate(buttonDepth, [buttonDepth.get(), 10, 14, 18, 22, buttonTarget.depth], {
          duration: CLOSE_FUSION_DURATION,
          times: CLOSE_FUSION_TIMES,
          ease: CLOSE_FUSION_EASES,
        }),
        animate(buttonTintOpacity, [buttonTintOpacity.get(), 0, 0.03, 0.075, 0.12, buttonTarget.tint], {
          duration: CLOSE_FUSION_DURATION,
          times: CLOSE_FUSION_TIMES,
          ease: CLOSE_FUSION_EASES,
        }),
        animate(buttonZoom, [buttonZoom.get(), 1, 1.35, 1.55, 1.48, buttonTarget.zoom], {
          duration: CLOSE_FUSION_DURATION,
          times: CLOSE_FUSION_TIMES,
          ease: CLOSE_FUSION_EASES,
        }),
        morph(mergeDistance, [mergeDistance.get(), 0, 32, 32, 2, 0]),
      ];
    }

    if (!reduceMotion) void Promise.all(animations.current).then(finishTransition);

    if (restoreFocus) {
      const focusDelay = reduceMotion
        ? 0
        : CLOSE_FUSION_DURATION * 1000 + 32;
      focusTimer.current = window.setTimeout(() => {
        focusTimer.current = null;
        if (!openRef.current) triggerRef.current?.focus({ preventScroll: true });
      }, focusDelay);
    }
  }, [
    bottomEdge,
    buttonCenterX,
    buttonCenterY,
    buttonDepth,
    buttonHalf,
    buttonTintOpacity,
    buttonVelocityX,
    buttonVelocityY,
    buttonZoom,
    centerX,
    centerY,
    clearFocusTimer,
    captureContent,
    contentActive,
    cornerRadius,
    depth,
    halfHeight,
    halfWidth,
    mergeDistance,
    menuVelocityX,
    menuVelocityY,
    reduceMotion,
    reveal,
    rightEdge,
    stopAnimations,
    tintOpacity,
    triggerOpacity,
    triggerScale,
    zoom,
  ]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setExpanded(false, true);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, setExpanded]);

  const pressTrigger = useCallback((pressed: boolean) => {
    if (openRef.current || transitioningRef.current) return;
    stopAnimations();
    const duration = pressed ? 0.08 : 0.16;
    const ease = pressed ? PRESS_EASE : RELEASE_EASE;
    const pressHalf = pressed ? 29 : TRIGGER_RADIUS;
    animations.current = [
      animate(buttonHalf, pressHalf, { duration, ease }),
      animate(buttonDepth, pressed ? 16 : 10, { duration, ease }),
      animate(buttonTintOpacity, pressed ? 0.025 : 0.16, { duration, ease }),
      animate(buttonZoom, pressed ? 1.82 : 1.35, { duration, ease }),
      animate(triggerScale, pressed ? 0.86 : 1, {
        duration,
        ease,
      }),
    ];
  }, [
    buttonDepth,
    buttonHalf,
    buttonTintOpacity,
    buttonZoom,
    stopAnimations,
    triggerScale,
  ]);

  const toggleFilter = useCallback((id: FilterId) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const layout = menuLayout(stageSize.width, stageSize.height);

  return (
    <div ref={stageRef} className="dg-liquid-glass" data-liquid-theme={theme}>
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
          ariaLabel={text.menu}
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
        aria-label={text.open}
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
        <Ellipsis aria-hidden="true" />
      </motion.button>

      <motion.div
        ref={panelRef}
        id={menuId}
        className="dg-liquid-menu__panel"
        onScrollCapture={refreshMovingContent}
        onFocusCapture={refreshMovingContent}
        onBlurCapture={refreshMovingContent}
        role="menu"
        aria-label={text.menu}
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
        <MenuContents
          text={text}
          open={open}
          sort={sort}
          filters={filters}
          onSort={setSort}
          onFilter={toggleFilter}
        />
      </motion.div>
    </div>
  );
}
