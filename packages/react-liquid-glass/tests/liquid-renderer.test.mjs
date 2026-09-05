import assert from "node:assert/strict";
import test from "node:test";
import { createLiquidGlassRenderer, motionValue } from "../dist/index.js";

// A small recording context checks the real renderer's resource lifecycle. Shader
// compilation and pixels are additionally checked in the real-browser QA pass.
test("Liquid shares a device, retains textures, recovers loss and disposes per owner", () => {
  const calls = [];
  let devices = 0;
  class Canvas extends EventTarget {
    width = 100; height = 60;
    getContext(kind) {
      if (kind === "2d") return { clearRect() {}, drawImage() {} };
      if (this.gl) return this.gl;
      devices++;
      return this.gl = new Proxy({ canvas: this, isContextLost: () => false }, {
        get: (target, key) => {
          if (key in target) return target[key];
          if (String(key).toUpperCase() === key) return key;
          return (...args) => {
            calls.push([key, ...args]);
            if (/^create/.test(key)) return {};
            if (/^get(Shader|Program)Parameter$/.test(key)) return true;
            if (key === "getUniformLocation") return args[1];
            if (key === "getAttribLocation") return 0;
          };
        },
      });
    }
  }
  const globals = { document: globalThis.document, window: globalThis.window, HTMLVideoElement: globalThis.HTMLVideoElement, HTMLImageElement: globalThis.HTMLImageElement };
  Object.assign(globalThis, { document: { createElement: () => new Canvas() }, window: { devicePixelRatio: 3 }, HTMLVideoElement: class {}, HTMLImageElement: class {} });
  const a = new Canvas(), b = new Canvas(), source = new Canvas(), ink = new Canvas();
  let restores = 0;
  const first = createLiquidGlassRenderer(a, { shared: true, onRestore: () => restores++ });
  const second = createLiquidGlassRenderer(b, { shared: true, onRestore: () => restores++ });
  try {
    assert.equal(devices, 1, "surface count must not multiply WebGL contexts");
    const x = motionValue(.5);
    const frame = { source, width: 100, height: 60, blobs: [{ x, y: .5, radius: 20 }], content: ink, contentOpacity: 1 };
    assert.equal(first.draw(frame), true);
    assert.equal(a.width, 250, "DPR is bounded at 2.5");
    second.draw(frame);
    x.set(.7);
    first.draw(frame);
    assert.deepEqual(first.stats, { draws: 2, sourceUploads: 1, contentUploads: 1 }, "geometry changes reuse both pixel textures");
    first.draw({ ...frame, sourceRevision: 1 });
    assert.equal(first.stats.sourceUploads, 2);
    assert.equal(first.stats.contentUploads, 1);
    first.draw({ ...frame, sourceRevision: 1, contentRevision: 1 });
    assert.equal(first.stats.contentUploads, 2);
    assert.equal(first.draw({ ...frame, width: NaN }), false);
    assert.equal(first.draw({ ...frame, blobs: [{ x: Infinity, y: .5, radius: 20 }] }), false);
    const draws = () => calls.filter(([name]) => name === "drawArrays").length;
    const frostFrame = { ...frame, blurStrength: 4 };
    let before = draws(); first.draw(frostFrame);
    assert.equal(draws() - before, 3, "broad frost has two separable passes plus the lens");
    const kernel = calls.findLast(([name, uniform]) => name === "uniform2fv" && uniform === "uKernel[0]")[2];
    assert.ok(Math.abs(kernel[1] + 2 * [...kernel].filter((_, i) => i > 1 && i % 2 === 1).reduce((a, b) => a + b, 0) - 1) < 1e-6);
    x.set(.6); before = draws(); first.draw({ ...frostFrame, pixelRatio: 1 });
    assert.equal(draws() - before, 1, "geometry and output DPR changes reuse the CSS-pixel Gaussian");
    before = draws(); first.draw({ ...frostFrame, sourceRevision: 2 });
    assert.equal(draws() - before, 3, "changed source pixels invalidate the retained frost");
    before = draws(); first.draw({ ...frostFrame, sourceRevision: 2, blurStrength: .5 });
    assert.equal(draws() - before, 1, "fine frost / ordinary video stays on the cheap original path");
    before = draws(); first.draw({ ...frostFrame, sourceRevision: 2, tintStrength: 1, blurStrength: 2 });
    assert.equal(draws() - before, 1, "opaque resting thumbs do not build invisible frost");
    source.width = 200; source.height = 120;
    before = draws(); first.draw(frostFrame);
    assert.equal(draws() - before, 4, "a 2x source resolves to the blur grid before paired taps");
    const lost = new Event("webglcontextlost", { cancelable: true });
    first.context.canvas.dispatchEvent(lost);
    assert.equal(lost.defaultPrevented, true);
    first.context.canvas.dispatchEvent(new Event("webglcontextrestored"));
    assert.equal(restores, 2, "all owners receive restoration, including idle surfaces");
    const previousUploads = first.stats.sourceUploads;
    first.draw(frame);
    assert.equal(first.stats.sourceUploads, previousUploads + 1, "restoration uploads pixels even at an unchanged revision");
    second.draw(frame);
    first.dispose(); first.dispose();
    assert.equal(first.draw(frame), false);
    assert.equal(calls.filter(([name]) => name === "deleteProgram").length, 0, "a sibling still owns the shared device");
    assert.equal(second.draw(frame), true);
    second.dispose();
    assert.equal(calls.filter(([name]) => name === "deleteProgram").length, 2);
  } finally {
    first.dispose(); second.dispose();
    for (const [name, value] of Object.entries(globals)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
});
