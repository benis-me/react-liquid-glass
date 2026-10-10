# Changelog

Notable changes to `rglass`. Versions follow semantic versioning; before 1.0, a minor version may include breaking changes.

## 0.3.0 — 2026-10-10

### Changed

- HDR light is restrained. A press now peaks near 1.5× SDR white instead of nearly 3×, the static rim near 1.2×, and overlapping light never stacks into glare: contact and rim share one soft cap, identical on WebGPU and WebGL2.
- Glass edges follow iOS 27's darkened border and brighter static highlights. The contour depends on edge strength alone, so it no longer thins on HDR displays. The static top and bottom highlight is about a third brighter over light content and more than twice as bright over dark content, so dark-mode glass keeps a crisp, defined edge.
- Pointer feedback is quieter. Tabs and Morph Menu rows fill on hover at once instead of fading, Tabs labels keep their color on hover, and `GlassGroup` and `GlassButtonGroup` buttons press to 97% over 100ms.
- Glass thickens with size, as Apple's does. Popover, Dropdown Menu, Select, Dialog, Sheet and the Morph Menu follow one rule from a 48px control to a 320px panel: as the live body grows, its shadow deepens and softens, its rim lenses more strongly, its light softens and busy backgrounds diffuse more. The two ends are the Button's material and the open Morph Menu's, so panels of the same size now look alike whichever component opened them, and tooltips stay thin.
- The pressed `GlassTabs` lens pulls in what surrounds it at its rim, as iOS 27's does. The bar seen through the lens looks smaller while the tab's icon and label keep their size, and the rim disperses visibly.
- The Morph Menu's closed trigger is the same glass as a Button. It no longer magnifies the content behind it or carries the open menu's deep shadow, and pressing it lights the glass where it is touched instead of pulsing its zoom. Its open panel diffuses busy backgrounds like the other popups instead of showing them sharply magnified.

### Fixed

- Fusion necks refract continuously: a body's rim slope no longer draws straight seams or shard-like patches inside fused glass.
- Pressed Switch and Slider thumbs no longer cut their shadow at the edge of the control's canvas.
- `LiquidGlassCanvas` honors instance material values over the shared defaults. Provider presets no longer freeze the Morph Menu's animated blur, tint and zoom, and an instance `hdr={false}` also removes the HDR highlight default.
- Controls follow `class="dark"` hosts (next-themes, shadcn) as well as `data-theme="dark"`.
- Published declarations resolve under `moduleResolution: NodeNext`; exported types no longer degrade to `any` there.
- `GlassInput` and `GlassSelect` add their description or error to the host's `aria-describedby` instead of replacing it.
- Switch and Slider thumbs move to their new state immediately under `prefers-reduced-motion`.
- Tabs land in one motion. The lens stays lifted until it reaches its tab, then shrinks and dissolves into the base color, instead of resting as glass and then switching. The base color no longer slides ahead of the lens when pressed.
- A dragged Tabs lens changes size smoothly between tabs of different widths instead of jumping at the midpoint. Its stretch now follows speed, and the velocity zoom is gone.
- A pressed Tabs lens grows past the bar like the native control, shows the bar's edge bent through it, and keeps the tab labels and icons beneath it sharp. The bar no longer redraws on every selection change.

### Added

- `LiquidGlass` accepts a negative `refractionPixels`, which bends the rim the other way so it pulls in what surrounds the glass.
- `liquidThickness(width, height)` exposes the size-to-thickness rule, and `LiquidGlassCanvas` accepts MotionValues for every scalar material value, so custom glass can thicken as it grows.
- The Morph Menu moves focus into its panel on opening, prefers the checked item, supports arrow keys, Home and End, and makes its closed panel inert.
- Development builds warn once for each element the DOM backdrop cannot draw: CSS gradients and `url()` backgrounds, and cross-origin media without CORS.
- `LiquidGlass` accepts `shadowBleed`, which lets a lens's shadow extend past the element instead of ending at its box.
- `LiquidGlass` accepts `sharpInk`, which keeps the captured text and icons crisp under frosted glass. They refract and disperse with the backdrop, and only the backdrop and the lens rim take the material's blur. `LiquidGlassCanvas` exposes the same layer as `contentSpace: "source"`.
- `GlassSwitch` and `GlassSlider` pass native input attributes (`id`, `aria-*`, `required`, `form`, `onBlur` and so on) to their input and accept `style`. A host label, either `id` with `<label htmlFor>` or `aria-labelledby`, replaces the fallback name.

### Documentation

- The README lists what the DOM backdrop draws and skips, explains that fixed glass must follow the content it floats over, and covers theming, browser support and server rendering.
- The documentation site is redesigned: live specimens on the home page, a material demo with its own sliders, quieter navigation, and the same light and dark themes in English and Chinese.

## 0.2.1 — 2026-10-02

### Fixed

- `crossorigin` media that passed CORS shows through glass backdrops.
- Decorative glass canvases are hidden from assistive technology; `LiquidGlassCanvas` takes `ariaLabel` for a meaningful one.
- Switch, Slider and the video seek bar show keyboard focus.
- Controls stay visible before a renderer is ready and in browsers without WebGPU or WebGL2.
- Form fields keep 16px text on touch devices, so iOS Safari does not zoom in.

### Changed

- The four Lucide icons the controls use are inlined; `lucide-react` is no longer a dependency.
- The Morph Menu keeps its backdrop revision in a MotionValue instead of re-rendering for it.

## 0.2.0 — 2026-09-29

### Added

- `GlassGroup` fuses up to eight DOM children in one canvas once they come within `spacing`.
- Opt-in optics: `refractionModel: "bevel"`, a pointer or device `lightSource`, and `material.tone`, which publishes `data-dg-tone`.
- Physical release and follow for Switch, Slider and Spotlight.
- React entries are marked `"use client"` for React Server Components.

### Fixed

- Shared material defaults no longer override each control's calibration, and frost stays stable while content moves underneath.
- Popover glass keeps drawing in the top layer and after the viewport resizes.
- Video seek-bar ARIA, GlassVideo autoplay under reduced motion, focus on icon-only controls and AA contrast on glass.
- The shared GPU device is released as soon as it is unused.

## 0.1.1 — 2026-09-14

- Package metadata: MIT license, repository, homepage and keywords.

## 0.1.0 — 2026-09-14

- First release: WebGPU-first liquid glass with a WebGL2 fallback, the `liquid-glass` and `apple-motion` cores, and React controls.
