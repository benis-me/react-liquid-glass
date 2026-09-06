import { computeDomeConstants } from "../math";
import { contactTransform } from "../shared/contact";
import { readMotion, type MotionInput } from "../shared/values";

const MAX_BLOBS = 8;
const frameListeners = new Set<(canvas: HTMLCanvasElement) => void>();
export function subscribeLiquidFrames(listener: (canvas: HTMLCanvasElement) => void) {
  frameListeners.add(listener);
  return () => { frameListeners.delete(listener); };
}
export interface LiquidGlassBlob {
  /** Normalized center coordinates in the source, from 0 to 1. */
  x: MotionInput;
  y: MotionInput;
  /** Radius in CSS pixels. */
  radius: MotionInput;
  /** Optional rounded-rectangle half extents. Omit both for a circle. */
  halfWidth?: MotionInput;
  halfHeight?: MotionInput;
  /** Optional rounded-rectangle corner radius. Defaults to `radius`. */
  cornerRadius?: MotionInput;
  /** Optional CSS-pixel velocity used for squash and stretch. */
  velocityX?: MotionInput;
  velocityY?: MotionInput;
  /** Live light position relative to the lens center, normalized to -1..1. */
  contactX?: MotionInput;
  contactY?: MotionInput;
  /** Original grip stays fixed while the light follows the pointer. */
  anchorX?: MotionInput;
  anchorY?: MotionInput;
  contactStrength?: MotionInput;
  /** Resisted grip displacement in CSS pixels. */
  pullX?: MotionInput;
  pullY?: MotionInput;
}


export type LiquidGlassSource = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;

/** The accepted menu material. Geometry, interaction and substrates stay independent. */
export const LIQUID_GLASS_MATERIAL = Object.freeze({
  mergeDistance: 40, refractionStrength: .11, chromaAmount: .55,
  specularStrength: .72, blurStrength: .5, edgeDepth: 10, domeDepth: 58,
  brightness: .015, specularRotation: 90, glowStrength: .30, glowSpread: .72,
  glowExponent: 1.4, edgeStrength: .36, edgeWidth: 1.6, edgeExponent: 1.2,
  tintColor: [1, 1, 1] as readonly [number, number, number], tintStrength: .055,
  magnification: 1, shadowStrength: .11, shadowOffset: 18, shadowBlur: 26,
  opacity: 1, refractionRatio: [1, 1] as readonly [number, number],
});

export interface LiquidGlassFrame {
  source: LiquidGlassSource;
  /** Change only when the source's pixels change, not when its lens moves. */
  sourceRevision?: number;
  content?: HTMLCanvasElement | null;
  contentRevision?: number;
  contentOpacity?: MotionInput;
  contentRefraction?: MotionInput;
  contentBlur?: MotionInput;
  width: number;
  height: number;
  blobs: readonly LiquidGlassBlob[];
  mergeDistance?: MotionInput;
  refractionStrength?: MotionInput;
  refractionRatio?: readonly [number, number];
  chromaAmount?: number;
  specularStrength?: MotionInput;
  blurStrength?: MotionInput;
  edgeDepth?: MotionInput;
  domeDepth?: number;
  brightness?: number;
  specularRotation?: number;
  glowStrength?: number;
  glowSpread?: number;
  glowExponent?: number;
  edgeStrength?: number;
  edgeWidth?: number;
  edgeExponent?: number;
  tintColor?: readonly [number, number, number];
  tintStrength?: MotionInput;
  magnification?: MotionInput;
  shadowStrength?: MotionInput;
  shadowOffset?: number;
  shadowBlur?: number;
  opacity?: MotionInput;
  transparentOutside?: boolean;
  /** Visualize this exact shader's live displacement and coverage, without CPU maps. */
  debug?: boolean;
  pixelRatio?: number;
}
export interface LiquidRendererStats {
  draws: number;
  emissionDraws: number;
  sourceUploads: number;
  contentUploads: number;
}
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
uniform sampler2D uContent;
uniform float uContentOpacity;
uniform float uContentRefraction;
uniform float uContentBlur;
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
uniform float uOpacity;
uniform bool uTransparentOutside;
uniform bool uDebug;

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

float erfApprox(float value) {
  return tanh(1.7724538509 * value);
}

vec3 sampleChroma(sampler2D source, vec2 uv, vec2 displacement) {
  return vec3(
    texture(source, uv - displacement * (1. + .2 * uChroma)).r,
    texture(source, uv - displacement * (1. + .1 * uChroma)).g,
    texture(source, uv - displacement).b
  );
}

vec3 sampleGlass(vec2 uv, vec2 displacement) {
  if (uBlur <= .001) return sampleChroma(uSource, uv, displacement);
  if (uBlur >= .75) return sampleChroma(uFrostSource, uv, displacement);
  // Keep core Glass's chroma offsets inside every sample of the frost
  // instead of replacing them with one achromatic blur.
  vec2 stepSize = vec2(uBlur * 1.34) / uSourceSize;
  vec3 frosted = sampleChroma(uSource, uv, displacement) * .2;
  frosted += sampleChroma(uSource, uv + vec2(stepSize.x, 0.), displacement) * .12;
  frosted += sampleChroma(uSource, uv - vec2(stepSize.x, 0.), displacement) * .12;
  frosted += sampleChroma(uSource, uv + vec2(0., stepSize.y), displacement) * .12;
  frosted += sampleChroma(uSource, uv - vec2(0., stepSize.y), displacement) * .12;
  frosted += sampleChroma(uSource, uv + stepSize, displacement) * .08;
  frosted += sampleChroma(uSource, uv - stepSize, displacement) * .08;
  frosted += sampleChroma(uSource, uv + vec2(stepSize.x, -stepSize.y), displacement) * .08;
  frosted += sampleChroma(uSource, uv + vec2(-stepSize.x, stepSize.y), displacement) * .08;
  // Keep the fine-frost endpoint exact, with no optical step during a morph.
  return uBlur > .5 ? mix(frosted, sampleChroma(uFrostSource, uv, displacement), smoothstep(.5, .75, uBlur)) : frosted;
}

vec4 sampleContent(vec2 uv) {
  if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return vec4(0.);
  // Prefilter glyphs instead of spacing discrete taps far enough to duplicate strokes.
  return texture(uContent, uv, log2(1. + uContentBlur * 2.));
}

void main() {
  vec4 raw = texture(uSource, vUv);
  if (uBlobCount < 1) {
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
  if (uTint >= 1. && uContentOpacity <= .001 && !uDebug && !uEmissionOnly) {
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
  for (int index = 0; index < 8; index++) {
    if (index >= uBlobCount) break;
    float blobDistance = movingBlobSdf(
      point,
      uBlobs[index],
      uHalfSize[index],
      uCornerRadius[index],
      uVelocity[index],
      index,
      0.
    );
    float weight = exp(-max(blobDistance - distance, 0.) / blendRadius);
    vec2 local = movingBlobLocal(point, uBlobs[index], uVelocity[index], index);
    vec2 extent = max(uHalfSize[index], vec2(1.));
    if (uContact[index].z > .001) {
      vec2 finger = point - uBlobs[index].xy - uContact[index].xy * extent;
      float radius = clamp(min(extent.x, extent.y) * 1.1, 12., 54.);
      float spread = exp(-dot(finger, finger) / (radius * radius));
      float crest = exp(-dot(finger, finger) / (radius * radius * .09));
      contactLight += uContact[index].z * weight * (spread * (.16 + .5 * falloff) + crest * .26);
    }
    vec2 normalizedLocal = clamp(local / extent, vec2(-1.), vec2(1.));
    vec2 gradient = normalizedLocal;
    if (uDomeDepth > .001) {
      vec4 dome = uDome[index];
      vec2 capped = min(abs(local), dome.xy * .999);
      vec2 denominator = sqrt(max(dome.xy * dome.xy - capped * capped, vec2(.001)));
      gradient = sign(local) * capped / denominator * dome.zw;
    }
    glassGradient += gradient * weight;
    materialUv += normalizedLocal * weight;
    materialWeight += weight;
  }
  glassGradient /= max(materialWeight, .001);
  materialUv /= max(materialWeight, .001);
  contactLight /= max(materialWeight, .001);
  // Core Glass uses objectBoundingBox primitive units: channel delta is half the scale.
  vec2 displacement = glassGradient * (uRefraction * .5 * falloff);
  displacement *= coverage * uZoom * uRefractionRatio;
  if (uDebug) {
    outputColor = vec4(mix(vec3(.5), vec3(.5 + displacement * 4., coverage), coverage), 1.);
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
  // Confine the fine reflection to the upper/lower arcs, not the sidewalls.
  float reflectionLight = smoothstep(.75, .98, edgeLight);
  float edgeGain = max(uEdgeStrength * uSpecular, 0.);
  float contourStrength = min(.85, edgeGain * 3.2) * mix(.85, .24, edgeLight);
  float rimLight = reflection * reflectionLight * edgeGain;
  float brightnessAmount = clamp(abs(uBrightness), 0., 1.);
  vec4 ink = vec4(0.);
  if (uContentOpacity > .001) {
    vec2 extent = max(uHalfSize[0] * 2., vec2(1.));
    vec2 local = movingBlobLocal(point, uBlobs[0], uVelocity[0], 0);
    // Reuse the live merged optical field; only the peripheral ink is stretched.
    float edgeFocus = 1. - smoothstep(0., max(uDepth * 2., 1.), inside);
    vec2 contentUv = .5 + (local - displacement * uSourceSize * .42 * uContentRefraction * edgeFocus) / extent;
    ink = sampleContent(contentUv) * uContentOpacity;
  }
  // The same fine crest and contact field feed HDR. No frost pass is repeated,
  // and foreground ink, opaque thumbs and SDF coverage still occlude the light.
  if (uEmissionOnly) {
    float visibility = coverage * uOpacity * (1. - clamp(uTint, 0., 1.)) * (1. - ink.a);
    outputColor = vec4(vec3(contactLight, rimLight * (1. - brightnessAmount), 0.) * visibility, 1.);
    return;
  }
  vec3 refracted = sampleGlass(vUv, displacement);
  // Video's highlight response preserves contrast on both bright and dark substrates.
  float luminance = dot(refracted, vec3(.299, .587, .114));
  float shine = specular * uSpecular * (127. / 255.);
  refracted = mix(refracted + vec3(shine), refracted * (1. - shine), smoothstep(.3, .7, luminance));
  refracted *= 1. - contour * contourStrength;
  refracted += vec3(rimLight * .22);
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
uniform vec2 uAxis;
uniform vec2 uKernel[8];
uniform int uCount;
uniform bool uCopy;
void main() {
  // FBO textures keep their row order; only the final canvas flips the HTML UV.
  vec2 uv = vec2(vUv.x, 1. - vUv.y);
  if (uCopy) { outputColor = texture(uInput, uv); return; }
  vec4 color = texture(uInput, uv) * uKernel[0].y;
  for (int i = 1; i < 8; i++) {
    if (i >= uCount) break;
    vec2 offset = uAxis * uKernel[i].x;
    color += (texture(uInput, uv + offset) + texture(uInput, uv - offset)) * uKernel[i].y;
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
  "uSource", "uFrostSource", "uContent", "uContentOpacity", "uContentRefraction", "uContentBlur",
  "uSourceSize", "uBlobs[0]", "uHalfSize[0]", "uCornerRadius[0]", "uVelocity[0]",
  "uContact[0]", "uContactInverse[0]", "uContactOffset[0]", "uEmissionOnly",
  "uDome[0]", "uBlobCount", "uMergeDistance", "uRefraction", "uRefractionRatio",
  "uChroma", "uSpecular", "uBlur", "uDepth", "uDomeDepth", "uBrightness",
  "uSpecularRotation", "uGlowStrength", "uGlowSpread", "uGlowExponent",
  "uEdgeStrength", "uEdgeWidth", "uEdgeExponent", "uTintColor", "uTint", "uZoom",
  "uShadow", "uShadowOffset", "uShadowBlur", "uOpacity", "uTransparentOutside", "uDebug",
] as const;
const scalarUniforms = {
  mergeDistance: "uMergeDistance", refractionStrength: "uRefraction",
  chromaAmount: "uChroma", specularStrength: "uSpecular", blurStrength: "uBlur",
  edgeDepth: "uDepth", domeDepth: "uDomeDepth", brightness: "uBrightness",
  specularRotation: "uSpecularRotation", glowStrength: "uGlowStrength",
  glowSpread: "uGlowSpread", glowExponent: "uGlowExponent", edgeStrength: "uEdgeStrength",
  edgeWidth: "uEdgeWidth", edgeExponent: "uEdgeExponent", tintStrength: "uTint",
  magnification: "uZoom", shadowStrength: "uShadow", shadowOffset: "uShadowOffset",
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
  const frostUniforms = Object.fromEntries(["uInput", "uAxis", "uKernel[0]", "uCount", "uCopy"].map(name => [name, gl.getUniformLocation(frostProgram, name)]));
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
}

/**
 * React-free rendering API. Small/DOM surfaces share one GPU context; media can
 * render directly to their canvas to avoid a full-frame copy on each video frame.
 */
export function createLiquidGlassRenderer(
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
  const blobs = new Float32Array(MAX_BLOBS * 3);
  const sizes = new Float32Array(MAX_BLOBS * 2);
  const corners = new Float32Array(MAX_BLOBS);
  const velocities = new Float32Array(MAX_BLOBS * 2);
  const contacts = new Float32Array(MAX_BLOBS * 3);
  const contactInverses = new Float32Array(MAX_BLOBS * 4);
  const contactOffsets = new Float32Array(MAX_BLOBS * 2);
  const domes = new Float32Array(MAX_BLOBS * 4);
  let lastSource: LiquidGlassSource | undefined;
  let sourceRevision: number | undefined;
  let sourceWidth = 0, sourceHeight = 0;
  let lastBlur = NaN, frostWidth = 0, frostHeight = 0;
  const kernel = new Float32Array(16);
  let lastContent: HTMLCanvasElement | undefined;
  let contentRevision: number | undefined;
  let disposed = false;
  const stats: LiquidRendererStats = { draws: 0, emissionDraws: 0, sourceUploads: 0, contentUploads: 0 };

  function draw(p: LiquidGlassFrame, presentHighlightHDR?: (mask: HTMLCanvasElement) => void) {
    if (disposed || gl.isContextLost() || !Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width <= 0 || p.height <= 0) return false;
    const source = p.source;
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
      version = device.version;
    }
    const requestedRatio = p.pixelRatio ?? window.devicePixelRatio ?? 1;
    const ratio = Number.isFinite(requestedRatio) ? Math.max(.5, Math.min(2.5, requestedRatio)) : 1;
    const width = Math.max(1, Math.round(p.width * ratio));
    const height = Math.max(1, Math.round(p.height * ratio));
    if (device.canvas.width !== width) device.canvas.width = width;
    if (device.canvas.height !== height) device.canvas.height = height;
    gl.useProgram(device.program);
    gl.bindVertexArray(device.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (lastSource !== source || sourceRevision !== (p.sourceRevision ?? 0) || sw !== sourceWidth || sh !== sourceHeight) {
      if (sw !== sourceWidth || sh !== sourceHeight) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
      sourceWidth = sw; sourceHeight = sh; lastSource = source; sourceRevision = p.sourceRevision ?? 0;
      lastBlur = NaN;
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
    if (visibleFrost && blur > .5 && (lastBlur !== blur || frostWidth !== fw || frostHeight !== fh)) {
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
      gl.viewport(0, 0, fw, fh);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, frostTexture);
      if (frostWidth !== fw || frostHeight !== fh) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      if (fw !== sw || fh !== sh) {
        // Paired bilinear taps require adjacent INPUT texels. Resolve the source
        // to the blur grid first, otherwise 2x DOM ink develops alternating bands.
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frostTexture, 0);
        gl.uniform1i(f.uCopy, 1); gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, frostTexture);
      }
      gl.uniform1i(f.uCopy, 0);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, device.scratch);
      if (device.scratchWidth !== fw || device.scratchHeight !== fh) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        device.scratchWidth = fw; device.scratchHeight = fh;
      }
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, device.scratch, 0);
      gl.uniform2f(f.uAxis, 1 / fw, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, device.scratch);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, frostTexture);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frostTexture, 0);
      gl.uniform2f(f.uAxis, 0, 1 / fh);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(device.program);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
      frostWidth = fw; frostHeight = fh; lastBlur = blur;
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
    const count = Math.min(MAX_BLOBS, p.blobs.length);
    for (let i = 0; i < count; i++) {
      const b = p.blobs[i];
      const radius = Math.max(0, readMotion(b.radius));
      blobs[i*3] = readMotion(b.x) * p.width;
      blobs[i*3+1] = readMotion(b.y) * p.height;
      blobs[i*3+2] = radius;
      sizes[i*2] = Math.max(.001, readMotion(b.halfWidth ?? radius));
      sizes[i*2+1] = Math.max(.001, readMotion(b.halfHeight ?? radius));
      corners[i] = Math.max(0, readMotion(b.cornerRadius ?? radius));
      velocities[i*2] = readMotion(b.velocityX ?? 0);
      velocities[i*2+1] = readMotion(b.velocityY ?? 0);
      if (![blobs[i*3], blobs[i*3+1], radius, sizes[i*2], sizes[i*2+1], corners[i], velocities[i*2], velocities[i*2+1]].every(Number.isFinite)) return false;
      const cx = readMotion(b.contactX ?? 0), cy = readMotion(b.contactY ?? 0), strength = readMotion(b.contactStrength ?? 0);
      const ax = readMotion(b.anchorX ?? cx), ay = readMotion(b.anchorY ?? cy);
      const px = readMotion(b.pullX ?? 0), py = readMotion(b.pullY ?? 0);
      if (![cx, cy, ax, ay, strength, px, py].every(Number.isFinite)) return false;
      contacts.set([Math.max(-1, Math.min(1, cx)), Math.max(-1, Math.min(1, cy)), Math.max(0, Math.min(1, strength))], i * 3);
      const [m00, m10, m01, m11, tx, ty] = contactTransform(sizes[i*2] * 2, sizes[i*2+1] * 2, ax, ay, px, py);
      const determinant = m00 * m11 - m01 * m10;
      contactInverses.set([m11 / determinant, -m10 / determinant, -m01 / determinant, m00 / determinant], i * 4);
      contactOffsets.set([tx, ty], i * 2);
      const dome = computeDomeConstants(p.domeDepth ?? LIQUID_GLASS_MATERIAL.domeDepth, sizes[i*2], sizes[i*2+1]);
      domes[i*4] = dome.Rx; domes[i*4+1] = dome.Ry;
      domes[i*4+2] = dome.scaleX; domes[i*4+3] = dome.scaleY;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.uSourceSize, p.width, p.height);
    gl.uniform3fv(u["uBlobs[0]"], blobs);
    gl.uniform2fv(u["uHalfSize[0]"], sizes);
    gl.uniform1fv(u["uCornerRadius[0]"], corners);
    gl.uniform2fv(u["uVelocity[0]"], velocities);
    gl.uniform3fv(u["uContact[0]"], contacts);
    gl.uniform4fv(u["uContactInverse[0]"], contactInverses);
    gl.uniform2fv(u["uContactOffset[0]"], contactOffsets);
    gl.uniform4fv(u["uDome[0]"], domes);
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
    gl.uniform1i(u.uTransparentOutside, p.transparentOutside ? 1 : 0);
    gl.uniform1i(u.uDebug, p.debug ? 1 : 0);
    // Copy the mask before the normal draw so direct canvases also end on their
    // visible material. Both paths share textures, frost and the merged SDF.
    if (presentHighlightHDR && !p.debug) {
      gl.uniform1i(u.uEmissionOnly, 1); gl.drawArrays(gl.TRIANGLES, 0, 6);
      presentHighlightHDR(device.canvas); stats.emissionDraws++;
    }
    gl.uniform1i(u.uEmissionOnly, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (output) {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      output.clearRect(0, 0, width, height);
      output.drawImage(device.canvas, 0, 0);
    }
    stats.draws++;
    for (const listener of frameListeners) listener(canvas);
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (onRestore) device.listeners.delete(onRestore);
    if (texture) gl.deleteTexture(texture);
    if (contentTexture) gl.deleteTexture(contentTexture);
    if (frostTexture) gl.deleteTexture(frostTexture);
    if (--device.users === 0) {
      if (sharedDevice === device) sharedDevice = undefined;
      destroyDevice(device);
    }
  }
  return { draw, dispose, stats, context: gl };
}
