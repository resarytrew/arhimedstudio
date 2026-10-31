import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ManimGXBrowserAdapterV1, type ManimGXBrowserSessionV1 } from "../engines/manimgx-browser-adapter";
import type { Scene } from "../lib/store";
import { uid } from "../lib/store";
import { isJobActive, RenderJobController, type RenderJob } from "../rendering/jobs";

interface Props {
  projectId: string;
  scene: Scene;
  onDiagnostic?: (message: string) => void;
  onMp4ExportCapabilityChange?: (available: boolean) => void;
  onJobChange?: (job: RenderJob) => void;
}
export interface ManimGXPreviewHandle {
  exportMp4: (onProgress: (value: number) => void, signal: AbortSignal) => Promise<Blob>;
  cancelRender: () => void;
  retryRender: () => void;
}

/** Parent-owned deadlines can destroy the iframe even while Python loops in its Worker. */
export const ManimGXPreview = forwardRef<ManimGXPreviewHandle, Props>(function ManimGXPreview(props, ref) {
  const { projectId, scene } = props;
  const callbacks = useRef(props); callbacks.current = props;
  const host = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ManimGXBrowserSessionV1 | undefined>(undefined);
  const adapterRef = useRef(new ManimGXBrowserAdapterV1(true));
  const jobRef = useRef<RenderJobController | undefined>(undefined);
  const requestRef = useRef("");
  const [retry, setRetry] = useState(0);
  const [jobState, setJobState] = useState<RenderJob | null>(null);

  const terminate = () => {
    void sessionRef.current?.dispose();
    sessionRef.current = undefined;
    callbacks.current.onMp4ExportCapabilityChange?.(false);
  };

  useImperativeHandle(ref, () => ({
    async exportMp4(onProgress, signal) {
      const session = sessionRef.current;
      if (!session || session.disposed) throw new Error("ManimGX ещё не готов к экспорту. Повторите рендеринг.");
      return adapterRef.current.exportMp4(session, { projectId, sceneId: scene.id, revision: scene.currentRevision, requestId: uid() }, { onProgress, signal });
    },
    cancelRender: () => jobRef.current?.cancel(),
    retryRender: () => setRetry(value => value + 1),
  }), [projectId, scene.id, scene.currentRevision]);

  useEffect(() => {
    return () => { jobRef.current?.cancel("Сцена закрыта."); terminate(); };
  }, [projectId, scene.id]);

  useEffect(() => {
    const context = { projectId, sceneId: scene.id, revision: scene.currentRevision, requestId: uid() };
    requestRef.current = context.requestId;
    const job = new RenderJobController(context, "preview", snapshot => {
      if (requestRef.current !== snapshot.requestId) return;
      setJobState(snapshot);
      callbacks.current.onJobChange?.(snapshot);
    });
    jobRef.current = job;
    callbacks.current.onDiagnostic?.("");
    callbacks.current.onMp4ExportCapabilityChange?.(false);
    if (!scene.source.trim()) {
      job.cancel("Добавьте код сцены, чтобы запустить превью.");
      return () => job.cancel("Сцена очищена.");
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        job.start(5 * 60_000, terminate);
        try {
          let session = sessionRef.current;
          if (!session || session.disposed) {
            const created = await adapterRef.current.createSession(context, event => {
              if (event.type === "state" && event.state === "disposed") callbacks.current.onMp4ExportCapabilityChange?.(false);
              const current = jobRef.current;
              if (!current || event.requestId !== current.snapshot.requestId || !isJobActive(current.snapshot)) return;
              if (event.type === "diagnostic" && event.severity === "info") current.stage(event.message);
              if (event.type === "log") current.log(event.stream, event.text);
              if (event.type === "diagnostic" && event.severity === "error") {
                current.log("stderr", event.message);
                current.fail(new Error(event.message));
                callbacks.current.onDiagnostic?.(event.message);
              }
              if (event.type === "result" && event.result === "rendered") {
                current.complete();
                callbacks.current.onMp4ExportCapabilityChange?.(sessionRef.current?.supportsMp4Export === true);
              }
            });
            if (!created.ok) throw new Error(created.message);
            session = created.value;
            if (job.signal.aborted || requestRef.current !== context.requestId || !host.current) { await session.dispose(); return; }
            sessionRef.current = session;
            session.iframe.style.cssText = "width:100%;height:100%;border:0;background:#000";
            host.current.replaceChildren(session.iframe);
          }
          const loaded = await adapterRef.current.loadScene(session, context, { source: scene.source, language: "python", dialect: "manimgx-0.1.1", entrypoint: "Scene.construct" });
          if (job.signal.aborted) return;
          if (!loaded.ok) throw new Error(loaded.message);
        } catch (error) {
          if (!job.signal.aborted) {
            job.fail(error);
            callbacks.current.onDiagnostic?.(error instanceof Error ? error.message : String(error));
          }
        }
      })();
    }, 350);
    return () => { window.clearTimeout(timer); job.cancel("Запуск заменён новой ревизией сцены."); };
  }, [projectId, scene.id, scene.currentRevision, scene.source, retry]);

  return <div className="relative h-full bg-black">
    <div ref={host} className="h-full" />
    {isJobActive(jobState) && <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-[11px] text-slate-200">
      <Loader2 size={12} className="animate-spin text-cyan-300" /> {jobState?.status === "queued" ? "Рендеринг в очереди…" : jobState?.stage ?? "Выполнение сцены ManimGX…"}
    </div>}
  </div>;
});
