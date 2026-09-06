import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import * as physics from 'refractive-glass-react/apple-motion';
import { springTo, popoverFrames } from 'refractive-glass-react/apple-motion/react';
import { motionValue } from 'motion';
import { LiquidMenu, GlassSwitch, GlassSlider, GlassSegmented } from 'refractive-glass-react/controls';
import { createLiquidGlassRenderer, LIQUID_GLASS_MATERIAL } from 'refractive-glass-react/liquid-glass/renderer';

const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const configurations = [
  { mass: 1, stiffness: 180, damping: 14 },
  physics.PLAY_BUTTON_SPRING, physics.SIDE_BUTTON_SPRING, physics.BAR_DRAG_SPRING,
  { mass: 1, stiffness: 100, damping: 20 }, // critical
  { mass: 1, stiffness: 100, damping: 80 }, // overdamped
  { mass: 1, stiffness: 100, damping: 0 },  // undamped
];

test('physical state is invariant to 30/60/120 Hz and dropped frames, including retargeting and impulses', () => {
  for (const config of configurations) {
    const evolve = (hz) => {
      let state = [0.4, 3];
      for (const [target, duration, impulse] of [[1, .18, 0], [.15, .07, -7], [.8, .13, 0], [0, .28, 0]]) {
        state[1] += impulse;
        const steps = hz ? Math.ceil(duration * hz) : 1;
        for (let i = 0; i < steps; i++) state = physics.stepSpring(...state, target, config, duration / steps, false);
      }
      return state;
    };
    const exact = evolve(0);
    for (const hz of [30, 60, 120]) evolve(hz).forEach((value, i) => near(value, exact[i]));
    let state = [1, -2];
    let energy = config.stiffness * state[0] ** 2 / 2 + config.mass * state[1] ** 2 / 2;
    for (const dt of [.007, .016, .033, .16, .3]) {
      state = physics.stepSpring(...state, 0, config, dt, false);
      const nextEnergy = config.stiffness * state[0] ** 2 / 2 + config.mass * state[1] ** 2 / 2;
      assert.ok(nextEnergy <= energy + 1e-9, 'damping cannot create energy after a dropped frame');
      energy = nextEnergy;
    }
  }
});

test('spring limits, held targets and zero-time retargets stay finite and continuous', () => {
  const config = configurations[0];
  assert.deepEqual(physics.stepSpring(.3, -4, .9, config, 0), [.3, -4]);
  assert.deepEqual(physics.stepSpring(.3, -4, .175, config, 10), [.175, 0]);
  for (const invalid of [{ ...config, mass: 0 }, { ...config, damping: -1 }, { ...config, stiffness: NaN }]) {
    assert.throws(() => physics.stepSpring(0, 0, 1, invalid, .01), RangeError);
  }
  assert.throws(() => physics.stepSpring(Infinity, 0, 1, config, .01), RangeError);
  assert.throws(() => physics.stepSpring(0, 0, 1, config, -.01), RangeError);
});

test('interrupted trajectories brake in a bounded time while preserving the incoming velocity', () => {
  for (const duration of [.02, .209, .38]) {
    for (const velocity of [-1200, 1200]) {
      const { values, times } = physics.retargetLiquidFrames(80, 160, duration, velocity);
      const easing = physics.liquidEasings(values, times, duration, velocity);
      assert.ok(times[1] > 0 && times[1] <= 1);
      if (times.length === 3) assert.ok(times[1] * duration <= .04);
      near((values[1] - values[0]) * easing[0](1e-7) / (times[1] * duration * 1e-7), velocity, .01);
      assert.equal(values.at(-1), 160);
    }
  }
  assert.throws(() => physics.liquidEasings([0, 1, 2], [0, 0, 1], .38), RangeError);
  assert.throws(() => physics.liquidEasings([0, NaN], [0, 1], .38), RangeError);
  assert.throws(() => physics.retargetLiquidFrames(0, 1, 0, 2), RangeError);
});

test('cancelled Motion springs settle their completion promise without losing the current position', async () => {
  // Motion's browser capability check needs only the HTMLElement identity here.
  const previousElement = globalThis.HTMLElement;
  const previousSvg = globalThis.SVGElement;
  globalThis.HTMLElement = class {};
  globalThis.SVGElement = class {};
  const value = motionValue(.25);
  const run = springTo(value, 1, configurations[0]);
  run.stop(); run.stop();
  let timeout;
  try {
    assert.equal(await Promise.race([
      run.finished.then(() => 'stopped'),
      new Promise(resolve => { timeout = setTimeout(() => resolve('hung'), 50); }),
    ]), 'stopped');
    assert.equal(value.get(), .25);
  } finally {
    clearTimeout(timeout); value.destroy();
    if (previousElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = previousElement;
    if (previousSvg === undefined) delete globalThis.SVGElement;
    else globalThis.SVGElement = previousSvg;
  }
});

test('independent package entries expose real reusable implementations in ESM and CommonJS', () => {
  for (const api of [LiquidMenu, GlassSwitch, GlassSlider, GlassSegmented, createLiquidGlassRenderer]) assert.equal(typeof api, 'function');
  const require = createRequire(import.meta.url);
  assert.equal(typeof require('refractive-glass-react/apple-motion').stepSpring, 'function');
  assert.equal(require('refractive-glass-react/liquid-glass/renderer').LIQUID_GLASS_MATERIAL.chromaAmount, LIQUID_GLASS_MATERIAL.chromaAmount);
  assert.equal(typeof require('refractive-glass-react/controls').LiquidMenu, 'function');
});

test('neither core imports the other implementation, control views, or demo code', () => {
  for (const core of ['apple-motion', 'liquid-glass']) {
    const folder = new URL(`../src/${core}/`, import.meta.url);
    for (const path of readdirSync(folder).filter(file => /\.tsx?$/.test(file))) {
      const source = readFileSync(new URL(path, folder), 'utf8');
      assert.doesNotMatch(source, /from ["'][^"']*(?:demos|controls|i18n)(?:\/|["'])/, `${core}/${path}`);
      const sibling = core === 'apple-motion' ? 'liquid-glass' : 'apple-motion';
      assert.doesNotMatch(source, new RegExp(`from ["'][^"']*\\.\\./${sibling}`), `${core}/${path}`);
    }
  }
});

test('the approved optical renderer and resource pipeline remain unchanged by the refactor', () => {
  const source = readFileSync(new URL('../src/liquid-glass/renderer.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('const MAX_BLOBS'));
  assert.equal(createHash('sha256').update(body).digest('hex'), '194db479fcbf221b4e8548af891807bf60253ea346a97916b7e853509619adbb');
});

test('popup trajectories keep a compact capsule, a live fusion neck, and one trigger recovery at every size', () => {
  for (const [tw, th, pw, ph] of [[44, 34, 180, 38], [90, 42, 220, 160], [300, 44, 300, 156], [150, 42, 316, 620]]) {
    const layout = { triggerX: 200, triggerY: 700, triggerWidth: tw, triggerHeight: th, triggerRadius: 16, panelX: 180, panelY: 700 - th / 2 - 10 - ph / 2, panelWidth: pw, panelHeight: ph, panelRadius: 22 };
    const opened = popoverFrames(layout, true), closed = popoverFrames(layout, false);
    assert.equal(opened.w.at(-1), pw / 2); assert.equal(opened.h.at(-1), ph / 2);
    assert.equal(closed.x.at(-1), layout.triggerX); assert.equal(closed.y.at(-1), layout.triggerY);
    assert.equal(closed.w.at(-1), 1); assert.equal(closed.h.at(-1), 1);
    assert.ok(closed.merge[2] > 0 && closed.merge[3] > 0, 'absorption needs a neck through both middle stages');
    assert.equal(closed.merge.at(-1), 0); assert.equal(closed.trigger.at(-1), 1);
    assert.ok(Math.max(...closed.trigger) <= 1.04, 'trigger impact stays restrained');
    for (const values of [closed.w, closed.h]) {
      assert.ok(values.every((value, index) => !index || value <= values[index - 1]), 'popup body must not swell again during absorption');
    }
    const distances = closed.x.map((x, index) => Math.hypot(x - layout.triggerX, closed.y[index] - layout.triggerY));
    assert.ok(distances.every((value, index) => !index || value <= distances[index - 1]), 'closing must gather toward the trigger without a positional reversal');
    for (const frames of [opened, closed]) for (const key of ['x', 'y', 'w', 'h', 'radius', 'merge', 'trigger', 'reveal']) {
      const values = frames[key], ease = physics.liquidEasings(values, frames.times, .38);
      for (let i = 0; i < ease.length; i++) for (let t = 0; t <= 1; t += .05) {
        const value = values[i] + (values[i + 1] - values[i]) * ease[i](t);
        assert.ok(Number.isFinite(value), 'all contour samples must remain finite');
        if (['w', 'h', 'radius'].includes(key)) assert.ok(value >= 1 && value <= Math.max(...values) + .001, 'no balloon or negative contour between keyframes');
      }
    }
  }
});
