import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Repeat } from "lucide-react";
import { framAt, type Timeline } from "../engine/interpreter";
import { renderScene } from "../engine/renderer";
import { cn } from "../utils/cn";

export interface PlayerHandle {
  record: (filename: string, onProgress: (p: number) => void) => Promise<void>;
  snapshot: (filename: string) => void;
}

interface Props {
  timeline: Timeline | null;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
}

const W = 1280;
const H = 720;

const fmt = (t: number) => {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

export const Player = forwardRef<PlayerHandle, Props>(function Player(
  { timeline, autoPlay = true, loop: loopInit = false, controls = true, className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(autoPlay);
  const recordingRef = useRef(false);
  const holdRef = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [loop, setLoop] = useState(loopInit);
  const [speed, setSpeed] = useState(1);
  const loopRef = useRef(loop);
  const speedRef = useRef(speed);
  loopRef.current = loop;
  speedRef.current = speed;

  const draw = useCallback(
    (t: number) => {
      const c = canvasRef.current;
      if (!c || !timeline) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      try {
        renderScene(ctx, W, H, framAt(timeline, t), timeline.bg);
      } catch {
        /* ignore render glitches */
      }
    },
    [timeline]
  );

  const setPlay = (v: boolean) => {
    playingRef.current = v;
    setPlaying(v);
  };

  useEffect(() => {
    timeRef.current = 0;
    holdRef.current = 0;
    setTime(0);
    setPlay(autoPlay);
    draw(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!recordingRef.current && timeline) {
        if (playingRef.current) {
          const dur = Math.max(timeline.duration, 0.01);
          if (timeRef.current >= dur) {
            if (loopRef.current) {
              holdRef.current += dt;
              if (holdRef.current > 1.2) {
                holdRef.current = 0;
                timeRef.current = 0;
              }
            } else {
              setPlay(false);
            }
          } else {
            timeRef.current = Math.min(dur, timeRef.current + dt * speedRef.current);
          }
          draw(timeRef.current);
          setTime(timeRef.current);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeline, draw]);

  useImperativeHandle(
    ref,
    () => ({
      snapshot(filename) {
        const c = canvasRef.current;
        if (!c) return;
        const a = document.createElement("a");
        a.href = c.toDataURL("image/png");
        a.download = filename;
        a.click();
      },
      async record(filename, onProgress) {
        const c = canvasRef.current;
        if (!c || !timeline) return;
        if (typeof MediaRecorder === "undefined" || !c.captureStream) {
          throw new Error("Ваш браузер не поддерживает запись видео");
        }
        const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m)
        );
        const stream = c.captureStream(30);
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recordingRef.current = true;
        const total = timeline.duration + 0.6;
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.start(200);
          const start = performance.now();
          const step = () => {
            const t = (performance.now() - start) / 1000;
            draw(Math.min(t, timeline.duration));
            onProgress(Math.min(1, t / total));
            if (t >= total) rec.stop();
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        recordingRef.current = false;
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        timeRef.current = timeline.duration;
        setTime(timeline.duration);
        draw(timeline.duration);
        setPlay(false);
      },
    }),
    [timeline, draw]
  );

  const dur = timeline?.duration ?? 0;

  const toggle = () => {
    if (!timeline) return;
    if (!playing && timeRef.current >= dur) {
      timeRef.current = 0;
    }
    setPlay(!playing);
  };

  const seek = (t: number) => {
    timeRef.current = t;
    holdRef.current = 0;
    setTime(t);
    draw(t);
  };

  return (
    <div className={cn("group relative flex h-full w-full flex-col", className)}>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
        onClick={controls ? toggle : undefined}
      >
        <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 h-full w-full object-contain" />
        {controls && !playing && timeline && (
          <button
            className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
            aria-label="Воспроизвести"
          >
            {time >= dur ? <RotateCcw size={22} /> : <Play size={22} className="ml-0.5" />}
          </button>
        )}
      </div>
      {controls && (
        <div className="flex items-center gap-3 border-t border-black/5 bg-white px-3 py-2 text-xs text-slate-500 dark:border-white/5 dark:bg-slate-900 dark:text-slate-400">
          <button
            onClick={toggle}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white transition hover:bg-blue-600"
            aria-label={playing ? "Пауза" : "Воспроизвести"}
          >
            {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>
          <span className="w-9 tabular-nums">{fmt(time)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(dur, 0.01)}
            step={0.01}
            value={Math.min(time, dur)}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-blue-500"
          />
          <span className="w-9 tabular-nums">{fmt(dur)}</span>
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : s === 2 ? 0.5 : 1))}
            className="w-9 rounded-md py-1 text-center font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Скорость"
          >
            {speed}×
          </button>
          <button
            onClick={() => setLoop((l) => !l)}
            className={cn(
              "rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800",
              loop && "text-blue-500"
            )}
            title="Повтор"
          >
            <Repeat size={14} />
          </button>
        </div>
      )}
    </div>
  );
});
