import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Locale } from "../i18n";
import { GlassSlider, GlassSwitch } from "../lib/controls";
import { motionValue } from "../lib/shared/values";
import { LiquidGlass as Glass, LIQUID_LENS } from "../lib/liquid-glass/LiquidGlass";
import { LIQUID_GLASS_MATERIAL as material } from "../lib/liquid-glass/renderer";
import type { LensParams } from "../lib/types";

const ranges = {
  lensW: [70, 20, 120, 1], lensH: [60, 20, 80, 1], borderRadius: [28, 0, 64, 1],
  scale: [material.refractionStrength, 0, .3, .001], depth: [material.edgeDepth, 1, 60, 1],
  curvature: [material.domeDepth, 0, 80, 1], chromaAmount: [material.chromaAmount, 0, 1, .01],
  blurAmount: [material.blurStrength, 0, 4, .1], specularStrength: [material.specularStrength, 0, 2, .01],
  glowStrength: [material.glowStrength, 0, 1, .01], edgeStrength: [material.edgeStrength, 0, 1, .01],
  specularRotation: [material.specularRotation, 0, 360, 1], brightness: [material.brightness, -1, 1, .01],
  tint: [material.tintStrength, 0, 1, .01], glowSpread: [material.glowSpread, .05, 1, .01],
  glowExponent: [material.glowExponent, .1, 4, .1], edgeWidth: [material.edgeWidth, .25, 6, .05],
  edgeExponent: [material.edgeExponent, .1, 4, .1], zoom: [1, .5, 3, .01],
  filterResolution: [2, .5, 2, .25], shadowOpacity: [material.shadowStrength, 0, .5, .01],
} satisfies Record<string, [number, number, number, number]>;
type PlaygroundKey = keyof typeof ranges;
const basicOrder: PlaygroundKey[] = ["lensW", "lensH", "borderRadius", "scale", "depth", "curvature", "chromaAmount", "blurAmount", "specularStrength", "glowStrength", "edgeStrength", "specularRotation"];
const advancedOrder: PlaygroundKey[] = ["brightness", "tint", "glowSpread", "glowExponent", "edgeWidth", "edgeExponent", "zoom", "filterResolution", "shadowOpacity"];
const labels: Record<Locale, Record<PlaygroundKey, string>> = {
  zh: {
    lensW: "宽度", lensH: "高度", borderRadius: "圆角", scale: "折射强度", depth: "深度",
    curvature: "曲率", chromaAmount: "色散", blurAmount: "模糊", specularStrength: "高光强度",
    glowStrength: "辉光", edgeStrength: "边缘高光", specularRotation: "高光角度", brightness: "亮度",
    tint: "色调", glowSpread: "辉光范围", glowExponent: "辉光指数", edgeWidth: "边缘宽度",
    edgeExponent: "边缘指数", zoom: "缩放", filterResolution: "渲染精度", shadowOpacity: "阴影",
  },
  en: {
    lensW: "Width", lensH: "Height", borderRadius: "Corner radius", scale: "Refraction", depth: "Depth",
    curvature: "Curvature", chromaAmount: "Dispersion", blurAmount: "Blur", specularStrength: "Specular",
    glowStrength: "Glow", edgeStrength: "Edge highlight", specularRotation: "Highlight angle", brightness: "Brightness",
    tint: "Tint", glowSpread: "Glow spread", glowExponent: "Glow exponent", edgeWidth: "Edge width",
    edgeExponent: "Edge exponent", zoom: "Zoom", filterResolution: "Render scale", shadowOpacity: "Shadow",
  },
};
const defaults = Object.fromEntries(Object.entries(ranges).map(([key, range]) => [key, range[0]])) as Record<PlaygroundKey, number>;
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
  const [showBackground, setShowBackground] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const lensW = useRef(motionValue(70)).current;
  const lensH = useRef(motionValue(60)).current;
  const radius = useRef(motionValue(28)).current;
  const x = useRef(motionValue(.5)).current, y = useRef(motionValue(.5)).current;
  const previewsRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const setValue = useCallback((key: PlaygroundKey, value: number) => {
    setValues(current => ({ ...current, [key]: value }));
    if (key === "lensW") lensW.set(value);
    if (key === "lensH") lensH.set(value);
    if (key === "borderRadius") radius.set(value);
  }, [lensW, lensH, radius]);
  const lens = useMemo<Partial<LensParams>>(() => ({
    ...LIQUID_LENS, scaleX: values.scale, scaleY: values.scale, depth: values.depth, domeDepth: values.curvature,
    chromaAmount: values.chromaAmount, blurAmount: values.blurAmount, brightness: values.brightness, tint: values.tint,
    specularStrength: values.specularStrength, specularRotation: values.specularRotation,
    glowStrength: values.glowStrength, glowSpread: values.glowSpread, glowExponent: values.glowExponent,
    edgeStrength: values.edgeStrength, edgeWidth: values.edgeWidth, edgeExponent: values.edgeExponent,
  }), [values]);
  useEffect(() => x.on("change", value => previewsRef.current?.style.setProperty("--split", `${value * 100}%`)), [x]);
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragging.current = true;
    dragOffset.current = { x: (event.clientX - rect.left) / rect.width - x.get(), y: (event.clientY - rect.top) / rect.height - y.get() };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(clamp((event.clientX - rect.left) / rect.width - dragOffset.current.x));
    y.set(clamp((event.clientY - rect.top) / rect.height - dragOffset.current.y));
  };
  const pointerEnd = () => { dragging.current = false; };
  const pointer = { onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerEnd, onPointerCancel: pointerEnd, onLostPointerCapture: pointerEnd };
  return <div className="displacement-playground">
    <div ref={previewsRef} className="displacement-playground__previews">
      {[false, true].map(debug => <div key={String(debug)} {...pointer}
        className={debug ? "displacement-playground__map-stage" : "displacement-playground__stage"}
        aria-label={debug ? (locale === "zh" ? "实时液态光学场" : "Live liquid optical field") : undefined}>
        <Glass lens={lens} x={x} y={y} lensW={lensW} lensH={lensH} borderRadius={radius}
          zoom={values.zoom} filterResolution={values.filterResolution} debug={debug}
          material={{ shadowStrength: values.shadowOpacity }}>
          <div className="displacement-playground__source">
            {showBackground && !debug ? <img className="displacement-playground__background-image"
              crossOrigin="anonymous" src={backgroundImage} alt="" decoding="async" />
              : <div className="displacement-playground__background" />}
          </div>
        </Glass>
      </div>)}
    </div>
    <div className="displacement-playground__toolbar">
      <span>{locale === "zh" ? "底图" : "Background"}</span>
      <GlassSwitch size="small" checked={showBackground} onCheckedChange={setShowBackground}
        ariaLabel={locale === "zh" ? "显示底图" : "Show background"} />
    </div>
    <div className="displacement-playground__controls">
      {basicOrder.map(key => <ParameterSlider key={key} parameter={key} label={labels[locale][key]}
        range={ranges[key]} value={values[key]} onValueChange={setValue} />)}
    </div>
    <details className="displacement-playground__advanced" onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
      <summary>{locale === "zh" ? "其他参数" : "More parameters"}</summary>
      {advancedOpen ? <div className="displacement-playground__controls displacement-playground__controls--advanced">
        {advancedOrder.map(key => <ParameterSlider key={key} parameter={key} label={labels[locale][key]}
          range={ranges[key]} value={values[key]} onValueChange={setValue} />)}
      </div> : null}
    </details>
  </div>;
}
