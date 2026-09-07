@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> Vertex {
  let xy = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
  return Vertex(vec4f(xy * 2.0 - 1.0, 0.0, 1.0), vec2f(xy.x, 1.0 - xy.y));
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4f { return textureSampleLevel(source, linearSampler, v.uv, 0.0); }
