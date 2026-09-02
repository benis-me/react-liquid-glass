# Dezin Glass React

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
import "refractive-glass-react/style.css";

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

`x` and `y` are normalized lens-center coordinates by default. Use `positionUnit="pixel"` for CSS-pixel coordinates. Moving the lens does not regenerate the map.

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
