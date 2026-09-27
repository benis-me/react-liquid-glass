import glassCode from "./shaders/glass.wgsl?raw";
import frostCode from "./shaders/frost.wgsl?raw";
import mipmapCode from "./shaders/mipmap.wgsl?raw";

export interface GPUWork {
  encode(commands: GPUCommandEncoder): (() => void) | undefined;
  fail(error: Error): void;
}
export interface GlassGPUDevice {
  device: GPUDevice;
  layout: GPUBindGroupLayout;
  frostLayout: GPUBindGroupLayout;
  mipmapLayout: GPUBindGroupLayout;
  glass: GPURenderPipeline;
  frost: GPURenderPipeline;
  mipmap: GPURenderPipeline;
  sampler: GPUSampler;
  highlight(): Promise<GPURenderPipeline>;
  enqueue(owner: GPUWork): void;
  cancel(owner: GPUWork): void;
  retain(lost: (error: Error) => void): (() => void) | undefined;
}
let shared: Promise<GlassGPUDevice> | undefined;
let generation = 0;

export function getGlassGPUDevice(): Promise<GlassGPUDevice> {
  if (!shared) {
    const current = ++generation;
    const invalidate = () => { if (generation === current) shared = undefined; };
    shared = createDevice(invalidate).catch(error => { invalidate(); throw error; });
  }
  return shared;
}

async function createDevice(invalidate: () => void): Promise<GlassGPUDevice> {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw new Error("WebGPU adapter unavailable");
  const device = await adapter.requestDevice({ label: "Liquid Glass shared device" });
  const losses = new Set<(error: Error) => void>();
  const pending = new Set<GPUWork>();
  let queued = false, stopped = false, users = 0;
  const fail = (error: Error) => {
    if (stopped) return;
    stopped = true; pending.clear(); invalidate();
    for (const lost of [...losses]) lost(error);
    device.destroy();
  };
  void device.lost.then(info => fail(new Error(`WebGPU device lost: ${info.message || info.reason}`)));
  device.addEventListener("uncapturederror", event => {
    event.preventDefault(); fail(new Error(event.error.message));
  });
  const texture = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } });
  const uniform = { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" as const } };
  const layout = device.createBindGroupLayout({ label: "Liquid Glass bindings", entries: [uniform, texture(1), texture(2), texture(3), { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } }] });
  const frostLayout = device.createBindGroupLayout({ entries: [uniform, texture(1), { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } }] });
  const mipmapLayout = device.createBindGroupLayout({ entries: [texture(0), { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } }] });
  async function module(code: string, label: string) {
    const shader = device.createShaderModule({ code, label });
    const info = await shader.getCompilationInfo();
    const errors = info.messages.filter(message => message.type === "error");
    if (errors.length) throw new Error(errors.map(message => `${label}:${message.lineNum}: ${message.message}`).join("\n"));
    return shader;
  }
  const pipeline = (module: GPUShaderModule, bind: GPUBindGroupLayout, format: GPUTextureFormat, fragment = "fragment") => device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bind] }),
    vertex: { module, entryPoint: "vertex" },
    fragment: { module, entryPoint: fragment, targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  try {
    const [glassModule, frostModule, mipmapModule] = await Promise.all([module(glassCode, "Liquid material"), module(frostCode, "Liquid frost"), module(mipmapCode, "Liquid content mips")]);
    const [glass, frost, mipmap] = await Promise.all([pipeline(glassModule, layout, "rgba8unorm"), pipeline(frostModule, frostLayout, "rgba8unorm"), pipeline(mipmapModule, mipmapLayout, "rgba8unorm")]);
    let highlight: Promise<GPURenderPipeline> | undefined;
    const flush = () => {
      queued = false;
      if (stopped || !pending.size) return;
      const work = [...pending]; pending.clear();
      const commands = device.createCommandEncoder({ label: "Liquid Glass frame" });
      const presented: Array<() => void> = [];
      const failures: Array<[GPUWork, Error]> = [];
      for (const owner of work) {
        try { const notify = owner.encode(commands); if (notify) presented.push(notify); }
        catch (error) { failures.push([owner, error instanceof Error ? error : new Error(String(error))]); }
      }
      device.queue.submit([commands.finish()]);
      for (const notify of presented) notify();
      // An owner may already have encoded valid work. Release its resources only
      // after submission, so one bad source cannot invalidate sibling commands.
      for (const [owner, error] of failures) owner.fail(error);
    };
    return {
      device, layout, frostLayout, mipmapLayout, glass, frost, mipmap,
      sampler: device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" }),
      highlight: () => highlight ??= pipeline(glassModule, layout, "rgba16float", "highlight"),
      enqueue(owner) { if (!stopped) { pending.add(owner); if (!queued) { queued = true; queueMicrotask(flush); } } },
      cancel(owner) { pending.delete(owner); },
      retain(lost) {
        if (stopped) return undefined;
        users++; losses.add(lost);
        let released = false;
        return () => {
          if (released) return;
          released = true; users--; losses.delete(lost);
          queueMicrotask(() => { if (!users && !stopped) { stopped = true; pending.clear(); invalidate(); device.destroy(); } });
        };
      },
    };
  } catch (error) { stopped = true; device.destroy(); throw error; }
}
