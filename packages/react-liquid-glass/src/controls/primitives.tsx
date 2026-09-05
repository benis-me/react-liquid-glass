import {
  useEffect,
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
      <GlassSurface radius={14}>
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
      <GlassSurface radius={16}>
        <textarea {...props} id={suppliedId ?? id} />
      </GlassSurface>
    </label>
  );
}
export function GlassSelect({
  label,
  children,
  className = "",
  id: suppliedId,
  ...props
}: ComponentProps<"select"> & { label?: string }) {
  const id = useId();
  return (
    <label className={`dg-field ${className}`} htmlFor={suppliedId ?? id}>
      {label && <span className="dg-field__label">{label}</span>}
      <GlassSurface radius={14}>
        <select {...props} id={suppliedId ?? id}>
          {children}
        </select>
      </GlassSurface>
    </label>
  );
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
  return (
    <div role={role} className="dg-alert">
      <GlassSurface>
        <strong>{title}</strong>
        {children && <div>{children}</div>}
      </GlassSurface>
    </div>
  );
}
export function GlassAccordion({
  items,
  multiple = false,
}: {
  items: { title: string; content: ReactNode }[];
  multiple?: boolean;
}) {
  const id = useId();
  return (
    <div className="dg-accordion">
      {items.map((item, i) => (
        <details name={multiple ? undefined : id} key={i}>
          <summary>
            <GlassSurface radius={14}>
              {item.title}
              <span className="dg-accordion__mark" aria-hidden="true">
                +
              </span>
            </GlassSurface>
          </summary>
          <div className="dg-accordion__body">{item.content}</div>
        </details>
      ))}
    </div>
  );
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
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || duration <= 0) return;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return (
    <div className="dg-toast" role="status" aria-live="polite">
      {open && (
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
      )}
    </div>
  );
}
