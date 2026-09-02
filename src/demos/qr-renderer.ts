export interface QrEyeRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
}

export interface QrRendererOptions {
  canvas: HTMLCanvasElement;
  size: number;
  eyes: QrEyeRect[];
  occupancy: Uint8Array;
  matrixLength: number;
  gridOriginUv: number;
  cellUv: number;
  dotRadius: number;
  dotColor: string;
  backgroundColor: string;
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = (a_position * 0.5) + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_dotRadius;
uniform vec3 u_backgroundColor;
uniform sampler2D u_PaintingTexture;
uniform sampler2D u_occupancyTexture;
uniform float u_gridOriginUV;
uniform float u_cellUV;
uniform float u_invCellUV;
uniform int u_matrixLength;

uniform sampler2D u_displacementMap;
uniform sampler2D u_paintingColorTexture;
uniform int u_displacementActive;
uniform vec2 u_lensOrigin;
uniform vec2 u_lensSize;
uniform vec2 u_displacementScale;
uniform float u_chromaAmount;

uniform vec2 u_eyeCenter[3];
uniform vec3 u_eyeHalf[3];
uniform vec3 u_eyeRadius[3];
uniform vec3 u_eyeColor[3];
uniform float u_eyeScale[3];
uniform float u_eyeRefractionScale;

float testDot(vec2 pos, float r2) {
  int i = int(floor((pos.x - u_gridOriginUV) * u_invCellUV));
  int j = int(floor((pos.y - u_gridOriginUV) * u_invCellUV));
  if (i < 0 || i >= u_matrixLength || j < 0 || j >= u_matrixLength) return 1.0;
  if (texelFetch(u_occupancyTexture, ivec2(i, j), 0).r < 0.5) return 1.0;
  vec2 center = vec2(u_gridOriginUV) + (vec2(float(i), float(j)) + 0.5) * u_cellUV;
  vec2 delta = pos - center;
  return dot(delta, delta) < r2 ? 0.0 : 1.0;
}

float roundedRectSDF(vec2 p, float halfSize, float radius) {
  vec2 d = abs(p) - vec2(halfSize) + vec2(radius);
  return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - radius;
}

vec4 testEyes(vec2 pos) {
  for (int group = 0; group < 3; group++) {
    vec2 local = (pos - u_eyeCenter[group]) / u_eyeScale[group];
    if (roundedRectSDF(local, u_eyeHalf[group].z, u_eyeRadius[group].z) < 0.0) return vec4(u_eyeColor[group], 1.0);
    if (roundedRectSDF(local, u_eyeHalf[group].y, u_eyeRadius[group].y) < 0.0) return vec4(u_backgroundColor, 1.0);
    if (roundedRectSDF(local, u_eyeHalf[group].x, u_eyeRadius[group].x) < 0.0) return vec4(u_eyeColor[group], 1.0);
  }
  return vec4(0.0);
}

vec4 sampleStatic(vec2 pos, float r2) {
  vec4 eye = testEyes(pos);
  if (eye.a > 0.5) return eye;
  float hole = testDot(pos, r2);
  if (hole < 0.5) return vec4(0.0, 0.0, 0.0, -1.0);
  return vec4(u_backgroundColor, 1.0);
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  float paint = texture(u_PaintingTexture, uv).r;
  float radiusSquared = pow(u_dotRadius * (1.0 - paint), 2.0);

  if (u_displacementActive == 0) {
    vec4 sample_ = sampleStatic(uv, radiusSquared);
    if (sample_.a < 0.0) discard;
    fragColor = sample_;
    return;
  }

  vec2 lensUV = (uv - u_lensOrigin) / u_lensSize;
  bool insideLens = lensUV.x >= 0.0 && lensUV.x <= 1.0 && lensUV.y >= 0.0 && lensUV.y <= 1.0;
  if (!insideLens) {
    vec4 sample_ = sampleStatic(uv, radiusSquared);
    if (sample_.a < 0.0) discard;
    fragColor = sample_;
    return;
  }

  vec4 mapSample = texture(u_displacementMap, lensUV);
  if (mapSample.a < 0.01) {
    vec4 sample_ = sampleStatic(uv, radiusSquared);
    if (sample_.a < 0.0) discard;
    fragColor = sample_;
    return;
  }

  vec2 displacement = (mapSample.rg - 0.5) * u_displacementScale;
  float scaleR = 1.0 + u_chromaAmount * 2.0;
  float scaleG = 1.0 + u_chromaAmount;
  vec2 uvR = uv + displacement * scaleR;
  vec2 uvG = uv + displacement * scaleG;
  vec2 uvB = uv + displacement;

  vec2 eyeDisplacement = displacement * u_eyeRefractionScale;
  vec4 eyeR = testEyes(uv + eyeDisplacement * scaleR);
  vec4 eyeG = testEyes(uv + eyeDisplacement * scaleG);
  vec4 eyeB = testEyes(uv + eyeDisplacement);

  float red;
  float green;
  float blue;
  if (eyeR.a > 0.5) red = eyeR.r;
  else red = mix(texture(u_paintingColorTexture, uvR).r, u_backgroundColor.r, testDot(uvR, radiusSquared));
  if (eyeG.a > 0.5) green = eyeG.g;
  else green = mix(texture(u_paintingColorTexture, uvG).g, u_backgroundColor.g, testDot(uvG, radiusSquared));
  if (eyeB.a > 0.5) blue = eyeB.b;
  else blue = mix(texture(u_paintingColorTexture, uvB).b, u_backgroundColor.b, testDot(uvB, radiusSquared));
  fragColor = vec4(red, green, blue, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create QR shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "QR shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function configureTexture(gl: WebGL2RenderingContext, filter: number) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
}

export class QrWebglRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vertexShader: WebGLShader;
  private readonly fragmentShader: WebGLShader;
  private readonly buffer: WebGLBuffer;
  private readonly occupancyTexture: WebGLTexture;
  private readonly paintingTexture: WebGLTexture;
  private readonly displacementTexture: WebGLTexture;
  private readonly paintingColorTexture: WebGLTexture;
  private readonly eyeColorLocations: Array<WebGLUniformLocation | null> = [];
  private readonly eyeScaleLocations: Array<WebGLUniformLocation | null> = [];
  private readonly backgroundLocation: WebGLUniformLocation | null;
  private readonly activeLocation: WebGLUniformLocation | null;
  private readonly lensOriginLocation: WebGLUniformLocation | null;
  private readonly lensSizeLocation: WebGLUniformLocation | null;
  private readonly displacementScaleLocation: WebGLUniformLocation | null;
  private readonly chromaLocation: WebGLUniformLocation | null;
  private readonly eyeRefractionLocation: WebGLUniformLocation | null;
  private displacementSize = { width: 0, height: 0 };
  private paintingSize = { width: 0, height: 0 };
  private paintingColorSize = { width: 0, height: 0 };

  constructor(options: QrRendererOptions) {
    this.canvas = options.canvas;
    const ratio = 1.25 * Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(options.size * ratio);
    this.canvas.height = Math.round(options.size * ratio);
    const gl = this.canvas.getContext("webgl2", { premultipliedAlpha: false, antialias: true });
    if (!gl) throw new Error("WebGL2 is unavailable for the QR renderer");
    this.gl = gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ZERO);

    this.vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    this.fragmentShader = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to create QR program");
    this.program = program;
    gl.attachShader(program, this.vertexShader);
    gl.attachShader(program, this.fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Unable to link QR program");
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Unable to create QR vertex buffer");
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const occupancyTexture = gl.createTexture();
    const paintingTexture = gl.createTexture();
    const displacementTexture = gl.createTexture();
    const paintingColorTexture = gl.createTexture();
    if (!occupancyTexture || !paintingTexture || !displacementTexture || !paintingColorTexture) throw new Error("Unable to create QR textures");
    this.occupancyTexture = occupancyTexture;
    this.paintingTexture = paintingTexture;
    this.displacementTexture = displacementTexture;
    this.paintingColorTexture = paintingColorTexture;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, occupancyTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, options.matrixLength, options.matrixLength, 0, gl.RED, gl.UNSIGNED_BYTE, options.occupancy);
    configureTexture(gl, gl.NEAREST);
    gl.uniform1i(gl.getUniformLocation(program, "u_occupancyTexture"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_gridOriginUV"), options.gridOriginUv);
    gl.uniform1f(gl.getUniformLocation(program, "u_cellUV"), options.cellUv);
    gl.uniform1f(gl.getUniformLocation(program, "u_invCellUV"), 1 / options.cellUv);
    gl.uniform1i(gl.getUniformLocation(program, "u_matrixLength"), options.matrixLength);
    gl.uniform1f(gl.getUniformLocation(program, "u_dotRadius"), options.dotRadius);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexture);
    configureTexture(gl, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "u_displacementMap"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, paintingTexture);
    configureTexture(gl, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "u_PaintingTexture"), 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, paintingColorTexture);
    configureTexture(gl, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "u_paintingColorTexture"), 3);

    this.backgroundLocation = gl.getUniformLocation(program, "u_backgroundColor");
    this.activeLocation = gl.getUniformLocation(program, "u_displacementActive");
    this.lensOriginLocation = gl.getUniformLocation(program, "u_lensOrigin");
    this.lensSizeLocation = gl.getUniformLocation(program, "u_lensSize");
    this.displacementScaleLocation = gl.getUniformLocation(program, "u_displacementScale");
    this.chromaLocation = gl.getUniformLocation(program, "u_chromaAmount");
    this.eyeRefractionLocation = gl.getUniformLocation(program, "u_eyeRefractionScale");
    gl.uniform1i(this.activeLocation, 0);
    gl.uniform1f(this.eyeRefractionLocation, 0.16);

    for (let group = 0; group < 3; group += 1) {
      const outer = options.eyes[group * 3];
      const middle = options.eyes[group * 3 + 1];
      const inner = options.eyes[group * 3 + 2];
      gl.uniform2f(gl.getUniformLocation(program, `u_eyeCenter[${group}]`), (outer.x + outer.width / 2) / options.size, (outer.y + outer.height / 2) / options.size);
      gl.uniform3f(gl.getUniformLocation(program, `u_eyeHalf[${group}]`), outer.width / 2 / options.size, middle.width / 2 / options.size, inner.width / 2 / options.size);
      gl.uniform3f(gl.getUniformLocation(program, `u_eyeRadius[${group}]`), outer.rx / options.size, middle.rx / options.size, inner.rx / options.size);
      const eyeColor = gl.getUniformLocation(program, `u_eyeColor[${group}]`);
      const eyeScale = gl.getUniformLocation(program, `u_eyeScale[${group}]`);
      this.eyeColorLocations.push(eyeColor);
      this.eyeScaleLocations.push(eyeScale);
      gl.uniform1f(eyeScale, 1);
    }
    const foreground = this.resolveCssColor(options.dotColor);
    this.updateBackgroundColor(options.backgroundColor);
    for (let group = 0; group < 3; group += 1) this.updateEyeColor(group, foreground);
  }

  resolveCssColor(color: string): [number, number, number] {
    const previous = this.canvas.style.color;
    this.canvas.style.color = color;
    const resolved = getComputedStyle(this.canvas).color;
    this.canvas.style.color = previous;
    const p3 = resolved.match(/color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (p3) return [Number(p3[1]), Number(p3[2]), Number(p3[3])];
    const values = resolved.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
    return [values[0] / 255, values[1] / 255, values[2] / 255];
  }

  updateBackgroundColor(color: string) {
    const [red, green, blue] = this.resolveCssColor(color);
    this.gl.uniform3f(this.backgroundLocation, red, green, blue);
  }

  updateEyeColor(group: number, color: [number, number, number]) {
    this.gl.uniform3f(this.eyeColorLocations[group], color[0], color[1], color[2]);
  }

  updateEyeScale(group: number, scale: number) {
    this.gl.uniform1f(this.eyeScaleLocations[group], scale);
  }

  updateEyeRefractionScale(scale: number) {
    this.gl.uniform1f(this.eyeRefractionLocation, scale);
  }

  private uploadTexture(texture: WebGLTexture, unit: number, source: TexImageSource, size: { width: number; height: number }) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const width = "width" in source ? Number(source.width) : 0;
    const height = "height" in source ? Number(source.height) : 0;
    if (width !== size.width || height !== size.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      size.width = width;
      size.height = height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
  }

  updateDisplacement(source: TexImageSource, lensOrigin: [number, number], lensSize: [number, number], scale: [number, number], chroma: number) {
    this.uploadTexture(this.displacementTexture, 1, source, this.displacementSize);
    this.gl.uniform1i(this.activeLocation, 1);
    this.gl.uniform2f(this.lensOriginLocation, lensOrigin[0], lensOrigin[1]);
    this.gl.uniform2f(this.lensSizeLocation, lensSize[0], lensSize[1]);
    this.gl.uniform2f(this.displacementScaleLocation, scale[0], scale[1]);
    this.gl.uniform1f(this.chromaLocation, chroma);
  }

  clearDisplacement() {
    this.gl.uniform1i(this.activeLocation, 0);
  }

  updatePaintingTexture(source: TexImageSource) {
    this.uploadTexture(this.paintingTexture, 2, source, this.paintingSize);
  }

  updatePaintingColorTexture(source: TexImageSource) {
    this.uploadTexture(this.paintingColorTexture, 3, source, this.paintingColorSize);
  }

  draw() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteShader(this.vertexShader);
    gl.deleteShader(this.fragmentShader);
    gl.deleteBuffer(this.buffer);
    gl.deleteTexture(this.occupancyTexture);
    gl.deleteTexture(this.paintingTexture);
    gl.deleteTexture(this.displacementTexture);
    gl.deleteTexture(this.paintingColorTexture);
  }
}
