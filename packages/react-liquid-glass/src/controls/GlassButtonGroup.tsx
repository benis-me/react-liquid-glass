import { type HTMLAttributes } from "react";
import { FusionTriggerContext, GlassSurface } from "./GlassSurface";

export interface GlassButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  orientation?: "horizontal" | "vertical";
}

// The group owns the optical body; its buttons retain their native actions and press feedback.
const joinedSurface = () => {};

export function GlassButtonGroup({
  label, orientation = "horizontal", children, className = "", onKeyDown, ...props
}: GlassButtonGroupProps) {
  return (
    <div {...props} role="group" aria-label={label} className={`dg-button-group ${className}`}
      data-orientation={orientation}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const group = event.currentTarget;
        const target = event.target as HTMLElement;
        if (target.closest(".dg-button-group") !== group) return;
        const controls = [...group.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
          .filter(item => item.closest(".dg-button-group") === group && item.getAttribute("aria-disabled") !== "true" && !item.closest("[inert]") && item.getClientRects().length);
        const index = controls.indexOf(target.closest("button, a") as HTMLElement);
        if (index < 0) return;
        const rtl = getComputedStyle(group).direction === "rtl";
        const nextKey = orientation === "vertical" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
        const previousKey = orientation === "vertical" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
        const next = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1
          : event.key === nextKey ? (index + 1) % controls.length
          : event.key === previousKey ? (index - 1 + controls.length) % controls.length : -1;
        if (next >= 0) { event.preventDefault(); controls[next]?.focus(); }
      }}>
      <GlassSurface radius={18}>
        <FusionTriggerContext.Provider value={joinedSurface}>
          <div className="dg-button-group__items">{children}</div>
        </FusionTriggerContext.Provider>
      </GlassSurface>
    </div>
  );
}
