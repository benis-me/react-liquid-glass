import { registerLiquidCanvas, readLiquidSource, transparentLiquidSource } from "./canvas-sources";
import { readMotion } from "../shared/values";
import { createFrameGeometry } from "./frame-geometry";
import { notifyLiquidFrame } from "./frame-events";
import { MAX_BLOBS, LIQUID_GLASS_MATERIAL as defaults, type LiquidGlassFrame, type LiquidGlassSource, type LiquidFrameRegion } from "./render-frame";
import { getGlassGPUDevice, type GPUWork } from "./webgpu-device";

// WGSL Params has 11 vec4 blocks; each Blob has 7 vec4 blocks.
const MATERIAL_FLOATS = 11 * 4, BLOB_FLOATS = 7 * 4;
const FLOATS = MATERIAL_FLOATS + MAX_BLOBS * BLOB_FLOATS;
const usage = () => GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;

/** One shared device, direct canvas presentation, no intermediate 2D output copy. */
export async function createWebGPUGlassRenderer(canvas: HTMLCanvasElement, onFailure: (error: Error) => void, onContext?: () => void) {
  let runtime = await getGlassGPUDevice();
  let release = runtime.retain(onFailure);
  // A final-owner teardown can retire a resolved device before this await resumes.
  for (let retry = 0; !release && retry < 2; retry++) { runtime = await getGlassGPUDevice(); release = runtime.retain(onFailure); }
  if (!release) throw new Error("WebGPU device retired during initialization");
  const { device } = runtime;
  const dynamicRange = matchMedia("(dynamic-range: high)");
  let context: GPUCanvasContext;
  try {
    const acquired = canvas.getContext("webgpu");
    if (!acquired) throw new Error("WebGPU canvas context unavailable");
    context = acquired;
    onContext?.();
    try { context.configure({ device, format: "rgba8unorm", alphaMode: "premultiplied", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }); }
    catch (error) { context.unconfigure(); throw error; }
  } catch (error) { release(); throw error; }
  let disposed = false, suspended = false, latest: LiquidGlassFrame | undefined, pending: LiquidGlassFrame | undefined;
  const geometry = createFrameGeometry();
  const params = new Float32Array(FLOATS), lastLight = new Float32Array(FLOATS).fill(NaN);
  const uniform = device.createBuffer({ label: "Liquid material values", size: params.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const frostParams = new Float32Array(40);
  const frostUniforms = Array.from({ length: 3 }, () => device.createBuffer({ size: frostParams.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const views = new WeakMap<GPUTexture, GPUTextureView>();
  const view = (texture: GPUTexture) => {
    let cached = views.get(texture);
    if (!cached) { cached = texture.createView(); views.set(texture, cached); }
    return cached;
  };
  const frostBindings: Array<{ input: GPUTexture; group: GPUBindGroup } | undefined> = [];
  let mipViews: GPUTextureView[] = [], mipGroups: GPUBindGroup[] = [];
  const makeTexture = (width: number, height: number, levels = 1) => device.createTexture({ size: [width, height], format: "rgba8unorm", mipLevelCount: levels, usage: usage() });
  let source = makeTexture(1, 1), content = makeTexture(1, 1), frost = makeTexture(1, 1), scratch = makeTexture(1, 1);
  let videoSource: HTMLCanvasElement | undefined;
  let sourceWidth = 0, sourceHeight = 0, contentWidth = 0, contentHeight = 0, contentLevels = 1;
  let frostWidth = 1, frostHeight = 1, lastFrostWidth = 0, lastFrostHeight = 0;
  let lastSource: LiquidGlassSource | undefined, sourceRevision: number | undefined;
  let lastContent: HTMLCanvasElement | null | undefined, contentRevision: number | undefined;
  let lastBlur = NaN, binding: GPUBindGroup | undefined;
  let lightContent: HTMLCanvasElement | null | undefined, lightRevision: number | undefined;
  let hdr: { canvas: HTMLCanvasElement; context: GPUCanvasContext; pipeline: GPURenderPipeline } | undefined;
  let requestingHDR = false;
  let previousRegions: readonly LiquidFrameRegion[] = [{ left: 0, top: 0, width: 1, height: 1 }];
  let previousWidth = 0, previousHeight = 0;
  let retained: GPUTexture | undefined, retainedWidth = 0, retainedHeight = 0, revision = 0, snapshotRevision = -1;
  let relay: HTMLCanvasElement | undefined, relayContext: GPUCanvasContext | undefined, snapshot: HTMLCanvasElement | undefined;
  const unregister = registerLiquidCanvas(canvas, () => {
    if (!retained || disposed) return transparentLiquidSource();
    if (!snapshot) {
      relay = document.createElement("canvas"); relayContext = relay.getContext("webgpu")!;
      relayContext.configure({ device, format: "rgba8unorm", alphaMode: "premultiplied", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
      snapshot = document.createElement("canvas");
    }
    if (snapshotRevision !== revision) {
      if (relay!.width !== retainedWidth || relay!.height !== retainedHeight) {
        relay!.width = snapshot.width = retainedWidth; relay!.height = snapshot.height = retainedHeight;
      }
      const copy = device.createCommandEncoder({ label: "Liquid backdrop snapshot" });
      copy.copyTextureToTexture({ texture: retained }, { texture: relayContext!.getCurrentTexture() }, [retainedWidth, retainedHeight]);
      device.queue.submit([copy.finish()]);
      const output = snapshot.getContext("2d")!; output.clearRect(0, 0, retainedWidth, retainedHeight); output.drawImage(relay!, 0, 0);
      snapshotRevision = revision;
    }
    return snapshot;
  });
  const stats = { draws: 0, emissionDraws: 0, sourceUploads: 0, contentUploads: 0 };
  const number = (frame: LiquidGlassFrame, key: Exclude<keyof typeof defaults, "tintColor" | "refractionRatio">) => {
    const value = readMotion(frame[key] ?? defaults[key]);
    return Number.isFinite(value) ? value : defaults[key];
  };
  const dimensions = (value: LiquidGlassSource) => value instanceof HTMLVideoElement ? [value.videoWidth, value.videoHeight]
    : value instanceof HTMLImageElement ? [value.naturalWidth, value.naturalHeight] : [value.width, value.height];
  const pass = (commands: GPUCommandEncoder, view: GPUTextureView, pipeline: GPURenderPipeline, group: GPUBindGroup, width: number, height: number, scissor?: readonly number[]) => {
    const render = commands.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    render.setPipeline(pipeline); render.setBindGroup(0, group); render.setViewport(0, 0, width, height, 0, 1);
    if (scissor) render.setScissorRect(scissor[0], scissor[1], scissor[2], scissor[3]);
    render.draw(3); render.end();
  };
  const uploadImage = (commands: GPUCommandEncoder, image: LiquidGlassSource, texture: GPUTexture, width: number, height: number, premultipliedAlpha: boolean) => {
    try { device.queue.copyExternalImageToTexture({ source: image }, { texture, premultipliedAlpha }, [width, height]); }
    catch (error) {
      // Fresh canvas sources are transparent until their painter acquires a
      // context. WebGL accepts this state; WebGPU's external-image API rejects it.
      // Clear without claiming the source's context or abandoning the backend.
      if (!(image instanceof HTMLCanvasElement) || !String(error).includes("without rendering context")) throw error;
      const clear = commands.beginRenderPass({ colorAttachments: [{ view: texture.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      clear.end();
    }
  };
  const updateBinding = () => binding ??= device.createBindGroup({ layout: runtime.layout, entries: [
    { binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: view(source) },
    { binding: 2, resource: view(frost) }, { binding: 3, resource: view(content) }, { binding: 4, resource: runtime.sampler },
  ] });
  const work: GPUWork = {
    fail: onFailure,
    encode(commands) {
      const p = pending; pending = undefined;
      if (disposed || !p || document.hidden) return;
      const pixelSource = readLiquidSource(p.source);
      const [sw, sh] = dimensions(pixelSource);
      if (!sw || !sh) return;
      const requestedRatio = p.pixelRatio ?? window.devicePixelRatio ?? 1;
      const ratio = Number.isFinite(requestedRatio) ? Math.max(0.5, Math.min(2.5, requestedRatio)) : 1;
      const prepared = geometry.prepare(p, ratio);
      if (!prepared) return;
      const width = Math.max(1, Math.round(p.width * ratio)), height = Math.max(1, Math.round(p.height * ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      if (lastSource !== p.source || sourceRevision !== (p.sourceRevision ?? 0) || sourceWidth !== sw || sourceHeight !== sh) {
        if (sourceWidth !== sw || sourceHeight !== sh) { source.destroy(); source = makeTexture(sw, sh); binding = undefined; }
        let upload = pixelSource;
        if (pixelSource instanceof HTMLVideoElement) {
          // Video import color conversion differs between WebGL and WebGPU on
          // some browsers. Normalize through the browser's canvas path, matching
          // the accepted video colors without inventing a gamma correction.
          // One retained canvas, updated only on decoded/seeked source revisions;
          // no getImageData/readback or per-frame ImageBitmap allocation.
          videoSource ??= document.createElement("canvas");
          if (videoSource.width !== sw) videoSource.width = sw;
          if (videoSource.height !== sh) videoSource.height = sh;
          const videoContext = videoSource.getContext("2d")!;
          videoContext.globalCompositeOperation = "copy";
          videoContext.drawImage(pixelSource, 0, 0);
          upload = videoSource;
        }
        uploadImage(commands, upload, source, sw, sh, false);
        lastSource = p.source; sourceWidth = sw; sourceHeight = sh; sourceRevision = p.sourceRevision ?? 0;
        lastBlur = NaN; stats.sourceUploads++;
      }
      const blur = Math.max(0, number(p, "blurStrength"));
      const frostScale = Math.min(1, 4 / Math.max(blur, 0.5));
      const fw = Math.max(1, Math.round(p.width * frostScale)), fh = Math.max(1, Math.round(p.height * frostScale));
      if (!p.debug && number(p, "tintStrength") < 1 && blur > 0.5 && (blur !== lastBlur || fw !== lastFrostWidth || fh !== lastFrostHeight)) {
        if (frostWidth < fw || frostHeight < fh) {
          frostWidth = Math.max(frostWidth, Math.ceil(p.width)); frostHeight = Math.max(frostHeight, Math.ceil(p.height));
          frost.destroy(); scratch.destroy(); frost = makeTexture(frostWidth, frostHeight); scratch = makeTexture(frostWidth, frostHeight); binding = undefined;
        }
        const sigma = Math.min(4, blur * frostScale), pairs = Math.ceil(Math.ceil(sigma * 3) / 2);
        frostParams.fill(0); frostParams[9] = 1;
        let total = 1;
        for (let i = 1; i <= pairs; i++) {
          const a = i * 2 - 1, b = a + 1, wa = Math.exp(-a * a / (2 * sigma * sigma)), wb = Math.exp(-b * b / (2 * sigma * sigma));
          frostParams[8 + i * 4] = (a * wa + b * wb) / (wa + wb); frostParams[9 + i * 4] = wa + wb; total += 2 * (wa + wb);
        }
        for (let i = 0; i <= pairs; i++) frostParams[9 + i * 4] /= total;
        frostParams[4] = pairs + 1;
        const frostPass = (input: GPUTexture, output: GPUTexture, index: number, sx: number, sy: number, dx: number, dy: number, copy: boolean) => {
          frostParams.set([sx, sy, dx, dy], 0); frostParams[5] = Number(copy);
          device.queue.writeBuffer(frostUniforms[index], 0, frostParams);
          if (frostBindings[index]?.input !== input) frostBindings[index] = { input, group: device.createBindGroup({ layout: runtime.frostLayout, entries: [{ binding: 0, resource: { buffer: frostUniforms[index] } }, { binding: 1, resource: view(input) }, { binding: 2, resource: runtime.sampler }] }) };
          pass(commands, view(output), runtime.frost, frostBindings[index]!.group, fw, fh);
        };
        if (sw !== fw || sh !== fh) frostPass(source, frost, 0, 1, 1, 0, 0, true);
        frostPass(sw !== fw || sh !== fh ? frost : source, scratch, 1, sw !== fw || sh !== fh ? fw / frostWidth : 1, sw !== fw || sh !== fh ? fh / frostHeight : 1, 1 / fw, 0, false);
        frostPass(scratch, frost, 2, fw / frostWidth, fh / frostHeight, 0, 1 / fh, false);
        lastBlur = blur; lastFrostWidth = fw; lastFrostHeight = fh;
      }
      if (p.content && readMotion(p.contentOpacity ?? 0) > .001 && (p.content !== lastContent || (p.contentRevision ?? 0) !== contentRevision || p.content.width !== contentWidth || p.content.height !== contentHeight)) {
        const cw = p.content.width, ch = p.content.height;
        if (cw && ch) {
          if (cw !== contentWidth || ch !== contentHeight) {
            contentWidth = cw; contentHeight = ch; contentLevels = Math.floor(Math.log2(Math.max(cw, ch))) + 1;
            content.destroy(); content = makeTexture(cw, ch, contentLevels); binding = undefined;
            mipViews = Array.from({ length: contentLevels }, (_, level) => content.createView({ baseMipLevel: level, mipLevelCount: 1 }));
            mipGroups = mipViews.slice(0, -1).map(view => device.createBindGroup({ layout: runtime.mipmapLayout, entries: [{ binding: 0, resource: view }, { binding: 1, resource: runtime.sampler }] }));
          }
          uploadImage(commands, p.content, content, cw, ch, true);
          for (let level = 1; level < contentLevels; level++) {
            pass(commands, mipViews[level], runtime.mipmap, mipGroups[level - 1], Math.max(1, cw >> level), Math.max(1, ch >> level));
          }
          lastContent = p.content; contentRevision = p.contentRevision ?? 0; stats.contentUploads++;
        }
      }
      params.set([p.width, p.height, width, height], 0);
      params.set([fw / frostWidth, fh / frostHeight, 0.5 / frostWidth, 0.5 / frostHeight], 4);
      params.set([number(p, "mergeDistance"), number(p, "refractionStrength"), number(p, "chromaAmount"), number(p, "specularStrength")], 8);
      params.set([blur, number(p, "edgeDepth"), number(p, "domeDepth"), number(p, "brightness")], 12);
      params.set([number(p, "specularRotation"), number(p, "glowStrength"), number(p, "glowSpread"), number(p, "glowExponent")], 16);
      params.set([number(p, "edgeStrength"), number(p, "edgeWidth"), number(p, "edgeExponent"), number(p, "tintStrength")], 20);
      params.set([...(p.tintColor ?? defaults.tintColor), number(p, "magnification")], 24);
      params.set([number(p, "shadowStrength"), number(p, "shadowOffset"), number(p, "shadowBlur"), number(p, "opacity")], 28);
      params.set([p.content ? readMotion(p.contentOpacity ?? 0) : 0, readMotion(p.contentRefraction ?? 0), readMotion(p.contentBlur ?? 0), 0], 32);
      params.set([prepared.count, Number(!!p.transparentOutside), Number(!!p.debug), 0], 36);
      params.set([...(p.refractionRatio ?? defaults.refractionRatio), 0, 0], 40);
      const g = geometry;
      for (let i = 0; i < prepared.count; i++) {
        const o = MATERIAL_FLOATS + i * BLOB_FLOATS;
        params.set([g.blobs[i * 3], g.blobs[i * 3 + 1], g.blobs[i * 3 + 2], g.corners[i]], o);
        params.set([g.sizes[i * 2], g.sizes[i * 2 + 1], g.velocities[i * 2], g.velocities[i * 2 + 1]], o + 4);
        params.set([g.contacts[i * 3], g.contacts[i * 3 + 1], g.contacts[i * 3 + 2], 0], o + 8);
        params.set(g.contactInverses.subarray(i * 4, i * 4 + 4), o + 12);
        params.set([g.contactOffsets[i * 2], g.contactOffsets[i * 2 + 1], 0, 0], o + 16);
        params.set(g.domes.subarray(i * 4, i * 4 + 4), o + 20);
        params.set([g.refractionRatios[i * 2], g.refractionRatios[i * 2 + 1], 0, 0], o + 24);
      }
      device.queue.writeBuffer(uniform, 0, params);
      const group = updateBinding();
      let scissor: number[] | undefined;
      if (prepared.clipped) {
        const x = Math.max(0, Math.min(width, Math.floor(prepared.left * width / p.width))), y = Math.max(0, Math.min(height, Math.floor(prepared.top * height / p.height)));
        const right = Math.max(x, Math.min(width, Math.ceil(prepared.right * width / p.width))), bottom = Math.max(y, Math.min(height, Math.ceil(prepared.bottom * height / p.height)));
        scissor = [x, y, right - x, bottom - y];
      }
      const lit = (params[11] * params[20] > 0.001 || p.blobs.some(blob => readMotion(blob.contactStrength ?? 0) > 0.001)) && params[23] < 0.999 && params[31] > 0.001;
      const highRange = p.hdr !== false && !p.debug && lit && dynamicRange.matches;
      if (highRange && !hdr && !requestingHDR && canvas.isConnected) {
        requestingHDR = true;
        void runtime.highlight().then(pipeline => {
          if (disposed || suspended) { requestingHDR = false; return; }
          const overlay = document.createElement("canvas"), ctx = overlay.getContext("webgpu");
          if (!ctx) return;
          try {
            ctx.configure({ device, format: "rgba16float", alphaMode: "premultiplied", toneMapping: { mode: "extended" } });
            if (ctx.getConfiguration?.()?.toneMapping?.mode !== "extended") { ctx.unconfigure(); return; }
            overlay.dataset.dgHighlightHdr = ""; overlay.setAttribute("aria-hidden", "true");
            Object.assign(overlay.style, { position: "absolute", pointerEvents: "none", opacity: "0" }); canvas.after(overlay);
            hdr = { canvas: overlay, context: ctx, pipeline }; if (latest) { pending = latest; runtime.enqueue(work); }
          } catch { ctx.unconfigure(); }
        }).catch(() => { /* SDR material remains available. */ });
      }
      if (hdr) {
        hdr.canvas.style.opacity = highRange ? "1" : "0";
        if (highRange) {
          if (hdr.canvas.width !== width) hdr.canvas.width = width;
          if (hdr.canvas.height !== height) hdr.canvas.height = height;
          Object.assign(hdr.canvas.style, { left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`, width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px` });
          const changed = lightContent !== p.content || lightRevision !== p.contentRevision || params.some((value, i) => value !== lastLight[i]);
          if (changed) {
            pass(commands, hdr.context.getCurrentTexture().createView(), hdr.pipeline, group, width, height, scissor);
            lastLight.set(params); lightContent = p.content; lightRevision = p.contentRevision; stats.emissionDraws++;
          }
        }
      }
      const output = context.getCurrentTexture();
      pass(commands, output.createView(), runtime.glass, group, width, height, scissor);
      const retentionTarget = retained && retainedWidth === width && retainedHeight === height ? retained
        : device.createTexture({ size: [width, height], format: "rgba8unorm", usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST });
      commands.copyTextureToTexture({ texture: output }, { texture: retentionTarget }, [width, height]);
      stats.draws++;
      const regions = prepared.clipped ? prepared.regions : [{ left: 0, top: 0, width: 1, height: 1 }];
      if (previousWidth !== width || previousHeight !== height) previousRegions = [{ left: 0, top: 0, width: 1, height: 1 }];
      const changed = [...previousRegions, ...regions]; previousRegions = regions; previousWidth = width; previousHeight = height;
      return () => {
        if (disposed) { retentionTarget.destroy(); return; }
        if (retained !== retentionTarget) retained?.destroy();
        retained = retentionTarget; retainedWidth = width; retainedHeight = height; revision++;
        notifyLiquidFrame(canvas, changed);
      };
    },
  };
  return {
    backend: "webgpu" as const, context, stats,
    draw(frame: LiquidGlassFrame) {
      if (disposed || !Number.isFinite(frame.width) || !Number.isFinite(frame.height) || frame.width <= 0 || frame.height <= 0) return false;
      suspended = false; latest = pending = frame; runtime.enqueue(work); return true;
    },
    suspend() { suspended = true; latest = pending = undefined; runtime.cancel(work); if (hdr) hdr.canvas.style.opacity = "0"; },
    dispose() {
      if (disposed) return;
      disposed = true; pending = undefined; runtime.cancel(work);
      unregister(); retained?.destroy(); relayContext?.unconfigure();
      hdr?.context.unconfigure(); hdr?.canvas.remove(); context.unconfigure();
      uniform.destroy(); frostUniforms.forEach(buffer => buffer.destroy());
      source.destroy(); content.destroy(); frost.destroy(); scratch.destroy(); release();
    },
  };
}
