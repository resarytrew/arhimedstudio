import { useMemo, useRef, type KeyboardEvent } from "react";
import { MANIM_COLORS } from "../engine/colors";
import { cn } from "../utils/cn";

const KW = new Set([
  "import", "as", "from", "class", "def", "for", "in", "if", "elif", "else", "return", "lambda", "and", "or", "not", "while", "pass", "with",
]);
const CONST = new Set(["True", "False", "None"]);

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function colorOf(token: string): string | null {
  const s = token.slice(1, -1);
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(s)) return s;
  return null;
}

export function highlight(code: string): string {
  const re =
    /(#[^\n]*)|([rRfFbB]{0,2}"(?:\\.|[^"\\\n])*"|[rRfFbB]{0,2}'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|\b([A-Za-z_][\w]*)\b(\s*\()?|([^\w\s])/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  let prevDot = false;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    last = re.lastIndex;
    const [full, comment, str, num, ident, call, punct] = m;
    if (comment) out += `<span class="tk-c">${esc(comment)}</span>`;
    else if (str) {
      const col = colorOf(str.replace(/^[rRfFbB]+/, ""));
      out += col
        ? `<span class="tk-s" style="box-shadow: inset 0 -3px 0 ${col}">${esc(str)}</span>`
        : `<span class="tk-s">${esc(str)}</span>`;
    } else if (num) out += `<span class="tk-n">${num}</span>`;
    else if (ident) {
      let cls = "";
      if (KW.has(ident)) cls = "tk-k";
      else if (CONST.has(ident)) cls = "tk-n";
      else if (ident === "self") cls = "tk-self";
      else if (call) cls = "tk-f";
      else if (prevDot && MANIM_COLORS[ident]) cls = "tk-col";
      else if (/^[A-Z][A-Z_0-9]+$/.test(ident)) cls = "tk-const";
      const colStyle = prevDot && MANIM_COLORS[ident] ? ` style="box-shadow: inset 0 -3px 0 ${MANIM_COLORS[ident]}"` : "";
      out += cls ? `<span class="${cls}"${colStyle}>${ident}</span>` : ident;
      if (call) out += esc(call);
    } else if (punct) out += `<span class="tk-p">${esc(punct)}</span>`;
    else out += esc(full);
    prevDot = punct === ".";
  }
  out += esc(code.slice(last));
  return out + "\n";
}

interface DiffLine { kind: "same" | "add" | "del"; text: string }
function computeLineDiff(beforeText: string, afterText: string): DiffLine[] {
  const before = beforeText ? beforeText.split("\n") : [];
  const after = afterText ? afterText.split("\n") : [];
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) out.push({ kind: "same", text: after[j++] }), i++;
    else if (j + 1 < after.length && i < before.length && before[i] === after[j + 1]) out.push({ kind: "add", text: after[j++] });
    else if (i + 1 < before.length && j < after.length && before[i + 1] === after[j]) out.push({ kind: "del", text: before[i++] });
    else {
      if (i < before.length) out.push({ kind: "del", text: before[i++] });
      if (j < after.length) out.push({ kind: "add", text: after[j++] });
    }
  }
  return out;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  errorLine?: number | null;
  readOnly?: boolean;
  baseValue?: string | null;
}

export function CodeEditor({ value, onChange, errorLine, readOnly = false, baseValue = null }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => highlight(value), [value]);
  const diffCounts = useMemo(() => {
    if (!readOnly || baseValue === null || baseValue === value) return null;
    const lines = computeLineDiff(baseValue, value);
    return { lines, added: lines.filter((line) => line.kind === "add").length, removed: lines.filter((line) => line.kind === "del").length };
  }, [readOnly, baseValue, value]);
  const lines = value.split("\n").length;
  const gutterLines = useMemo(() => {
    if (!diffCounts) return Array.from({ length: lines }, (_, index) => ({ label: String(index + 1), kind: "same" as const }));
    let currentLine = 0;
    return diffCounts.lines.map((line) => ({
      label: line.kind === "del" ? "−" : String(++currentLine),
      kind: line.kind,
    }));
  }, [diffCounts, lines]);

  const onScroll = (source?: HTMLTextAreaElement | HTMLPreElement | null) => {
    const top = source?.scrollTop ?? taRef.current?.scrollTop ?? 0;
    const left = source?.scrollLeft ?? taRef.current?.scrollLeft ?? 0;
    if (preRef.current && preRef.current !== source) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }
    if (taRef.current && taRef.current !== source) {
      taRef.current.scrollTop = top;
      taRef.current.scrollLeft = left;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = top;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const ta = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = ta;
      const next = value.slice(0, s) + "    " + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + 4, s + 4));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = ta.selectionStart;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const cur = value.slice(lineStart, s);
      let indent = cur.match(/^\s*/)?.[0] ?? "";
      if (/:\s*$/.test(cur)) indent += "    ";
      const next = value.slice(0, s) + "\n" + indent + value.slice(ta.selectionEnd);
      onChange(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + 1 + indent.length, s + 1 + indent.length));
    }
  };

  const shared = "font-mono text-[12.5px] leading-[20px] whitespace-pre p-0 m-0 tab-size-4";

  return (
    <div className="code-theme flex h-full min-h-0 bg-white dark:bg-slate-900">
      <div
        ref={gutterRef}
        className="w-11 shrink-0 select-none overflow-hidden border-r border-slate-100 py-2 text-right font-mono text-[11.5px] leading-[20px] text-slate-400 dark:border-white/5 dark:text-slate-600"
      >
        {gutterLines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "pr-2.5",
              line.kind === "add" && "text-emerald-600 dark:text-emerald-400",
              line.kind === "del" && "text-red-600 dark:text-red-400",
              errorLine === i + 1 && "bg-red-100 font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400"
            )}
          >
            {line.label}
          </div>
        ))}
        <div className="h-24" />
      </div>
      <div className="relative min-w-0 flex-1">
        {diffCounts && <div aria-label="Изменения кандидата ИИ" className="absolute right-3 top-2 z-10 rounded bg-slate-900/10 px-2 py-0.5 font-mono text-[10px] dark:bg-white/10"><span className="text-emerald-600">+{diffCounts.added}</span><span className="ml-2 text-red-600">-{diffCounts.removed}</span></div>}
        <pre
          ref={preRef}
          aria-hidden={!diffCounts}
          onScroll={diffCounts ? () => onScroll(preRef.current) : undefined}
          className={cn(
            shared,
            "absolute inset-0 px-3 py-2 text-slate-800 dark:text-slate-200",
            diffCounts ? "overflow-auto" : "pointer-events-none overflow-hidden"
          )}
          dangerouslySetInnerHTML={diffCounts ? { __html: diffCounts.lines.map((line) => `<span class="block ${line.kind === "add" ? "bg-emerald-100/80 dark:bg-emerald-900/30" : line.kind === "del" ? "bg-red-100/80 text-red-700 line-through dark:bg-red-900/30 dark:text-red-300" : ""}">${highlight(line.text).trimEnd()}</span>`).join("") } : { __html: html }}
        />
        {!diffCounts && <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { if (!readOnly) onChange(e.target.value); }}
          onScroll={(event) => onScroll(event.currentTarget)}
          onKeyDown={onKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className={cn(
            shared,
            "code-area scroll-thin absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-3 py-2 text-transparent outline-none selection:bg-blue-200/60 dark:selection:bg-blue-500/30",
            readOnly && "cursor-default"
          )}
        />}
      </div>
    </div>
  );
}
