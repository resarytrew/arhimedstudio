import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { AlertTriangle, Braces, Camera, Check, CircleCheck, Clapperboard, Copy, Download, FileDown, Loader2, Maximize2, Minimize2, Wand2, X } from "lucide-react";
import { ChatPanel } from "../components/ChatPanel";
import { CodeEditor } from "../components/CodeEditor";
import { IconBtn, Panel } from "../components/Panel";
import { Player, type PlayerHandle } from "../components/Player";
import { ManimGXPreview } from "../components/ManimGXPreview";
import { SettingsModal } from "../components/SettingsModal";
import { Sidebar, type PanelId } from "../components/Sidebar";
import type { Timeline } from "../engine/interpreter";
import { loadEngineFonts } from "../engine/fonts";
import type { LLMSettings } from "../lib/assistant";
import { WELCOME_CODE } from "../lib/templates";
import { aiOrchestrator } from "../ai/orchestrator";
import { ArhimedCanvasAdapterV1 } from "../engines/canvas-adapter";
import {
  ACTIVE_KEY,
  acceptAiCandidate,
  activeScene,
  addAiCandidate,
  initialActiveProjectId,
  initialLLM,
  initialProjects,
  LLM_KEY,
  newProject,
  PROJECTS_KEY,
  setActiveSceneEngine,
  uid,
  updateSceneSource,
  usePersistent,
  type Message,
  type Project,
} from "../lib/store";
import { cn } from "../utils/cn";

interface Props {
  dark: boolean;
  onToggleTheme: () => void;
  onHome: () => void;
}

export default function Studio({ dark, onToggleTheme, onHome }: Props) {
  const [projects, setProjects] = usePersistent<Project[]>(PROJECTS_KEY, initialProjects);
  const [activeId, setActiveId] = usePersistent<string>(ACTIVE_KEY, initialActiveProjectId);
  const [llmPreferences, setLlmPreferences] = usePersistent(LLM_KEY, initialLLM);
  const [apiKey, setApiKey] = useState("");
  const llm: LLMSettings = { ...llmPreferences, apiKey };
  const active = projects.find((p) => p.id === activeId) ?? projects[0];

  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [error, setError] = useState<{ msg: string; line: number } | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [booting, setBooting] = useState(true);
  const lastGood = useRef<string>("");

  const [thinking, setThinking] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const canvasAdapter = useRef(new ArhimedCanvasAdapterV1());

  const [hidden, setHidden] = useState<PanelId[]>([]);
  const [maxed, setMaxed] = useState<PanelId | null>(null);
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 1100);
  const [split, setSplit] = useState(0.46);
  const [vsplit, setVsplit] = useState(0.55);
  const mainRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recording, setRecording] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewCandidateId, setReviewCandidateId] = useState<string | null>(null);
  const playerRef = useRef<PlayerHandle>(null);
  const previewSurfaceRef = useRef<HTMLDivElement>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  useEffect(() => {
    if (!projects.length) {
      const p = newProject("Пример видео", WELCOME_CODE);
      setProjects([p]);
      setActiveId(p.id);
    } else if (!projects.some((p) => p.id === activeId)) setActiveId(projects[0].id);
  }, [projects, activeId, setProjects, setActiveId]);

  useEffect(() => {
    const t0 = performance.now();
    loadEngineFonts().then(() => {
      const wait = Math.max(0, 1100 - (performance.now() - t0));
      setTimeout(() => {
        setFontsReady(true);
        setBooting(false);
      }, wait);
    });
  }, []);

  const scene = activeScene(active);
  const code = active?.code ?? "";
  const hasSceneSource = scene.source.trim().length > 0;
  const visibleTimeline = scene.engineId === "arhimed-canvas" && hasSceneSource ? timeline : null;
  const visibleError = scene.engineId === "arhimed-canvas" && hasSceneSource ? error : null;
  const reviewCandidate = reviewCandidateId && active
    ? scene.revisions.find((revision) => revision.id === reviewCandidateId && revision.kind === "ai-candidate")
    : undefined;
  const displayedCode = reviewCandidate?.source ?? code;

  // Canvas stays the default engine, now through EngineAdapterV1 rather than a universal scene format.
  useEffect(() => {
    if (!fontsReady || !active) return;
    const scene = activeScene(active);
    // A project switch must not leak the previous scene's frame or diagnostics.
    setTimeline(null);
    setError(null);
    lastGood.current = "";
    if (!scene.source.trim()) return;
    let current = true;
    const id = setTimeout(() => {
      void (async () => {
        const context = { projectId: active.id, sceneId: scene.id, revision: scene.currentRevision, requestId: uid() };
        let diagnostic: { msg: string; line: number } | null = null;
        const created = await canvasAdapter.current.createSession(context, (event) => {
          if (event.type === "diagnostic" && event.severity === "error") diagnostic = { msg: event.message, line: event.line ?? 0 };
        });
        if (!created.ok) {
          if (current) setError({ msg: created.message, line: 0 });
          return;
        }
        const loaded = await canvasAdapter.current.loadScene(created.value, context, scene);
        await created.value.dispose();
        if (!current) return;
        if (loaded.ok) {
          setTimeline(loaded.value);
          setError(null);
          lastGood.current = code;
        } else setError(diagnostic ?? { msg: loaded.message, line: 0 });
      })();
    }, 350);
    return () => { current = false; clearTimeout(id); };
  }, [active, code, fontsReady]);

  const showToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((x) => (x === t ? null : x)), 3200);
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => setPreviewFullscreen(document.fullscreenElement === previewSurfaceRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const togglePreviewFullscreen = async () => {
    const surface = previewSurfaceRef.current;
    if (!surface) return;
    try {
      if (document.fullscreenElement === surface) await document.exitFullscreen();
      else {
        if (!document.fullscreenEnabled) {
          showToast("Браузер не разрешает полноэкранный режим.");
          return;
        }
        if (document.fullscreenElement) await document.exitFullscreen();
        await surface.requestFullscreen();
      }
    } catch {
      showToast("Не удалось включить полноэкранный режим.");
    }
  };

  const updateProject = useCallback((projectId: string, fn: (p: Project) => Project) => {
    setProjects((ps) => ps.map((p) => (p.id === projectId ? fn(p) : p)));
  }, [setProjects]);

  const updateActive = useCallback((fn: (p: Project) => Project) => {
    if (active) updateProject(active.id, fn);
  }, [active, updateProject]);

  const setCode = (c: string) => updateActive((p) => updateSceneSource(p, c));

  const pushMessage = (m: Message) => updateActive((p) => ({ ...p, messages: [...p.messages, m], updatedAt: Date.now() }));

  const handleSend = async (text: string) => {
    if (!active) return;
    const projectId = active.id;
    const scene = activeScene(active);
    const baseRevision = scene.currentRevision;
    const history = active.messages.map((m) => ({ role: m.role, content: m.text }));
    updateProject(projectId, (project) => ({ ...project, messages: [...project.messages, { id: uid(), role: "user", text, ts: Date.now() }], updatedAt: Date.now() }));
    setThinking(true);
    let reply: { text: string; code?: string; title?: string; error?: boolean };
    try {
      const result = await aiOrchestrator.generate({
        projectId,
        engine: scene.engineId === "manimgx-browser" ? "manimgx-browser" : "arhimed-canvas",
        settings: llm,
        history,
        prompt: text,
        source: scene.source,
      });
      reply = result.reply;
    } catch (e) {
      reply = { text: e instanceof DOMException && e.name === "AbortError" ? "Генерация отменена." : e instanceof Error ? e.message : "Не удалось получить ответ ассистента.", error: true };
    }
    const messageId = uid();
    updateProject(projectId, (project) => {
      let next = project;
      let candidateRevision: string | undefined;
      if (reply.code && !reply.error) {
        const created = addAiCandidate(project, reply.code, baseRevision);
        next = created.project;
        candidateRevision = created.candidate.id;
      }
      const message: Message = { id: messageId, role: "assistant", text: reply.text, code: reply.code, baseRevision, candidateRevision, ts: Date.now(), error: reply.error };
      return {
        ...next,
        title: reply.title && (next.title === "Новое видео" || next.title === "Пример видео") ? reply.title : next.title,
        messages: [...next.messages, message],
        updatedAt: Date.now(),
      };
    });
    setThinking(false);
    setTypingId(messageId);
    if (hidden.includes("preview")) setHidden((h) => h.filter((x) => x !== "preview"));
  };

  const handleStop = () => {
    if (active) aiOrchestrator.cancel(active.id);
    setThinking(false);
    pushMessage({ id: uid(), role: "assistant", text: "Остановлено.", ts: Date.now() });
  };

  const fixError = () => {
    if (!error) return;
    if (llm.provider !== "offline" && llm.apiKey) {
      handleSend(`Исправь ошибку в коде (строка ${error.line}): ${error.msg}`);
    } else if (lastGood.current && lastGood.current !== code) {
      const good = lastGood.current;
      setCode(good);
      pushMessage(
        {
          id: uid(),
          role: "assistant",
          text: `В строке ${error.line} ошибка: «${error.msg}». Вернул код к последней рабочей версии — превью снова работает.`,
          ts: Date.now(),
        }
      );
    } else showToast("Проверьте строку " + error.line);
  };

  const newVideo = () => {
    const p = newProject();
    setProjects((ps) => [p, ...ps]);
    setActiveId(p.id);
  };

  const deleteVideo = (id: string) => {
    setProjects((ps) => {
      const rest = ps.filter((p) => p.id !== id);
      return rest.length ? rest : [newProject("Пример видео", WELCOME_CODE)];
    });
  };

  const togglePanel = (id: PanelId) => {
    setHidden((h) => [...h, id]);
    if (maxed === id) setMaxed(null);
  };
  const restorePanel = (id: PanelId) => setHidden((h) => h.filter((x) => x !== id));

  const doRecord = async () => {
    if (!playerRef.current || !visibleTimeline || recording !== null) return;
    try {
      setRecording(0);
      await playerRef.current.record(`${active.title || "arhimed"}.webm`, (p) => setRecording(p));
      showToast("Видео сохранено в формате WebM");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не удалось записать видео");
    } finally {
      setRecording(null);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Не удалось скопировать");
    }
  };
  const downloadPy = () => {
    const blob = new Blob([displayedCode], { type: "text/x-python" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(timeline?.sceneName ?? "scene").toLowerCase()}.py`;
    a.click();
  };

  // splitters
  const dragH = (e: RPointerEvent) => {
    e.preventDefault();
    const el = mainRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplit(Math.min(0.75, Math.max(0.25, (ev.clientX - rect.left) / rect.width)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const dragV = (e: RPointerEvent) => {
    e.preventDefault();
    const el = rightRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => setVsplit(Math.min(0.8, Math.max(0.2, (ev.clientY - rect.top) / rect.height)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "row-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const modeLabel = llm.provider === "offline" ? "Офлайн-ассистент" : `ИИ: ${llm.model}`;

  const show = (id: PanelId) => !hidden.includes(id) && (!maxed || maxed === id);

  const chatEl = (
      <ChatPanel
        messages={active?.messages ?? []}
        thinking={thinking}
        onSend={handleSend}
        onStop={handleStop}
        onAcceptCandidate={(candidateId) => {
          if (!candidateId || !active) return;
          const accepted = acceptAiCandidate(active, candidateId);
          if (!accepted) {
            showToast("Кандидат нельзя применить: исходная ревизия сцены изменилась.");
            return;
          }
          updateProject(active.id, () => accepted.project);
          setReviewCandidateId(null);
          restorePanel("preview");
          restorePanel("code");
          setMaxed(null);
          showToast("Кандидатная ревизия принята: запускаю новое превью.");
        }}
        onReviewCandidate={(candidateId) => {
          if (!candidateId || !active) return;
          const candidate = activeScene(active).revisions.find((revision) => revision.id === candidateId && revision.kind === "ai-candidate");
          if (!candidate) { showToast("Кандидатная ревизия больше недоступна."); return; }
          setReviewCandidateId(candidate.id);
          restorePanel("code");
          setMaxed(null);
        }}
        maximized={maxed === "chat"}
        onMaximize={() => setMaxed((m) => (m === "chat" ? null : "chat"))}
        onClose={() => togglePanel("chat")}
        modeLabel={modeLabel}
        onOpenSettings={() => setSettings(true)}
        typingId={typingId}
        onTypingDone={() => setTypingId(null)}
      />
  );

  const previewEl = (
    <Panel
      title="Превью"
      icon={<Clapperboard size={15} />}
      maximized={maxed === "preview"}
      onMaximize={() => setMaxed((m) => (m === "preview" ? null : "preview"))}
      onClose={() => togglePanel("preview")}
      actions={
        <>
          <IconBtn
            onClick={() => void togglePreviewFullscreen()}
            title={previewFullscreen ? "Выйти из полноэкранного режима" : "Во весь экран"}
          >
            {previewFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </IconBtn>
          <IconBtn onClick={() => playerRef.current?.snapshot(`${active?.title ?? "frame"}.png`)} title="Сохранить кадр (PNG)" disabled={!visibleTimeline}>
            <Camera size={14} />
          </IconBtn>
          <IconBtn onClick={doRecord} title="Скачать видео (WebM)" disabled={!visibleTimeline || recording !== null}>
            <Download size={14} />
          </IconBtn>
        </>
      }
      className="h-full"
      bodyClassName="bg-black"
    >
      <div ref={previewSurfaceRef} data-testid="preview-surface" className="preview-surface relative h-full bg-black">
        {!hasSceneSource ? <div aria-label="Пустое превью" className="h-full bg-black" /> : scene.engineId === "manimgx-browser" ? <ManimGXPreview projectId={active.id} scene={scene} /> : <Player ref={playerRef} timeline={visibleTimeline} />}
        {scene.engineId === "arhimed-canvas" && hasSceneSource && booting && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-300">
            <div className="space-y-2.5 text-[12.5px]">
              <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.18em] text-slate-500">Подготовка превью</div>
              {["Загрузка движка анимаций", "Подключение шрифтов и формул", "Прогрев рендерера"].map((t, i) => (
                <div key={t} className="fade-up flex items-center gap-2" style={{ animationDelay: `${i * 250}ms` }}>
                  <Loader2 size={13} className="animate-spin text-blue-400" /> {t}
                </div>
              ))}
            </div>
          </div>
        )}
        {visibleError && !booting && (
          <div className="fade-up absolute inset-x-3 top-3 flex items-start gap-3 rounded-xl bg-red-50/95 px-3.5 py-2.5 text-[12.5px] text-red-700 shadow-lg ring-1 ring-red-200 backdrop-blur dark:bg-red-950/90 dark:text-red-200 dark:ring-red-500/30">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Ошибка{visibleError.line ? ` в строке ${visibleError.line}` : ""}</div>
              <div className="truncate opacity-80">{visibleError.msg}</div>
            </div>
            <button
              onClick={fixError}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-medium text-red-700 shadow-sm hover:bg-red-100 dark:bg-red-900 dark:text-red-100"
            >
              <Wand2 size={13} /> Исправить
            </button>
          </div>
        )}
        {recording !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white backdrop-blur-[2px]">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> Запись видео… {Math.round(recording * 100)}%
            </div>
            <div className="mt-3 h-1 w-48 overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-white transition-all" style={{ width: `${recording * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );

  const codeEl = (
    <Panel
      title={reviewCandidate ? "Кандидат ИИ" : scene.engineId === "manimgx-browser" ? "Код ManimGX" : "Код Manim"}
      icon={<Braces size={15} />}
      maximized={maxed === "code"}
      onMaximize={() => setMaxed((m) => (m === "code" ? null : "code"))}
      onClose={() => togglePanel("code")}
      className="h-full"
      actions={
        <>
          {reviewCandidate && (
            <>
              <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 sm:block dark:bg-amber-500/10 dark:text-amber-300">Не применён</span>
              <button
                onClick={() => {
                  if (!active) return;
                  const accepted = acceptAiCandidate(active, reviewCandidate.id);
                  if (!accepted) { showToast("Кандидат нельзя применить: исходная ревизия сцены изменилась."); return; }
                  updateProject(active.id, () => accepted.project);
                  setReviewCandidateId(null);
                  restorePanel("preview");
                  showToast("Кандидатная ревизия принята: запускаю новое превью.");
                }}
                className="rounded-lg bg-blue-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-600"
              >
                Применить
              </button>
              <IconBtn onClick={() => setReviewCandidateId(null)} title="Закрыть кандидата"><X size={14} /></IconBtn>
            </>
          )}
          {hasSceneSource && scene.engineId === "arhimed-canvas" && <span
            className={cn(
              "mr-1.5 hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:flex",
              visibleError && !reviewCandidate
                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            )}
          >
            {visibleError && !reviewCandidate ? (
              <>
                <AlertTriangle size={11} /> строка {visibleError.line}
              </>
            ) : (
              <>
                <CircleCheck size={11} /> {visibleTimeline ? `${visibleTimeline.duration.toFixed(1)} с` : "…"}
              </>
            )}
          </span>}
          <IconBtn onClick={copyCode} title="Копировать код">
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </IconBtn>
          <IconBtn onClick={downloadPy} title="Скачать .py">
            <FileDown size={14} />
          </IconBtn>
        </>
      }
    >
          {reviewCandidate && <div className="absolute inset-x-0 top-0 z-10 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">Просмотр версии ИИ. Превью остаётся на текущей сцене, пока вы не нажмёте «Применить».</div>}
          <div className={cn("h-full", reviewCandidate && "pt-8")}><CodeEditor value={displayedCode} onChange={setCode} errorLine={reviewCandidate ? null : visibleError?.line ?? null} readOnly={!!reviewCandidate} /></div>
    </Panel>
  );

  const rightVisible = show("preview") || show("code");
  const allHidden = !show("chat") && !rightVisible;

  return (
    <div className="flex h-full gap-2 bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 p-2 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <Sidebar
        projects={projects}
        activeId={active?.id ?? ""}
        onSelect={(id) => {
          setActiveId(id);
          setTypingId(null);
        }}
        onNew={newVideo}
        onRename={(id, title) => setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, title } : p)))}
        onDelete={deleteVideo}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        hidden={hidden}
        onRestorePanel={restorePanel}
        dark={dark}
        onToggleTheme={onToggleTheme}
        onSettings={() => setSettings(true)}
        onHome={onHome}
        onToast={showToast}
        engineId={scene.engineId}
        onEngineChange={(engineId) => updateActive((project) => setActiveSceneEngine(project, engineId))}
      />

      <main ref={mainRef} className="flex min-w-0 flex-1">
        {allHidden && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300/70 text-center text-slate-500 dark:border-slate-700">
            <div>
              <p className="font-hand text-3xl">Все панели скрыты</p>
              <p className="mt-1 text-sm">Верните их из меню слева</p>
            </div>
          </div>
        )}
        {show("chat") && (
          <div className="min-w-0" style={{ flexBasis: rightVisible ? `${split * 100}%` : "100%", flexGrow: rightVisible ? 0 : 1, flexShrink: 0 }}>
            <div className="h-full">{chatEl}</div>
          </div>
        )}
        {show("chat") && rightVisible && (
          <div onPointerDown={dragH} className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center">
            <div className="h-10 w-1 rounded-full bg-slate-400/0 transition group-hover:bg-slate-400/50" />
          </div>
        )}
        {rightVisible && (
          <div ref={rightRef} className="flex min-w-0 flex-1 flex-col">
            {show("preview") && (
              <div className="min-h-0" style={{ flexBasis: show("code") ? `${vsplit * 100}%` : "100%", flexGrow: show("code") ? 0 : 1, flexShrink: 0 }}>
                {previewEl}
              </div>
            )}
            {show("preview") && show("code") && (
              <div onPointerDown={dragV} className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center">
                <div className="h-1 w-10 rounded-full bg-slate-400/0 transition group-hover:bg-slate-400/50" />
              </div>
            )}
            {show("code") && <div className="min-h-0 flex-1">{codeEl}</div>}
          </div>
        )}
      </main>

      {settings && (
        <SettingsModal
          value={llm}
          onClose={() => setSettings(false)}
          onSave={(v) => {
            setLlmPreferences({ provider: v.provider, baseUrl: v.baseUrl, model: v.model, rememberKey: v.rememberKey });
            setApiKey(v.apiKey);
            setSettings(false);
            showToast(v.provider !== "offline" && v.apiKey ? `Подключена модель ${v.model}` : "Включён офлайн-ассистент");
          }}
        />
      )}

      {toast && (
        <div className="fade-up fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-[13px] text-white shadow-xl dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      )}
    </div>
  );
}
