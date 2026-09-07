// The accepted Liquid material, in top-left source coordinates.
// Keep optical equations/calibration in parity with webgl2-renderer.ts.
diagnostic(off, derivative_uniformity);
struct Blob {
  shape: vec4f,
  sizeVelocity: vec4f,
  contact: vec4f,
  inverse: vec4f,
  offset: vec4f,
  dome: vec4f,
  ratio: vec4f,
}
struct Params {
  size: vec4f,
  frostUv: vec4f,
  refraction: vec4f,
  frost: vec4f,
  glow: vec4f,
  edge: vec4f,
  tint: vec4f,
  shadow: vec4f,
  ink: vec4f,
  flags: vec4f,
  ratio: vec4f,
  blobs: array<Blob, 8>,
}
@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var frostSource: texture_2d<f32>;
@group(0) @binding(3) var content: texture_2d<f32>;
@group(0) @binding(4) var linearSampler: sampler;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vertex(@builtin(vertex_index) index: u32) -> Vertex {
  let xy = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
  return Vertex(vec4f(xy * 2.0 - 1.0, 0.0, 1.0), vec2f(xy.x, 1.0 - xy.y));
}
fn smoothMin(a: f32, b: f32, radius: f32) -> f32 {
  let k = max(radius, 0.001);
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
fn movingBlobLocal(point: vec2f, index: u32) -> vec2f {
  let b = p.blobs[index];
  let velocity = b.sizeVelocity.zw;
  let speed = clamp(length(velocity) / 1100.0, 0.0, 1.0);
  var direction = vec2f(1.0, 0.0);
  if (speed > 0.001) { direction = normalize(velocity); }
  let tangent = vec2f(-direction.y, direction.x);
  let delta = mat2x2f(b.inverse.xy, b.inverse.zw) * (point - b.shape.xy - b.offset.xy);
  let stretch = 1.0 + speed * 0.52;
  let squash = inverseSqrt(stretch);
  let along = dot(delta, direction) / stretch;
  let across = dot(delta, tangent) / squash;
  return direction * along + tangent * across;
}
fn movingBlobSdf(point: vec2f, index: u32, inset: f32) -> f32 {
  let b = p.blobs[index];
  let deformed = movingBlobLocal(point, index);
  let extent = max(b.sizeVelocity.xy - vec2f(inset), vec2f(0.0));
  let radius = clamp(b.shape.w, 0.0, min(extent.x, extent.y));
  let inner = max(extent - vec2f(radius), vec2f(0.0));
  let edge = abs(deformed) - inner;
  return length(max(edge, vec2f(0.0))) + min(max(edge.x, edge.y), 0.0) - radius;
}
fn sceneSdf(point: vec2f, inset: f32) -> f32 {
  var distance = movingBlobSdf(point, 0u, inset);
  for (var index = 1u; index < 8u; index++) {
    if (index >= u32(p.flags.x)) { break; }
    if (min(p.blobs[index].sizeVelocity.x, p.blobs[index].sizeVelocity.y) <= 0.001) { continue; }
    distance = smoothMin(distance, movingBlobSdf(point, index, inset), p.refraction.x);
  }
  return distance;
}
fn erfApprox(value: f32) -> f32 { return tanh(1.7724538509 * value); }
fn sampleChroma(uv: vec2f, displacement: vec2f) -> vec3f {
  return vec3f(
    textureSample(source, linearSampler, uv - displacement * (1.0 + 0.2 * p.refraction.z)).r,
    textureSample(source, linearSampler, uv - displacement * (1.0 + 0.1 * p.refraction.z)).g,
    textureSample(source, linearSampler, uv - displacement).b
  );
}
fn frostUv(uv: vec2f) -> vec2f { return clamp(uv * p.frostUv.xy, p.frostUv.zw, p.frostUv.xy - p.frostUv.zw); }
fn sampleFrost(uv: vec2f, displacement: vec2f) -> vec3f {
  return vec3f(
    textureSample(frostSource, linearSampler, frostUv(uv - displacement * (1.0 + 0.2 * p.refraction.z))).r,
    textureSample(frostSource, linearSampler, frostUv(uv - displacement * (1.0 + 0.1 * p.refraction.z))).g,
    textureSample(frostSource, linearSampler, frostUv(uv - displacement)).b
  );
}
fn sampleGlass(uv: vec2f, displacement: vec2f) -> vec3f {
  let blur = p.frost.x;
  if (blur <= 0.001) { return sampleChroma(uv, displacement); }
  if (blur >= 0.75) { return sampleFrost(uv, displacement); }
  let stepSize = vec2f(blur * 1.34) / p.size.xy;
  var frosted = sampleChroma(uv, displacement) * 0.2;
  frosted += sampleChroma(uv + vec2f(stepSize.x, 0.0), displacement) * 0.12;
  frosted += sampleChroma(uv - vec2f(stepSize.x, 0.0), displacement) * 0.12;
  frosted += sampleChroma(uv + vec2f(0.0, stepSize.y), displacement) * 0.12;
  frosted += sampleChroma(uv - vec2f(0.0, stepSize.y), displacement) * 0.12;
  frosted += sampleChroma(uv + stepSize, displacement) * 0.08;
  frosted += sampleChroma(uv - stepSize, displacement) * 0.08;
  frosted += sampleChroma(uv + vec2f(stepSize.x, -stepSize.y), displacement) * 0.08;
  frosted += sampleChroma(uv + vec2f(-stepSize.x, stepSize.y), displacement) * 0.08;
  if (blur > 0.5) { return mix(frosted, sampleFrost(uv, displacement), smoothstep(0.5, 0.75, blur)); }
  return frosted;
}
fn sampleContent(uv: vec2f) -> vec4f {
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return vec4f(0.0); }
  return textureSampleBias(content, linearSampler, uv, log2(1.0 + p.ink.z * 2.0));
}
fn shade(uv: vec2f, emissionOnly: bool) -> vec4f {
  let transparent = p.flags.y > 0.5;
  let debug = p.flags.z > 0.5;
  let raw = textureSample(source, linearSampler, uv);
  if (p.flags.x < 1.0) {
    if (emissionOnly || transparent) { return vec4f(0.0); }
    if (debug) { return vec4f(0.5, 0.5, 0.5, 1.0); }
    return raw;
  }
  let point = uv * p.size.xy;
  let distance = sceneSdf(point, 0.0);
  let shadowDistance = sceneSdf(point - vec2f(0.0, p.shadow.y), 0.0);
  if (distance > 18.0 && shadowDistance > p.shadow.z * 3.0) {
    if (emissionOnly || transparent) { return vec4f(0.0); }
    if (debug) { return vec4f(0.5, 0.5, 0.5, 1.0); }
    return raw;
  }
  // OpenGL window Y increases upward; retain its directional highlight convention.
  let edgeGradient = vec2f(dpdx(distance), -dpdy(distance));
  let aa = max(fwidth(distance), 0.0001);
  let coverage = 1.0 - smoothstep(-aa, aa, distance);
  let shadowFalloff = 0.5 * (1.0 - erfApprox(shadowDistance / (max(p.shadow.z, 0.1) * 1.41421356237)));
  let outsideShadow = (1.0 - coverage) * shadowFalloff * p.shadow.x;
  var color = raw.rgb * (1.0 - outsideShadow);
  if (coverage <= 0.001) {
    if (emissionOnly) { return vec4f(0.0); }
    if (debug) { return vec4f(0.5, 0.5, 0.5, 1.0); }
    if (transparent) { return vec4f(0.0, 0.0, 0.0, outsideShadow * p.shadow.w); }
    return vec4f(mix(raw.rgb, color, p.shadow.w), raw.a);
  }
  if (p.edge.w >= 1.0 && p.ink.x <= 0.001 && !debug && !emissionOnly) {
    let alpha = coverage + outsideShadow * (1.0 - coverage);
    if (transparent) { return vec4f(p.tint.xyz * coverage / max(alpha, 0.0001), alpha * p.shadow.w); }
    return vec4f(mix(raw.rgb, p.tint.xyz, coverage * p.shadow.w), raw.a);
  }
  let inside = max(-distance, 0.0);
  let innerDistance = sceneSdf(point, max(p.frost.y, 0.0));
  let falloff = 0.5 * (1.0 + erfApprox(innerDistance / max(p.frost.y * 1.41421356237, 0.001)));
  var glassGradient = vec2f(0.0);
  var materialUv = vec2f(0.0);
  var materialWeight = 0.0;
  let blendRadius = max(p.refraction.x * 0.35, 1.0);
  var contactLight = 0.0;
  for (var index = 0u; index < 8u; index++) {
    if (index >= u32(p.flags.x)) { break; }
    let b = p.blobs[index];
    if (min(b.sizeVelocity.x, b.sizeVelocity.y) <= 0.001) { continue; }
    let blobDistance = movingBlobSdf(point, index, 0.0);
    let weight = exp(-max(blobDistance - distance, 0.0) / blendRadius);
    let local = movingBlobLocal(point, index);
    let extent = max(b.sizeVelocity.xy, vec2f(1.0));
    if (b.contact.z > 0.001) {
      let finger = point - b.shape.xy - b.contact.xy * extent;
      let radius = clamp(min(extent.x, extent.y) * 1.35, 16.0, 66.0);
      let spread = exp(-dot(finger, finger) / (radius * radius));
      let crest = exp(-dot(finger, finger) / (radius * radius * 0.09));
      contactLight += b.contact.z * weight * (spread * (0.16 + 0.5 * falloff) + crest * 0.26);
    }
    let normalizedLocal = clamp(local / extent, vec2f(-1.0), vec2f(1.0));
    var gradient = normalizedLocal;
    if (p.frost.z > 0.001) {
      let capped = min(abs(local), b.dome.xy * 0.999);
      let denominator = sqrt(max(b.dome.xy * b.dome.xy - capped * capped, vec2f(0.001)));
      gradient = sign(local) * capped / denominator * b.dome.zw;
    }
    glassGradient += gradient * b.ratio.xy * weight;
    materialUv += normalizedLocal * weight;
    materialWeight += weight;
  }
  glassGradient /= max(materialWeight, 0.001);
  materialUv /= max(materialWeight, 0.001);
  contactLight /= max(materialWeight, 0.001);
  var displacement = glassGradient * (p.refraction.y * 0.5 * falloff);
  displacement *= coverage * p.tint.w * p.ratio.xy;
  if (debug) { return vec4f(mix(vec3f(0.5), vec3f(vec2f(0.5) + displacement * 4.0, coverage), coverage), 1.0); }
  let theta = radians(p.glow.x);
  let light = vec2f(cos(theta), sin(theta));
  let alignment = abs(dot(materialUv, light));
  let glowLo = (1.0 - p.glow.z) * 1.41421356237;
  let glowSpan = max(p.glow.z * 1.41421356237, 0.001);
  let glow = p.glow.y * pow(clamp((alignment - glowLo) / glowSpan, 0.0, 1.0), p.glow.w) * falloff;
  let specular = min(1.0, glow);
  let edgeLight = pow(clamp(abs(dot(edgeGradient, light)) / max(length(edgeGradient), 0.001), 0.0, 1.0), p.edge.z);
  let edgeWidth = max(p.edge.y, 0.001);
  let contour = 1.0 - smoothstep(0.0, edgeWidth * mix(0.48, 0.65, edgeLight), inside);
  let reflection = smoothstep(edgeWidth * 0.45, edgeWidth * 0.85, inside) * (1.0 - smoothstep(edgeWidth * 0.85, edgeWidth * 2.0, inside));
  let reflectionLight = smoothstep(0.75, 0.98, edgeLight);
  let edgeGain = max(p.edge.x * p.refraction.w, 0.0);
  let contourStrength = min(0.85, edgeGain * 3.2) * mix(0.85, 0.24, edgeLight);
  let rimLight = reflection * reflectionLight * edgeGain;
  let brightnessAmount = clamp(abs(p.frost.w), 0.0, 1.0);
  var ink = vec4f(0.0);
  if (p.ink.x > 0.001) {
    let extent = max(p.blobs[0].sizeVelocity.xy * 2.0, vec2f(1.0));
    let local = movingBlobLocal(point, 0u);
    let edgeFocus = 1.0 - smoothstep(0.0, max(p.frost.y * 2.0, 1.0), inside);
    let contentUv = vec2f(0.5) + (local - displacement * p.size.xy * 0.42 * p.ink.y * edgeFocus) / extent;
    ink = sampleContent(contentUv) * p.ink.x;
  }
  if (emissionOnly) {
    let visibility = coverage * p.shadow.w * (1.0 - clamp(p.edge.w, 0.0, 1.0)) * (1.0 - ink.a);
    return vec4f(vec3f(contactLight, rimLight * (1.0 - brightnessAmount), 0.0) * visibility, 1.0);
  }
  var refracted = sampleGlass(uv, displacement);
  let luminance = dot(refracted, vec3f(0.299, 0.587, 0.114));
  let shine = specular * p.refraction.w * (127.0 / 255.0);
  refracted = mix(refracted + vec3f(shine), refracted * (1.0 - shine), smoothstep(0.3, 0.7, luminance));
  refracted *= 1.0 - contour * contourStrength;
  refracted += vec3f(rimLight * 0.22);
  let brightnessTarget = select(vec3f(0.0), vec3f(1.0), p.frost.w >= 0.0);
  refracted = mix(refracted, brightnessTarget, brightnessAmount);
  refracted = mix(refracted, p.tint.xyz, clamp(p.edge.w, 0.0, 1.0));
  refracted += vec3f(contactLight * 0.72) * (1.0 - clamp(p.edge.w, 0.0, 1.0));
  refracted = refracted * (1.0 - ink.a) + ink.rgb;
  let alpha = coverage + outsideShadow * (1.0 - coverage);
  if (transparent) { return vec4f(refracted * coverage / max(alpha, 0.0001), alpha * p.shadow.w); }
  color = mix(raw.rgb, refracted, coverage * p.shadow.w);
  return vec4f(color, raw.a);
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4f {
  let c = clamp(shade(v.uv, false), vec4f(0.0), vec4f(1.0));
  return vec4f(c.rgb * c.a, c.a);
}
@fragment fn highlight(v: Vertex) -> @location(0) vec4f {
  // Match the existing 8-bit mask calibration, directly on the same device.
  let light = floor(clamp(shade(v.uv, true).rg, vec2f(0.0), vec2f(1.0)) * 255.0 + 0.5) / 255.0;
  let edge = light.g * 0.26;
  return vec4f(vec3f(light.r * 2.4 + edge * 4.0), light.r * 0.35 + edge * 0.12);
}
