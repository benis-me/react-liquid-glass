# refractive-glass-react

Project-owned liquid glass optics, physical motion and accessible React components. React 19 and Motion 13 are peer dependencies. ESM, CommonJS and TypeScript declarations are included.

## Entry points

| Entry | Responsibility |
| --- | --- |
| `refractive-glass-react/liquid-glass` | SDF geometry, continuous material, Canvas surfaces, explicit substrates, `LiquidGlassProvider` |
| `refractive-glass-react/liquid-glass/renderer` | Imperative WebGL2 renderer for canvas, image and video sources |
| `refractive-glass-react/apple-motion` | Analytic damped springs, trajectories, velocity and deformation presets; framework-independent |
| `refractive-glass-react/apple-motion/react` | Motion/React adapters, continuous springs and pointer-release recovery |
| `refractive-glass-react/controls` | Ready-to-use React components |
| `refractive-glass-react/controls.css` | Optional component styles, independent of the documentation site |
| `refractive-glass-react` | Convenience exports plus the retained legacy `Glass` / `GlassCanvas` APIs |

The core APIs do not import CSS. Import `controls.css` explicitly when using styled controls. Fonts and icons are not runtime dependencies of the library.

```tsx
import { GlassStage, GlassButton, GlassSwitch } from "refractive-glass-react/controls";
import { LiquidGlassProvider } from "refractive-glass-react/liquid-glass";
import "refractive-glass-react/controls.css";

export function Settings() {
  return (
    <LiquidGlassProvider material={{ chromaAmount: 0.24 }}>
      <GlassStage background="grid" style={{ padding: 40 }}>
        <GlassSwitch ariaLabel="Notifications" defaultChecked />
        <GlassButton onClick={() => console.log("Saved")}>Save</GlassButton>
      </GlassStage>
    </LiquidGlassProvider>
  );
}
```

An empty `material={{}}` preserves every control's calibrated defaults. Nested providers inherit parent overrides. Settings affect the actual shared renderer, including live video. Component motion remains independent of optical tuning.

## Components

`GlassButton`, `GlassActionButton`, `GlassSwitch`, `GlassSlider`, `GlassSegmented`, `GlassTabs`, `GlassInput`, `GlassTextarea`, `GlassCheckbox`, `GlassRadioGroup`, `GlassSelect`, `GlassToggle`, `GlassCard`, `GlassBadge`, `GlassAvatar`, `GlassProgress`, `GlassAlert`, `GlassToast`, `GlassDialog`, `GlassSheet`, `GlassPopover`, `GlassDropdownMenu`, `GlassTooltip`, `GlassAccordion`, `LiquidMenu`, `GlassSpotlight`, `GlassVideo`.

`GlassSurface` and `GlassStage` support custom compositions. Inputs use native form semantics. Dialogs use native modal focus handling; popovers use the browser top layer. Supply meaningful labels and native button/form props. `GlassPopover.trigger` is button content, not another button. `GlassTooltip` expects a focusable child. `GlassToast` is an inline live region; place it where notifications belong in your layout.

`GlassTabs` accepts `{ value, label, content }` items; `GlassSegmented` also accepts custom icons and colors. Controlled callbacks preserve the original drag, click and keyboard behavior. The action button retains its original optical/physical expansion and uses its own 320px-high presentation substrate.

## Independent motion

```ts
import { stepSpring } from "refractive-glass-react/apple-motion";

const [position, velocity] = stepSpring(
  0, 20, 1,
  { mass: 1, stiffness: 170, damping: 22 },
  1 / 60,
);
```

Pass the current position and velocity again when retargeting. Elapsed time is in seconds. The analytic solution supports underdamped, critically damped and overdamped systems and rejects nonfinite or invalid inputs.

## Rendering boundaries

WebGL2 is required. `GlassStage` supplies an explicit canvas substrate to its descendant `GlassSurface` components; it does not capture arbitrary DOM behind them. Without a stage, basic surfaces use a neutral substrate. Spotlight and Video render their own media; provide same-origin or CORS-enabled URLs.

The legacy DOM adapter is a bounded redraw of supported content, not browser-native DOM capture, a universal backdrop, or evidence of native iOS performance parity. Controls retain their own track/text substrates. The menu retains one merged SDF for its body, button and neck throughout the transition.

Small surfaces share a GPU device, cache textures, pause offscreen and stop drawing at rest. Video follows decoded-frame callbacks, pauses offscreen and redraws paused seeks/resizes. The default small-control canvas is 2×. `prefers-reduced-motion` suppresses automatic decorative drift and uses immediate control states where applicable.

## Build from this repository

```sh
npm ci
npm run build:lib
npm pack --workspace refractive-glass-react
```

The package includes built code, optional styles and declarations; it excludes docs, videos and other site assets. No npm publication is performed by these commands.
