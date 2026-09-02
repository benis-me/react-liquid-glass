import { lazy, Suspense, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { HeroGlassDemo } from "./HeroGlassDemo";
import { DemoLabel, SectionHeading } from "./demo/Primitives";
import { ControlGallery } from "./demos/ControlGallery";
import { DisplacementPlayground } from "./demos/DisplacementPlayground";
import type { Locale } from "./i18n";

const QrGlassDemo = lazy(() =>
  import("./demos/QrGlassDemo").then((module) => ({ default: module.QrGlassDemo })),
);
const VideoGlassDemo = lazy(() =>
  import("./demos/VideoGlassDemo").then((module) => ({ default: module.VideoGlassDemo })),
);

const HERO_PHOTO_URL =
  "https://images.unsplash.com/photo-1683318854587-3722ba210558?auto=format&fit=crop&w=1800&q=85";

const HERO_LENS = {
  lensW: 140,
  lensH: 140,
  borderRadius: 140,
  depth: 24,
  domeDepth: 140,
  scaleX: 0.075,
  scaleY: 0.075,
  chromaAmount: 0.24,
};

const copy = {
  zh: {
    skip: "跳到主要内容",
    controls: "控件",
    media: "媒体",
    qr: "二维码",
    video: "视频",
    experiment: "实验",
    qrLoading: "正在准备二维码纹理",
    videoLoading: "正在准备视频纹理",
    lightMode: "切换到浅色模式",
    darkMode: "切换到深色模式",
    english: "切换到英文",
    backToTop: "返回顶部",
  },
  en: {
    skip: "Skip to main content",
    controls: "Controls",
    media: "Media",
    qr: "QR code",
    video: "Video",
    experiment: "Experiment",
    qrLoading: "Preparing QR texture",
    videoLoading: "Preparing video texture",
    lightMode: "Switch to light mode",
    darkMode: "Switch to dark mode",
    english: "切换到中文",
    backToTop: "Back to top",
  },
} as const;

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("glass-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem("glass-locale");
    return saved === "en" || saved === "zh" ? saved : "zh";
  });
  const text = copy[locale];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("glass-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#111111" : "#f5f5f3",
    );
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    localStorage.setItem("glass-locale", locale);
  }, [locale]);

  return (
    <>
      <a className="skip-link" href="#main-content">{text.skip}</a>
      <main className="site-main" id="main-content">
        <section className="hero" id="top">
          <div className="hero__visual">
            <HeroGlassDemo lens={HERO_LENS} backgroundImage={HERO_PHOTO_URL} />
          </div>
        </section>

        <section className="page-section" id="controls">
          <SectionHeading title={text.controls} />
          <ControlGallery locale={locale} />
        </section>

        <section className="page-section" id="media">
          <SectionHeading title={text.media} />
          <div className="media-stack">
            <article className="media-panel media-panel--qr">
              <DemoLabel title={text.qr} />
              <div className="media-panel__stage">
                <Suspense fallback={<div className="media-loading" aria-label={text.qrLoading} />}>
                  <QrGlassDemo locale={locale} />
                </Suspense>
              </div>
            </article>
            <article className="media-panel media-panel--video">
              <DemoLabel title={text.video} />
              <Suspense fallback={<div className="media-loading media-loading--video" aria-label={text.videoLoading} />}>
                <VideoGlassDemo locale={locale} />
              </Suspense>
            </article>
          </div>
        </section>

        <section className="page-section" id="lab">
          <SectionHeading title={text.experiment} />
          <DisplacementPlayground backgroundImage={HERO_PHOTO_URL} locale={locale} />
        </section>

        <footer className="site-footer">
          <div className="footer-tools">
            <button
              className="footer-tool footer-theme"
              type="button"
              aria-label={theme === "dark" ? text.lightMode : text.darkMode}
              title={theme === "dark" ? text.lightMode : text.darkMode}
              onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <button
              className="footer-tool footer-language"
              type="button"
              aria-label={text.english}
              onClick={() => setLocale((current) => current === "zh" ? "en" : "zh")}
            >
              {locale === "zh" ? "中" : "EN"}
            </button>
          </div>
          <a href="#top">{text.backToTop}</a>
        </footer>
      </main>
    </>
  );
}
