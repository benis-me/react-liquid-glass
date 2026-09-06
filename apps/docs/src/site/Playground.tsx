import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import {
  GlassStage,
  GlassAccordion,
  GlassButton,
  GlassSelect,
  GlassSurface,
  type GlassBackground,
} from "refractive-glass-react/controls";
import { catalog, componentAliases, type ComponentId } from "./catalog";
import { ComponentExample } from "./ComponentExample";
import { CodeBlock, PageHeading, type PageProps } from "./Pages";
import { Link } from "./router";
import { MaterialControls } from "./MaterialControls";
import type { MaterialState } from "./material";
function readComponent(): ComponentId | "all" {
  const requested = new URLSearchParams(location.search).get("component");
  const id = componentAliases[requested ?? ""] ?? requested;
  return id === "all" || catalog.some((item) => item.id === id)
    ? (id as ComponentId | "all")
    : "tabs";
}

export function Playground({ locale, theme, material, setMaterial }: PageProps & MaterialState) {
  const [component, setComponent] = useState(readComponent);
  useEffect(() => {
    const update = () => setComponent(readComponent());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const [background, setBackground] = useState<GlassBackground>("grid"),
    [shared, setShared] = useState({ key: "", message: "" });
  const shareKey = `${locale}:${component}:${JSON.stringify(material)}`;
  const shareMessage = shared.key === shareKey ? shared.message : "";
  const zh = locale === "zh";
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
      setShared({ key: shareKey, message: zh ? "链接已复制" : "Link copied" });
    } catch {
      setShared({ key: shareKey, message: zh ? "配置已写入地址栏" : "Configuration saved to address bar" });
    }
  };
  return (
      <div className="playground-layout">
        <div className="playground-main">
      <PageHeading
        kicker="PLAYGROUND"
        title={"Playground"}
        description={
          zh
            ? "调节材质，预览组件。"
            : "Tune the material. Try every component."
        }
      />
          <div className="playground-toolbar">
              <GlassSelect label={zh ? "组件" : "Component"}
                value={component}
                onChange={(event) => {
                  setComponent(event.target.value as ComponentId | "all");
                  const url = new URL(location.href);
                  url.searchParams.set("component", event.target.value);
                  history.replaceState(null, "", url);
                }}
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
                <option value="grid">{zh ? "网格" : "Grid"}</option>
                <option value="lines">{zh ? "条纹" : "Lines"}</option>
                <option value="plain">{zh ? "纯色" : "Plain"}</option>
              </GlassSelect>
          </div>
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
          <div className="playground-code">
            <GlassAccordion items={[{ title: zh ? "材质配置" : "Material configuration", content: (
            <CodeBlock
              locale={locale}
              code={`import { LiquidGlassProvider } from "refractive-glass-react/liquid-glass";\n\n<LiquidGlassProvider material={${JSON.stringify(material, null, 2)}}>\n  {/* Your glass components */}\n</LiquidGlassProvider>`}
            />
            ) }]} />
          </div>
        </div>
        <GlassSurface className="playground-inspector" radius={32} blurStrength={18} interactive="light">
        <MaterialControls locale={locale} material={material} setMaterial={setMaterial}>
          <GlassButton size="small" className="share-material" onClick={share}>
            {shareMessage ? <Check size={14} /> : <Link2 size={14} />}
            <span aria-live="polite">
              {shareMessage || (zh ? "分享配置" : "Share configuration")}
            </span>
          </GlassButton>
        </MaterialControls>
        </GlassSurface>
      </div>
  );
}
