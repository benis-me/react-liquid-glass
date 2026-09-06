import { useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { GlassMaterial } from "refractive-glass-react/liquid-glass";
import type { Locale } from "../i18n";
import { materialFields } from "./material";
const presets: {
  id: string;
  en: string;
  zh: string;
  material: GlassMaterial;
}[] = [
  { id: "original", en: "Default", zh: "默认", material: {} },
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

export function MaterialControls({ locale, material, setMaterial, children }: {
  locale: Locale; material: GlassMaterial; setMaterial: Dispatch<SetStateAction<GlassMaterial>>; children?: ReactNode;
}) {
  const zh = locale === "zh";
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activePreset =
    presets.find(
      (preset) => JSON.stringify(preset.material) === JSON.stringify(material),
    )?.id ?? "custom";
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
              ? "默认使用各组件参数；调整项全局生效。"
              : "Defaults stay local. Adjustments apply to all."}
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
          {children}

        </aside>
  );
}
