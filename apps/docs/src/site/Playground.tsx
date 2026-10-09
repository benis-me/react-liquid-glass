import { useEffect, useId, useState } from "react";
import { Check, Link2 } from "lucide-react";
import {
  GlassStage,
  GlassAccordion,
  GlassButton,
  GlassSelect,
  GlassSurface,
  GlassSwitch,
  ScrollArea,
  type GlassBackground,
} from "rglass/controls";
import { LiquidGlassProvider } from "rglass/liquid-glass";
import { subscribeLiquidFrames } from "rglass/liquid-glass/renderer";
import { catalog, componentAliases, type ComponentId } from "./catalog";
import { ComponentExample, PHOTO } from "./ComponentExample";
import type { PageProps } from "./Pages";
import { CodeBlock, PageHeading } from "./ui";
import { Link } from "./router";
import { MaterialControls } from "./MaterialControls";
import type { MaterialState } from "./material";
type Substrate = GlassBackground | "photo" | "color" | "text";
// A colorful, same-origin photo, so dispersion is visible; the building photo stays monochrome.
const COLOR_PHOTO = "/assets/flowers-placeholder.webp";
const DEFAULT_MATERIAL = {};
const SUBSTRATE_TEXT = {
  en: "Glass bends what lies beneath it. Letters stretch along the rim, lines curve toward the edge, and colors part where the surface turns away from the light.",
  zh: "玻璃会弯折其下的一切。文字沿着边缘拉伸，线条向轮廓弯曲，颜色在表面背光转折处分离。",
};

/** Real DOM behind the component, so the glass refracts an actual photo or text. */
function SubstrateLayer({ kind, zh }: { kind: Substrate; zh: boolean }) {
  if (kind === "photo" || kind === "color") return <img className="playground-substrate playground-substrate--photo" src={kind === "color" ? COLOR_PHOTO : PHOTO} alt="" aria-hidden="true" />;
  if (kind === "text") return <div className="playground-substrate playground-substrate--text" aria-hidden="true">{[0, 1, 2].map(index => <p key={index}>{zh ? SUBSTRATE_TEXT.zh : SUBSTRATE_TEXT.en}</p>)}</div>;
  return null;
}

/** Frames presented by every glass canvas on the page; at rest this reads zero. */
function FrameStats({ zh }: { zh: boolean }) {
  const [stats, setStats] = useState({ fps: 0, backend: "" });
  useEffect(() => {
    let frames = 0, last = performance.now();
    const stop = subscribeLiquidFrames(() => { frames++; });
    const timer = setInterval(() => {
      const now = performance.now();
      const canvas = document.querySelector<HTMLCanvasElement>(".playground-main canvas[data-dg-renderer^='liquid-']");
      setStats({ fps: Math.round(frames * 1000 / (now - last)), backend: canvas?.dataset.dgRenderer?.slice(7) ?? "" });
      frames = 0; last = now;
    }, 500);
    return () => { stop(); clearInterval(timer); };
  }, []);
  const backend = stats.backend === "webgpu" ? "WebGPU" : stats.backend === "webgl2" ? "WebGL2" : "—";
  return <output className="frame-stats">{stats.fps} {zh ? "帧/秒" : "frames/s"} · {backend}</output>;
}

function readComponent(): ComponentId | "all" {
  const requested = new URLSearchParams(location.search).get("component");
  const id = componentAliases[requested ?? ""] ?? requested;
  return id === "all" || catalog.some((item) => item.id === id)
    ? (id as ComponentId | "all")
    : "tabs";
}

export function Playground({ locale, theme, material, setMaterial }: PageProps & MaterialState) {
  const uid = useId();
  const [component, setComponent] = useState(readComponent);
  useEffect(() => {
    const update = () => setComponent(readComponent());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const [background, setBackground] = useState<Substrate>("grid"),
    [compare, setCompare] = useState(false),
    [showStats, setShowStats] = useState(false),
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
    history.replaceState(history.state, "", url);
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
        kicker="Playground"
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
                  history.replaceState(history.state, "", url);
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
                  setBackground(event.target.value as Substrate)
                }
              >
                <option value="grid">{zh ? "网格" : "Grid"}</option>
                <option value="lines">{zh ? "条纹" : "Lines"}</option>
                <option value="plain">{zh ? "纯色" : "Plain"}</option>
                <option value="photo">{zh ? "照片" : "Photo"}</option>
                <option value="color">{zh ? "彩色照片" : "Color photo"}</option>
                <option value="text">{zh ? "文字" : "Text"}</option>
              </GlassSelect>
          </div>
          <div className="playground-options">
            {component !== "all" && <span className="playground-option">
              <GlassSwitch id={`${uid}-compare`} size="small" checked={compare} onCheckedChange={setCompare} />
              <label htmlFor={`${uid}-compare`}>{zh ? "与默认对比" : "Compare with defaults"}</label>
            </span>}
            <span className="playground-option">
              <GlassSwitch id={`${uid}-stats`} size="small" checked={showStats} onCheckedChange={setShowStats} />
              <label htmlFor={`${uid}-stats`}>{zh ? "渲染帧率" : "Frame rate"}</label>
            </span>
            {showStats && <FrameStats zh={zh} />}
          </div>
            <div
              className={
                component === "all" ? "playground-all" : "playground-single"
              }
            >
              {selected.map((item) => {
                const stage = (
                  <GlassStage
                    background={background === "photo" || background === "color" || background === "text" ? "plain" : background}
                    className={`component-preview component-preview--${item.id} ${component === "all" ? "component-preview--compact" : ""}`}
                  >
                    <SubstrateLayer kind={background} zh={zh} />
                    <ComponentExample
                      id={item.id}
                      locale={locale}
                      theme={theme}
                      compact={component === "all"}
                    />
                  </GlassStage>
                );
                return compare && component !== "all" ? (
                  <div key={item.id} className="playground-compare">
                    <figure>
                      {/* A fresh provider shows each component's calibrated defaults beside the edited material. */}
                      <LiquidGlassProvider material={DEFAULT_MATERIAL} inherit={false}>{stage}</LiquidGlassProvider>
                      <figcaption>{zh ? "默认材质" : "Default material"}</figcaption>
                    </figure>
                    <figure>
                      {stage}
                      <figcaption>{zh ? "当前材质" : "Your material"}</figcaption>
                    </figure>
                  </div>
                ) : (
                  <div key={item.id}>
                    {stage}
                    <div className="playground-caption">
                      <Link href={`/components/${item.id}`}>{item.name} ↗</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          <div className="playground-code">
            <GlassAccordion headingLevel={2} items={[{ title: zh ? "材质配置" : "Material configuration", content: (
            <CodeBlock
              locale={locale}
              code={`import { LiquidGlassProvider } from "rglass/liquid-glass";\n\n<LiquidGlassProvider material={${JSON.stringify(material, null, 2)}}>\n  {/* Your glass components */}\n</LiquidGlassProvider>`}
            />
            ) }]} />
          </div>
        </div>
        <GlassSurface className="playground-inspector" radius={32} blurStrength={18} interactive="light">
        <ScrollArea className="material-scroll" viewportProps={{ "aria-label": zh ? "玻璃材质参数" : "Glass material parameters" }}>
        <MaterialControls locale={locale} material={material} setMaterial={setMaterial}>
          <GlassButton size="small" className="share-material" onClick={share}>
            {shareMessage ? <Check size={14} /> : <Link2 size={14} />}
            <span aria-live="polite">
              {shareMessage || (zh ? "分享配置" : "Share configuration")}
            </span>
          </GlassButton>
        </MaterialControls>
        </ScrollArea>
        </GlassSurface>
      </div>
  );
}
