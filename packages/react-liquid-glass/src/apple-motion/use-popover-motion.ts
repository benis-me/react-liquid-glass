import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import { CLOSE_FUSION_DURATION, CLOSE_FUSION_TIMES, OPEN_MORPH_DURATION, OPEN_MORPH_TIMES, openWidthFrames, openHeightFrames, openRadiusFrames, closeMenuWidthFrames, closeMenuHeightFrames } from "./menu";
import { liquidEasings, retargetLiquidFrames } from "./trajectory";

export interface PopoverLayout {
  triggerX: number; triggerY: number; triggerWidth: number; triggerHeight: number; triggerRadius: number;
  panelX: number; panelY: number; panelWidth: number; panelHeight: number; panelRadius: number;
}

/** The menu's capsule growth and two-body absorption, calibrated to any trigger size. */
export function popoverFrames(layout: PopoverLayout, open: boolean) {
  const { triggerX: tx, triggerY: ty, triggerWidth: tw, triggerHeight: th, panelX: px, panelY: py, panelWidth: pw, panelHeight: ph, panelRadius: pr } = layout;
  const dx = tx - px, dy = ty - py, length = Math.hypot(dx, dy) || 1;
  const ux = dx / length, uy = dy / length;
  const reach = (w: number, h: number) => Math.hypot(w * ux, h * uy);
  const triggerReach = reach(tw / 2, th / 2);
  const neck = Math.min(28, th * 0.65);
  if (open) return {
    times: OPEN_MORPH_TIMES,
    x: [tx, tx, tx + (px - tx) * .86, px + (px - tx) * .006, px],
    y: [ty, ty, ty + (py - ty) * .86, py + (py - ty) * .006, py],
    w: openWidthFrames(tw * .4, pw / 2),
    h: openHeightFrames(th * .4, ph / 2),
    radius: openRadiusFrames(Math.min(tw, th) * .4, pr, pw / 2, ph / 2),
    trigger: [1, .94, .96, 1.015, 1],
    merge: [0, neck, neck, neck * .5, 0],
    reveal: [0, 0, .48, .96, 1],
  };
  const w = closeMenuWidthFrames(pw / 2), h = closeMenuHeightFrames(ph / 2);
  // The final lobe fits a rectangular trigger, including short tooltips and wide selects.
  w[3] = Math.min(pw * .14, tw * .4); h[3] = Math.min(ph * .18, th * .6);
  w[4] = h[4] = 1;
  const contact = (index: number, gap: number) => triggerReach + reach(w[index], h[index]) + gap;
  const middle = contact(2, 10), lobe = contact(3, -5);
  return {
    times: CLOSE_FUSION_TIMES,
    x: [px, px + dx * .015, tx - ux * middle, tx - ux * lobe, tx, tx],
    y: [py, py + dy * .015, ty - uy * middle, ty - uy * lobe, ty, ty],
    w, h,
    radius: [pr, Math.min(pw, ph) * .185, Math.min(w[2], h[2]), Math.min(w[3], h[3]), 1, 1],
    trigger: [1, .97, .96, 1.025, 1.04, 1],
    merge: [0, 0, neck, neck * .8, 2, 0],
    reveal: [1, .55, .02, 0, 0, 0],
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
  const transition = (layout: PopoverLayout, open: boolean, done: () => void) => {
    const interrupted = running.current;
    const revision = ++token.current;
    stop();
    const frames = popoverFrames(layout, open);
    const duration = open ? OPEN_MORPH_DURATION : CLOSE_FUSION_DURATION * Math.max(.55, Math.min(1, h.get() * 2 / layout.panelHeight));
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
    const target = pressed ? .96 : 1;
    if (reduce) { trigger.jump(target); return; }
    if (Math.abs(trigger.get() - target) < .001) return;
    stop();
    runs.current.push(animate(trigger, target, { type: "spring", mass: 1, stiffness: 420, damping: 28, velocity: trigger.getVelocity() }));
  };
  return { x, y, w, h, radius, trigger, merge, reveal, transition, press };
}
