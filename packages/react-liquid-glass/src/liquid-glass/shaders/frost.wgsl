struct Params { scaleAxis: vec4f, settings: vec4f, kernel: array<vec4f, 8> }
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> Vertex {
  let xy = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
  return Vertex(vec4f(xy * 2.0 - 1.0, 0.0, 1.0), vec2f(xy.x, 1.0 - xy.y));
}
fn sampleInput(uv: vec2f) -> vec4f {
  let texel = vec2f(0.5) / vec2f(textureDimensions(source));
  return textureSampleLevel(source, linearSampler, clamp(uv * p.scaleAxis.xy, texel, p.scaleAxis.xy - texel), 0.0);
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4f {
  if (p.settings.y > 0.5) { return sampleInput(v.uv); }
  var color = sampleInput(v.uv) * p.kernel[0].y;
  for (var i = 1u; i < 8u; i++) {
    if (i >= u32(p.settings.x)) { break; }
    let offset = p.scaleAxis.zw * p.kernel[i].x;
    color += (sampleInput(v.uv + offset) + sampleInput(v.uv - offset)) * p.kernel[i].y;
  }
  return color;
}
