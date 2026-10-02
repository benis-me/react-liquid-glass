# React Liquid Glass

Build the requested change within the accepted library and documentation product. Preserve existing material calibration, gestures, accessibility and data persistence; only change those when the user requests it.

## Structure and current behavior

- npm package: `rglass`, with library source in `packages/react-liquid-glass/src/`. Documentation and demos: `apps/docs/src/`. The npm-workspace builds are independent; docs consume public package APIs and the library never imports demo code.
- Controls compose the project-owned `liquid-glass` optical core and `apple-motion` motion core. The native WebGPU backend is primary with WebGL2 fallback. Retired SVG/filter-map APIs and compatibility shims remain retired; do not add the vgpu runtime.
- Preserve the existing multi-page docs, component catalog, Playground and mini-apps. UI supports persisted Chinese/English and light/dark settings; English is the default without a saved locale. Keep the title `React Liquid Glass`.
- Use the bounded shared backdrop adapter and demand rendering; preserve source revisions, offscreen pause, HDR capability checks and SDR fallback. Do not claim universal DOM capture or native-device parity from emulation.
- The QR specimen and deleted `docs/rendering-architecture.md` stay removed. Keep the existing Git-push deployment working.

## Task references

Read only relevant sections of [design constraints](docs/design-constraints.md):

- README artwork, page layout, typography, global HDR and material controls: Component library and documentation site.
- Optical backends and core boundaries: Core refactor.
- Switch/Slider/Tabs, video or original Morph Menu: Controls and source fidelity.
- Popover/Dialog/Sheet, current catalog controls, device behavior and shared backdrop: Component library details.

Keep precise optical/motion calibration in that document. Update the current rule when durable design feedback changes it, and keep this entry point short. For page design, implement directly from accepted references; do not generate image mockups unless requested. If a substantial visual change has no clear target, resolve only the missing source or outcome.

## Verification and handoff

- Reuse relevant existing checks. Exercise affected rendered/interactive/media flows in the actual preview; start the local server yourself when needed. Pure documentation edits need documentation checks, not a browser session.
- `npm run check` checks both workspaces; `npm test` builds the library and runs the existing tests; `npm run build` builds the library and docs. GitHub CI runs these checks without requiring Sites credentials.
- When publishing `rglass`, add the release to `packages/react-liquid-glass/CHANGELOG.md`, keep the library version and docs dependency aligned, verify the published package with a clean install, and synchronize the release sources to GitHub in the same task.
- Backend changes need relevant WebGPU/WebGL2 comparisons; device-specific claims require device evidence. Fix failures caused by the requested change and rerun affected checks; stop when the accepted outcome is met.
- Preserve `worker/index.js`, `scripts/prepare-sites-build.mjs`, `tests/sites-worker.test.mjs` and the environment-provided, ignored `.openai/hosting.json` when present. When changing Sites packaging or preparing a Sites handoff, run `npm run build:sites` and `npm run test:sites`; output must include `dist/client/index.html`, `dist/server/index.js` and `dist/.openai/hosting.json`. This environment-specific input is not required by npm publishing or Vercel builds.
