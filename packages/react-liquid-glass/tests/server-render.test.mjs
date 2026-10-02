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
  // The reduced-motion preference is unknown on the server, so autoplay starts on the client.
  const video = renderToString(h(lib.GlassVideo, { src: "/film.mp4", autoPlay: true, muted: true }));
  assert.match(video, /<video/);
  assert.doesNotMatch(video, /autoplay/i, "server markup must not autoplay before the preference is known");
});

test("Switch, Slider and Input keep the host's own labelling attributes", async () => {
  const lib = await import("../dist/index.js");
  const input = tag => html => html.match(new RegExp(`<input[^>]*${tag}[^>]*>`))?.[0] ?? "";
  // Native attributes reach the inner input; a host label replaces the fallback name.
  const toggle = input('role="switch"')(renderToString(h(lib.GlassSwitch, { id: "wifi", "aria-describedby": "wifi-hint", required: true })));
  assert.match(toggle, /id="wifi"/);
  assert.match(toggle, /aria-describedby="wifi-hint"/);
  assert.match(toggle, /required/);
  assert.doesNotMatch(toggle, /aria-label=/, "a <label htmlFor> must name the switch, not a fallback aria-label");
  assert.match(input('role="switch"')(renderToString(h(lib.GlassSwitch, {}))), /aria-label="Switch"/, "an unlabelled switch keeps a fallback name");
  const range = input('type="range"')(renderToString(h(lib.GlassSlider, { "aria-labelledby": "volume-label", form: "settings" })));
  assert.match(range, /aria-labelledby="volume-label"/);
  assert.match(range, /form="settings"/);
  assert.doesNotMatch(range, /aria-label=/);
  // A description adds to the host's aria-describedby instead of replacing it.
  const field = input('aria-describedby')(renderToString(h(lib.GlassInput, { label: "Name", description: "Shown on your profile", "aria-describedby": "name-rules" })));
  assert.match(field, /aria-describedby="[^"]*-hint name-rules"/);
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
