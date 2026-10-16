import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { LLMSettings } from "../lib/assistant";
import { cn } from "../utils/cn";

interface Props {
  value: LLMSettings;
  onSave: (v: LLMSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ value, onSave, onClose }: Props) {
  const [v, setV] = useState<LLMSettings>(value);
  const field =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-white/10"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white">
              <Sparkles size={17} />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">ИИ-ассистент</h3>
              <p className="text-[12.5px] text-slate-500">Как будет генерироваться код сцен</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { k: "offline" as const, t: "Офлайн", d: "Встроенные сцены" },
            { k: "openrouter" as const, t: "OpenRouter", d: "Ваш ключ в памяти" },
            { k: "openai-compatible" as const, t: "Совместимый API", d: "OpenAI-совместимый API" },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setV({ ...v, provider: o.k, baseUrl: o.k === "openrouter" ? "https://openrouter.ai/api/v1" : v.baseUrl })}
              className={cn(
                "rounded-lg px-3 py-2 text-left transition",
                v.provider === o.k ? "bg-white shadow-sm dark:bg-slate-700" : "opacity-70 hover:opacity-100"
              )}
            >
              <div className="text-[13px] font-medium text-slate-800 dark:text-white">{o.t}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{o.d}</div>
            </button>
          ))}
        </div>

        {v.provider !== "offline" ? (
          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">Адрес API</span>
              <input className={field} value={v.baseUrl} onChange={(e) => setV({ ...v, baseUrl: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">Модель</span>
              <input className={field} value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">API-ключ</span>
              <input
                type="password"
                className={field}
                value={v.apiKey}
                placeholder="sk-…"
                onChange={(e) => setV({ ...v, apiKey: e.target.value })}
              />
            </label>
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              Ключ хранится только в памяти этой вкладки. Он не входит в проекты, ревизии, логи, runtime сцен или опубликованные материалы.
            </p>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-[11.5px] leading-relaxed text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <input
                type="checkbox"
                checked={!!v.shareHistory}
                onChange={(event) => setV({ ...v, shareHistory: event.target.checked })}
                className="mt-0.5"
              />
              <span><b>Передавать историю диалога.</b> По умолчанию наружу отправляются только текущий запрос и активная сцена. Включайте это лишь если история действительно нужна модели.</span>
            </label>
          </div>
        ) : (
          <p className="mt-5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
            Офлайн-ассистент работает без интернета и ключей: он знает готовые сцены по физике, математике и информатике и умеет предлагать правки текущей
            анимацию — менять цвета, фон, скорость и заголовки.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13.5px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Отмена
          </button>
          <button
            onClick={() => onSave(v)}
            className="rounded-xl bg-blue-500 px-4 py-2 text-[13.5px] font-medium text-white hover:bg-blue-600"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
