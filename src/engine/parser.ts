export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "fstr"; v: string }
  | { t: "name"; v: string }
  | { t: "attr"; obj: Node; name: string }
  | { t: "call"; fn: Node; args: { spread: boolean; v: Node }[]; kwargs: Record<string, Node> }
  | { t: "index"; obj: Node; idx: Node }
  | { t: "bin"; op: string; l: Node; r: Node }
  | { t: "neg"; v: Node }
  | { t: "not"; v: Node }
  | { t: "list"; items: Node[] }
  | { t: "dict"; entries: [Node, Node][] }
  | { t: "lambda"; params: string[]; body: Node }
  | { t: "cond"; c: Node; a: Node; b: Node };

interface Tok {
  t: "num" | "str" | "fstr" | "name" | "op" | "eof";
  v: string;
}

export class ParseError extends Error {}

const ESC: Record<string, string> = { n: "\n", t: "\t", "\\": "\\", '"': '"', "'": "'" };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    // strings with optional prefix
    const pm = src.slice(i).match(/^([rRfFbBuU]{0,2})(["'])/);
    if (pm && (pm[1].length > 0 ? /[A-Za-z]/.test(c) : true) && (pm[1].length > 0 || c === '"' || c === "'")) {
      const prefix = pm[1].toLowerCase();
      const q = pm[2];
      const triple = src.slice(i + pm[1].length, i + pm[1].length + 3) === q.repeat(3);
      let j = i + pm[1].length + (triple ? 3 : 1);
      let val = "";
      const raw = prefix.includes("r");
      while (j < src.length) {
        if (triple ? src.slice(j, j + 3) === q.repeat(3) : src[j] === q) break;
        if (src[j] === "\\" && j + 1 < src.length) {
          const n = src[j + 1];
          if (raw) {
            val += "\\" + n;
          } else if (ESC[n] !== undefined) {
            val += ESC[n];
          } else {
            val += "\\" + n;
          }
          j += 2;
          continue;
        }
        val += src[j];
        j++;
      }
      if (j >= src.length) throw new ParseError("Незакрытая строка");
      out.push({ t: prefix.includes("f") ? "fstr" : "str", v: val });
      i = j + (triple ? 3 : 1);
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = src.slice(i).match(/^(\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/);
      if (m) {
        out.push({ t: "num", v: m[1].replace(/_/g, "") });
        i += m[1].length;
        continue;
      }
    }
    if (/[A-Za-z_\u0400-\u04FF]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*/)!;
      out.push({ t: "name", v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["**", "//", "==", "!=", "<=", ">=", "->"].includes(two)) {
      out.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/%()[]{},:.=<>@".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new ParseError(`Неожиданный символ «${c}»`);
  }
  out.push({ t: "eof", v: "" });
  return out;
}

export function parseExpr(src: string): Node {
  const p = new Parser(tokenize(src));
  const n = p.expr();
  if (p.peek().t !== "eof") throw new ParseError(`Лишний фрагмент: «${p.peek().v}»`);
  return n;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek(o = 0) {
    return this.toks[this.i + o];
  }
  next() {
    return this.toks[this.i++];
  }
  isOp(v: string, o = 0) {
    const t = this.peek(o);
    return t.t === "op" && t.v === v;
  }
  isName(v: string) {
    const t = this.peek();
    return t.t === "name" && t.v === v;
  }
  expect(v: string) {
    if (!this.isOp(v)) throw new ParseError(`Ожидалось «${v}», найдено «${this.peek().v || "конец строки"}»`);
    this.next();
  }

  expr(): Node {
    if (this.isName("lambda")) {
      this.next();
      const params: string[] = [];
      while (!this.isOp(":")) {
        const t = this.next();
        if (t.t === "name") params.push(t.v);
        else if (!(t.t === "op" && t.v === ",")) throw new ParseError("Некорректный lambda");
      }
      this.expect(":");
      return { t: "lambda", params, body: this.expr() };
    }
    const a = this.or();
    if (this.isName("if")) {
      this.next();
      const c = this.or();
      if (!this.isName("else")) throw new ParseError("Ожидалось else");
      this.next();
      const b = this.expr();
      return { t: "cond", c, a, b };
    }
    return a;
  }
  or(): Node {
    let l = this.and();
    while (this.isName("or")) {
      this.next();
      l = { t: "bin", op: "or", l, r: this.and() };
    }
    return l;
  }
  and(): Node {
    let l = this.not();
    while (this.isName("and")) {
      this.next();
      l = { t: "bin", op: "and", l, r: this.not() };
    }
    return l;
  }
  not(): Node {
    if (this.isName("not")) {
      this.next();
      return { t: "not", v: this.not() };
    }
    return this.cmp();
  }
  cmp(): Node {
    let l = this.sum();
    while (true) {
      const t = this.peek();
      if (t.t === "op" && ["<", ">", "<=", ">=", "==", "!="].includes(t.v)) {
        this.next();
        l = { t: "bin", op: t.v, l, r: this.sum() };
      } else if (t.t === "name" && t.v === "in") {
        this.next();
        l = { t: "bin", op: "in", l, r: this.sum() };
      } else break;
    }
    return l;
  }
  sum(): Node {
    let l = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().v;
      l = { t: "bin", op, l, r: this.term() };
    }
    return l;
  }
  term(): Node {
    let l = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%") || this.isOp("//") || this.isOp("@")) {
      const op = this.next().v;
      l = { t: "bin", op, l, r: this.unary() };
    }
    return l;
  }
  unary(): Node {
    if (this.isOp("-")) {
      this.next();
      return { t: "neg", v: this.unary() };
    }
    if (this.isOp("+")) {
      this.next();
      return this.unary();
    }
    return this.power();
  }
  power(): Node {
    const b = this.postfix();
    if (this.isOp("**")) {
      this.next();
      return { t: "bin", op: "**", l: b, r: this.unary() };
    }
    return b;
  }
  postfix(): Node {
    let n = this.atom();
    while (true) {
      if (this.isOp(".")) {
        this.next();
        const t = this.next();
        if (t.t !== "name") throw new ParseError("Ожидалось имя после точки");
        n = { t: "attr", obj: n, name: t.v };
      } else if (this.isOp("(")) {
        this.next();
        const args: { spread: boolean; v: Node }[] = [];
        const kwargs: Record<string, Node> = {};
        while (!this.isOp(")")) {
          if (this.peek().t === "eof") throw new ParseError("Ожидалась «)», найден конец строки");
          if (this.peek().t === "name" && this.isOp("=", 1)) {
            const k = this.next().v;
            this.next();
            kwargs[k] = this.expr();
          } else if (this.isOp("*")) {
            this.next();
            args.push({ spread: true, v: this.expr() });
          } else {
            args.push({ spread: false, v: this.expr() });
          }
          if (this.isOp(",")) this.next();
          else if (!this.isOp(")")) throw new ParseError("Ожидалась «,» или «)»");
        }
        this.expect(")");
        n = { t: "call", fn: n, args, kwargs };
      } else if (this.isOp("[")) {
        this.next();
        const idx = this.expr();
        this.expect("]");
        n = { t: "index", obj: n, idx };
      } else break;
    }
    return n;
  }
  atom(): Node {
    const t = this.next();
    if (t.t === "num") return { t: "num", v: parseFloat(t.v) };
    if (t.t === "str") {
      let v = t.v;
      while (this.peek().t === "str") v += this.next().v;
      return { t: "str", v };
    }
    if (t.t === "fstr") return { t: "fstr", v: t.v };
    if (t.t === "name") return { t: "name", v: t.v };
    if (t.t === "op" && t.v === "(") {
      if (this.isOp(")")) {
        this.next();
        return { t: "list", items: [] };
      }
      const first = this.expr();
      if (this.isOp(",")) {
        const items = [first];
        while (this.isOp(",")) {
          this.next();
          if (this.isOp(")")) break;
          items.push(this.expr());
        }
        this.expect(")");
        return { t: "list", items };
      }
      this.expect(")");
      return first;
    }
    if (t.t === "op" && t.v === "[") {
      const items: Node[] = [];
      while (!this.isOp("]")) {
        if (this.peek().t === "eof") throw new ParseError("Ожидалась «]», найден конец строки");
        items.push(this.expr());
        if (this.isOp(",")) this.next();
        else if (!this.isOp("]")) throw new ParseError("Ожидалась «,» или «]»");
      }
      this.expect("]");
      return { t: "list", items };
    }
    if (t.t === "op" && t.v === "{") {
      const entries: [Node, Node][] = [];
      while (!this.isOp("}")) {
        if (this.peek().t === "eof") throw new ParseError("Ожидалась «}», найден конец строки");
        const k = this.expr();
        this.expect(":");
        entries.push([k, this.expr()]);
        if (this.isOp(",")) this.next();
      }
      this.expect("}");
      return { t: "dict", entries };
    }
    throw new ParseError(`Неожиданное «${t.v || "конец строки"}»`);
  }
}
