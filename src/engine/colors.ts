export const MANIM_COLORS: Record<string, string> = {
  WHITE: "#FFFFFF",
  BLACK: "#000000",
  GRAY: "#888888",
  GREY: "#888888",
  LIGHT_GRAY: "#BBBBBB",
  LIGHT_GREY: "#BBBBBB",
  DARK_GRAY: "#444444",
  DARK_GREY: "#444444",
  RED: "#FC6255",
  RED_A: "#F7A1A3",
  RED_B: "#FF8080",
  RED_C: "#FC6255",
  RED_D: "#E65A4C",
  RED_E: "#CF5044",
  BLUE: "#58C4DD",
  BLUE_A: "#C7E9F1",
  BLUE_B: "#9CDCEB",
  BLUE_C: "#58C4DD",
  BLUE_D: "#29ABCA",
  BLUE_E: "#236B8E",
  GREEN: "#83C167",
  GREEN_A: "#C9E2AE",
  GREEN_B: "#A6CF8C",
  GREEN_C: "#83C167",
  GREEN_D: "#77B05D",
  GREEN_E: "#699C52",
  YELLOW: "#FFFF00",
  YELLOW_A: "#FFF1B6",
  YELLOW_B: "#FFEA94",
  YELLOW_C: "#FFFF00",
  YELLOW_D: "#F4D345",
  YELLOW_E: "#E8C11C",
  GOLD: "#F0AC5F",
  TEAL: "#5CD0B3",
  PURPLE: "#9A72AC",
  PINK: "#D147BD",
  ORANGE: "#FF862F",
  MAROON: "#C55F73",
  PURE_RED: "#FF0000",
  PURE_GREEN: "#00FF00",
  PURE_BLUE: "#0000FF",
};

const cache = new Map<string, [number, number, number]>();
let cctx: CanvasRenderingContext2D | null = null;

export function parseColor(c: string): [number, number, number] {
  const hit = cache.get(c);
  if (hit) return hit;
  let res: [number, number, number] = [255, 255, 255];
  const s = c.trim();
  const named = MANIM_COLORS[s.toUpperCase()];
  const src = named ?? s;
  let m = src.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const h = m[1];
    res = [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  } else if ((m = src.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i))) {
    const h = m[1];
    res = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  } else if ((m = src.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i))) {
    res = [+m[1], +m[2], +m[3]];
  } else {
    if (!cctx) cctx = document.createElement("canvas").getContext("2d");
    if (cctx) {
      cctx.fillStyle = "#ffffff";
      cctx.fillStyle = src;
      const v = String(cctx.fillStyle);
      if (v.startsWith("#") && v.length === 7) {
        res = [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
      } else {
        const mm = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
        if (mm) res = [+mm[1], +mm[2], +mm[3]];
      }
    }
  }
  cache.set(c, res);
  return res;
}

export function rgba(c: string, a: number) {
  const [r, g, b] = parseColor(c);
  return `rgba(${r | 0},${g | 0},${b | 0},${Math.max(0, Math.min(1, a))})`;
}

export function lerpColor(a: string, b: string, t: number) {
  if (a === b) return a;
  const x = parseColor(a),
    y = parseColor(b);
  const r = Math.round(x[0] + (y[0] - x[0]) * t);
  const g = Math.round(x[1] + (y[1] - x[1]) * t);
  const bl = Math.round(x[2] + (y[2] - x[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function normalizeColor(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const named = MANIM_COLORS[v.toUpperCase()];
  return named ?? v;
}
