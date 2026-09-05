import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { springTo } from "../apple-motion/react";
import { SEGMENTED_RELEASE_SPRING } from "../apple-motion/presets";
import { GlassSurface } from "./GlassSurface";
import { GlassButton } from "./primitives";
import { GlassSegmented, type GlassSegmentItem } from "./GlassSegmented";

export interface GlassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  closeLabel?: string;
}
export function GlassDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeLabel = "Close",
  placement = "dialog",
}: GlassDialogProps & { placement?: "dialog" | "sheet" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const y = useTransform(progress, (value) => (1 - value) * 18);
  const current = useRef(open);
  current.current = open;
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (reduce) {
      progress.jump(open ? 1 : 0);
      if (!open) element.close();
      return;
    }
    const run = springTo(progress, open ? 1 : 0, SEGMENTED_RELEASE_SPRING);
    void run.finished.then(() => {
      if (!current.current) element.close();
    });
    return () => run.stop();
  }, [open, progress, reduce]);
  return (
    <motion.dialog
      ref={dialog}
      className={`dg-dialog dg-dialog--${placement}`}
      style={{ opacity: progress, y }}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        if (current.current) onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <GlassSurface radius={28}>
        <header>
          <h2 id={`${id}-title`}>{title}</h2>
          <button
            className="dg-dismiss"
            type="button"
            aria-label={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </header>
        {description && (
          <p id={`${id}-description`} className="dg-dialog__description">
            {description}
          </p>
        )}
        {children}
      </GlassSurface>
    </motion.dialog>
  );
}
export function GlassSheet(props: GlassDialogProps) {
  return <GlassDialog {...props} placement="sheet" />;
}

export interface GlassPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  role?: "dialog" | "menu";
}
export function GlassPopover({
  trigger,
  children,
  label,
  role = "dialog",
}: GlassPopoverProps) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const position = () => {
    const rect = anchor.current?.getBoundingClientRect(),
      element = panel.current;
    if (!rect || !element) return;
    element.style.left = `${Math.max(12, Math.min(innerWidth - element.offsetWidth - 12, rect.left))}px`;
    const below = rect.bottom + 10;
    element.style.top = `${Math.max(12, below + element.offsetHeight > innerHeight - 12 ? rect.top - element.offsetHeight - 10 : below)}px`;
  };
  useEffect(() => {
    if (!open) return;
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    panel.current
      ?.querySelector<HTMLElement>(
        'button:not([disabled]), input, select, textarea, [tabindex="0"]',
      )
      ?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  return (
    <>
      <span ref={anchor} className="dg-popover-anchor">
        <GlassButton
          popoverTarget={id}
          aria-haspopup={role}
          aria-expanded={open}
        >
          {trigger}
        </GlassButton>
      </span>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role={role}
        aria-label={label}
        className="dg-popover"
        onToggle={(event) =>
          setOpen(event.currentTarget.matches(":popover-open"))
        }
      >
        <GlassSurface radius={22}>{children}</GlassSurface>
      </div>
    </>
  );
}
export function GlassDropdownMenu({
  trigger,
  label = "Actions",
  items,
}: {
  trigger: ReactNode;
  label?: string;
  items: { label: string; disabled?: boolean; onSelect: () => void }[];
}) {
  return (
    <GlassPopover trigger={trigger} label={label} role="menu">
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
        {items.map((item, i) => (
          <button
            type="button"
            key={i}
            disabled={item.disabled}
            role="menuitem"
            onClick={(event) => {
              item.onSelect();
              event.currentTarget
                .closest<HTMLElement>("[popover]")
                ?.hidePopover();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </GlassPopover>
  );
}
export function GlassTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className="dg-tooltip-anchor"
      data-dismissed={dismissed || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") setDismissed(true);
      }}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], id]
          .filter(Boolean)
          .join(" "),
      })}
      <span id={id} role="tooltip" className="dg-tooltip">
        <GlassSurface radius={12}>{label}</GlassSurface>
      </span>
    </span>
  );
}
export interface GlassTabsProps {
  items: (GlassSegmentItem & { content: ReactNode })[];
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
        idPrefix={id}
      />
      {items.map((item) => (
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
