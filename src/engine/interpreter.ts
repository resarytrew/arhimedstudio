import { MANIM_COLORS, normalizeColor } from "./colors";
import {
  applyMatrix,
  arrowTip,
  assignInto,
  baseMob,
  bbox,
  center,
  circlePts,
  cloneMob,
  FRAME_H,
  FRAME_W,
  leaves,
  moveTo,
  newId,
  pointAlong,
  rotateMob,
  scaleMob,
  setColor,
  setFill,
  setStroke,
  shiftMob,
  stretchMob,
  type Mob,
  type P2,
} from "./mobject";
import { makeMorph, transformed, withProgress } from "./morph";
import { parseExpr, ParseError, type Node } from "./parser";

export class ScriptError extends Error {
  line: number;
  constructor(msg: string, line: number) {
    super(msg);
    this.line = line;
  }
}

export interface Rec {
  id: number;
  frame: (a: number) => Mob | null;
}
export interface Segment {
  start: number;
  duration: number;
  before: Mob[];
  records: Rec[];
}
export interface Timeline {
  segments: Segment[];
  final: Mob[];
  duration: number;
  bg: string;
  sceneName: string;
}

type Fn = (args: any[], kw: Record<string, any>) => any;
interface Anim {
  __anim: true;
  kind: string;
  mob?: Mob;
  target?: Mob;
  subs?: Anim[];
  lag?: number;
  opts: Record<string, any>;
  ops?: { name: string; args: any[]; kw: Record<string, any> }[];
}
interface Proxy {
  __proxy: true;
  mob: Mob;
  ops: { name: string; args: any[]; kw: Record<string, any> }[];
}

const MODULE = { __module: true };
const SELF = { __scene: true };

const isMob = (v: any): v is Mob => !!v && typeof v === "object" && "kind" in v && "paths" in v && "children" in v;
const isAnim = (v: any): v is Anim => !!v && v.__anim === true;
const isProxy = (v: any): v is Proxy => !!v && v.__proxy === true;

function deepEqual(a: any, b: any, seen = new WeakMap<object, object>()): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const paired = seen.get(a);
  if (paired) return paired === b;
  seen.set(a, b);
  const aKeys = Object.keys(a), bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key], seen));
}

export const RATE: Record<string, (t: number) => number> = {
  linear: (t) => t,
  smooth: (t) => {
    const s = t * t * (3 - 2 * t);
    return s * s * (3 - 2 * s) * 0.35 + s * 0.65;
  },
  there_and_back: (t) => {
    const x = t < 0.5 ? t * 2 : 2 - t * 2;
    return x * x * (3 - 2 * x);
  },
  rush_into: (t) => t * t,
  rush_from: (t) => 1 - (1 - t) * (1 - t),
  ease_in_out_sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  double_smooth: (t) => (t < 0.5 ? 0.5 * RATE.smooth(2 * t) : 0.5 * (1 + RATE.smooth(2 * t - 1))),
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function toP(v: any, line = 0): P2 {
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === "number") return [v[0], v[1]];
  if (isMob(v)) return center(v);
  if (typeof v === "number") return [v, 0];
  throw new ScriptError("Ожидалась точка вида [x, y, 0]", line);
}
const vec3 = (p: P2) => [p[0], p[1], 0];

// ---------- LaTeX → Unicode ----------
const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ", k: "ᵏ", t: "ᵗ", a: "ᵃ", b: "ᵇ", m: "ᵐ", T: "ᵀ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", x: "ₓ", n: "ₙ", i: "ᵢ", k: "ₖ", a: "ₐ", e: "ₑ", o: "ₒ", t: "ₜ", y: "ᵧ",
};
const TEXSYM: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε", theta: "θ", lambda: "λ",
  mu: "μ", pi: "π", sigma: "σ", Sigma: "Σ", omega: "ω", Omega: "Ω", phi: "φ", varphi: "φ", psi: "ψ", rho: "ρ", tau: "τ",
  infty: "∞", cdot: "·", times: "×", div: "÷", pm: "±", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", sum: "Σ", int: "∫", rightarrow: "→", to: "→", Rightarrow: "⇒", leftarrow: "←", partial: "∂",
  nabla: "∇", in: "∈", forall: "∀", exists: "∃", sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln",
  lim: "lim", degree: "°", circ: "°", angle: "∠", perp: "⊥", parallel: "∥", quad: "  ", qquad: "    ", dots: "…", ldots: "…", cdots: "⋯",
};
function mapScript(s: string, table: Record<string, string>, mark: string) {
  if ([...s].every((c) => table[c])) return [...s].map((c) => table[c]).join("");
  return mark + (s.length > 1 ? `(${s})` : s);
}
export function texToUnicode(src: string): string {
  let s = src;
  for (let k = 0; k < 4; k++) {
    s = s.replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => {
      const w = (x: string) => (x.length > 1 && /[+\-]/.test(x) ? `(${x})` : x);
      return `${w(a)}⁄${w(b)}`;
    });
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a) => (a.length > 1 ? `√(${a})` : `√${a}`));
    s = s.replace(/\\(?:text|mathrm|mathbf|mathit|textbf|operatorname)\s*\{([^{}]*)\}/g, "$1");
    s = s.replace(/\\vec\s*\{([^{}]*)\}/g, "$1⃗");
    s = s.replace(/\\hat\s*\{([^{}]*)\}/g, "$1̂");
    s = s.replace(/\\overline\s*\{([^{}]*)\}/g, "$1̅");
  }
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\([A-Za-z]+)/g, (_m, name) => TEXSYM[name] ?? name);
  s = s.replace(/\\[,;! ]/g, " ");
  s = s.replace(/\^\s*\{([^{}]*)\}/g, (_, a) => mapScript(a, SUP, "^"));
  s = s.replace(/\^\s*(\S)/g, (_, a) => mapScript(a, SUP, "^"));
  s = s.replace(/_\s*\{([^{}]*)\}/g, (_, a) => mapScript(a, SUB, "_"));
  s = s.replace(/_\s*(\S)/g, (_, a) => mapScript(a, SUB, "_"));
  s = s.replace(/[{}]/g, "").replace(/\\\\/g, "\n").replace(/&/g, "");
  return s.replace(/\s+/g, (m) => (m.includes("\n") ? "\n" : " ")).trim();
}

// ---------- line preprocessing ----------
interface Line {
  text: string;
  indent: number;
  no: number;
}
interface ReturnSignal {
  __returnSignal: true;
  value: any;
}

const isReturnSignal = (value: unknown): value is ReturnSignal => !!value && typeof value === "object" && (value as ReturnSignal).__returnSignal === true;
function stripComment(l: string) {
  let q: string | null = null;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === "#") return l.slice(0, i);
  }
  return l;
}
function depthOf(s: string) {
  let d = 0;
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if ("([{".includes(c)) d++;
    else if (")]}".includes(c)) d--;
  }
  return d;
}
function splitTopLevel(src: string, separator = ",") {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if ("([{".includes(char)) depth++;
    else if (char === ")" || char === "]" || char === "}") depth--;
    else if (char === separator && depth === 0) {
      parts.push(src.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(src.slice(start).trim());
  return parts;
}
function preprocess(code: string): Line[] {
  const raw = code.replace(/\t/g, "    ").split("\n");
  const out: Line[] = [];
  let buf = "";
  let indent = 0;
  let startNo = 0;
  let open = false;
  for (let i = 0; i < raw.length; i++) {
    const st = stripComment(raw[i]);
    if (!open) {
      if (!st.trim()) continue;
      indent = st.match(/^ */)![0].length;
      startNo = i + 1;
      buf = st.trim();
    } else buf += " " + st.trim();
    let cont = false;
    if (buf.endsWith("\\")) {
      buf = buf.slice(0, -1);
      cont = true;
    }
    if (depthOf(buf) > 0 || cont) open = true;
    else {
      out.push({ text: buf, indent, no: startNo });
      open = false;
      buf = "";
    }
  }
  if (open && buf) out.push({ text: buf, indent, no: startNo });
  return out;
}

// ======================================================================
export function runScript(code: string): Timeline {
  return new Interpreter().run(code);
}

class Interpreter {
  vars = new Map<string, any>();
  scene: Mob[] = [];
  segments: Segment[] = [];
  time = 0;
  line = 0;
  steps = 0;
  camera: Record<string, any> = { background_color: "#000000" };
  builtins: Record<string, any> = {};
  sceneName = "Scene";

  constructor() {
    this.setupBuiltins();
  }

  err(msg: string): never {
    throw new ScriptError(msg, this.line);
  }

  run(code: string): Timeline {
    const lines = preprocess(code);
    const cls = lines.find((l) => /^class\s+/.test(l.text));
    if (cls) this.sceneName = cls.text.match(/^class\s+(\w+)/)?.[1] ?? "Scene";
    const idx = lines.findIndex((l) => /^def\s+construct\s*\(/.test(l.text));
    let body: Line[];
    // Python module constants and helpers are evaluated before construct(). This keeps normal
    // Manim source such as `BG = "#0B1220"` and top-level helper functions available to scenes.
    // Imports remain declarative because the Canvas dialect exposes its fixed m/np built-ins.
    const classIndex = lines.findIndex((l) => /^class\s+/.test(l.text));
    const prelude = classIndex >= 0 ? lines.slice(0, classIndex) : [];
    this.execBlock(prelude);
    if (idx >= 0) {
      body = [];
      const base = lines[idx].indent;
      for (let j = idx + 1; j < lines.length && lines[j].indent > base; j++) body.push(lines[j]);
    } else {
      body = lines.filter((l) => !/^(import|from|class|def)\b/.test(l.text));
    }
    this.execBlock(body);
    const bg = normalizeColor(this.camera.background_color) ?? "#000000";
    return {
      segments: this.segments,
      final: this.scene.map((m) => cloneMob(m)),
      duration: this.time,
      bg,
      sceneName: this.sceneName,
    };
  }

  execBlock(lines: Line[], local?: Map<string, any>): ReturnSignal | undefined {
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      this.line = l.no;
      if (++this.steps > 50000) this.err("Слишком много шагов выполнения (возможен бесконечный цикл)");
      const collect = (from: number) => {
        const sub: Line[] = [];
        let j = from;
        while (j < lines.length && lines[j].indent > l.indent) sub.push(lines[j++]);
        return { sub, j };
      };
      if (/^(import|from)\b/.test(l.text)) {
        i++;
        continue;
      }
      const returnM = l.text.match(/^return(?:\s+(.+))?$/);
      if (returnM) return { __returnSignal: true, value: returnM[1] ? this.evalStr(returnM[1], local) : null };
      const forM = l.text.match(/^for\s+(.+?)\s+in\s+(.+):$/);
      if (forM) {
        const { sub, j } = collect(i + 1);
        const iter = this.evalStr(forM[2], local);
        const arr = isMob(iter) ? iter.children : iter;
        if (!Array.isArray(arr)) this.err("Цикл for ожидает список или range(...)");
        for (const v of arr) {
          this.line = l.no;
          this.assignTargets(forM[1], v, local);
          const returned = this.execBlock(sub, local);
          if (returned) return returned;
        }
        i = j;
        continue;
      }
      const whileM = l.text.match(/^while\s+(.+):$/);
      if (whileM) {
        const { sub, j } = collect(i + 1);
        let iterations = 0;
        while (truthy(this.evalStr(whileM[1], local))) {
          if (++iterations > 10000) this.err("Цикл while превысил лимит в 10000 итераций");
          this.line = l.no;
          const returned = this.execBlock(sub, local);
          if (returned) return returned;
        }
        i = j;
        continue;
      }
      const ifM = l.text.match(/^if\s+(.+):$/);
      if (ifM) {
        let { sub, j } = collect(i + 1);
        const branches: { cond: string | null; body: Line[] }[] = [{ cond: ifM[1], body: sub }];
        while (j < lines.length && lines[j].indent === l.indent) {
          const el = lines[j].text.match(/^elif\s+(.+):$/);
          if (el || lines[j].text === "else:") {
            const r = (() => {
              const s: Line[] = [];
              let k = j + 1;
              while (k < lines.length && lines[k].indent > l.indent) s.push(lines[k++]);
              return { s, k };
            })();
            branches.push({ cond: el ? el[1] : null, body: r.s });
            j = r.k;
          } else break;
        }
        for (const b of branches) {
          this.line = l.no;
          if (b.cond === null || truthy(this.evalStr(b.cond, local))) {
            const returned = this.execBlock(b.body, local);
            if (returned) return returned;
            break;
          }
        }
        i = j;
        continue;
      }
      if (/^(pass|global\b|nonlocal\b)/.test(l.text)) {
        i++;
        continue;
      }
      if (/^def\s+/.test(l.text)) {
        const m = l.text.match(/^def\s+(\w+)\s*\((.*)\)\s*(->.*)?:$/);
        const { sub, j } = collect(i + 1);
        if (m) {
          const params = splitTopLevel(m[2]).filter(Boolean).map((source) => {
            const parts = splitTopLevel(source, "=");
            const name = parts[0].split(":")[0].trim();
            if (!/^[A-Za-z_]\w*$/.test(name)) this.err(`Некорректный параметр функции «${name}»`);
            return { name, defaultValue: parts.length > 1 ? this.evalStr(parts.slice(1).join("="), local) : undefined, hasDefault: parts.length > 1 };
          });
          const body = sub;
          this.vars.set(m[1], ((args: any[]) => {
            const scope = new Map<string, any>();
            params.forEach((p, k) => {
              if (k < args.length) scope.set(p.name, args[k]);
              else if (p.hasDefault) scope.set(p.name, p.defaultValue);
              else this.err(`Не передан обязательный аргумент «${p.name}»`);
            });
            if (args.length > params.length) this.err(`Функция «${m[1]}» получила лишние аргументы`);
            const returned = this.execBlock(body, scope);
            return returned?.value ?? null;
          }) as Fn);
        }
        i = j;
        continue;
      }
      this.execStmt(l.text, local);
      i++;
    }
  }

  assignTargets(target: string, v: any, scope?: Map<string, any>) {
    const names = target.replace(/[()]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    const destination = scope ?? this.vars;
    if (names.length === 1) destination.set(names[0], v);
    else {
      const arr = isMob(v) ? v.children : v;
      if (!Array.isArray(arr)) this.err("Невозможно распаковать значение");
      names.forEach((n, k) => destination.set(n, arr[k]));
    }
  }

  execStmt(text: string, scope?: Map<string, any>) {
    const idxAsg = text.match(/^([A-Za-z_][\w.]*)\[(.+?)\]\s*=(?!=)\s*([\s\S]+)$/);
    if (idxAsg) {
      const obj = this.evalStr(idxAsg[1], scope);
      const key = this.evalStr(idxAsg[2], scope);
      const val = this.evalStr(idxAsg[3], scope);
      if (Array.isArray(obj)) obj[key < 0 ? obj.length + key : key] = val;
      else if (obj && typeof obj === "object" && !isMob(obj)) obj[key] = val;
      else this.err("Присваивание по индексу не поддерживается");
      return;
    }
    const asg = text.match(/^([A-Za-z_][\w.]*(?:\s*,\s*[A-Za-z_]\w*)*)\s*([+\-*/])?=(?!=)\s*([\s\S]+)$/);
    if (asg) {
      const [, lhs, aug, rhs] = asg;
      const tupleValues = lhs.includes(",") ? splitTopLevel(rhs) : [];
      let val = tupleValues.length > 1 ? tupleValues.map((value) => this.evalStr(value, scope)) : this.evalStr(rhs, scope);
      if (lhs.includes(".") && !lhs.includes(",")) {
        const dot = lhs.lastIndexOf(".");
        const obj = this.evalStr(lhs.slice(0, dot), scope);
        const key = lhs.slice(dot + 1);
        if (obj && typeof obj === "object" && !isMob(obj)) obj[key] = val;
        return;
      }
      if (aug) val = this.arith(aug, this.lookup(lhs.trim(), scope), val);
      this.assignTargets(lhs, val, scope);
      return;
    }
    this.evalStr(text, scope);
  }

  evalStr(src: string, scope?: Map<string, any>): any {
    let node: Node;
    try {
      node = parseExpr(src);
    } catch (e) {
      if (e instanceof ParseError) this.err("Синтаксическая ошибка: " + e.message);
      throw e;
    }
    return this.ev(node, scope);
  }

  lookup(name: string, scope?: Map<string, any>): any {
    if (scope?.has(name)) return scope.get(name);
    if (this.vars.has(name)) return this.vars.get(name);
    if (name === "self") return SELF;
    if (["m", "manim", "manimx", "np", "numpy", "math", "mn"].includes(name)) return MODULE;
    if (name in this.builtins) return this.builtins[name];
    this.err(`Неизвестное имя «${name}»`);
  }

  ev(n: Node, scope?: Map<string, any>): any {
    switch (n.t) {
      case "num":
        return n.v;
      case "str":
        return n.v;
      case "fstr":
        return n.v.replace(/\{([^{}]+)\}/g, (_, inner: string) => {
          const m = inner.match(/^(.*?)(?::([^:]*))?$/)!;
          const v = this.evalStr(m[1], scope);
          const spec = m[2];
          if (spec && typeof v === "number") {
            const fm = spec.match(/\.(\d+)f/);
            if (fm) return v.toFixed(+fm[1]);
          }
          return pyStr(v);
        });
      case "name":
        return this.lookup(n.v, scope);
      case "attr":
        return this.getAttr(this.ev(n.obj, scope), n.name);
      case "call": {
        const fn = this.ev(n.fn, scope);
        const args: any[] = [];
        for (const a of n.args) {
          const v = this.ev(a.v, scope);
          if (a.spread) {
            const arr = isMob(v) ? v.children : v;
            if (!Array.isArray(arr)) this.err("Оператор * ожидает список");
            args.push(...arr);
          } else args.push(v);
        }
        const kw: Record<string, any> = {};
        for (const k in n.kwargs) kw[k] = this.ev(n.kwargs[k], scope);
        if (typeof fn !== "function") this.err("Попытка вызвать объект, который не является функцией");
        return fn(args, kw);
      }
      case "index": {
        const o = this.ev(n.obj, scope);
        const i = this.ev(n.idx, scope);
        const arr = isMob(o) ? o.children : o;
        if (Array.isArray(arr) || typeof arr === "string") {
          const k = i < 0 ? arr.length + i : i;
          if (k < 0 || k >= arr.length) this.err("Индекс вне диапазона");
          return arr[k];
        }
        if (o && typeof o === "object") return o[i];
        this.err("Индексация не поддерживается для этого значения");
      }
      // falls through (unreachable)
      case "bin": {
        if (n.op === "and") {
          const l = this.ev(n.l, scope);
          return truthy(l) ? this.ev(n.r, scope) : l;
        }
        if (n.op === "or") {
          const l = this.ev(n.l, scope);
          return truthy(l) ? l : this.ev(n.r, scope);
        }
        return this.arith(n.op, this.ev(n.l, scope), this.ev(n.r, scope));
      }
      case "neg": {
        const v = this.ev(n.v, scope);
        if (typeof v === "number") return -v;
        if (Array.isArray(v)) return v.map((x) => -x);
        this.err("Унарный минус не применим");
      }
      // falls through (unreachable)
      case "not":
        return !truthy(this.ev(n.v, scope));
      case "list":
        return n.items.map((x) => this.ev(x, scope));
      case "comp": {
        const iter = this.ev(n.iter, scope);
        const values = isMob(iter) ? iter.children : iter;
        if (!Array.isArray(values) && typeof values !== "string") this.err("Генератор ожидает список или range(...)");
        const output: any[] = [];
        for (const value of values as Iterable<any>) {
          const child = new Map(scope ?? this.vars);
          this.assignTargets(n.vars.join(","), value, child);
          if (!n.cond || truthy(this.ev(n.cond, child))) output.push(this.ev(n.expr, child));
          if (output.length > 10000) this.err("Генератор превысил лимит в 10000 элементов");
        }
        return output;
      }
      case "dict": {
        const o: Record<string, any> = {};
        for (const [k, v] of n.entries) o[String(this.ev(k, scope))] = this.ev(v, scope);
        return o;
      }
      case "lambda": {
        const params = n.params;
        const body = n.body;
        const parent = scope;
        return ((args: any[]) => {
          const s = new Map(parent ?? []);
          params.forEach((p, k) => s.set(p, args[k]));
          return this.ev(body, s);
        }) as Fn;
      }
      case "cond":
        return truthy(this.ev(n.c, scope)) ? this.ev(n.a, scope) : this.ev(n.b, scope);
    }
  }

  arith(op: string, a: any, b: any): any {
    if (typeof a === "number" && typeof b === "number") {
      switch (op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/":
          if (b === 0) this.err("Деление на ноль");
          return a / b;
        case "//": return Math.floor(a / b);
        case "%": return ((a % b) + b) % b;
        case "**": return Math.pow(a, b);
      }
    }
    switch (op) {
      case "<": return a < b;
      case ">": return a > b;
      case "<=": return a <= b;
      case ">=": return a >= b;
      case "==": return deepEqual(a, b);
      case "!=": return !deepEqual(a, b);
      case "in": return Array.isArray(b) ? b.includes(a) : typeof b === "string" ? b.includes(a) : b && a in b;
    }
    if (typeof a === "string" && op === "+") return a + pyStr(b);
    if (typeof a === "string" && op === "*" && typeof b === "number") return a.repeat(b);
    if (Array.isArray(a) || Array.isArray(b)) {
      const numArr = (x: any) => Array.isArray(x) && x.every((y) => typeof y === "number");
      if (Array.isArray(a) && Array.isArray(b)) {
        if (op === "+" && !(numArr(a) && numArr(b) && a.length === b.length)) return [...a, ...b];
        if (op === "@") {
          // matrix @ vector
          return a.map((row: number[]) => row.reduce((s, x, k) => s + x * b[k], 0));
        }
        const len = Math.max(a.length, b.length);
        return Array.from({ length: len }, (_, k) => this.arith(op, a[k] ?? 0, b[k] ?? 0));
      }
      if (Array.isArray(a)) return a.map((x) => this.arith(op, x, b));
      return (b as any[]).map((x) => this.arith(op, a, x));
    }
    this.err(`Операция «${op}» не поддерживается для этих значений`);
  }

  getAttr(obj: any, name: string): any {
    if (obj === MODULE) {
      if (name in this.builtins) return this.builtins[name];
      this.err(`В модуле нет «${name}»`);
    }
    if (obj === SELF) return this.sceneAttr(name);
    if (isProxy(obj)) {
      return ((args: any[], kw: Record<string, any>) => {
        obj.ops.push({ name, args, kw });
        return obj;
      }) as Fn;
    }
    if (isMob(obj)) return this.mobAttr(obj, name);
    if (Array.isArray(obj)) {
      if (name === "append") return ((a: any[]) => { obj.push(a[0]); return null; }) as Fn;
      if (name === "index") return ((a: any[]) => obj.indexOf(a[0])) as Fn;
    }
    if (obj && typeof obj === "object" && name in obj) return obj[name];
    if (typeof obj === "string" && name === "format") {
      return ((a: any[]) => { let k = 0; return obj.replace(/\{\}/g, () => pyStr(a[k++])); }) as Fn;
    }
    this.err(`Нет атрибута «${name}»`);
  }

  // -------------------- scene methods --------------------
  sceneAttr(name: string): any {
    switch (name) {
      case "camera":
        return this.camera;
      case "play":
        return ((args: any[], kw: Record<string, any>) => this.play(args, kw)) as Fn;
      case "wait":
        return ((args: any[], kw: Record<string, any>) => {
          const d = Number(args[0] ?? kw.duration ?? 1);
          this.pushSegment(Math.max(0.01, d), []);
          return null;
        }) as Fn;
      case "add":
      case "add_foreground_mobject":
      case "add_foreground_mobjects":
        return ((args: any[]) => {
          for (const m of args.flat()) if (isMob(m)) for (const l of leaves(m)) this.ensure(l);
          return null;
        }) as Fn;
      case "remove":
        return ((args: any[]) => {
          for (const m of args.flat()) if (isMob(m)) for (const l of leaves(m)) this.removeFromScene(l);
          return null;
        }) as Fn;
      case "clear":
        return (() => { this.scene = []; return null; }) as Fn;
      case "mobjects":
        return [...this.scene];
    }
    this.err(`У сцены нет метода «${name}»`);
  }

  ensure(m: Mob) {
    if (!this.scene.some((x) => x.id === m.id)) this.scene.push(m);
  }
  removeFromScene(m: Mob) {
    this.scene = this.scene.filter((x) => x.id !== m.id);
  }

  pushSegment(duration: number, records: Rec[], before?: Mob[]) {
    if (this.time + duration > 900) this.err("Видео слишком длинное (максимум 15 минут)");
    this.segments.push({
      start: this.time,
      duration,
      before: before ?? this.scene.map((m) => cloneMob(m)),
      records,
    });
    this.time += duration;
  }

  play(args: any[], kw: Record<string, any>) {
    const anims: Anim[] = [];
    for (const a of args.flat()) {
      if (isAnim(a)) anims.push(a);
      else if (isProxy(a)) anims.push({ __anim: true, kind: "animate", mob: a.mob, ops: a.ops, opts: {} });
      else this.err("self.play ожидает анимации, например m.Create(obj)");
    }
    if (!anims.length) this.err("self.play вызван без анимаций");
    const before = this.scene.map((m) => cloneMob(m));
    const runTime = Number(kw.run_time ?? Math.max(...anims.map((a) => Number(a.opts.run_time ?? 1))));
    const playRate = kw.rate_func;
    const lag = Number(kw.lag_ratio ?? 0);
    const groups: Rec[][] = anims.map((a) => this.build(a, playRate));
    let records: Rec[];
    if (lag > 0 && groups.length > 1) records = this.lagWrap(groups, lag);
    else records = groups.flat();
    this.pushSegment(Math.max(0.05, runTime), records, before);
    return null;
  }

  lagWrap(groups: Rec[][], lag: number): Rec[] {
    const n = groups.length;
    const total = (n - 1) * lag + 1;
    return groups.flatMap((g, i) =>
      g.map((r) => ({
        id: r.id,
        frame: (a: number) => r.frame(clamp01((a * total - i * lag) / 1)),
      }))
    );
  }

  /** Build records for an animation; also applies its end state to the live scene. */
  build(a: Anim, parentRate?: any): Rec[] {
    const rateFn: (t: number) => number =
      typeof a.opts.rate_func === "function"
        ? (t) => a.opts.rate_func([t], {})
        : typeof parentRate === "function"
          ? (t) => parentRate([t], {})
          : RATE.smooth;
    const R = (f: (t: number) => Mob | null) => (t: number) => f(rateFn(t));

    if (a.kind === "lagged") {
      const subs = a.subs!.map((s) => this.build(s, a.opts.rate_func ?? parentRate));
      return a.lag! > 0 ? this.lagWrap(subs, a.lag!) : subs.flat();
    }
    if (a.kind === "succession") {
      const subs = a.subs!.map((s) => this.build(s, a.opts.rate_func ?? parentRate));
      return this.lagWrap(subs, 1);
    }

    const mob = a.mob!;
    const ls = leaves(mob);
    const recs: Rec[] = [];

    switch (a.kind) {
      case "create":
      case "write": {
        const lagR = a.kind === "write" && ls.length > 1 ? 0.12 : 0;
        const per = ls.map((l) => {
          const start = cloneMob(l);
          this.ensure(l);
          return [{ id: l.id, frame: R((t) => withProgress(start, t)) }];
        });
        return lagR ? this.lagWrap(per, lagR) : per.flat();
      }
      case "uncreate": {
        for (const l of ls) {
          const start = cloneMob(l);
          this.removeFromScene(l);
          recs.push({ id: l.id, frame: R((t) => (t >= 1 ? null : withProgress(start, 1 - t))) });
        }
        return recs;
      }
      case "fadein":
      case "fadeout": {
        const sh: P2 | null = a.opts.shift ? toP(a.opts.shift) : null;
        const sc: number | null = a.opts.scale ? Number(a.opts.scale) : null;
        const gc = center(mob);
        for (const l of ls) {
          const start = cloneMob(l);
          const into = a.kind === "fadein";
          if (into) this.ensure(l);
          else this.removeFromScene(l);
          recs.push({
            id: l.id,
            frame: R((t) => {
              const k = into ? t : 1 - t;
              if (!into && t >= 1) return null;
              let c: Mob = { ...start, opacity: start.opacity * k };
              if (sh || sc) {
                c = transformed(c, (x) => {
                  if (sc) scaleMob(x, sc + (1 - sc) * k, gc);
                  if (sh) shiftMob(x, into ? [-sh[0] * (1 - t), -sh[1] * (1 - t)] : [sh[0] * t, sh[1] * t]);
                });
              }
              return c;
            }),
          });
        }
        return recs;
      }
      case "grow": {
        const gc = a.opts.point ? toP(a.opts.point) : center(mob);
        for (const l of ls) {
          const start = cloneMob(l);
          this.ensure(l);
          recs.push({
            id: l.id,
            frame: R((t) => transformed(start, (x) => scaleMob(x, Math.max(t, 0.001), gc))),
          });
        }
        return recs;
      }
      case "indicate": {
        const col = normalizeColor(a.opts.color) ?? MANIM_COLORS.YELLOW;
        const k = Number(a.opts.scale_factor ?? 1.2);
        const gc = center(mob);
        for (const l of ls) {
          const start = cloneMob(l);
          const tgt = transformed(start, (x) => {
            scaleMob(x, k, gc);
            setColor(x, col);
          });
          const morph = makeMorph(start, tgt);
          recs.push({ id: l.id, frame: (t) => morph(RATE.there_and_back(t)) });
        }
        return recs;
      }
      case "circumscribe": {
        const b = bbox(mob);
        const buff = 0.15;
        const rect = this.rectMob(b.maxX - b.minX + 2 * buff, b.maxY - b.minY + 2 * buff);
        moveTo(rect, center(mob));
        setColor(rect, normalizeColor(a.opts.color) ?? MANIM_COLORS.YELLOW);
        const id = rect.id;
        return [
          {
            id,
            frame: (t) =>
              t >= 1 ? null : { ...rect, progress: Math.min(1, t * 2), opacity: t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4 },
          },
        ];
      }
      case "rotate": {
        const ang = Number(a.opts.angle ?? Math.PI);
        const about = a.opts.about_point ? toP(a.opts.about_point) : center(mob);
        for (const l of ls) {
          const start = cloneMob(l);
          this.ensure(l);
          recs.push({ id: l.id, frame: R((t) => transformed(start, (x) => rotateMob(x, ang * t, about))) });
        }
        rotateMob(mob, ang, about);
        return recs;
      }
      case "movealong": {
        const path = a.target!;
        const c0 = center(mob);
        for (const l of ls) {
          const start = cloneMob(l);
          this.ensure(l);
          recs.push({
            id: l.id,
            frame: R((t) => {
              const p = pointAlong(path, t);
              return transformed(start, (x) => shiftMob(x, [p[0] - c0[0], p[1] - c0[1]]));
            }),
          });
        }
        const end = pointAlong(path, 1);
        shiftMob(mob, [end[0] - c0[0], end[1] - c0[1]]);
        return recs;
      }
      case "animate":
      case "transform":
      case "rtransform":
      case "tcopy": {
        let target: Mob;
        if (a.kind === "animate") {
          target = cloneMob(mob);
          for (const op of a.ops!) {
            const f = this.mobAttr(target, op.name);
            if (typeof f !== "function") this.err(`Нельзя анимировать «${op.name}»`);
            f(op.args, op.kw);
          }
        } else target = cloneMob(a.target!);
        const tl = leaves(target);
        const liveB = a.target ? leaves(a.target) : [];
        const n = Math.min(ls.length, tl.length);
        for (let i = 0; i < n; i++) {
          const src = ls[i];
          const start = cloneMob(src, a.kind === "tcopy");
          const tg = { ...tl[i], id: start.id };
          const morph = makeMorph(start, tg);
          recs.push({ id: start.id, frame: R(morph) });
          if (a.kind === "transform") {
            this.ensure(src);
          } else if (a.kind === "rtransform") {
            this.removeFromScene(src);
            this.ensure(liveB[i]);
          } else if (a.kind === "tcopy") {
            this.ensure(liveB[i]);
          } else this.ensure(src);
        }
        // extra source leaves fade out
        for (let i = n; i < ls.length; i++) {
          const start = cloneMob(ls[i]);
          if (a.kind !== "tcopy" && a.kind !== "animate") this.removeFromScene(ls[i]);
          if (a.kind === "animate") continue;
          recs.push({ id: start.id, frame: R((t) => (t >= 1 ? null : { ...start, opacity: 1 - t })) });
        }
        // extra target leaves fade in
        for (let i = n; i < tl.length; i++) {
          if (a.kind === "animate") continue;
          const live = liveB[i];
          const start = cloneMob(live);
          this.ensure(live);
          recs.push({ id: live.id, frame: R((t) => ({ ...start, opacity: start.opacity * t })) });
        }
        if (a.kind === "transform") {
          if (mob.kind === "group" && target.kind === "group") assignInto(mob, target);
          else if (mob.kind !== "group" && target.kind !== "group") assignInto(mob, target);
          else for (let i = 0; i < n; i++) assignInto(ls[i], tl[i]);
        } else if (a.kind === "animate") {
          assignInto(mob, target);
        }
        return recs;
      }
    }
    this.err(`Неизвестная анимация «${a.kind}»`);
  }

  // -------------------- mobject methods --------------------
  mobAttr(m: Mob, name: string): any {
    const F = (f: Fn) => f;
    const num = (v: any, d: number) => (v === undefined || v === null ? d : Number(v));
    switch (name) {
      case "animate":
        return { __proxy: true, mob: m, ops: [] } as Proxy;
      case "shift":
        return F((a) => {
          let v: P2 = [0, 0];
          for (const x of a) {
            const p = toP(x, this.line);
            v = [v[0] + p[0], v[1] + p[1]];
          }
          shiftMob(m, v);
          return m;
        });
      case "move_to":
        return F((a, kw) => {
          moveTo(m, toP(a[0] ?? kw.point_or_mobject ?? [0, 0], this.line));
          return m;
        });
      case "scale":
        return F((a, kw) => {
          scaleMob(m, num(a[0] ?? kw.scale_factor, 1), kw.about_point ? toP(kw.about_point) : undefined);
          return m;
        });
      case "stretch":
        return F((a) => {
          const k = num(a[0], 1);
          const dim = num(a[1], 0);
          stretchMob(m, dim === 0 ? k : 1, dim === 1 ? k : 1);
          return m;
        });
      case "rotate":
        return F((a, kw) => {
          rotateMob(m, num(a[0] ?? kw.angle, 0), kw.about_point ? toP(kw.about_point) : undefined);
          return m;
        });
      case "flip":
        return F(() => {
          stretchMob(m, -1, 1);
          return m;
        });
      case "apply_matrix":
        return F((a, kw) => {
          applyMatrix(m, a[0], kw.about_point ? toP(kw.about_point) : [0, 0]);
          return m;
        });
      case "apply_function":
        return F((a) => {
          const fn = a[0];
          const mp = (p: P2): P2 => toP(fn([[p[0], p[1], 0]], {}));
          const visit = (o: Mob) => {
            for (const sp of o.paths) sp.pts = sp.pts.map(mp);
            if (o.kind === "text") o.pos = mp(o.pos);
            o.children.forEach(visit);
          };
          visit(m);
          return m;
        });
      case "set_color":
        return F((a, kw) => {
          setColor(m, normalizeColor(a[0] ?? kw.color) ?? "#FFFFFF");
          return m;
        });
      case "set_fill":
        return F((a, kw) => {
          setFill(m, normalizeColor(a[0] ?? kw.color), a[1] ?? kw.opacity);
          return m;
        });
      case "set_stroke":
        return F((a, kw) => {
          setStroke(m, normalizeColor(a[0] ?? kw.color), a[1] ?? kw.width, kw.opacity);
          return m;
        });
      case "set_opacity":
        return F((a) => {
          const o = num(a[0], 1);
          const visit = (x: Mob) => {
            x.opacity = o;
            x.children.forEach(visit);
          };
          visit(m);
          return m;
        });
      case "set_z_index":
        return F((a) => {
          const visit = (x: Mob) => {
            x.z = num(a[0], 0);
            x.children.forEach(visit);
          };
          visit(m);
          return m;
        });
      case "next_to":
        return F((a, kw) => {
          const tgt = a[0];
          const dir = toP(a[1] ?? kw.direction ?? [1, 0, 0]);
          const buff = num(a[2] ?? kw.buff, 0.25);
          const tb = isMob(tgt) ? bbox(tgt) : (() => { const p = toP(tgt); return { minX: p[0], maxX: p[0], minY: p[1], maxY: p[1] }; })();
          const sb = bbox(m);
          const tx = dir[0] > 0 ? tb.maxX : dir[0] < 0 ? tb.minX : (tb.minX + tb.maxX) / 2;
          const ty = dir[1] > 0 ? tb.maxY : dir[1] < 0 ? tb.minY : (tb.minY + tb.maxY) / 2;
          const sx = dir[0] > 0 ? sb.minX : dir[0] < 0 ? sb.maxX : (sb.minX + sb.maxX) / 2;
          const sy = dir[1] > 0 ? sb.minY : dir[1] < 0 ? sb.maxY : (sb.minY + sb.maxY) / 2;
          shiftMob(m, [tx - sx + Math.sign(dir[0]) * buff, ty - sy + Math.sign(dir[1]) * buff]);
          return m;
        });
      case "to_edge":
      case "to_corner":
        return F((a, kw) => {
          const dir = toP(a[0] ?? kw.edge ?? kw.corner ?? (name === "to_edge" ? [-1, 0, 0] : [-1, 1, 0]));
          const buff = num(a[1] ?? kw.buff, 0.5);
          const b = bbox(m);
          let dx = 0,
            dy = 0;
          if (dir[0] > 0) dx = FRAME_W / 2 - buff - b.maxX;
          if (dir[0] < 0) dx = -FRAME_W / 2 + buff - b.minX;
          if (dir[1] > 0) dy = FRAME_H / 2 - buff - b.maxY;
          if (dir[1] < 0) dy = -FRAME_H / 2 + buff - b.minY;
          shiftMob(m, [dx, dy]);
          return m;
        });
      case "align_to":
        return F((a) => {
          const tb = isMob(a[0]) ? bbox(a[0]) : null;
          const dir = toP(a[1] ?? [0, 1, 0]);
          const p = tb ? null : toP(a[0]);
          const sb = bbox(m);
          let dx = 0,
            dy = 0;
          if (dir[0] > 0) dx = (tb ? tb.maxX : p![0]) - sb.maxX;
          if (dir[0] < 0) dx = (tb ? tb.minX : p![0]) - sb.minX;
          if (dir[1] > 0) dy = (tb ? tb.maxY : p![1]) - sb.maxY;
          if (dir[1] < 0) dy = (tb ? tb.minY : p![1]) - sb.minY;
          shiftMob(m, [dx, dy]);
          return m;
        });
      case "arrange":
        return F((a, kw) => {
          const dir = toP(a[0] ?? kw.direction ?? [1, 0, 0]);
          const buff = num(a[1] ?? kw.buff, 0.25);
          const c0 = center(m);
          m.children.forEach((c, i) => {
            if (i === 0) return;
            this.mobAttr(c, "next_to")([m.children[i - 1], [dir[0], dir[1], 0], buff], {});
          });
          delete m.meta.center;
          moveTo(m, c0);
          return m;
        });
      case "arrange_in_grid":
        return F((a, kw) => {
          const rows = num(kw.rows ?? a[0], 0);
          const cols = num(kw.cols ?? a[1], Math.ceil(Math.sqrt(m.children.length)));
          const buff = num(kw.buff, 0.3);
          const r = rows || Math.ceil(m.children.length / cols);
          let cw = 0, ch = 0;
          m.children.forEach((c) => { const b = bbox(c); cw = Math.max(cw, b.maxX - b.minX); ch = Math.max(ch, b.maxY - b.minY); });
          const c0 = center(m);
          m.children.forEach((c, i) => {
            const row = Math.floor(i / cols), col = i % cols;
            moveTo(c, [(col - (cols - 1) / 2) * (cw + buff), ((r - 1) / 2 - row) * (ch + buff)]);
          });
          moveTo(m, c0);
          return m;
        });
      case "add":
        return F((a) => {
          for (const x of a.flat()) if (isMob(x)) m.children.push(x);
          if (m.kind !== "group") m.kind = "group";
          return m;
        });
      case "get_center":
        return F(() => vec3(center(m)));
      case "get_top":
      case "get_bottom":
      case "get_left":
      case "get_right":
      case "get_corner": {
        return F((a) => {
          const b = bbox(m);
          const c = center(m);
          if (name === "get_top") return [c[0], b.maxY, 0];
          if (name === "get_bottom") return [c[0], b.minY, 0];
          if (name === "get_left") return [b.minX, c[1], 0];
          if (name === "get_right") return [b.maxX, c[1], 0];
          const d = toP(a[0]);
          return [d[0] > 0 ? b.maxX : b.minX, d[1] > 0 ? b.maxY : b.minY, 0];
        });
      }
      case "get_x":
        return F(() => center(m)[0]);
      case "get_y":
        return F(() => center(m)[1]);
      case "width":
        return (() => { const b = bbox(m); return b.maxX - b.minX; })();
      case "height":
        return (() => { const b = bbox(m); return b.maxY - b.minY; })();
      case "get_width":
        return F(() => { const b = bbox(m); return b.maxX - b.minX; });
      case "get_height":
        return F(() => { const b = bbox(m); return b.maxY - b.minY; });
      case "scale_to_fit_width":
      case "set_width":
        return F((a) => {
          const b = bbox(m);
          const w = b.maxX - b.minX || 1;
          scaleMob(m, num(a[0], 1) / w);
          return m;
        });
      case "scale_to_fit_height":
      case "set_height":
        return F((a) => {
          const b = bbox(m);
          const h = b.maxY - b.minY || 1;
          scaleMob(m, num(a[0], 1) / h);
          return m;
        });
      case "get_start":
        return F(() => { const p = leaves(m)[0]?.paths[0]?.pts; return p ? vec3(p[0]) : vec3(center(m)); });
      case "get_end":
        return F(() => {
          const sp = leaves(m)[0]?.paths[0];
          if (!sp) return vec3(center(m));
          return vec3(sp.closed ? sp.pts[0] : sp.pts[sp.pts.length - 1]);
        });
      case "point_from_proportion":
        return F((a) => vec3(pointAlong(m, num(a[0], 0))));
      case "get_vertices":
        return F(() => (leaves(m)[0]?.paths[0]?.pts ?? []).map(vec3));
      case "copy":
        return F(() => cloneMob(m, true));
      case "c2p":
      case "coords_to_point":
      case "n2p":
      case "number_to_point":
      case "i2gp":
        return F((a) => {
          const ax = m.axes;
          if (!ax) this.err("Метод c2p доступен только для Axes / NumberPlane / NumberLine");
          let x: number, y: number;
          if (name === "i2gp") {
            x = num(a[0], 0);
            const g = a[1];
            y = g && g.meta && typeof g.meta.fn === "function" ? (g.meta.fn as Fn)([x], {}) : 0;
          } else if (Array.isArray(a[0])) [x, y] = [a[0][0], a[0][1] ?? 0];
          else [x, y] = [num(a[0], 0), num(a[1], 0)];
          return [ax.origin[0] + x * ax.ux[0] + y * ax.uy[0], ax.origin[1] + x * ax.ux[1] + y * ax.uy[1], 0];
        });
      case "p2c":
        return F((a) => {
          const ax = m.axes!;
          const p = toP(a[0]);
          return [(p[0] - ax.origin[0]) / (ax.ux[0] || 1), (p[1] - ax.origin[1]) / (ax.uy[1] || 1)];
        });
      case "plot":
      case "get_graph":
        return F((a, kw) => {
          if (!m.axes) this.err("plot доступен только для Axes / NumberPlane");
          const fn = a[0] as Fn;
          const xr = kw.x_range ?? a[1] ?? m.axes.xr;
          return this.plotGraph(m, fn, Number(xr[0]), Number(xr[1]), normalizeColor(kw.color) ?? MANIM_COLORS.YELLOW, kw.stroke_width);
        });
      case "get_area":
        return F((a, kw) => {
          const g: Mob = a[0];
          const fn = g.meta.fn as Fn;
          const xr = kw.x_range ?? a[1] ?? m.axes!.xr;
          const ax = m.axes!;
          const pts: P2[] = [];
          const x0 = Number(xr[0]), x1 = Number(xr[1]);
          const c2p = (x: number, y: number): P2 => [ax.origin[0] + x * ax.ux[0] + y * ax.uy[0], ax.origin[1] + x * ax.ux[1] + y * ax.uy[1]];
          pts.push(c2p(x0, 0));
          for (let i = 0; i <= 80; i++) { const x = x0 + ((x1 - x0) * i) / 80; pts.push(c2p(x, Number(fn([x], {})))); }
          pts.push(c2p(x1, 0));
          const mob = baseMob("path", "Area");
          mob.paths = [{ pts, closed: true }];
          const col = normalizeColor(kw.color) ?? MANIM_COLORS.BLUE;
          mob.stroke = col; mob.fill = col; mob.strokeWidth = 0; mob.fillOpacity = Number(kw.opacity ?? 0.4);
          return mob;
        });
      case "get_axis_labels":
        return F((a, kw) => {
          const ax = m.axes!;
          const xl = this.textMob(texToUnicode(String(a[0] ?? kw.x_label ?? "x")), 36, "serif");
          const yl = this.textMob(texToUnicode(String(a[1] ?? kw.y_label ?? "y")), 36, "serif");
          const xe: P2 = [ax.origin[0] + ax.xr[1] * ax.ux[0], ax.origin[1] + ax.xr[1] * ax.ux[1]];
          const ye: P2 = [ax.origin[0] + ax.yr[1] * ax.uy[0], ax.origin[1] + ax.yr[1] * ax.uy[1]];
          moveTo(xl, [xe[0] + 0.35, xe[1] + 0.3]);
          moveTo(yl, [ye[0] + 0.35, ye[1] + 0.1]);
          return this.group([xl, yl]);
        });
      case "get_text":
      case "get_tex":
        return F((a, kw) => {
          const dir = (m.meta.dir as P2) ?? [0, -1];
          const t = this.textMob(texToUnicode(String(a[0] ?? "")), Number(kw.font_size ?? 40), "serif");
          this.mobAttr(t, "next_to")([m, [dir[0], dir[1], 0], 0.15], {});
          return t;
        });
      case "become":
        return F((a) => {
          assignInto(m, cloneMob(a[0]));
          return m;
        });
      case "add_coordinates":
      case "add_tip":
      case "set_sheen":
      case "set_shade_in_3d":
        return F(() => m);
      case "submobjects":
        return m.children;
      case "text":
        return m.text;
      case "color":
        return m.stroke;
    }
    this.err(`У объекта ${m.name} нет метода «${name}»`);
  }

  // -------------------- constructors --------------------
  styled(m: Mob, kw: Record<string, any>, defColor: string, defFill = 0) {
    const col = normalizeColor(kw.color) ?? defColor;
    m.stroke = normalizeColor(kw.stroke_color) ?? col;
    m.fill = normalizeColor(kw.fill_color) ?? col;
    m.fillOpacity = Number(kw.fill_opacity ?? defFill);
    m.strokeWidth = Number(kw.stroke_width ?? m.strokeWidth);
    if (kw.stroke_opacity !== undefined) m.strokeOpacity = Number(kw.stroke_opacity);
    if (kw.opacity !== undefined) m.opacity = Number(kw.opacity);
    return m;
  }
  pathMob(name: string, paths: { pts: P2[]; closed: boolean }[]) {
    const m = baseMob("path", name);
    m.paths = paths;
    return m;
  }
  rectMob(w: number, h: number) {
    return this.pathMob("Rectangle", [{ pts: [[w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]], closed: true }]);
  }
  textMob(text: string, size: number, font: "serif" | "sans") {
    const m = baseMob("text", "Text");
    m.text = text;
    m.fontSize = size;
    m.font = font;
    m.fillOpacity = 1;
    m.strokeWidth = 0;
    return m;
  }
  group(children: Mob[]) {
    const g = baseMob("group", "VGroup");
    g.children = children;
    return g;
  }
  plotGraph(axesMob: Mob | null, fn: Fn, x0: number, x1: number, color: string, sw?: number) {
    const ax = axesMob?.axes;
    const n = 200;
    const paths: { pts: P2[]; closed: boolean }[] = [];
    let cur: P2[] = [];
    const ymin = ax ? ax.yr[0] - (ax.yr[1] - ax.yr[0]) * 0.08 : -FRAME_H;
    const ymax = ax ? ax.yr[1] + (ax.yr[1] - ax.yr[0]) * 0.08 : FRAME_H;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      let y: number;
      try {
        y = Number(fn([x], {}));
      } catch (e) {
        if (e instanceof ScriptError) throw e;
        y = NaN;
      }
      if (!isFinite(y) || y < ymin || y > ymax) {
        if (cur.length > 1) paths.push({ pts: cur, closed: false });
        cur = [];
        continue;
      }
      cur.push(ax ? [ax.origin[0] + x * ax.ux[0] + y * ax.uy[0], ax.origin[1] + x * ax.ux[1] + y * ax.uy[1]] : [x, y]);
    }
    if (cur.length > 1) paths.push({ pts: cur, closed: false });
    const m = this.pathMob("Graph", paths);
    m.stroke = color;
    m.fill = color;
    if (sw) m.strokeWidth = Number(sw);
    m.meta.fn = fn;
    return m;
  }
  axesMob(kw: Record<string, any>, plane: boolean) {
    const xr = (kw.x_range ?? (plane ? [-7, 7, 1] : [-6, 6, 1])).map(Number) as number[];
    const yr = (kw.y_range ?? (plane ? [-4, 4, 1] : [-3, 3, 1])).map(Number) as number[];
    if (xr.length < 3) xr.push(1);
    if (yr.length < 3) yr.push(1);
    const xl = Number(kw.x_length ?? (plane ? xr[1] - xr[0] : 12));
    const yl = Number(kw.y_length ?? (plane ? yr[1] - yr[0] : 6));
    const sx = xl / (xr[1] - xr[0]);
    const sy = yl / (yr[1] - yr[0]);
    const ox = -((xr[0] + xr[1]) / 2) * sx;
    const oy = -((yr[0] + yr[1]) / 2) * sy;
    const X = (x: number) => ox + x * sx;
    const Y = (y: number) => oy + y * sy;
    const yAxisX = xr[0] <= 0 && xr[1] >= 0 ? 0 : xr[0];
    const xAxisY = yr[0] <= 0 && yr[1] >= 0 ? 0 : yr[0];
    const axisCol = normalizeColor(kw.axis_config?.color ?? kw.color) ?? (plane ? "#FFFFFF" : "#BBBBBB");
    const paths: { pts: P2[]; closed: boolean }[] = [];
    paths.push({ pts: [[X(xr[0]), Y(xAxisY)], [X(xr[1]), Y(xAxisY)]], closed: false });
    paths.push({ pts: [[X(yAxisX), Y(yr[0])], [X(yAxisX), Y(yr[1])]], closed: false });
    const tick = 0.08;
    if (!plane) {
      for (let x = Math.ceil(xr[0] / xr[2]) * xr[2]; x <= xr[1] + 1e-9; x += xr[2]) {
        if (Math.abs(x - yAxisX) < 1e-9) continue;
        paths.push({ pts: [[X(x), Y(xAxisY) - tick], [X(x), Y(xAxisY) + tick]], closed: false });
      }
      for (let y = Math.ceil(yr[0] / yr[2]) * yr[2]; y <= yr[1] + 1e-9; y += yr[2]) {
        if (Math.abs(y - xAxisY) < 1e-9) continue;
        paths.push({ pts: [[X(yAxisX) - tick, Y(y)], [X(yAxisX) + tick, Y(y)]], closed: false });
      }
      if (kw.tips !== false) {
        paths.push({ pts: arrowTip([X(xr[0]), Y(xAxisY)], [X(xr[1]) + 0.2, Y(xAxisY)], 0.2), closed: true });
        paths.push({ pts: arrowTip([X(yAxisX), Y(yr[0])], [X(yAxisX), Y(yr[1]) + 0.2], 0.2), closed: true });
      }
    }
    const axes = this.pathMob(plane ? "Axes" : "Axes", paths);
    axes.stroke = axisCol;
    axes.fill = axisCol;
    axes.fillOpacity = 1;
    axes.strokeWidth = 2.5;
    const info = { origin: [ox, oy] as P2, ux: [sx, 0] as P2, uy: [0, sy] as P2, xr: xr as [number, number, number], yr: yr as [number, number, number] };
    const numbers: Mob[] = [];
    if (kw.include_numbers || kw.axis_config?.include_numbers) {
      for (let x = Math.ceil(xr[0] / xr[2]) * xr[2]; x <= xr[1] + 1e-9; x += xr[2]) {
        if (Math.abs(x) < 1e-9) continue;
        const t = this.textMob(String(+x.toFixed(2)), 24, "serif");
        t.fill = axisCol;
        moveTo(t, [X(x), Y(xAxisY) - 0.32]);
        numbers.push(t);
      }
      for (let y = Math.ceil(yr[0] / yr[2]) * yr[2]; y <= yr[1] + 1e-9; y += yr[2]) {
        if (Math.abs(y) < 1e-9) continue;
        const t = this.textMob(String(+y.toFixed(2)), 24, "serif");
        t.fill = axisCol;
        moveTo(t, [X(yAxisX) - 0.35, Y(y)]);
        numbers.push(t);
      }
    }
    if (!plane) {
      if (!numbers.length) {
        axes.axes = info;
        axes.name = "Axes";
        return axes;
      }
      const g = this.group([axes, ...numbers]);
      g.axes = info;
      g.name = "Axes";
      return g;
    }
    const grid: { pts: P2[]; closed: boolean }[] = [];
    for (let x = Math.ceil(xr[0] / xr[2]) * xr[2]; x <= xr[1] + 1e-9; x += xr[2]) {
      if (Math.abs(x - yAxisX) < 1e-9) continue;
      grid.push({ pts: [[X(x), Y(yr[0])], [X(x), Y(yr[1])]], closed: false });
    }
    for (let y = Math.ceil(yr[0] / yr[2]) * yr[2]; y <= yr[1] + 1e-9; y += yr[2]) {
      if (Math.abs(y - xAxisY) < 1e-9) continue;
      grid.push({ pts: [[X(xr[0]), Y(y)], [X(xr[1]), Y(y)]], closed: false });
    }
    const gm = this.pathMob("Grid", grid);
    const gcol = normalizeColor(kw.background_line_style?.stroke_color) ?? MANIM_COLORS.BLUE_D;
    gm.stroke = gcol;
    gm.strokeWidth = Number(kw.background_line_style?.stroke_width ?? 2);
    gm.strokeOpacity = Number(kw.background_line_style?.stroke_opacity ?? 0.6);
    const g = this.group([gm, axes, ...numbers]);
    g.axes = info;
    g.name = "NumberPlane";
    return g;
  }

  setupBuiltins() {
    const B = this.builtins;
    const C = MANIM_COLORS;
    for (const k in C) B[k] = C[k];
    Object.assign(B, {
      UP: [0, 1, 0], DOWN: [0, -1, 0], LEFT: [-1, 0, 0], RIGHT: [1, 0, 0],
      UL: [-1, 1, 0], UR: [1, 1, 0], DL: [-1, -1, 0], DR: [1, -1, 0],
      ORIGIN: [0, 0, 0], OUT: [0, 0, 1], IN: [0, 0, -1],
      PI: Math.PI, TAU: Math.PI * 2, DEGREES: Math.PI / 180, pi: Math.PI, e: Math.E, E: Math.E, inf: Infinity,
      True: true, False: false, None: null,
      FRAME_WIDTH: FRAME_W, FRAME_HEIGHT: FRAME_H,
      config: { frame_width: FRAME_W, frame_height: FRAME_H },
    });
    const f1 = (fn: (x: number) => number): Fn => (a) => (Array.isArray(a[0]) ? a[0].map(fn) : fn(Number(a[0])));
    Object.assign(B, {
      sin: f1(Math.sin), cos: f1(Math.cos), tan: f1(Math.tan), exp: f1(Math.exp), log: f1(Math.log), log10: f1(Math.log10),
      sqrt: f1(Math.sqrt), arctan: f1(Math.atan), atan: f1(Math.atan), arcsin: f1(Math.asin), asin: f1(Math.asin),
      arccos: f1(Math.acos), acos: f1(Math.acos), floor: f1(Math.floor), ceil: f1(Math.ceil), sinh: f1(Math.sinh), cosh: f1(Math.cosh), tanh: f1(Math.tanh),
      radians: f1((x) => (x * Math.PI) / 180), degrees: f1((x) => (x * 180) / Math.PI), sign: f1(Math.sign),
      atan2: ((a) => Math.atan2(a[0], a[1])) as Fn, arctan2: ((a) => Math.atan2(a[0], a[1])) as Fn,
      abs: ((a) => (Array.isArray(a[0]) ? a[0].map(Math.abs) : Math.abs(a[0]))) as Fn,
      hypot: ((a) => Math.hypot(...a)) as Fn,
      factorial: ((a) => { let r = 1; for (let i = 2; i <= a[0]; i++) r *= i; return r; }) as Fn,
      range: ((a) => {
        let [s, e, st] = a.length === 1 ? [0, a[0], 1] : [a[0], a[1], a[2] ?? 1];
        const out: number[] = [];
        if (st === 0) this.err("range: шаг не может быть 0");
        for (let i = s; st > 0 ? i < e : i > e; i += st) { out.push(i); if (out.length > 10000) break; }
        return out;
      }) as Fn,
      len: ((a) => (isMob(a[0]) ? a[0].children.length : a[0]?.length ?? 0)) as Fn,
      min: ((a) => Math.min(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a))) as Fn,
      max: ((a) => Math.max(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a))) as Fn,
      sum: ((a) => (a[0] as number[]).reduce((s, x) => s + x, 0)) as Fn,
      round: ((a) => { const k = Math.pow(10, a[1] ?? 0); return Math.round(a[0] * k) / k; }) as Fn,
      int: ((a) => Math.trunc(Number(a[0]))) as Fn,
      float: ((a) => Number(a[0])) as Fn,
      str: ((a) => pyStr(a[0])) as Fn,
      list: ((a) => (isMob(a[0]) ? [...a[0].children] : [...(a[0] ?? [])])) as Fn,
      tuple: ((a) => [...(a[0] ?? [])]) as Fn,
      reversed: ((a) => [...a[0]].reverse()) as Fn,
      enumerate: ((a) => (isMob(a[0]) ? a[0].children : a[0]).map((v: any, i: number) => [i + (a[1] ?? 0), v])) as Fn,
      zip: ((a) => { const n = Math.min(...a.map((x) => (isMob(x) ? x.children : x).length)); return Array.from({ length: n }, (_, i) => a.map((x) => (isMob(x) ? x.children : x)[i])); }) as Fn,
      print: (() => null) as Fn,
      array: ((a) => a[0]) as Fn,
      linspace: ((a) => { const [s, e, n] = [a[0], a[1], a[2] ?? 50]; return Array.from({ length: n }, (_, i) => s + ((e - s) * i) / (n - 1)); }) as Fn,
      arange: ((a) => { const [s, e, st] = a.length === 1 ? [0, a[0], 1] : [a[0], a[1], a[2] ?? 1]; const o: number[] = []; for (let x = s; x < e - 1e-12; x += st) o.push(x); return o; }) as Fn,
      dot: ((a) => a[0].reduce((s: number, x: number, i: number) => s + x * a[1][i], 0)) as Fn,
      interpolate: ((a) => this.arith("+", a[0], this.arith("*", this.arith("-", a[1], a[0]), a[2]))) as Fn,
      interpolate_color: ((a) => { const { lerpColor } = colorsMod; return lerpColor(normalizeColor(a[0])!, normalizeColor(a[1])!, a[2]); }) as Fn,
      rgb_to_color: ((a) => `rgb(${a[0].map((x: number) => Math.round(x * 255)).join(",")})`) as Fn,
      ManimColor: ((a) => normalizeColor(a[0])) as Fn,
    });
    for (const k in RATE) B[k] = ((a: any[]) => RATE[k](Number(a[0]))) as Fn;
    B.rate_functions = Object.fromEntries(Object.keys(RATE).map((k) => [k, B[k]]));

    const S = this;
    const pathCtor = (name: string, build: (a: any[], kw: Record<string, any>) => { pts: P2[]; closed: boolean }[], def: string, defFill = 0): Fn =>
      (a, kw) => S.styled(S.pathMob(name, build(a, kw)), kw, def, defFill);

    B.Circle = pathCtor("Circle", (a, kw) => [{ pts: circlePts(Number(a[0] ?? kw.radius ?? 1)), closed: true }], C.RED);
    B.Dot = ((a, kw) => {
      const r = Number(kw.radius ?? 0.08);
      const p = toP(a[0] ?? kw.point ?? [0, 0, 0]);
      const m = S.styled(S.pathMob("Dot", [{ pts: circlePts(r, 32, p[0], p[1]), closed: true }]), kw, C.WHITE, 1);
      m.fillOpacity = Number(kw.fill_opacity ?? 1);
      m.strokeWidth = Number(kw.stroke_width ?? 0);
      return m;
    }) as Fn;
    B.Ellipse = pathCtor("Ellipse", (_a, kw) => {
      const w = Number(kw.width ?? 2), h = Number(kw.height ?? 1);
      return [{ pts: circlePts(1).map(([x, y]) => [(x * w) / 2, (y * h) / 2] as P2), closed: true }];
    }, C.WHITE);
    B.Arc = pathCtor("Arc", (a, kw) => {
      const r = Number(kw.radius ?? a[0] ?? 1);
      const st = Number(kw.start_angle ?? a[1] ?? 0);
      const an = Number(kw.angle ?? a[2] ?? Math.PI / 2);
      const c = kw.arc_center ? toP(kw.arc_center) : [0, 0];
      return [{ pts: circlePts(r, 48, c[0], c[1], st, an, false), closed: false }];
    }, C.WHITE);
    B.Square = pathCtor("Square", (a, kw) => {
      const s = Number(a[0] ?? kw.side_length ?? 2) / 2;
      return [{ pts: [[s, s], [-s, s], [-s, -s], [s, -s]], closed: true }];
    }, C.WHITE);
    B.Rectangle = pathCtor("Rectangle", (a, kw) => S.rectMob(Number(kw.width ?? a[1] ?? 4), Number(kw.height ?? a[0] ?? 2)).paths, C.WHITE);
    B.RoundedRectangle = pathCtor("RoundedRectangle", (_a, kw) => {
      const w = Number(kw.width ?? 4), h = Number(kw.height ?? 2);
      const r = Math.min(Number(kw.corner_radius ?? 0.5), w / 2, h / 2);
      const pts: P2[] = [];
      const corners: [number, number, number][] = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
      for (const [cx, cy, st] of corners) for (let i = 0; i <= 10; i++) { const t = st + (Math.PI / 2) * (i / 10); pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
      return [{ pts, closed: true }];
    }, C.WHITE);
    B.Triangle = pathCtor("Triangle", () => [{ pts: [0, 1, 2].map((i) => [Math.cos(Math.PI / 2 + (i * 2 * Math.PI) / 3), Math.sin(Math.PI / 2 + (i * 2 * Math.PI) / 3)] as P2), closed: true }], C.WHITE);
    B.RegularPolygon = pathCtor("RegularPolygon", (a, kw) => {
      const n = Number(a[0] ?? kw.n ?? 6), r = Number(kw.radius ?? 1);
      return [{ pts: Array.from({ length: n }, (_, i) => [r * Math.cos((i * 2 * Math.PI) / n), r * Math.sin((i * 2 * Math.PI) / n)] as P2), closed: true }];
    }, C.WHITE);
    B.Polygon = pathCtor("Polygon", (a) => [{ pts: a.map((p) => toP(p)), closed: true }], C.BLUE);
    B.Polyline = pathCtor("Polyline", (a) => [{ pts: a.map((p) => toP(p)), closed: false }], C.WHITE);
    const lineEnds = (a: any[], kw: Record<string, any>): [P2, P2] => {
      let s = toP(a[0] ?? kw.start ?? [-1, 0, 0]);
      let e = toP(a[1] ?? kw.end ?? [1, 0, 0]);
      if (isMob(a[0]) || isMob(a[1])) {
        // shorten to boundaries roughly
        const shrink = (p: P2, q: P2, mob: any) => {
          if (!isMob(mob)) return p;
          const b = bbox(mob);
          const r = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2;
          const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
          return [p[0] + ((q[0] - p[0]) / d) * r, p[1] + ((q[1] - p[1]) / d) * r] as P2;
        };
        const s2 = shrink(s, e, a[0]);
        const e2 = shrink(e, s, a[1]);
        s = s2; e = e2;
      }
      const buff = Number(kw.buff ?? 0);
      if (buff) {
        const d = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1;
        const ux = (e[0] - s[0]) / d, uy = (e[1] - s[1]) / d;
        s = [s[0] + ux * buff, s[1] + uy * buff];
        e = [e[0] - ux * buff, e[1] - uy * buff];
      }
      return [s, e];
    };
    B.Line = pathCtor("Line", (a, kw) => [{ pts: lineEnds(a, kw), closed: false }], C.WHITE);
    B.DashedLine = ((a, kw) => {
      const [s, e] = lineEnds(a, kw);
      const n = Math.max(2, Math.round(Math.hypot(e[0] - s[0], e[1] - s[1]) / 0.2));
      const paths: { pts: P2[]; closed: boolean }[] = [];
      for (let i = 0; i < n; i += 1) {
        const t0 = i / n, t1 = (i + 0.55) / n;
        paths.push({ pts: [[s[0] + (e[0] - s[0]) * t0, s[1] + (e[1] - s[1]) * t0], [s[0] + (e[0] - s[0]) * t1, s[1] + (e[1] - s[1]) * t1]], closed: false });
      }
      return S.styled(S.pathMob("DashedLine", paths), kw, C.WHITE);
    }) as Fn;
    const arrowCtor = (name: string, dbl: boolean, vector: boolean): Fn => (a, kw) => {
      let s: P2, e: P2;
      if (vector) { s = [0, 0]; e = toP(a[0] ?? kw.direction ?? [1, 0, 0]); }
      else [s, e] = lineEnds(a, { buff: 0.25, ...kw });
      const tip = Number(kw.tip_length ?? 0.3);
      const paths = [{ pts: [s, e] as P2[], closed: false }, { pts: arrowTip(s, e, tip), closed: true }];
      if (dbl) paths.push({ pts: arrowTip(e, s, tip), closed: true });
      const m = S.styled(S.pathMob(name, paths), kw, vector ? C.YELLOW : C.WHITE, 1);
      m.fillOpacity = 1;
      if (kw.stroke_width === undefined) m.strokeWidth = 5;
      return m;
    };
    B.Arrow = arrowCtor("Arrow", false, false);
    B.DoubleArrow = arrowCtor("DoubleArrow", true, false);
    B.Vector = arrowCtor("Vector", false, true);
    B.FunctionGraph = ((a, kw) => {
      const xr = kw.x_range ?? [-FRAME_W / 2, FRAME_W / 2];
      return S.plotGraph(null, a[0], Number(xr[0]), Number(xr[1]), normalizeColor(kw.color) ?? C.YELLOW, kw.stroke_width);
    }) as Fn;
    B.ParametricFunction = ((a, kw) => {
      const tr = kw.t_range ?? a[1] ?? [0, 1];
      const fn = a[0] as Fn;
      const pts: P2[] = [];
      for (let i = 0; i <= 200; i++) { const t = Number(tr[0]) + ((Number(tr[1]) - Number(tr[0])) * i) / 200; pts.push(toP(fn([t], {}))); }
      return S.styled(S.pathMob("ParametricFunction", [{ pts, closed: false }]), kw, C.YELLOW);
    }) as Fn;
    B.Axes = ((_a, kw) => S.axesMob(kw, false)) as Fn;
    B.NumberPlane = ((_a, kw) => S.axesMob(kw, true)) as Fn;
    B.NumberLine = ((a, kw) => {
      const xr = (kw.x_range ?? a[0] ?? [-5, 5, 1]).map(Number);
      const len = Number(kw.length ?? xr[1] - xr[0]);
      const s = len / (xr[1] - xr[0]);
      const ox = -((xr[0] + xr[1]) / 2) * s;
      const paths: { pts: P2[]; closed: boolean }[] = [{ pts: [[ox + xr[0] * s, 0], [ox + xr[1] * s, 0]], closed: false }];
      const nums: Mob[] = [];
      for (let x = xr[0]; x <= xr[1] + 1e-9; x += xr[2] ?? 1) {
        paths.push({ pts: [[ox + x * s, -0.1], [ox + x * s, 0.1]], closed: false });
        if (kw.include_numbers) { const t = S.textMob(String(+x.toFixed(2)), 26, "serif"); moveTo(t, [ox + x * s, -0.4]); nums.push(t); }
      }
      const line = S.styled(S.pathMob("NumberLine", paths), kw, C.WHITE);
      line.strokeWidth = 2.5;
      const info = { origin: [ox, 0] as P2, ux: [s, 0] as P2, uy: [0, s] as P2, xr: xr as any, yr: [-1, 1, 1] as any };
      if (!nums.length) { line.axes = info; return line; }
      const g = S.group([line, ...nums]);
      g.axes = info;
      return g;
    }) as Fn;
    const textCtor = (font: "serif" | "sans", tex: boolean): Fn => (a, kw) => {
      const raw = a.map((x) => pyStr(x)).join(tex ? " " : "");
      const t = S.textMob(tex ? texToUnicode(raw) : raw, Number(kw.font_size ?? 48), font);
      const col = normalizeColor(kw.color ?? kw.fill_color);
      if (col) { t.fill = col; t.stroke = col; }
      if (kw.scale) scaleMob(t, Number(kw.scale));
      return t;
    };
    B.Text = textCtor("sans", false);
    B.MarkupText = B.Text;
    B.Paragraph = ((a, kw) => textCtor("sans", false)([a.join("\n")], kw)) as Fn;
    B.Tex = textCtor("serif", true);
    B.MathTex = textCtor("serif", true);
    B.Title = ((a, kw) => {
      const t = textCtor("serif", true)(a, kw) as Mob;
      S.mobAttr(t, "to_edge")([[0, 1, 0]], {});
      return t;
    }) as Fn;
    B.DecimalNumber = ((a, kw) => S.textMob(Number(a[0] ?? 0).toFixed(Number(kw.num_decimal_places ?? 2)), Number(kw.font_size ?? 48), "serif")) as Fn;
    B.Integer = ((a, kw) => S.textMob(String(Math.round(Number(a[0] ?? 0))), Number(kw.font_size ?? 48), "serif")) as Fn;
    B.VGroup = ((a) => S.group(a.flat().filter(isMob))) as Fn;
    B.Group = B.VGroup;
    B.SurroundingRectangle = ((a, kw) => {
      const b = bbox(a[0]);
      const buff = Number(kw.buff ?? 0.15);
      const r = S.rectMob(b.maxX - b.minX + 2 * buff, b.maxY - b.minY + 2 * buff);
      moveTo(r, [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]);
      r.name = "SurroundingRectangle";
      return S.styled(r, kw, C.YELLOW);
    }) as Fn;
    B.BackgroundRectangle = ((a, kw) => {
      const r = B.SurroundingRectangle(a, { color: C.BLACK, fill_opacity: 0.75, ...kw }) as Mob;
      r.strokeWidth = 0;
      return r;
    }) as Fn;
    B.Brace = ((a, kw) => {
      const b = bbox(a[0]);
      const d = toP(a[1] ?? kw.direction ?? [0, -1, 0]);
      const buff = Number(kw.buff ?? 0.15);
      const horiz = Math.abs(d[1]) >= Math.abs(d[0]);
      const L = horiz ? b.maxX - b.minX : b.maxY - b.minY;
      const depth = 0.22;
      const pts: P2[] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const u = -L / 2 + L * t;
        const bump = depth * (0.35 + 0.65 * Math.exp(-Math.pow((t - 0.5) * 18, 2))) * Math.min(1, Math.min(t, 1 - t) * 12);
        pts.push([u, bump]);
      }
      let mapped: P2[];
      if (horiz) {
        const y0 = d[1] < 0 ? b.minY - buff : b.maxY + buff;
        const sg = d[1] < 0 ? -1 : 1;
        mapped = pts.map(([u, v]) => [(b.minX + b.maxX) / 2 + u, y0 + sg * v]);
      } else {
        const x0 = d[0] < 0 ? b.minX - buff : b.maxX + buff;
        const sg = d[0] < 0 ? -1 : 1;
        mapped = pts.map(([u, v]) => [x0 + sg * v, (b.minY + b.maxY) / 2 + u]);
      }
      const m = S.styled(S.pathMob("Brace", [{ pts: mapped, closed: false }]), kw, C.WHITE);
      m.strokeWidth = Number(kw.stroke_width ?? 3);
      m.meta.dir = [Math.sign(d[0]) * (horiz ? 0 : 1), Math.sign(d[1]) * (horiz ? 1 : 0)];
      return m;
    }) as Fn;

    // animations
    const anim = (kind: string): Fn => (a, kw) => {
      const mob = a[0];
      if (!isMob(mob)) this.err(`Анимация ожидает объект (mobject)`);
      return { __anim: true, kind, mob, target: a[1], opts: kw } as Anim;
    };
    Object.assign(B, {
      Create: anim("create"), ShowCreation: anim("create"), GrowArrow: anim("create"), DrawBorderThenFill: anim("write"),
      Write: anim("write"), AddTextLetterByLetter: anim("write"), Uncreate: anim("uncreate"), Unwrite: anim("uncreate"),
      FadeIn: anim("fadein"), FadeOut: anim("fadeout"), GrowFromCenter: anim("grow"), GrowFromPoint: ((a: any[], kw: any) => ({ __anim: true, kind: "grow", mob: a[0], opts: { ...kw, point: a[1] } })) as Fn,
      SpinInFromNothing: anim("grow"), Indicate: anim("indicate"), Circumscribe: anim("circumscribe"), Flash: anim("indicate"), Wiggle: anim("indicate"), FocusOn: anim("indicate"),
      Transform: ((a: any[], kw: any) => this.mkTransform("transform", a, kw)) as Fn,
      ReplacementTransform: ((a: any[], kw: any) => this.mkTransform("rtransform", a, kw)) as Fn,
      TransformMatchingTex: ((a: any[], kw: any) => this.mkTransform("rtransform", a, kw)) as Fn,
      TransformMatchingShapes: ((a: any[], kw: any) => this.mkTransform("rtransform", a, kw)) as Fn,
      TransformFromCopy: ((a: any[], kw: any) => this.mkTransform("tcopy", a, kw)) as Fn,
      FadeTransform: ((a: any[], kw: any) => this.mkTransform("rtransform", a, kw)) as Fn,
      MoveToTarget: anim("create"),
      Rotate: ((a: any[], kw: any) => ({ __anim: true, kind: "rotate", mob: a[0], opts: { ...kw, angle: a[1] ?? kw.angle } })) as Fn,
      Rotating: ((a: any[], kw: any) => ({ __anim: true, kind: "rotate", mob: a[0], opts: { rate_func: B.linear, ...kw, angle: kw.radians ?? a[1] ?? Math.PI * 2 } })) as Fn,
      MoveAlongPath: ((a: any[], kw: any) => ({ __anim: true, kind: "movealong", mob: a[0], target: a[1], opts: kw })) as Fn,
      LaggedStart: ((a: any[], kw: any) => ({ __anim: true, kind: "lagged", subs: this.toAnims(a), lag: Number(kw.lag_ratio ?? 0.05), opts: kw })) as Fn,
      AnimationGroup: ((a: any[], kw: any) => ({ __anim: true, kind: "lagged", subs: this.toAnims(a), lag: Number(kw.lag_ratio ?? 0), opts: kw })) as Fn,
      Succession: ((a: any[], kw: any) => ({ __anim: true, kind: "succession", subs: this.toAnims(a), opts: kw })) as Fn,
    });
  }

  toAnims(a: any[]): Anim[] {
    return a.flat().map((x) => {
      if (isAnim(x)) return x;
      if (isProxy(x)) return { __anim: true, kind: "animate", mob: x.mob, ops: x.ops, opts: {} } as Anim;
      this.err("Ожидалась анимация");
    });
  }

  mkTransform(kind: string, a: any[], kw: Record<string, any>): Anim {
    if (!isMob(a[0]) || !isMob(a[1])) this.err("Transform ожидает два объекта: Transform(a, b)");
    return { __anim: true, kind, mob: a[0], target: a[1], opts: kw };
  }
}

import * as colorsMod from "./colors";

function truthy(v: any) {
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function pyStr(v: any): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(+v.toFixed(6));
  if (Array.isArray(v)) return "[" + v.map(pyStr).join(", ") + "]";
  if (typeof v === "object" && "kind" in v) return v.name;
  return String(v);
}

// ---------- frame evaluation ----------
export function framAt(tl: Timeline, t: number): Mob[] {
  if (t >= tl.duration || tl.segments.length === 0) return tl.final;
  let lo = 0,
    hi = tl.segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tl.segments[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  const seg = tl.segments[lo];
  const a = clamp01((t - seg.start) / seg.duration);
  const list = seg.before.slice();
  for (const r of seg.records) {
    const m = r.frame(a);
    const idx = list.findIndex((x) => x.id === r.id);
    if (m === null) {
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx >= 0) list[idx] = m;
    else list.push(m);
  }
  return list;
}

export { newId };
