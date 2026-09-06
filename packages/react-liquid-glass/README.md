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

`GlassButton`, `GlassButtonGroup`, `GlassActionButton`, `GlassSwitch`, `GlassSlider`, `GlassSegmented`, `GlassTabs`, `GlassInput`, `GlassTextarea`, `GlassCheckbox`, `GlassRadioGroup`, `GlassSelect`, `GlassToggle`, `GlassCard`, `GlassBadge`, `GlassAvatar`, `GlassProgress`, `GlassAlert`, `GlassToast`, `GlassDialog`, `GlassSheet`, `GlassPopover`, `GlassDropdownMenu`, `GlassTooltip`, `GlassAccordion`, `LiquidMenu`, `GlassSpotlight`, `GlassVideo`.

`GlassSurface` and `GlassStage` support custom compositions. Anchored Select, Popover, DropdownMenu and Tooltip share a native popover and one liquid compositor for the trigger, panel and fusion neck. Inputs use native form semantics. Dialogs use native modal focus handling; popovers use the browser top layer. Supply meaningful labels and native button/form props. `GlassPopover.trigger` is button content, not another button. `GlassTooltip` expects a focusable child. `GlassToast` is an inline live region; place it where notifications belong in your layout.

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

Buttons, button groups and `GlassSurface` respond to a local grip with contact light, subtle resisted deformation (at most 4 CSS pixels) and an elastic return. The light follows the pointer while the original grip anchors the shape. Dragging does not fire the button's action. `GlassSurface interactive="light"` keeps contact light while leaving dragging to the application; `interactive={false}` disables both. Sliders, switches, segmented controls and popup triggers retain their own gesture/morph behavior and add contact light.

For custom controls, `useGlassContact(ref)` from `apple-motion/react` returns MotionValues that can be passed to `LiquidGlass contact={contact}` or spread onto a `LiquidGlassCanvas` blob. Use its `anchorX`/`anchorY` and `pullX`/`pullY` with `contactTransform` for matching native foreground deformation; `contactX`/`contactY` track the light. Pointer cancellation, capture loss, window blur, reduced motion and interruption are handled by the shared hook.

On HDR displays with WebGPU extended tone mapping, a lazy shared presenter emits the same SDF's contact-light mask above SDR white using an `rgba16float` canvas. The existing WebGL material is unchanged at rest; SDR and unsupported browsers keep its ordinary local highlight. This is a project-tuned interpretation, not measured iOS constants or a claim of native parity. See [HDR canvas tone mapping](https://developer.chrome.com/blog/new-in-webgpu-129).

WebGL2 is required. `GlassStage` supplies an explicit canvas substrate to its descendant `GlassSurface` components. Without a stage, basic surfaces use the surrounding page color. Spotlight and Video render their own media; provide same-origin or CORS-enabled URLs.

Anchored popovers outside a `GlassStage` redraw the actual page region beneath their trigger and panel into the same optical material. Text, boxes, Lucide SVG, form values and same-origin images/video/canvases can show through. Scroll, DOM changes and library canvas frames refresh the region; the overlay excludes itself and stops drawing at rest. `paintLiquidBackdrop(root, canvas, bounds, exclude)` exposes the same bounded adapter for custom sources.

This is a DOM redraw adapter, not universal native backdrop capture. Complex CSS backgrounds/effects, arbitrary SVG, native textarea wrapping and cross-origin frames are not reproduced completely. Browser-native DOM-to-texture APIs remain an evolving option; see the [HTML-in-Canvas origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial).

The legacy DOM adapter is a bounded redraw of supported content, not browser-native DOM capture, a universal backdrop, or evidence of native iOS performance parity. Controls retain their own track/text substrates. The menu retains one merged SDF for its body, button and neck throughout the transition.

Small surfaces share a GPU device, cache textures, pause offscreen and stop drawing at rest. Video follows decoded-frame callbacks, pauses offscreen and redraws paused seeks/resizes. The default small-control canvas is 2×. `prefers-reduced-motion` suppresses automatic decorative drift and uses immediate control states where applicable.

## Build from this repository

```sh
npm ci
npm run build:lib
npm pack --workspace refractive-glass-react
```

The package includes built code, optional styles and declarations; it excludes docs, videos and other site assets. No npm publication is performed by these commands.
