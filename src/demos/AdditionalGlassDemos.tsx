import { animate, useMotionValue, useTransform } from "motion/react";
import { Glass, type LensParams } from "../lib";

const ACTION_LENS: Partial<LensParams> = {
  mapSize: 256,
  lensW: 88,
  lensH: 26,
  borderRadius: 26,
  depth: 7,
  scaleX: 0.055,
  scaleY: 0.055,
  chromaAmount: 0,
  blurAmount: 0.25,
  sdfBoundary: true,
  edgeFalloff: true,
  specularStrength: 1,
  specularRotation: 38,
  glowStrength: 0.18,
  glowSpread: 0.7,
  glowExponent: 1.4,
  edgeStrength: 0.35,
  edgeWidth: 1.6,
  edgeExponent: 1.3,
  splayAmount: 1,
  edgeShadow: "0 10px 32px rgb(0 0 0 / .16)",
};

export function GlassActionDemo({ label }: { label: string }) {
  const lensW = useMotionValue(88);
  const lensH = useMotionValue(26);
  const radius = useMotionValue(26);
  const tintOpacity = useMotionValue(0.72);
  const tintBlur = useMotionValue(3);
  const shadowOpacity = useMotionValue(0.28);
  const edgeBias = useTransform(tintOpacity, (opacity) => opacity * 0.5);

  const press = () => {
    animate(lensW, 106, { type: "spring", stiffness: 280, damping: 22 });
    animate(lensH, 34, { type: "spring", stiffness: 280, damping: 22 });
    animate(radius, 34, { type: "spring", stiffness: 280, damping: 22 });
    animate(tintOpacity, 0, { duration: 0.18 });
    animate(tintBlur, 0, { duration: 0.18 });
    animate(shadowOpacity, 1, { duration: 0.18 });
  };

  const release = () => {
    animate(lensW, 88, { type: "spring", stiffness: 210, damping: 20 });
    animate(lensH, 26, { type: "spring", stiffness: 210, damping: 20 });
    animate(radius, 26, { type: "spring", stiffness: 210, damping: 20 });
    animate(tintOpacity, 0.72, { duration: 0.32 });
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
        tintOpacity={tintOpacity}
        tintBlur={tintBlur}
        shadowOpacity={shadowOpacity}
        edgeBias={edgeBias}
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
