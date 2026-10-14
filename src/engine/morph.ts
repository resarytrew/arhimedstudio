import { lerpColor } from "./colors";
import { baseMob, center, cloneMob, resample, type Mob, type P2 } from "./mobject";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Prepare a morph function between two leaf mobjects. Result keeps a.id. */
export function makeMorph(a: Mob, b: Mob): (t: number) => Mob {
  if (a.kind === "path" && b.kind === "path") {
    const count = Math.max(a.paths.length, b.paths.length, 1);
    const maxPts = Math.max(
      ...a.paths.map((p) => p.pts.length),
      ...b.paths.map((p) => p.pts.length),
      2
    );
    const n = Math.max(60, Math.min(260, maxPts * 2));
    const prep = (m: Mob): P2[][] => {
      const c = center(m);
      const res = m.paths.map((p) => resample(p.pts, p.closed, n));
      while (res.length < count) {
        res.push(Array.from({ length: n }, () => [c[0], c[1]] as P2));
      }
      return res;
    };
    const pa = prep(a),
      pb = prep(b);
    const closedA = a.paths.some((p) => p.closed);
    const closedB = b.paths.some((p) => p.closed);
    return (t: number) => {
      const out = { ...a };
      out.paths = pa.map((sp, i) => ({
        closed: false,
        pts: sp.map((p, j) => [lerp(p[0], pb[i][j][0], t), lerp(p[1], pb[i][j][1], t)] as P2),
      }));
      out.stroke = lerpColor(a.stroke, b.stroke, t);
      out.fill = lerpColor(a.fill, b.fill, t);
      out.strokeWidth = lerp(a.strokeWidth, b.strokeWidth, t);
      out.strokeOpacity = lerp(a.strokeOpacity, b.strokeOpacity, t);
      out.fillOpacity = lerp(a.fillOpacity, b.fillOpacity, t);
      out.opacity = lerp(a.opacity, b.opacity, t);
      out.meta = { ...out.meta, closedHint: t < 0.5 ? closedA : closedB };
      return out;
    };
  }
  // crossfade for text-involved transforms
  return (t: number) => {
    const g = baseMob("group", "Morph");
    g.id = a.id;
    const ca = { ...a, opacity: a.opacity * (1 - t) };
    const cb = { ...b, opacity: b.opacity * t };
    if (a.kind === "text" && b.kind === "text") {
      const pos: P2 = [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t)];
      ca.pos = pos;
      cb.pos = pos;
      ca.fontSize = lerp(a.fontSize, b.fontSize, t);
      cb.fontSize = lerp(a.fontSize, b.fontSize, t);
      ca.fill = lerpColor(a.fill, b.fill, t);
      cb.fill = lerpColor(a.fill, b.fill, t);
    }
    g.children = [ca, cb];
    return g;
  };
}

export function withProgress(m: Mob, p: number): Mob {
  if (m.kind === "group") return { ...m, children: m.children.map((c) => withProgress(c, p)) };
  if (m.kind === "text") return { ...m, reveal: p };
  return { ...m, progress: p };
}

export function transformed(m: Mob, fn: (c: Mob) => void): Mob {
  const c = cloneMob(m);
  fn(c);
  return c;
}
