import { useRef, useState } from "react";
import { BookOpenCheck, CheckCircle2, Download, FileKey2, ShieldCheck, Upload, X } from "lucide-react";
import { emptyLessonPlan, emptyLessonProgress, type LessonPlan, type LessonProgress } from "../lib/lesson";
import type { Project } from "../lib/store";
import { cn } from "../utils/cn";

type Mode = "create" | "code" | "explore";

interface Props {
  project: Project;
  onUpdate: (lesson: LessonPlan, progress: LessonProgress) => void;
  onExportSecure: (password: string) => Promise<void>;
  onExportPublic: () => void;
  onImportSecure: (serialized: string, password: string) => Promise<void>;
  onClearLog: () => void;
  onClose: () => void;
}

const lines = (value: string) => value.split("\n").map((entry) => entry.trim()).filter(Boolean);
const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-white";

export function LessonWorkspace({ project, onUpdate, onExportSecure, onExportPublic, onImportSecure, onClearLog, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("create");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const lesson = project.lesson ?? emptyLessonPlan();
  const progress = project.lessonProgress ?? emptyLessonProgress();
  const update = (next: Partial<LessonPlan>, nextProgress = progress) => onUpdate({ ...lesson, ...next }, nextProgress);
  const setValue = (id: string, value: string | number | boolean) => onUpdate(lesson, { ...progress, parameterValues: { ...progress.parameterValues, [id]: value } });

  const encryptedExport = async () => {
    try { await onExportSecure(password); setStatus("Зашифрованный пакет сохранён локально."); } catch (error) { setStatus(error instanceof Error ? error.message : "Не удалось создать пакет."); }
  };
  const encryptedImport = async (selected?: File) => {
    if (!selected) return;
    try { await onImportSecure(await selected.text(), password); setStatus("Проект восстановлен как локальная копия."); } catch (error) { setStatus(error instanceof Error ? error.message : "Не удалось восстановить пакет."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Рабочее пространство урока">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-white/10">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><BookOpenCheck size={18} /></span>
          <div className="min-w-0 flex-1"><h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">Рабочее пространство урока</h2><p className="text-[12px] text-slate-500">План, исследование и local-first защита данных</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Закрыть рабочее пространство"><X size={17} /></button>
        </header>
        <div className="flex gap-1 border-b border-slate-200 px-5 pt-3 dark:border-white/10">
          {([ ["create", "Создать урок"], ["code", "Редактировать код"], ["explore", "Исследовать"] ] as const).map(([id, label]) => <button key={id} onClick={() => setMode(id)} className={cn("border-b-2 px-3 pb-2 text-[12px] font-medium", mode === id ? "border-blue-500 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500")}>{label}</button>)}
        </div>
        <div className="scroll-thin overflow-y-auto p-5">
          {mode === "create" && <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Цель урока<input className={field} value={lesson.goal} onChange={(event) => update({ goal: event.target.value })} placeholder="Что ученик поймёт?" /></label>
            <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Аудитория<input className={field} value={lesson.audience} onChange={(event) => update({ audience: event.target.value })} placeholder="Например, 9 класс" /></label>
            <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Ожидаемый результат<input className={field} value={lesson.outcome} onChange={(event) => update({ outcome: event.target.value })} placeholder="Сможет объяснить…" /></label>
            <label className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Публичное описание<input className={field} value={lesson.publicSummary} onChange={(event) => update({ publicSummary: event.target.value })} placeholder="Без личных данных и истории чата" /></label>
            <label className="sm:col-span-2 text-[12px] font-medium text-slate-600 dark:text-slate-300">Шаги объяснения <span className="font-normal text-slate-400">— по одному на строку</span><textarea className={field} rows={3} value={lesson.steps.join("\n")} onChange={(event) => update({ steps: lines(event.target.value) })} placeholder="Проблема&#10;Модель&#10;Наблюдение&#10;Вывод" /></label>
            <label className="sm:col-span-2 text-[12px] font-medium text-slate-600 dark:text-slate-300">Формулы <span className="font-normal text-slate-400">— по одной на строку</span><textarea className={field} rows={2} value={lesson.formulas.join("\n")} onChange={(event) => update({ formulas: lines(event.target.value) })} placeholder="E = mc^2" /></label>
            <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><div className="flex items-center justify-between"><div><div className="text-[12px] font-medium text-slate-700 dark:text-slate-200">Интерактивные параметры</div><p className="text-[11px] text-slate-500">Значения хранятся локально. Привязку к коду ИИ создаёт только как кандидат.</p></div><button onClick={() => update({ parameters: [...lesson.parameters, { id: crypto.randomUUID(), label: "Параметр", kind: "number", value: 1, min: 0, max: 10, step: 1 }] })} className="rounded-lg bg-white px-2 py-1 text-[11px] text-blue-600 shadow-sm dark:bg-slate-700">+ параметр</button></div>
              {lesson.parameters.map((parameter) => <div key={parameter.id} className="mt-2 flex gap-2"><input className={field} value={parameter.label} onChange={(event) => update({ parameters: lesson.parameters.map((item) => item.id === parameter.id ? { ...item, label: event.target.value } : item) })} /><button onClick={() => update({ parameters: lesson.parameters.filter((item) => item.id !== parameter.id) })} className="mt-1 rounded px-2 text-[11px] text-red-500">Удалить</button></div>)}</div>
          </div>}
          {mode === "code" && <div className="space-y-3 text-[13px] text-slate-600 dark:text-slate-300"><p>Код остаётся в основной панели редактора: режимы не конвертируют исходники и не меняют движок.</p><div className="rounded-xl bg-slate-50 p-3 text-[12px] dark:bg-slate-800">Перед внешней генерацией Studio отправит только ваш запрос и активную сцену. История отключена, пока вы явно не включите её в настройках ИИ.</div><p className="font-medium text-slate-800 dark:text-white">Текущий движок: {project.scenes.find((scene) => scene.id === project.activeSceneId)?.engineId}</p></div>}
          {mode === "explore" && <div className="space-y-4"><p className="text-[13px] text-slate-600 dark:text-slate-300">Ученик исследует сохранённые параметры и фиксирует выводы. Исходный код и ревизии не меняются.</p>
            {lesson.parameters.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-[12px] text-slate-500 dark:bg-slate-800">Добавьте параметры в режиме «Создать урок».</p> : lesson.parameters.map((parameter) => <label key={parameter.id} className="block rounded-xl bg-slate-50 p-3 text-[12px] dark:bg-slate-800"><span className="font-medium text-slate-700 dark:text-slate-200">{parameter.label}</span>{parameter.kind === "number" ? <input type="range" className="mt-2 block w-full" min={parameter.min ?? 0} max={parameter.max ?? 10} step={parameter.step ?? 1} value={Number(progress.parameterValues[parameter.id] ?? parameter.value)} onChange={(event) => setValue(parameter.id, Number(event.target.value))} /> : <input className={field} value={String(progress.parameterValues[parameter.id] ?? parameter.value)} onChange={(event) => setValue(parameter.id, event.target.value)} />}<span className="mt-1 block text-slate-500">{String(progress.parameterValues[parameter.id] ?? parameter.value)}</span></label>)}
            {lesson.steps.map((step, index) => <button key={`${step}-${index}`} onClick={() => onUpdate(lesson, { ...progress, reachedCheckpoints: [...new Set([...progress.reachedCheckpoints, String(index)])] })} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-[12px] dark:border-white/10"><CheckCircle2 size={14} className={progress.reachedCheckpoints.includes(String(index)) ? "text-emerald-500" : "text-slate-300"} /> Шаг {index + 1}: {step}</button>)}
          </div>}
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10"><div className="flex items-center gap-2 text-[12px] font-medium text-slate-700 dark:text-slate-200"><ShieldCheck size={15} className="text-emerald-500" /> Резервные копии и аудит</div><p className="mt-1 text-[11px] text-slate-500">Ключ не сохраняется. Публичный пакет не содержит чат, аудит и ответы ученика.</p><div className="mt-2 flex flex-wrap gap-2"><input className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] dark:border-white/10 dark:bg-slate-800" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ключевая фраза (≥10)" /><button onClick={() => void encryptedExport()} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] text-white dark:bg-white dark:text-slate-900"><FileKey2 className="mr-1 inline" size={13} />Зашифровать</button><button onClick={() => file.current?.click()} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] dark:border-white/10"><Upload className="mr-1 inline" size={13} />Восстановить</button><input ref={file} type="file" accept=".arhimed,.json" className="hidden" onChange={(event) => void encryptedImport(event.target.files?.[0])} /><button onClick={onExportPublic} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] dark:border-white/10"><Download className="mr-1 inline" size={13} />Публичный пакет</button><button onClick={onClearLog} className="rounded-lg px-2.5 py-1.5 text-[11px] text-slate-500 hover:text-red-500">Очистить аудит</button></div>{status && <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">{status}</p>}<p className="mt-2 text-[11px] text-slate-400">Локальный аудит: {(project.securityLog ?? []).slice(-3).map((event) => event.detail).join(" · ") || "событий пока нет"}</p></div>
        </div>
      </div>
    </div>
  );
}
