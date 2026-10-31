import type { EngineRequestContextV1 } from "../engines/contracts";

export type RenderJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export interface RenderJob extends EngineRequestContextV1 {
  kind: "preview" | "video-export";
  status: RenderJobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  progress: number;
  stage?: string;
  error?: string;
  stdout: string;
  stderr: string;
  /** Browser APIs do not expose the isolated Python process RSS. */
  peakMemoryMB: null;
}

export const isJobActive = (job?: RenderJob | null) => job?.status === "queued" || job?.status === "running";

/** One terminal transition, bounded logs and a deadline owned by the parent tab. */
export class RenderJobController {
  private controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private terminate: () => void = () => undefined;
  snapshot: RenderJob;
  get signal() { return this.controller.signal; }

  constructor(context: EngineRequestContextV1, kind: RenderJob["kind"], private changed: (job: RenderJob) => void) {
    this.snapshot = { ...context, kind, status: "queued", createdAt: Date.now(), progress: 0, stage: "Ожидает запуска", stdout: "", stderr: "", peakMemoryMB: null };
    changed(this.snapshot);
  }
  private update(patch: Partial<RenderJob>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.changed(this.snapshot);
  }
  start(timeoutMs: number, terminate: () => void) {
    if (this.snapshot.status !== "queued") return;
    this.terminate = terminate;
    this.update({ status: "running", startedAt: Date.now(), stage: "Запуск изолированного runtime…" });
    this.timer = setTimeout(() => this.fail(new DOMException(`Превышено время выполнения (${Math.round(timeoutMs / 1000)} с).`, "TimeoutError")), timeoutMs);
  }
  progress(value: number) {
    if (isJobActive(this.snapshot) && Number.isFinite(value)) this.update({ progress: Math.max(this.snapshot.progress, Math.min(1, Math.max(0, value))) });
  }
  stage(detail: string) { if (isJobActive(this.snapshot)) this.update({ stage: detail.slice(0, 200) }); }
  log(stream: "stdout" | "stderr", text: string) {
    if (isJobActive(this.snapshot)) this.update({ [stream]: (this.snapshot[stream] + text).slice(-64_000) });
  }
  complete() {
    if (!isJobActive(this.snapshot)) return false;
    clearTimeout(this.timer);
    this.update({ status: "completed", progress: 1, finishedAt: Date.now() });
    return true;
  }
  fail(error: unknown) { this.finish("failed", error instanceof Error ? error : new Error(String(error))); }
  cancel(message = "Задача отменена автором.") { this.finish("cancelled", new DOMException(message, "AbortError")); }
  private finish(status: "failed" | "cancelled", error: Error) {
    if (!isJobActive(this.snapshot)) return;
    clearTimeout(this.timer);
    this.update({ status, error: error.message, finishedAt: Date.now() });
    this.controller.abort(error);
    this.terminate();
  }
}
