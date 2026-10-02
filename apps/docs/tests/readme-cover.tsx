// README cover and og:image scene: real components and real glass, captured by readme-cover.mjs.
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "rglass/controls.css";
import { useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { motionValue } from "motion/react";
import { LiquidGlassCanvas, LiquidGlassProvider } from "rglass/liquid-glass";
import { GlassButton, GlassGroup } from "rglass/controls";
import { Bold, Italic, Underline } from "lucide-react";
import { MorphMenuDemo } from "../src/demos/MorphMenuDemo";

const W = 1200, H = 630;
const params = new URLSearchParams(location.search);

/** Everything the glass refracts lives in one canvas, so DOM controls and the fused bodies see the same page. */
function paint(canvas: HTMLCanvasElement) {
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = "#f3f2ee"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgb(17 17 19 / .07)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let d = -H; d < W + H; d += 12 * Math.SQRT2) { ctx.moveTo(d, H); ctx.lineTo(d + H, 0); }
  ctx.stroke();
  // The title sits under the glass: crisp type is what a lens visibly bends.
  ctx.fillStyle = "#111113";
  ctx.font = '800 236px "Manrope Variable"';
  ctx.letterSpacing = "-15px";
  ctx.fillText("Liquid", 50, 292);
  ctx.fillText("Glass", 50, 518);
}

function Cover() {
  const substrate = useRef<HTMLCanvasElement>(null);
  const revision = useRef(motionValue(0)).current;
  useLayoutEffect(() => { paint(substrate.current!); revision.set(1); }, [revision]);
  return (
    <main className="cover">
      <canvas ref={substrate} className="cover-substrate" aria-hidden="true" />
      <LiquidGlassCanvas
        sourceRef={substrate}
        sourceRevision={revision}
        width={W}
        height={H}
        // Each body refracts like a standalone lens of its own size (see refractionRatio), 1.5x stronger.
        blobs={([[270, 300, 140], [505, 220, 100], [450, 420, 76]] as const).map(([x, y, radius]) => ({ x: x / W, y: y / H, radius, refractionRatio: [1.5 * (radius * 2 + 28) / W, 1.5 * (radius * 2 + 28) / H] as const }))}
        mergeDistance={56}
        refractionStrength={0.14}
        edgeDepth={14}
        domeDepth={24}
        chromaAmount={0.55}
        blurStrength={0}
        specularStrength={0.72}
        glowStrength={0.3}
        shadowStrength={0.12}
        shadowBlur={26}
        shadowOffset={18}
        transparentOutside
        hdr={false}
        className="cover-glass"
        ariaLabel="Three fused liquid glass bodies over the title"
      />
      <header className="cover-copy">
        <p className="cover-caption">React · rglass</p>
        <h1 className="cover-title">React Liquid Glass</h1>
        <p className="cover-tagline">HDR · Glass fusion<br />Apple-like motion<br />Spring physics</p>
      </header>
      <div className="cover-controls">
        <GlassGroup spacing={24} className="cover-group" role="group" aria-label="Text style">
          <GlassButton aria-label="Bold"><Bold size={16} /></GlassButton>
          <GlassButton aria-label="Italic"><Italic size={16} /></GlassButton>
          <GlassButton aria-label="Underline"><Underline size={16} /></GlassButton>
        </GlassGroup>
        <div className="cover-menu"><MorphMenuDemo locale="en" theme="light" /></div>
      </div>
      <p className="cover-note">npm i rglass · Real components, rendered live.</p>
    </main>
  );
}

const style = document.createElement("style");
style.textContent = `
html, body { margin: 0; background: #f3f2ee; }
.cover { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; color: #111113; font-family: "Manrope Variable", system-ui, sans-serif; }
.cover-substrate, .cover-glass { position: absolute; inset: 0; width: ${W}px; height: ${H}px; }
.cover-copy { position: absolute; left: 860px; top: 56px; width: 280px; }
.cover-caption { margin: 0 0 12px; font: 500 11px/1 "JetBrains Mono Variable", monospace; letter-spacing: .16em; text-transform: uppercase; color: #75736c; }
.cover-title { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.cover-tagline { margin: 0; font-size: 18px; line-height: 1.4; font-weight: 600; letter-spacing: -.01em; color: #3c3a36; }
.cover-controls { position: absolute; left: 860px; top: 196px; width: 300px; }
.cover-group .dg-glass-group__items { gap: 2px; }
.cover-group .dg-button > .dg-surface > .dg-surface__content { padding: 0; width: 44px; }
.cover-menu { position: absolute; left: -24px; top: 64px; width: 324px; height: 430px; }
.cover-menu .dg-liquid-glass--small { height: 100%; }
.cover-note { position: absolute; left: 56px; bottom: 34px; margin: 0; font: 500 12px/1.7 "JetBrains Mono Variable", monospace; letter-spacing: .04em; color: #6d6b65; }
`;
document.head.append(style);
await document.fonts.load('800 236px "Manrope Variable"');
createRoot(document.getElementById("root")!).render(
  <LiquidGlassProvider material={{}} backend={params.get("renderer") === "webgl2" ? "webgl2" : "auto"}>
    <Cover />
  </LiquidGlassProvider>,
);
