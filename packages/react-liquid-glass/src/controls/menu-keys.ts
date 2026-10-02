import type { KeyboardEvent } from "react";

/** Arrow keys, Home and End move focus across a menu's enabled buttons; other keys pass through. */
export function moveMenuFocus(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
  if (!buttons.length) return;
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[
    event.key === "Home" ? 0
      : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
  ].focus();
}
