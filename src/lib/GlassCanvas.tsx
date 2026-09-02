import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createMapGenerator } from "./displacement-map";
import { DEFAULT_LENS_PARAMS } from "./presets";
import type { LensParams } from "./types";

export interface GlassCanvasProps {
  sourceRef: RefObject<HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | null>;
  width: number;
  height: number;
  lens: Partial<LensParams>;
  x?: number;
  y?: number;
  active?: number | boolean;
  transparentOutside?: boolean;
  sourceRevision?: number;
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
uniform sampler2D uMap;
uniform vec2 uSourceSize;
uniform vec2 uLensCenter;
uniform vec2 uLensHalf;
uniform vec2 uScale;
uniform float uRadius;
uniform float uChroma;
uniform float uSpecular;
uniform float uStrength;
uniform float uTransparentOutside;

float roundedRect(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
}

void main() {
  vec4 source = texture(uSource, vUv);
  vec2 local = (vUv - uLensCenter) * uSourceSize;
  bool inside = roundedRect(local, uLensHalf, uRadius) <= 0.;
  if (!inside || uStrength <= .001) {
    outputColor = uTransparentOutside > .5 ? vec4(0.) : source;
    return;
  }
  vec2 mapUv = local / (uLensHalf * 2.) + .5;
  vec3 mapValue = texture(uMap, mapUv).rgb;
  vec2 displacement = (mapValue.rg - .5) * 2. * uScale * uLensHalf / uSourceSize * uStrength;
  float red = texture(uSource, vUv + displacement * (1. + .2 * uChroma)).r;
  float green = texture(uSource, vUv + displacement * (1. + .1 * uChroma)).g;
  float blue = texture(uSource, vUv + displacement).b;
  float shine = max(0., (mapValue.b - .5) * 2.) * uSpecular * uStrength;
  outputColor = vec4(min(vec3(1.), vec3(red, green, blue) + shine), source.a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "WebGL shader compilation failed");
  }
  return shader;
}

function createTexture(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Unable to create WebGL texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function GlassCanvas({
  sourceRef,
  width,
  height,
  lens: inputLens,
  x = 0.5,
  y = 0.5,
  active = true,
  transparentOutside = false,
  sourceRevision = 0,
  className,
  style,
  ariaLabel = "Refracted canvas",
}: GlassCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const configRef = useRef({ x, y, active, transparentOutside });
  configRef.current = { x, y, active, transparentOutside };
  const lens = { ...DEFAULT_LENS_PARAMS, ...inputLens };
  const key = [
    lens.lensW,
    lens.lensH,
    lens.borderRadius,
    lens.mapSize,
    lens.depth,
    lens.domeDepth,
    lens.splayAmount,
    lens.specularRotation,
    lens.glowStrength,
    lens.glowSpread,
    lens.glowExponent,
    lens.edgeStrength,
    lens.edgeWidth,
    lens.edgeExponent,
    Number(lens.sdfBoundary),
    Number(lens.edgeFalloff),
  ].join(":");
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const renderKey = [key, lens.scaleX, lens.scaleY, lens.chromaAmount, lens.specularStrength].join(":");

  useEffect(() => {
    const generator = createMapGenerator(lens.mapSize);
    const { dataUrl } = generator.generate({
      lensHalfWidth: lens.lensW,
      lensHalfHeight: lens.lensH,
      borderRadius: lens.borderRadius,
      depth: lens.depth,
      sdfBoundary: lens.sdfBoundary,
      edgeFalloff: lens.edgeFalloff,
      specularRotation: lens.specularRotation,
      glowStrength: lens.glowStrength,
      glowSpread: lens.glowSpread,
      glowExponent: lens.glowExponent,
      edgeStrength: lens.edgeStrength,
      edgeWidth: lens.edgeWidth,
      edgeExponent: lens.edgeExponent,
      domeDepth: lens.domeDepth,
      splayAmount: lens.splayAmount,
    });
    const image = new Image();
    image.onload = () => setMapImage(image);
    image.src = dataUrl;
    return () => generator.dispose();
  }, [key]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || !mapImage) return;
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
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

    const sourceTexture = createTexture(gl);
    const mapTexture = createTexture(gl);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mapImage);
    const uniforms = {
      source: gl.getUniformLocation(program, "uSource"),
      map: gl.getUniformLocation(program, "uMap"),
      sourceSize: gl.getUniformLocation(program, "uSourceSize"),
      lensHalf: gl.getUniformLocation(program, "uLensHalf"),
      scale: gl.getUniformLocation(program, "uScale"),
      radius: gl.getUniformLocation(program, "uRadius"),
      chroma: gl.getUniformLocation(program, "uChroma"),
      specular: gl.getUniformLocation(program, "uSpecular"),
      lensCenter: gl.getUniformLocation(program, "uLensCenter"),
      strength: gl.getUniformLocation(program, "uStrength"),
      transparentOutside: gl.getUniformLocation(program, "uTransparentOutside"),
    };
    gl.uniform1i(uniforms.source, 0);
    gl.uniform1i(uniforms.map, 1);
    gl.uniform2f(uniforms.sourceSize, width, height);
    gl.uniform2f(uniforms.lensHalf, lens.lensW, lens.lensH);
    gl.uniform2f(uniforms.scale, lens.scaleX, lens.scaleY);
    gl.uniform1f(uniforms.radius, lens.borderRadius);
    gl.uniform1f(uniforms.chroma, lens.chromaAmount);
    gl.uniform1f(uniforms.specular, lens.specularStrength);

    let frame = 0;
    const draw = () => {
      const config = configRef.current;
      const strength = typeof config.active === "boolean" ? Number(config.active) : config.active;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } catch {
        return;
      }
      gl.uniform2f(uniforms.lensCenter, config.x, config.y);
      gl.uniform1f(uniforms.strength, strength);
      gl.uniform1f(uniforms.transparentOutside, Number(config.transparentOutside));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    drawRef.current = draw;
    if (source instanceof HTMLVideoElement) {
      const renderVideo = () => {
        draw();
        frame = requestAnimationFrame(renderVideo);
      };
      renderVideo();
    } else {
      draw();
    }

    return () => {
      cancelAnimationFrame(frame);
      drawRef.current = () => undefined;
      gl.deleteTexture(sourceTexture);
      gl.deleteTexture(mapTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [sourceRef, sourceRevision, width, height, renderKey, mapImage]);

  useEffect(() => drawRef.current(), [x, y, active, transparentOutside]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={style}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
