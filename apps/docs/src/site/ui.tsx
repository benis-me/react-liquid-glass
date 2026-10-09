import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { ScrollArea } from "rglass/controls";
import { Link } from "./router";
import type { Locale } from "../i18n";

/** Swaps icons as one object changing: a short blur, scale and fade on a critically damped spring. */
export function IconSwap({ id, children }: { id: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const hidden = { opacity: 0, scale: .25, filter: "blur(4px)" };
  return (
    <span className="icon-swap" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span key={id} style={{ display: "grid" }}
          initial={hidden} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={hidden}
          transition={reduce ? { duration: 0 } : { type: "spring", duration: .3, bounce: 0 }}>
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Copies text and confirms in place; the confirmation clears on its own. */
function useCopy(text: string) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("failed"); }
  };
  return [state, copy] as const;
}

export function CodeBlock({ code, label = "React", locale = "en" }: { code: string; label?: string; locale?: Locale }) {
  const zh = locale === "zh";
  const [state, copy] = useCopy(code);
  const status = state === "copied" ? (zh ? "已复制" : "Copied") : state === "failed" ? (zh ? "请选中代码复制" : "Select the code to copy") : "";
  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span>{label}</span>
        <button type="button" className="plain-button" onClick={copy} aria-label={zh ? "复制代码" : "Copy code"}>
          <IconSwap id={state === "copied" ? "check" : "copy"}>{state === "copied" ? <Check /> : <Copy />}</IconSwap>
          <span aria-live="polite">{status || (zh ? "复制" : "Copy")}</span>
        </button>
      </div>
      <ScrollArea orientation="horizontal" viewportProps={{ "aria-label": label }}>
        <pre><code>{code}</code></pre>
      </ScrollArea>
    </div>
  );
}

export function InstallCommand({ locale, command = "npm install rglass" }: { locale: Locale; command?: string }) {
  const zh = locale === "zh";
  const [state, copy] = useCopy(command);
  return (
    <div className="install-command">
      <code>{command}</code>
      <button type="button" className="plain-button" onClick={copy} aria-label={zh ? "复制安装命令" : "Copy install command"}>
        <IconSwap id={state === "copied" ? "check" : "copy"}>{state === "copied" ? <Check /> : <Copy />}</IconSwap>
      </button>
      <span className="visually-hidden" aria-live="polite">{state === "copied" ? (zh ? "已复制" : "Copied") : ""}</span>
    </div>
  );
}

export function PageHeading({ kicker, title, description, meta, children }: {
  kicker?: string; title: string; description?: string; meta?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      {kicker && <span className="eyebrow">{kicker}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {meta && <div className="page-heading__meta">{meta}</div>}
      {children}
    </header>
  );
}

export function SectionHeading({ id, eyebrow, title, link }: {
  id: string; eyebrow?: string; title: string; link?: { href: string; label: string };
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={id}>{title}</h2>
      </div>
      {link && <Link className="text-link" href={link.href}>{link.label}<ArrowRight /></Link>}
    </div>
  );
}
