/**
 * Non-executing ManimGX authoring checks. This is advisory source analysis:
 * it cannot prove Python validity or detect visual collisions at animation frames.
 * The isolated Python AST parser and real WebGPU runtime remain authoritative.
 */
export interface ManimGXSourceIssue {
  code: string;
  line: number;
  severity: "error" | "warning";
  message: string;
}

const lineAt = (source: string, offset: number) => source.slice(0, offset).split("\n").length;

/** Hide Python comments and quoted text while keeping offsets and line numbers stable. */
function maskPythonStringsAndComments(source: string): string {
  let output = "";
  let quote: "'" | '"' | "'''" | '"""' | null = null;
  for (let i = 0; i < source.length;) {
    const ch = source[i];
    if (quote !== null) {
      if (source.startsWith(quote, i)) {
        output += " ".repeat(quote.length);
        i += quote.length;
        quote = null;
      } else if (ch === "\\" && i + 1 < source.length) {
        output += "  ";
        i += 2;
      } else {
        output += ch === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") { output += " "; i++; }
      continue;
    }
    if (ch === "'" || ch === '"') {
      const triple = source.startsWith(ch.repeat(3), i);
      quote = (triple ? ch.repeat(3) : ch) as typeof quote;
      output += " ".repeat(quote.length);
      i += quote.length;
      continue;
    }
    output += ch;
    i++;
  }
  return output;
}

/**
 * Warnings are not Python errors. Limit checks to high-confidence authoring
 * mistakes seen in real GX lessons, with no access to files, network or eval.
 */
export function inspectManimGXSource(source: string): ManimGXSourceIssue[] {
  if (!source.trim()) return [];
  const clean = maskPythonStringsAndComments(source);
  const issues: ManimGXSourceIssue[] = [];
  const add = (code: string, offset: number, severity: ManimGXSourceIssue["severity"], message: string) => {
    issues.push({ code, line: lineAt(source, offset), severity, message });
  };

  const first = /^([ \t]*)(\S.*)$/m.exec(clean);
  if (first && first[1].length) {
    add("fragment-indent", first.index, "error", "Файл начинается с отступа. Возможно, вставлена середина Python-сцены.");
  }
  const importedGX = /^\s*(?:import\s+manimgx\b|from\s+manimgx(?:\.[\w.]+)?\s+import\b)/m.test(clean);
  const canvasImport = /^\s*(?:import\s+manimx\b|from\s+manimx\b|from\s+manim\s+import\b)/m.exec(clean);
  if (!importedGX) {
    add("missing-gx-import", canvasImport?.index ?? 0, "error", canvasImport
      ? "Этот код использует другой движок. Для сцены ManimGX нужен импорт manimgx."
      : "Не найден импорт manimgx. Проверьте, что вставлен полный Python-файл.");
  }
  if (!/\bclass\s+\w+\s*\(\s*(?:(?:m|manimgx)\.(?:Scene|ThreeDScene)|Scene|ThreeDScene)\s*\)\s*:/.test(clean)) {
    add("missing-scene", 0, "warning", "Не найден класс Scene или ThreeDScene. Проверьте точку входа.");
  }
  if (!/\bdef\s+construct\s*\(\s*self\s*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(clean)) {
    add("missing-construct", 0, "warning", "Не найден метод construct(self). Возможно, исходник неполный.");
  }

  const widthWrite = /\b(?:(?:m|manimgx)\.)?config\.frame_width\s*=(?!=)/g;
  for (const m of clean.matchAll(widthWrite)) {
    add("readonly-frame-width", m.index ?? 0, "error", "config.frame_width вычисляется автоматически. Задавайте pixel_width, pixel_height и frame_height.");
  }

  const wildcardImport = /^\s*from\s+manimgx(?:\.[\w.]+)?\s+import\s+\*/m.test(clean);
  const directImports = [...clean.matchAll(/^\s*from\s+manimgx(?:\.[\w.]+)?\s+import\s+([^\n]+)/gm)]
    .map(m => m[1]).join(" ");
  const bareCalls = /(?<![\w.])(Create|FadeIn|FadeOut|Write|Transform|ReplacementTransform|TransformMatchingTex|LaggedStart|AnimationGroup|GrowArrow|Indicate)\s*\(/g;
  const seen = new Set<string>();
  for (const match of clean.matchAll(bareCalls)) {
    const name = match[1];
    if (wildcardImport || new RegExp("\\b" + name + "\\b").test(directImports)
      || new RegExp("\\bdef\\s+" + name + "\\s*\\(").test(clean)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    add("bare-animation", match.index ?? 0, "error",
      "Анимация " + name + " вызвана без префикса. При import manimgx as m используйте m." + name + "(...).");
  }

  const textAt = /\bself\.text_at\s*\(/g;
  if (textAt.test(clean) && !/\bdef\s+text_at\s*\(/.test(clean)) {
    const occurrence = clean.search(/\bself\.text_at\s*\(/);
    add("undefined-helper", occurrence, "warning", "Метод self.text_at не входит в API ManimGX. Объявите его в классе либо используйте m.Text.");
  }

  const pixelW = /\bconfig\.pixel_width\s*=\s*(\d+)/.exec(clean);
  const pixelH = /\bconfig\.pixel_height\s*=\s*(\d+)/.exec(clean);
  const frameH = /\bconfig\.frame_height\s*=\s*(\d+(?:\.\d+)?)/.exec(clean);
  if (pixelW && pixelH && frameH) {
    const width = Number(pixelW[1]), height = Number(pixelH[1]), sceneH = Number(frameH[1]);
    if (width > 0 && height > 0 && sceneH > 0) {
      const xLimit = sceneH * width / height / 2, yLimit = sceneH / 2;
      const coords = /\.move_to\s*\(\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*-?\d+(?:\.\d+)?\s*\]/g;
      for (const match of clean.matchAll(coords)) {
        const x = Number(match[1]), y = Number(match[2]);
        if (Math.abs(x) > xLimit + 0.02 || Math.abs(y) > yLimit + 0.02) {
          add("offscreen-center", match.index ?? 0, "warning",
            "Центр объекта за границей заданного кадра. Проверьте его видимость, масштаб и движение камеры.");
        }
      }
    }
  }
  return issues.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}
