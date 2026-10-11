# rglass

![React Liquid Glass: three fused liquid glass bodies refracting the giant "Liquid Glass" title, beside a fused GlassGroup toolbar and an open Morph Menu.](https://raw.githubusercontent.com/benis-me/react-liquid-glass/main/.github/assets/readme-hero.png)

Liquid glass for React: real-time refraction rendered with WebGPU and a WebGL2 fallback, one material from rest through motion, glass shapes that fuse, and Apple-like spring motion, in accessible components. React 19 and Motion 13 are peer dependencies. ESM, CommonJS and TypeScript declarations are included.

## Install

```sh
npm install rglass react@^19 react-dom@^19 motion@^13
```

[Documentation and live examples](https://react-liquid-glass-alpha.vercel.app/).

## Entry points

| Entry | Responsibility |
| --- | --- |
| `rglass/liquid-glass` | SDF geometry, continuous material, Canvas surfaces, explicit substrates, `LiquidGlassProvider` |
| `rglass/liquid-glass/renderer` | WebGPU-first renderer with WebGL2 fallback for canvas, image and video sources |
| `rglass/apple-motion` | Analytic damped springs, trajectories, velocity and deformation presets; framework-independent |
| `rglass/apple-motion/react` | Motion/React adapters, continuous springs and pointer-release recovery |
| `rglass/controls` | Ready-to-use React components |
| `rglass/controls.css` | Optional component styles, independent of the documentation site |
| `rglass` | Convenience exports for the current Liquid renderer, controls and motion values |

The core APIs do not import CSS. Import `controls.css` explicitly when using styled controls. `rglass`, `rglass/controls`, `rglass/liquid-glass` and `rglass/apple-motion/react` are client modules (`"use client"`), so React Server Components can render them directly; the renderer and `rglass/apple-motion` stay framework-agnostic. The library does not bundle fonts. Radix ScrollArea is installed as a dependency; the four icons the controls use are inlined from Lucide.

```tsx
import { GlassStage, GlassButton, GlassSwitch } from "rglass/controls";
import { LiquidGlassProvider } from "rglass/liquid-glass";
import "rglass/controls.css";

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

An empty `material={{}}` keeps every component's own look. All glass is one material that thickens with its size, as Apple's does: `liquidThickness(width, height)` runs from 0 at a 48px control to 1 at a 320px panel, and the glass's shadow, lensing, light and frost follow its live body, so a Button, a Card and the open Morph Menu are the thin, middle and thick ends of the same glass. `glassMaterial(thickness, { variant, dark })` returns that material. `variant: "clear"`, as Spotlight and Video use, keeps media vivid: no frost or tint, and lensing kept to a narrow rim without extra magnification; regular glass on a dark page tints toward the page. Pressed tabs and held thumbs lift into the lens (`LIFTED_GLASS`, below) and keep their opaque white rest state. Settings affect the shared renderer; component motion remains independent of optical tuning.

Material resolves by one rule for every glass: its own values, then the HDR highlight default (`HDR_SPECULAR_STRENGTH`, 0.48, only when the display matches `(dynamic-range: high)`), then explicit provider material above the glass's constants. What neither sets follows the glass's size. Values a component animates itself, such as a lifted lens's magnification, popup frost and the Morph Menu's depth, fusion neck, tint and zoom, keep animating: a provider constant never replaces them. Nested providers inherit parent overrides; `inherit={false}` starts a subtree fresh while keeping the parent's HDR preference. `useGlassMaterial()` returns the provider's material with that HDR default.

HDR defaults to enabled on supported displays; SDR displays keep each component's own highlight. Set `material={{ hdr: false }}` on `LiquidGlassProvider` to disable the extended highlights globally, or pass `hdr={false}` to an individual `LiquidGlass` / `LiquidGlassCanvas`. An explicit instance flag wins over the provider, including for the HDR highlight default. The docs header persists HDR independently of material settings; presets and material reset preserve this preference.

Controls follow the host theme. They switch to dark when `<html>` has `data-theme="dark"`, or the `dark` class without a `data-theme` attribute (as next-themes and shadcn set it). Their colors use CSS `light-dark()`, so also set `color-scheme: light` or `color-scheme: dark` on the root. Some CSS pipelines, including Next.js with lightningcss, compile `light-dark()` into variables that resolve only with it. `controls.css` derives the `--dg-control-*` variables (accent, track, surface, border and text) on `.dg-switch`, `.dg-slider` and `.dg-tabs` from optional host tokens: `--primary`, `--bg-1`, `--bg-4`, `--border-1` and `--fg-1` to `--fg-3`. Built-in values apply when those tokens are missing. If your app gives these names another meaning (shadcn's `--primary` holds bare HSL numbers), set the `--dg-control-*` variables directly on those selectors.

## Components

`GlassButton`, `GlassButtonGroup`, `GlassGroup`, `GlassSwitch`, `GlassSlider`, `GlassTabs`, `GlassInput`, `GlassTextarea`, `GlassCheckbox`, `GlassRadioGroup`, `GlassSelect`, `GlassToggle`, `GlassCard`, `GlassBadge`, `GlassAvatar`, `GlassProgress`, `GlassAlert`, `GlassToast`, `GlassDialog`, `GlassSheet`, `GlassPopover`, `GlassDropdownMenu`, `GlassMorphMenu`, `GlassTooltip`, `GlassAccordion`, `GlassSpotlight`, `GlassVideo`.

`GlassGroup spacing={24}` renders up to eight direct children as glass shapes in one canvas; shapes within `spacing` CSS pixels fuse through the shared SDF, and CSS transitions that move them are followed frame by frame. Children keep their native semantics.

`GlassSurface` and `GlassStage` support custom compositions. `GlassSurface.blurStrength` and `GlassPopover.blurStrength` set the frost at a panel's thickness in CSS pixels (default 12); smaller glass scales it down with its size, and child controls keep their own. Anchored Select, Popover, DropdownMenu and Tooltip share a native popover and one liquid compositor for the trigger, panel and fusion neck. Inputs use native form semantics. Dialogs use native modal focus handling; popovers use the browser top layer. Supply meaningful labels and native button/form props. `GlassPopover.trigger` is button content, not another button. `GlassTooltip` expects a focusable child. `GlassToast` is an inline live region; place it where notifications belong in your layout. Its timer holds while the toast is hovered or focused and resumes with the time left.

`GlassVideo` accepts `sources` (preferred encodings such as WebM, tried before `src`), localized `labels` including a `progressValue` template for the seek bar's `aria-valuetext` and the `error` and `retry` text shown when no source can play, and `pauseWhenHidden={false}` to keep playing offscreen; rendering pauses offscreen either way. `autoPlay` is ignored while the reader prefers reduced motion. `GlassAccordion` takes `headingLevel` (default 3) so its section headings fit the page outline.

`GlassTabs` accepts `{ value, label, Icon?, color1?, color2?, content?, href? }` items. Content panels are optional; controlled callbacks preserve drag, click and keyboard behavior. Items with `href` render native links; optional `onNavigate(href)` integrates client-side routing while modified clicks stay native. Arrow keys focus navigation links; Enter follows them. While a tab is pressed, the whole bar grows slightly about its centre, as iOS 27's does (3.5%, at most 7px a side), and its lens lifts past the bar's ends, so leave about 16px around it inside clipping containers. `GlassSegmented` and `LiquidMenu`, which `GlassTabs` and `GlassMorphMenu` build on, remain exported, without duplicate catalog entries.

`GlassMorphMenu` is the original `LiquidMenu` at a smaller default size. It accepts `theme`, `trigger`, `menuLabel`, `openLabel`, and a `children(open)` render function; use the `dg-liquid-menu__*` classes for its scrollable sections and rows. Its original content optics and two-body absorption remain intact. Its material follows the shared thickness rule: the closed trigger is the same glass as a Button, presses with contact light, and the open menu is thick glass. Opening moves focus to the checked item, or the first item; arrow keys, Home and End move between items, Escape closes the menu, and focus returns to the trigger. The closed panel is inert, so items need no `tabIndex` toggling. Use `size="default"` for the original dimensions. Dropdown's trigger remains visible.

Dialog and Sheet share Popover's stable trigger/body compositor, with longer opening travel (500ms open, up to 280ms close), stronger frost and no visible mask. Pass `trigger={<GlassButton>Open</GlassButton>}` to originate at the click; keyboard activation uses the button center. Controlled dialogs without this prop originate at the active element, or viewport center.

## Switch, Slider and Spotlight

Dragged, the `GlassTabs` lens and `GlassSwitch` and `GlassSlider` thumbs move like a soft body on a spring: they stretch along their motion with speed and, when they stop or land, overshoot into a brief squash and rebound. A dragged `GlassSwitch` thumb picks its side from a short projection along its release velocity, measured over its last moves, so a quick flick toggles without crossing the middle, and carries that velocity into its settling spring; a tap travels on the same spring without it. A `GlassSlider` thumb pulled past an end springs back with the velocity of its last moves. A released Tabs lens lands on the tab under the finger with the velocity it had. Dragged past the first or last tab, the lens follows with the same rubber band as a Switch thumb, carrying the bar slightly along, and both spring back on release, never reaching into a clipping ancestor. When a controlled owner keeps the previous state, the thumb settles back to it. `GlassSlider` calls `onValueChange` once per snapped value rather than on every pointer event. Their default accessible names are `"Switch"` and `"Value"`; pass `ariaLabel` in your UI language. Other native input attributes (`id`, `aria-*`, `required`, `form`, `onBlur` and so on) reach the inner input, so a `<label htmlFor>` or `aria-labelledby` can name them instead, and the fallback name is then omitted. Because a Switch is its own `<label>`, put visible text in a sibling `<label htmlFor>` rather than wrapping the Switch. Under `prefers-reduced-motion`, both thumbs move to their new state immediately.

`GlassSpotlight` follows the pointer as a damped mass and stops drawing at rest. Its ambient drift meanders smoothly, turning away from the edges instead of reversing, stretches with its velocity, and eases to rest after 30 seconds without page activity; any pointer, key, wheel, touch or scroll activity resumes it. `backgroundSrcSet` and `backgroundSizes` pass responsive candidates to the image, and a failed image shows the plain frame instead of a broken image.

## Lifted lens, light and tone

Glass rests as a calibrated spherical cap and lifts into the lens of iOS 27's pressed tabs, matched to a native screenshot. `material={{ ...LIFTED_GLASS, lensMagnification }}` lifts any `LiquidGlass`; it draws with `refractionModel: "lens"`: it magnifies its middle by `lensMagnification`, and its rim band, `edgeDepth` wide, pulls in what surrounds the glass all round: along the long sides it bulges outward by the refraction strength before meeting the surface flush at the rim, and at the ends it squeezes, strongest at the rim, so what it passes over there is compressed toward the edge in order and the end of a bar it overhangs keeps the same gap to the rim as the bar's top and bottom. Along the long sides its rim is thick, as on the native lens: the outer slope mirrors what lies just inside it, with red reaching furthest on one diagonal and blue on the other, so warm and cool crescents gather at opposite ends of each band. A pressed `GlassTabs` lens and held `GlassSwitch` and `GlassSlider` thumbs use it. Its edge is its own: a fine dark contour at the very edge, an even grey line over light content, and a white rim line hugging it. Resting glass's rim highlight reaches round the corners toward the sides too, faint there. Both run on both backends with analytic per-body normals and no extra SDF evaluations.

`material.lightSource` steers the highlight axis: `"fixed"` uses `specularRotation` (default); `"pointer"` follows a mouse or pen through one shared, frame-batched listener; `"device"` follows `deviceorientation` where the platform grants it (on iOS, call `DeviceOrientationEvent.requestPermission()` from a user gesture first). Reduced motion keeps the light fixed, and only visible surfaces redraw.

With `material.tone: true`, glass surfaces publish `data-dg-tone="light" | "dark"` from the luminance of their backdrop, with hysteresis and reads kept off the scroll and animation path. It is off by default and does no work until enabled. The library never recolors content; use the attribute to adapt ink over photos or video. `readLiquidTone(canvas, region)` exposes the same measurement for custom sources.

## Independent motion

```ts
import { stepSpring } from "rglass/apple-motion";

const [position, velocity] = stepSpring(
  0, 20, 1,
  { mass: 1, stiffness: 170, damping: 22 },
  1 / 60,
);
```

Pass the current position and velocity again when retargeting. Elapsed time is in seconds. The analytic solution supports underdamped, critically damped and overdamped systems and rejects nonfinite or invalid inputs.

Every motion in the library is this one spring model, a mass on a damped spring solved exactly, with a named preset from `rglass/apple-motion`; there are no frame tweens or easing curves imitating a bounce. `springTo(value, target, spring, velocity?)` from `rglass/apple-motion/react` drives a Motion value with it and can be awaited like a Motion animation. Glass presses one way, growing by `GLASS_PRESS_SCALE` (2.5%) on `SURFACE_PRESS_SPRING`, and lifted lenses rise on `LIFT_SPRING` and settle on `SEGMENTED_RELEASE_SPRING`. Only scripted morphs, such as the Morph Menu's and popups' opening and closing trajectories, and the video controls' source-matched constants keep their own curves. Every control reads `prefers-reduced-motion` live.

## Rendering boundaries

Buttons, button groups, Glass Group shapes and `GlassSurface` grow slightly on press and respond to a local grip with contact light, subtle resisted deformation (at most 4 CSS pixels) and an elastic return. The light is a lit surface: it starts under the finger and spreads through the glass in about 0.3 seconds (`PRESS_GLOW_SPRING`), onto glass fused with it, and leans toward the pointer while the original grip anchors the shape. Dragging does not fire the button's action. `GlassSurface interactive="light"` keeps contact light while leaving dragging to the application; `interactive={false}` disables both. Sliders, switches, segmented controls and popup triggers retain their own gesture/morph behavior and add contact light.

For custom controls, `useGlassContact(ref)` from `apple-motion/react` returns MotionValues that can be passed to `LiquidGlass contact={contact}` or spread onto a `LiquidGlassCanvas` blob. Use its `anchorX`/`anchorY` and `pullX`/`pullY` with `contactTransform` for matching native foreground deformation; `contactX`/`contactY` track the light. Pointer cancellation, capture loss, window blur, reduced motion and interruption are handled by the shared hook.

Compact UI surfaces use a restrained glow and fine directional rim. Glass thickens with size, following Apple's [size-adaptive material guidance](https://developer.apple.com/videos/play/wwdc2025/219/?time=440): `liquidThickness(width, height)` maps a body's short side from 48 CSS pixels (a control) to 320 (a panel), and every glass blends its live material by it, from compact-control glass to the open menu's: a deeper, softer shadow, stronger lensing, softer light, and background frost from 0.2 CSS pixels to 12 (`liquidSurfaceBlur`). Tooltips and closed triggers therefore stay thin, and glass of the same size looks alike whichever component draws it. An explicit material-provider value still wins per key. The values are project-calibrated, not measured iOS constants.

On HDR displays with WebGPU extended tone mapping, a lazy shared presenter lifts the same SDF's fine inset reflection and contact light above SDR white using an `rgba16float` canvas. Both share one soft cap: a press lights the whole glass near 1.2× SDR white, up to about 1.3× toward the finger, and the static rim reaches about 1.2×, so overlapping light never stacks into glare. Foreground ink, coverage, tint and opacity also mask this light. The WebGPU path renders this light directly on the shared device, without copying a WebGL mask. The SDR base remains available to the DOM backdrop adapter; SDR and unsupported browsers use the ordinary highlights, and resting surfaces do not redraw continuously. This is a project-tuned interpretation, not measured iOS constants or a claim of native parity. See [HDR canvas tone mapping](https://developer.chrome.com/blog/new-in-webgpu-129).

WebGPU is preferred; unsupported adapters and device failures fall back to WebGL2. A browser with either API is required for the glass. Until a renderer is ready, Switch and Slider show a plain white thumb; without either API, surfaces, overlays and video controls fall back to plain translucent fills and stay usable. `GlassStage` supplies a visible demo background, not a private texture. Inline surfaces, lenses and popovers use the same bounded DOM-backdrop adapter: hiding, removing or changing the stage background updates the glass. Spotlight and Video use their explicit media sources; provide same-origin or CORS-enabled URLs.

The adapter draws background colors, borders and radii, text, Lucide SVG, form values, canvases, same-origin or CORS-enabled `crossorigin` images/video, and a thin two-color 135° `repeating-linear-gradient` hatch. It skips other CSS gradients and `url()` backgrounds, `box-shadow`, cross-origin media without CORS, and iframes. In development builds, it warns once for each skipped background image or cross-origin media element. To show such content, paint it into a canvas and pass that to `LiquidGlassCanvas`, or show an image through `GlassSpotlight`. Scroll, DOM changes and library canvas frames refresh the region. Inline surfaces sample only DOM layers that come before them, so fixed or floating glass, such as a header or tab bar over scrolling content, must come after that content in the DOM. Top-layer popovers sample the page beneath them. Both exclude their own rendering and stop drawing at rest. `paintLiquidBackdrop(root, canvas, bounds, exclude)` exposes the same adapter for custom sources. Composite controls use `LiquidGlass backdropRoot={ref}` to exclude native ink that their foreground source paints separately. Add `sharpInk` to keep that foreground's text and icons crisp: they refract with the backdrop, and only the backdrop and the lens rim are frosted.

This is a DOM redraw adapter, not universal native backdrop capture. Other CSS effects, arbitrary SVG and native textarea wrapping are approximated or skipped. Browser-native DOM-to-texture APIs remain an evolving option; see the [HTML-in-Canvas origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial).

Controls keep their own motion and default material calibration. Switch/Slider tracks and segmented ink are composited over the shared backdrop from the same live control state; the menu retains one merged SDF for its body, button and neck throughout the transition.

Offscreen and resting surfaces do not draw, and small controls render at 2×. `prefers-reduced-motion` suppresses automatic decorative drift and uses immediate control states where applicable.

`ScrollArea` is available from `/controls` with `orientation="vertical" | "horizontal" | "both"`, `viewportProps`, and `contentClassName`. It uses Radix's native scrolling with overlay thumbs shown on hover. Popovers, dialogs, menus and textareas use it internally; import `controls.css` for its styles.

## Renderer selection

All controls, Video, Spotlight and Liquid surfaces use the WebGPU-first renderer. WebGL2 is the fallback. There is no SVG glass renderer or compatibility backend.

`<LiquidGlassProvider material={material} backend="auto">` prefers WebGPU. Use `backend="webgl2"` for comparison or explicit compatibility, and `backend="webgpu"` to require WebGPU without fallback. Material values and Motion interactions are independent of backend selection.

The imperative `createLiquidGlassRenderer(canvas, options)` returns immediately and loads only its selected backend. `await renderer.ready` resolves to `"webgpu"`, `"webgl2"`, or `null` when unavailable/disposed. Frames requested during initialization are coalesced to the latest one. Inspect `renderer.backend`, `renderer.error`, `renderer.stats`, and the canvas's `data-dg-renderer` diagnostic. Call `suspend()` when hidden and `dispose()` on teardown.

A canvas cannot change its context type. On device failure, React controls remount their canvas while retaining controlled state. Imperative renderers replace the failed canvas: read `renderer.canvas` after recovery, or provide `onFallback(error)` to let the host recreate it. Initial adapter failure falls back before claiming the original canvas. Use `frame.hdr` for HDR on either backend; the old second-argument rendering callback has been removed.

Changing the provider's backend selection retries that selection after a failure and preserves control/video state. Changing `LiquidGlassCanvas.shared` recreates its output canvas when needed by the WebGL2 fallback.

Published declarations use the consumer's DOM WebGPU types. The development-only `@webgpu/types` package is not referenced by public declarations and does not inject duplicate globals into applications using current TypeScript.

## Browser support

Glass needs WebGPU or WebGL2. WebGPU is used where the browser exposes it, such as current Chrome, Edge and Safari; other capable browsers use WebGL2 with the same optics. Without either, surfaces, overlays and video controls fall back to plain translucent fills and stay usable. Overlays need the Popover API and `<dialog>` (Chrome and Edge 114+, Safari 17+, Firefox 125+). HDR highlights need an HDR display and extended-range canvas support; otherwise glass renders in SDR. Viewport emulation does not reproduce mobile GPUs or HDR output, so check important flows on real devices.

## Server rendering

Modules touch no browser APIs at import time and render static markup with `react-dom/server`; glass starts drawing after hydration. Because the component entries are client modules, Next.js App Router server components can render them with serializable props; pass callbacks from your own client components. Import `rglass/controls.css` once in the root layout, and set the theme and `color-scheme` before first paint so server-rendered pages do not flash the wrong scheme.

## Changes

See the [changelog](https://github.com/benis-me/react-liquid-glass/blob/main/packages/react-liquid-glass/CHANGELOG.md).

## License

MIT. See [LICENSE](./LICENSE).
