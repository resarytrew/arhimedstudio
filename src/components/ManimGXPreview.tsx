import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ManimGXBrowserAdapterV1, type ManimGXBrowserSessionV1 } from "../engines/manimgx-browser-adapter";
import type { Scene } from "../lib/store";
import { uid } from "../lib/store";

interface Props {
  projectId: string;
  scene: Scene;
  onDiagnostic?: (message: string) => void;
  onMp4ExportCapabilityChange?: (available: boolean) => void;
}

export interface ManimGXPreviewHandle {
  exportMp4: (filename: string, onProgress: (value: number) => void) => Promise<void>;
}

/** The Python runtime remains in a cross-origin sandbox and never receives Studio storage or credentials. */
export const ManimGXPreview = forwardRef<ManimGXPreviewHandle, Props>(function ManimGXPreview({ projectId, scene, onDiagnostic, onMp4ExportCapabilityChange }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const diagnosticHandler = useRef(onDiagnostic);
  const capabilityHandler = useRef(onMp4ExportCapabilityChange);
  const sessionRef = useRef<ManimGXBrowserSessionV1 | undefined>(undefined);
  const adapterRef = useRef<ManimGXBrowserAdapterV1 | undefined>(undefined);
  diagnosticHandler.current = onDiagnostic;
  capabilityHandler.current = onMp4ExportCapabilityChange;
  const [message, setMessage] = useState<string | null>("Подключение изолированного ManimGX runtime…");

  useImperativeHandle(ref, () => ({
    async exportMp4(filename, onProgress) {
      const session = sessionRef.current;
      const adapter = adapterRef.current;
      if (!session || !adapter) throw new Error("ManimGX ещё не готов к экспорту.");
      const file = await adapter.exportMp4(session, {
        projectId,
        sceneId: scene.id,
        revision: scene.currentRevision,
        requestId: uid(),
      }, { onProgress });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
    },
  }), [projectId, scene.id, scene.currentRevision]);

  useEffect(() => {
    let cancelled = false;
    let session: ManimGXBrowserSessionV1 | undefined;
    setMessage("Подключение изолированного ManimGX runtime…");
    capabilityHandler.current?.(false);
    const context = { projectId, sceneId: scene.id, revision: scene.currentRevision, requestId: uid() };
    const adapter = new ManimGXBrowserAdapterV1(true);
    adapterRef.current = adapter;
    void (async () => {
      const created = await adapter.createSession(context, (event) => {
        if (cancelled) return;
        if (event.type === "diagnostic") {
          setMessage(event.message);
          diagnosticHandler.current?.(event.message);
        }
        if (event.type === "result" && event.result === "rendered") setMessage(null);
      });
      if (!created.ok) { if (!cancelled) setMessage(created.message); return; }
      session = created.value;
      sessionRef.current = session;
      if (!host.current || cancelled) { await session.dispose(); return; }
      session.iframe.style.cssText = "width:100%;height:100%;border:0;background:#000";
      host.current.replaceChildren(session.iframe);
      const loaded = await adapter.loadScene(session, context, scene);
      if (!loaded.ok && !cancelled) {
        setMessage(loaded.message);
        diagnosticHandler.current?.(loaded.message);
      }
      if (!cancelled) capabilityHandler.current?.(session.supportsMp4Export);
    })();
    return () => {
      cancelled = true;
      capabilityHandler.current?.(false);
      if (sessionRef.current === session) sessionRef.current = undefined;
      if (adapterRef.current === adapter) adapterRef.current = undefined;
      void session?.dispose();
    };
  }, [projectId, scene]);

  return (
    <div className="relative h-full bg-black">
      <div ref={host} className="h-full" />
      {message && <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-[11px] text-slate-200 backdrop-blur">
        <Loader2 size={12} className="animate-spin text-cyan-300" /> {message}
      </div>}
    </div>
  );
});
