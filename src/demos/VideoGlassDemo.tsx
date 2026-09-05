import { stepSpring, SIDE_BUTTON_SPRING, PLAY_BUTTON_SPRING, BAR_DRAG_SPRING, BUTTON_HOVER_SCALE } from "../lib/apple-motion";
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
import { createLiquidGlassRenderer, type LiquidGlassBlob } from "../lib/liquid-glass/renderer";
import { usePointerReleaseFallback } from "../lib/apple-motion/use-pointer-release-fallback";

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

const copy = {
  zh: {
    poster: "花田视频画面",
    canvas: "经过玻璃控件折射的视频",
    rewind: "后退 15 秒",
    pause: "暂停",
    play: "播放",
    forward: "前进 15 秒",
    progress: "播放进度",
    caption: "玻璃效果同样可以应用在视频播放器等复杂交互内容上。",
  },
  en: {
    poster: "Flower field video frame",
    canvas: "Video refracted through glass controls",
    rewind: "Rewind 15 seconds",
    pause: "Pause",
    play: "Play",
    forward: "Forward 15 seconds",
    progress: "Playback progress",
    caption: "Glass also works with complex interactive media such as video players.",
  },
} as const;

function seekRubberBand(distance: number, limit: number) {
  const magnitude = Math.abs(distance);
  if (magnitude === 0) return 0;
  return Math.sign(distance) * limit * (1 - 1 / (magnitude / limit + 1));
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
    const renderer = createLiquidGlassRenderer(canvas, { onRestore: () => ensureDrawRef.current() });
    canvas.dataset.dgRenderer = "liquid-webgl2";
    let sourceRevision = 0;
    const blobs: LiquidGlassBlob[] = Array.from({ length: 4 }, () => ({ x: .5, y: .5, radius: 1 }));
    const videoFrameApi = video as unknown as VideoFrameApi;
    const requestVideoFrame = videoFrameApi.requestVideoFrameCallback?.bind(video);
    const cancelVideoFrame = videoFrameApi.cancelVideoFrameCallback?.bind(video);
    let visible = true;
    let inViewport = true;
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
      if (uploadVideo || textureDirtyRef.current || !textureReady) {
        sourceRevision++;
        textureReady = true;
        textureDirtyRef.current = false;
      }
      for (let index = 0; index < 3; index++) {
        const circle = layout.circles[index];
        blobs[index].x = circle[0] / width;
        blobs[index].y = circle[1] / height;
        blobs[index].radius = circle[2] * pressRef.current[index];
      }
      const barStretch = barStretchRef.current;
      const barWidth = layout.bar[2] + Math.abs(barStretch);
      const barCenterX = layout.bar[0] + barStretch * 0.5;
      blobs[3].x = barCenterX / width;
      blobs[3].y = layout.bar[1] / height;
      blobs[3].radius = layout.bar[4];
      blobs[3].halfWidth = barWidth / 2;
      blobs[3].halfHeight = layout.bar[3] / 2;
      const bar = barRef.current;
      if (bar) {
        bar.style.transformOrigin = barStretch >= 0 ? "0 50%" : "100% 50%";
        bar.style.transform = `scaleX(${1 + Math.abs(barStretch) / layout.bar[2]})`;
      }
      renderer.draw({
        source: video, sourceRevision, width, height, blobs, pixelRatio: ratio,
        opacity: strengthRef.current, edgeDepth: 9, tintStrength: .045,
        shadowStrength: .11, mergeDistance: 32,
      });
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

    const resizeObserver = new ResizeObserver(() => {
      previousDrawTime = performance.now();
      ensureDraw();
    });
    resizeObserver.observe(player);

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

    const updateVisibility = () => {
      const next = inViewport && !document.hidden;
      if (visible === next) return;
      visible = next;
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
    };
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      updateVisibility();
    }, { rootMargin: "120px 0px" });
    visibilityObserver.observe(player);
    document.addEventListener("visibilitychange", updateVisibility);
    updateVisibility();
    ensureDraw();

    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      ensureDrawRef.current = () => undefined;
      cancelScheduled();
      renderer.dispose();
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
            <button ref={(element) => { buttonRefs.current[0] = element; }} type="button" aria-label={text.rewind} className="dg-video-player__button dg-video-player__button--small" onClick={() => skip(-15)} onMouseEnter={() => hover(0, true)} onMouseLeave={() => { hover(0, false); press(0, 1); }} onPointerDown={() => press(0, 0.8)} onPointerUp={() => press(0, 1)} onPointerCancel={() => press(0, 1)}><SourceVideoIcon source={rewindSvg} /></button>
            <button ref={(element) => { buttonRefs.current[1] = element; }} type="button" aria-label={playing ? text.pause : text.play} className="dg-video-player__button dg-video-player__button--large" onClick={togglePlayback} onMouseEnter={() => hover(1, true)} onMouseLeave={() => { hover(1, false); press(1, 1); }} onPointerDown={() => press(1, 0.8)} onPointerUp={() => press(1, 1)} onPointerCancel={() => press(1, 1)}><SourceVideoIcon source={playing ? pauseSvg : playSvg} /></button>
            <button ref={(element) => { buttonRefs.current[2] = element; }} type="button" aria-label={text.forward} className="dg-video-player__button dg-video-player__button--small" onClick={() => skip(15)} onMouseEnter={() => hover(2, true)} onMouseLeave={() => { hover(2, false); press(2, 1); }} onPointerDown={() => press(2, 0.8)} onPointerUp={() => press(2, 1)} onPointerCancel={() => press(2, 1)}><SourceVideoIcon source={forwardSvg} /></button>
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
