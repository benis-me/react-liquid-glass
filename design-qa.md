# Design QA — Liquid menu

## Current status — 2026-09-06

Implementation baseline: `3a99cc8`. The shared Liquid foundation is the Demo's default on `main`; see [the rendering architecture and comparison](docs/rendering-architecture.md). The dated history below is retained as evidence of earlier iterations, not current acceptance criteria.

- All Demo optics now use the shared WebGL2 material. Legacy SVG `Glass` remains exported, but no Demo switches back to it at rest.
- Menu open/close are 380ms/380ms. Interrupted opening scales its return clock to 209–380ms from the live body extent, including geometry, material, content attenuation and focus restoration. Normal closing retains the neck, unequal bodies and 34.6px → 34px absorption recovery, with at most 2px directional impact.
- Item corners are ordinary circular radii, 31px desktop / 30px mobile. Padding remains uniform at 14px/10px; sort rows remain 64px.
- Upper/lower inset reflections and the fine directional outer contour remain unchanged by the timing fix. Moving foreground ink refracts and defocuses through the live optical field; there is no static/dynamic material handoff.
- Switch/Slider stay white at rest, glass while held, with pixel-calibrated small-lens optics. Tabs retain their colored refracted content and independent motion. Slider active fill has a round endcap.

Verification:

- `npm run check`, 60 tests, Demo build and library build pass (rechecked 2026-09-06).
- Prior interaction QA on this implementation: Chrome, 1280 × 1040 desktop and 390 × 844 touch simulation; fast outside dismissal, repeated reversals, Escape, focus return, light/dark states. Ordinary tested paths reported no page exceptions. This is not native iPhone or Safari/Firefox certification.
- Open: reduced-motion first load can remain on lazy-demo placeholders. A subsequent theme update unblocks it; disabling transitions also unblocked a diagnostic run. The mounted menu's reduced-motion endpoint passed separately. No root-cause fix is claimed.
- Open: missing local `.openai/hosting.json` prevents Sites packaging. `npm run build` completes Demo/library stages but fails during Sites preparation; `npm run test:sites` passes 3 worker cases and fails the artifact case. Hosting/worker/build scripts were not changed to bypass this.

## Archived QA — before the unified foundation

All measurements, “passed” findings and checked items below belong to earlier captures. They do not supersede the current status above or the latest user-approved criteria in `AGENTS.md`.

- Structural source: `/var/folders/3w/q39958316yq7bvbyg7ffcsmc0000gp/T/codex-clipboard-d0e7b45d-b537-4137-867c-879735d229ff.png` (768 × 1575 px at 144 dpi).
- Regression evidence: opening edge frame `codex-clipboard-bea78dd1-588d-4b04-994a-585d5f26f879.png`; closing discontinuity frames `codex-clipboard-392a2c2f-d00f-4110-a288-9799e55f3eb0.png` and `codex-clipboard-a4492c10-3404-4f19-99db-373ba4ccea81.png`.
- Material reference: Apple WWDC25 “Meet Liquid Glass”, 305.25–305.75s; extracted reference frames `/tmp/glass2-ios-ref.ZgWzkx/menu-016.jpg` through `/tmp/glass2-ios-ref.ZgWzkx/menu-021.jpg` (640 × 360 px). The latest direct user instruction is authoritative for motion timing.
- Implementation screenshot target: retained Codex in-app Browser tab at `http://127.0.0.1:32472/#liquid`.
- Motion capture: 661 × 998 CSS px at DPR 2.
- Compared states: closed, opening contraction, expansion, single overshoot, settled open, closing swell, continuous neck collapse, button contact, impact squash, and settled button.

## Full-view comparison evidence

- The menu is now tall and phone-like: 404 × 748 CSS px at the default viewport and 319 × 690 CSS px at 390px viewport width.
- The icon center stays exactly 38px inward from both the menu's right and bottom edges. Current browser measurements were panel right/bottom `542/537.05` and icon center `504/499.05`; the two states therefore retain the original shared bottom-right anchor instead of becoming separate objects.
- The 72px QR-style square grid remains the only substrate. It is visible through the material and visibly bends at the Glass boundary; no QR modules appear.
- The screenshot supplies anatomy only, so its dark color is not copied in light mode. The existing project light/dark Glass treatments remain authoritative.
- Menu content padding is uniform on every side: 14px desktop and 10px mobile. All four sort rows measured exactly 64px before and after changing selection. Item hover/selection now uses a larger 56px desktop / 52px mobile horizontal radius with a 50% vertical radius.

## Focused comparison evidence

- Opening motion: the 0.38s trajectory measures 68 × 68 → 56.3 × 56.8 contraction → 410.4 × 756.9 overshoot → 404 × 748 rest. Browser sampling observed final geometry by about 360ms. It crosses the final size only once and never undershoots it.
- Closing motion: the 0.42s trajectory shrinks and moves the menu toward the fixed bottom-right icon while the button grows from 2px to 68px. It smooth-unions both rounded SDF blobs, carries the joined body 8px along the panel-to-button vector, overshoots the button to a 37px half-size, and performs one continuous recoil to 34px. Temporary 1.50s captures verified approach, neck, impact, recoil, and settled states; production timing was restored afterward.
- Easing: opening uses a pronounced `cubicBezier(0.32, 0, 0.18, 1)` S-curve; closing accelerates into contact with `cubicBezier(0.35, 0, 0.7, 0.45)` and then uses two stronger nonlinear impact/recoil segments. There is no linear interpolation, intermediate velocity restart, or free-running spring.
- Press anchor: the closed lens center measured 487 × 498.79 before press and 487 × 498.79 during press (less than 0.01px drift), confirming center-origin scaling.
- Corner system: runtime computed styles report `superellipse(2)` and `56px / 50%` for desktop item rows, while the trigger and internal Glass shadow layer report `superellipse(1)` (`round`). The larger item contour remains harmonious with the 44px panel radius while keeping the icon circular and preventing CSS squircle layers from diverging from the Glass SDF mask.
- Shadow and frost: the moving compositor uses `shadowStrength: 0.075`, `specularStrength: 0.72`, visible `chromaAmount: 0.55`, and brings blur in early before peaking at 6. Its 0.30 glow is one-sided and shifted 4–14px inside; the transition edge term is zero, eliminating the bright outer ring. Shadow samples a 10px downward-offset SDF with 26px decay and reduced peak. At handoff the core shadow starts at matching opacity 0.34 and eases over 140ms, while core specular independently fades 0→1 over 180ms.
- Transitional content: the content is clipped to the live lens, stays absent during contraction, and fades in during expansion with only a 0.985→1 scale and 2px→0 blur.
- Material: the stable menu and button are core `Glass` surfaces. During geometry changes, the project-owned compositor is the sole visible geometry. Its shader now mirrors core Glass's per-blob spherical-cap gradient, exact `tanh(√π·x)` depth falloff, nine-tap frost, brightness, tint, chroma, local-coordinate rotated glow, edge highlight, and displacement-only zoom while consuming the same live values. The settled shape is handed back atomically instead of opacity-crossfading two optical contours. It contains no trail/tail primitive and uses no external dependency.

## Comparison history

1. P1: three circular actions and QR modules did not match the requested menu. Replaced with one tall menu over a square grid.
2. P1: copied dark styling and a separate simplified renderer lost the project material. Deleted the renderer and moved the entire effect onto core `Glass`.
3. P1: the first core-Glass pass was a uniform, over-damped card expansion with thick tint. Replaced it with anchored clear size-adaptive optics.
4. P2: the panel was too squat and showed too few rows. Increased its aspect ratio and stage clearance to match the supplied phone-menu structure.
5. P1: the under-damped whole-panel spring skipped the small capsule phase and produced a slow generic wobble; the refracted transition copy also enlarged text excessively. Replaced both with the explicit six-state trajectory and a late readable content reveal.
6. P1: the monotonic opening correction removed the requested anticipation and rebound. Replaced it with separate nonlinear opening and closing trajectories that each contract/expand past the target and settle once.
7. P1: opening overshot, undershot, then settled, which read as two bounces; closing eased out too early at its intermediate neck and then jumped into the button. Removed the opening undershoot and redistributed closing motion so velocity stays continuous until contact, where one explicit impact squash now occurs.
8. P1: the corrected trajectories still felt leisurely at 540/560ms. Reduced them to 380/420ms, shortened anticipation and settling, and completed content reveal before geometry rest without changing the approved motion path.
9. P1: closing at 420ms still felt too long, button press scaled toward the fixed bottom-right edge, and the main easing curves read as nearly linear. Reduced close to 300ms, removed its intermediate geometry keyframe, strengthened the nonlinear curves, and synchronized edge motion with half extents to hold the button center fixed.
10. P1: the contact squash was centered on the button, so it had deformation but no directional momentum. Derived the actual panel-to-button vector and moved both lens and icon 8px along it during impact before one shared recoil.
11. P2: menu padding felt loose and 13px item corners were too conservative. Reduced the outer padding, maximized item radius, and applied native squircle corners to every rounded Liquid surface.
12. P1: applying squircle through every internal Glass descendant created mismatched CSS/SDF edges and changed the circular trigger. Removed the wildcard and trigger override; squircle now stays on compatible menu surfaces only.
13. P2: the expanded shadow was too solid at opacity 1. Reduced its rest strength to 0.56 and capped transition peaks at 0.62.
14. P2: `999px` item corners were capped by the short side and still looked too small. Replaced them with `44px / 50%` desktop and `40px / 50%` mobile radii tied directly to the menu radius.
15. P1: two overlapping core Glass surfaces could not produce a real fused neck. Restored the project-owned rounded-rect/circle smooth-min compositor only for contact and crossfaded back to core Glass after absorption; the neck now participates in the complete optical pipeline with no tail droplet.
16. P1: a later layout pass separated the button from the menu. Restored the original shared anchor at `panelRight - 38`, `panelBottom - 38`; the button again occupies the menu's bottom-right corner.
17. P2: menu padding was asymmetric and changing the selected sort item changed perceived row height. Set uniform 14px/10px padding and fixed every sort row at 64px.
18. P1: the velocity shader projected a nonsquare rounded rectangle into a rotated local basis. Any nonzero velocity changed its 144 × 240 bounds to about 279 × 235 before stretch was even considered, causing the photographed one-frame rotation/size jump. Reconstructed the deformed vector in world coordinates and reduced synthetic velocity peaks.
19. P1: core Glass's animated filter/decorative layers exposed multiple contours during opening, and opacity crossfades exposed another double edge at handoff. Made the smooth-min compositor the only visible moving layer and changed the settled handoff to an atomic swap. Increased transition blur, reduced rim strength, retained only a faint moving shadow, and added one 37→34px button recoil plus a delayed stable-shadow fade.
20. P1: the transition WebGL initially used an independent simplified material, so it lost the stable Glass frost and made backend switching visible. Ported core Glass's depth/falloff and directional highlight model into the union shader, shared live depth/blur/tint/zoom values, and matched the material before atomic handoff.
21. P2: item corners still felt too small at the panel scale. Increased their elliptical radii from 44px/40px to 56px/52px while preserving the 50% vertical radius and squircle shape.
22. P1: recording still exposed a material jump because matching parameter names was insufficient: transition refraction used the scene normal, highlight used the normal instead of local coordinates, erf used a different approximation, and zoom magnified source UVs. Ported the core spherical-cap constants per blob, exact tanh-erf falloff, local-coordinate highlight, nine-tap frost, brightness, and displacement-only zoom. Slow and production-speed captures then retained the same texture behavior through handoff.
23. P1: making the transition highlight additive restored visibility but its absolute local alignment and edge term produced a bright outer ring. Switched to one-sided local alignment, moved the glow 4–14px inward, and removed the transition edge term.
24. P1: transition shadow was too tight and its handoff restarted from a much weaker core opacity. Replaced the 9px centered decay with a 10px-offset/26px soft decay, matched the core handoff at 0.34, and added an independent 180ms core-specular fade.
25. P1: the appearing trigger regained pointer handling before close finished; a cursor crossing it fired `pointerleave`, stopped every animation at the approach keyframe, and mimicked a dropped frame. Locked trigger handlers until handoff completion. Closing content now reverses its reveal over 240ms instead of disappearing in 100ms.

## Verification

- Primary interactions: open, outside close, global Escape close, sort selection, filter toggle, and internal scrolling.
- Page identity: `React Liquid Glass` at the expected local route.
- Framework overlay: absent.
- Console after a fresh reload and open interaction: no warnings or errors.
- Fonts/typography: existing Fontsource Manrope/Noto Sans SC stack retained; hierarchy, wrapping, and optical weight checked.
- Spacing/layout: panel aspect ratio, concentric radius, anchored origin, row rhythm, divider, icon column, chevron, and scrollbar checked.
- Colors/tokens: adaptive project monochrome tokens retained; color copying from the structural screenshot intentionally excluded.
- Assets: no raster assets required; existing Lucide icon source retained.
- Copy: bilingual, brand-neutral menu labels retained.

## Findings

- No actionable P0/P1/P2 differences remain for the requested structure, Glass material, or Apple-style pop-open dynamics.

## Open questions

- None.

## Implementation checklist

- [x] Core `Glass` stable surfaces plus one exclusive smooth-min motion compositor
- [x] Opening anticipation and one smooth overshoot-to-rest
- [x] Closing continuous absorption and one contact-impact squash
- [x] Nonlinear cubic-bezier easing throughout
- [x] Readable late content materialization
- [x] Visible light/dark grid lensing
- [x] Compact menu padding and menu-radius-derived item corners
- [x] Squircle menu surfaces with round Glass/SDF layers and circular trigger
- [x] Restrained expanded shadow
- [x] Frosted moving material with faint shadow and restrained rim
- [x] Core-Glass depth/falloff/highlight model shared by the WebGL union state
- [x] Continuous world-space velocity deformation without rotated-bound jumps
- [x] Atomic contour-safe handoff and one button recoil
- [x] Matched soft-shadow handoff and independent static-specular fade
- [x] Trigger-event lock through the full morph
- [x] 240ms reverse content reveal on close
- [x] Original shared menu/button bottom-right anchor
- [x] Uniform padding and fixed sort-row height
- [x] Desktop motion sampling and interaction QA

historical result: passed for that earlier iteration; current open items are listed above.
