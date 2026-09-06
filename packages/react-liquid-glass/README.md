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

An empty `material={{}}` preserves every control's calibrated defaults. Ordinary UI uses the exported `PRISM_MATERIAL`; large popups retain stronger size-adaptive frost, while small thumb lenses keep their scale calibration and opaque white rest state. Nested providers inherit parent overrides. Settings affect the shared renderer; component motion remains independent of optical tuning.

HDR defaults to enabled on supported displays. Set `material={{ hdr: false }}` on `LiquidGlassProvider` to disable the extended highlights globally, or pass `hdr={false}` to an individual `LiquidGlass` / `LiquidGlassCanvas`. An explicit instance flag wins over the provider. The Playground HDR switch persists and shares with the other material settings. Selecting a preset preserves this flag; Reset restores the default.

## Components

`GlassButton`, `GlassButtonGroup`, `GlassSwitch`, `GlassSlider`, `GlassTabs`, `GlassInput`, `GlassTextarea`, `GlassCheckbox`, `GlassRadioGroup`, `GlassSelect`, `GlassToggle`, `GlassCard`, `GlassBadge`, `GlassAvatar`, `GlassProgress`, `GlassAlert`, `GlassToast`, `GlassDialog`, `GlassSheet`, `GlassPopover`, `GlassDropdownMenu`, `GlassMorphMenu`, `GlassTooltip`, `GlassAccordion`, `GlassSpotlight`, `GlassVideo`.

`GlassSurface` and `GlassStage` support custom compositions. `GlassSurface.blurStrength` and `GlassPopover.blurStrength` set surface frost in CSS pixels without changing their child controls. Anchored Select, Popover, DropdownMenu and Tooltip share a native popover and one liquid compositor for the trigger, panel and fusion neck. Inputs use native form semantics. Dialogs use native modal focus handling; popovers use the browser top layer. Supply meaningful labels and native button/form props. `GlassPopover.trigger` is button content, not another button. `GlassTooltip` expects a focusable child. `GlassToast` is an inline live region; place it where notifications belong in your layout.

`GlassTabs` accepts `{ value, label, icon?, color?, content? }` items. Content panels are optional; controlled callbacks preserve drag, click and keyboard behavior. The former `GlassActionButton`, `GlassSegmented` and `LiquidMenu` exports remain available for compatibility, without duplicate catalog entries.

`GlassMorphMenu` is the original `LiquidMenu` at a smaller default size. It accepts `theme`, `trigger`, `menuLabel`, `openLabel`, and a `children(open)` render function; use the `dg-liquid-menu__*` classes for its scrollable sections and rows. Its original content optics, material transitions and two-body absorption remain intact. Use `size="default"` for the original dimensions. Dropdown's trigger remains visible.

Dialog and Sheet share Popover's stable trigger/body compositor, with longer opening travel (500ms open, up to 280ms close), stronger frost and no visible mask. Pass `trigger={<GlassButton>Open</GlassButton>}` to originate at the click; keyboard activation uses the button center. Controlled dialogs without this prop originate at the active element, or viewport center.

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

Buttons, button groups and `GlassSurface` grow slightly on press and respond to a local grip with contact light, subtle resisted deformation (at most 4 CSS pixels) and an elastic return. The light follows the pointer while the original grip anchors the shape. Dragging does not fire the button's action. `GlassSurface interactive="light"` keeps contact light while leaving dragging to the application; `interactive={false}` disables both. Sliders, switches, segmented controls and popup triggers retain their own gesture/morph behavior and add contact light.

For custom controls, `useGlassContact(ref)` from `apple-motion/react` returns MotionValues that can be passed to `LiquidGlass contact={contact}` or spread onto a `LiquidGlassCanvas` blob. Use its `anchorX`/`anchorY` and `pullX`/`pullY` with `contactTransform` for matching native foreground deformation; `contactX`/`contactY` track the light. Pointer cancellation, capture loss, window blur, reduced motion and interruption are handled by the shared hook.

Compact UI surfaces use a restrained glow and fine directional rim. Popup background frost follows the live body size, from 0.4 CSS pixels for shallow controls/tooltips to 12 for large panels; an explicit material-provider override still wins. This follows Apple's [size-adaptive material guidance](https://developer.apple.com/videos/play/wwdc2025/219/?time=440), with project-calibrated values.

On HDR displays with WebGPU extended tone mapping, a lazy shared presenter lifts the same SDF's fine inset reflection and contact light above SDR white using an `rgba16float` canvas. Foreground ink, coverage, tint and opacity also mask this light. Shared and direct WebGL canvases retain their base material; SDR and unsupported browsers use the ordinary highlights, and resting surfaces do not redraw continuously. This is a project-tuned interpretation, not measured iOS constants or a claim of native parity. See [HDR canvas tone mapping](https://developer.chrome.com/blog/new-in-webgpu-129).

WebGL2 is required. `GlassStage` supplies a visible demo background, not a private texture. Inline surfaces, lenses and popovers use the same bounded DOM-backdrop adapter: hiding, removing or changing the stage background updates the glass. Spotlight and Video use their explicit media sources; provide same-origin or CORS-enabled URLs.

Text, boxes, Lucide SVG, form values and same-origin images/video/canvases can show through. Scroll, DOM changes and library canvas frames refresh the region. Inline surfaces sample preceding DOM layers; top-layer popovers sample the page beneath them. Both exclude their own rendering and stop drawing at rest. `paintLiquidBackdrop(root, canvas, bounds, exclude)` exposes the same adapter for custom sources. Composite controls use `LiquidGlass backdropRoot={ref}` to exclude native ink that their foreground source paints separately.

This is a DOM redraw adapter, not universal native backdrop capture. Complex CSS backgrounds/effects, arbitrary SVG, native textarea wrapping and cross-origin frames are not reproduced completely. Browser-native DOM-to-texture APIs remain an evolving option; see the [HTML-in-Canvas origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial).

Controls keep their own motion and default material calibration. Switch/Slider tracks and segmented ink are composited over the shared backdrop from the same live control state; the menu retains one merged SDF for its body, button and neck throughout the transition.

Small surfaces share a GPU device, cache textures, pause offscreen and stop drawing at rest. Video follows decoded-frame callbacks, pauses offscreen and redraws paused seeks/resizes. The default small-control canvas is 2×. `prefers-reduced-motion` suppresses automatic decorative drift and uses immediate control states where applicable.

## Build from this repository

```sh
npm ci
npm run build:lib
npm pack --workspace refractive-glass-react
```

The package includes built code, optional styles and declarations; it excludes docs, videos and other site assets. No npm publication is performed by these commands.
