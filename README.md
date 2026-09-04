# React Liquid Glass

A reusable React library for real-time liquid-glass refraction on the web.

## What is implemented

- `Glass`: live DOM refraction with a generated PNG displacement map and SVG `feDisplacementMap` chain.
- `GlassCanvas`: the same map applied to Canvas, image, or video pixels with WebGL2.
- `GlassSwitch`, `GlassSlider`, `GlassSegmented`: accessible native controls built on `Glass`.
- Quarter-map generation, map caching, chromatic passes, specular channel, Safari filter-ID refresh, light/dark responsive Demo.

`lensW` and `lensH` are half-extents. A lens with `lensW: 70` is 140 CSS pixels wide.

## Use

```tsx
import { Glass } from "refractive-glass-react";

<Glass
  lens={{
    lensW: 70,
    lensH: 60,
    borderRadius: 28,
    depth: 10,
    domeDepth: 24,
    scaleX: 0.1,
    scaleY: 0.1,
    chromaAmount: 0.2,
  }}
  x={0.5}
  y={0.5}
>
  <YourLiveContent />
</Glass>
```

The core `Glass` and `GlassCanvas` components do not require a stylesheet. Import the separate control styles only when using `GlassSwitch`, `GlassSlider`, or `GlassSegmented`:

```tsx
import { GlassSlider } from "refractive-glass-react";
import "refractive-glass-react/controls.css";
```

`x` and `y` are normalized lens-center coordinates by default. Use `positionUnit="pixel"` for CSS-pixel coordinates. Moving the lens does not regenerate the map.

## Liquid motion

The Liquid menu and its icon button use separate core `Glass` surfaces at rest and shared compositor-bound MotionValues. During the complete 380ms opening and 420ms closing morph, the internal non-exported `LiquidGlassCanvas` becomes the sole visible geometry so one smooth-min SDF owns the boundary and merged neck. Its WebGL material mirrors core Glass's spherical-cap displacement, exact erf falloff, nine-tap frost, brightness, tint, chroma, local-coordinate glow, edge highlight, and displacement-only zoom; the core layer returns only after geometry and material settle. Close carries the joined body 8px toward the button, overshoots to a 37px half-size, then performs one smooth recoil to its 34px rest radius. No external gooey package or tail droplet is used.

The icon center stays 38px inward from the menu's right and bottom edges. Menu content padding is uniform (`14px` desktop, `10px` mobile), sort rows remain exactly `64px` tall after selection, and item corners use larger `56px / 50%` desktop and `52px / 50%` mobile squircles. Closing content fades, scales, and blurs out over 240ms. Transition highlight is a one-sided glow inside the surface, never an outer ring; its broad shadow hands off at matched intensity, while the core Glass specular channel eases in separately over 180ms.

## Commands

```bash
npm run dev       # Demo
npm run check     # TypeScript
npm test          # Lens-map invariants
npm run build     # Demo + ESM/CJS library + declarations
```

Library output is written to `dist/library`; the Sites-ready Demo is written to `dist/client`.

## Demo structure

- `src/App.tsx` only composes page sections.
- `src/demo/` contains page chrome and small presentation primitives.
- `src/demos/` contains self-contained interactive demonstrations.
- `src/styles/` separates theme foundations, page layout, and demo-specific CSS.

## Notes

- Keep SVG-filtered DOM regions focused. Safari has practical source-graphic size ceilings.
- Use `GlassCanvas` for Canvas content and for live video where Safari does not run the SVG filter path.
- Demo-only Dezin assets under `public/assets` are excluded from the library package.

## Reference and attribution

This project is an independent implementation informed by studying Aave Design's [Building Glass for the Web](https://aave.com/design/building-glass-for-the-web). It is not affiliated with or endorsed by Aave; the original article, materials, and trademarks remain the property of their respective owners.

The liquid-geometry work was informed by studying the architecture of Jakub Antalik's MIT-licensed [liquid-gooey](https://github.com/Jakubantalik/Libraries/tree/main/packages/liquid-gooey); no code from that package is installed or used at runtime.
