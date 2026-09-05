# React Liquid Glass

A reusable React library for real-time liquid-glass refraction on the web.

## Two reusable cores

The `refactor` branch separates the existing implementation into two independently importable cores. Controls compose them; neither core imports the other, the controls, or Demo content.

| Entry | Responsibility |
| --- | --- |
| `refractive-glass-react/liquid-glass` | React source adapters, optical geometry and the shared material |
| `refractive-glass-react/liquid-glass/renderer` | WebGL2 material, merged SDF, frost, foreground refraction and GPU lifecycle; no React dependency |
| `refractive-glass-react/apple-motion` | Physical spring integration, continuous trajectories, calibrated motion presets and MotionValue utilities |
| `refractive-glass-react/apple-motion/react` | Interruptible springs, velocity deformation, pointer-release cleanup and the menu motion controller |
| `refractive-glass-react/controls` | Switch, Slider, Segmented and LiquidMenu views that compose both cores |

All entries provide ESM, CommonJS and TypeScript declarations. The existing root exports remain compatible. Core components require no stylesheet; ready-made controls use the optional `controls.css` export.

Previously, controls repeated deformation integrators, the menu combined choreography, optics and localized content in one Demo, and consumers had to enter through the mixed legacy/current root API. The refactor shares the thumb motion, separates menu motion from optical tracks, moves menu content back to the Demo, and exposes the implementations as package entries. The approved optical kernel and menu trajectories are preserved.

`apple-motion` keeps the current physical calibrations while replacing frame-clamped Euler integration with the exact damped-spring solution. Position and velocity survive retargets and dropped frames; stationary held deformation stops scheduling frames. It uses Motion's existing frame phases and spring animation where appropriate, without another animation dependency. These are project calibrations, not measured Apple parameters.

```ts
import { stepSpring, PLAY_BUTTON_SPRING } from "refractive-glass-react/apple-motion";

// CSS pixels, pixels/second, and real elapsed seconds. Keep velocity on retarget.
[position, velocity] = stepSpring(position, velocity, target, PLAY_BUTTON_SPRING, elapsedSeconds);
```

## Liquid foundation

The shared Liquid foundation is the Demo's default implementation on `main`: hero, Switch, Slider, Tabs, action button, menu, video and Experiment use the approved Liquid menu material. Control dimensions, gesture handling and motion curves remain independent of the material. Media contains only Video; the retained QR reference implementation is no longer imported or mounted by the Demo.

This is a material/backend migration, not a claim of universal DOM capture, native iOS equivalence or a measured performance win over Aave.

- `LiquidGlass`: React DOM-source adapter, with native interactive children and a retained source texture.
- `LiquidGlassCanvas`: React canvas/image/video-source adapter. Accepts up to eight circular or rounded-rectangle `blobs`, with live MotionValues for geometry, velocity and optical parameters.
- `createLiquidGlassRenderer`: the same renderer without React, for procedural content and video.
- `LIQUID_GLASS_MATERIAL` / `LIQUID_LENS`: one shared default material, in renderer and LensParams spelling respectively.
- `GlassSwitch`, `GlassSlider`, `GlassSegmented`: accessible controls built on `LiquidGlass`. `LiquidMenu` composes the menu controller with the same optical material and accepts native menu content. `GlassCanvas` is a compatibility geometry adapter to the new renderer.

The shared WebGL2 kernel owns the merged SDF, spherical-cap refraction, chromatic frost, adaptive glow, thin directional contour/reflection, shadow and optional foreground-ink optics. Fine frost retains the accepted nine-tap endpoint; wider frost uses a cached, separable Gaussian so thin lines soften instead of splitting into repeated strokes. There is no static/dynamic renderer handoff or runtime PNG displacement-map generation in the Demo. WebGL2 is required; the Liquid adapters do not automatically fall back to legacy SVG glass when it is unavailable.

The legacy SVG/PNG `Glass` API and map utilities remain exported for compatibility; the Demo no longer uses them. Legacy SVG-specific flags, map size, region transforms and inset-shadow controls are not supported by the Liquid renderer. Experiment exposes the actual new optical parameters and its right pane visualizes the live GPU displacement/coverage field.

`lensW` and `lensH` are half-extents. A lens with `lensW: 70` is 140 CSS pixels wide.

## Use

```tsx
import { LiquidGlass } from "refractive-glass-react/liquid-glass";

<LiquidGlass lens={{ lensW: 70, lensH: 60, borderRadius: 28 }}>
  <div style={{ height: 240, background: "#eee", padding: 32 }}>
    Content behind the lens
  </div>
</LiquidGlass>
```

Import the separate control styles when using `GlassSwitch`, `GlassSlider`, `GlassSegmented`, or `LiquidMenu`:

```tsx
import { GlassSlider } from "refractive-glass-react/controls";
import "refractive-glass-react/controls.css";
```

`LiquidMenu` accepts `theme`, `menuLabel`, `openLabel`, `trigger`, `onOpenChange` and a `children(open)` render function. Children retain their own selection state and keyboard semantics; use `open` to remove closed items from the tab order. The built-in `dg-liquid-menu__scroll`, heading and row classes preserve the approved layout. For custom geometry or presentation, use `useMenuMotion` with `LiquidGlassCanvas` directly instead of duplicating the controller.

`x` and `y` are normalized lens-center coordinates. Half-extents, radii and velocities use CSS pixels. For fusion, pass multiple intentional bodies to one `LiquidGlassCanvas`; independent DOM surfaces do not merge across canvases.

`LiquidGlass` reads layout/styles and redraws supported DOM content into a retained 2D canvas at content, font, theme, scroll and resize boundaries. It does not capture the browser's exact composited DOM pixels or sample arbitrary content behind the component. Its bounded adapter supports this Demo's solid surfaces, centered grids, text, SVG icons and images; it is not a general-purpose DOM screenshot engine. Arbitrary CSS, multiline text layout, selection painting and continuously animated DOM are not fully reproduced. Native children retain interaction, but the optical overlay is a separate pixel layer. Cross-origin images require CORS. Use `sourceFactory` plus `sourceValues` for procedural MotionValue-driven content such as control tracks, or provide a real canvas/image/video source for complex or continuously changing content.

For direct rendering, keep the source revision unchanged when only the lens moves:

```ts
import { createLiquidGlassRenderer } from "refractive-glass-react/liquid-glass/renderer";

const renderer = createLiquidGlassRenderer(outputCanvas, { onRestore: redraw });
renderer.draw({
  source: backgroundCanvas,
  sourceRevision: 1, // increment when pixels change
  width: 640, height: 480,
  blobs: [
    { x: .45, y: .5, radius: 48 },
    { x: .55, y: .5, radius: 32 },
  ],
});
// On unmount:
renderer.dispose();
```

The imperative API does not start a loop: callers schedule draws and visibility. `LiquidGlassCanvas` batches changes in Motion's render phase and skips hidden/offscreen draws. Sources and premultiplied content textures upload only when their revision/identity changes. Small and DOM surfaces share one WebGL context; video and the menu render directly to avoid full-frame copies. The Demo uses three contexts regardless of the number of experiment controls, bounds render scale, lazily mounts advanced controls, and pauses offscreen video. GPU context restoration recreates resources and invalidates retained uploads.

Background blur uses CSS pixels, not render pixels. Broad frost is rebuilt only when source pixels, blur radius or source geometry changes; lens travel and output-DPR changes reuse it. It resolves the source to the blur grid before paired horizontal/vertical samples, keeps one shared scratch target, and uses lower resolution for very broad blur. Fine frost/video and opaque resting control thumbs skip that prefilter work. `tintOpacity={1}` means opaque tint; `0` reveals the underlying glass tint. The Switch/Slider use that continuous range to stay white at rest and become glass while active. Tabs retain their own velocity-driven travel/recoil, with optical exit overlapping the low-amplitude tail rather than waiting for exact spring rest.

## Liquid motion

The menu and icon use one Liquid material throughout rest, press, opening, closing, fusion and settle. Project-tuned trajectories target approximately 380ms open / 380ms close; interrupted opening returns in 209–380ms according to the live body size, with geometry, optics and focus using that same clock. These timings are informed by iOS 27 references, not claimed native Apple constants. Closing retains the two-body absorption, directional impact and restrained recovery. Refraction, foreground blur, contour and reflection follow the same live shape. Captured menu ink participates in the optical field during motion and returns to native DOM at the neutral endpoint.

The trigger's rest center is 38px inward from the panel's right/bottom edges. Content padding is `14px` desktop / `10px` mobile, sort rows are `64px` tall, and item corners use ordinary circular radii (`31px` / `30px`). The accepted fine outer contour is lighter at the top/bottom; the narrow inset reflection is confined to the upper/lower arcs. No external gooey dependency, separate DOM outline, or trailing droplet is used.

## Commands

```bash
npm run dev       # Demo
npm run check     # TypeScript
npm test          # Legacy optics, motion regressions, shared renderer lifecycle
npm run build:demo # Demo only
npm run build:lib  # ESM/CJS library + declarations
npm run build     # Both builds + Sites packaging (requires local hosting config)
npm run test:sites # Worker behavior + Sites build artifacts
```

Library output is written to `dist/library`; the Sites-ready Demo is written to `dist/client`.

Sites packaging also needs the environment-owned `.openai/hosting.json`, which is ignored by Git. In the 2026-09-06 checkout it is absent: Demo and library builds pass, but `npm run build` stops at packaging and the Sites artifact test fails. No hosting configuration is fabricated, and the packaging script/worker remain unchanged. See [current QA status](design-qa.md).

## Demo structure

- `src/App.tsx` only composes page sections.
- `src/demo/` contains page chrome and small presentation primitives.
- `src/demos/` contains self-contained interactive demonstrations.
- `src/styles/` separates theme foundations, page layout, and demo-specific CSS.

## Notes

- The shared material is WebGL2, not WebGPU or the experimental HTML-in-Canvas API. Desktop mobile emulation is not a native iPhone GPU benchmark.
- Reduced-motion startup is covered by browser QA. CSS color resolution uses an isolated probe so reading source colors cannot trigger a transition/capture feedback loop in the live content.
- Keep legacy SVG-filtered regions focused if using `Glass`; Safari has practical source-graphic size ceilings.
- Demo-only Dezin assets under `public/assets` are excluded from the library package.

## Reference and attribution

This project is an independent implementation informed by studying Aave Design's [Building Glass for the Web](https://aave.com/design/building-glass-for-the-web). It is not affiliated with or endorsed by Aave; the original article, materials, and trademarks remain the property of their respective owners.

The liquid-geometry work was informed by studying the architecture of Jakub Antalik's MIT-licensed [liquid-gooey](https://github.com/Jakubantalik/Libraries/tree/main/packages/liquid-gooey); no code from that package is installed or used at runtime.
