import { useMemo, useRef, type KeyboardEvent } from "react";
import { MANIM_COLORS } from "../engine/colors";
import { cn } from "../utils/cn";

const KW = new Set([
  "import", "as", "from", "class", "def", "for", "in", "if", "elif", "else", "return", "lambda", "and", "or", "not", "while", "pass", "with",
]);
const CONST = new Set(["True", "False", "None"]);

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function colorOf(token: string): string | null {
  const s = token.slice(1, -1);
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) || /^rgba?\(/i.test(s)) return s;
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

interface Props {
  value: string;
  onChange: (v: string) => void;
  errorLine?: number | null;
  readOnly?: boolean;
}

export function CodeEditor({ value, onChange, errorLine, readOnly = false }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => highlight(value), [value]);
  const lines = value.split("\n").length;

  const onScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
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
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn(
              "pr-2.5",
              errorLine === i + 1 && "bg-red-100 font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400"
            )}
          >
            {i + 1}
          </div>
        ))}
        <div className="h-24" />
      </div>
      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden
          className={cn(shared, "pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 text-slate-800 dark:text-slate-200")}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { if (!readOnly) onChange(e.target.value); }}
          onScroll={onScroll}
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
        />
      </div>
    </div>
  );
}
