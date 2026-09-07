import { useCallback, type ComponentProps } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

export interface ScrollAreaProps extends Omit<ComponentProps<typeof ScrollAreaPrimitive.Root>, "asChild" | "type"> {
  orientation?: "vertical" | "horizontal" | "both";
  viewportProps?: ComponentProps<typeof ScrollAreaPrimitive.Viewport>;
  contentClassName?: string;
}

/** Native scrolling with overlay thumbs, visible only while the area is hovered. */
export function ScrollArea({ children, className = "", orientation = "vertical", viewportProps, contentClassName = "", scrollHideDelay = 160, ...props }: ScrollAreaProps) {
  const { className: viewportClassName = "", ...viewport } = viewportProps ?? {};
  const containWheel = useCallback((bar: HTMLDivElement | null) => {
    if (!bar) return;
    // Radix tracks sit outside the viewport, so its overscroll containment does
    // not cover a wheel gesture over the thumb that runs past either boundary.
    const contain = (event: WheelEvent) => {
      if (bar.dataset.orientation === "vertical" ? event.deltaY : event.deltaX) event.preventDefault();
    };
    bar.addEventListener("wheel", contain, { passive: false });
    return () => bar.removeEventListener("wheel", contain);
  }, []);
  return (
    <ScrollAreaPrimitive.Root {...props} type="hover" scrollHideDelay={scrollHideDelay}
      className={`dg-scroll-area ${className}`} data-axis={orientation}>
      <ScrollAreaPrimitive.Viewport tabIndex={0} {...viewport} className={`dg-scroll-area__viewport ${viewportClassName}`}>
        <div className={`dg-scroll-area__content ${contentClassName}`}>{children}</div>
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" && <ScrollAreaPrimitive.Scrollbar ref={containWheel} orientation="vertical" className="dg-scroll-area__bar">
        <ScrollAreaPrimitive.Thumb className="dg-scroll-area__thumb" />
      </ScrollAreaPrimitive.Scrollbar>}
      {orientation !== "vertical" && <ScrollAreaPrimitive.Scrollbar ref={containWheel} orientation="horizontal" className="dg-scroll-area__bar">
        <ScrollAreaPrimitive.Thumb className="dg-scroll-area__thumb" />
      </ScrollAreaPrimitive.Scrollbar>}
      {orientation === "both" && <ScrollAreaPrimitive.Corner className="dg-scroll-area__corner" />}
    </ScrollAreaPrimitive.Root>
  );
}
