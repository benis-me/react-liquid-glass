import { useCallback, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { cancelFrame, frame } from "motion";
import { computeDomeConstants } from "./math";
import { isMotionValue, readMotion, type MotionInput } from "./motion";

const MAX_BLOBS = 4;

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
}

export interface LiquidGlassCanvasProps {
  sourceRef: RefObject<HTMLCanvasElement | HTMLImageElement | null>;
  width: number;
  height: number;
  blobs: readonly LiquidGlassBlob[];
  /** Smooth-union width in CSS pixels. Two surfaces bridge across roughly half this value. */
  mergeDistance?: MotionInput;
  /** Core Glass-compatible normalized refraction scale. */
  refractionStrength?: MotionInput;
  chromaAmount?: number;
  specularStrength?: MotionInput;
  blurStrength?: MotionInput;
  /** Matches the core Glass inner rounded-rect falloff depth. */
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
  /** RGB tint target with channels in the 0–1 range. */
  tintColor?: readonly [number, number, number];
  tintStrength?: MotionInput;
  magnification?: MotionInput;
  shadowStrength?: MotionInput;
  sourceRevision?: number;
  pixelRatio?: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
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
uniform vec2 uSourceSize;
uniform vec3 uBlobs[4];
uniform vec2 uHalfSize[4];
uniform float uCornerRadius[4];
uniform vec2 uVelocity[4];
uniform int uBlobCount;
uniform float uMergeDistance;
uniform float uRefraction;
uniform float uChroma;
uniform float uSpecular;
uniform float uBlur;
uniform float uDepth;
uniform vec4 uDome[4];
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

float smoothMin(float a, float b, float radius) {
  float k = max(radius, .001);
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}

vec2 movingBlobLocal(vec2 point, vec3 blob, vec2 velocity) {
  float speed = clamp(length(velocity) / 1100., 0., 1.);
  vec2 direction = speed > .001 ? normalize(velocity) : vec2(1., 0.);
  vec2 tangent = vec2(-direction.y, direction.x);
  vec2 delta = point - blob.xy;
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
  float inset
) {
  vec2 deformed = movingBlobLocal(point, blob, velocity);
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
    inset
  );
  for (int index = 1; index < 4; index++) {
    if (index >= uBlobCount) break;
    float next = movingBlobSdf(
      point,
      uBlobs[index],
      uHalfSize[index],
      uCornerRadius[index],
      uVelocity[index],
      inset
    );
    distance = smoothMin(distance, next, uMergeDistance);
  }
  return distance;
}

float erfApprox(float value) {
  return tanh(1.7724538509 * value);
}

vec3 sampleChroma(vec2 uv, vec2 displacement) {
  return vec3(
    texture(uSource, uv - displacement * (1. + .2 * uChroma)).r,
    texture(uSource, uv - displacement * (1. + .1 * uChroma)).g,
    texture(uSource, uv - displacement).b
  );
}

vec3 sampleGlass(vec2 uv, vec2 displacement) {
  if (uBlur <= .001) return sampleChroma(uv, displacement);
  // Keep core Glass's chroma offsets inside every sample of the frost
  // instead of replacing them with one achromatic blur.
  vec2 stepSize = vec2(uBlur * 1.34) / uSourceSize;
  vec3 frosted = sampleChroma(uv, displacement) * .2;
  frosted += sampleChroma(uv + vec2(stepSize.x, 0.), displacement) * .12;
  frosted += sampleChroma(uv - vec2(stepSize.x, 0.), displacement) * .12;
  frosted += sampleChroma(uv + vec2(0., stepSize.y), displacement) * .12;
  frosted += sampleChroma(uv - vec2(0., stepSize.y), displacement) * .12;
  frosted += sampleChroma(uv + stepSize, displacement) * .08;
  frosted += sampleChroma(uv - stepSize, displacement) * .08;
  frosted += sampleChroma(uv + vec2(stepSize.x, -stepSize.y), displacement) * .08;
  frosted += sampleChroma(uv + vec2(-stepSize.x, stepSize.y), displacement) * .08;
  return frosted;
}

void main() {
  vec4 raw = texture(uSource, vUv);
  if (uBlobCount < 1) {
    outputColor = raw;
    return;
  }

  vec2 point = vUv * uSourceSize;
  float distance = sceneSdf(point, 0.);
  float shadowDistance = sceneSdf(point - vec2(0., 18.), 0.);
  if (distance > 18. && shadowDistance > 78.) {
    outputColor = raw;
    return;
  }

  float aa = max(fwidth(distance), .0001);
  float coverage = 1. - smoothstep(-aa, aa, distance);
  // Blur the signed silhouette instead of leaving a solid offset umbra.
  float shadowFalloff = .5 * (1. - erfApprox(shadowDistance / (26. * 1.41421356237)));
  float outsideShadow = (1. - coverage) * shadowFalloff * uShadow;
  vec3 color = raw.rgb * (1. - outsideShadow);
  if (coverage <= .001) {
    outputColor = vec4(color, raw.a);
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
  for (int index = 0; index < 4; index++) {
    if (index >= uBlobCount) break;
    float blobDistance = movingBlobSdf(
      point,
      uBlobs[index],
      uHalfSize[index],
      uCornerRadius[index],
      uVelocity[index],
      0.
    );
    float weight = exp(-max(blobDistance - distance, 0.) / blendRadius);
    vec2 local = movingBlobLocal(point, uBlobs[index], uVelocity[index]);
    vec2 extent = max(uHalfSize[index], vec2(1.));
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
  // Core Glass uses objectBoundingBox primitive units: channel delta is half the scale.
  vec2 displacement = glassGradient * (uRefraction * .5 * falloff);
  displacement *= coverage * uZoom;

  vec3 refracted = sampleGlass(vUv, displacement);
  float theta = radians(uSpecularRotation);
  vec2 light = vec2(cos(theta), sin(theta));
  float align = abs(dot(materialUv, light));
  float glowLo = (1. - uGlowSpread) * 1.41421356237;
  float glowSpan = max(uGlowSpread * 1.41421356237, .001);
  float glow = uGlowStrength
    * pow(clamp((align - glowLo) / glowSpan, 0., 1.), uGlowExponent)
    * falloff;
  float rim = max(0., 1. - inside / max(uEdgeWidth, .001));
  float edge = uEdgeStrength * rim;
  float specular = min(1., glow + edge);
  // Opposed highlights follow the light axis, with dark sides across it.
  // Normalize local direction so the bright lobes peak at each edge's center.
  float edgeLight = pow(clamp(align / max(length(materialUv), .001), 0., 1.), uEdgeExponent);
  float edgeShare = edge / max(glow + edge, .001);
  // Video's highlight response preserves contrast on both bright and dark substrates.
  float luminance = dot(refracted, vec3(.299, .587, .114));
  float shine = specular * uSpecular * (127. / 255.);
  refracted = mix(
    refracted + vec3(shine),
    refracted * (1. - shine),
    mix(smoothstep(.3, .7, luminance), 1. - edgeLight, edgeShare)
  );
  float brightnessAmount = clamp(abs(uBrightness), 0., 1.);
  vec3 brightnessTarget = uBrightness >= 0. ? vec3(1.) : vec3(0.);
  refracted = mix(refracted, brightnessTarget, brightnessAmount);
  refracted = mix(refracted, uTintColor, clamp(uTint, 0., 1.));
  color = mix(raw.rgb, refracted, coverage);
  outputColor = vec4(color, raw.a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create liquid-glass shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Liquid-glass shader compilation failed");
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

export function LiquidGlassCanvas({
  sourceRef,
  width,
  height,
  blobs,
  mergeDistance = 40,
  refractionStrength = 0.11,
  chromaAmount = 0.24,
  specularStrength = 0.56,
  blurStrength = 0,
  edgeDepth = 10,
  domeDepth = 0,
  brightness = 0,
  specularRotation = 45,
  glowStrength = 0.1,
  glowSpread = 0.42,
  glowExponent = 1.5,
  edgeStrength = 0.2,
  edgeWidth = 1.5,
  edgeExponent = 1.2,
  tintColor = [1, 1, 1],
  tintStrength = 0.055,
  magnification = 1,
  shadowStrength = 0.13,
  sourceRevision = 0,
  pixelRatio,
  className,
  style,
  ariaLabel = "Liquid glass surface",
}: LiquidGlassCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const textureDirtyRef = useRef(true);
  const configRef = useRef({
    width,
    height,
    blobs,
    mergeDistance,
    refractionStrength,
    chromaAmount,
    specularStrength,
    blurStrength,
    edgeDepth,
    domeDepth,
    brightness,
    specularRotation,
    glowStrength,
    glowSpread,
    glowExponent,
    edgeStrength,
    edgeWidth,
    edgeExponent,
    tintColor,
    tintStrength,
    magnification,
    shadowStrength,
  });
  configRef.current = {
    width,
    height,
    blobs,
    mergeDistance,
    refractionStrength,
    chromaAmount,
    specularStrength,
    blurStrength,
    edgeDepth,
    domeDepth,
    brightness,
    specularRotation,
    glowStrength,
    glowSpread,
    glowExponent,
    edgeStrength,
    edgeWidth,
    edgeExponent,
    tintColor,
    tintStrength,
    magnification,
    shadowStrength,
  };

  const ratio = Math.max(
    1,
    Math.min(2, pixelRatio ?? (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)),
  );
  const renderWidth = Math.max(1, Math.round(width * ratio));
  const renderHeight = Math.max(1, Math.round(height * ratio));

  const drawFrame = useCallback(() => drawRef.current(), []);
  // Flush with Motion's DOM render after derived values update, without an extra RAF of latency.
  const scheduleDraw = useCallback(() => {
    frame.render(drawFrame);
  }, [drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The SDF supplies coverage AA, as in Video; MSAA only multisamples the full-screen quad.
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Liquid-glass program link failed");
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = createTexture(gl);
    const uniforms = {
      source: gl.getUniformLocation(program, "uSource"),
      sourceSize: gl.getUniformLocation(program, "uSourceSize"),
      blobs: gl.getUniformLocation(program, "uBlobs[0]"),
      halfSize: gl.getUniformLocation(program, "uHalfSize[0]"),
      cornerRadius: gl.getUniformLocation(program, "uCornerRadius[0]"),
      velocity: gl.getUniformLocation(program, "uVelocity[0]"),
      blobCount: gl.getUniformLocation(program, "uBlobCount"),
      mergeDistance: gl.getUniformLocation(program, "uMergeDistance"),
      refraction: gl.getUniformLocation(program, "uRefraction"),
      chroma: gl.getUniformLocation(program, "uChroma"),
      specular: gl.getUniformLocation(program, "uSpecular"),
      blur: gl.getUniformLocation(program, "uBlur"),
      depth: gl.getUniformLocation(program, "uDepth"),
      dome: gl.getUniformLocation(program, "uDome[0]"),
      domeDepth: gl.getUniformLocation(program, "uDomeDepth"),
      brightness: gl.getUniformLocation(program, "uBrightness"),
      specularRotation: gl.getUniformLocation(program, "uSpecularRotation"),
      glowStrength: gl.getUniformLocation(program, "uGlowStrength"),
      glowSpread: gl.getUniformLocation(program, "uGlowSpread"),
      glowExponent: gl.getUniformLocation(program, "uGlowExponent"),
      edgeStrength: gl.getUniformLocation(program, "uEdgeStrength"),
      edgeWidth: gl.getUniformLocation(program, "uEdgeWidth"),
      edgeExponent: gl.getUniformLocation(program, "uEdgeExponent"),
      tintColor: gl.getUniformLocation(program, "uTintColor"),
      tint: gl.getUniformLocation(program, "uTint"),
      zoom: gl.getUniformLocation(program, "uZoom"),
      shadow: gl.getUniformLocation(program, "uShadow"),
    };
    gl.uniform1i(uniforms.source, 0);
    textureDirtyRef.current = true;

    const blobData = new Float32Array(MAX_BLOBS * 3);
    const halfSizeData = new Float32Array(MAX_BLOBS * 2);
    const cornerRadiusData = new Float32Array(MAX_BLOBS);
    const velocityData = new Float32Array(MAX_BLOBS * 2);
    const domeData = new Float32Array(MAX_BLOBS * 4);
    const draw = () => {
      const source = sourceRef.current;
      if (!source || source.width === 0 || source.height === 0) return;
      const config = configRef.current;
      const count = Math.min(MAX_BLOBS, config.blobs.length);

      if (textureDirtyRef.current) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        } catch {
          return;
        }
        textureDirtyRef.current = false;
      }

      blobData.fill(0);
      halfSizeData.fill(0);
      cornerRadiusData.fill(0);
      velocityData.fill(0);
      domeData.fill(0);
      for (let index = 0; index < count; index++) {
        const blob = config.blobs[index];
        const radius = Math.max(1, readMotion(blob.radius));
        blobData[index * 3] = readMotion(blob.x) * config.width;
        blobData[index * 3 + 1] = readMotion(blob.y) * config.height;
        blobData[index * 3 + 2] = radius;
        halfSizeData[index * 2] = Math.max(1, readMotion(blob.halfWidth ?? radius));
        halfSizeData[index * 2 + 1] = Math.max(1, readMotion(blob.halfHeight ?? radius));
        cornerRadiusData[index] = Math.max(0, readMotion(blob.cornerRadius ?? radius));
        velocityData[index * 2] = readMotion(blob.velocityX ?? 0);
        velocityData[index * 2 + 1] = readMotion(blob.velocityY ?? 0);
        const dome = computeDomeConstants(
          config.domeDepth,
          halfSizeData[index * 2],
          halfSizeData[index * 2 + 1],
        );
        domeData[index * 4] = dome.Rx;
        domeData[index * 4 + 1] = dome.Ry;
        domeData[index * 4 + 2] = dome.scaleX;
        domeData[index * 4 + 3] = dome.scaleY;
      }

      gl.viewport(0, 0, renderWidth, renderHeight);
      gl.uniform2f(uniforms.sourceSize, config.width, config.height);
      gl.uniform3fv(uniforms.blobs, blobData);
      gl.uniform2fv(uniforms.halfSize, halfSizeData);
      gl.uniform1fv(uniforms.cornerRadius, cornerRadiusData);
      gl.uniform2fv(uniforms.velocity, velocityData);
      gl.uniform4fv(uniforms.dome, domeData);
      gl.uniform1i(uniforms.blobCount, count);
      gl.uniform1f(uniforms.mergeDistance, readMotion(config.mergeDistance));
      gl.uniform1f(uniforms.refraction, readMotion(config.refractionStrength));
      gl.uniform1f(uniforms.chroma, config.chromaAmount);
      gl.uniform1f(uniforms.specular, readMotion(config.specularStrength));
      gl.uniform1f(uniforms.blur, readMotion(config.blurStrength));
      gl.uniform1f(uniforms.depth, readMotion(config.edgeDepth));
      gl.uniform1f(uniforms.domeDepth, config.domeDepth);
      gl.uniform1f(uniforms.brightness, config.brightness);
      gl.uniform1f(uniforms.specularRotation, config.specularRotation);
      gl.uniform1f(uniforms.glowStrength, config.glowStrength);
      gl.uniform1f(uniforms.glowSpread, config.glowSpread);
      gl.uniform1f(uniforms.glowExponent, config.glowExponent);
      gl.uniform1f(uniforms.edgeStrength, config.edgeStrength);
      gl.uniform1f(uniforms.edgeWidth, config.edgeWidth);
      gl.uniform1f(uniforms.edgeExponent, config.edgeExponent);
      gl.uniform3f(
        uniforms.tintColor,
        config.tintColor[0],
        config.tintColor[1],
        config.tintColor[2],
      );
      gl.uniform1f(uniforms.tint, readMotion(config.tintStrength));
      gl.uniform1f(uniforms.zoom, readMotion(config.magnification));
      gl.uniform1f(uniforms.shadow, readMotion(config.shadowStrength));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    drawRef.current = draw;
    scheduleDraw();

    return () => {
      cancelFrame(drawFrame);
      drawRef.current = () => undefined;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [drawFrame, renderHeight, renderWidth, scheduleDraw, sourceRef]);

  useEffect(() => {
    const unsubscribe: Array<() => void> = [];
    for (const blob of blobs) {
      for (const value of [
        blob.x,
        blob.y,
        blob.radius,
        blob.halfWidth,
        blob.halfHeight,
        blob.cornerRadius,
        blob.velocityX,
        blob.velocityY,
      ]) {
        if (isMotionValue(value)) unsubscribe.push(value.on("change", scheduleDraw));
      }
    }
    if (isMotionValue(mergeDistance)) {
      unsubscribe.push(mergeDistance.on("change", scheduleDraw));
    }
    for (const value of [
      refractionStrength,
      specularStrength,
      blurStrength,
      edgeDepth,
      tintStrength,
      magnification,
      shadowStrength,
    ]) {
      if (isMotionValue(value)) unsubscribe.push(value.on("change", scheduleDraw));
    }
    scheduleDraw();
    return () => unsubscribe.forEach((stop) => stop());
  }, [
    blobs,
    blurStrength,
    edgeDepth,
    domeDepth,
    brightness,
    magnification,
    mergeDistance,
    refractionStrength,
    shadowStrength,
    specularStrength,
    tintStrength,
    scheduleDraw,
  ]);

  useEffect(() => {
    textureDirtyRef.current = true;
    scheduleDraw();
  }, [sourceRevision, scheduleDraw]);

  useEffect(scheduleDraw, [
    width,
    height,
    mergeDistance,
    refractionStrength,
    chromaAmount,
    specularStrength,
    blurStrength,
    edgeDepth,
    domeDepth,
    brightness,
    specularRotation,
    glowStrength,
    glowSpread,
    glowExponent,
    edgeStrength,
    edgeWidth,
    edgeExponent,
    tintColor,
    tintStrength,
    magnification,
    shadowStrength,
    scheduleDraw,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={renderWidth}
      height={renderHeight}
      className={className}
      style={style}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
