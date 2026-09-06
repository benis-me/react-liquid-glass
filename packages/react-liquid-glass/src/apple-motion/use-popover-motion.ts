import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import { OPEN_MORPH_DURATION, OPEN_MORPH_TIMES, openWidthFrames, openHeightFrames, openRadiusFrames } from "./menu";
import { liquidEasings, retargetLiquidFrames } from "./trajectory";

export interface PopoverLayout {
  triggerX: number; triggerY: number; triggerWidth: number; triggerHeight: number; triggerRadius: number;
  originX?: number; originY?: number;
  panelX: number; panelY: number; panelWidth: number; panelHeight: number; panelRadius: number;
}

/** The menu's capsule growth and two-body absorption, calibrated to any trigger size. */
export function popoverFrames(layout: PopoverLayout, open: boolean, morphTrigger = false) {
  const { triggerX: tx, triggerY: ty, triggerWidth: tw, triggerHeight: th, panelX: px, panelY: py, panelWidth: pw, panelHeight: ph, panelRadius: pr } = layout;
  const dx = tx - px, dy = ty - py, length = Math.hypot(dx, dy) || 1;
  const ux = dx / length, uy = dy / length;
  const reach = (w: number, h: number) => Math.hypot(w * ux, h * uy);
  const triggerReach = reach(tw / 2, th / 2);
  const neck = Math.min(28, th * 0.65);
  const ox = layout.originX ?? tx, oy = layout.originY ?? ty;
  if (open) return {
    times: OPEN_MORPH_TIMES,
    x: [ox, ox, ox + (px - ox) * .86, px + (px - tx) * .006, px],
    y: [oy, oy, oy + (py - oy) * .86, py + (py - ty) * .006, py],
    w: openWidthFrames(tw * .4, pw / 2),
    h: openHeightFrames(th * .4, ph / 2),
    radius: openRadiusFrames(Math.min(tw, th) * .4, pr, pw / 2, ph / 2),
    trigger: morphTrigger ? [1, .94, .35, 0, 0] : [1, .94, .96, 1.015, 1],
    merge: [0, neck, neck, neck * .5, 0],
    reveal: [0, 0, .48, .96, 1],
  };
  // Gather immediately, then absorb through one neck and one small recoil.
  // Both extents shrink monotonically, even for a tooltip shorter than its trigger.
  const w = [pw / 2, pw * .45, pw * .22, Math.max(1, Math.min(pw * .11, tw * .38)), 1, 1];
  const h = [ph / 2, ph * .445, ph * .2, Math.max(1, Math.min(ph * .14, th * .48)), 1, 1];
  // Match the live head's size; using its resting reach leaves a gap while it grows.
  const contact = (index: number, headScale: number, gap: number) => triggerReach * headScale + reach(w[index], h[index]) + gap;
  const middle = Math.min(length * .62, contact(2, morphTrigger ? .65 : .975, 4));
  const lobe = Math.min(middle, contact(3, 1.035, -neck * .25));
  return {
    times: [0, .12, .42, .68, .84, 1],
    x: [px, px + dx * .12, tx - ux * middle, tx - ux * lobe, tx, tx],
    y: [py, py + dy * .12, ty - uy * middle, ty - uy * lobe, ty, ty],
    w, h,
    radius: [pr, Math.min(w[1], h[1], pr * 1.25), Math.min(w[2], h[2]), Math.min(w[3], h[3]), 1, 1],
    trigger: morphTrigger ? [0, 0, .65, 1.035, 1.018, 1] : [1, .985, .975, 1.035, 1.018, 1],
    merge: [0, 0, neck, neck * .85, 0, 0],
    reveal: [1, .5, .025, 0, 0, 0],
  };
}

export function usePopoverMotion() {
  const x = useMotionValue(0), y = useMotionValue(0), w = useMotionValue(1), h = useMotionValue(1), radius = useMotionValue(1);
  const trigger = useMotionValue(1), merge = useMotionValue(0), reveal = useMotionValue(0);
  const reduce = useReducedMotion();
  const running = useRef(false), token = useRef(0);
  const runs = useRef<ReturnType<typeof animate>[]>([]);
  const stop = () => { runs.current.forEach(run => run.stop()); runs.current = []; };
  useEffect(() => () => { token.current++; stop(); }, []);
  const transition = (layout: PopoverLayout, open: boolean, done: () => void, options: { morphTrigger?: boolean; duration?: number } = {}) => {
    const interrupted = running.current;
    const revision = ++token.current;
    stop();
    const frames = popoverFrames(layout, open, options.morphTrigger);
    const duration = open ? options.duration ?? OPEN_MORPH_DURATION : .28 * Math.max(.55, Math.min(1, h.get() * 2 / layout.panelHeight));
    const values: Record<string, MotionValue<number>> = { x, y, w, h, radius, trigger, merge, reveal };
    running.current = !reduce;
    for (const [key, value] of Object.entries(values)) {
      let targets = frames[key as Exclude<keyof typeof frames, "times">] as number[];
      if (reduce) { value.jump(targets.at(-1)!); continue; }
      if (!interrupted && open && key !== "trigger") value.jump(targets[0]);
      targets = [value.get(), ...targets.slice(1)];
      const velocity = value.getVelocity();
      const trajectory = interrupted ? retargetLiquidFrames(value.get(), targets.at(-1)!, duration, velocity) : { values: targets, times: frames.times };
      runs.current.push(animate(value, trajectory.values, {
        duration, times: trajectory.times,
        ease: liquidEasings(trajectory.values, trajectory.times, duration, velocity),
      }));
    }
    void Promise.all(runs.current).then(() => {
      if (revision !== token.current) return;
      running.current = false;
      done();
    });
  };
  const press = (pressed: boolean) => {
    if (running.current) return;
    const target = pressed ? 1.025 : 1;
    if (reduce) { trigger.jump(target); return; }
    if (Math.abs(trigger.get() - target) < .001) return;
    stop();
    runs.current.push(animate(trigger, target, { type: "spring", mass: 1, stiffness: 420, damping: 28, velocity: trigger.getVelocity() }));
  };
  return { x, y, w, h, radius, trigger, merge, reveal, transition, press };
}
