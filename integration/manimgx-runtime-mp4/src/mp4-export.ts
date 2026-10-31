/**
 * Drop-in module for arhimed-runtime/arhimed-runtime.github.io.
 *
 * The isolated runtime owns the WebGPU canvas; the Studio parent never reads it.
 * Mediabunny muxes AVC/H.264 frames to a real ISO-BMFF MP4 (not a renamed WebM).
 *
 * Install in the runtime repository: npm install --save-exact mediabunny
 */
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from "mediabunny";

export const MP4_MAX_BYTES = 512 * 1024 * 1024;
const MAX_DURATION_SECONDS = 180;
const MAX_FRAMES = 10800;
const MAX_PIXELS = 1920 * 1080;

interface GXPlayer extends HTMLElement {
  readonly duration: number;
  currentTime: number;
  readonly paused: boolean;
  pause(): void;
  play(): void;
}

export interface ExportSettings {
  fps: number;
  signal: AbortSignal;
  onProgress: (value: number) => void;
}

function cancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("MP4 export cancelled.", "AbortError");
}

/** Capture after the player's queued draw, before WebGPU presents and clears its canvas. */
function captureNextDraw(signal: AbortSignal, capture: () => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Export cancelled.", "AbortError"));
    let done = false;
    const abort = () => {
      if (done) return;
      done = true;
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Export cancelled.", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    requestAnimationFrame(() => {
      if (done) return;
      done = true;
      signal.removeEventListener("abort", abort);
      try {
        capture();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Export the already-rendered ManimGX scene in isolated-runtime memory.
 *
 * The native player exposes seek via currentTime, but does not expose a direct
 * synchronous offline-render method. We therefore seek each exact timestamp
 * and copy the canvas after drawing but before WebGPU presentation. Playback speed and
 * encoding speed may differ; encoded timestamps remain evenly spaced.
 *
 * Current limitations: visual track only; source resolution is the WebGPU canvas
 * as currently sized by the player (never silently upscale a 720p preview to 4K).
 */
export async function exportManimGXMp4(element: HTMLElement, options: ExportSettings): Promise<ArrayBuffer> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new Error("This browser does not support WebCodecs H.264 encoding.");
  }
  const player = element as GXPlayer;
  const duration = player.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Finish rendering the ManimGX scene before exporting.");
  }
  if (duration > MAX_DURATION_SECONDS) {
    throw new Error("This MP4 exporter currently supports scenes up to 180 seconds.");
  }
  if (!Number.isInteger(options.fps) || ![24, 25, 30, 50, 60].includes(options.fps)) {
    throw new Error("Unsupported export FPS; choose 24, 25, 30, 50 or 60.");
  }
  const source = player.shadowRoot?.querySelector("canvas") as HTMLCanvasElement | null;
  if (!source || source.width < 2 || source.height < 2) {
    throw new Error("The ManimGX WebGPU canvas is not ready.");
  }
  // AVC/H.264 requires dimensions divisible by two; crop at most one display pixel.
  const width = source.width & ~1;
  const height = source.height & ~1;
  if (width * height > MAX_PIXELS) {
    throw new Error("Preview resolution exceeds 1920×1080; reduce the displayed player size.");
  }
  const frames = Math.max(1, Math.ceil(duration * options.fps));
  if (frames > MAX_FRAMES) throw new Error("Too many frames for the memory-limited MP4 exporter.");

  const capture = document.createElement("canvas");
  capture.width = width;
  capture.height = height;
  const context = capture.getContext("2d", { alpha: false });
  if (!context) throw new Error("Cannot create the MP4 capture canvas.");
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const track = new CanvasSource(capture, {
    codec: "avc",
    quality: new Quality({ bitrate: width * height > 1280 * 720 ? 12_000_000 : 8_000_000 }),
  });
  output.addVideoTrack(track, { frameRate: options.fps });

  const wasPaused = player.paused;
  const originalTime = player.currentTime;
  let started = false;
  let finished = false;
  player.pause();
  try {
    cancelled(options.signal);
    await output.start();
    started = true;
    for (let frame = 0; frame < frames; frame += 1) {
      cancelled(options.signal);
      const time = frame / options.fps;
      player.currentTime = time;
      // currentTime queues the native player's draw first. Copy in the next
      // callback of that SAME animation frame; waiting for a second frame reads
      // an already-presented WebGPU drawing buffer and produces black video.
      await captureNextDraw(options.signal, () => {
        context.drawImage(source, 0, 0, width, height, 0, 0, width, height);
      });
      cancelled(options.signal);
      await track.add(time, 1 / options.fps);
      cancelled(options.signal);
      if (frame % Math.max(1, Math.floor(options.fps / 2)) === 0 || frame === frames - 1) {
        options.onProgress((frame + 1) / frames);
      }
    }
    await output.finalize();
    finished = true;
    cancelled(options.signal);
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength < 12 || buffer.byteLength > MP4_MAX_BYTES) {
      throw new Error("MP4 output is empty or exceeds the 512 MiB transfer limit.");
    }
    const view = new Uint8Array(buffer, 4, 4);
    if (String.fromCharCode(...view) !== "ftyp") {
      throw new Error("MP4 muxer produced invalid ISO BMFF data.");
    }
    return buffer;
  } finally {
    // Never leave the preview stuck at the last exported frame.
    try {
      player.pause();
      player.currentTime = originalTime;
      if (!wasPaused) player.play();
    } catch { /* iframe may have been disposed by a newer run */ }
    if (started && !finished) {
      try { await output.cancel(); } catch { /* preserve original failure */ }
    }
  }
}
