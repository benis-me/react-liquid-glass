import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  GlassButton,
  GlassProgress,
  GlassSegmented,
  GlassStage,
  GlassSurface,
  GlassTextarea,
  GlassToast,
} from "refractive-glass-react/controls";
import type { PageProps } from "../site/Pages";
export function Focus({ locale }: PageProps) {
  const zh = locale === "zh";
  const [minutes, setMinutes] = useState("25"),
    [remaining, setRemaining] = useState(1500),
    [deadline, setDeadline] = useState(0),
    [finished, setFinished] = useState(false);
  const [note, setNote] = useState(() => {
    try {
      return localStorage.getItem("glass-focus-note") ?? "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("glass-focus-note", note);
    } catch {
      /* The current note remains available even when storage is disabled. */
    }
  }, [note]);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (!next) {
        setDeadline(0);
        setFinished(true);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline]);
  const reset = (value = minutes) => {
    setMinutes(value);
    setDeadline(0);
    setRemaining(Number(value) * 60);
    setFinished(false);
  };
  const toggle = () => {
    if (deadline) {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setDeadline(0);
    } else {
      const seconds = remaining || Number(minutes) * 60;
      setRemaining(seconds);
      setDeadline(Date.now() + seconds * 1000);
      setFinished(false);
    }
  };
  return (
    <GlassStage className="focus-scene" background="grid">
      <div className="focus-layout">
        <div className="focus-clock">
          <span className="eyebrow">
            {zh ? "一次，只做一件事。" : "ONE THING AT A TIME."}
          </span>
          <GlassSurface className="focus-clock__glass" radius={44}>
            <span
              className="focus-time"
              role="timer"
              aria-label={zh ? "剩余时间" : "Time remaining"}
            >
              {String(Math.floor(remaining / 60)).padStart(2, "0")}
              <span>:</span>
              {String(remaining % 60).padStart(2, "0")}
            </span>
          </GlassSurface>
          <span className="focus-state" role="status">
            {deadline
              ? zh
                ? "专注进行中"
                : "A little space to focus"
              : remaining === 0
                ? zh
                  ? "做得不错，休息一下。"
                  : "Well done. Take a breath."
                : zh
                  ? "准备好时，再开始。"
                  : "Start when you are ready."}
          </span>
          <div className="example-row">
            <GlassButton variant="solid" onClick={toggle}>
              {deadline ? <Pause size={15} /> : <Play size={15} />}
              {deadline
                ? zh
                  ? "暂停"
                  : "Pause"
                : zh
                  ? "开始专注"
                  : "Start focus"}
            </GlassButton>
            <GlassButton
              onClick={() => reset()}
              aria-label={zh ? "重置计时" : "Reset timer"}
            >
              <RotateCcw size={15} />
            </GlassButton>
          </div>
          <GlassProgress
            value={Number(minutes) * 60 - remaining}
            max={Number(minutes) * 60}
            label={zh ? "专注进度" : "Focus progress"}
          />
          <GlassSegmented
            value={minutes}
            onValueChange={reset}
            items={[
              { value: "5", label: zh ? "5 分钟" : "5 min" },
              { value: "25", label: zh ? "25 分钟" : "25 min" },
              { value: "50", label: zh ? "50 分钟" : "50 min" },
            ]}
            ariaLabel={zh ? "专注时长" : "Focus duration"}
          />
        </div>
        <div className="focus-note">
          <span className="eyebrow">{zh ? "留在这里" : "KEEP IT HERE"}</span>
          <h2>{zh ? "把脑中的杂音，放下来。" : "Put the noise on paper."}</h2>
          <GlassTextarea
            label={zh ? "此刻的想法" : "On your mind"}
            placeholder={
              zh ? "接下来，只需要……" : "For now, all I need to do is…"
            }
            rows={8}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <span className="doc-note">
            {zh
              ? "笔记保存在当前浏览器。离开本页会结束计时。"
              : "Notes stay in this browser. Leaving this page ends the timer."}
          </span>
        </div>
      </div>
      <GlassToast
        open={finished}
        title={zh ? "这一段专注，完成了。" : "That was time well spent."}
        onClose={() => setFinished(false)}
        closeLabel={zh ? "关闭" : "Close"}
      />
    </GlassStage>
  );
}
