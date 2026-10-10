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
  bounds: vec4f,
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
// Whole 2x2 quads outside every conservative blob box skip all SDF work. Deciding
// per quad keeps screen derivatives valid for the pixels that continue.
fn quadNearGlass(position: vec2f) -> bool {
  let scale = p.size.xy / p.size.zw;
  let quad = floor(position * 0.5) * 2.0;
  let lo = quad * scale;
  let hi = (quad + vec2f(2.0)) * scale;
  for (var index = 0u; index < 8u; index++) {
    if (index >= u32(p.flags.x)) { break; }
    let box = p.blobs[index].bounds;
    if (all(hi >= box.xy) && all(lo <= box.zw)) { return true; }
  }
  return false;
}
fn erfApprox(value: f32) -> f32 { return tanh(1.7724538509 * value); }
// Outward normal of one body's deformed rounded rectangle, mapped back to source
// pixels through its squash/stretch and contact transform; no extra SDF work.
fn blobNormal(local: vec2f, index: u32) -> vec2f {
  let b = p.blobs[index];
  let radius = clamp(b.shape.w, 0.0, min(b.sizeVelocity.x, b.sizeVelocity.y));
  let q = abs(local) - max(b.sizeVelocity.xy - vec2f(radius), vec2f(0.0));
  var n = select(vec2f(0.0, sign(local.y)), vec2f(sign(local.x), 0.0), q.x > q.y);
  if (q.x > 0.0 && q.y > 0.0) { n = normalize(q) * sign(local); }
  let speed = clamp(length(b.sizeVelocity.zw) / 1100.0, 0.0, 1.0);
  var direction = vec2f(1.0, 0.0);
  if (speed > 0.001) { direction = normalize(b.sizeVelocity.zw); }
  let tangent = vec2f(-direction.y, direction.x);
  let stretch = 1.0 + speed * 0.52;
  let deformed = direction * (dot(n, direction) / stretch) + tangent * (dot(n, tangent) * sqrt(stretch));
  let world = transpose(mat2x2f(b.inverse.xy, b.inverse.zw)) * deformed;
  return world / max(length(world), 0.0001);
}
// Where each colour channel reads the source. The dome keeps its calibrated red-outermost
// fringe; the bevel model follows physical dispersion, where blue bends most.
struct Bend { r: vec2f, g: vec2f, b: vec2f }
fn bendOf(displacement: vec2f) -> Bend {
  let outer = displacement * (1.0 + 0.2 * p.refraction.z);
  let middle = displacement * (1.0 + 0.1 * p.refraction.z);
  if (p.flags.w > 0.5) { return Bend(displacement, middle, outer); }
  return Bend(outer, middle, displacement);
}
fn sampleChroma(uv: vec2f, bend: Bend) -> vec3f {
  let red = textureSample(source, linearSampler, uv - bend.r).r;
  let green = textureSample(source, linearSampler, uv - bend.g).g;
  let blue = textureSample(source, linearSampler, uv - bend.b).b;
  return vec3f(red, green, blue);
}
fn frostUv(uv: vec2f) -> vec2f { return clamp(uv * p.frostUv.xy, p.frostUv.zw, p.frostUv.xy - p.frostUv.zw); }
fn sampleFrost(uv: vec2f, bend: Bend) -> vec3f {
  let red = textureSample(frostSource, linearSampler, frostUv(uv - bend.r)).r;
  let green = textureSample(frostSource, linearSampler, frostUv(uv - bend.g)).g;
  let blue = textureSample(frostSource, linearSampler, frostUv(uv - bend.b)).b;
  return vec3f(red, green, blue);
}
fn sampleGlass(uv: vec2f, bend: Bend, blur: f32) -> vec3f {
  if (blur <= 0.001) { return sampleChroma(uv, bend); }
  if (blur >= 0.75) { return sampleFrost(uv, bend); }
  let stepSize = vec2f(blur * 1.34) / p.size.xy;
  var frosted = sampleChroma(uv, bend) * 0.2;
  frosted += sampleChroma(uv + vec2f(stepSize.x, 0.0), bend) * 0.12;
  frosted += sampleChroma(uv - vec2f(stepSize.x, 0.0), bend) * 0.12;
  frosted += sampleChroma(uv + vec2f(0.0, stepSize.y), bend) * 0.12;
  frosted += sampleChroma(uv - vec2f(0.0, stepSize.y), bend) * 0.12;
  frosted += sampleChroma(uv + stepSize, bend) * 0.08;
  frosted += sampleChroma(uv - stepSize, bend) * 0.08;
  frosted += sampleChroma(uv + vec2f(stepSize.x, -stepSize.y), bend) * 0.08;
  frosted += sampleChroma(uv + vec2f(-stepSize.x, stepSize.y), bend) * 0.08;
  if (blur > 0.5) { return mix(frosted, sampleFrost(uv, bend), smoothstep(0.5, 0.75, blur)); }
  return frosted;
}
fn sampleContent(uv: vec2f, blur: f32) -> vec4f {
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return vec4f(0.0); }
  return textureSampleBias(content, linearSampler, uv, log2(1.0 + blur * 2.0));
}
// Source-space ink takes the backdrop's refracted, dispersed position. It stays at its own
// blur under the clear center and takes the material's frost where the rim compresses it.
fn overlayInk(color: vec3f, uv: vec2f, bend: Bend, rimShift: f32) -> vec3f {
  let blur = mix(p.ink.z, p.frost.x, smoothstep(1.0, 4.0, rimShift));
  let red = sampleContent(uv - bend.r, blur) * p.ink.x;
  let green = sampleContent(uv - bend.g, blur) * p.ink.x;
  let blue = sampleContent(uv - bend.b, blur) * p.ink.x;
  return vec3f(color.r * (1.0 - red.a) + red.r, color.g * (1.0 - green.a) + green.g, color.b * (1.0 - blue.a) + blue.b);
}
fn shade(uv: vec2f, position: vec2f, emissionOnly: bool) -> vec4f {
  let transparent = p.flags.y > 0.5;
  let debug = p.flags.z > 0.5;
  let raw = textureSample(source, linearSampler, uv);
  if (p.flags.x < 1.0) {
    if (emissionOnly || transparent) { return vec4f(0.0); }
    if (debug) { return vec4f(0.5, 0.5, 0.5, 1.0); }
    return raw;
  }
  if (!quadNearGlass(position)) {
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
  if (p.edge.w >= 1.0 && (p.ink.x <= 0.001 || p.ink.w > 0.5) && !debug && !emissionOnly) {
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
  var bevelNormal = vec2f(0.0);
  var bevelRatio = vec2f(0.0);
  var lensOffset = vec2f(0.0);
  var lensAxis = vec2f(0.0);
  for (var index = 0u; index < 8u; index++) {
    if (index >= u32(p.flags.x)) { break; }
    let b = p.blobs[index];
    if (min(b.sizeVelocity.x, b.sizeVelocity.y) <= 0.001) { continue; }
    let blobDistance = movingBlobSdf(point, index, 0.0);
    // A fusion neck reaches past this body's own outline: read its cap at the merged
    // depth instead, so its rim slope never shows inside the neck. Lone bodies are unchanged.
    let fill = max(blobDistance - distance, 0.0);
    let weight = exp(-fill / blendRadius);
    let local = movingBlobLocal(point, index);
    let lensLocal = local * max(1.0 - fill / max(length(local), 0.001), 0.0);
    let extent = max(b.sizeVelocity.xy, vec2f(1.0));
    if (b.contact.z > 0.001) {
      let finger = point - b.shape.xy - b.contact.xy * extent;
      let radius = clamp(min(extent.x, extent.y) * 1.35, 16.0, 66.0);
      let spread = exp(-dot(finger, finger) / (radius * radius));
      let crest = exp(-dot(finger, finger) / (radius * radius * 0.09));
      contactLight += b.contact.z * weight * (spread * (0.16 + 0.5 * falloff) + crest * 0.26);
    }
    let normalizedLocal = clamp(lensLocal / extent, vec2f(-1.0), vec2f(1.0));
    var gradient = normalizedLocal;
    if (p.frost.z > 0.001) {
      let capped = min(abs(lensLocal), b.dome.xy * 0.999);
      let denominator = sqrt(max(b.dome.xy * b.dome.xy - capped * capped, vec2f(0.001)));
      gradient = sign(lensLocal) * capped / denominator * b.dome.zw;
    }
    glassGradient += gradient * b.ratio.xy * weight;
    if (p.flags.w > 0.5) {
      bevelNormal += blobNormal(local, index) * weight;
      bevelRatio += b.ratio.xy * weight;
      lensOffset += (point - b.shape.xy - b.offset.xy) * weight;
      lensAxis += select(vec2f(1.0, 0.0), vec2f(0.0, 1.0), b.sizeVelocity.x >= b.sizeVelocity.y) * weight;
    }
    materialUv += normalizedLocal * weight;
    materialWeight += weight;
  }
  glassGradient /= max(materialWeight, 0.001);
  materialUv /= max(materialWeight, 0.001);
  contactLight /= max(materialWeight, 0.001);
  var displacement = glassGradient * (p.refraction.y * 0.5 * falloff);
  let lens = p.flags.w > 1.5;
  var lensZoom = vec2f(0.0);
  var lensNormal = vec2f(0.0);
  var longSide = 0.0;
  var frost = p.frost.x;
  if (lens) {
    // A lifted lens, as iOS 27's: it magnifies what lies under its middle by ratio.z, and
    // its rim band (the edge depth) bulges outward, pulling in what surrounds the glass,
    // before meeting the surface flush at the rim.
    let band = clamp(1.0 - inside / max(p.frost.y, 0.001), 0.0, 1.0);
    lensNormal = bevelNormal / max(length(bevelNormal), 0.0001);
    // The magnification fades as the square root of the band, and the bulge,
    // (sqrt(band) * (1 - band))^1.5, peaks at 1 a third of the way out, so the middle
    // stays magnified close to the band before the rim pulls in its surroundings.
    let rise = sqrt(band);
    let swell = rise * (1.0 - band);
    // Only the long sides pull in their surroundings, as the native lens's top and bottom do;
    // the ends stay clear, so what the lens slides along is never echoed inside its rim.
    longSide = smoothstep(0.3, 0.9, abs(dot(lensNormal, lensAxis / max(length(lensAxis), 0.0001))));
    displacement = -lensNormal * (swell * sqrt(swell) * 4.1877 * longSide) * (bevelRatio / max(materialWeight, 0.001)) * (p.refraction.y * 0.5);
    lensZoom = lensOffset / max(materialWeight, 0.001) / p.size.xy * (1.0 - 1.0 / max(p.ratio.z, 1.0)) * (1.0 - rise) * coverage;
    // Only the outer band scatters; the refracted edge and magnified middle stay clear.
    frost *= smoothstep(0.45, 0.9, band) * longSide;
  } else if (p.flags.w > 0.5) {
    // Opt-in bevel: a flat slab whose quarter-circle rim (twice the edge depth)
    // refracts by Snell's law at n = 1.5. The top stays clear; the rim lenses inward.
    let rise = 1.0 - clamp(inside / max(p.frost.y * 2.0, 1.0), 0.0, 1.0);
    let tilt = atan(rise / max(sqrt(1.0 - rise * rise), 0.05));
    let deviation = tilt - asin(sin(tilt) / 1.5);
    let normal = bevelNormal / max(length(bevelNormal), 0.0001);
    displacement = normal * (tan(deviation) * 2.5) * (bevelRatio / max(materialWeight, 0.001)) * (p.refraction.y * 0.5);
  }
  displacement *= coverage * p.tint.w * p.ratio.xy;
  var bend = bendOf(displacement);
  var rimShade = 0.0;
  if (lens) {
    // The band disperses a little, red pulling furthest. The rim's outer slope, 0.22 of the
    // band wide, bends inward instead, mirroring what lies just inside it, and shades it. Its
    // reach disperses: red's a little further all round and far further where the rim faces the
    // top-left and bottom-right, blue's as far on the other diagonal, so warm and cool crescents
    // of a like size gather at opposite ends of each band.
    let spread = 0.04 * p.refraction.z;
    let diagonal = 2.0 * lensNormal.x * lensNormal.y;
    let redReach = (0.1 + 0.5 * diagonal) * p.refraction.z;
    let blueReach = (0.02 + 0.6 * diagonal) * p.refraction.z;
    let rimDepth = inside / max(0.22 * p.frost.y, 0.001);
    // Like the pull, the mirror lives on the long sides; the ends stay clear.
    let mirror = lensNormal * (0.45 * p.refraction.y * longSide) * (bevelRatio / max(materialWeight, 0.001)) * coverage * p.tint.w * p.ratio.xy;
    bend = Bend(
      lensZoom + displacement * (1.0 + spread) + mirror * max(1.0 + redReach - rimDepth, 0.0),
      lensZoom + displacement + mirror * max(1.0 - rimDepth, 0.0),
      lensZoom + displacement * (1.0 - spread) + mirror * max(1.0 - blueReach - rimDepth, 0.0));
    // The shade is the same in every channel: shading one channel more than another would
    // tint bright content. At the ends it is a quarter as deep: native's ends are a crisp dark
    // line with only a faint tail inside it. Like the contour it belongs to the rim, so it follows
    // edge strength: a lens settled flat into the bar has none.
    rimShade = 0.4 * max(1.0 - rimDepth, 0.0) * mix(0.25, 1.0, longSide) * smoothstep(0.0, 0.5, p.edge.x);
  }
  if (debug) { return vec4f(mix(vec3f(0.5), vec3f(vec2f(0.5) + (displacement + lensZoom) * 4.0, coverage), coverage), 1.0); }
  let theta = radians(p.glow.x);
  let light = vec2f(cos(theta), sin(theta));
  let alignment = abs(dot(materialUv, light));
  let glowLo = (1.0 - p.glow.z) * 1.41421356237;
  let glowSpan = max(p.glow.z * 1.41421356237, 0.001);
  let glow = p.glow.y * pow(clamp((alignment - glowLo) / glowSpan, 0.0, 1.0), p.glow.w) * falloff;
  let specular = min(1.0, glow);
  let edgeLight = pow(clamp(abs(dot(edgeGradient, light)) / max(length(edgeGradient), 0.001), 0.0, 1.0), p.edge.z);
  let edgeWidth = max(p.edge.y, 0.001);
  // Plain glass: a fine dark contour, then an inset crest. The crest's band covers the rim's
  // inner falloff, so over light content the edge reads as a lit bevel; a line hugging the edge
  // left the falloff showing there as an inner shadow.
  var contour = 1.0 - smoothstep(0.0, edgeWidth * mix(0.48, 0.65, edgeLight), inside);
  var reflection = smoothstep(edgeWidth * 0.45, edgeWidth * 0.85, inside) * (1.0 - smoothstep(edgeWidth * 0.85, edgeWidth * 2.0, inside));
  if (lens) {
    // The lifted lens's contour is a fine dark line at its very edge, a little wider at the ends,
    // and its rim line sits just inside it, so the line never washes out the contour.
    contour = 1.0 - smoothstep(0.0, edgeWidth * mix(0.8, 0.55, edgeLight), inside);
    reflection = smoothstep(edgeWidth * 0.2, edgeWidth * 0.6, inside) * (1.0 - smoothstep(edgeWidth * 0.6, edgeWidth * 1.4, inside));
  }
  // Every rim line reaches round toward the sides, faint there, as the native lens's does. Plain
  // glass keeps its full top and bottom crest; the lens's own comes mostly from what it mirrors.
  let reflectionLight = 0.42 * smoothstep(select(0.25, 0.12, lens), select(0.8, 0.72, lens), edgeLight) + select(0.58, 0.15, lens) * smoothstep(0.8, 0.98, edgeLight);
  let edgeGain = max(p.edge.x * p.refraction.w, 0.0);
  // The dark contour defines the body, so it follows edge strength alone: the lower SDR
  // highlight an HDR display uses must not thin the edge.
  let contourStrength = min(select(0.85, 0.95, lens), max(p.edge.x, 0.0) * 3.2) * mix(0.85, 0.24, edgeLight);
  let rimLight = reflection * reflectionLight * edgeGain;
  let brightnessAmount = clamp(abs(p.frost.w), 0.0, 1.0);
  var ink = vec4f(0.0);
  if (p.ink.x > 0.001 && p.ink.w < 0.5) {
    let extent = max(p.blobs[0].sizeVelocity.xy * 2.0, vec2f(1.0));
    let local = movingBlobLocal(point, 0u);
    let edgeFocus = 1.0 - smoothstep(0.0, max(p.frost.y * 2.0, 1.0), inside);
    let contentUv = vec2f(0.5) + (local - (displacement + lensZoom) * p.size.xy * 0.42 * p.ink.y * edgeFocus) / extent;
    ink = sampleContent(contentUv, p.ink.z) * p.ink.x;
  }
  if (emissionOnly) {
    let visibility = coverage * p.shadow.w * (1.0 - clamp(p.edge.w, 0.0, 1.0)) * (1.0 - ink.a);
    return vec4f(vec3f(contactLight, rimLight * (1.0 - brightnessAmount), 0.0) * visibility, 1.0);
  }
  var refracted = sampleGlass(uv, bend, frost);
  if (p.ink.x > 0.001 && p.ink.w > 0.5) { refracted = overlayInk(refracted, uv, bend, length(displacement * p.size.xy)); }
  // The rim's shade runs all round over dark content, as native's does, but over light
  // content only along the long sides: at the ends it read as a thick black edge.
  refracted = refracted * (1.0 - rimShade * mix(1.0, longSide, smoothstep(0.45, 0.85, dot(refracted, vec3f(0.299, 0.587, 0.114)))));
  let luminance = dot(refracted, vec3f(0.299, 0.587, 0.114));
  let shine = specular * p.refraction.w * (127.0 / 255.0);
  refracted = mix(refracted + vec3f(shine), refracted * (1.0 - shine), smoothstep(0.3, 0.7, luminance));
  // iOS 27 darkens the edge on every substrate; a lighter contour on dark content reads as
  // a grey outline. There the crest carries the shape instead, brighter than on light.
  // On light content the lens's side contour lightens, so it reads as the same fine line as on
  // dark; its top and bottom keep theirs.
  let contourAmount = contour * contourStrength * mix(1.0, 0.6, select(0.0, smoothstep(0.45, 0.85, luminance) * (1.0 - edgeLight), lens));
  refracted = refracted * (1.0 - contourAmount);
  let crest = vec3f(rimLight);
  refracted += crest * mix(0.5, 0.3, smoothstep(0.2, 0.5, luminance));
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
  let c = clamp(shade(v.uv, v.position.xy, false), vec4f(0.0), vec4f(1.0));
  return vec4f(c.rgb * c.a, c.a);
}
// Extra light above SDR white: red is contact, green is the static rim. Both share one
// soft cap, so a press lands near 1.5x SDR white and overlapping light never stacks
// into a glare. Keep in step with highlight-hdr.ts.
fn hdrLight(light: vec2f) -> vec4f {
  let lift = 0.85 * tanh((light.r * 0.7 + light.g * 0.85) / 0.85);
  return vec4f(vec3f(lift), light.r * 0.1 + light.g * 0.03);
}
@fragment fn highlight(v: Vertex) -> @location(0) vec4f {
  // Match the existing 8-bit mask calibration, directly on the same device.
  let light = floor(clamp(shade(v.uv, v.position.xy, true).rg, vec2f(0.0), vec2f(1.0)) * 255.0 + 0.5) / 255.0;
  return hdrLight(light);
}
