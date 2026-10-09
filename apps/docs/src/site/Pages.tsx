import { memo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  GlassStage,
  GlassSpotlight,
  GlassTabs,
  GlassInput,
  GlassPopover,
  GlassSlider,
  ScrollArea,
} from "rglass/controls";
import { LiquidGlassProvider, type GlassMaterial } from "rglass/liquid-glass";
import { catalog, groups, groupZh, exampleCode, type ComponentId } from "./catalog";
import { MaterialControls } from "./MaterialControls";
import type { MaterialState } from "./material";
import { ComponentExample, PHOTO, PHOTO_SIZES, PHOTO_SRCSET } from "./ComponentExample";
import { propNote } from "./prop-notes";
import { Link } from "./router";
import { CodeBlock, InstallCommand, PageHeading, SectionHeading } from "./ui";
import type { Locale } from "../i18n";

export { CodeBlock, PageHeading } from "./ui";
export type PageProps = { locale: Locale; theme: "light" | "dark" };

export function Preview({
  id,
  locale,
  theme,
  compact = false,
  pulse = false,
}: PageProps & { id: ComponentId; compact?: boolean; pulse?: boolean }) {
  return (
    <GlassStage className={`component-preview component-preview--${id} ${compact ? "component-preview--compact" : ""}`}>
      <ComponentExample id={id} locale={locale} theme={theme} compact={compact} pulse={pulse} />
    </GlassStage>
  );
}

/** A live specimen in the home collection, with a plain link to its page. */
function Specimen({ id, locale, theme, pulse, compact, variant = id }: PageProps & { id: ComponentId; pulse?: boolean; compact?: boolean; variant?: string }) {
  const entry = catalog.find(item => item.id === id)!;
  return (
    <div className={`specimen specimen--${variant}`}>
      <Preview id={id} locale={locale} theme={theme} compact={compact} pulse={pulse} />
      <Link className="specimen__label" href={`/components/${id}`}>
        {entry.name}<ArrowUpRight aria-hidden="true" />
      </Link>
    </div>
  );
}

const demoFields = [
  { key: "refractionStrength", en: "Refraction", zh: "折射", min: 0, max: .4, step: .01, initial: .2 },
  { key: "blurStrength", en: "Frost", zh: "磨砂", min: 0, max: 8, step: .1, initial: .2 },
  { key: "chromaAmount", en: "Dispersion", zh: "色散", min: 0, max: 1.5, step: .01, initial: .33 },
] as const;
type DemoKey = (typeof demoFields)[number]["key"];

/** Three live material values on the Lines substrate. Local to this page; the Playground keeps the full set. */
const MaterialDemo = memo(function MaterialDemo({ locale, theme }: PageProps) {
  const zh = locale === "zh";
  const [material, setMaterial] = useState<Partial<Record<DemoKey, number>>>({});
  return (
    <div className="material-demo">
      <LiquidGlassProvider material={material as GlassMaterial}>
        <GlassStage className="material-demo__stage" background="lines">
          <ComponentExample id="button-group" locale={locale} theme={theme} compact />
          <GlassInput aria-label={zh ? "写点什么" : "Write something"} placeholder={zh ? "写点什么…" : "Write something…"} />
          <ComponentExample id="toggle" locale={locale} theme={theme} compact />
        </GlassStage>
      </LiquidGlassProvider>
      <div className="material-demo__panel">
        <header>
          <h3>{zh ? "材质" : "Material"}</h3>
          <button type="button" className="plain-button" onClick={() => setMaterial({})} disabled={!Object.keys(material).length}
            aria-label={zh ? "恢复默认材质" : "Restore the default material"}>
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </header>
        {demoFields.map(field => {
          const value = material[field.key] ?? field.initial;
          return (
            <label className="material-demo__field" key={field.key}>
              <span>{zh ? field.zh : field.en}<output>{value.toFixed(2)}</output></span>
              <GlassSlider min={field.min} max={field.max} step={field.step} value={value}
                ariaLabel={zh ? field.zh : field.en}
                onValueChange={next => setMaterial(current => ({ ...current, [field.key]: next }))} />
            </label>
          );
        })}
        <Link className="text-link" href="/playground">{zh ? "全部 21 个参数" : "All 21 parameters"}<ArrowRight /></Link>
      </div>
    </div>
  );
});

export function Home({ locale, theme }: PageProps) {
  const zh = locale === "zh";
  return (
    <div className="home">
      <section className="hero">
        <h1>Liquid Glass</h1>
        <p>
          {zh
            ? "React 液态玻璃组件：WebGPU 实时折射，静止与运动共用一种材质，形体可以彼此融合。"
            : "Liquid glass components for React, with real refraction on WebGPU, one material at rest and in motion, and shapes that fuse."}
        </p>
        <div className="hero-actions">
          <Link className="button button--primary" href="/components">
            {zh ? "探索组件" : "Explore components"}<ArrowRight aria-hidden="true" />
          </Link>
          <Link className="button" href="/docs/installation">{zh ? "开始使用" : "Get started"}</Link>
          <InstallCommand locale={locale} />
        </div>
      </section>
      <div className="hero-visual">
        <GlassSpotlight
          backgroundImage={PHOTO}
          backgroundSrcSet={PHOTO_SRCSET}
          backgroundSizes={PHOTO_SIZES}
          lens={{ lensW: 118, lensH: 118, borderRadius: 118, chromaAmount: 0.24 }}
        />
      </div>

      <section className="home-section" aria-labelledby="home-collection">
        <SectionHeading id="home-collection" eyebrow={zh ? "组件" : "The collection"} title={zh ? "组件" : "Components"}
          link={{ href: "/components", label: zh ? `全部 ${catalog.length} 个组件` : `All ${catalog.length} components` }} />
        <div className="bento">
          <Specimen id="morph-menu" variant="menu" locale={locale} theme={theme} compact />
          <Specimen id="switch" locale={locale} theme={theme} pulse />
          <Specimen id="slider" locale={locale} theme={theme} />
          <Specimen id="tabs" locale={locale} theme={theme} />
          <Specimen id="glass-group" locale={locale} theme={theme} />
          <Specimen id="button" locale={locale} theme={theme} />
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-material">
        <SectionHeading id="home-material" eyebrow="Playground" title={zh ? "调节材质" : "Tune the material"}
          link={{ href: "/playground", label: zh ? "打开 Playground" : "Open the playground" }} />
        <MaterialDemo locale={locale} theme={theme} />
      </section>

      <section className="home-section" aria-labelledby="home-showcase">
        <SectionHeading id="home-showcase" eyebrow={zh ? "小小的实验" : "Small experiments"} title={zh ? "应用展示" : "Showcase"}
          link={{ href: "/showcase", label: zh ? "全部展示" : "View showcase" }} />
        <ShowcaseCards locale={locale} />
      </section>

      <section className="home-section" aria-labelledby="home-start">
        <SectionHeading id="home-start" eyebrow={zh ? "开始使用" : "Get started"} title={zh ? "两步接入" : "Two steps in"}
          link={{ href: "/docs/installation", label: zh ? "阅读文档" : "Read the docs" }} />
        <div className="start-steps">
          <div className="start-step">
            <h3><span>1</span>{zh ? "安装" : "Install"}</h3>
            <CodeBlock label="Terminal" locale={locale} code="npm install rglass react@^19 react-dom@^19 motion@^13" />
          </div>
          <div className="start-step">
            <h3><span>2</span>{zh ? "使用" : "Use"}</h3>
            <CodeBlock locale={locale} code={'import { GlassButton } from "rglass/controls";\nimport "rglass/controls.css";\n\n<GlassButton>Continue</GlassButton>;'} />
          </div>
        </div>
      </section>
    </div>
  );
}

export const scenes = [
  { id: "focus", number: "01", name: "Focus", zh: "专注舱", description: "A timer and local notes.", summary: "专注计时与本地笔记。", tags: "Timer · Local notes" },
  { id: "sequencer", number: "02", name: "Glass keys", zh: "玻璃音序器", description: "An eight-step sequencer.", summary: "八步音序器。", tags: "Web Audio · Sequencer" },
  { id: "orbit", number: "03", name: "Liquid orbit", zh: "流体磁场", description: "Drag, release, merge.", summary: "拖动、释放、融合。", tags: "Physics · SDF fusion" },
] as const;

// Each thumbnail is a small diagram of the app itself: its clock, its opening pattern, its three bodies.
const SEQUENCE = [8, 0, 4, 0, 2, 4, 1, 2];
function ShowcaseThumb({ id }: { id: (typeof scenes)[number]["id"] }) {
  if (id === "focus") return <span className="numeric">25:00</span>;
  if (id === "sequencer") return (
    <svg width="108" height="52" viewBox="0 0 108 52" aria-hidden="true">
      {SEQUENCE.flatMap((mask, column) => [0, 1, 2, 3].map(row => (
        <rect key={`${column}-${row}`} x={column * 14} y={row * 14} width="10" height="10" rx="3"
          fill="currentColor" opacity={mask & (1 << row) ? 1 : .14} />
      )))}
    </svg>
  );
  return (
    <svg width="112" height="48" viewBox="0 0 112 48" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="22" cy="24" r="15" /><circle cx="55" cy="24" r="20" /><circle cx="89" cy="24" r="14" />
    </svg>
  );
}

/** The showcase index; its heading level follows the page it sits on. */
export function ShowcaseCards({ locale, headingLevel = 3 }: { locale: Locale; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <ol className="showcase-list">
      {scenes.map(scene => (
        <li key={scene.id}>
          <Link className={`showcase-row showcase-row--${scene.id}`} href={`/showcase/${scene.id}`}>
            <span className="showcase-row__number">{scene.number}</span>
            <span className="showcase-row__title">
              <Heading>{locale === "zh" ? scene.zh : scene.name}</Heading>
              <span>{locale === "zh" ? scene.summary : scene.description} <span className="visually-hidden">{scene.tags}</span></span>
            </span>
            <span className="showcase-row__visual" aria-hidden="true"><ShowcaseThumb id={scene.id} /></span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function Catalog({ locale, theme, material, setMaterial }: PageProps & MaterialState) {
  const [group, setGroup] = useState("All");
  const zh = locale === "zh";
  const entries = catalog.filter(item => group === "All" || item.group === group);
  return (
    <>
      <PageHeading
        kicker={zh ? "组件库" : "Library"}
        title={zh ? "组件" : "Components"}
        description={zh ? "预览组件，统一调节材质。" : "Try the components. Tune the material."}
        meta={zh ? `${catalog.length} 个组件 · ${groups.length} 个分类` : `${catalog.length} components · ${groups.length} categories`}
      />
      <div className="catalog-tools">
        <ScrollArea className="filter-scroll" orientation="horizontal" viewportProps={{ "aria-label": zh ? "分类" : "Categories" }}>
          <GlassTabs label={zh ? "分类" : "Categories"} value={group} onValueChange={setGroup}
            items={["All", ...groups].map(value => ({ value, label: zh ? (value === "All" ? "全部" : groupZh[value]) : value }))}
          />
        </ScrollArea>
      </div>
      {/* Names the grid in the outline, so specimen headings nest beneath it. */}
      <h2 className="visually-hidden">{group === "All" ? (zh ? "全部组件" : "All components") : zh ? groupZh[group] : group}</h2>
      <div className="component-grid">
        {entries.map(entry => (
          <article className="component-tile" key={entry.id}>
            <Preview id={entry.id} locale={locale} theme={theme} compact />
            <Link className="component-tile__label" href={`/components/${entry.id}`}>
              <span>{entry.name}<small>{zh ? entry.zh : entry.group}</small></span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      <div className="catalog-material">
        <GlassPopover radius={32} blurStrength={18} label={zh ? "全局材质" : "Global material"} trigger={<><SlidersHorizontal size={15} /><span>{zh ? "材质" : "Material"}</span><small>{Object.keys(material).length ? (zh ? "自定义" : "Custom") : (zh ? "默认" : "Default")}</small></>}>
          <MaterialControls locale={locale} material={material} setMaterial={setMaterial} />
        </GlassPopover>
      </div>
    </>
  );
}

const keyboardNotes: Partial<Record<ComponentId, [string, string]>> = {
  "button-group": [
    "Arrow keys move focus. Home / End jump to either end; Enter / Space runs the focused action. Disabled buttons are skipped.",
    "方向键移动焦点，Home / End 跳到首尾，Enter / 空格执行当前操作。自动跳过禁用按钮。",
  ],
  slider: [
    "Use the arrow keys to adjust, Home / End to jump to the bounds. Click the track or drag the thumb.",
    "方向键微调，Home / End 跳到边界。点击轨道或直接拖动滑块。",
  ],
  tabs: [
    "Arrow keys move between tabs. Each tab is linked to its panel with aria-controls.",
    "方向键切换标签，每个标签通过 aria-controls 连接内容面板。",
  ],
  dialog: [
    "Focus stays inside the dialog. Escape or the backdrop dismisses it and focus returns to its trigger.",
    "焦点保留在对话框内。Escape 或点击背景关闭，并将焦点还给触发按钮。",
  ],
  sheet: [
    "The sheet uses a native modal dialog. Escape closes it; keyboard focus stays inside while open.",
    "侧边面板基于原生模态对话框。Escape 关闭，打开时焦点保留在内部。",
  ],
  "dropdown-menu": [
    "Arrow keys navigate actions; Home / End jump to the first / last. Escape dismisses the menu.",
    "方向键遍历操作，Home / End 跳到首尾。Escape 关闭菜单。",
  ],
  video: [
    "Focus the seek bar and use arrow keys to seek 5 seconds, or Home / End for the bounds. Pointer release outside the player is handled.",
    "聚焦进度条后，方向键跳转 5 秒，Home / End 跳至首尾。支持在播放器外释放拖动。",
  ],
};

export function ComponentPage({ id, locale, theme }: PageProps & { id: ComponentId }) {
  const entry = catalog.find(item => item.id === id)!,
    index = catalog.indexOf(entry),
    zh = locale === "zh";
  const note = keyboardNotes[id];
  const previous = catalog[index - 1], next = catalog[index + 1];
  return (
    <>
      <nav className="breadcrumb" aria-label={zh ? "路径" : "Breadcrumb"}>
        <Link href="/components">{zh ? "组件" : "Components"}</Link>
        <span aria-hidden="true">/</span>
        <span>{zh ? groupZh[entry.group] : entry.group}</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{entry.name}</span>
      </nav>
      <PageHeading title={entry.name} description={zh ? entry.summary : entry.description}>
        <Link className="text-link" href={`/playground?component=${id}`}>
          {zh ? "在 Playground 中调整" : "Tune in playground"}<ArrowRight aria-hidden="true" />
        </Link>
      </PageHeading>
      <section className="doc-section component-hero" aria-label={zh ? "预览" : "Preview"}>
        <Preview key={id} id={id} locale={locale} theme={theme} />
      </section>
      <section className="doc-section" id="usage">
        <h2>{zh ? "使用方式" : "Usage"}</h2>
        <CodeBlock code={exampleCode(id)} locale={locale} />
      </section>
      <section className="doc-section" id="api">
        <h2>API</h2>
        <ScrollArea className="table-scroll" orientation="horizontal" viewportProps={{ "aria-label": "API" }}>
          <table>
            <thead>
              <tr>
                <th>{zh ? "属性" : "Prop"}</th>
                <th>{zh ? "类型" : "Type"}</th>
                <th>{zh ? "默认值" : "Default"}</th>
                <th>{zh ? "说明" : "Description"}</th>
              </tr>
            </thead>
            <tbody>
              {entry.props.map(([prop, type, fallback]) => (
                <tr key={prop}>
                  <td><code>{prop}</code></td>
                  <td><code>{type}</code></td>
                  <td>{fallback}</td>
                  <td className="api-description">{propNote(id, prop)?.[zh ? 1 : 0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </section>
      {note && <section className="doc-section"><h2>{zh ? "键盘操作" : "Keyboard"}</h2><p>{note[zh ? 1 : 0]}</p></section>}
      <nav className="doc-pagination" aria-label={zh ? "更多组件" : "More components"}>
        {previous ? (
          <Link href={`/components/${previous.id}`} rel="prev">
            <small>{zh ? "上一个" : "Previous"}</small>
            <span><ArrowLeft size={16} aria-hidden="true" />{previous.name}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/components/${next.id}`} rel="next">
            <small>{zh ? "下一个" : "Next"}</small>
            <span>{next.name}<ArrowRight size={16} aria-hidden="true" /></span>
          </Link>
        )}
      </nav>
    </>
  );
}

export function Installation({ locale }: PageProps) {
  const zh = locale === "zh";
  return (
    <>
      <PageHeading
        kicker={zh ? "文档" : "Documentation"}
        title={zh ? "开始使用" : "Get started"}
        description={zh ? "库是一个独立的 React 包。文档站只是它的一个使用者。" : "An independent React package. This documentation site is simply one of its consumers."}
      />
      <section className="doc-section">
        <h2>{zh ? "在你的项目中使用" : "Bring it into your project"}</h2>
        <CodeBlock label="Terminal" locale={locale} code="npm install rglass react@^19 react-dom@^19 motion@^13" />
        <CodeBlock
          locale={locale}
          code={'import { GlassButton, GlassStage } from "rglass/controls";\nimport "rglass/controls.css";\n\nexport default function App() {\n  return (\n    <GlassStage style={{ padding: 48 }}>\n      <GlassButton onClick={() => alert("Hello, glass.")}>\n        Hello, glass\n      </GlassButton>\n    </GlassStage>\n  );\n}'}
        />
      </section>
      <section className="doc-section">
        <h2>{zh ? "从仓库开始" : "Start from the repository"}</h2>
        <p>
          {zh
            ? "克隆仓库可在本地运行文档和示例。"
            : "Clone the repository to run the docs and examples locally."}
        </p>
        <CodeBlock label="Terminal" locale={locale} code={"git clone https://github.com/benis-me/react-liquid-glass.git\ncd react-liquid-glass\nnpm ci\nnpm run dev"} />
      </section>
      <section className="doc-section">
        <h2>{zh ? "材质与动态，分别使用" : "Material and motion, separately"}</h2>
        <p>
          {zh
            ? "liquid-glass 负责 SDF、光学材质、融合与渲染资源。apple-motion 负责弹簧、动量与轨迹。controls 将两者组合成可直接使用的组件。"
            : "liquid-glass owns SDF geometry, optics, fusion and rendering resources. apple-motion owns springs, momentum and trajectories. controls composes both into ready-to-use components."}
        </p>
        <CodeBlock
          locale={locale}
          code={'import { LiquidGlassProvider } from "rglass/liquid-glass";\nimport { stepSpring } from "rglass/apple-motion";\nimport { GlassButton } from "rglass/controls";\n\n// An interrupted spring retains its current velocity.\nconst state = stepSpring(0, 20, 1, {\n  stiffness: 170, damping: 22, mass: 1,\n}, 1 / 60);\n\n// Empty material preserves every component’s calibrated defaults.\n<LiquidGlassProvider material={{ chromaAmount: 0.24 }}>\n  <GlassButton>Continue</GlassButton>\n</LiquidGlassProvider>;'}
        />
        <Link className="text-link" href="/playground">
          {zh ? "调整并复制完整的材质配置" : "Tune and copy a full material configuration"}<ArrowRight aria-hidden="true" />
        </Link>
      </section>
      <section className="doc-section">
        <h2>{zh ? "底图、主题与运行环境" : "Substrates, themes and the runtime"}</h2>
        <p>
          {zh
            ? "UI 组件共用 WebGPU 材质与 DOM 底图采样，并保留 WebGL2 回退。GlassStage 只提供可见背景；视频和 Spotlight 使用媒体源。采样支持常见内容，并非完整的浏览器画面捕获。"
            : "UI components share the WebGPU material and DOM backdrop adapter, with WebGL2 fallback. GlassStage provides a visible background; Video and Spotlight use media sources. The adapter supports common content, not every browser effect."}
        </p>
        <p>
          {zh
            ? "组件样式独立于文档站，支持 color-scheme: light / dark 与 dg-* 变量。浏览器需要支持 WebGPU 或 WebGL2；对话框和浮层使用原生 dialog / popover。使用受支持的同源或 CORS 媒体。"
            : "Component styles are independent of the docs app and support color-scheme: light / dark and dg-* tokens. A browser with WebGPU or WebGL2 is required; overlays use native dialog and popover. Supply same-origin or CORS-enabled media."}
        </p>
      </section>
    </>
  );
}
