import type { AiEngineId } from "./profiles";
import { SCIENTIFIC_IMPORT_ROOTS } from "../lib/scientific-libraries";

export interface AiCandidateDiagnosticV1 {
  line?: number;
  message: string;
}

export interface AiCandidateValidationV1 {
  status: "passed" | "warning" | "rejected";
  engineId: AiEngineId;
  diagnostics: AiCandidateDiagnosticV1[];
}

const lineOf = (source: string, pattern: RegExp) => {
  const match = pattern.exec(source);
  return match ? source.slice(0, match.index).split("\n").length : undefined;
};

const GX_IMPORT_ROOTS = new Set([
  "manimgx", "numpy", "math", "cmath", "statistics", "random", "fractions", "decimal",
  "dataclasses", "functools", "itertools", "collections", "operator",
  ...SCIENTIFIC_IMPORT_ROOTS,
]);

/** This is advisory only. The isolated Python runtime parses the actual source with `ast`. */
function gxImports(source: string) {
  const imports = source.match(/^\s*(?:from\s+[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s+import\s+.+|import\s+.+)$/gm) ?? [];
  return imports.map((statement) => {
    const match = /^\s*(?:from\s+([A-Za-z_]\w*)[^\s]*\s+import\s+.+|import\s+(.+))\s*$/.exec(statement);
    const roots = match?.[1]
      ? [match[1]]
      : (match?.[2] ?? "").split(",").map((piece) => piece.trim().split(/\s+as\s+|\./, 1)[0]);
    return { statement, roots };
  });
}

/** Lightweight, non-executing guard. A passed result is never a claim that Python has run. */
export function validateAiCandidate(source: string, engineId: AiEngineId): AiCandidateValidationV1 {
  const diagnostics: AiCandidateDiagnosticV1[] = [];
  const warnings: AiCandidateDiagnosticV1[] = [];
  const reject = (message: string, pattern?: RegExp) => diagnostics.push({ line: pattern ? lineOf(source, pattern) : undefined, message });
  if (!source.trim()) reject("ИИ не вернул исходный код сцены.");
  if (engineId === "manimgx-browser") {
    const imports = gxImports(source);
    if (!imports.some(({ roots }) => roots.includes("manimgx"))) reject("Нужен документированный импорт пакета manimgx.");
    for (const { statement, roots } of imports) {
      const unknown = roots.find((root) => !GX_IMPORT_ROOTS.has(root));
      if (unknown) reject(`Импорт «${unknown}» не входит в закреплённый браузерный runtime.`, new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    if (!/class\s+\w+\s*\(\s*(?:(?:m|manimgx)\.Scene|Scene)\s*\)\s*:/.test(source)) {
      reject("Нужен класс, наследующий Scene из manimgx.");
    }
  } else {
    const firstCodeLine = source.split("\n").find((line) => line.trim() && !line.trim().startsWith("#"))?.trim();
    if (firstCodeLine !== "import manimx as m") reject("Первая строка должна быть: import manimx as m.");
    const imports = source.match(/^\s*(?:from\s+\S+\s+import\s+.+|import\s+.+)$/gm) ?? [];
    for (const statement of imports) {
      const normalized = statement.trim();
      if (normalized !== "import manimx as m" && normalized !== "import numpy as np") reject(`Неподдерживаемый импорт: ${normalized}.`, new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    if (!/class\s+\w+\s*\(\s*m\.Scene\s*\)\s*:/.test(source)) reject("Нужен класс, наследующий m.Scene.");
  }
  if (!/def\s+construct\s*\(\s*self\s*\)\s*:/.test(source)) reject("Нужен метод construct(self).");

  const forbidden: readonly [RegExp, string][] = engineId === "manimgx-browser"
    ? [
      [/\bnp\.math\b/, "np.math не существует; используйте разрешённые операции numpy или готовую константу."],
      [/\b(?:micropip|importlib|__import__|js|pyodide|fetch|XMLHttpRequest|WebSocket)\b/, "Закреплённый ManimGX runtime запрещает динамические пакеты, bridge Pyodide/JS и сетевые API."],
      [/\b(?:ThreeDScene|set_camera_orientation|ThreeDAxes|Surface)\b/, "3D API ещё не сертифицирован реальным browser-прогоном; не генерируйте его, пока он не будет отдельно подтверждён."],
    ]
    : [
      [/\b(?:ValueTracker|always_redraw|add_updater|updater)\b/, "Canvas-профиль не поддерживает ValueTracker, always_redraw и updaters."],
      [/\b(?:ThreeDScene|OpenGL|set_camera_orientation)\b/, "Canvas-профиль не поддерживает 3D."],
      [/\bnp\.math\b/, "np.math не существует; используйте разрешённые операции numpy или готовую константу."],
    ];
  for (const [pattern, message] of forbidden) if (pattern.test(source)) reject(message, pattern);

  const oversizedFont = /font_size\s*=\s*(\d+(?:\.\d+)?)/g;
  for (let match = oversizedFont.exec(source); match; match = oversizedFont.exec(source)) {
    const size = Number(match[1]);
    const line = source.slice(0, match.index).split("\n").length;
    if (size > 56) diagnostics.push({ line, message: `Размер текста ${size} превышает предел 56 и может выйти за кадр.` });
    else if (size > 48) warnings.push({ line, message: `Размер текста ${size} больше рекомендуемого предела 48: проверьте композицию в превью.` });
  }

  if (diagnostics.length) return { status: "rejected", engineId, diagnostics };
  if (source.split("\n").length > 260) warnings.push({ message: "Сцена длиннее 260 строк: проверьте её по частям перед применением." });
  const playCount = (source.match(/self\.play\s*\(/g) ?? []).length;
  const explicitRunTimeCount = (source.match(/run_time\s*=/g) ?? []).length;
  const implicitDurationLines = source
    .split("\n")
    .filter((line) => /self\.play\s*\(/.test(line) && !/run_time\s*=/.test(line));
  for (const line of implicitDurationLines) {
    diagnostics.push({
      line: source.indexOf(line) >= 0 ? source.slice(0, source.indexOf(line)).split("\n").length : undefined,
      message: "У каждого self.play должен быть явный run_time в той же строке: это нужно для ролика длительностью 7–10 секунд.",
    });
  }
  const implicitWaitLines = source
    .split("\n")
    .filter((line) => /self\.wait\s*\(\s*\)/.test(line));
  for (const line of implicitWaitLines) {
    diagnostics.push({
      line: source.indexOf(line) >= 0 ? source.slice(0, source.indexOf(line)).split("\n").length : undefined,
      message: "У каждого self.wait должно быть явное число секунд: это нужно для ролика длительностью 7–10 секунд.",
    });
  }
  if (/\b(?:run_time|self\.wait)\s*=\s*-|self\.wait\s*\(\s*-/.test(source)) {
    diagnostics.push({ message: "Длительность run_time и self.wait должна быть положительным числом." });
  }
  if (explicitRunTimeCount < playCount && !implicitDurationLines.length) {
    diagnostics.push({ message: "Для каждого self.play укажите ровно один явный run_time, чтобы проверить длительность ролика." });
  }
  if (!playCount) warnings.push({ message: "Не найден self.play(...): сцена может оказаться статичной." });
  else if (playCount < 4 || playCount > 6) warnings.push({ message: `Найдено ${playCount} этапа анимации. Для короткого ролика предпочтительны 4–6 этапов.` });

  const explicitRunTimes = [...source.matchAll(/run_time\s*=\s*(\d+(?:\.\d+)?)/g)].reduce((total, match) => total + Number(match[1]), 0);
  const waits = [...source.matchAll(/self\.wait\s*\(\s*(\d+(?:\.\d+)?)?\s*\)/g)].reduce((total, match) => total + Number(match[1] ?? 1), 0);
  const estimatedDuration = explicitRunTimes + waits + Math.max(0, playCount - explicitRunTimeCount);
  if (playCount && (estimatedDuration < 7 || estimatedDuration > 10)) {
    diagnostics.push({ message: `Оценочная длительность ${estimatedDuration.toFixed(1)} с выходит за диапазон 7–10 с. Скорректируйте run_time и self.wait.` });
  }

  const longText = /m\.(?:Text|Tex)\(\s*["']([^"']{43,})["']/g;
  for (let match = longText.exec(source); match; match = longText.exec(source)) {
    warnings.push({ line: source.slice(0, match.index).split("\n").length, message: "Длинная текстовая подпись может не поместиться в кадр; сократите её или разбейте на строки." });
  }
  if (diagnostics.length) return { status: "rejected", engineId, diagnostics };
  return { status: warnings.length ? "warning" : "passed", engineId, diagnostics: warnings };
}
