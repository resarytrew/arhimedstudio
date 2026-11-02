import type { RenderedFrameInfoV1 } from "../engines/contracts";

export const GX_MP4_EXPORT_LIMITS = {
  durationSeconds: 180,
  frames: 10_800,
  pixels: 1920 * 1080,
  bytes: 512 * 1024 * 1024,
} as const;

export interface Mp4ExportPreflightIssue {
  code: "duration" | "frame-limit" | "canvas-size" | "odd-size" | "small-preview";
  blocking: boolean;
  message: string;
}

/**
 * Matches the pinned isolated ManimGX 0.1.1 runtime MP4 exporter.
 * This is advisory, based on observed preview canvas dimensions and duration.
 * It cannot infer future encoder failures, output size or unsupported GPU codecs.
 */
export function getMp4ExportPreflight(
  frame: RenderedFrameInfoV1 | null | undefined,
  fps = 30,
): Mp4ExportPreflightIssue[] {
  if (!frame) return [];
  const issues: Mp4ExportPreflightIssue[] = [];
  if (frame.duration > GX_MP4_EXPORT_LIMITS.durationSeconds) {
    issues.push({
      code: "duration", blocking: true,
      message: "Длительность " + frame.duration.toFixed(1) + " с превышает лимит текущего MP4-экспортёра: 180 с.",
    });
  }
  const frames = Math.ceil(frame.duration * fps);
  if (frames > GX_MP4_EXPORT_LIMITS.frames) {
    issues.push({
      code: "frame-limit", blocking: true,
      message: "Для экспорта требуется " + frames + " кадров. Текущий предел: 10 800.",
    });
  }
  const width = frame.width & ~1, height = frame.height & ~1;
  if (width * height > GX_MP4_EXPORT_LIMITS.pixels) {
    issues.push({
      code: "canvas-size", blocking: true,
      message: "Предпросмотр " + frame.width + "×" + frame.height + " превышает предел 2 073 600 пикселей для текущего экспорта.",
    });
  }
  if (width !== frame.width || height !== frame.height) {
    issues.push({
      code: "odd-size", blocking: false,
      message: "H.264 требует чётные размеры кадра: экспорт обрежет не более одного пикселя по каждой оси.",
    });
  }
  if (width * height < 1280 * 720) {
    issues.push({
      code: "small-preview", blocking: false,
      message: "Разрешение WebGPU-предпросмотра ниже 1280×720. Текущий экспортёр использует фактические размеры этого canvas, без повышения разрешения.",
    });
  }
  return issues;
}
