import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import {
  LiquidGlassProvider,
  type GlassMaterial,
} from "refractive-glass-react/liquid-glass";
import {
  GlassStage,
  GlassAccordion,
  GlassButton,
  GlassSelect,
  GlassSurface,
  type GlassBackground,
} from "refractive-glass-react/controls";
import { catalog, type ComponentId } from "./catalog";
import { ComponentExample } from "./ComponentExample";
import { CodeBlock, PageHeading, type PageProps } from "./Pages";
import { Link } from "./router";
import { MaterialControls } from "./MaterialControls";
import { sanitizeMaterial } from "./material";
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
  return (
    <>
      <PageHeading
        kicker="PLAYGROUND"
        title={"Playground"}
        description={
          zh
            ? "调节材质，预览组件。"
            : "Tune the material. Try every component."
        }
      />
      <div className="playground-layout">
        <div className="playground-main">
          <div className="playground-toolbar">
              <GlassSelect label={zh ? "组件" : "Component"}
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
              </GlassSelect>
              <GlassSelect label={zh ? "底图" : "Substrate"}
                value={background}
                onChange={(event) =>
                  setBackground(event.target.value as GlassBackground)
                }
              >
                <option value="lines">{zh ? "条纹" : "Lines"}</option>
                <option value="grid">{zh ? "网格" : "Grid"}</option>
                <option value="plain">{zh ? "纯色" : "Plain"}</option>
              </GlassSelect>
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
                  </div>
                </div>
              ))}
            </div>
          </LiquidGlassProvider>
          <div className="playground-code">
            <GlassAccordion items={[{ title: zh ? "材质配置" : "Material configuration", content: (
            <CodeBlock
              locale={locale}
              code={`import { LiquidGlassProvider } from "refractive-glass-react/liquid-glass";\n\n<LiquidGlassProvider material={${JSON.stringify(material, null, 2)}}>\n  {/* Your glass components */}\n</LiquidGlassProvider>`}
            />
            ) }]} />
          </div>
        </div>
        <GlassSurface className="playground-inspector" radius={24}>
        <MaterialControls locale={locale} material={material} setMaterial={setMaterial}>
          <GlassButton size="small" className="share-material" onClick={share}>
            {shared ? <Check size={14} /> : <Link2 size={14} />}
            <span aria-live="polite">
              {shared || (zh ? "分享配置" : "Share configuration")}
            </span>
          </GlassButton>
        </MaterialControls>
        </GlassSurface>
      </div>
    </>
  );
}
