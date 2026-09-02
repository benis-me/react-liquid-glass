import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Locale } from "../i18n";
import { Glass, GlassSlider, GlassSwitch, motionValue, type LensParams } from "../lib";

type BasicKey =
  | "lensW"
  | "lensH"
  | "borderRadius"
  | "scale"
  | "depth"
  | "curvature"
  | "splayAmount"
  | "chromaAmount"
  | "blurAmount"
  | "specularStrength"
  | "glowStrength"
  | "edgeStrength"
  | "specularRotation";

type AdvancedKey =
  | "scaleX"
  | "scaleY"
  | "mapSize"
  | "brightness"
  | "tint"
  | "glowSpread"
  | "glowExponent"
  | "edgeWidth"
  | "edgeExponent"
  | "zoom"
  | "filterResolution"
  | "regionScale"
  | "regionOriginX"
  | "regionOriginY"
  | "shadowOpacity"
  | "insetShadowOpacity";

type PlaygroundKey = BasicKey | AdvancedKey;
type PlaygroundFlag = "sdfBoundary" | "edgeFalloff" | "specularDark";

const ranges: Record<PlaygroundKey, [number, number, number, number]> = {
  lensW: [70, 20, 120, 1],
  lensH: [60, 20, 80, 1],
  borderRadius: [28, 0, 64, 1],
  scale: [0.1, 0, 0.2, 0.001],
  depth: [10, 5, 60, 1],
  curvature: [40, 0, 80, 1],
  splayAmount: [1, 0, 1, 0.01],
  chromaAmount: [0.2, 0, 1, 0.01],
  blurAmount: [0, 0, 2, 0.25],
  specularStrength: [1, 0, 2, 0.01],
  glowStrength: [0.1, 0, 1, 0.01],
  edgeStrength: [0.25, 0, 1, 0.01],
  specularRotation: [45, 0, 360, 1],
  scaleX: [0.1, 0, 0.3, 0.001],
  scaleY: [0.1, 0, 0.3, 0.001],
  mapSize: [512, 64, 1024, 64],
  brightness: [0, -1, 1, 0.01],
  tint: [0, -1, 1, 0.01],
  glowSpread: [1, 0.05, 1, 0.01],
  glowExponent: [1.5, 0.1, 4, 0.1],
  edgeWidth: [3, 0.5, 12, 0.5],
  edgeExponent: [1.5, 0.1, 4, 0.1],
  zoom: [1, 0.5, 3, 0.01],
  filterResolution: [1, 0.5, 2, 0.25],
  regionScale: [1, 0.5, 2, 0.01],
  regionOriginX: [0.5, 0, 1, 0.01],
  regionOriginY: [0.5, 0, 1, 0.01],
  shadowOpacity: [0.12, 0, 0.5, 0.01],
  insetShadowOpacity: [0, 0, 0.5, 0.01],
};

const parameterLabels: Record<Locale, Record<PlaygroundKey, string>> = {
  zh: {
    lensW: "宽度", lensH: "高度", borderRadius: "圆角", scale: "折射强度", depth: "深度",
    curvature: "曲率", splayAmount: "展开", chromaAmount: "色散", blurAmount: "模糊",
    specularStrength: "高光强度", glowStrength: "辉光", edgeStrength: "边缘高光",
    specularRotation: "高光角度", scaleX: "水平折射", scaleY: "垂直折射", mapSize: "位移图精度",
    brightness: "亮度", tint: "色调", glowSpread: "辉光范围", glowExponent: "辉光指数",
    edgeWidth: "边缘宽度", edgeExponent: "边缘指数", zoom: "缩放", filterResolution: "渲染精度",
    regionScale: "区域缩放", regionOriginX: "区域中心 X", regionOriginY: "区域中心 Y",
    shadowOpacity: "外阴影", insetShadowOpacity: "内阴影",
  },
  en: {
    lensW: "Width", lensH: "Height", borderRadius: "Corner radius", scale: "Refraction", depth: "Depth",
    curvature: "Curvature", splayAmount: "Splay", chromaAmount: "Dispersion", blurAmount: "Blur",
    specularStrength: "Specular", glowStrength: "Glow", edgeStrength: "Edge highlight",
    specularRotation: "Highlight angle", scaleX: "Horizontal refraction", scaleY: "Vertical refraction", mapSize: "Map resolution",
    brightness: "Brightness", tint: "Tint", glowSpread: "Glow spread", glowExponent: "Glow exponent",
    edgeWidth: "Edge width", edgeExponent: "Edge exponent", zoom: "Zoom", filterResolution: "Render scale",
    regionScale: "Region scale", regionOriginX: "Region center X", regionOriginY: "Region center Y",
    shadowOpacity: "Outer shadow", insetShadowOpacity: "Inner shadow",
  },
};

const basicOrder: BasicKey[] = [
  "lensW",
  "lensH",
  "borderRadius",
  "scale",
  "depth",
  "curvature",
  "splayAmount",
  "chromaAmount",
  "blurAmount",
  "specularStrength",
  "glowStrength",
  "edgeStrength",
  "specularRotation",
];

const advancedOrder: AdvancedKey[] = [
  "scaleX",
  "scaleY",
  "mapSize",
  "brightness",
  "tint",
  "glowSpread",
  "glowExponent",
  "edgeWidth",
  "edgeExponent",
  "zoom",
  "filterResolution",
  "regionScale",
  "regionOriginX",
  "regionOriginY",
  "shadowOpacity",
  "insetShadowOpacity",
];

const flagLabels: Record<Locale, Record<PlaygroundFlag, string>> = {
  zh: { sdfBoundary: "圆角边界", edgeFalloff: "边缘衰减", specularDark: "暗色高光" },
  en: { sdfBoundary: "Rounded boundary", edgeFalloff: "Edge falloff", specularDark: "Dark specular" },
};

const flagOrder: PlaygroundFlag[] = ["sdfBoundary", "edgeFalloff", "specularDark"];
const copy = {
  zh: {
    mapAlt: "镜片当前位置生成的位移图",
    generating: "生成中…",
    background: "底图",
    showBackground: "显示底图",
    more: "其他参数",
  },
  en: {
    mapAlt: "Displacement map at the current lens position",
    generating: "Generating…",
    background: "Background",
    showBackground: "Show background",
    more: "More parameters",
  },
} as const;
const defaults = Object.fromEntries(
  Object.entries(ranges).map(([key, range]) => [key, range[0]]),
) as Record<PlaygroundKey, number>;
const defaultFlags: Record<PlaygroundFlag, boolean> = {
  sdfBoundary: true,
  edgeFalloff: true,
  specularDark: false,
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const ParameterSlider = memo(function ParameterSlider({
  parameter,
  label,
  range,
  value,
  onValueChange,
}: {
  parameter: PlaygroundKey;
  label: string;
  range: [number, number, number, number];
  value: number;
  onValueChange: (key: PlaygroundKey, value: number) => void;
}) {
  const [, min, max, step] = range;
  const digits = Math.max(0, Math.ceil(-Math.log10(step)));
  return (
    <label>
      <span>{label}</span>
      <GlassSlider
        size="small"
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(next) => onValueChange(parameter, next)}
        ariaLabel={label}
      />
      <output>{value.toFixed(digits)}</output>
    </label>
  );
});

export function DisplacementPlayground({ backgroundImage, locale }: { backgroundImage: string; locale: Locale }) {
  const [values, setValues] = useState(defaults);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [showBackground, setShowBackground] = useState(false);
  const [flags, setFlags] = useState(defaultFlags);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const lensW = useRef(motionValue(70)).current;
  const lensH = useRef(motionValue(60)).current;
  const radius = useRef(motionValue(28)).current;
  const x = useRef(motionValue(0.5)).current;
  const y = useRef(motionValue(0.5)).current;
  const mapRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewsRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const regionOriginX = useRef(motionValue(Number.NaN)).current;
  const regionOriginY = useRef(motionValue(Number.NaN)).current;
  const labels = parameterLabels[locale];
  const flagsCopy = flagLabels[locale];
  const text = copy[locale];

  const setValue = useCallback((key: PlaygroundKey, next: number) => {
    setValues((current) => {
      if (key === "scale") return { ...current, scale: next, scaleX: next, scaleY: next };
      if (key === "scaleX") return { ...current, scaleX: next, scale: (next + current.scaleY) / 2 };
      if (key === "scaleY") return { ...current, scaleY: next, scale: (current.scaleX + next) / 2 };
      return { ...current, [key]: next };
    });
    if (key === "lensW") lensW.set(next);
    if (key === "lensH") lensH.set(next);
    if (key === "borderRadius") radius.set(next);
  }, [lensW, lensH, radius]);

  const lens = useMemo<Partial<LensParams>>(
    () => ({
      lensW: 70,
      lensH: 60,
      borderRadius: 28,
      scaleX: values.scaleX,
      scaleY: values.scaleY,
      mapSize: values.mapSize,
      depth: values.depth,
      domeDepth: values.curvature,
      chromaAmount: values.chromaAmount,
      splayAmount: values.splayAmount,
      blurAmount: values.blurAmount,
      brightness: values.brightness,
      tint: values.tint,
      specularStrength: values.specularStrength,
      specularDark: flags.specularDark,
      sdfBoundary: flags.sdfBoundary,
      edgeFalloff: flags.edgeFalloff,
      specularRotation: values.specularRotation,
      glowStrength: values.glowStrength,
      glowSpread: values.glowSpread,
      glowExponent: values.glowExponent,
      edgeStrength: values.edgeStrength,
      edgeWidth: values.edgeWidth,
      edgeExponent: values.edgeExponent,
      edgeShadow: values.shadowOpacity > 0
        ? `0 6px 18px rgba(0,0,0,${values.shadowOpacity})`
        : undefined,
      edgeInsetShadow: values.insetShadowOpacity > 0
        ? `0 -3px 10px rgba(0,0,0,${values.insetShadowOpacity})`
        : undefined,
    }),
    [values, flags],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const rect = stage.getBoundingClientRect();
      regionOriginX.set(values.regionOriginX * rect.width);
      regionOriginY.set(values.regionOriginY * rect.height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [values.regionOriginX, values.regionOriginY, regionOriginX, regionOriginY]);

  useEffect(() => {
    const update = () => {
      const image = mapRef.current;
      const split = `${x.get() * 100}%`;
      previewsRef.current?.style.setProperty("--split", split);
      if (!image) return;
      image.style.left = split;
      image.style.top = `${y.get() * 100}%`;
      image.style.width = `${lensW.get() * 2}px`;
      image.style.height = `${lensH.get() * 2}px`;
    };
    update();
    const unsubscribers = [
      x.on("change", update),
      y.on("change", update),
      lensW.on("change", update),
      lensH.on("change", update),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [x, y, lensW, lensH, mapUrl]);

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragging.current = true;
    dragOffset.current = {
      x: (event.clientX - rect.left) / rect.width - x.get(),
      y: (event.clientY - rect.top) / rect.height - y.get(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(clamp((event.clientX - rect.left) / rect.width - dragOffset.current.x));
    y.set(clamp((event.clientY - rect.top) / rect.height - dragOffset.current.y));
    event.preventDefault();
  };

  const pointerEnd = () => {
    dragging.current = false;
  };

  return (
    <div className="displacement-playground">
      <div ref={previewsRef} className="displacement-playground__previews">
        <div
          ref={stageRef}
          className="displacement-playground__stage"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
        >
          <Glass
            pauseOffscreen
            lens={lens}
            x={x}
            y={y}
            lensW={lensW}
            lensH={lensH}
            borderRadius={radius}
            zoom={values.zoom}
            filterResolution={values.filterResolution}
            regionScale={values.regionScale}
            regionOriginX={regionOriginX}
            regionOriginY={regionOriginY}
            onLensMapChange={setMapUrl}
          >
            <div className="displacement-playground__source">
              {showBackground ? (
                <img
                  className="displacement-playground__background-image"
                  src={backgroundImage}
                  alt=""
                  decoding="async"
                />
              ) : (
                <div className="displacement-playground__background" />
              )}
            </div>
          </Glass>
        </div>
        <div
          className="displacement-playground__map-stage"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
        >
          {mapUrl ? (
            <img
              ref={mapRef}
              src={mapUrl}
              alt={text.mapAlt}
              className="displacement-playground__map"
              draggable={false}
            />
          ) : (
            <span className="displacement-playground__pending">{text.generating}</span>
          )}
        </div>
      </div>
      <div className="displacement-playground__toolbar">
        <span>{text.background}</span>
        <GlassSwitch
          size="small"
          checked={showBackground}
          onCheckedChange={setShowBackground}
          ariaLabel={text.showBackground}
        />
      </div>
      <div className="displacement-playground__controls">
        {basicOrder.map((key) => (
          <ParameterSlider
            key={key}
            parameter={key}
            label={labels[key]}
            range={ranges[key]}
            value={values[key]}
            onValueChange={setValue}
          />
        ))}
      </div>
      <details className="displacement-playground__advanced" onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary>{text.more}</summary>
        {advancedOpen ? (
          <>
            <div className="displacement-playground__flags">
              {flagOrder.map((key) => (
                <div className="displacement-playground__flag" key={key}>
                  <span>{flagsCopy[key]}</span>
                  <GlassSwitch
                    size="small"
                    checked={flags[key]}
                    onCheckedChange={(checked) => setFlags((current) => ({ ...current, [key]: checked }))}
                    ariaLabel={flagsCopy[key]}
                  />
                </div>
              ))}
            </div>
            <div className="displacement-playground__controls displacement-playground__controls--advanced">
              {advancedOrder.map((key) => (
                <ParameterSlider
                  key={key}
                  parameter={key}
                  label={labels[key]}
                  range={ranges[key]}
                  value={values[key]}
                  onValueChange={setValue}
                />
              ))}
            </div>
          </>
        ) : null}
      </details>
    </div>
  );
}
