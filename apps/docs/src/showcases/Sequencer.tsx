import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, type MotionValue } from "motion/react";
import { Pause, Play, Shuffle, Trash2 } from "lucide-react";
import {
  GlassButton,
  GlassButtonGroup,
  GlassSelect,
  GlassSlider,
  GlassStage,
  GlassToggle,
} from "refractive-glass-react/controls";
import type { PageProps } from "../site/Pages";
const pitches = [523.25, 392, 329.63, 261.63];
const names = ["C5", "G4", "E4", "C4"];
const initial = [8, 0, 4, 0, 2, 4, 1, 2];

// The playhead is foreground ink. Moving it must not rebuild 32 glass backdrops.
function SequenceCursor({ position }: { position: MotionValue<number> }) {
  const [step, setStep] = useState(position.get());
  useEffect(() => position.on("change", setStep), [position]);
  const column = Math.max(0, step) + 2;
  return <>
    <span className="sequence-cursor step-label is-playing" aria-hidden style={{ gridColumn: `${column} / span 1`, gridRow: "1 / span 1", visibility: step < 0 ? "hidden" : "visible" }}>{String(step + 1).padStart(2, "0")}</span>
    {names.map((name, row) => <span key={name} className="sequence-cursor sequence-cursor--key" aria-hidden style={{ gridColumn: `${column} / span 1`, gridRow: `${row + 2} / span 1`, visibility: step < 0 ? "hidden" : "visible" }} />)}
  </>;
}

const SequenceKey = memo(function SequenceKey({ row, column, pressed, zh, onToggle }: {
  row: number; column: number; pressed: boolean; zh: boolean; onToggle: (row: number, column: number) => void;
}) {
  return <GlassToggle className="sequencer-key" pressed={pressed}
    aria-label={`${names[row]}, ${zh ? "第" : "step"} ${column + 1}${zh ? "拍" : ""}`}
    onPressedChange={() => onToggle(row, column)}><span aria-hidden="true" /></GlassToggle>;
});

const SequenceGrid = memo(function SequenceGrid({ pattern, position, zh, onToggle }: {
  pattern: number[]; position: MotionValue<number>; zh: boolean; onToggle: (row: number, column: number) => void;
}) {
  return <div className="sequencer-grid" role="group" aria-label={zh ? "音序网格" : "Note sequencer"}>
    <span />
    {pattern.map((_, column) => <span key={column} className="step-label">{String(column + 1).padStart(2, "0")}</span>)}
    {names.map((name, row) => <div className="sequencer-row" key={name}>
      <span className="note-label">{name}</span>
      {pattern.map((mask, column) => <SequenceKey key={column} row={row} column={column} pressed={!!(mask & (1 << row))} zh={zh} onToggle={onToggle} />)}
    </div>)}
    <SequenceCursor position={position} />
  </div>;
});

export function Sequencer({ locale }: PageProps) {
  const zh = locale === "zh";
  const [pattern, setPattern] = useState(initial),
    [bpm, setBpm] = useState(108),
    [volume, setVolume] = useState(35),
    [wave, setWave] = useState<OscillatorType>("sine"),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState("");
  const step = useMotionValue(-1);
  const toggleNote = useCallback((row: number, column: number) => {
    setPattern(current => current.map((value, index) => index === column ? value ^ (1 << row) : value));
  }, []);
  const audio = useRef<AudioContext | null>(null),
    voices = useRef(new Set<OscillatorNode>()),
    values = useRef({ pattern, bpm, volume, wave });
  values.current = { pattern, bpm, volume, wave };
  useEffect(() => {
    const context = audio.current;
    if (!playing || !context) return;
    let nextTime = context.currentTime + 0.06,
      index = 0;
    const visualTimers = new Set<number>();
    const schedule = () => {
      while (nextTime < context.currentTime + 0.12) {
        const {
          pattern: notes,
          bpm: tempo,
          volume: level,
          wave: shape,
        } = values.current;
        const activeStep = index;
        for (let note = 0; note < pitches.length; note++)
          if (notes[index] & (1 << note)) {
            const oscillator = context.createOscillator(),
              gain = context.createGain();
            oscillator.type = shape;
            oscillator.frequency.value = pitches[note];
            gain.gain.setValueAtTime(0, nextTime);
            gain.gain.linearRampToValueAtTime(
              (level / 100) * 0.13,
              nextTime + 0.012,
            );
            gain.gain.exponentialRampToValueAtTime(0.0001, nextTime + 0.35);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(nextTime);
            oscillator.stop(nextTime + 0.4);
            voices.current.add(oscillator);
            oscillator.onended = () => {
              oscillator.disconnect();
              gain.disconnect();
              voices.current.delete(oscillator);
            };
          }
        const timer = window.setTimeout(
          () => {
            step.set(activeStep);
            visualTimers.delete(timer);
          },
          Math.max(0, (nextTime - context.currentTime) * 1000),
        );
        visualTimers.add(timer);
        nextTime += 60 / tempo / 2;
        index = (index + 1) % 8;
      }
    };
    schedule();
    const timer = window.setInterval(schedule, 25);
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      clearInterval(timer);
      visualTimers.forEach(clearTimeout);
      voices.current.forEach((voice) => {
        try {
          voice.stop();
        } catch {
          /* Already ended. */
        }
      });
      voices.current.clear();
      step.set(-1);
      document.removeEventListener("visibilitychange", pause);
    };
  }, [playing, step]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const toggle = async () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setPlaying(true);
      setError("");
    } catch {
      setError(
        zh
          ? "当前浏览器无法启动音频。"
          : "Audio could not start in this browser.",
      );
    }
  };
  return (
    <GlassStage className="sequencer-scene" background="plain">
      <div className="sequencer-header">
        <div>
          <span className="eyebrow">
            {zh ? "八个节拍 / 四个音符" : "EIGHT STEPS / FOUR NOTES"}
          </span>
          <h2>{zh ? "轻轻敲出一点节奏。" : "A little rhythm, in glass."}</h2>
        </div>
        <output className="sequencer-tempo">
          {bpm}
          <small>BPM</small>
        </output>
      </div>
      <SequenceGrid pattern={pattern} position={step} zh={zh} onToggle={toggleNote} />
      <div className="sequencer-transport">
        <GlassButtonGroup label={zh ? "播放操作" : "Playback controls"}>
          <GlassButton variant="solid" onClick={toggle}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? (zh ? "暂停" : "Pause") : zh ? "播放" : "Play"}
          </GlassButton>
          <GlassButton
            aria-label={zh ? "随机旋律" : "Shuffle pattern"}
            onClick={() =>
              setPattern(
                Array.from({ length: 8 }, () =>
                  Math.random() > 0.25 ? 1 << Math.floor(Math.random() * 4) : 0,
                ),
              )
            }
          >
            <Shuffle size={15} />
          </GlassButton>
          <GlassButton
            aria-label={zh ? "清空旋律" : "Clear pattern"}
            onClick={() => setPattern(Array(8).fill(0))}
          >
            <Trash2 size={15} />
          </GlassButton>
        </GlassButtonGroup>
        <GlassSelect
          label={zh ? "音色" : "Voice"}
          value={wave}
          onChange={(event) => setWave(event.target.value as OscillatorType)}
        >
          <option value="sine">{zh ? "柔和" : "Soft sine"}</option>
          <option value="triangle">{zh ? "温暖" : "Warm triangle"}</option>
        </GlassSelect>
      </div>
      <div className="sequencer-mix">
        <label>
          <span>
            {zh ? "速度" : "Tempo"}
            <output>{bpm} BPM</output>
          </span>
          <GlassSlider
            min={60}
            max={160}
            value={bpm}
            onValueChange={setBpm}
            ariaLabel={zh ? "速度" : "Tempo"}
          />
        </label>
        <label>
          <span>
            {zh ? "音量" : "Volume"}
            <output>{volume}%</output>
          </span>
          <GlassSlider
            value={volume}
            onValueChange={setVolume}
            ariaLabel={zh ? "音量" : "Volume"}
          />
        </label>
      </div>
      <p className="doc-note" role="status">
        {error ||
          (zh
            ? "选择音符，再点播放。声音由浏览器实时合成。"
            : "Pick a few notes, then press play. Sound is synthesized in your browser.")}
      </p>
    </GlassStage>
  );
}
