import { useEffect, useState } from "react";
import { Check, Link2, RotateCcw } from "lucide-react";
import {
  LiquidGlassProvider,
  type GlassMaterial,
} from "refractive-glass-react/liquid-glass";
import {
  GlassStage,
  type GlassBackground,
} from "refractive-glass-react/controls";
import { catalog, type ComponentId } from "./catalog";
import { ComponentExample } from "./ComponentExample";
import { CodeBlock, PageHeading, type PageProps } from "./Pages";
import { Link } from "./router";
import { materialFields, sanitizeMaterial } from "./material";
const presets: {
  id: string;
  en: string;
  zh: string;
  material: GlassMaterial;
}[] = [
  { id: "original", en: "Original", zh: "原始校准", material: {} },
  {
    id: "clear",
    en: "Clear",
    zh: "清透",
    material: {
      blurStrength: 0,
      chromaAmount: 0.15,
      refractionStrength: 0.12,
      tintStrength: 0.02,
    },
  },
  {
    id: "frost",
    en: "Frosted",
    zh: "磨砂",
    material: {
      blurStrength: 2.8,
      chromaAmount: 0.2,
      refractionStrength: 0.09,
      tintStrength: 0.12,
    },
  },
  {
    id: "prism",
    en: "Prism",
    zh: "棱镜",
    material: {
      blurStrength: 0.2,
      chromaAmount: 1.2,
      refractionStrength: 0.2,
      specularStrength: 0.9,
      tintStrength: 0.02,
    },
  },
];
export function Playground({ locale, theme }: PageProps) {
  const [component, setComponent] = useState<ComponentId | "all">(() => {
    const id = new URLSearchParams(location.search).get("component");
    return id === "all" || catalog.some((item) => item.id === id)
      ? (id as ComponentId | "all")
      : "segmented";
  });
  const [material, setMaterial] = useState<GlassMaterial>(() => {
    try {
      return sanitizeMaterial(
        JSON.parse(
          new URLSearchParams(location.search).get("material") ??
            localStorage.getItem("glass-playground") ??
            "{}",
        ),
      );
    } catch {
      return {};
    }
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [background, setBackground] = useState<GlassBackground>("lines"),
    [shared, setShared] = useState("");
  const zh = locale === "zh";
  useEffect(() => {
    try {
      localStorage.setItem("glass-playground", JSON.stringify(material));
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }, [material]);
  const activePreset =
    presets.find(
      (preset) => JSON.stringify(preset.material) === JSON.stringify(material),
    )?.id ?? "custom";
  const selected =
    component === "all"
      ? catalog
      : catalog.filter((item) => item.id === component);
  const share = async () => {
    const url = new URL(location.href);
    url.search = new URLSearchParams({
      component,
      material: JSON.stringify(material),
    }).toString();
    history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url.href);
      setShared(zh ? "链接已复制" : "Link copied");
    } catch {
      setShared(zh ? "配置已写入地址栏" : "Configuration saved to address bar");
    }
  };
  const fieldControl = (field: (typeof materialFields)[number]) => (
    <label key={field.key} className="material-field">
      <span>
        {zh ? field.zh : field.en}
        <output>
          {material[field.key] === undefined ? (
            <small>{zh ? "默认" : "auto"}</small>
          ) : (
            Number(material[field.key]!.toFixed(2))
          )}
          {field.key === "specularRotation" && material[field.key] !== undefined
            ? "°"
            : ""}
        </output>
      </span>
      <input
        type="range"
        aria-label={zh ? field.zh : field.en}
        min={field.min}
        max={field.max}
        step={field.step}
        value={material[field.key] ?? field.initial}
        onChange={(event) =>
          setMaterial((current) => ({
            ...current,
            [field.key]: Number(event.target.value),
          }))
        }
      />
    </label>
  );
  return (
    <>
      <PageHeading
        kicker="PLAYGROUND"
        title={zh ? "一点折射，无限可能。" : "Your own kind of glass."}
        description={
          zh
            ? "调节真正的渲染参数。选一个组件，或者让所有组件一起变化。"
            : "Real renderer parameters. Explore one component, or change the entire collection at once."
        }
      />
      <div className="playground-layout">
        <div className="playground-main">
          <div className="playground-toolbar">
            <label>
              <span>{zh ? "组件" : "Component"}</span>
              <select
                value={component}
                onChange={(event) =>
                  setComponent(event.target.value as ComponentId | "all")
                }
              >
                <option value="all">
                  {zh ? "所有组件" : "All components"}
                </option>
                {catalog.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{zh ? "底图" : "Substrate"}</span>
              <select
                value={background}
                onChange={(event) =>
                  setBackground(event.target.value as GlassBackground)
                }
              >
                <option value="lines">{zh ? "条纹" : "Lines"}</option>
                <option value="grid">{zh ? "网格" : "Grid"}</option>
                <option value="plain">{zh ? "纯色" : "Plain"}</option>
              </select>
            </label>
          </div>
          <LiquidGlassProvider material={material}>
            <div
              className={
                component === "all" ? "playground-all" : "playground-single"
              }
            >
              {selected.map((item) => (
                <div key={item.id}>
                  <GlassStage
                    background={background}
                    className={`component-preview component-preview--${item.id} ${component === "all" ? "component-preview--compact" : ""}`}
                  >
                    <ComponentExample
                      id={item.id}
                      locale={locale}
                      theme={theme}
                      compact={component === "all"}
                    />
                  </GlassStage>
                  <div className="playground-caption">
                    <Link href={`/components/${item.id}`}>{item.name} ↗</Link>
                    <span>
                      {zh
                        ? "按下或拖动以观察动态材质"
                        : "Press or drag to see the active material"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </LiquidGlassProvider>
          <details className="playground-code">
            <summary>{zh ? "复制材质配置" : "Material configuration"}</summary>
            <CodeBlock
              locale={locale}
              code={`import { LiquidGlassProvider } from "refractive-glass-react/liquid-glass";\n\n<LiquidGlassProvider material={${JSON.stringify(material, null, 2)}}>\n  {/* Your glass components */}\n</LiquidGlassProvider>`}
            />
          </details>
        </div>
        <aside
          className="material-inspector"
          aria-label={zh ? "玻璃材质参数" : "Glass material parameters"}
        >
          <div className="inspector-heading">
            <h2>{zh ? "材质" : "Material"}</h2>
            <button
              onClick={() => setMaterial({})}
              aria-label={zh ? "重置材质" : "Reset material"}
              title={zh ? "重置" : "Reset"}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <div className="preset-list">
            {presets.map((preset) => (
              <button
                key={preset.id}
                aria-pressed={activePreset === preset.id}
                onClick={() => setMaterial(preset.material)}
              >
                {zh ? preset.zh : preset.en}
              </button>
            ))}
          </div>
          <p className="inspector-note">
            {zh
              ? "未覆盖的参数保留各组件的原始校准。"
              : "Untouched parameters keep each component’s original calibration."}
          </p>
          <div className="material-fields">
            {materialFields.slice(0, 11).map(fieldControl)}
          </div>
          <details
            className="material-advanced"
            onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
          >
            <summary>{zh ? "其他参数" : "More parameters"}</summary>
            {advancedOpen && (
              <div className="material-fields">
                {materialFields.slice(11).map(fieldControl)}
                <label className="debug-field">
                  <input
                    type="checkbox"
                    checked={material.debug ?? false}
                    onChange={(event) =>
                      setMaterial((current) => ({
                        ...current,
                        debug: event.target.checked,
                      }))
                    }
                  />
                  {zh ? "实时光学场" : "Live optical field"}
                </label>
              </div>
            )}
          </details>
          <button className="link-button share-material" onClick={share}>
            {shared ? <Check size={14} /> : <Link2 size={14} />}
            <span aria-live="polite">
              {shared || (zh ? "分享配置" : "Share configuration")}
            </span>
          </button>
        </aside>
      </div>
    </>
  );
}
