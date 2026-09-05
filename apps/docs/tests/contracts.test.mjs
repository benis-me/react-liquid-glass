import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';
import * as library from 'refractive-glass-react/controls';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const load = path => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(read(path))).toString('base64')}`);
const { catalog, exampleCode } = await load('../src/site/catalog.ts');
const { sanitizeMaterial, materialFields } = await load('../src/site/material.ts');

test('every catalog entry has a real exported component and a type-correct standalone example', () => {
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  const folder = mkdtempSync(join(tmpdir(), 'liquid-examples-'));
  try {
    symlinkSync(fileURLToPath(new URL('../../../node_modules', import.meta.url)), join(folder, 'node_modules'), 'dir');
    writeFileSync(join(folder, 'package.json'), '{"type":"module"}');
    for (const entry of catalog) {
      assert.match(entry.id, /^[a-z]+(?:-[a-z]+)*$/);
      assert.equal(typeof library[entry.api], 'function', `${entry.id} must expose its documented API`);
      assert.ok(entry.description && entry.summary && entry.props.length);
      writeFileSync(join(folder, `${entry.id}.tsx`), exampleCode(entry.id));
    }
    writeFileSync(join(folder, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true, types: ['react','react-dom'] }, include: ['*.tsx'] }));
    execFileSync(fileURLToPath(new URL('../../../node_modules/.bin/tsc', import.meta.url)), ['-p', join(folder, 'tsconfig.json')], { stdio: 'pipe' });
  } catch (error) { if (error.stdout) throw new Error(error.stdout.toString()); throw error; }
  finally { rmSync(folder, { recursive: true, force: true }); }
});

test('shared material links accept only finite renderer settings and clamp extreme values', () => {
  assert.deepEqual(sanitizeMaterial(null), {}); assert.deepEqual(sanitizeMaterial([]), {});
  assert.deepEqual(sanitizeMaterial({ blurStrength: '4', chromaAmount: NaN, debug: 'true', unknown: 1 }), {});
  assert.deepEqual(sanitizeMaterial({ blurStrength: 99, refractionStrength: -20, debug: true }), { refractionStrength: 0, blurStrength: 4, debug: true });
  for (const field of materialFields) {
    assert.deepEqual(sanitizeMaterial({ [field.key]: field.initial }), { [field.key]: field.initial });
    assert.deepEqual(sanitizeMaterial({ [field.key]: Infinity }), {});
  }
});

test('the docs app consumes only package entry points and the library cannot import the app', () => {
  function sources(folder) { return readdirSync(folder, { withFileTypes: true }).flatMap(item => item.isDirectory() ? sources(new URL(`${item.name}/`, folder)) : /\.(tsx?|css)$/.test(item.name) ? [[item.name, readFileSync(new URL(item.name, folder),'utf8')]] : []); }
  for (const [file, source] of sources(new URL('../src/', import.meta.url))) {
    assert.doesNotMatch(source, /(?:from|import)\s*["'][^"']*(?:packages\/|src\/lib\/|\/src\/controls|\/src\/liquid-glass)/, file);
  }
  for (const [file, source] of sources(new URL('../../../packages/react-liquid-glass/src/', import.meta.url))) {
    assert.doesNotMatch(source, /(?:from|import)\s*["'][^"']*(?:apps\/|\/demos\/|\/site\/|i18n)/, file);
  }
  const config = JSON.parse(read('../../../vercel.json'));
  assert.equal(config.buildCommand, 'npm run build:demo');
  assert.equal(config.outputDirectory, 'dist/client');
  assert.ok(config.rewrites.some(rule => rule.destination === '/index.html'));
});
