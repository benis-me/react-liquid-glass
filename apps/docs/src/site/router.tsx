import { useEffect, useState, type AnchorHTMLAttributes } from "react";
import { GlassSurface } from "refractive-glass-react/controls";
import { usePointerReleaseFallback } from "refractive-glass-react/apple-motion/react";
export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" });
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
  const [pressed, setPressed] = useState(false);
  const { arm, disarm } = usePointerReleaseFallback(() => setPressed(false));
  return (
    <a
      {...props}
      href={href}
      className={`site-link ${className}`}
      onPointerDown={event => { props.onPointerDown?.(event); if (!event.defaultPrevented && event.button === 0) { setPressed(true); arm(event.pointerId); } }}
      onPointerUp={event => { disarm(); setPressed(false); props.onPointerUp?.(event); }}
      onPointerLeave={event => { setPressed(false); props.onPointerLeave?.(event); }}
      onBlur={event => { setPressed(false); props.onBlur?.(event); }}
      onKeyDown={event => { props.onKeyDown?.(event); if (event.key === "Enter" && !event.defaultPrevented) setPressed(true); }}
      onKeyUp={event => { setPressed(false); props.onKeyUp?.(event); }}
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
      <GlassSurface className="site-link__surface" radius={12} pressed={pressed}>{children}</GlassSurface>
    </a>
  );
}
