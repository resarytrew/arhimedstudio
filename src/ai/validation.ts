import type { AiEngineId } from "./profiles";

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

function balanced(source: string) {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: { value: string; line: number }[] = [];
  let quote = "";
  let escaped = false;
  let line = 1;
  for (const char of source) {
    if (char === "\n") line += 1;
    if (quote) {
      if (!escaped && char === quote) quote = "";
      escaped = !escaped && char === "\\";
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === "(" || char === "[" || char === "{") stack.push({ value: char, line });
    else if (char in pairs) {
      const open = stack.pop();
      if (!open || open.value !== pairs[char]) return { line, message: `Несогласованная скобка «${char}».` };
    }
  }
  if (quote) return { line, message: "Незакрытая строка." };
  const open = stack.pop();
  return open ? { line: open.line, message: `Незакрытая скобка «${open.value}».` } : undefined;
}

/** Lightweight, non-executing guard. A passed result is never a claim that Python has run. */
export function validateAiCandidate(source: string, engineId: AiEngineId): AiCandidateValidationV1 {
  const diagnostics: AiCandidateDiagnosticV1[] = [];
  const reject = (message: string, pattern?: RegExp) => diagnostics.push({ line: pattern ? lineOf(source, pattern) : undefined, message });
  if (!source.trim()) reject("ИИ не вернул исходный код сцены.");
  const expectedImport = engineId === "manimgx-browser" ? "import manimgx as m" : "import manimx as m";
  const firstCodeLine = source.split("\n").find((line) => line.trim() && !line.trim().startsWith("#"))?.trim();
  if (firstCodeLine !== expectedImport) reject(`Первая строка должна быть: ${expectedImport}.`);

  const imports = source.match(/^\s*(?:from\s+\S+\s+import\s+.+|import\s+.+)$/gm) ?? [];
  for (const statement of imports) {
    const normalized = statement.trim();
    if (normalized !== expectedImport && normalized !== "import numpy as np") reject(`Неподдерживаемый импорт: ${normalized}.`, new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  if (!/class\s+\w+\s*\(\s*m\.Scene\s*\)\s*:/.test(source)) reject("Нужен класс, наследующий m.Scene.");
  if (!/def\s+construct\s*\(\s*self\s*\)\s*:/.test(source)) reject("Нужен метод construct(self).");
  const bracketError = balanced(source);
  if (bracketError) diagnostics.push(bracketError);

  const forbidden: readonly [RegExp, string][] = engineId === "manimgx-browser"
    ? [
      [/\bnp\.math\b/, "np.math не существует; используйте разрешённые операции numpy или готовую константу."],
      [/\b(?:micropip|importlib|__import__|fetch|XMLHttpRequest|WebSocket)\b/, "Закреплённый ManimGX runtime запрещает динамические пакеты, сеть и браузерные API."],
      [/\b(?:ThreeDScene|OpenGL|set_camera_orientation)\b/, "3D не поддерживается в браузерном профиле ManimGX."],
    ]
    : [
      [/\b(?:ValueTracker|always_redraw|add_updater|updater)\b/, "Canvas-профиль не поддерживает ValueTracker, always_redraw и updaters."],
      [/\b(?:ThreeDScene|OpenGL|set_camera_orientation)\b/, "Canvas-профиль не поддерживает 3D."],
      [/\bnp\.math\b/, "np.math не существует; используйте разрешённые операции numpy или готовую константу."],
    ];
  for (const [pattern, message] of forbidden) if (pattern.test(source)) reject(message, pattern);

  if (diagnostics.length) return { status: "rejected", engineId, diagnostics };
  const warnings: AiCandidateDiagnosticV1[] = [];
  if (source.split("\n").length > 260) warnings.push({ message: "Сцена длиннее 260 строк: проверьте её по частям перед применением." });
  if (!/self\.play\s*\(/.test(source)) warnings.push({ message: "Не найден self.play(...): сцена может оказаться статичной." });
  return { status: warnings.length ? "warning" : "passed", engineId, diagnostics: warnings };
}
