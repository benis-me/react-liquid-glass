// This optional presenter only lifts the existing SDF's contact-light mask above
// SDR white. Geometry, frost, refraction and ordinary highlights stay in WebGL.
let shared: Promise<{ device: GPUDevice; pipeline: GPURenderPipeline; presenters: Set<() => void> } | null> | undefined;

async function resources() {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var mask: texture_2d<f32>;
    @vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
      let x = f32((index << 1u) & 2u); let y = f32(index & 2u);
      return vec4f(x * 2. - 1., y * 2. - 1., 0., 1.);
    }
    @fragment fn fragment(@builtin(position) point: vec4f) -> @location(0) vec4f {
      let light = textureLoad(mask, vec2i(point.xy), 0).r;
      return vec4f(vec3f(light * 2.4), light * .35);
    }
  ` });
  const pipeline = device.createRenderPipeline({ layout: "auto", vertex: { module, entryPoint: "vertex" }, fragment: { module, entryPoint: "fragment", targets: [{ format: "rgba16float" }] } });
  const presenters = new Set<() => void>();
  void device.lost.then(() => { shared = undefined; for (const dispose of presenters) dispose(); });
  return { device, pipeline, presenters };
}

/** HDR is capability-tested; failure leaves the ordinary material fully functional. */
export async function createContactHDR(canvas: HTMLCanvasElement) {
  try {
    const state = await (shared ??= resources().catch(() => null));
    if (!state || !canvas.isConnected) return null;
    const { device, pipeline, presenters } = state;
    const overlay = document.createElement("canvas");
    const context = overlay.getContext("webgpu") as unknown as GPUCanvasContext | null;
    if (!context) return null;
    context.configure({ device, format: "rgba16float", alphaMode: "premultiplied", toneMapping: { mode: "extended" } });
    if (context.getConfiguration?.()?.toneMapping?.mode !== "extended") { context.unconfigure(); return null; }
    overlay.setAttribute("aria-hidden", "true"); overlay.dataset.dgContactHdr = "";
    Object.assign(overlay.style, { position: "absolute", pointerEvents: "none", opacity: "0" });
    canvas.after(overlay);
    let texture: GPUTexture | undefined, group: GPUBindGroup | undefined, width = 0, height = 0, disposed = false;
    const dispose = () => { if (disposed) return; disposed = true; presenters.delete(dispose); texture?.destroy(); context.unconfigure(); overlay.remove(); };
    presenters.add(dispose);
    return {
      draw(source: HTMLCanvasElement) {
        if (disposed) return;
        if (width !== source.width || height !== source.height) {
          width = overlay.width = source.width; height = overlay.height = source.height;
          texture?.destroy();
          texture = device.createTexture({ size: [width, height], format: "rgba8unorm", usage: 2 | 4 | 16 });
          group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: texture.createView() }] });
        }
        Object.assign(overlay.style, { left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`, width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px`, opacity: "1" });
        device.queue.copyExternalImageToTexture({ source }, { texture: texture! }, [width, height]);
        const commands = device.createCommandEncoder();
        const pass = commands.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
        pass.setPipeline(pipeline); pass.setBindGroup(0, group!); pass.draw(3); pass.end(); device.queue.submit([commands.finish()]);
      },
      hide() { overlay.style.opacity = "0"; },
      dispose,
    };
  } catch { return null; }
}
