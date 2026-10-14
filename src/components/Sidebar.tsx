import { useState } from "react";
import {
  Clapperboard,
  Code2,
  MessageSquarePlus,
  MessagesSquare,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import type { Project } from "../lib/store";
import { cn } from "../utils/cn";
import { Logo } from "./Logo";
import { IconBtn } from "./Panel";

export type PanelId = "chat" | "preview" | "code";
const PANEL_META: Record<PanelId, { label: string; icon: typeof Code2 }> = {
  chat: { label: "Чат", icon: MessagesSquare },
  preview: { label: "Превью", icon: Clapperboard },
  code: { label: "Код Manim", icon: Code2 },
};

interface Props {
  projects: Project[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  hidden: PanelId[];
  onRestorePanel: (id: PanelId) => void;
  dark: boolean;
  onToggleTheme: () => void;
  onSettings: () => void;
  onHome: () => void;
  onToast: (t: string) => void;
}

export function Sidebar(p: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (p.collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-2xl bg-white py-2.5 shadow-sm ring-1 ring-black/[0.04] dark:bg-slate-900 dark:ring-white/[0.06]">
        <button onClick={p.onHome} className="mb-1 font-hand text-[24px] font-bold leading-none text-slate-900 dark:text-white" title="На главную">
          A
        </button>
        <IconBtn onClick={p.onToggle} title="Развернуть меню">
          <PanelLeft size={16} />
        </IconBtn>
        <IconBtn onClick={p.onNew} title="Новое видео">
          <Plus size={16} />
        </IconBtn>
        {p.hidden.map((id) => {
          const I = PANEL_META[id].icon;
          return (
            <IconBtn key={id} onClick={() => p.onRestorePanel(id)} title={`Показать: ${PANEL_META[id].label}`} className="text-blue-500">
              <I size={15} />
            </IconBtn>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1">
          <IconBtn onClick={p.onSettings} title="Настройки ИИ">
            <Sparkles size={15} />
          </IconBtn>
          <IconBtn onClick={p.onToggleTheme} title="Тема">
            {p.dark ? <Sun size={15} /> : <Moon size={15} />}
          </IconBtn>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[264px] shrink-0 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-slate-900 dark:ring-white/[0.06]">
      <div className="flex items-center justify-between px-4 pb-3 pt-3.5">
        <button onClick={p.onHome} className="text-slate-900 dark:text-white" title="На главную">
          <Logo size="sm" />
        </button>
        <IconBtn onClick={p.onToggle} title="Свернуть меню">
          <PanelLeft size={16} />
        </IconBtn>
      </div>

      <div className="flex items-center justify-between px-4 pb-1.5 pt-1">
        <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Видео</span>
        <IconBtn onClick={p.onNew} title="Новое видео">
          <Plus size={16} />
        </IconBtn>
      </div>

      <nav className="scroll-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
        {p.projects.map((pr) => {
          const active = pr.id === p.activeId;
          return (
            <div
              key={pr.id}
              onClick={() => p.onSelect(pr.id)}
              onDoubleClick={() => {
                setEditing(pr.id);
                setDraft(pr.title);
              }}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] transition",
                active
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"
              )}
            >
              {editing === pr.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (draft.trim()) p.onRename(pr.id, draft.trim());
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="min-w-0 flex-1 rounded-md bg-white px-1.5 py-0.5 outline-none ring-1 ring-blue-300 dark:bg-slate-900"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{pr.title}</span>
              )}
              {editing !== pr.id && (
                <div className="hidden items-center gap-0.5 group-hover:flex">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(pr.id);
                      setDraft(pr.title);
                    }}
                    className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    title="Переименовать"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onDelete(pr.id);
                    }}
                    className="rounded p-1 text-slate-400 hover:text-red-500"
                    title="Удалить"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {p.hidden.length > 0 && (
        <div className="px-4 pb-2 pt-3">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Скрытые панели</div>
          <div className="flex flex-wrap gap-1.5">
            {p.hidden.map((id) => {
              const I = PANEL_META[id].icon;
              return (
                <button
                  key={id}
                  onClick={() => p.onRestorePanel(id)}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[12px] text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400"
                >
                  <I size={12} /> {PANEL_META[id].label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-0.5 px-2 pb-2 pt-2">
        <button
          onClick={p.onSettings}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
        >
          <Sparkles size={15} className="text-violet-500" /> Настройки ИИ
        </button>
        <div className="flex items-center">
          <button
            onClick={() => p.onToast("Спасибо! Форма обратной связи скоро появится.")}
            className="flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            <MessageSquarePlus size={15} /> Обратная связь
          </button>
          <IconBtn onClick={p.onToggleTheme} title={p.dark ? "Светлая тема" : "Тёмная тема"} className="mr-1">
            {p.dark ? <Sun size={15} /> : <Moon size={15} />}
          </IconBtn>
        </div>
        <button
          onClick={() => p.onToast("Вход через Google или GitHub появится в ближайшем обновлении.")}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
            <User size={15} />
          </span>
          <span>
            <span className="block text-[13.5px] font-medium text-slate-800 dark:text-slate-100">Войти</span>
            <span className="block text-[11.5px] text-slate-500">Google или GitHub</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
