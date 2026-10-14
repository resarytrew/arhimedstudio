import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, Code2, MessagesSquare, Plus, RotateCcw, Sparkles, Square } from "lucide-react";
import type { Message } from "../lib/store";
import { TEMPLATES } from "../lib/templates";
import { cn } from "../utils/cn";
import { Panel } from "./Panel";

interface Props {
  messages: Message[];
  thinking: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onRestore: (code: string) => void;
  onShowCode: () => void;
  maximized: boolean;
  onMaximize: () => void;
  onClose: () => void;
  modeLabel: string;
  onOpenSettings: () => void;
  typingId: string | null;
  onTypingDone: () => void;
}

const PROMPT_PAGES = [
  TEMPLATES.slice(0, 4).map((t) => t.prompt),
  [...TEMPLATES.slice(4).map((t) => t.prompt), "Сделай фон как у школьной доски"],
];

function Typewriter({ text, onDone }: { text: string; onDone: () => void }) {
  const [n, setN] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += Math.max(1, Math.round(text.length / 90));
      setN(i);
      if (i >= text.length) {
        clearInterval(id);
        doneRef.current();
      }
    }, 16);
    return () => clearInterval(id);
  }, [text]);
  return <span className={cn(n < text.length && "caret")}>{text.slice(0, n)}</span>;
}

export function ChatPanel(p: Props) {
  const [input, setInput] = useState("");
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [p.messages.length, p.thinking]);

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || p.thinking) return;
    p.onSend(t);
    setInput("");
    setMenu(false);
  };

  const empty = p.messages.length === 0;

  return (
    <Panel
      title="Чат"
      icon={<MessagesSquare size={15} />}
      maximized={p.maximized}
      onMaximize={p.onMaximize}
      onClose={p.onClose}
      bodyClassName="flex flex-col bg-slate-50/60 dark:bg-slate-900"
    >
      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full max-w-lg flex-col justify-center px-6 py-10">
            <p className="fade-up font-hand text-[34px] leading-none text-slate-800 dark:text-slate-100">
              Что покажем на уроке?
            </p>
            <p className="fade-up mt-2 text-[13px] text-slate-500 dark:text-slate-400" style={{ animationDelay: "60ms" }}>
              Опишите идею — ассистент напишет код анимации, а превью оживёт справа.
            </p>
            <div className="fade-up mt-8" style={{ animationDelay: "120ms" }}>
              <div className="mb-1 flex items-center justify-between px-3">
                <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Идеи для начала</span>
                <div className="flex gap-1 text-slate-500">
                  <button
                    onClick={() => setPage((x) => (x + PROMPT_PAGES.length - 1) % PROMPT_PAGES.length)}
                    className="rounded-md p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                    aria-label="Назад"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setPage((x) => (x + 1) % PROMPT_PAGES.length)}
                    className="rounded-md p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                    aria-label="Вперёд"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <ul key={page}>
                {PROMPT_PAGES[page].map((s, i) => (
                  <li key={s} className="fade-up border-b border-slate-200/70 last:border-0 dark:border-white/5" style={{ animationDelay: `${i * 40}ms` }}>
                    <button
                      onClick={() => send(s)}
                      className="group flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[14px] text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      {s}
                      <ArrowUp size={14} className="rotate-45 opacity-0 transition group-hover:opacity-60" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5 px-5 py-6">
            {p.messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="fade-up flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-blue-500 px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="fade-up flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 font-hand text-[17px] font-bold text-white">
                    A
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700 dark:text-slate-200",
                        m.error && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {p.typingId === m.id ? <Typewriter text={m.text} onDone={p.onTypingDone} /> : m.text}
                    </div>
                    {m.code && p.typingId !== m.id && (
                      <div className="fade-up mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-slate-800/60">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                          <Code2 size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100">Код сцены обновлён</div>
                          <div className="text-[11.5px] text-slate-500">
                            {m.code.split("\n").length} строк · {m.code.match(/class\s+(\w+)/)?.[1] ?? "Scene"}
                          </div>
                        </div>
                        <button
                          onClick={p.onShowCode}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                        >
                          Открыть
                        </button>
                        <button
                          onClick={() => p.onRestore(m.code!)}
                          title="Вернуть эту версию"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {p.thinking && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white">
                  <Sparkles size={13} className="animate-pulse" />
                </div>
                <div className="flex items-center gap-1 text-[13px] text-slate-500">
                  Пишу код сцены
                  <span className="inline-flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 pt-1">
        <div className="relative rounded-2xl bg-blue-50 ring-1 ring-blue-100 transition focus-within:ring-2 focus-within:ring-blue-300 dark:bg-slate-800 dark:ring-white/5 dark:focus-within:ring-blue-500/40">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            placeholder="Опишите идею для урока…"
            className="scroll-thin block w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <div className="flex items-center gap-2 px-2.5 pb-2.5">
            <button
              onClick={p.onOpenSettings}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-slate-500 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-700"
              title="Настройки ИИ"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", p.modeLabel.startsWith("Офлайн") ? "bg-amber-400" : "bg-emerald-500")} />
              {p.modeLabel}
            </button>
            <div className="relative ml-auto">
              <button
                onClick={() => setMenu((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Готовые темы"
              >
                <Plus size={17} />
              </button>
              {menu && (
                <div className="fade-up absolute bottom-10 right-0 z-20 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-800">
                  <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Готовые темы</div>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => send(t.prompt)}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {p.thinking ? (
              <button
                onClick={p.onStop}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                title="Остановить"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-slate-600"
                title="Отправить"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
