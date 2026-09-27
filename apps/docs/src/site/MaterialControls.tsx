import { memo, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { GlassButton, GlassTabs, GlassSlider, GlassSwitch, ScrollArea } from "rglass/controls";
import { PRISM_MATERIAL, useGlassMaterial, type GlassMaterial } from "rglass/liquid-glass";
import type { Locale } from "../i18n";
import { materialFields, type MaterialState } from "./material";
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
    material: PRISM_MATERIAL,
  },
];

const MaterialField = memo(function MaterialField({ field, value, initial, zh, setMaterial }: {
  field: (typeof materialFields)[number]; value: number | undefined; zh: boolean;
  initial: number;
  setMaterial: Dispatch<SetStateAction<GlassMaterial>>;
}) {
  return (
    <div className="material-field">
      <span>
        {zh ? field.zh : field.en}
        <output>
          {Number((value ?? initial).toFixed(2))}
          {field.key === "specularRotation" ? "°" : ""}
          {value === undefined && <small> {zh ? "默认" : "auto"}</small>}
        </output>
      </span>
      <GlassSlider
        size="small"
        ariaLabel={zh ? field.zh : field.en}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value ?? initial}
        onValueChange={(value) =>
          setMaterial((current) => ({
            ...current,
            [field.key]: value,
          }))
        }
      />
    </div>
  );
});

export function MaterialControls({ locale, material, setMaterial, children }: {
  locale: Locale; children?: ReactNode;
} & MaterialState) {
  const zh = locale === "zh";
  const [advanced, setAdvanced] = useState(false);
  const defaults = useGlassMaterial();
  const activePreset =
    presets.find(
      (preset) => Object.keys(preset.material).length === Object.keys(material).length &&
        Object.entries(preset.material).every(([key, value]) => material[key as keyof typeof material] === value),
    )?.id ?? "";
  const tabs = useMemo(() => presets.map(preset => ({ value: preset.id, label: zh ? preset.zh : preset.en })), [zh]);
  const lenses = useMemo(() => [
    { value: "dome", label: zh ? "弧面" : "Dome" },
    { value: "bevel", label: zh ? "倒角" : "Bevel" },
  ], [zh]);
  const lights = useMemo(() => [
    { value: "fixed", label: zh ? "固定" : "Fixed" },
    { value: "pointer", label: zh ? "指针" : "Pointer" },
    { value: "device", label: zh ? "倾斜" : "Tilt" },
  ], [zh]);
  // Defaults stay implicit, so an untouched material remains empty.
  const choose = <K extends "refractionModel" | "lightSource">(key: K, fallback: string) => (value: string) =>
    setMaterial(({ [key]: _previous, ...current }) => value === fallback ? current : { ...current, [key]: value });
  const fieldControl = (field: (typeof materialFields)[number]) => (
    <MaterialField key={field.key} field={field} value={material[field.key]} initial={defaults[field.key] ?? field.initial} zh={zh} setMaterial={setMaterial} />
  );
  return (
        <aside
          className="material-inspector"
          aria-label={zh ? "玻璃材质参数" : "Glass material parameters"}
        >
          <div className="inspector-heading">
            <h2>{zh ? "材质" : "Material"}</h2>
            <GlassButton size="small"
              onClick={() => setMaterial({})}
              aria-label={zh ? "重置材质" : "Reset material"}
            >
              <RotateCcw size={14} />
            </GlassButton>
          </div>
          <ScrollArea className="preset-list filter-scroll" orientation="horizontal" viewportProps={{ "aria-label": zh ? "材质预设" : "Material presets" }}>
            <GlassTabs label={zh ? "材质预设" : "Material presets"} value={activePreset} items={tabs}
              onValueChange={id => { const preset = presets.find(preset => preset.id === id); if (preset) setMaterial({ ...preset.material }); }} />
          </ScrollArea>
          <div className="material-fields">
            {materialFields.slice(0, 11).map(fieldControl)}
          </div>
          <details className="material-advanced" onToggle={event => setAdvanced(event.currentTarget.open)}>
            <summary><ChevronDown size={14} aria-hidden="true" />{zh ? "其他参数" : "More parameters"}</summary>
            {advanced && (
              <div className="material-fields">
                <div className="material-choice">
                  <span>{zh ? "透镜轮廓" : "Lens profile"}</span>
                  <GlassTabs label={zh ? "透镜轮廓" : "Lens profile"} value={material.refractionModel ?? "dome"} items={lenses}
                    onValueChange={choose("refractionModel", "dome")} />
                </div>
                <div className="material-choice">
                  <span>{zh ? "光源" : "Light"}</span>
                  <GlassTabs label={zh ? "光源" : "Light"} value={material.lightSource ?? "fixed"} items={lights}
                    onValueChange={choose("lightSource", "fixed")} />
                </div>
                {materialFields.slice(11).map(fieldControl)}
                <div className="debug-field">
                  <span>{zh ? "实时光学场" : "Live optical field"}</span>
                  <GlassSwitch size="small"
                    ariaLabel={zh ? "实时光学场" : "Live optical field"}
                    checked={material.debug ?? false}
                    onCheckedChange={(checked) =>
                      setMaterial((current) => ({
                        ...current,
                        debug: checked,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </details>
          {children}

        </aside>
  );
}
