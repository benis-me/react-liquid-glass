import { useEffect, useLayoutEffect, useState, type AnchorHTMLAttributes } from "react";

// The document scrolls natively. Each history entry carries a key so Back,
// Forward and reload return to where the reader left that page once it renders.
const SCROLL_KEY = "glass-scroll";
const positions = new Map<string, number>(Object.entries((() => {
  try { return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "{}") as Record<string, number>; } catch { return {}; }
})()).filter(([, top]) => Number.isFinite(top)));
const newKey = () => Math.random().toString(36).slice(2, 10);
const entryKey = (state: unknown) => (state as { key?: string } | null)?.key;
let current = entryKey(history.state) ?? newKey();
let pendingScroll: number | null = positions.get(current) ?? null;
let shownPath = location.pathname;
if (!entryKey(history.state)) history.replaceState({ ...(history.state ?? {}), key: current }, "");
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const traverse = (event: PopStateEvent) => {
  const key = entryKey(event.state);
  if (key === current) return;
  positions.set(current, scrollY);
  const samePage = location.pathname === shownPath;
  shownPath = location.pathname;
  // A fragment link creates a keyless entry; keep the browser's anchor scroll.
  if (!key) {
    current = newKey();
    history.replaceState({ ...(history.state ?? {}), key: current }, "");
    return;
  }
  current = key;
  const target = positions.get(key) ?? 0;
  // Another page restores after it renders; the same page restores right away.
  if (samePage) window.scrollTo({ top: target, behavior: "instant" });
  else pendingScroll = target;
};
const leave = () => {
  positions.delete(current);
  positions.set(current, scrollY);
  try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(Object.fromEntries([...positions].slice(-50)))); } catch { /* Restoration is best effort. */ }
};
window.addEventListener("popstate", traverse);
window.addEventListener("pagehide", leave);
import.meta.hot?.dispose(() => {
  window.removeEventListener("popstate", traverse);
  window.removeEventListener("pagehide", leave);
});

export function navigate(path: string) {
  leave();
  current = newKey();
  history.pushState({ key: current }, "", path);
  const samePage = location.pathname === shownPath;
  shownPath = location.pathname;
  // The same page does not re-render its route; start at its top right away.
  if (samePage) window.scrollTo({ top: 0, behavior: "instant" });
  else pendingScroll = 0;
  window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
}

/** Apply a pending restoration after the page for `path` has rendered. */
export function useScrollRestoration(path: string) {
  useLayoutEffect(() => {
    const target = pendingScroll;
    if (target === null) return;
    pendingScroll = null;
    let frame = 0, attempts = 0;
    // Lazy routes may grow after the first commit; retry briefly until they fit.
    const apply = () => {
      window.scrollTo({ top: target, behavior: "instant" });
      if (Math.abs(scrollY - target) > 1 && ++attempts < 30) frame = requestAnimationFrame(apply);
    };
    apply();
    const cancel = () => cancelAnimationFrame(frame);
    window.addEventListener("wheel", cancel, { once: true, passive: true });
    window.addEventListener("touchstart", cancel, { once: true, passive: true });
    window.addEventListener("keydown", cancel, { once: true });
    return () => {
      cancel();
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [path]);
}

export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return path;
}
export function Link({
  href = "/",
  onClick,
  children,
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      href={href}
      className={`site-link ${className}`}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !props.download && (!props.target || props.target === "_self") &&
          event.button === 0 &&
          href.startsWith("/") && !href.startsWith("//")
        ) {
          event.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}
