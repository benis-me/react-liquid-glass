import { useEffect, useRef, type ComponentProps } from "react";
import { usePointerReleaseFallback, springTo, useGlassContact } from "../apple-motion/react";
import { contactTransform } from "../apple-motion/contact";
import { ACTION_PRESS_SPRING, ACTION_RELEASE_SPRING } from "../apple-motion/presets";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { LiquidGlass as Glass, LIQUID_LENS } from "../liquid-glass/LiquidGlass";
import type { LensParams } from "../types";

const ACTION_LENS: Partial<LensParams> = {
  ...LIQUID_LENS,
  lensW: 88,
  lensH: 26,
  borderRadius: 26,
};

export function GlassActionButton({ children, disabled, onClick, ...props }: ComponentProps<"button">) {
  const root = useRef<HTMLButtonElement>(null);
  const contact = useGlassContact(root, { enabled: !disabled });
  const reduce = useReducedMotion();
  const runs = useRef<Array<{ stop: () => void }>>([]);
  const stop = () => { runs.current.forEach(run => run.stop()); runs.current = []; };
  useEffect(() => stop, []);
  const lensW = useMotionValue(88);
  const lensH = useMotionValue(26);
  const radius = useMotionValue(26);
  const tintStrength = useMotionValue(0.1846);
  const tintBlur = useMotionValue(3);
  const shadowOpacity = useMotionValue(0.28);
  const transform = useTransform(() => `matrix(${contactTransform(lensW.get() * 2, lensH.get() * 2, contact.anchorX.get(), contact.anchorY.get(), contact.pullX.get(), contact.pullY.get()).join(",")})`);

  const press = () => {
    if (disabled) return;
    stop();
    if (reduce) { lensW.jump(106); lensH.jump(34); radius.jump(34); tintStrength.jump(.055); tintBlur.jump(0); shadowOpacity.jump(1); return; }
    runs.current.push(springTo(lensW, 106, ACTION_PRESS_SPRING));
    runs.current.push(springTo(lensH, 34, ACTION_PRESS_SPRING));
    runs.current.push(springTo(radius, 34, ACTION_PRESS_SPRING));
    runs.current.push(animate(tintStrength, 0.055, { duration: 0.18 }));
    runs.current.push(animate(tintBlur, 0, { duration: 0.18 }));
    runs.current.push(animate(shadowOpacity, 1, { duration: 0.18 }));
  };

  const release = () => {
    stop();
    if (reduce) { lensW.jump(88); lensH.jump(26); radius.jump(26); tintStrength.jump(.1846); tintBlur.jump(3); shadowOpacity.jump(.28); return; }
    runs.current.push(springTo(lensW, 88, ACTION_RELEASE_SPRING));
    runs.current.push(springTo(lensH, 26, ACTION_RELEASE_SPRING));
    runs.current.push(springTo(radius, 26, ACTION_RELEASE_SPRING));
    runs.current.push(animate(tintStrength, 0.1846, { duration: 0.32 }));
    runs.current.push(animate(tintBlur, 3, { duration: 0.32 }));
    runs.current.push(animate(shadowOpacity, 0.28, { duration: 0.32 }));
  };

  const { arm, disarm } = usePointerReleaseFallback(release);
  return (
    <div className="dg-action">
      <Glass
        className="dg-action__glass"
        lens={ACTION_LENS}
        x={0.5}
        y={0.5}
        lensW={lensW}
        lensH={lensH}
        contact={contact}
        borderRadius={radius}
        tintColor="var(--action-glass-tint, var(--dg-action-tint))"
        material={{ tintStrength }}
        tintBlur={tintBlur}
        shadowOpacity={shadowOpacity}
        filterResolution={2}
      >
        <div className="dg-action__surface" />
      </Glass>
      <button
        {...props}
        ref={root}
        disabled={disabled}
        onClick={onClick}
        className="dg-action__button"
        type="button"
        onPointerDown={event => { if (event.button !== 0 || disabled) return; arm(event.pointerId); press(); props.onPointerDown?.(event); }}
        onPointerUp={event => { disarm(); release(); props.onPointerUp?.(event); }}
        onPointerCancel={event => { disarm(); release(); props.onPointerCancel?.(event); }}
        onPointerLeave={event => { release(); props.onPointerLeave?.(event); }}
        onBlur={event => { release(); props.onBlur?.(event); }}
        onKeyDown={event => { if (!event.repeat && [" ", "Enter"].includes(event.key)) press(); props.onKeyDown?.(event); }}
        onKeyUp={event => { release(); props.onKeyUp?.(event); }}
      >
        <motion.span style={{ display: "inline-block", transform }}>{children}</motion.span>
      </button>
    </div>
  );
}
