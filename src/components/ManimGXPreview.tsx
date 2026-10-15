import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ManimGXBrowserAdapterV1, type ManimGXBrowserSessionV1 } from "../engines/manimgx-browser-adapter";
import type { Scene } from "../lib/store";
import { uid } from "../lib/store";

interface Props {
  projectId: string;
  scene: Scene;
}

/** The Python runtime remains in a cross-origin sandbox and never receives Studio storage or credentials. */
export function ManimGXPreview({ projectId, scene }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Подключение изолированного ManimGX runtime…");

  useEffect(() => {
    let cancelled = false;
    let session: ManimGXBrowserSessionV1 | undefined;
    const context = { projectId, sceneId: scene.id, revision: scene.currentRevision, requestId: uid() };
    const adapter = new ManimGXBrowserAdapterV1(true);
    void (async () => {
      const created = await adapter.createSession(context, (event) => {
        if (cancelled) return;
        if (event.type === "diagnostic") setMessage(event.message);
        if (event.type === "result" && event.result === "rendered") setMessage("ManimGX отрисовал сцену в изолированном runtime.");
      });
      if (!created.ok) { if (!cancelled) setMessage(created.message); return; }
      session = created.value;
      if (!host.current || cancelled) { await session.dispose(); return; }
      session.iframe.style.cssText = "width:100%;height:100%;border:0;background:#000";
      host.current.replaceChildren(session.iframe);
      const loaded = await adapter.loadScene(session, context, scene);
      if (!loaded.ok && !cancelled) setMessage(loaded.message);
    })();
    return () => { cancelled = true; void session?.dispose(); };
  }, [projectId, scene]);

  return (
    <div className="relative h-full bg-black">
      <div ref={host} className="h-full" />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-[11px] text-slate-200 backdrop-blur">
        <Loader2 size={12} className="animate-spin text-cyan-300" /> {message}
      </div>
    </div>
  );
}
