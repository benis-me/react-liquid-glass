// Renders the README cover and the docs og:image from readme-cover.html with the real renderer.
// Start the docs dev server (`npm run dev`), then: node apps/docs/tests/readme-cover.mjs [page URL]
// Set CHROME when Chrome is not at the macOS default path.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const url = process.argv[2] ?? "http://localhost:32472/tests/readme-cover.html";
const repo = resolve(import.meta.dirname, "../../..");
const profile = mkdtempSync(join(tmpdir(), "readme-cover-"));
const port = 9400 + Math.floor(Math.random() * 500);
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--enable-unsafe-webgpu", "about:blank",
], { stdio: "ignore" });
const sleep = ms => new Promise(done => setTimeout(done, ms));
try {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    await sleep(200);
    page = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json()).then(list => list.find(item => item.type === "page")).catch(() => undefined);
  }
  if (!page) throw new Error("Chrome did not start");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(done => socket.addEventListener("open", done, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); pending.get(message.id)?.(message.result); pending.delete(message.id); });
  const send = (method, params = {}) => new Promise(done => { pending.set(++id, done); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 2, mobile: false });
  await send("Page.navigate", { url });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    await sleep(150);
    ready = await evaluate(`(() => { const canvases = [...document.querySelectorAll("canvas[data-dg-renderer]")]; return canvases.length > 0 && canvases.every(canvas => canvas.dataset.dgRenderer.startsWith("liquid-")); })()`);
  }
  if (!ready) throw new Error("The glass renderers did not start; the cover needs WebGPU or WebGL2");
  await sleep(1500);
  // Open the Morph Menu through its real trigger and let the morph settle.
  await evaluate(`document.querySelector(".cover-menu .dg-liquid-menu__trigger").click()`);
  await sleep(1500);
  // A scripted click is not a pointer press, so the focus the menu moves inside would show as keyboard focus.
  await evaluate(`document.activeElement?.blur()`);
  await sleep(300);
  const cover = await send("Page.captureScreenshot", { format: "png" });
  const og = await send("Page.captureScreenshot", { format: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 1200, height: 630, scale: 0.5 } });
  writeFileSync(join(repo, ".github/assets/readme-hero.png"), Buffer.from(cover.data, "base64"));
  writeFileSync(join(repo, "apps/docs/public/og.jpg"), Buffer.from(og.data, "base64"));
  console.log("Wrote .github/assets/readme-hero.png and apps/docs/public/og.jpg");
  socket.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
