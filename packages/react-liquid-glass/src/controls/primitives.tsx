import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { LiquidPopover, useClosePopover } from "./LiquidPopover";
import { usePointerReleaseFallback } from "../apple-motion/react";
import { GlassSurface } from "./GlassSurface";

export interface GlassButtonProps extends ComponentProps<"button"> {
  variant?: "default" | "solid" | "ghost";
  size?: "small" | "default" | "large";
}
export function GlassButton({
  children,
  className = "",
  variant = "default",
  size = "default",
  disabled,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onBlur,
  onKeyDown,
  onKeyUp,
  ...props
}: GlassButtonProps) {
  const [pressed, setPressed] = useState(false);
  const { arm, disarm } = usePointerReleaseFallback(() => setPressed(false));
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={disabled}
      className={`dg-button ${className}`}
      data-variant={variant}
      data-size={size}
      data-pressed={pressed || undefined}
      onPointerDown={(event) => {
        if (!disabled && event.button === 0) {
          setPressed(true);
          arm(event.pointerId);
        }
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        disarm();
        setPressed(false);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        disarm();
        setPressed(false);
        onPointerCancel?.(event);
      }}
      onPointerLeave={(event) => {
        setPressed(false);
        onPointerLeave?.(event);
      }}
      onBlur={(event) => {
        setPressed(false);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (!disabled && [" ", "Enter"].includes(event.key)) setPressed(true);
        onKeyDown?.(event);
      }}
      onKeyUp={(event) => {
        setPressed(false);
        onKeyUp?.(event);
      }}
    >
      <GlassSurface pressed={pressed} radius={size === "small" ? 12 : 16}>
        {children}
      </GlassSurface>
    </button>
  );
}
export function GlassCard({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <article {...props} className={`dg-card ${className}`}>
      <GlassSurface radius={24}>{children}</GlassSurface>
    </article>
  );
}
export function GlassBadge({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} className={`dg-badge ${className}`}>
      <GlassSurface radius={20}>{children}</GlassSurface>
    </span>
  );
}
export interface GlassInputProps extends ComponentProps<"input"> {
  label?: string;
  description?: string;
}
export function GlassInput({
  label,
  description,
  id: suppliedId,
  className = "",
  ...props
}: GlassInputProps) {
  const id = useId(),
    inputId = suppliedId ?? id;
  return (
    <label className={`dg-field ${className}`} htmlFor={inputId}>
      {label && <span className="dg-field__label">{label}</span>}
      <GlassSurface radius={22}>
        <input
          {...props}
          id={inputId}
          aria-describedby={
            description ? `${id}-hint` : props["aria-describedby"]
          }
        />
      </GlassSurface>
      {description && <small id={`${id}-hint`}>{description}</small>}
    </label>
  );
}
export function GlassTextarea({
  label,
  id: suppliedId,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { label?: string }) {
  const id = useId();
  return (
    <label className={`dg-field ${className}`} htmlFor={suppliedId ?? id}>
      {label && <span className="dg-field__label">{label}</span>}
      <GlassSurface radius={24}>
        <textarea {...props} id={suppliedId ?? id} />
      </GlassSurface>
    </label>
  );
}
export function GlassSelect({ label, children, className = "", id: suppliedId, ref: forwardedRef, onChange, ...props }: ComponentProps<"select"> & { label?: string }) {
  const generatedId = useId(), id = suppliedId ?? generatedId;
  const native = useRef<HTMLSelectElement>(null);
  const [invalid, setInvalid] = useState(false);
  const [options, setOptions] = useState<{ value: string; label: string; disabled: boolean; selected: boolean; group: string }[]>([]);
  const sync = () => setOptions(Array.from(native.current?.options ?? [], option => ({
    value: option.value, label: option.label,
    disabled: option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
    selected: option.selected,
    group: option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : "",
  })));
  useLayoutEffect(sync, [children, props.value, props.defaultValue]);
  useEffect(() => {
    const form = native.current?.form;
    const reset = () => queueMicrotask(() => { setInvalid(false); sync(); });
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  const choose = (value: string) => {
    const select = native.current;
    if (!select) return;
    if (props.multiple) {
      const option = Array.from(select.options).find(item => item.value === value);
      if (option) option.selected = !option.selected;
    } else select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    sync();
  };
  return <div className={`dg-field dg-select ${className}`}>
    {label && <label className="dg-field__label" id={`${id}-label`} htmlFor={id}>{label}</label>}
    <select {...props} id={`${id}-native`} className="dg-native-select" aria-hidden="true" tabIndex={-1}
      ref={element => { native.current = element; if (typeof forwardedRef === "function") forwardedRef(element); else if (forwardedRef) forwardedRef.current = element; }}
      onChange={event => { sync(); setInvalid(!event.currentTarget.validity.valid); onChange?.(event); }}
      onInvalid={event => { props.onInvalid?.(event); if (!event.defaultPrevented) { event.preventDefault(); setInvalid(true); document.getElementById(id)?.focus(); } }}>
      {children}
    </select>
    <LiquidPopover label={label ?? props["aria-label"] ?? "Options"} role="listbox" multiple={props.multiple}
      trigger={<GlassButton id={id} disabled={props.disabled} role="combobox" aria-invalid={invalid || props["aria-invalid"]} aria-describedby={invalid ? `${id}-error` : props["aria-describedby"]} aria-label={props["aria-label"]} aria-labelledby={label ? `${id}-label ${id}-value` : undefined}>
        <span id={`${id}-value`}>{options.filter(option => option.selected).map(option => option.label).join(", ") || "—"}</span><ChevronDown aria-hidden="true" />
      </GlassButton>}>
      <div className="dg-select-options" onKeyDown={event => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length : -1;
        if (next < 0 && event.key.length === 1 && event.key !== " ") {
          const match = (button: HTMLButtonElement) => button.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase());
          next = buttons.findIndex((button, i) => i > index && match(button));
          if (next < 0) next = buttons.findIndex(match);
        }
        if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
      }}>
        {options.map((option, i) => <SelectOption key={`${option.value}-${i}`} option={option} group={option.group !== options[i - 1]?.group ? option.group : ""} multiple={props.multiple} choose={choose} />)}
      </div>
    </LiquidPopover>
    {invalid && <small id={`${id}-error`} role="alert">{native.current?.validationMessage}</small>}
  </div>;
}
function SelectOption({ option, group, multiple, choose }: { option: { value: string; label: string; disabled: boolean; selected: boolean }; group: string; multiple?: boolean; choose: (value: string) => void }) {
  const close = useClosePopover();
  return <>{group && <small>{group}</small>}<button type="button" role="option" aria-selected={option.selected} disabled={option.disabled} onClick={() => { choose(option.value); if (!multiple) close(); }}>{option.label}<Check aria-hidden="true" size={16} style={{ opacity: option.selected ? 1 : 0 }} /></button></>;
}
export function GlassCheckbox({
  children,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={`dg-choice ${className}`}>
      <GlassSurface radius={7}>
        <input {...props} type="checkbox" />
        <span className="dg-check" aria-hidden="true" />
      </GlassSurface>
      <span>{children}</span>
    </label>
  );
}
export interface GlassRadioGroupProps {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}
export function GlassRadioGroup({
  label,
  name,
  value,
  defaultValue,
  disabled,
  onValueChange,
  options,
}: GlassRadioGroupProps) {
  const id = useId();
  return (
    <fieldset className="dg-radio-group" disabled={disabled}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label className="dg-choice" key={option.value}>
          <GlassSurface radius={20}>
            <input
              type="radio"
              name={name ?? id}
              value={option.value}
              checked={value === undefined ? undefined : value === option.value}
              defaultChecked={
                value === undefined ? defaultValue === option.value : undefined
              }
              disabled={option.disabled}
              onChange={() => onValueChange?.(option.value)}
            />
            <span className="dg-radio-dot" aria-hidden="true" />
          </GlassSurface>
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
export function GlassToggle({
  pressed,
  defaultPressed = false,
  onPressedChange,
  children,
  className = "",
  ...props
}: GlassButtonProps & {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}) {
  const [local, setLocal] = useState(defaultPressed);
  const active = pressed ?? local;
  return (
    <GlassButton
      {...props}
      className={`dg-toggle ${className}`}
      aria-pressed={active}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          setLocal(!active);
          onPressedChange?.(!active);
        }
      }}
    >
      {children}
    </GlassButton>
  );
}
export function GlassProgress({
  value,
  max = 100,
  label = "Progress",
}: {
  value: number;
  max?: number;
  label?: string;
}) {
  const boundedMax = Number.isFinite(max) && max > 0 ? max : 100;
  const bounded = Number.isFinite(value)
    ? Math.min(boundedMax, Math.max(0, value))
    : 0;
  return (
    <div
      className="dg-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={boundedMax}
    >
      <GlassSurface radius={20}>
        <span
          className="dg-progress__fill"
          style={{ width: `${(bounded / boundedMax) * 100}%` }}
        />
      </GlassSurface>
    </div>
  );
}
export function GlassAvatar({
  src,
  name,
  size = 48,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span
      className="dg-avatar"
      role="img"
      aria-label={name}
      style={{ width: size, height: size }}
    >
      <GlassSurface radius={size / 2}>
        {src && !failed ? (
          <img src={src} alt="" onError={() => setFailed(true)} />
        ) : (
          name
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
        )}
      </GlassSurface>
    </span>
  );
}
export function GlassAlert({
  title,
  children,
  role = "status",
}: {
  title: string;
  children?: ReactNode;
  role?: "status" | "alert";
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div role={role} className="dg-alert" initial={reduce ? false : { opacity: 0, y: 10, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 360, damping: 30 }}>
      <GlassSurface>
        <strong>{title}</strong>
        {children && <div>{children}</div>}
      </GlassSurface>
    </motion.div>
  );
}
export function GlassAccordion({ items, multiple = false, lazy = false }: {
  items: { title: string; content: ReactNode }[];
  multiple?: boolean;
  /** Mount expensive content on opening and release it after the closing animation. */
  lazy?: boolean;
}) {
  const [expanded, setExpanded] = useState<number[]>([]);
  return <div className="dg-accordion">{items.map((item, i) => <AccordionItem key={i} {...item} lazy={lazy} open={expanded.includes(i)} toggle={() => setExpanded(current => current.includes(i) ? current.filter(value => value !== i) : multiple ? [...current, i] : [i])} />)}</div>;
}
function AccordionItem({ title, content, open, toggle, lazy }: { title: string; content: ReactNode; open: boolean; toggle: () => void; lazy: boolean }) {
  const id = useId(), reduce = useReducedMotion();
  const [retained, setRetained] = useState(open);
  useEffect(() => { if (open) setRetained(true); }, [open]);
  return <GlassSurface radius={18}>
    <h3 className="dg-accordion__heading"><button type="button" id={`${id}-trigger`} aria-expanded={open} aria-controls={id} onClick={toggle}>{title}<motion.span className="dg-accordion__mark" aria-hidden="true" animate={{ rotate: open ? 45 : 0 }} transition={{ duration: reduce ? 0 : .18 }}>+</motion.span></button></h3>
    <motion.div id={id} role="region" aria-labelledby={`${id}-trigger`} inert={!open} aria-hidden={!open} initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 }} style={{ overflow: "hidden" }} onAnimationComplete={() => { if (!open) setRetained(false); }}>
      <div className="dg-accordion__body">{(!lazy || open || retained) && content}</div>
    </motion.div>
  </GlassSurface>;
}
export function GlassToast({
  open,
  title,
  children,
  onClose,
  duration = 4000,
  closeLabel = "Dismiss notification",
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
  duration?: number;
  closeLabel?: string;
}) {
  const reduce = useReducedMotion();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || duration <= 0) return;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return (
    <motion.div className="dg-toast" role="status" aria-live="polite" initial={false}
      animate={{ height: open ? "auto" : 0 }} transition={{ duration: reduce ? 0 : .24, ease: [.32, 0, .2, 1] }}>
      <AnimatePresence initial={false}>
      {open && (
        <motion.div key="toast" initial={reduce ? false : { opacity: 0, transform: "translateY(16px) scale(.96)" }} animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }} exit={{ opacity: 0, transform: "translateY(16px) scale(.96)" }} transition={{ duration: reduce ? 0 : .24, ease: [.23, 1, .32, 1] }}>
        <GlassSurface radius={20}>
          <div>
            <strong>{title}</strong>
            {children && <p>{children}</p>}
          </div>
          <button
            type="button"
            className="dg-dismiss"
            aria-label={closeLabel}
            onClick={onClose}
          >
            ×
          </button>
        </GlassSurface>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
