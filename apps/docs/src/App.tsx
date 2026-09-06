import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { catalog, groups, groupZh, type ComponentId } from "./site/catalog";
import {
  Catalog,
  ComponentPage,
  Home,
  Installation,
  PageHeading,
  scenes,
  ShowcaseCards,
} from "./site/Pages";
import { Playground } from "./site/Playground";
import { Link, usePath } from "./site/router";
import type { Locale } from "./i18n";
const Focus = lazy(() =>
  import("./showcases/Focus").then((module) => ({ default: module.Focus })),
);
const Sequencer = lazy(() =>
  import("./showcases/Sequencer").then((module) => ({
    default: module.Sequencer,
  })),
);
const Orbit = lazy(() =>
  import("./showcases/Orbit").then((module) => ({ default: module.Orbit })),
);
function saved(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function App() {
  const path = usePath(),
    previousPath = useRef(path),
    main = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    saved("glass-theme") === "dark"
      ? "dark"
      : saved("glass-theme") === "light"
        ? "light"
        : matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
  );
  const [locale, setLocale] = useState<Locale>(() =>
    saved("glass-locale") === "zh" ? "zh" : "en",
  );
  const [mobileOpen, setMobileOpen] = useState(false),
    [search, setSearch] = useState("");
  const zh = locale === "zh",
    pageProps = { locale, theme },
    isHome = path === "/",
    componentId = path.split("/")[2] as ComponentId;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("glass-theme", theme);
    } catch {
      /* Theme still applies without persistence. */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#111111" : "#fafaf9");
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = zh ? "zh-CN" : "en";
    try {
      localStorage.setItem("glass-locale", locale);
    } catch {
      /* Locale still applies without persistence. */
    }
  }, [locale, zh]);
  useEffect(() => {
    if (previousPath.current !== path) {
      previousPath.current = path;
      setMobileOpen(false);
      main.current?.focus({ preventScroll: true });
    }
  }, [path]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const nav = [
    { href: "/components", en: "Components", zh: "组件" },
    { href: "/playground", en: "Playground", zh: "Playground" },
    { href: "/showcase", en: "Showcase", zh: "展示" },
    { href: "/docs/installation", en: "Docs", zh: "文档" },
  ];
  const sidebar = (
    <>
      <div className="sidebar-intro">
        <Link
          aria-current={path === "/docs/installation" ? "page" : undefined}
          href="/docs/installation"
        >
          {zh ? "开始使用" : "Introduction"}
        </Link>
        <Link
          aria-current={path === "/playground" ? "page" : undefined}
          href="/playground"
        >
          Playground
        </Link>
        <Link
          aria-current={path === "/showcase" ? "page" : undefined}
          href="/showcase"
        >
          {zh ? "应用展示" : "Showcase"}
        </Link>
      </div>
      <label className="sidebar-search">
        <Search size={14} />
        <input
          type="search"
          aria-label={zh ? "查找组件" : "Find a component"}
          placeholder={zh ? "查找组件…" : "Find a component…"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {groups.map((group) => {
        const items = catalog.filter(
          (item) =>
            item.group === group &&
            `${item.name} ${item.zh}`
              .toLowerCase()
              .includes(search.toLowerCase().trim()),
        );
        return items.length ? (
          <div className="sidebar-group" key={group}>
            <h2>{zh ? groupZh[group] : group}</h2>
            {items.map((item) => (
              <Link
                key={item.id}
                aria-current={
                  path === `/components/${item.id}` ? "page" : undefined
                }
                href={`/components/${item.id}`}
              >
                {item.name}
                {zh && <span>{item.zh}</span>}
              </Link>
            ))}
          </div>
        ) : null;
      })}
    </>
  );
  let page;
  if (isHome) page = <Home {...pageProps} />;
  else if (path === "/components") page = <Catalog {...pageProps} />;
  else if (
    path.startsWith("/components/") &&
    catalog.some((item) => item.id === componentId) &&
    path === `/components/${componentId}`
  )
    page = <ComponentPage key={componentId} id={componentId} {...pageProps} />;
  else if (path === "/playground") page = <Playground {...pageProps} />;
  else if (path === "/docs/installation")
    page = <Installation {...pageProps} />;
  else if (path === "/showcase")
    page = (
      <>
        <PageHeading
          kicker="SHOWCASE"
          title={zh ? "玻璃的另一面。" : "The playful side of glass."}
          description={
            zh
              ? "几款可以真正使用的小应用。每一块玻璃，都来自同一个核心。"
              : "Small, working applications. Every glass surface comes from the same core."
          }
        />
        <ShowcaseCards locale={locale} />
      </>
    );
  else if (
    path.startsWith("/showcase/") &&
    scenes.some((scene) => path === `/showcase/${scene.id}`)
  ) {
    const scene = scenes.find((scene) => path === `/showcase/${scene.id}`)!;
    page = (
      <>
        <Link className="text-link back-link" href="/showcase">
          <ArrowLeft size={14} />
          {zh ? "所有展示" : "All experiments"}
        </Link>
        <PageHeading
          kicker={`EXPERIMENT ${scene.number}`}
          title={zh ? scene.zh : scene.name}
          description={zh ? scene.summary : scene.description}
        />
        <Suspense
          fallback={
            <div className="scene-loading" role="status">
              {zh ? "正在准备玻璃…" : "Preparing the glass…"}
            </div>
          }
        >
          {scene.id === "focus" ? (
            <Focus {...pageProps} />
          ) : scene.id === "sequencer" ? (
            <Sequencer {...pageProps} />
          ) : (
            <Orbit {...pageProps} />
          )}
        </Suspense>
        <div className="scene-credits">
          <span>
            {zh ? "使用本项目核心构建" : "Built with the project’s own cores"}
          </span>
          <Link href="/docs/installation">
            liquid-glass + apple-motion <ArrowUpRight size={12} />
          </Link>
        </div>
      </>
    );
  } else
    page = (
      <div className="empty-state">
        <span className="eyebrow">404</span>
        <h1>{zh ? "这里还没有玻璃。" : "Nothing through this lens."}</h1>
        <Link className="link-button" href="/components">
          {zh ? "返回组件库" : "Back to components"}
        </Link>
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#main-content">
        {zh ? "跳到内容" : "Skip to content"}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link
            className="wordmark"
            href="/"
            aria-label={
              zh ? "React Liquid Glass 首页" : "React Liquid Glass home"
            }
          >
            <span className="wordmark-symbol" aria-hidden="true">
              ◒
            </span>
            <span>
              liquid glass<span className="wordmark-react"> / react</span>
            </span>
          </Link>
          <nav
            className="top-nav"
            aria-label={zh ? "主导航" : "Main navigation"}
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  path.startsWith(item.href.split("/installation")[0])
                    ? "page"
                    : undefined
                }
              >
                {zh ? item.zh : item.en}
              </Link>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={
                theme === "dark"
                  ? zh
                    ? "切换到浅色"
                    : "Switch to light mode"
                  : zh
                    ? "切换到深色"
                    : "Switch to dark mode"
              }
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="locale-button"
              onClick={() => setLocale(zh ? "en" : "zh")}
              aria-label={zh ? "Switch to English" : "切换到中文"}
            >
              {zh ? "中" : "EN"}
            </button>
            <a
              className="github-link"
              href="https://github.com/benis-me/react-liquid-glass"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              GitHub <ArrowUpRight size={12} />
            </a>
            <button
              className="icon-button mobile-menu-button"
              aria-label={zh ? "导航菜单" : "Navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>
      {mobileOpen && (
        <nav
          id="mobile-navigation"
          className="mobile-navigation"
          aria-label={zh ? "移动导航" : "Mobile navigation"}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
            >
              {zh ? item.zh : item.en}
            </Link>
          ))}
          <div
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a"))
                setMobileOpen(false);
            }}
          >
            {sidebar}
          </div>
        </nav>
      )}
      <div className={isHome ? "site-container" : "site-container docs-layout"}>
        {!isHome && (
          <aside className="docs-sidebar">
            <nav aria-label={zh ? "组件导航" : "Component navigation"}>
              {sidebar}
            </nav>
          </aside>
        )}
        <main
          id="main-content"
          ref={main}
          tabIndex={-1}
          className={isHome ? "home-main" : "docs-main"}
        >
          {page}
        </main>
      </div>
      <footer className="site-footer">
        <Link href="/">React Liquid Glass</Link>

        <a
          href="https://github.com/benis-me/react-liquid-glass"
          target="_blank"
          rel="noreferrer"
        >
          {zh ? "源代码" : "Source code"}
          <ArrowUpRight size={12} />
        </a>
      </footer>
    </>
  );
}
