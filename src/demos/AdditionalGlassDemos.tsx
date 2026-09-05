import { animate, useMotionValue } from "motion/react";
import { LiquidGlass as Glass, LIQUID_LENS } from "../lib/liquid-glass/LiquidGlass";
import type { LensParams } from "../lib/types";

const ACTION_LENS: Partial<LensParams> = {
  ...LIQUID_LENS,
  lensW: 88,
  lensH: 26,
  borderRadius: 26,
};

export function GlassActionDemo({ label }: { label: string }) {
  const lensW = useMotionValue(88);
  const lensH = useMotionValue(26);
  const radius = useMotionValue(26);
  const tintStrength = useMotionValue(0.1846);
  const tintBlur = useMotionValue(3);
  const shadowOpacity = useMotionValue(0.28);

  const press = () => {
    animate(lensW, 106, { type: "spring", stiffness: 280, damping: 22 });
    animate(lensH, 34, { type: "spring", stiffness: 280, damping: 22 });
    animate(radius, 34, { type: "spring", stiffness: 280, damping: 22 });
    animate(tintStrength, 0.055, { duration: 0.18 });
    animate(tintBlur, 0, { duration: 0.18 });
    animate(shadowOpacity, 1, { duration: 0.18 });
  };

  const release = () => {
    animate(lensW, 88, { type: "spring", stiffness: 210, damping: 20 });
    animate(lensH, 26, { type: "spring", stiffness: 210, damping: 20 });
    animate(radius, 26, { type: "spring", stiffness: 210, damping: 20 });
    animate(tintStrength, 0.1846, { duration: 0.32 });
    animate(tintBlur, 3, { duration: 0.32 });
    animate(shadowOpacity, 0.28, { duration: 0.32 });
  };

  return (
    <div className="action-demo">
      <Glass
        className="action-demo__glass"
        lens={ACTION_LENS}
        x={0.5}
        y={0.5}
        lensW={lensW}
        lensH={lensH}
        borderRadius={radius}
        tintColor="var(--action-glass-tint)"
        material={{ tintStrength }}
        tintBlur={tintBlur}
        shadowOpacity={shadowOpacity}
        filterResolution={2}
      >
        <div className="action-demo__surface" />
      </Glass>
      <button
        className="action-demo__button"
        type="button"
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        <span>{label}</span>
      </button>
    </div>
  );
}
