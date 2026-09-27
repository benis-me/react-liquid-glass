import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Locale } from "../i18n";
import { Link } from "./router";

/** Guide titles stay in the main bundle for navigation; their content loads with the page. */
export const guideList = [
  { id: "theming", en: "Theming", zh: "主题" },
  { id: "material", en: "Material & HDR", zh: "材质与 HDR" },
  { id: "motion", en: "Motion & gestures", zh: "动态与手势" },
  { id: "renderer", en: "Renderer", zh: "渲染器" },
  { id: "performance", en: "Performance", zh: "性能" },
  { id: "accessibility", en: "Accessibility", zh: "无障碍" },
  { id: "browser-support", en: "Browser support", zh: "浏览器支持" },
  { id: "ssr", en: "Server rendering", zh: "服务端渲染" },
];
export const docsPages = [{ id: "installation", en: "Introduction", zh: "开始使用" }, ...guideList];

export function DocsPagination({ id, locale }: { id: string; locale: Locale }) {
  const zh = locale === "zh", index = docsPages.findIndex(page => page.id === id);
  const previous = docsPages[index - 1], next = docsPages[index + 1];
  const link = (page: (typeof docsPages)[number], icon: ReactNode, after: boolean) => (
    <Link href={`/docs/${page.id}`}>{after ? null : icon}{zh ? page.zh : page.en}{after ? icon : null}</Link>
  );
  return (
    <nav className="doc-pagination" aria-label={zh ? "文档翻页" : "Documentation pages"}>
      {previous ? link(previous, <ArrowLeft size={14} />, false) : <span />}
      {next ? link(next, <ArrowRight size={14} />, true) : <span />}
    </nav>
  );
}
