import { useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { LiquidPopover } from "./LiquidPopover";

export interface GlassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  closeLabel?: string;
  /** Captures the pointer position; keyboard activation uses the trigger center. */
  trigger?: ReactElement<ComponentProps<"button">>;
}

/** Native modality; trigger, traveling body and neck share the popover compositor. */
export function GlassDialog({ open, onOpenChange, title, description, children, closeLabel = "Close", trigger, placement = "dialog" }: GlassDialogProps & { placement?: "dialog" | "sheet" }) {
  const id = useId();
  return <LiquidPopover trigger={trigger} open={open} onOpenChange={onOpenChange} label={title} placement={placement} descriptionId={description ? `${id}-description` : undefined}>
    <header><h2>{title}</h2><button type="button" className="dg-dismiss" aria-label={closeLabel} onClick={() => onOpenChange(false)}>×</button></header>
    {description && <p id={`${id}-description`} className="dg-dialog__description">{description}</p>}
    {children}
  </LiquidPopover>;
}

export function GlassSheet(props: GlassDialogProps) { return <GlassDialog {...props} placement="sheet" />; }
