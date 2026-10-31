import { isJobActive, type RenderJob } from "../rendering/jobs";
import type { VideoArtifact } from "../rendering/video-artifacts";

const labels = { queued: "В очереди", running: "Выполняется", completed: "Готово", failed: "Ошибка", cancelled: "Отменено" };
interface Props {
  preview?: RenderJob | null;
  video?: RenderJob | null;
  artifact?: VideoArtifact | null;
  storageError?: string | null;
  onCancelPreview: () => void;
  onRetry: () => void;
  onCancelVideo: () => void;
  onDownloadLast: () => void;
}
export function RenderJobsPanel(p: Props) {
  return <section aria-label="Задачи рендеринга" className="shrink-0 space-y-1 border-t border-white/10 bg-slate-950 px-3 py-2 text-[11px] text-slate-200">
    {[p.preview, p.video].filter((job): job is RenderJob => !!job).map(job => <div key={job.requestId} data-testid={job.kind === "preview" ? "preview-job" : "export-job"} data-status={job.status}>
      <div className="flex items-center gap-2">
        <span className="font-medium">{job.kind === "preview" ? "Рендеринг" : "Экспорт MP4"}: {labels[job.status]}</span>
        {job.status === "running" && job.kind === "video-export" && <span>{Math.round(job.progress * 100)}%</span>}
        {job.startedAt && job.finishedAt && <span className="text-slate-400">{((job.finishedAt - job.startedAt) / 1000).toFixed(1)} с</span>}
        {isJobActive(job) && <button className="ml-auto rounded px-2 py-1 text-amber-200 hover:bg-white/10" onClick={job.kind === "preview" ? p.onCancelPreview : p.onCancelVideo} aria-label={job.kind === "preview" ? "Отменить рендеринг" : "Отменить экспорт"}>Отменить</button>}
        {job.kind === "preview" && (job.status === "failed" || job.status === "cancelled" || (!isJobActive(job) && (p.video?.status === "failed" || p.video?.status === "cancelled"))) && <button className="ml-auto rounded px-2 py-1 text-cyan-200 hover:bg-white/10" onClick={p.onRetry}>Повторить рендеринг</button>}
      </div>
      {job.error && <p className={job.status === "failed" ? "break-words text-red-300" : "text-slate-400"}>{job.error}</p>}
      {job.status === "running" && job.kind === "preview" && job.stage && <p className="text-slate-400">{job.stage}</p>}
      {(job.stdout || job.stderr) && <details className="text-slate-400"><summary className="cursor-pointer">Журнал Python</summary><pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words">{job.stdout && `stdout:\n${job.stdout}`}{job.stderr && `\nstderr:\n${job.stderr}`}</pre></details>}
    </div>)}
    {p.storageError && <p className="text-amber-200">{p.storageError}</p>}
    {p.artifact && <div className="flex flex-wrap items-center gap-x-3 text-slate-400">
      <button onClick={p.onDownloadLast} className="py-1 text-cyan-200 hover:underline">Скачать последнее успешное видео</button>
      <span>{p.artifact.width}×{p.artifact.height} · {p.artifact.duration.toFixed(1)} с</span>
    </div>}
  </section>;
}
