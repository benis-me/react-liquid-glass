import { memo, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { GlassAccordion, GlassButton, GlassButtonGroup, GlassSlider, GlassSwitch } from "refractive-glass-react/controls";
import { PRISM_MATERIAL, type GlassMaterial } from "refractive-glass-react/liquid-glass";
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
    material: PRISM_MATERIAL,
  },
];

const MaterialField = memo(function MaterialField({ field, value, zh, setMaterial }: {
  field: (typeof materialFields)[number]; value: number | undefined; zh: boolean;
  setMaterial: Dispatch<SetStateAction<GlassMaterial>>;
}) {
  return (
    <div className="material-field">
      <span>
        {zh ? field.zh : field.en}
        <output>
          {value === undefined ? (
            <small>{zh ? "默认" : "auto"}</small>
          ) : (
            Number(value!.toFixed(2))
          )}
          {field.key === "specularRotation" && value !== undefined
            ? "°"
            : ""}
        </output>
      </span>
      <GlassSlider
        size="small"
        ariaLabel={zh ? field.zh : field.en}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value ?? field.initial}
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
  locale: Locale; material: GlassMaterial; setMaterial: Dispatch<SetStateAction<GlassMaterial>>; children?: ReactNode;
}) {
  const zh = locale === "zh";
  const { hdr: _hdr, ...optics } = material;
  const activePreset =
    presets.find(
      (preset) => Object.keys(preset.material).length === Object.keys(optics).length &&
        Object.entries(preset.material).every(([key, value]) => optics[key as keyof typeof optics] === value),
    )?.id ?? "custom";
  const fieldControl = (field: (typeof materialFields)[number]) => (
    <MaterialField key={field.key} field={field} value={material[field.key]} zh={zh} setMaterial={setMaterial} />
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
          <GlassButtonGroup className="preset-list" label={zh ? "材质预设" : "Material presets"}>
            {presets.map((preset) => (
              <GlassButton size="small"
                key={preset.id}
                aria-pressed={activePreset === preset.id}
                onClick={() => setMaterial(current => ({ ...preset.material, ...(current.hdr === undefined ? {} : { hdr: current.hdr }) }))}
              >
                {zh ? preset.zh : preset.en}
              </GlassButton>
            ))}
          </GlassButtonGroup>
          <p className="inspector-note">
            {zh
              ? "默认使用各组件参数；调整项全局生效。"
              : "Defaults stay local. Adjustments apply to all."}
          </p>
          <div className="material-fields">
            <div className="debug-field">
              <span>HDR</span>
              <GlassSwitch size="small" ariaLabel="HDR" checked={material.hdr !== false}
                onCheckedChange={hdr => setMaterial(current => ({ ...current, hdr }))} />
            </div>
            {materialFields.slice(0, 11).map(fieldControl)}
          </div>
          <div className="material-advanced">
            <GlassAccordion lazy items={[{ title: zh ? "其他参数" : "More parameters", content: (
              <div className="material-fields">
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
            ) }]} />
          </div>
          {children}

        </aside>
  );
}
