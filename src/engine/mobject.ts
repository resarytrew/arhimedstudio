export type P2 = [number, number];

export const FRAME_W = 128 / 9; // 14.222 units
export const FRAME_H = 8;
export const BASE_W = 1280; // reference canvas width
export const PX_PER_UNIT = BASE_W / FRAME_W; // 90

export interface SubPath {
  pts: P2[];
  closed: boolean;
}

export interface AxesInfo {
  origin: P2;
  ux: P2;
  uy: P2;
  xr: [number, number, number];
  yr: [number, number, number];
}

export interface Mob {
  id: number;
  kind: "path" | "text" | "group";
  name: string;
  paths: SubPath[];
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  fill: string;
  fillOpacity: number;
  opacity: number;
  text: string;
  fontSize: number;
  pos: P2;
  font: "serif" | "sans";
  angle: number;
  progress: number;
  reveal: number;
  children: Mob[];
  axes: AxesInfo | null;
  z: number;
  meta: Record<string, unknown>;
}

let idCounter = 1;
export const newId = () => idCounter++;

export function baseMob(kind: Mob["kind"], name: string): Mob {
  return {
    id: newId(),
    kind,
    name,
    paths: [],
    stroke: "#FFFFFF",
    strokeWidth: 4,
    strokeOpacity: 1,
    fill: "#FFFFFF",
    fillOpacity: 0,
    opacity: 1,
    text: "",
    fontSize: 48,
    pos: [0, 0],
    font: "serif",
    angle: 0,
    progress: 1,
    reveal: 1,
    children: [],
    axes: null,
    z: 0,
    meta: {},
  };
}

export function cloneMob(m: Mob, freshIds = false): Mob {
  return {
    ...m,
    id: freshIds ? newId() : m.id,
    paths: m.paths.map((p) => ({ closed: p.closed, pts: p.pts.map((q) => [q[0], q[1]] as P2) })),
    pos: [m.pos[0], m.pos[1]],
    children: m.children.map((c) => cloneMob(c, freshIds)),
    axes: m.axes
      ? {
          ...m.axes,
          origin: [...m.axes.origin] as P2,
          ux: [...m.axes.ux] as P2,
          uy: [...m.axes.uy] as P2,
        }
      : null,
    meta: { ...m.meta },
  };
}

/** Copy all visual state from src into live (keeps live id & child identities). */
export function assignInto(live: Mob, src: Mob) {
  const id = live.id;
  const kids = live.children;
  Object.assign(live, src);
  live.id = id;
  if (kids.length === src.children.length && kids.length > 0) {
    kids.forEach((k, i) => assignInto(k, src.children[i]));
    live.children = kids;
  }
}

export function leaves(m: Mob): Mob[] {
  if (m.kind === "group") return m.children.flatMap(leaves);
  return [m];
}

export function mapPoints(m: Mob, f: (p: P2) => P2) {
  for (const p of m.paths) p.pts = p.pts.map(f);
  if (m.kind === "text") m.pos = f(m.pos);
  if (m.axes) {
    const o = m.axes.origin;
    const no = f(o);
    const nx = f([o[0] + m.axes.ux[0], o[1] + m.axes.ux[1]]);
    const ny = f([o[0] + m.axes.uy[0], o[1] + m.axes.uy[1]]);
    m.axes.origin = no;
    m.axes.ux = [nx[0] - no[0], nx[1] - no[1]];
    m.axes.uy = [ny[0] - no[0], ny[1] - no[1]];
  }
  m.children.forEach((c) => mapPoints(c, f));
  if (m.meta.center) m.meta.center = f(m.meta.center as P2);
}

// ---------- text measurement ----------
let mctx: CanvasRenderingContext2D | null = null;
function measureCtx() {
  if (!mctx) mctx = document.createElement("canvas").getContext("2d");
  return mctx!;
}
export function fontCss(m: Mob, px: number) {
  return m.font === "serif"
    ? `${px}px "PT Serif", Georgia, "Times New Roman", serif`
    : `500 ${px}px Manrope, "Segoe UI", sans-serif`;
}
export function textSize(m: Mob): [number, number] {
  const ctx = measureCtx();
  ctx.font = fontCss(m, m.fontSize);
  const lines = m.text.split("\n");
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  const h = m.fontSize * 0.8 + (lines.length - 1) * m.fontSize * 1.25;
  return [w / PX_PER_UNIT, h / PX_PER_UNIT];
}

export interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
export function bbox(m: Mob): BBox {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  const ext = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const visit = (o: Mob) => {
    if (o.kind === "text") {
      const [w, h] = textSize(o);
      ext(o.pos[0] - w / 2, o.pos[1] - h / 2);
      ext(o.pos[0] + w / 2, o.pos[1] + h / 2);
    }
    for (const p of o.paths) for (const q of p.pts) ext(q[0], q[1]);
    o.children.forEach(visit);
  };
  visit(m);
  if (minX === Infinity) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return { minX, maxX, minY, maxY };
}
export function center(m: Mob): P2 {
  if (m.meta.center) return [...(m.meta.center as P2)] as P2;
  const b = bbox(m);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
}

// ---------- transforms ----------
export function shiftMob(m: Mob, v: P2) {
  mapPoints(m, (p) => [p[0] + v[0], p[1] + v[1]]);
}
export function moveTo(m: Mob, pt: P2) {
  const c = center(m);
  shiftMob(m, [pt[0] - c[0], pt[1] - c[1]]);
}
function scaleFont(m: Mob, k: number) {
  if (m.kind === "text") m.fontSize *= k;
  m.children.forEach((c) => scaleFont(c, k));
}
export function scaleMob(m: Mob, k: number, about?: P2) {
  const a = about ?? center(m);
  mapPoints(m, (p) => [a[0] + (p[0] - a[0]) * k, a[1] + (p[1] - a[1]) * k]);
  scaleFont(m, Math.abs(k));
}
export function stretchMob(m: Mob, kx: number, ky: number, about?: P2) {
  const a = about ?? center(m);
  mapPoints(m, (p) => [a[0] + (p[0] - a[0]) * kx, a[1] + (p[1] - a[1]) * ky]);
}
function rotFont(m: Mob, ang: number) {
  if (m.kind === "text") m.angle += ang;
  m.children.forEach((c) => rotFont(c, ang));
}
export function rotateMob(m: Mob, ang: number, about?: P2) {
  const a = about ?? center(m);
  const c = Math.cos(ang),
    s = Math.sin(ang);
  mapPoints(m, (p) => {
    const dx = p[0] - a[0],
      dy = p[1] - a[1];
    return [a[0] + dx * c - dy * s, a[1] + dx * s + dy * c];
  });
  rotFont(m, ang);
}
export function applyMatrix(m: Mob, mat: number[][], about: P2 = [0, 0]) {
  const [[a, b], [c, d]] = mat;
  mapPoints(m, (p) => {
    const x = p[0] - about[0],
      y = p[1] - about[1];
    return [about[0] + a * x + b * y, about[1] + c * x + d * y];
  });
}
export function setColor(m: Mob, col: string) {
  m.stroke = col;
  m.fill = col;
  m.children.forEach((c) => setColor(c, col));
}
export function setFill(m: Mob, col?: string, opacity?: number) {
  if (col) m.fill = col;
  if (opacity !== undefined) m.fillOpacity = opacity;
  m.children.forEach((c) => setFill(c, col, opacity));
}
export function setStroke(m: Mob, col?: string, width?: number, opacity?: number) {
  if (col) m.stroke = col;
  if (width !== undefined) m.strokeWidth = width;
  if (opacity !== undefined) m.strokeOpacity = opacity;
  m.children.forEach((c) => setStroke(c, col, width, opacity));
}

// ---------- path helpers ----------
export function resample(pts: P2[], closed: boolean, n: number): P2[] {
  const p = closed && pts.length > 1 ? [...pts, pts[0]] : pts;
  if (p.length === 0) return Array.from({ length: n }, () => [0, 0] as P2);
  if (p.length === 1) return Array.from({ length: n }, () => [p[0][0], p[0][1]] as P2);
  const cum = [0];
  for (let i = 1; i < p.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return Array.from({ length: n }, () => [p[0][0], p[0][1]] as P2);
  const out: P2[] = [];
  let seg = 1;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (seg < p.length - 1 && cum[seg] < target) seg++;
    const l0 = cum[seg - 1],
      l1 = cum[seg];
    const t = l1 - l0 === 0 ? 0 : (target - l0) / (l1 - l0);
    out.push([p[seg - 1][0] + (p[seg][0] - p[seg - 1][0]) * t, p[seg - 1][1] + (p[seg][1] - p[seg - 1][1]) * t]);
  }
  return out;
}

export function pointAlong(m: Mob, prop: number): P2 {
  const ls = leaves(m);
  const path = ls.flatMap((l) => l.paths)[0];
  if (!path || path.pts.length === 0) return center(m);
  const r = resample(path.pts, path.closed, 240);
  const idx = Math.max(0, Math.min(239, prop * 239));
  const k = Math.floor(idx);
  const f = idx - k;
  const a = r[k],
    b = r[Math.min(239, k + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function circlePts(r: number, n = 72, cx = 0, cy = 0, start = 0, sweep = Math.PI * 2, closedFull = true): P2[] {
  const pts: P2[] = [];
  const count = closedFull ? n : n + 1;
  for (let i = 0; i < count; i++) {
    const a = start + (sweep * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export function arrowTip(start: P2, end: P2, size = 0.25): P2[] {
  const dx = end[0] - start[0],
    dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len;
  const s = Math.min(size, len * 0.4);
  const bx = end[0] - ux * s,
    by = end[1] - uy * s;
  return [
    [end[0], end[1]],
    [bx - uy * s * 0.55, by + ux * s * 0.55],
    [bx + uy * s * 0.55, by - ux * s * 0.55],
  ];
}
