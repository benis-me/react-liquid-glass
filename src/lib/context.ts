import { createContext } from "react";
import type { MotionValueLike } from "./motion";

export interface SharedLens {
  x?: MotionValueLike;
  y?: MotionValueLike;
  lensW?: MotionValueLike;
  lensH?: MotionValueLike;
  borderRadius?: MotionValueLike;
  scaleX?: MotionValueLike;
  scaleY?: MotionValueLike;
}

export interface TargetRect {
  el: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
  nested?: boolean;
}

/**
 * Cross-tree coordination: a provider lets one lens roam over many glass
 * containers, and lets RefractionTarget elements register their rects so
 * pooled per-element filters can be assigned to them.
 */
export interface GlassContextValue {
  register: (lens: SharedLens) => void;
  deregister: () => void;
  activeLens: React.MutableRefObject<SharedLens | null>;
  version: React.MutableRefObject<number>;
  upsertTarget: (el: HTMLElement, rect: TargetRect) => void;
  deregisterTarget: (el: HTMLElement) => void;
  targets: React.MutableRefObject<Map<HTMLElement, TargetRect>>;
  targetVersion: React.MutableRefObject<number>;
  /** Bleed padding (px) applied to targets so displaced pixels aren't clipped. */
  bleedRef: React.MutableRefObject<number>;
}

export const GlassContext = createContext<GlassContextValue | null>(null);

export const RefractionGroupContext = createContext<{ inGroup: boolean; gap: number }>({
  inGroup: false,
  gap: 0,
});

export const GLASS_SELECTOR = {
  container: "[data-dg-glass-surface]",
  target: "[data-refraction-target]",
} as const;
