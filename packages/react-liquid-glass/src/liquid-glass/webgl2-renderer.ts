import { readLiquidSource } from "./canvas-sources.js";
import { createFrameGeometry, frostPyramid } from "./frame-geometry.js";
import { readMotion } from "../shared/values.js";
import { MAX_BLOBS, LIQUID_GLASS_MATERIAL, type LiquidGlassSource, type LiquidGlassFrame, type LiquidFrameRegion, type LiquidRendererStats } from "./render-frame.js";
import { notifyLiquidFrame } from "./frame-events.js";

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = vec2(aPosition.x * .5 + .5, 1. - (aPosition.y * .5 + .5));
  gl_Position = vec4(aPosition, 0., 1.);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outputColor;

uniform sampler2D uSource;
uniform sampler2D uFrostSource;
uniform vec4 uFrostUv;
uniform sampler2D uContent;
uniform float uContentOpacity;
uniform float uContentRefraction;
uniform float uContentBlur;
uniform bool uContentSource;
uniform vec2 uSourceSize;
uniform vec3 uBlobs[8];
uniform vec2 uHalfSize[8];
uniform float uCornerRadius[8];
uniform vec2 uVelocity[8];
uniform vec3 uContact[8];
uniform vec4 uContactInverse[8];
uniform vec2 uContactOffset[8];
uniform bool uEmissionOnly;
uniform int uBlobCount;
uniform float uMergeDistance;
uniform float uRefraction;
uniform float uChroma;
uniform float uSpecular;
uniform float uBlur;
uniform float uDepth;
uniform vec4 uDome[8];
uniform float uDomeDepth;
uniform float uBrightness;
uniform float uSpecularRotation;
uniform float uGlowStrength;
uniform float uGlowSpread;
uniform float uGlowExponent;
uniform float uEdgeStrength;
uniform float uEdgeWidth;
uniform float uEdgeExponent;
uniform vec3 uTintColor;
uniform float uTint;
uniform float uZoom;
uniform float uShadow;
uniform float uShadowOffset;
uniform float uShadowBlur;
uniform vec2 uRefractionRatio;
uniform vec2 uBlobRefractionRatio[8];
uniform float uOpacity;
uniform bool uTransparentOutside;
uniform bool uDebug;
uniform vec4 uBounds[8];
uniform vec2 uOutputSize;
uniform bool uBevel;
uniform bool uLens;
uniform float uLensZoom;

float smoothMin(float a, float b, float radius) {
  float k = max(radius, .001);
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}

vec2 movingBlobLocal(vec2 point, vec3 blob, vec2 velocity, int index) {
  float speed = clamp(length(velocity) / 1100., 0., 1.);
  vec2 direction = speed > .001 ? normalize(velocity) : vec2(1., 0.);
  vec2 tangent = vec2(-direction.y, direction.x);
  vec2 delta = mat2(uContactInverse[index]) * (point - blob.xy - uContactOffset[index]);
  float stretch = 1. + speed * .52;
  float squash = inversesqrt(stretch);
  float along = dot(delta, direction) / stretch;
  float across = dot(delta, tangent) / squash;
  vec2 deformed = direction * along + tangent * across;
  return deformed;
}

float movingBlobSdf(
  vec2 point,
  vec3 blob,
  vec2 halfSize,
  float cornerRadius,
  vec2 velocity,
  int index,
  float inset
) {
  vec2 deformed = movingBlobLocal(point, blob, velocity, index);
  vec2 extent = max(halfSize - vec2(inset), vec2(0.));
  float radius = clamp(cornerRadius, 0., min(extent.x, extent.y));
  vec2 inner = max(extent - vec2(radius), vec2(0.));
  vec2 edge = abs(deformed) - inner;
  return length(max(edge, 0.)) + min(max(edge.x, edge.y), 0.) - radius;
}

float sceneSdf(vec2 point, float inset) {
  float distance = movingBlobSdf(
    point,
    uBlobs[0],
    uHalfSize[0],
    uCornerRadius[0],
    uVelocity[0],
    0,
    inset
  );
  for (int index = 1; index < 8; index++) {
    if (index >= uBlobCount) break;
    if (min(uHalfSize[index].x, uHalfSize[index].y) <= .001) continue;
    float next = movingBlobSdf(
      point,
      uBlobs[index],
      uHalfSize[index],
      uCornerRadius[index],
      uVelocity[index],
      index,
      inset
    );
    distance = smoothMin(distance, next, uMergeDistance);
  }
  return distance;
}

// Whole 2x2 quads outside every conservative blob box skip all SDF work. Deciding
// per quad keeps screen derivatives valid for the pixels that continue.
bool quadNearGlass() {
  vec2 scale = uSourceSize / uOutputSize;
  vec2 quad = floor(gl_FragCoord.xy * .5) * 2.;
  // Window Y increases upward; the boxes use the top-left source origin.
  vec2 lo = vec2(quad.x, uOutputSize.y - quad.y - 2.) * scale;
  vec2 hi = vec2(quad.x + 2., uOutputSize.y - quad.y) * scale;
  for (int index = 0; index < 8; index++) {
    if (index >= uBlobCount) break;
    vec4 box = uBounds[index];
    if (all(greaterThanEqual(hi, box.xy)) && all(lessThanEqual(lo, box.zw))) return true;
  }
  return false;
}

float erfApprox(float value) {
  return tanh(1.7724538509 * value);
}

// Outward normal of one body's deformed rounded rectangle, mapped back to source
// pixels through its squash/stretch and contact transform; no extra SDF work.
vec2 blobNormal(vec2 local, int index) {
  float radius = clamp(uCornerRadius[index], 0., min(uHalfSize[index].x, uHalfSize[index].y));
  vec2 q = abs(local) - max(uHalfSize[index] - vec2(radius), vec2(0.));
  vec2 n = q.x > q.y ? vec2(sign(local.x), 0.) : vec2(0., sign(local.y));
  if (q.x > 0. && q.y > 0.) n = normalize(q) * sign(local);
  float speed = clamp(length(uVelocity[index]) / 1100., 0., 1.);
  vec2 direction = speed > .001 ? normalize(uVelocity[index]) : vec2(1., 0.);
  vec2 tangent = vec2(-direction.y, direction.x);
  float stretch = 1. + speed * .52;
  vec2 deformed = direction * (dot(n, direction) / stretch) + tangent * (dot(n, tangent) * sqrt(stretch));
  vec2 world = transpose(mat2(uContactInverse[index])) * deformed;
  return world / max(length(world), .0001);
}

// Where each colour channel reads the source. The dome keeps its calibrated red-outermost
// fringe; the bevel model follows physical dispersion, where blue bends most.
struct Bend { vec2 r; vec2 g; vec2 b; };
Bend bendOf(vec2 displacement) {
  vec2 outer = displacement * (1. + .2 * uChroma);
  vec2 middle = displacement * (1. + .1 * uChroma);
  if (uBevel) return Bend(displacement, middle, outer);
  return Bend(outer, middle, displacement);
}
vec3 sampleChroma(sampler2D source, vec2 uv, Bend bend) {
  return vec3(texture(source, uv - bend.r).r, texture(source, uv - bend.g).g, texture(source, uv - bend.b).b);
}

vec2 frostUv(vec2 uv) {
  return clamp(uv * uFrostUv.xy, uFrostUv.zw, uFrostUv.xy - uFrostUv.zw);
}
vec3 sampleFrost(vec2 uv, Bend bend) {
  return vec3(
    texture(uFrostSource, frostUv(uv - bend.r)).r,
    texture(uFrostSource, frostUv(uv - bend.g)).g,
    texture(uFrostSource, frostUv(uv - bend.b)).b
  );
}

vec3 sampleGlass(vec2 uv, Bend bend, float blur) {
  if (blur <= .001) return sampleChroma(uSource, uv, bend);
  if (blur >= .75) return sampleFrost(uv, bend);
  // Keep core Glass's chroma offsets inside every sample of the frost
  // instead of replacing them with one achromatic blur.
  vec2 stepSize = vec2(blur * 1.34) / uSourceSize;
  vec3 frosted = sampleChroma(uSource, uv, bend) * .2;
  frosted += sampleChroma(uSource, uv + vec2(stepSize.x, 0.), bend) * .12;
  frosted += sampleChroma(uSource, uv - vec2(stepSize.x, 0.), bend) * .12;
  frosted += sampleChroma(uSource, uv + vec2(0., stepSize.y), bend) * .12;
  frosted += sampleChroma(uSource, uv - vec2(0., stepSize.y), bend) * .12;
  frosted += sampleChroma(uSource, uv + stepSize, bend) * .08;
  frosted += sampleChroma(uSource, uv - stepSize, bend) * .08;
  frosted += sampleChroma(uSource, uv + vec2(stepSize.x, -stepSize.y), bend) * .08;
  frosted += sampleChroma(uSource, uv + vec2(-stepSize.x, stepSize.y), bend) * .08;
  // Keep the fine-frost endpoint exact, with no optical step during a morph.
  return blur > .5 ? mix(frosted, sampleFrost(uv, bend), smoothstep(.5, .75, blur)) : frosted;
}

vec4 sampleContent(vec2 uv, float blur) {
  if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return vec4(0.);
  // Prefilter glyphs instead of spacing discrete taps far enough to duplicate strokes.
  return texture(uContent, uv, log2(1. + blur * 2.));
}
// Source-space ink takes the backdrop's refracted, dispersed position. It stays at its own
// blur under the clear center and takes the material's frost where the rim compresses it.
vec3 overlayInk(vec3 color, vec2 uv, Bend bend, float rimShift) {
  float blur = mix(uContentBlur, uBlur, smoothstep(1., 4., rimShift));
  vec4 red = sampleContent(uv - bend.r, blur) * uContentOpacity;
  vec4 green = sampleContent(uv - bend.g, blur) * uContentOpacity;
  vec4 blue = sampleContent(uv - bend.b, blur) * uContentOpacity;
  return vec3(color.r * (1. - red.a) + red.r, color.g * (1. - green.a) + green.g, color.b * (1. - blue.a) + blue.b);
}

void main() {
  vec4 raw = texture(uSource, vUv);
  if (uBlobCount < 1) {
    outputColor = uEmissionOnly || uTransparentOutside ? vec4(0.) : (uDebug ? vec4(.5, .5, .5, 1.) : raw);
    return;
  }

  if (!quadNearGlass()) {
    outputColor = uEmissionOnly || uTransparentOutside ? vec4(0.) : (uDebug ? vec4(.5, .5, .5, 1.) : raw);
    return;
  }
  vec2 point = vUv * uSourceSize;
  float distance = sceneSdf(point, 0.);
  float shadowDistance = sceneSdf(point - vec2(0., uShadowOffset), 0.);
  if (distance > 18. && shadowDistance > uShadowBlur * 3.) {
    outputColor = uEmissionOnly || uTransparentOutside ? vec4(0.) : (uDebug ? vec4(.5, .5, .5, 1.) : raw);
    return;
  }

  vec2 edgeGradient = vec2(dFdx(distance), dFdy(distance));
  float aa = max(fwidth(distance), .0001);
  float coverage = 1. - smoothstep(-aa, aa, distance);
  // Blur the signed silhouette instead of leaving a solid offset umbra.
  float shadowFalloff = .5 * (1. - erfApprox(shadowDistance / (max(uShadowBlur, .1) * 1.41421356237)));
  float outsideShadow = (1. - coverage) * shadowFalloff * uShadow;
  vec3 color = raw.rgb * (1. - outsideShadow);
  if (coverage <= .001) {
    if (uEmissionOnly) { outputColor = vec4(0.); return; }
    if (uDebug) { outputColor = vec4(.5, .5, .5, 1.); return; }
    outputColor = uTransparentOutside ? vec4(0., 0., 0., outsideShadow * uOpacity) : vec4(mix(raw.rgb, color, uOpacity), raw.a);
    return;
  }
  // Opaque resting control thumbs need their SDF coverage/shadow, not optics.
  if (uTint >= 1. && (uContentOpacity <= .001 || uContentSource) && !uDebug && !uEmissionOnly) {
    float alpha = coverage + outsideShadow * (1. - coverage);
    outputColor = uTransparentOutside
      ? vec4(uTintColor * coverage / max(alpha, .0001), alpha * uOpacity)
      : vec4(mix(raw.rgb, uTintColor, coverage * uOpacity), raw.a);
    return;
  }

  float inside = max(-distance, 0.);
  float innerDistance = sceneSdf(point, max(uDepth, 0.));
  float falloff = .5 * (1. + erfApprox(
    innerDistance / max(uDepth * 1.41421356237, .001)
  ));
  vec2 glassGradient = vec2(0.);
  vec2 materialUv = vec2(0.);
  float materialWeight = 0.;
  float blendRadius = max(uMergeDistance * .35, 1.);
  float contactLight = 0.;
  vec2 bevelNormal = vec2(0.);
  vec2 bevelRatio = vec2(0.);
  vec2 lensOffset = vec2(0.);
  for (int index = 0; index < 8; index++) {
    if (index >= uBlobCount) break;
    if (min(uHalfSize[index].x, uHalfSize[index].y) <= .001) continue;
    float blobDistance = movingBlobSdf(
      point,
      uBlobs[index],
      uHalfSize[index],
      uCornerRadius[index],
      uVelocity[index],
      index,
      0.
    );
    // A fusion neck reaches past this body's own outline: read its cap at the merged
    // depth instead, so its rim slope never shows inside the neck. Lone bodies are unchanged.
    float fill = max(blobDistance - distance, 0.);
    float weight = exp(-fill / blendRadius);
    vec2 local = movingBlobLocal(point, uBlobs[index], uVelocity[index], index);
    vec2 lensLocal = local * max(1. - fill / max(length(local), .001), 0.);
    vec2 extent = max(uHalfSize[index], vec2(1.));
    if (uContact[index].z > .001) {
      vec2 finger = point - uBlobs[index].xy - uContact[index].xy * extent;
      float radius = clamp(min(extent.x, extent.y) * 1.35, 16., 66.);
      float spread = exp(-dot(finger, finger) / (radius * radius));
      float crest = exp(-dot(finger, finger) / (radius * radius * .09));
      contactLight += uContact[index].z * weight * (spread * (.16 + .5 * falloff) + crest * .26);
    }
    vec2 normalizedLocal = clamp(lensLocal / extent, vec2(-1.), vec2(1.));
    vec2 gradient = normalizedLocal;
    if (uDomeDepth > .001) {
      vec4 dome = uDome[index];
      vec2 capped = min(abs(lensLocal), dome.xy * .999);
      vec2 denominator = sqrt(max(dome.xy * dome.xy - capped * capped, vec2(.001)));
      gradient = sign(lensLocal) * capped / denominator * dome.zw;
    }
    glassGradient += gradient * uBlobRefractionRatio[index] * weight;
    if (uBevel || uLens) {
      bevelNormal += blobNormal(local, index) * weight;
      bevelRatio += uBlobRefractionRatio[index] * weight;
      lensOffset += (point - uBlobs[index].xy - uContactOffset[index]) * weight;
    }
    materialUv += normalizedLocal * weight;
    materialWeight += weight;
  }
  glassGradient /= max(materialWeight, .001);
  materialUv /= max(materialWeight, .001);
  contactLight /= max(materialWeight, .001);
  // Core Glass uses objectBoundingBox primitive units: channel delta is half the scale.
  vec2 displacement = glassGradient * (uRefraction * .5 * falloff);
  vec2 lensZoom = vec2(0.);
  vec2 lensNormal = vec2(0.);
  float frost = uBlur;
  if (uLens) {
    // A lifted lens, as iOS 27's: it magnifies what lies under its middle by uLensZoom, and
    // its rim band (the edge depth) bulges outward, pulling in what surrounds the glass,
    // before meeting the surface flush at the rim.
    float band = clamp(1. - inside / max(uDepth, .001), 0., 1.);
    lensNormal = bevelNormal / max(length(bevelNormal), .0001);
    // The magnification fades as the square root of the band, and the bulge,
    // (sqrt(band) * (1 - band))^1.5, peaks at 1 a third of the way out, so the middle
    // stays magnified close to the band before the rim pulls in its surroundings.
    float rise = sqrt(band);
    float swell = rise * (1. - band);
    displacement = -lensNormal * (swell * sqrt(swell) * 4.1877) * (bevelRatio / max(materialWeight, .001)) * (uRefraction * .5);
    lensZoom = lensOffset / max(materialWeight, .001) / uSourceSize * (1. - 1. / max(uLensZoom, 1.)) * (1. - rise) * coverage;
    // Only the outer band scatters; the refracted edge and magnified middle stay clear.
    frost *= smoothstep(.45, .9, band);
  } else if (uBevel) {
    // Opt-in bevel: a flat slab whose quarter-circle rim (twice the edge depth)
    // refracts by Snell's law at n = 1.5. The top stays clear; the rim lenses inward.
    float rise = 1. - clamp(inside / max(uDepth * 2., 1.), 0., 1.);
    float tilt = atan(rise / max(sqrt(1. - rise * rise), .05));
    float deviation = tilt - asin(sin(tilt) / 1.5);
    vec2 normal = bevelNormal / max(length(bevelNormal), .0001);
    displacement = normal * (tan(deviation) * 2.5) * (bevelRatio / max(materialWeight, .001)) * (uRefraction * .5);
  }
  displacement *= coverage * uZoom * uRefractionRatio;
  Bend bend = bendOf(displacement);
  if (uLens) {
    // Red bends furthest, as in the dome, but around the rim red holds back where the rim
    // faces the top-left and bottom-right, blue where it faces the other diagonal, and green
    // half as much on both, so warm and cool glows gather at opposite ends of each band.
    float spread = .04 * uChroma;
    float tilt = .6 * uChroma;
    float diagonal = 2. * lensNormal.x * lensNormal.y;
    bend = Bend(lensZoom + displacement * (1. + spread - tilt * max(diagonal, 0.)), lensZoom + displacement * (1. - .5 * tilt * abs(diagonal)), lensZoom + displacement * (1. - spread - tilt * max(-diagonal, 0.)));
  }
  if (uDebug) {
    outputColor = vec4(mix(vec3(.5), vec3(.5 + (displacement + lensZoom) * 4., coverage), coverage), 1.);
    return;
  }

  float theta = radians(uSpecularRotation);
  vec2 light = vec2(cos(theta), sin(theta));
  float align = abs(dot(materialUv, light));
  float glowLo = (1. - uGlowSpread) * 1.41421356237;
  float glowSpan = max(uGlowSpread * 1.41421356237, .001);
  float glow = uGlowStrength
    * pow(clamp((align - glowLo) / glowSpan, 0., 1.), uGlowExponent)
    * falloff;
  float specular = min(1., glow);
  // Reuse the SDF's screen derivatives: straight sidewalls must not inherit
  // a bright rim from their position above/below the body's center.
  float edgeLight = pow(clamp(abs(dot(edgeGradient, light)) / max(length(edgeGradient), .001), 0., 1.), uEdgeExponent);
  // One SDF, two edge profiles: a fine dark contour, then an inset bright crest.
  // The bright crest must not erase the faint top/bottom contour underneath it.
  float edgeWidth = max(uEdgeWidth, .001);
  float contour = 1. - smoothstep(0., edgeWidth * mix(.48, .65, edgeLight), inside);
  float reflection = smoothstep(edgeWidth * .45, edgeWidth * .85, inside)
    * (1. - smoothstep(edgeWidth * .85, edgeWidth * 2., inside));
  if (uLens) {
    // The lifted lens's contour and rim line hug its very edge, as on the native lens.
    contour = 1. - smoothstep(0., edgeWidth, inside);
    reflection = smoothstep(0., edgeWidth * .35, inside) * (1. - smoothstep(edgeWidth * .35, edgeWidth, inside));
  }
  // Confine the fine reflection to the upper/lower arcs, not the sidewalls.
  float reflectionLight = smoothstep(.75, .98, edgeLight);
  float edgeGain = max(uEdgeStrength * uSpecular, 0.);
  // The dark contour defines the body, so it follows edge strength alone: the lower SDR
  // highlight an HDR display uses must not thin the edge.
  float contourStrength = min(.85, max(uEdgeStrength, 0.) * 3.2) * mix(.85, .24, edgeLight);
  float rimLight = reflection * reflectionLight * edgeGain;
  float brightnessAmount = clamp(abs(uBrightness), 0., 1.);
  vec4 ink = vec4(0.);
  if (uContentOpacity > .001 && !uContentSource) {
    vec2 extent = max(uHalfSize[0] * 2., vec2(1.));
    vec2 local = movingBlobLocal(point, uBlobs[0], uVelocity[0], 0);
    // Reuse the live merged optical field; only the peripheral ink is stretched.
    float edgeFocus = 1. - smoothstep(0., max(uDepth * 2., 1.), inside);
    vec2 contentUv = .5 + (local - (displacement + lensZoom) * uSourceSize * .42 * uContentRefraction * edgeFocus) / extent;
    ink = sampleContent(contentUv, uContentBlur) * uContentOpacity;
  }
  // The same fine crest and contact field feed HDR. No frost pass is repeated,
  // and foreground ink, opaque thumbs and SDF coverage still occlude the light.
  if (uEmissionOnly) {
    float visibility = coverage * uOpacity * (1. - clamp(uTint, 0., 1.)) * (1. - ink.a);
    outputColor = vec4(vec3(contactLight, rimLight * (1. - brightnessAmount), 0.) * visibility, 1.);
    return;
  }
  vec3 refracted = sampleGlass(vUv, bend, frost);
  if (uContentSource && uContentOpacity > .001) refracted = overlayInk(refracted, vUv, bend, length(displacement * uSourceSize));
  // Video's highlight response preserves contrast on both bright and dark substrates.
  float luminance = dot(refracted, vec3(.299, .587, .114));
  float shine = specular * uSpecular * (127. / 255.);
  refracted = mix(refracted + vec3(shine), refracted * (1. - shine), smoothstep(.3, .7, luminance));
  // iOS 27 darkens the edge on every substrate; a lighter contour on dark content reads as
  // a grey outline. There the crest carries the shape instead, brighter than on light.
  float contourAmount = contour * contourStrength;
  refracted = refracted * (1. - contourAmount);
  vec3 crest = vec3(rimLight);
  if (uLens) {
    // The lens's rim line disperses too: green and blue at the very edge, red just inside.
    float inner = inside - edgeWidth * .2;
    float red = smoothstep(0., edgeWidth * .35, inner) * (1. - smoothstep(edgeWidth * .35, edgeWidth, inner));
    crest = vec3(red, reflection, reflection * .85) * reflectionLight * edgeGain;
  }
  refracted += crest * mix(.5, .3, smoothstep(.2, .5, luminance));
  vec3 brightnessTarget = uBrightness >= 0. ? vec3(1.) : vec3(0.);
  refracted = mix(refracted, brightnessTarget, brightnessAmount);
  refracted = mix(refracted, uTintColor, clamp(uTint, 0., 1.));
  refracted += vec3(contactLight * .72) * (1. - clamp(uTint, 0., 1.));
  // Premultiplied ink avoids dark fringes as transparent glyph edges are blurred.
  refracted = refracted * (1. - ink.a) + ink.rgb;
  float alpha = coverage + outsideShadow * (1. - coverage);
  if (uTransparentOutside) {
    outputColor = vec4(refracted * coverage / max(alpha, .0001), alpha * uOpacity);
    return;
  }
  color = mix(raw.rgb, refracted, coverage * uOpacity);
  outputColor = vec4(color, raw.a);
}`;

const FROST_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outputColor;
uniform sampler2D uInput;
uniform vec2 uInputScale;
uniform vec2 uAxis;
uniform vec2 uKernel[8];
uniform int uCount;
uniform bool uCopy;
vec4 sampleInput(vec2 uv) {
  vec2 texel = .5 / vec2(textureSize(uInput, 0));
  return texture(uInput, clamp(uv * uInputScale, texel, uInputScale - texel));
}
void main() {
  // FBO textures keep their row order; only the final canvas flips the HTML UV.
  vec2 uv = vec2(vUv.x, 1. - vUv.y);
  // Reductions average the output texel's four quadrants; at exactly 2x this is
  // the 2x2 box, and a final 1-2x resample still covers its whole footprint.
  if (uCopy) {
    outputColor = .25 * (sampleInput(uv + uAxis) + sampleInput(uv - uAxis) + sampleInput(uv + vec2(uAxis.x, -uAxis.y)) + sampleInput(uv + vec2(-uAxis.x, uAxis.y)));
    return;
  }
  vec4 color = sampleInput(uv) * uKernel[0].y;
  for (int i = 1; i < 8; i++) {
    if (i >= uCount) break;
    vec2 offset = uAxis * uKernel[i].x;
    color += (sampleInput(uv + offset) + sampleInput(uv - offset)) * uKernel[i].y;
  }
  outputColor = color;
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create liquid-glass shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message ?? "Liquid-glass shader compilation failed");
  }
  return shader;
}

function createTexture(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Unable to create liquid-glass texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}


const uniformNames = [
  "uSource", "uFrostSource", "uFrostUv", "uContent", "uContentOpacity", "uContentRefraction", "uContentBlur", "uContentSource",
  "uSourceSize", "uBlobs[0]", "uHalfSize[0]", "uCornerRadius[0]", "uVelocity[0]",
  "uContact[0]", "uContactInverse[0]", "uContactOffset[0]", "uEmissionOnly",
  "uDome[0]", "uBlobRefractionRatio[0]", "uBlobCount", "uMergeDistance", "uRefraction", "uRefractionRatio",
  "uChroma", "uSpecular", "uBlur", "uDepth", "uDomeDepth", "uBrightness",
  "uSpecularRotation", "uGlowStrength", "uGlowSpread", "uGlowExponent",
  "uEdgeStrength", "uEdgeWidth", "uEdgeExponent", "uTintColor", "uTint", "uZoom",
  "uShadow", "uShadowOffset", "uShadowBlur", "uOpacity", "uTransparentOutside", "uDebug",
  "uBounds[0]", "uOutputSize", "uBevel", "uLens", "uLensZoom",
] as const;
const scalarUniforms = {
  mergeDistance: "uMergeDistance", refractionStrength: "uRefraction",
  chromaAmount: "uChroma", specularStrength: "uSpecular", blurStrength: "uBlur",
  edgeDepth: "uDepth", domeDepth: "uDomeDepth", brightness: "uBrightness",
  specularRotation: "uSpecularRotation", glowStrength: "uGlowStrength",
  glowSpread: "uGlowSpread", glowExponent: "uGlowExponent", edgeStrength: "uEdgeStrength",
  edgeWidth: "uEdgeWidth", edgeExponent: "uEdgeExponent", tintStrength: "uTint",
  magnification: "uZoom", lensMagnification: "uLensZoom", shadowStrength: "uShadow", shadowOffset: "uShadowOffset",
  shadowBlur: "uShadowBlur", opacity: "uOpacity",
} as const;
const scalarKeys = Object.keys(scalarUniforms) as Array<keyof typeof scalarUniforms>;

function createResources(gl: WebGL2RenderingContext) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  if (!program || !buffer || !vao) throw new Error("Unable to allocate Liquid Glass resources");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Liquid Glass link failed");
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(uniformNames.map(name => [name, gl.getUniformLocation(program, name)]));
  gl.uniform1i(uniforms.uSource, 0);
  gl.uniform1i(uniforms.uContent, 1);
  gl.uniform1i(uniforms.uFrostSource, 2);
  const frostFragment = compile(gl, gl.FRAGMENT_SHADER, FROST_SHADER);
  const frostProgram = gl.createProgram();
  const framebuffer = gl.createFramebuffer();
  if (!frostProgram || !framebuffer) throw new Error("Unable to allocate Liquid frost resources");
  gl.attachShader(frostProgram, vertex); gl.attachShader(frostProgram, frostFragment);
  gl.linkProgram(frostProgram);
  if (!gl.getProgramParameter(frostProgram, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(frostProgram) ?? "Liquid frost link failed");
  const frostUniforms = Object.fromEntries(["uInput", "uInputScale", "uAxis", "uKernel[0]", "uCount", "uCopy"].map(name => [name, gl.getUniformLocation(frostProgram, name)]));
  const scratch = createTexture(gl);
  return { program, buffer, vao, vertex, fragment, uniforms, frostProgram, frostFragment, frostUniforms, scratch, framebuffer, scratchWidth: 0, scratchHeight: 0 };
}
function createDevice(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: true, antialias: false, depth: false, premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL2 is unavailable for Liquid Glass");
  const device = { canvas, gl, ...createResources(gl), users: 0, version: 0, listeners: new Set<() => void>(), lost, restored };
  function lost(event: Event) { event.preventDefault(); }
  function restored() {
    Object.assign(device, createResources(gl!));
    device.version++;
    device.listeners.forEach(notify => notify());
  }
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return device;
}
type Device = ReturnType<typeof createDevice>;
let sharedDevice: Device | undefined;

function destroyDevice(device: Device) {
  const { gl } = device;
  gl.deleteVertexArray(device.vao);
  gl.deleteBuffer(device.buffer);
  gl.deleteProgram(device.program);
  gl.deleteShader(device.vertex);
  gl.deleteShader(device.fragment);
  gl.deleteShader(device.frostFragment);
  gl.deleteProgram(device.frostProgram);
  gl.deleteTexture(device.scratch);
  gl.deleteFramebuffer(device.framebuffer);
  device.canvas.removeEventListener("webglcontextlost", device.lost);
  device.canvas.removeEventListener("webglcontextrestored", device.restored);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
}

/**
 * React-free rendering API. Small/DOM surfaces share one GPU context; media can
 * render directly to their canvas to avoid a full-frame copy on each video frame.
 */
export function createWebGL2GlassRenderer(
  canvas: HTMLCanvasElement,
  { shared = false, onRestore }: { shared?: boolean; onRestore?: () => void } = {},
) {
  const output = shared ? canvas.getContext("2d") : null;
  if (shared && !output) throw new Error("Unable to create Liquid Glass output surface");
  const device = shared
    ? (sharedDevice ??= createDevice(document.createElement("canvas")))
    : createDevice(canvas);
  device.users++;
  const { gl } = device;
  let texture: WebGLTexture, contentTexture: WebGLTexture, frostTexture: WebGLTexture;
  let version = -1;
  if (onRestore) device.listeners.add(onRestore);
  const geometry = createFrameGeometry();
  const { blobs, sizes, corners, velocities, contacts, contactInverses, contactOffsets, domes, refractionRatios, bounds } = geometry;
  let lastSource: LiquidGlassSource | undefined;
  let sourceRevision: number | undefined;
  let sourceWidth = 0, sourceHeight = 0;
  let lastBlur = NaN, frostWidth = 0, frostHeight = 0;
  let pyramid: WebGLTexture[] = [], pyramidSizes: Array<[number, number]> = [];
  let pyramidWidth = 0, pyramidHeight = 0, pyramidReady = 0;
  let frostViewWidth = 0, frostViewHeight = 0;
  const kernel = new Float32Array(16);
  let lastContent: HTMLCanvasElement | undefined;
  let contentRevision: number | undefined;
  const highlightState: number[] = [];
  let lastHighlight: unknown, highlightContent: HTMLCanvasElement | null | undefined, highlightRevision: number | undefined;
  let disposed = false;
  let previousRegions: LiquidFrameRegion[] = [{ left: 0, top: 0, width: 1, height: 1 }];
  let previousWidth = 0, previousHeight = 0;
  const stats: LiquidRendererStats = { draws: 0, emissionDraws: 0, sourceUploads: 0, contentUploads: 0 };

  function draw(p: LiquidGlassFrame, presentHighlightHDR?: (mask: HTMLCanvasElement, region?: { x: number; y: number; width: number; height: number }) => void) {
    if (disposed || gl.isContextLost() || !Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width <= 0 || p.height <= 0) return false;
    const source = readLiquidSource(p.source);
    const sw = source instanceof HTMLVideoElement ? source.videoWidth
      : source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const sh = source instanceof HTMLVideoElement ? source.videoHeight
      : source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!sw || !sh) return false;
    const { uniforms: u } = device;
    if (version !== device.version) {
      gl.activeTexture(gl.TEXTURE0);
      texture = createTexture(gl);
      gl.activeTexture(gl.TEXTURE1);
      contentTexture = createTexture(gl);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      gl.generateMipmap(gl.TEXTURE_2D);
      sourceWidth = sourceHeight = 0; lastSource = lastContent = undefined;
      gl.activeTexture(gl.TEXTURE2);
      frostTexture = createTexture(gl);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      lastBlur = NaN; frostWidth = frostHeight = 0;
      pyramid = []; pyramidWidth = pyramidHeight = pyramidReady = 0;
      lastHighlight = undefined;
      version = device.version;
    }
    const requestedRatio = p.pixelRatio ?? window.devicePixelRatio ?? 1;
    const ratio = Number.isFinite(requestedRatio) ? Math.max(.5, Math.min(2.5, requestedRatio)) : 1;
    const width = Math.max(1, Math.round(p.width * ratio));
    const height = Math.max(1, Math.round(p.height * ratio));
    // Shared controls draw into a retained viewport. Alternating a large popup
    // with small thumbs must not reallocate the GPU drawing buffer every frame.
    if (output ? device.canvas.width < width : device.canvas.width !== width) device.canvas.width = width;
    if (output ? device.canvas.height < height : device.canvas.height !== height) device.canvas.height = height;
    const sourceTop = device.canvas.height - height;
    gl.useProgram(device.program);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(device.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (lastSource !== source || sourceRevision !== (p.sourceRevision ?? 0) || sw !== sourceWidth || sh !== sourceHeight) {
      if (sw !== sourceWidth || sh !== sourceHeight) {
        if (source instanceof HTMLVideoElement) {
          // Allocate before the first video copy: the browser's direct video
          // texImage path can leave empty storage and reject later frame updates.
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
        } else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
      sourceWidth = sw; sourceHeight = sh; lastSource = source; sourceRevision = p.sourceRevision ?? 0;
      lastBlur = NaN; pyramidReady = 0;
      stats.sourceUploads++;
    }
    const requestedBlur = readMotion(p.blurStrength ?? LIQUID_GLASS_MATERIAL.blurStrength);
    const blur = Number.isFinite(requestedBlur) ? Math.max(0, requestedBlur) : LIQUID_GLASS_MATERIAL.blurStrength;
    // Blur is in CSS pixels, independent of output DPR. Broad frost runs at a
    // lower resolution while retaining sigma <= 4 texels / 13 bilinear samples.
    const frostScale = Math.min(1, 4 / Math.max(blur, .5));
    const fw = Math.max(1, Math.round(p.width * frostScale)), fh = Math.max(1, Math.round(p.height * frostScale));
    const requestedTint = readMotion(p.tintStrength ?? LIQUID_GLASS_MATERIAL.tintStrength);
    const visibleFrost = !p.debug && (Number.isFinite(requestedTint) ? requestedTint : LIQUID_GLASS_MATERIAL.tintStrength) < 1;
    if (visibleFrost && blur > .5 && (lastBlur !== blur || frostViewWidth !== fw || frostViewHeight !== fh)) {
      const sigma = Math.min(4, blur * frostScale);
      const pairs = Math.ceil(Math.ceil(sigma * 3) / 2);
      kernel.fill(0); kernel[1] = 1;
      let total = 1;
      for (let i = 1; i <= pairs; i++) {
        const a = i * 2 - 1, b = a + 1;
        const wa = Math.exp(-a * a / (2 * sigma * sigma)), wb = Math.exp(-b * b / (2 * sigma * sigma));
        kernel[i * 2] = (a * wa + b * wb) / (wa + wb);
        kernel[i * 2 + 1] = wa + wb; total += 2 * (wa + wb);
      }
      for (let i = 0; i <= pairs; i++) kernel[i * 2 + 1] /= total;
      gl.useProgram(device.frostProgram);
      const f = device.frostUniforms;
      gl.uniform1i(f.uInput, 0); gl.uniform1i(f.uCount, pairs + 1);
      gl.uniform2fv(f["uKernel[0]"], kernel);
      gl.bindFramebuffer(gl.FRAMEBUFFER, device.framebuffer);
      // Retain storage at CSS resolution; the active blur viewport still shrinks
      // continuously. Morphs must not reallocate two textures on every frame.
      gl.activeTexture(gl.TEXTURE2);
      if (frostWidth < fw || frostHeight < fh) {
        frostWidth = Math.max(frostWidth, Math.ceil(p.width)); frostHeight = Math.max(frostHeight, Math.ceil(p.height));
        gl.bindTexture(gl.TEXTURE_2D, frostTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frostWidth, frostHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      if (device.scratchWidth < fw || device.scratchHeight < fh) {
        device.scratchWidth = Math.max(device.scratchWidth, Math.ceil(p.width)); device.scratchHeight = Math.max(device.scratchHeight, Math.ceil(p.height));
        gl.bindTexture(gl.TEXTURE_2D, device.scratch);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, device.scratchWidth, device.scratchHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      const frostPass = (input: WebGLTexture, scaleX: number, scaleY: number, output: WebGLTexture, width: number, height: number, axisX: number, axisY: number, copy: boolean) => {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, input);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
        gl.viewport(0, 0, width, height);
        gl.uniform2f(f.uInputScale, scaleX, scaleY);
        gl.uniform2f(f.uAxis, axisX, axisY);
        gl.uniform1i(f.uCopy, copy ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      // Paired bilinear taps require adjacent INPUT texels. Exact 2x box levels
      // are retained per source revision; one tap over a 4-9x reduction skipped
      // most texels, so moving text, grids and hatching made coarse frost flicker.
      let level = 0, lw = sw, lh = sh;
      // Levels are only sampled beyond a 2x reduction; a 2x source at light blur allocates none.
      if (sw > fw * 2 || sh > fh * 2) {
        if (pyramidWidth !== sw || pyramidHeight !== sh) {
          pyramid.forEach(level => gl.deleteTexture(level));
          pyramidSizes = frostPyramid(sw, sh); pyramidWidth = sw; pyramidHeight = sh; pyramidReady = 0;
          // One single-level texture per level: no mip feedback or completeness rules.
          gl.activeTexture(gl.TEXTURE0);
          pyramid = pyramidSizes.map(([width, height]) => {
            const level = createTexture(gl);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            return level;
          });
        }
        for (; (lw > fw * 2 || lh > fh * 2) && level < pyramidSizes.length; level++) {
          [lw, lh] = pyramidSizes[level];
          if (level >= pyramidReady) {
            frostPass(level ? pyramid[level - 1] : texture, 1, 1, pyramid[level], lw, lh, .25 / lw, .25 / lh, true);
            pyramidReady = level + 1;
          }
        }
      }
      let input = level ? pyramid[level - 1] : texture, scaleX = 1, scaleY = 1;
      if (lw !== fw || lh !== fh) {
        // Quadrant taps cover the whole output texel, including a final 1-2x step.
        frostPass(input, scaleX, scaleY, frostTexture, fw, fh, .25 / fw, .25 / fh, true);
        input = frostTexture; scaleX = fw / frostWidth; scaleY = fh / frostHeight;
      }
      frostPass(input, scaleX, scaleY, device.scratch, fw, fh, 1 / fw, 0, false);
      frostPass(device.scratch, fw / device.scratchWidth, fh / device.scratchHeight, frostTexture, fw, fh, 0, 1 / fh, false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(device.program);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
      frostViewWidth = fw; frostViewHeight = fh; lastBlur = blur;
    }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, frostTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    if (p.content && (lastContent !== p.content || contentRevision !== (p.contentRevision ?? 0))) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.content);
        gl.generateMipmap(gl.TEXTURE_2D);
      } finally { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
      lastContent = p.content; contentRevision = p.contentRevision ?? 0; stats.contentUploads++;
    }
    const prepared = geometry.prepare(p, ratio);
    if (!prepared) return false;
    const { count, clipped, regions, left, top, right, bottom } = prepared;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.uSourceSize, p.width, p.height);
    gl.uniform4f(u.uFrostUv, fw / Math.max(1, frostWidth), fh / Math.max(1, frostHeight), .5 / Math.max(1, frostWidth), .5 / Math.max(1, frostHeight));
    gl.uniform3fv(u["uBlobs[0]"], blobs);
    gl.uniform2fv(u["uHalfSize[0]"], sizes);
    gl.uniform1fv(u["uCornerRadius[0]"], corners);
    gl.uniform2fv(u["uVelocity[0]"], velocities);
    gl.uniform3fv(u["uContact[0]"], contacts);
    gl.uniform4fv(u["uContactInverse[0]"], contactInverses);
    gl.uniform2fv(u["uContactOffset[0]"], contactOffsets);
    gl.uniform4fv(u["uDome[0]"], domes);
    gl.uniform2fv(u["uBlobRefractionRatio[0]"], refractionRatios);
    gl.uniform4fv(u["uBounds[0]"], bounds);
    gl.uniform2f(u.uOutputSize, width, height);
    gl.uniform1i(u.uBlobCount, count);
    for (const key of scalarKeys) {
      const value = readMotion(p[key] ?? LIQUID_GLASS_MATERIAL[key]);
      gl.uniform1f(u[scalarUniforms[key]], Number.isFinite(value) ? value : LIQUID_GLASS_MATERIAL[key]);
    }
    const tint = p.tintColor ?? LIQUID_GLASS_MATERIAL.tintColor;
    gl.uniform3f(u.uTintColor, tint[0], tint[1], tint[2]);
    const refraction = p.refractionRatio ?? LIQUID_GLASS_MATERIAL.refractionRatio;
    gl.uniform2f(u.uRefractionRatio, refraction[0], refraction[1]);
    gl.uniform1f(u.uContentOpacity, p.content ? readMotion(p.contentOpacity ?? 0) : 0);
    gl.uniform1f(u.uContentRefraction, readMotion(p.contentRefraction ?? 0));
    gl.uniform1f(u.uContentBlur, readMotion(p.contentBlur ?? 0));
    gl.uniform1i(u.uContentSource, p.contentSpace === "source" ? 1 : 0);
    gl.uniform1i(u.uTransparentOutside, p.transparentOutside ? 1 : 0);
    gl.uniform1i(u.uDebug, p.debug ? 1 : 0);
    gl.uniform1i(u.uBevel, p.refractionModel === "bevel" ? 1 : 0);
    gl.uniform1i(u.uLens, p.refractionModel === "lens" ? 1 : 0);
    if (clipped) {
      const x0 = Math.max(0, Math.min(width, Math.floor(left * width / p.width))), y0 = Math.max(0, Math.min(height, Math.floor(top * height / p.height)));
      const x1 = Math.max(x0, Math.min(width, Math.ceil(right * width / p.width))), y1 = Math.max(y0, Math.min(height, Math.ceil(bottom * height / p.height)));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x0, height - y1, x1 - x0, y1 - y0);
    } else regions.push({ left: 0, top: 0, width: 1, height: 1 });
    try {
      // Copy the mask before the normal draw so direct canvases also end on their
      // visible material. Both paths share textures, frost and the merged SDF.
      if (presentHighlightHDR && !p.debug) {
        // Scrolling changes the substrate, not the SDF's emitted light. Retain the
        // HDR mask until geometry, material or foreground occlusion actually changes.
        let index = 0, changed = lastHighlight !== presentHighlightHDR || highlightContent !== p.content || highlightRevision !== p.contentRevision;
        const record = (value: number) => { if (!Object.is(highlightState[index], value)) changed = true; highlightState[index++] = value; };
        for (const values of [blobs, sizes, corners, velocities, contacts, contactInverses, contactOffsets, domes, refractionRatios]) for (const value of values) record(value);
        for (const key of scalarKeys) record(readMotion(p[key] ?? LIQUID_GLASS_MATERIAL[key]));
        for (const value of [width, height, p.width, p.height, count, ...refraction, readMotion(p.contentOpacity ?? 0), readMotion(p.contentRefraction ?? 0), readMotion(p.contentBlur ?? 0), Number(p.contentSpace === "source")]) record(value);
        if (changed) {
          gl.uniform1i(u.uEmissionOnly, 1); gl.drawArrays(gl.TRIANGLES, 0, 6);
          presentHighlightHDR(device.canvas, { x: 0, y: sourceTop, width, height }); stats.emissionDraws++;
          lastHighlight = presentHighlightHDR; highlightContent = p.content; highlightRevision = p.contentRevision;
        }
      } else lastHighlight = undefined;
      gl.uniform1i(u.uEmissionOnly, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } finally { gl.disable(gl.SCISSOR_TEST); }
    if (output) {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      output.clearRect(0, 0, width, height);
      output.drawImage(device.canvas, 0, sourceTop, width, height, 0, 0, width, height);
    }
    stats.draws++;
    if (previousWidth !== width || previousHeight !== height) previousRegions = [{ left: 0, top: 0, width: 1, height: 1 }];
    // Separate bodies must not invalidate the empty corners between them. Include
    // their previous positions too, so glass behind a departing body stays live.
    const changed = [...previousRegions, ...regions];
    previousRegions = regions; previousWidth = width; previousHeight = height;
    notifyLiquidFrame(canvas, changed);
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (onRestore) device.listeners.delete(onRestore);
    if (texture) gl.deleteTexture(texture);
    if (contentTexture) gl.deleteTexture(contentTexture);
    if (frostTexture) gl.deleteTexture(frostTexture);
    pyramid.forEach(level => gl.deleteTexture(level));
    if (--device.users === 0) {
      if (sharedDevice === device) sharedDevice = undefined;
      destroyDevice(device);
    }
  }
  return { draw, dispose, stats, context: gl };
}
