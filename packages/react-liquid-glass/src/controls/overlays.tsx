import {
  useId,
  useState,
  type ReactElement,
  type ComponentProps,
  type ReactNode,
} from "react";
import { LiquidPopover, useClosePopover } from "./LiquidPopover";
import { GlassButton } from "./primitives";
import { GlassSegmented, type GlassSegmentItem } from "./GlassSegmented";

export { GlassDialog, GlassSheet, type GlassDialogProps } from "./LiquidDialog";

export interface GlassPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  role?: "dialog" | "menu";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  blurStrength?: number;
}
export function GlassPopover({ trigger, ...props }: GlassPopoverProps) {
  return <LiquidPopover {...props} trigger={<GlassButton>{trigger}</GlassButton>} />;
}
function MenuItem({ item }: { item: { label: string; disabled?: boolean; onSelect: () => void } }) {
  const close = useClosePopover();
  return <button type="button" disabled={item.disabled} role="menuitem" onClick={() => { item.onSelect(); close(); }}>{item.label}</button>;
}
export function GlassDropdownMenu({
  trigger,
  label = "Actions",
  items,
  morphTrigger = false,
}: {
  trigger: ReactNode;
  label?: string;
  items: { label: string; disabled?: boolean; onSelect: () => void }[];
  morphTrigger?: boolean;
}) {
  return (
    <LiquidPopover trigger={<GlassButton>{trigger}</GlassButton>} label={label} role="menu" morphTrigger={morphTrigger}>
      <div
        className="dg-dropdown"
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not([disabled])",
            ),
          ];
          if (!buttons.length) return;
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    buttons.length) %
                  buttons.length
          ].focus();
        }}
      >
        {items.map((item, i) => <MenuItem key={i} item={item} />)}
      </div>
    </LiquidPopover>
  );
}
export { GlassMorphMenu } from "./LiquidMenu";
export function GlassTooltip({ label, children }: {
  label: string;
  children: ReactElement<ComponentProps<"button">>;
}) {
  return <LiquidPopover trigger={children} label={label} role="tooltip" tooltip>{label}</LiquidPopover>;
}
export interface GlassTabsProps {
  items: (GlassSegmentItem & { content?: ReactNode })[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  label?: string;
}
export function GlassTabs({
  items,
  value,
  defaultValue,
  onValueChange,
  label = "Sections",
}: GlassTabsProps) {
  const [local, setLocal] = useState(defaultValue ?? items[0]?.value ?? "");
  const candidate = value ?? local;
  const selected = items.some((item) => item.value === candidate)
    ? candidate
    : items[0]?.value;
  const id = useId();
  const hasContent = items.some(item => item.content != null);
  return (
    <div className="dg-tab-panels">
      <GlassSegmented
        items={items}
        value={selected}
        onValueChange={(next) => {
          setLocal(next);
          onValueChange?.(next);
        }}
        ariaLabel={label}
        tablist
        idPrefix={hasContent ? id : undefined}
      />
      {hasContent && items.map((item) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${id}-panel-${item.value}`}
          aria-labelledby={`${id}-${item.value}`}
          hidden={item.value !== selected}
          tabIndex={0}
          className="dg-tab-panel"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
