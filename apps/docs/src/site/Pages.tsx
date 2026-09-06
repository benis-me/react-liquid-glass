import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import {
  GlassStage,
  GlassSpotlight,
  GlassButton,
  GlassButtonGroup,
  GlassInput,
  GlassPopover,
} from "refractive-glass-react/controls";
import {
  catalog,
  groups,
  groupZh,
  exampleCode,
  type ComponentId,
} from "./catalog";
import { LiquidGlassProvider, type GlassMaterial } from "refractive-glass-react/liquid-glass";
import { MaterialControls } from "./MaterialControls";
import { sanitizeMaterial } from "./material";
import { ComponentExample, PHOTO } from "./ComponentExample";
import { Link } from "./router";
import type { Locale } from "../i18n";
export type PageProps = { locale: Locale; theme: "light" | "dark" };
export function CodeBlock({
  code,
  label = "React",
  locale = "en",
}: {
  code: string;
  label?: string;
  locale?: Locale;
}) {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus(locale === "zh" ? "已复制" : "Copied");
    } catch {
      setStatus(locale === "zh" ? "请选中代码复制" : "Select the code to copy");
    }
  };
  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span>{label}</span>
        <button type="button" className="plain-button"
          onClick={copy}
          aria-label={locale === "zh" ? "复制代码" : "Copy code"}
        >
          {status ? <Check size={13} /> : <Copy size={13} />}
          <span aria-live="polite">
            {status || (locale === "zh" ? "复制" : "Copy")}
          </span>
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
export function Preview({
  id,
  locale,
  theme,
  compact = false,
}: PageProps & { id: ComponentId; compact?: boolean }) {
  return (
    <GlassStage
      className={`component-preview component-preview--${id} ${compact ? "component-preview--compact" : ""}`}
    >
      <ComponentExample
        id={id}
        locale={locale}
        theme={theme}
        compact={compact}
      />
    </GlassStage>
  );
}
export function Home({ locale, theme }: PageProps) {
  const zh = locale === "zh";
  return (
    <div className="home">
      <section className="home-intro">
        <div className="eyebrow">
          <span className="status-dot" /> React · WebGL · Motion
        </div>
        <h1>
          Liquid Glass
        </h1>
        <p>
          {zh
            ? "React 液态玻璃组件库。"
            : "Liquid glass components for React."}
        </p>
        <div className="page-actions">
          <Link className="link-button link-button--primary" href="/components">
            {zh ? "探索组件" : "Explore components"}
            <ArrowRight size={15} />
          </Link>
          <Link className="link-button" href="/docs/installation">
            {zh ? "开始使用" : "Get started"}
          </Link>
        </div>
      </section>
      <div className="home-hero">
        <GlassSpotlight
          backgroundImage={PHOTO}
          lens={{
            lensW: 118,
            lensH: 118,
            borderRadius: 118,
            chromaAmount: 0.24,
          }}
        />
        <div className="home-hero__label">
          <span>01 / REFRACTION</span>
          <ArrowDown size={16} />
        </div>
      </div>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{zh ? "组件" : "THE COLLECTION"}</span>
            <h2>{zh ? "组件" : "Components"}</h2>
          </div>
          <Link className="text-link" href="/components">
            {zh ? "所有组件" : "All components"}
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="home-controls">
          <Preview id="switch" locale={locale} theme={theme} />
          <Preview id="slider" locale={locale} theme={theme} />
          <Preview id="tabs" locale={locale} theme={theme} />
        </div>
        <div className="home-control-labels">
          <Link href="/components/switch">
            Switch <ArrowRight size={13} />
          </Link>
          <Link href="/components/slider">
            Slider <ArrowRight size={13} />
          </Link>
          <Link href="/components/tabs">
            Tabs <ArrowRight size={13} />
          </Link>
        </div>
      </section>
      <section className="home-section home-playground">
        <div>
          <span className="eyebrow">PLAYGROUND</span>
          <h2>{zh ? "调节材质" : "Tune the material"}</h2>
          <p>
            {zh
              ? "折射、磨砂、色散与高光。"
              : "Refraction, frost, dispersion and light."}
          </p>
          <Link className="text-link" href="/playground">
            {zh ? "打开 Playground" : "Open the playground"}
            <ArrowRight size={15} />
          </Link>
        </div>
        <GlassStage className="home-material">
          <ComponentExample id="button-group" locale={locale} theme={theme} compact />
          <GlassInput aria-label={zh ? "写点什么" : "Write something"} placeholder={zh ? "写点什么…" : "Write something…"} />
          <ComponentExample id="toggle" locale={locale} theme={theme} compact />
        </GlassStage>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {zh ? "小小的实验" : "SMALL EXPERIMENTS"}
            </span>
            <h2>
              {zh
                ? "演示应用"
                : "Showcase"}
            </h2>
          </div>
          <Link className="text-link" href="/showcase">
            {zh ? "体验全部" : "View showcase"}
            <ArrowRight size={15} />
          </Link>
        </div>
        <ShowcaseCards locale={locale} />
      </section>
    </div>
  );
}
export const scenes = [
  {
    id: "focus",
    number: "01",
    name: "Focus",
    zh: "专注舱",
    description: "A timer and local notes.",
    summary: "专注计时与本地笔记。",
    symbol: "25:00",
    tags: "Timer · Local notes",
  },
  {
    id: "sequencer",
    number: "02",
    name: "Glass keys",
    zh: "玻璃音序器",
    description: "An eight-step sequencer.",
    summary: "八步音序器。",
    symbol: "▂ ▆ ▃ █ ▂ ▅ ▇ ▃",
    tags: "Web Audio · Sequencer",
  },
  {
    id: "orbit",
    number: "03",
    name: "Liquid orbit",
    zh: "流体磁场",
    description: "Drag, release, merge.",
    summary: "拖动、释放、融合。",
    symbol: "◯ ◯ ◯",
    tags: "Physics · SDF fusion",
  },
] as const;
export function ShowcaseCards({ locale }: { locale: Locale }) {
  return (
    <div className="showcase-cards">
      {scenes.map((scene) => (
        <Link
          className={`showcase-card showcase-card--${scene.id}`}
          key={scene.id}
          href={`/showcase/${scene.id}`}
        >
          <div className="showcase-card__visual" aria-hidden="true">
            <span>{scene.symbol}</span>
            <small>{scene.number}</small>
          </div>
          <div className="showcase-card__title">
            <h3>{locale === "zh" ? scene.zh : scene.name}</h3>
            <ArrowRight size={16} />
          </div>
          <p>{locale === "zh" ? scene.summary : scene.description}</p>
          <span className="eyebrow">{scene.tags}</span>
        </Link>
      ))}
    </div>
  );
}
export function Catalog({ locale, theme }: PageProps) {
  const [material, setMaterial] = useState<GlassMaterial>(() => {
    try { return sanitizeMaterial(JSON.parse(localStorage.getItem("glass-catalog-material") ?? "{}")); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem("glass-catalog-material", JSON.stringify(material)); } catch {} }, [material]);
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("All");
  const zh = locale === "zh";
  const entries = catalog.filter(
    (item) =>
      (group === "All" || item.group === group) &&
      `${item.name} ${item.zh} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  return (
    <>
      <PageHeading
        kicker={zh ? "组件库" : "COMPONENTS"}
        title={zh ? "组件库" : "Components"}
        description={
          zh
            ? "预览组件，统一调节材质。"
            : "Try the components. Tune the material."
        }
      />
      <div className="catalog-tools">
          <GlassInput className="search-field"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={zh ? "搜索组件…" : "Find a component…"}
            aria-label={zh ? "搜索组件" : "Search components"}
          />
        <div className="filter-scroll">
        <GlassButtonGroup className="filter-list" label={zh ? "分类" : "Categories"}>
          {["All", ...groups].map((value) => (
            <GlassButton size="small"
              key={value}
              aria-pressed={group === value}
              onClick={() => setGroup(value)}
            >
              {zh ? (value === "All" ? "全部" : groupZh[value]) : value}
            </GlassButton>
          ))}
        </GlassButtonGroup>
        </div>
      </div>
      <LiquidGlassProvider material={material}>
      <div className="component-grid">
        {entries.map((entry) => (
          <article className="component-tile" key={entry.id}>
            <Preview id={entry.id} locale={locale} theme={theme} compact />
            <Link
              className="component-tile__label"
              href={`/components/${entry.id}`}
            >
              <span>
                {entry.name}
                <small>{zh ? entry.zh : entry.group}</small>
              </span>
              <ArrowRight size={14} />
            </Link>
          </article>
        ))}
      </div>
      </LiquidGlassProvider>
      <div className="catalog-material">
        <GlassPopover blurStrength={18} label={zh ? "全局材质" : "Global material"} trigger={<><SlidersHorizontal size={15} /><span>{zh ? "材质" : "Material"}</span><small>{Object.keys(material).length ? (zh ? "自定义" : "Custom") : (zh ? "默认" : "Default")}</small></>}>
          <MaterialControls locale={locale} material={material} setMaterial={setMaterial} />
        </GlassPopover>
      </div>
      {!entries.length && (
        <div className="empty-state">
          <p>{zh ? "没有找到匹配的组件。" : "No matching components."}</p>
          <GlassButton
            onClick={() => {
              setQuery("");
              setGroup("All");
            }}
          >
            {zh ? "清除筛选" : "Clear filters"}
          </GlassButton>
        </div>
      )}
    </>
  );
}
export function PageHeading({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      {kicker && <span className="eyebrow">{kicker}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </header>
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
export function ComponentPage({
  id,
  locale,
  theme,
}: PageProps & { id: ComponentId }) {
  const entry = catalog.find((item) => item.id === id)!,
    index = catalog.indexOf(entry),
    zh = locale === "zh";
  const note = keyboardNotes[id];
  return (
    <>
      <div className="breadcrumb">
        <Link href="/components">{zh ? "组件" : "Components"}</Link>
        <span>/</span>
        <span>{entry.name}</span>
      </div>
      <PageHeading
        title={entry.name}
        description={zh ? entry.summary : entry.description}
      >
        <Link className="text-link" href={`/playground?component=${id}`}>
          {zh ? "在 Playground 中调整" : "Tune in playground"}
          <ArrowRight size={14} />
        </Link>
      </PageHeading>
      <section className="doc-section">
        <div className="preview-bar">
          <span>{zh ? "预览" : "Preview"}</span>
        </div>
        <Preview key={id} id={id} locale={locale} theme={theme} />
      </section>
      <section className="doc-section" id="usage">
        <h2>{zh ? "使用方式" : "Usage"}</h2>
        <CodeBlock code={exampleCode(id)} locale={locale} />

      </section>
      <section className="doc-section" id="api">
        <h2>API</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{zh ? "属性" : "Prop"}</th>
                <th>{zh ? "类型" : "Type"}</th>
                <th>{zh ? "默认值" : "Default"}</th>
              </tr>
            </thead>
            <tbody>
              {entry.props.map(([prop, type, fallback]) => (
                <tr key={prop}>
                  <td>
                    <code>{prop}</code>
                  </td>
                  <td>
                    <code>{type}</code>
                  </td>
                  <td>{fallback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {note && <section className="doc-section"><h2>{zh ? "键盘操作" : "Keyboard"}</h2><p>{note[zh ? 1 : 0]}</p></section>}
      <nav
        className="doc-pagination"
        aria-label={zh ? "更多组件" : "More components"}
      >
        {index > 0 ? (
          <Link href={`/components/${catalog[index - 1].id}`}>
            <ArrowLeft size={14} />
            {catalog[index - 1].name}
          </Link>
        ) : (
          <span />
        )}
        {index < catalog.length - 1 && (
          <Link href={`/components/${catalog[index + 1].id}`}>
            {catalog[index + 1].name}
            <ArrowRight size={14} />
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
        kicker={zh ? "文档" : "DOCUMENTATION"}
        title={zh ? "开始使用" : "Get started"}
        description={
          zh
            ? "库是一个独立的 React 包。文档站只是它的一个使用者。"
            : "An independent React package. This documentation site is simply one of its consumers."
        }
      />
      <section className="doc-section">
        <h2>{zh ? "从仓库开始" : "Start from the repository"}</h2>
        <p>
          {zh
            ? "这个版本尚未发布到 npm。你可以在 monorepo 内直接使用，或将构建好的包安装到自己的项目。"
            : "This version is not published to npm yet. Use it within the monorepo, or install a built package in your own project."}
        </p>
        <CodeBlock
          label="Terminal"
          locale={locale}
          code={
            "git clone https://github.com/benis-me/react-liquid-glass.git\ncd react-liquid-glass\nnpm ci\nnpm run dev"
          }
        />
      </section>
      <section className="doc-section">
        <h2>{zh ? "在你的项目中使用" : "Bring it into your project"}</h2>
        <CodeBlock
          label="Terminal"
          locale={locale}
          code={
            "# In this repository\nnpm run build:lib\nnpm pack --workspace refractive-glass-react\n\n# In your React project (use the actual tarball path)\nnpm install /path/to/refractive-glass-react-0.1.0.tgz\nnpm install react@^19 react-dom@^19 motion@^13"
          }
        />
        <CodeBlock
          locale={locale}
          code={
            'import { GlassButton, GlassStage } from "refractive-glass-react/controls";\nimport "refractive-glass-react/controls.css";\n\nexport default function App() {\n  return (\n    <GlassStage style={{ padding: 48 }}>\n      <GlassButton onClick={() => alert("Hello, glass.")}>\n        Hello, glass\n      </GlassButton>\n    </GlassStage>\n  );\n}'
          }
        />
      </section>
      <section className="doc-section">
        <h2>
          {zh ? "材质与动态，分别使用" : "Material and motion, separately"}
        </h2>
        <p>
          {zh
            ? "liquid-glass 负责 SDF、光学材质、融合与渲染资源。apple-motion 负责弹簧、动量与轨迹。controls 将两者组合成可直接使用的组件。"
            : "liquid-glass owns SDF geometry, optics, fusion and rendering resources. apple-motion owns springs, momentum and trajectories. controls composes both into ready-to-use components."}
        </p>
        <CodeBlock
          locale={locale}
          code={
            'import { LiquidGlassProvider } from "refractive-glass-react/liquid-glass";\nimport { stepSpring } from "refractive-glass-react/apple-motion";\nimport { GlassButton } from "refractive-glass-react/controls";\n\n// An interrupted spring retains its current velocity.\nconst state = stepSpring(0, 20, 1, {\n  stiffness: 170, damping: 22, mass: 1,\n}, 1 / 60);\n\n// Empty material preserves every component’s calibrated defaults.\n<LiquidGlassProvider material={{ chromaAmount: 0.24 }}>\n  <GlassButton>Continue</GlassButton>\n</LiquidGlassProvider>;'
          }
        />
        <Link className="text-link" href="/playground">
          {zh
            ? "调整并复制完整的材质配置"
            : "Tune and copy a full material configuration"}
          <ArrowRight size={14} />
        </Link>
      </section>
      <section className="doc-section">
        <h2>
          {zh ? "底图、主题与运行环境" : "Substrates, themes and the runtime"}
        </h2>
        <p>
          {zh
            ? "UI 组件共用 WebGL2 材质与 DOM 底图采样。GlassStage 只提供可见背景；视频和 Spotlight 使用媒体源。采样支持常见内容，并非完整的浏览器画面捕获。"
            : "UI components share the WebGL2 material and DOM backdrop adapter. GlassStage provides a visible background; Video and Spotlight use media sources. The adapter supports common content, not every browser effect."}
        </p>
        <p>
          {zh
            ? "组件样式独立于文档站，支持 color-scheme: light / dark 与 dg-* 变量。现代浏览器需要 WebGL2；对话框和浮层使用原生 dialog / popover。使用受支持的同源或 CORS 媒体。"
            : "Component styles are independent of the docs app and support color-scheme: light / dark and dg-* tokens. A modern browser with WebGL2 is required; overlays use native dialog and popover. Supply same-origin or CORS-enabled media."}
        </p>
      </section>
    </>
  );
}
