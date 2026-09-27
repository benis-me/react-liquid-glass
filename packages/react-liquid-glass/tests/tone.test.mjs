import assert from "node:assert/strict";
import test from "node:test";
import { readLiquidTone } from "../dist/liquid-glass.js";

// A recording 2D context stands in for the 8x8 luminance probe.
test("backdrop tone uses linear luminance with hysteresis around mid-gray", () => {
  let fill = [0, 0, 0, 255];
  const context = { clearRect() {}, drawImage() {}, getImageData: () => ({ data: Uint8ClampedArray.from({ length: 8 * 8 * 4 }, (_, i) => fill[i % 4]) }) };
  const saved = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    const canvas = { width: 120, height: 80 }, region = { left: .25, top: .25, width: .5, height: .5 };
    const tone = (gray, previous, alpha = 255) => { fill = [gray, gray, gray, alpha]; return readLiquidTone(canvas, region, previous); };
    assert.equal(tone(250), "light");
    assert.equal(tone(20), "dark");
    // sRGB 118 is about 0.18 linear: inside the band, the previous tone holds.
    assert.equal(tone(118, "light"), "light");
    assert.equal(tone(118, "dark"), "dark");
    assert.equal(tone(118), "light", "without history, mid-gray splits at 0.18");
    assert.equal(tone(140, "dark"), "light", "leaving the band switches tone");
    assert.equal(tone(250, "dark", 0), "dark", "a transparent backdrop keeps the previous tone");
    assert.equal(readLiquidTone({ width: 0, height: 0 }, region, "dark"), "dark", "an empty backdrop keeps the previous tone");
  } finally {
    if (saved === undefined) delete globalThis.document; else globalThis.document = saved;
  }
});
