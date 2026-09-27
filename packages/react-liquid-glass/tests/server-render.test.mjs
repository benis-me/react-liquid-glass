import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";

// Server rendering has no DOM: imports and markup must not touch browser APIs.
test("controls render static markup on the server", async () => {
  const lib = await import("../dist/index.js");
  const html = renderToString(h(lib.LiquidGlassProvider, { material: { tone: true, lightSource: "pointer" } },
    h(lib.GlassButton, null, "Continue"),
    h(lib.GlassSwitch, { ariaLabel: "Wi-Fi" }),
    h(lib.GlassSlider, { ariaLabel: "Volume", defaultValue: 30 }),
    h(lib.GlassTabs, { label: "Views", items: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }] }),
    h(lib.GlassGroup, null, h("span", null, "A"), h("span", null, "B")),
  ));
  assert.match(html, /Continue/);
  assert.match(html, /role="switch"[^>]*aria-label="Wi-Fi"|aria-label="Wi-Fi"[^>]*role="switch"/);
  assert.match(html, /type="range"/);
  assert.match(html, /role="tablist"/);
  assert.doesNotMatch(html, /data-dg-tone/, "tone is measured after hydration, never on the server");
});

test("React entries are client modules; the renderer and motion cores are not", () => {
  const read = file => readFileSync(new URL(`../dist/${file}`, import.meta.url), "utf8");
  for (const entry of ["index", "controls", "liquid-glass", "apple-motion-react"]) {
    for (const extension of ["js", "cjs"]) assert.ok(read(`${entry}.${extension}`).startsWith('"use client";'), `${entry}.${extension} lacks "use client"`);
  }
  for (const entry of ["liquid-glass-renderer", "apple-motion"]) {
    for (const extension of ["js", "cjs"]) assert.ok(!read(`${entry}.${extension}`).includes('"use client"'), `${entry}.${extension} must stay framework-agnostic`);
  }
});
