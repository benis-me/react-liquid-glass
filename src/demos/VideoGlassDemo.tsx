import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import pauseSvg from "../assets/video/pause.svg?raw";
import rewindSvg from "../assets/video/rewind.svg?raw";
import forwardSvg from "../assets/video/forward.svg?raw";
import playSvg from "../assets/video/play.svg?raw";
import type { Locale } from "../i18n";
import { computeDomeConstants } from "../lib";
import { usePointerReleaseFallback } from "../lib/use-pointer-release-fallback";

const VIDEO_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const VIDEO_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_video;
uniform vec2 u_size;
uniform vec2 u_texel;
uniform vec3 u_circles[3];
uniform float u_press[3];
uniform float u_baseScale[3];
uniform float u_depthRatio[3];
uniform float u_domeRadius[3];
uniform float u_domeScale[3];
uniform float u_edgeStrength[3];
uniform float u_edgeWidth[3];
uniform vec4 u_bar;
uniform float u_barRadius;
uniform float u_barScale;
uniform float u_strength;

float erfApprox(float value) { return tanh(1.7724538509 * value); }

vec4 videoAt(vec2 uv) { return texture(u_video, clamp(uv, 0.0, 1.0)); }

vec4 frostedAt(vec2 uv) {
  vec2 offset = u_texel * 0.65;
  vec4 color = videoAt(uv) * 0.4;
  color += videoAt(uv + vec2(offset.x, 0.0)) * 0.15;
  color += videoAt(uv - vec2(offset.x, 0.0)) * 0.15;
  color += videoAt(uv + vec2(0.0, offset.y)) * 0.15;
  color += videoAt(uv - vec2(0.0, offset.y)) * 0.15;
  return color;
}

float roundedRectSdf(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + vec2(radius);
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 pixel = v_uv * u_size;
  float mask = 0.0;
  vec2 displacement = vec2(0.0);
  float baseScale = 0.0;
  float specular = 0.0;

  for (int index = 0; index < 3; index++) {
    float radius = u_circles[index].z;
    if (radius < 0.1) continue;
    float press = max(u_press[index], 0.001);
    vec2 visibleLocal = pixel - u_circles[index].xy;
    float visibleDistance = length(visibleLocal) - radius * press;
    float aa = fwidth(visibleDistance);
    float circleMask = 1.0 - smoothstep(-aa, aa, visibleDistance);
    if (circleMask > mask) {
      vec2 local = visibleLocal / press;
      float rho = length(local);
      float depth = max(0.001, radius * u_depthRatio[index]);
      float falloff = 0.5 * (1.0 + erfApprox((rho - max(0.0, radius - depth)) / (depth * 1.41421356237)));
      vec2 direction = vec2(0.0);
      if (rho > 0.0001) {
        float cap = min(rho, 0.999 * u_domeRadius[index]);
        float gradient = cap / sqrt(max(0.0001, u_domeRadius[index] * u_domeRadius[index] - cap * cap));
        direction = normalize(local) * gradient * u_domeScale[index];
      }
      displacement = -0.5 * direction * falloff;
      baseScale = u_baseScale[index];
      float align = abs(dot(clamp(local / radius, -1.0, 1.0), vec2(0.8660254, 0.5)));
      float rim = max(0.0, 1.0 + (rho - radius) / max(0.001, u_edgeWidth[index]));
      specular = u_edgeStrength[index] * rim * pow(align, 1.5);
      mask = circleMask;
    }
  }

  if (u_bar.z > 0.1 && u_bar.w > 0.1) {
    vec2 local = pixel - u_bar.xy;
    vec2 halfSize = u_bar.zw * 0.5;
    float distance = roundedRectSdf(local, halfSize, u_barRadius);
    float aa = fwidth(distance);
    float barMask = 1.0 - smoothstep(-aa, aa, distance);
    if (barMask > mask) {
      vec2 q = abs(local) - halfSize + vec2(u_barRadius);
      vec2 outside = max(q, vec2(0.0));
      float outsideLength = length(outside);
      vec2 normal;
      if (q.x > 0.0 || q.y > 0.0) {
        normal = outsideLength > 0.0001 ? outside / outsideLength * sign(local) : vec2(0.0);
      } else if (q.x > q.y) {
        normal = vec2(sign(local.x), 0.0);
      } else {
        normal = vec2(0.0, sign(local.y));
      }
      float minHalf = min(halfSize.x, halfSize.y);
      float magnitude = clamp((minHalf + distance) / max(minHalf, 0.001), 0.0, 1.0);
      float depth = max(0.001, minHalf * 0.5);
      float falloff = 0.5 * (1.0 + erfApprox((distance + depth) / (depth * 1.41421356237)));
      displacement = -0.5 * normal * magnitude * falloff;
      baseScale = u_barScale;
      float align = abs(dot(normal * magnitude, vec2(0.8660254, 0.5)));
      float rim = max(0.0, 1.0 + distance / 2.0);
      specular = 0.25 * rim * pow(align, 1.5);
      mask = barMask;
    }
  }

  float strength = clamp(u_strength, 0.0, 1.0);
  float coverage = clamp(mask * strength, 0.0, 1.0);
  if (coverage <= 0.001) {
    fragColor = videoAt(v_uv);
    return;
  }
  vec2 offset = displacement * baseScale * coverage;
  vec2 displacedUv = v_uv + offset;
  vec4 raw = videoAt(displacedUv);
  vec4 frosted = frostedAt(displacedUv);
  vec4 color = mix(raw, frosted, coverage);

  float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float spec = min(1.0, specular) * 0.498 * coverage;
  float brightBlend = smoothstep(0.3, 0.7, luminance);
  vec3 additive = color.rgb + spec;
  vec3 multiplicative = color.rgb * (1.0 - spec);
  color.rgb = mix(additive, multiplicative, brightBlend);
  color.rgb += (0.5 - luminance) * 0.2 * coverage;
  fragColor = vec4(max(color.rgb, vec3(0.0)), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create video shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Video shader failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function texture(gl: WebGL2RenderingContext) {
  const result = gl.createTexture();
  if (!result) throw new Error("Unable to create video texture");
  gl.bindTexture(gl.TEXTURE_2D, result);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return result;
}

function SourceVideoIcon({ source }: { source: string }) {
  return <span className="dg-video-player__source-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: source }} />;
}

function lensLayout(width: number, height: number) {
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const playSize = 111 * (mobile ? 0.75 : 1);
  const sideSize = 65 * (mobile ? 0.75 : 1);
  const gap = 24;
  const centerX = width / 2;
  const centerY = height / 2;
  const offset = playSize / 2 + gap + sideSize / 2;
  const margin = 24 * (mobile ? 0.5 : 1);
  return {
    playSize,
    sideSize,
    gap,
    circles: [
      [centerX - offset, centerY, sideSize / 2],
      [centerX, centerY, playSize / 2],
      [centerX + offset, centerY, sideSize / 2],
    ] as Array<[number, number, number]>,
    bar: [width / 2, height - margin - 15, Math.max(0, width - margin * 2), 30, 15] as [number, number, number, number, number],
    margin,
  };
}

type VideoFrameApi = {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const SIDE_BUTTON_SPRING = { stiffness: 1000, damping: 40, mass: 1.5 };
const PLAY_BUTTON_SPRING = { stiffness: 500, damping: 32, mass: 1 };
const BAR_DRAG_SPRING = { stiffness: 550, damping: 35, mass: 1 };
const BUTTON_HOVER_SCALE = 1.045;

const copy = {
  zh: {
    poster: "花田视频画面",
    canvas: "经过玻璃控件折射的视频",
    rewind: "后退 5 秒",
    pause: "暂停",
    play: "播放",
    forward: "前进 5 秒",
    progress: "播放进度",
    caption: "玻璃效果同样可以应用在视频播放器等复杂交互内容上。",
  },
  en: {
    poster: "Flower field video frame",
    canvas: "Video refracted through glass controls",
    rewind: "Rewind 5 seconds",
    pause: "Pause",
    play: "Play",
    forward: "Forward 5 seconds",
    progress: "Playback progress",
    caption: "Glass also works with complex interactive media such as video players.",
  },
} as const;

function seekRubberBand(distance: number, limit: number) {
  const magnitude = Math.abs(distance);
  if (magnitude === 0) return 0;
  return Math.sign(distance) * limit * (1 - 1 / (magnitude / limit + 1));
}

function stepSpring(
  value: number,
  velocity: number,
  target: number,
  config: { stiffness: number; damping: number; mass: number },
  elapsed: number,
) {
  const steps = Math.max(1, Math.ceil(elapsed / 0.008));
  const dt = elapsed / steps;
  let nextValue = value;
  let nextVelocity = velocity;
  for (let index = 0; index < steps; index += 1) {
    const acceleration = (-config.stiffness * (nextValue - target) - config.damping * nextVelocity) / config.mass;
    nextVelocity += acceleration * dt;
    nextValue += nextVelocity * dt;
  }
  if (Math.abs(nextValue - target) < 0.0005 && Math.abs(nextVelocity) < 0.005) {
    return [target, 0] as const;
  }
  return [nextValue, nextVelocity] as const;
}

export function VideoGlassDemo({ locale }: { locale: Locale }) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pressRef = useRef([1, 1, 1]);
  const pressTargetRef = useRef([1, 1, 1]);
  const hoverRef = useRef([false, false, false]);
  const scaleVelocityRef = useRef([0, 0, 0]);
  const strengthRef = useRef(0);
  const strengthTargetRef = useRef(1);
  const barStretchRef = useRef(0);
  const barStretchTargetRef = useRef(0);
  const barStretchVelocityRef = useRef(0);
  const textureDirtyRef = useRef(true);
  const frameRef = useRef(0);
  const videoFrameRef = useRef(0);
  const ensureDrawRef = useRef<() => void>(() => undefined);
  const readyRef = useRef(false);
  const draggingRef = useRef(false);
  const seekPointerRef = useRef<number | null>(null);
  const resumeAfterSeekRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const text = copy[locale];

  useEffect(() => {
    strengthTargetRef.current = controlsVisible ? 1 : 0;
    ensureDrawRef.current();
  }, [controlsVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const player = playerRef.current;
    if (!canvas || !video || !player) return;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    let vertex: WebGLShader;
    let fragment: WebGLShader;
    try {
      vertex = compile(gl, gl.VERTEX_SHADER, VIDEO_VERTEX);
      fragment = compile(gl, gl.FRAGMENT_SHADER, VIDEO_FRAGMENT);
    } catch (error) {
      console.error(error);
      return;
    }
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program) ?? "Unable to link video program");
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const videoTexture = texture(gl);
    gl.uniform1i(gl.getUniformLocation(program, "u_video"), 0);
    const locations = {
      size: gl.getUniformLocation(program, "u_size"),
      texel: gl.getUniformLocation(program, "u_texel"),
      circles: [0, 1, 2].map((index) => gl.getUniformLocation(program, `u_circles[${index}]`)),
      press: gl.getUniformLocation(program, "u_press[0]"),
      baseScale: gl.getUniformLocation(program, "u_baseScale[0]"),
      depthRatio: gl.getUniformLocation(program, "u_depthRatio[0]"),
      domeRadius: gl.getUniformLocation(program, "u_domeRadius[0]"),
      domeScale: gl.getUniformLocation(program, "u_domeScale[0]"),
      edgeStrength: gl.getUniformLocation(program, "u_edgeStrength[0]"),
      edgeWidth: gl.getUniformLocation(program, "u_edgeWidth[0]"),
      bar: gl.getUniformLocation(program, "u_bar"),
      barRadius: gl.getUniformLocation(program, "u_barRadius"),
      barScale: gl.getUniformLocation(program, "u_barScale"),
      strength: gl.getUniformLocation(program, "u_strength"),
    };
    gl.uniform1fv(locations.baseScale, new Float32Array([0.04, 0.07, 0.04]));
    gl.uniform1fv(locations.depthRatio, new Float32Array([0.14, 0.16, 0.14]));
    gl.uniform1fv(locations.edgeStrength, new Float32Array([0.49, 0.5, 0.49]));
    gl.uniform1fv(locations.edgeWidth, new Float32Array([2, 2.5, 2]));
    gl.uniform1f(locations.barScale, 0.04);
    let domeKey = "";
    let sideDome = computeDomeConstants(40, 32.5, 32.5);
    let playDome = computeDomeConstants(35, 55.5, 55.5);

    const videoFrameApi = video as unknown as VideoFrameApi;
    const requestVideoFrame = videoFrameApi.requestVideoFrameCallback?.bind(video);
    const cancelVideoFrame = videoFrameApi.cancelVideoFrameCallback?.bind(video);
    let visible = true;
    let resumeWhenVisible = false;
    let textureReady = false;
    let previousDrawTime = performance.now();

    const buttonTarget = (index: number) =>
      pressTargetRef.current[index] * (hoverRef.current[index] ? BUTTON_HOVER_SCALE : 1);

    const controlsMoving = () =>
      pressRef.current.some((value, index) =>
        Math.abs(value - buttonTarget(index)) > 0.001 || Math.abs(scaleVelocityRef.current[index]) > 0.005) ||
      Math.abs(strengthRef.current - strengthTargetRef.current) > 0.001 ||
      Math.abs(barStretchRef.current - barStretchTargetRef.current) > 0.01 ||
      Math.abs(barStretchVelocityRef.current) > 0.01;

    const draw = (uploadVideo: boolean, now = performance.now()) => {
      if (!visible) return;
      if (video.readyState < 2 || !player.clientWidth || !player.clientHeight) return;
      const elapsed = Math.min((now - previousDrawTime) / 1_000, 0.033);
      previousDrawTime = now;
      const ratio = Math.min(2.5, 1.25 * (window.devicePixelRatio || 1));
      const width = player.clientWidth;
      const height = player.clientHeight;
      const displayWidth = Math.round(width * ratio);
      const displayHeight = Math.round(height * ratio);
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }
      for (let index = 0; index < 3; index += 1) {
        const config = index === 1 ? PLAY_BUTTON_SPRING : SIDE_BUTTON_SPRING;
        const [scale, velocity] = stepSpring(
          pressRef.current[index],
          scaleVelocityRef.current[index],
          buttonTarget(index),
          config,
          elapsed,
        );
        pressRef.current[index] = scale;
        scaleVelocityRef.current[index] = velocity;
        const button = buttonRefs.current[index];
        if (button) button.style.transform = `scale(${scale})`;
      }
      const strengthTarget = strengthTargetRef.current;
      strengthRef.current = Math.abs(strengthTarget - strengthRef.current) < 0.001 ? strengthTarget : strengthRef.current + (strengthTarget - strengthRef.current) * 0.18;
      [barStretchRef.current, barStretchVelocityRef.current] = stepSpring(
        barStretchRef.current,
        barStretchVelocityRef.current,
        barStretchTargetRef.current,
        BAR_DRAG_SPRING,
        elapsed,
      );
      const layout = lensLayout(width, height);
      const nextDomeKey = `${layout.sideSize}:${layout.playSize}`;
      if (nextDomeKey !== domeKey) {
        domeKey = nextDomeKey;
        sideDome = computeDomeConstants(40, layout.sideSize / 2, layout.sideSize / 2);
        playDome = computeDomeConstants(35, layout.playSize / 2, layout.playSize / 2);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
      if (uploadVideo || textureDirtyRef.current || !textureReady) {
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          textureReady = true;
          textureDirtyRef.current = false;
        } catch {
          return;
        }
      }
      gl.uniform2f(locations.size, width, height);
      gl.uniform2f(locations.texel, 1 / canvas.width, 1 / canvas.height);
      layout.circles.forEach((circle, index) => gl.uniform3f(locations.circles[index], circle[0], circle[1], circle[2]));
      gl.uniform1fv(locations.press, new Float32Array(pressRef.current));
      gl.uniform1fv(locations.domeRadius, new Float32Array([sideDome.Rx, playDome.Rx, sideDome.Rx]));
      gl.uniform1fv(locations.domeScale, new Float32Array([sideDome.scaleX, playDome.scaleX, sideDome.scaleX]));
      const barStretch = barStretchRef.current;
      const barWidth = layout.bar[2] + Math.abs(barStretch);
      const barCenterX = layout.bar[0] + barStretch * 0.5;
      gl.uniform4f(locations.bar, barCenterX, layout.bar[1], barWidth, layout.bar[3]);
      gl.uniform1f(locations.barRadius, layout.bar[4]);
      const bar = barRef.current;
      if (bar) {
        bar.style.transformOrigin = barStretch >= 0 ? "0 50%" : "100% 50%";
        bar.style.transform = `scaleX(${1 + Math.abs(barStretch) / layout.bar[2]})`;
      }
      gl.uniform1f(locations.strength, strengthRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (progressRef.current && Number.isFinite(video.duration) && video.duration > 0) {
        progressRef.current.style.width = `${(video.currentTime / video.duration) * 100}%`;
      }
      if (!readyRef.current) {
        readyRef.current = true;
        setReady(true);
      }
    };

    const cancelScheduled = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      if (videoFrameRef.current && cancelVideoFrame) {
        cancelVideoFrame(videoFrameRef.current);
      }
      videoFrameRef.current = 0;
    };

    const scheduleVideoFrame = () => {
      if (!visible || video.paused || videoFrameRef.current || !requestVideoFrame) return;
      videoFrameRef.current = requestVideoFrame((now) => {
        videoFrameRef.current = 0;
        draw(true, now);
        scheduleVideoFrame();
      });
    };

    const scheduleAnimationFrame = () => {
      if (!visible || frameRef.current) return;
      frameRef.current = requestAnimationFrame((now) => {
        frameRef.current = 0;
        const fallbackVideoFrame = !requestVideoFrame && !video.paused;
        draw(fallbackVideoFrame, now);
        if (fallbackVideoFrame || controlsMoving()) scheduleAnimationFrame();
      });
    };

    const ensureDraw = () => {
      if (!visible) return;
      if (!video.paused && requestVideoFrame) {
        scheduleVideoFrame();
      }
      if (video.paused || controlsMoving() || !requestVideoFrame) {
        scheduleAnimationFrame();
      }
    };

    ensureDrawRef.current = ensureDraw;
    const onPlay = () => ensureDraw();
    const onPause = () => {
      cancelScheduled();
      ensureDraw();
    };
    const onSeeked = () => {
      textureDirtyRef.current = true;
      ensureDraw();
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        resumeWhenVisible = !video.paused;
        cancelScheduled();
        if (resumeWhenVisible) video.pause();
        return;
      }
      if (resumeWhenVisible) {
        resumeWhenVisible = false;
        void video.play().catch(() => ensureDraw());
      } else {
        ensureDraw();
      }
    }, { rootMargin: "120px 0px" });
    visibilityObserver.observe(player);
    ensureDraw();

    return () => {
      visibilityObserver.disconnect();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      ensureDrawRef.current = () => undefined;
      cancelScheduled();
      gl.deleteTexture(videoTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    textureDirtyRef.current = true;
    ensureDrawRef.current();
  }, []);

  const seek = useCallback((clientX: number) => {
    const player = playerRef.current;
    const video = videoRef.current;
    if (!player || !video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const rect = player.getBoundingClientRect();
    const layout = lensLayout(rect.width, rect.height);
    const trackLeft = rect.left + layout.margin + 14;
    const trackWidth = rect.width - layout.margin * 2 - 28;
    const rawProgress = (clientX - trackLeft) / trackWidth;
    const progress = Math.max(0, Math.min(1, rawProgress));
    barStretchTargetRef.current = seekRubberBand((rawProgress - progress) * trackWidth, layout.margin);
    video.currentTime = progress * video.duration;
    textureDirtyRef.current = true;
    if (progressRef.current) progressRef.current.style.width = `${progress * 100}%`;
    ensureDrawRef.current();
  }, []);

  const finishSeek = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const activePointerId = seekPointerRef.current;
    seekPointerRef.current = null;
    if (activePointerId !== null && barRef.current?.hasPointerCapture(activePointerId)) {
      try { barRef.current.releasePointerCapture(activePointerId); } catch {}
    }
    barStretchTargetRef.current = 0;
    ensureDrawRef.current();
    if (resumeAfterSeekRef.current) void videoRef.current?.play();
    resumeAfterSeekRef.current = false;
  }, []);
  const { arm: armSeekFallback, disarm: disarmSeekFallback } = usePointerReleaseFallback(finishSeek);

  const startSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) return;
    event.preventDefault();
    seekPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    armSeekFallback(event.pointerId);
    draggingRef.current = true;
    const video = videoRef.current;
    resumeAfterSeekRef.current = !!video && !video.paused;
    video?.pause();
    ensureDrawRef.current();
    seek(event.clientX);
  };
  const moveSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current && event.pointerId === seekPointerRef.current) seek(event.clientX);
  };
  const endSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== seekPointerRef.current) return;
    disarmSeekFallback();
    finishSeek();
  };

  const press = (index: number, value: number) => {
    pressTargetRef.current[index] = value;
    ensureDrawRef.current();
  };
  const hover = (index: number, value: boolean) => {
    hoverRef.current[index] = value;
    ensureDrawRef.current();
  };

  return (
    <figure className="dg-video-demo">
      <div className="dg-video-demo__stage">
        <div
          ref={playerRef}
          className="dg-video-player"
          onMouseEnter={() => setControlsVisible(true)}
          onMouseLeave={() => setControlsVisible(false)}
          onFocusCapture={() => setControlsVisible(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setControlsVisible(false); }}
        >
          <img src="/assets/flowers-placeholder.webp" alt={text.poster} className="dg-video-player__placeholder" />
          <video
            ref={videoRef}
            src="/assets/flowers.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="dg-video-player__video"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <canvas ref={canvasRef} className="dg-video-player__canvas" style={{ opacity: ready ? 1 : 0 }} aria-label={text.canvas} role="img" />
          <div className="dg-video-player__controls" data-visible={controlsVisible && ready}>
            <button ref={(element) => { buttonRefs.current[0] = element; }} type="button" aria-label={text.rewind} className="dg-video-player__button dg-video-player__button--small" onClick={() => skip(-5)} onMouseEnter={() => hover(0, true)} onMouseLeave={() => { hover(0, false); press(0, 1); }} onPointerDown={() => press(0, 0.8)} onPointerUp={() => press(0, 1)} onPointerCancel={() => press(0, 1)}><SourceVideoIcon source={rewindSvg} /></button>
            <button ref={(element) => { buttonRefs.current[1] = element; }} type="button" aria-label={playing ? text.pause : text.play} className="dg-video-player__button dg-video-player__button--large" onClick={togglePlayback} onMouseEnter={() => hover(1, true)} onMouseLeave={() => { hover(1, false); press(1, 1); }} onPointerDown={() => press(1, 0.8)} onPointerUp={() => press(1, 1)} onPointerCancel={() => press(1, 1)}><SourceVideoIcon source={playing ? pauseSvg : playSvg} /></button>
            <button ref={(element) => { buttonRefs.current[2] = element; }} type="button" aria-label={text.forward} className="dg-video-player__button dg-video-player__button--small" onClick={() => skip(5)} onMouseEnter={() => hover(2, true)} onMouseLeave={() => { hover(2, false); press(2, 1); }} onPointerDown={() => press(2, 0.8)} onPointerUp={() => press(2, 1)} onPointerCancel={() => press(2, 1)}><SourceVideoIcon source={forwardSvg} /></button>
            <div ref={barRef} className="dg-video-player__bar" role="slider" aria-label={text.progress} aria-valuemin={0} aria-valuemax={videoRef.current?.duration || 0} onPointerDown={startSeek} onPointerMove={moveSeek} onPointerUp={endSeek} onPointerCancel={endSeek} onLostPointerCapture={endSeek}>
              <div className="dg-video-player__track"><div ref={progressRef} className="dg-video-player__progress" /></div>
            </div>
          </div>
        </div>
      </div>
      <figcaption>{text.caption}</figcaption>
    </figure>
  );
}
