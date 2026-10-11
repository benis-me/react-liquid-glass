# Changelog

Notable changes to `rglass`. Versions follow semantic versioning; before 1.0, a minor version may include breaking changes.

## 0.3.0 — 2026-10-10

### Changed

- All glass is one material, and it thickens with size, as Apple's does. A Button, a Card, a popup, the Morph Menu, Spotlight and Video take their look from one table, instead of four separately calibrated families, by one rule from a 48px control to a 320px panel: as the body grows, its shadow deepens and softens, its rim lenses more strongly, its light softens and busy backgrounds diffuse more. The two ends are the Button's material and the open Morph Menu's, so glass of the same size looks alike whichever component draws it, and tooltips stay thin. Cards, accordions, toasts and inspectors now thicken as popups do, and a popup's frost at a control's size matches a Button's (0.2px, was 0.4px). On dark pages all regular glass tints toward the page.
- Glass comes in two variants, as Apple's does: `regular`, frosted UI glass, and `clear`, for media. Clear glass has no frost or tint, and its lensing stays in a narrow rim without extra magnification, so what lies beneath stays vivid and legible at any size. Spotlight and Video are clear glass; Video's controls are thin control glass.
- Glass has one resting optical profile, the calibrated dome, and lifts into the lens when a tab is pressed or a thumb held (`LIFTED_GLASS`). One precedence rule applies to every glass: its own values, then the provider's above its constants, never above values it animates; what neither sets follows the glass's size.
- One physics. Every motion is the same damped spring with a named preset, instead of a mix of springs, frame tweens and easing curves imitating a bounce. Glass presses one way, growing 2.5% on the Button's spring: the popup trigger used its own spring and the Morph Menu trigger an 80ms tween. Held `GlassSwitch` and `GlassSlider` thumbs lift into the lens and settle back on a pressed tab's springs instead of fixed-length curves; a tapped Switch travels on the same spring as a flicked one (it was a 0.6s tween); a `GlassSlider` thumb pulled past an end springs back with the velocity of its last moves; `GlassSpotlight` grows and shrinks on a spring instead of a frame tween. `SEGMENTED_LIFT_SPRING` is `LIFT_SPRING`, joined by `GLASS_PRESS_SCALE`, `PRESS_GLOW_SPRING`, `THUMB_FILL_SPRING`, `SPOTLIGHT_RESIZE_SPRING`, `ALERT_SPRING` and `ACCORDION_SPRING`, and `springTo` can be awaited like a Motion animation.
- `GlassSurface`'s `blurStrength` is the frost at a panel's thickness (default 12, as popups take it), and smaller surfaces scale it with their size like all glass. It was a fixed frost.
- `LiquidMenu`'s `theme` is optional and follows the host page.
- A press lights the glass from within, as iOS 27's does, instead of a bright spot: the glow starts under the finger, spreads through the whole glass in about 0.3 seconds and on to glass fused with it, and stays brighter toward the finger as it moves. It scales with the glass however large, and over light content it brightens gently instead of washing out to white. `GlassGroup` shapes now press like a Button, growing 2.5% and lighting up, and their glow reaches their neighbours. `LiquidGlassBlob` takes `contactSpread`.
- HDR light is restrained. A press lights the glass near 1.2× SDR white, about 1.3× toward the finger, instead of a spot near 3×, the static rim near 1.2×, and overlapping light never stacks into glare: contact and rim share one soft cap, identical on WebGPU and WebGL2.
- Glass edges follow iOS 27's darkened border and brighter static highlights. The contour depends on edge strength alone, so it no longer thins on HDR displays. The static top and bottom highlight is about a third brighter over light content and more than twice as bright over dark content, so dark-mode glass keeps a crisp, defined edge. Like the lifted lens's rim line, it now reaches round the corners toward the sides, faint there.
- Pointer feedback is quieter. Tabs and Morph Menu rows fill on hover at once instead of fading, Tabs labels keep their color on hover, and `GlassButtonGroup` buttons, items within one glass, press to 97% over 100ms.
- A pressed `GlassTabs` lens and held `GlassSwitch` and `GlassSlider` thumbs are iOS 27's lifted lens, matched to native screenshots. The glass is clear instead of milky. Its rim bulges outward and pulls in what surrounds it, so the bar seen through it looks smaller, while a held tab's icon and label grow slightly; it keeps magnifying while the press drags, with the tab under it in the selected colour and no glow. In light mode its edge is a fine, even grey line, its rim stays white and it casts a soft shadow, as iOS 27's does. Its rim pulls in what surrounds it all the way round, so the bar's edges follow the rim in one smooth outline and the end of a bar it overhangs bends into an arc concentric with it, as far from the rim as the bar's top and bottom. At its ends the rim compresses what it passes over toward the edge instead of folding it back, so labels a dragged lens slides across stay in order. It grows past its tab in proportion to the tab's height, so it overflows small and large bars by the same share as iOS 27's. Its rim is thick: along the top and bottom the outer slope mirrors what lies just inside it, so warm and cool crescents gather at opposite ends of the rim. Held thumbs show their track at its own size and magnify it as a pressed tab magnifies the bar, so its edges run flat into the rim instead of denting near the lens's ends. They cast the same soft shadow in light mode and none on dark pages, stop lighting up once dragged, and fill back in with white as soon as they are released, so no grey ghost of the track lingers inside them.
- Dragged glass moves like a soft body on a spring. The `GlassTabs` lens and held `GlassSwitch` and `GlassSlider` thumbs stretch along their motion with speed, by up to about a fifth, and when they stop or land they overshoot into a brief squash and rebound; a pressed tab's lens lifts with a slight overshoot. Held thumbs stay round while still instead of squashing narrower and taller, and the stretch no longer depends on the display's frame rate.
- A dragged `GlassTabs` lens follows the finger a little past the first or last tab with the same rubber band as a `GlassSwitch` thumb, by at most the thumb's 11px, carrying the whole bar slightly along, and both spring back on release. It never reaches into a clipping ancestor, so tab bars in scrollers stay whole. It used to stop dead at the end tab.
- While a tab is pressed, the whole `GlassTabs` bar, tabs and all, grows slightly about its centre and returns on release, as iOS 27's tab bar does. What shows through the grown bar and its lens stays registered with the page, the same at the lens's top and bottom.
- The Morph Menu's closed trigger is the same glass as a Button. It no longer magnifies the content behind it or carries the open menu's deep shadow, and pressing it lights the glass where it is touched instead of pulsing its zoom. Its open panel diffuses busy backgrounds like the other popups instead of showing them sharply magnified.

### Fixed

- `GlassSlider` reports values at the precision of its step and minimum: a step of 0.05 from -1 reports -0.4, not -0.3999999999999999.
- Reduced motion is read live everywhere, from one source shared by both cores; Motion's `useReducedMotion` read it once. The Morph Menu trigger's press now honors it, and `GlassSpotlight` no longer writes a non-finite lens size for a frame when it resizes under it.
- A provider constant no longer freezes values glass animates: the lifted lens's magnification and shadow in Tabs, Switch and Slider, and the Morph Menu's edge depth and fusion neck.
- A provider's `refractionModel` can no longer turn every Tabs, Switch and Slider lens into resting glass.
- `GlassVideo` keeps its own rendering resolution and unfused buttons under a provider's `pixelRatio` or `mergeDistance`.
- Fusion necks refract continuously: a body's rim slope no longer draws straight seams or shard-like patches inside fused glass.
- Pressed Switch and Slider thumbs no longer cut their shadow at the edge of the control's canvas.
- `LiquidGlassCanvas` honors instance material values over the shared defaults. Provider presets no longer freeze the Morph Menu's animated blur, tint and zoom, and an instance `hdr={false}` also removes the HDR highlight default.
- Controls follow `class="dark"` hosts (next-themes, shadcn) as well as `data-theme="dark"`.
- Published declarations resolve under `moduleResolution: NodeNext`; exported types no longer degrade to `any` there.
- `GlassInput` and `GlassSelect` add their description or error to the host's `aria-describedby` instead of replacing it.
- Switch and Slider thumbs move to their new state immediately under `prefers-reduced-motion`.
- Tabs land in one motion. The lens stays lifted until it reaches its tab, then sinks back and dissolves into the base color once it has nearly settled, instead of resting as glass and then switching, so its magnified label gives way to the resting one without a jump in size. The base color no longer slides ahead of the lens when pressed.
- A dragged Tabs lens changes size smoothly between tabs of different widths instead of jumping at the midpoint. Its stretch now follows speed, and the velocity zoom is gone.
- Releasing a quickly dragged tab no longer flings its lens far past the bar or collapses its width, and it lands on the tab under the finger instead of one short: the lens keeps the velocity it measured over its last moves. A flicked `GlassSwitch` reads its velocity the same way.
- `useVelocityDeformation` keeps measuring a source that changes once a frame; it stopped on the frame after each change and missed pointer-driven motion.
- A pressed Tabs lens grows past the bar like the native control, shows the bar's edge bent through it, and keeps the tab labels and icons beneath it sharp. The bar no longer redraws on every selection change.
- Glass inside a scaled element, such as one under a CSS `scale` transform, shows the page that is actually behind it and keeps its text and icons in place, instead of a slightly shifted copy.

### Added

- Glass can be described as Apple describes it, in three values, with everything else following from its size: `variant` (`regular` or `clear`), `clarity`, from -1, more tinted and frosted, through 0, the calibrated default, to 1, more clear, as Apple's Liquid Glass setting moves between Tinted and Clear, and `tint`, a CSS color for glass that marks a prominent action, which keeps its color however clear the rest is. A provider's `material` takes them (`GlassLook`), `GlassButton`, `GlassCard` and `GlassSurface` take them as `glass`, `LiquidGlass` in its `material`, `LiquidGlassCanvas` takes `clarity` and `tint`, and `perceiveGlass` applies a look to material values for custom renderers. The lifted lens keeps its own calibration under every look, and a resting thumb stays opaque.
- Glass follows the reader's display settings, live: under `prefers-reduced-transparency: reduce` it is its most tinted, and under `prefers-contrast: more` it is as tinted, with a firmer edge. `useGlassAccessibility()` reads both.
- `glassMaterial(thickness, { variant, dark })` returns the one glass material at a thickness, and `GlassVariant` names its `regular` and `clear` variants. `LiquidGlassCanvas` takes `variant` and `thickness` (by default, its first body's live size), `LiquidGlass` takes `variant`, and `GlassSpotlight` takes `material`.
- `LIFTED_GLASS` with `lensMagnification` draws the lifted lens on any glass, on WebGPU and WebGL2 alike.
- `springTo` takes an explicit starting velocity. `useVelocityDeformation` takes `smoothing`, which averages the source's speed, and its function `stiffness` and `damping` receive the deformation and its target, so a spring can relax differently than it builds. `THUMB_DEFORMATION`, `LIFT_SPRING` and `SEGMENTED_OVERDRAG` join the motion presets.
- `liquidThickness(width, height)` exposes the size-to-thickness rule, and `LiquidGlassCanvas` accepts MotionValues for every scalar material value, so custom glass can thicken as it grows.
- The Morph Menu moves focus into its panel on opening, prefers the checked item, supports arrow keys, Home and End, and makes its closed panel inert.
- Development builds warn once for each element the DOM backdrop cannot draw: CSS gradients and `url()` backgrounds, and cross-origin media without CORS.
- `LiquidGlass` accepts `shadowBleed`, which lets a lens's shadow extend past the element instead of ending at its box.
- `LiquidGlass` accepts `sharpInk`, which keeps the captured text and icons crisp under frosted glass. They refract and disperse with the backdrop, and only the backdrop and the lens rim take the material's blur. `LiquidGlassCanvas` exposes the same layer as `contentSpace: "source"`.
- `GlassSwitch` and `GlassSlider` pass native input attributes (`id`, `aria-*`, `required`, `form`, `onBlur` and so on) to their input and accept `style`. A host label, either `id` with `<label htmlFor>` or `aria-labelledby`, replaces the fallback name.

### Removed

These were redundant or superseded; there is now one glass and one way to tune it.

- `refractionModel: "bevel"`, the opt-in flat-slab profile from 0.2.0. Provider material no longer takes `refractionModel`; glass lifts into the lens itself.
- `GlassActionButton`, the former Liquid Button kept for compatibility. Use `GlassButton`.
- `LIQUID_LENS` and `DEFAULT_MATERIAL`: glass takes its defaults from its size (`glassMaterial`). `useGlassMaterialOverrides` is now `useGlassMaterial`, which returns the provider's material.
- `LiquidLens` holds a lens's geometry only (`lensW`, `lensH`, `borderRadius`). Its optical keys move to `material` under the renderer's names: `depth` is `edgeDepth`, `scaleX`/`scaleY` are `refractionStrength`, `blurAmount` is `blurStrength`, `tint` is `tintStrength`.
- `LiquidGlass`'s `sourceBackground` and `shadowOpacity`. A negative `refractionPixels` no longer bends resting glass outward; the lifted lens pulls in its surroundings.
- `tween` from `rglass/apple-motion`; use `springTo`. `useDerivedMotion` and `useVelocityDeformation`'s `setBoost`, both unused, and `MenuMotionOptions.onPress`.

### Documentation

- The README lists what the DOM backdrop draws and skips, explains that fixed glass must follow the content it floats over, and covers theming, browser support and server rendering.
- The documentation site is redesigned: live specimens on the home page, a material demo with its own sliders, quieter navigation, and the same light and dark themes in English and Chinese.
- The material panel leads with the glass's look: its variant and a clarity slider from more tinted to more clear. The renderer's values sit under More parameters. Its presets are Default, Clear, Tinted and Prism; the former Clear and Frosted presets of hand-picked values are gone.

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
