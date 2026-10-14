import { rgba } from "./colors";
import { BASE_W, FRAME_W, fontCss, type Mob, type P2 } from "./mobject";

export function renderScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  mobs: Mob[],
  bg: string
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const s = W / FRAME_W;
  const sorted = mobs.map((m, i) => ({ m, i })).sort((a, b) => a.m.z - b.m.z || a.i - b.i);
  for (const { m } of sorted) draw(ctx, m, 1, s, W, H);
}

function draw(ctx: CanvasRenderingContext2D, m: Mob, op: number, s: number, W: number, H: number) {
  const o = op * m.opacity;
  if (o <= 0.002) return;
  const px = (p: P2): P2 => [W / 2 + p[0] * s, H / 2 - p[1] * s];

  if (m.kind === "group") {
    for (const c of m.children) draw(ctx, c, o, s, W, H);
    return;
  }

  if (m.kind === "text") {
    if (!m.text) return;
    const size = m.fontSize * (W / BASE_W);
    const [x, y] = px(m.pos);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-m.angle);
    ctx.font = fontCss(m, size);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const lines = m.text.split("\n");
    const total = m.text.replace(/\n/g, "").length;
    const shownF = total * Math.max(0, Math.min(1, m.reveal));
    let used = 0;
    lines.forEach((line, i) => {
      const w = ctx.measureText(line).width;
      const yy = (i - (lines.length - 1) / 2) * size * 1.25;
      let xx = -w / 2;
      for (const ch of line) {
        const k = shownF - used;
        used++;
        if (k <= 0) break;
        const a = Math.min(1, k);
        ctx.fillStyle = rgba(m.fill, m.fillOpacity * o * a);
        ctx.fillText(ch, xx, yy);
        xx += ctx.measureText(ch).width;
      }
    });
    ctx.restore();
    return;
  }

  const p = Math.max(0, Math.min(1, m.progress));
  if (p <= 0) return;
  const path = new Path2D();
  for (const sp of m.paths) {
    const pts = sp.closed && sp.pts.length > 2 ? [...sp.pts, sp.pts[0]] : sp.pts;
    if (pts.length === 0) continue;
    const f = p * (pts.length - 1);
    const k = Math.floor(f);
    const [x0, y0] = px(pts[0]);
    path.moveTo(x0, y0);
    for (let i = 1; i <= k && i < pts.length; i++) {
      const [x, y] = px(pts[i]);
      path.lineTo(x, y);
    }
    if (k < pts.length - 1) {
      const fr = f - k;
      const a = pts[k],
        b = pts[k + 1];
      const [x, y] = px([a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr]);
      path.lineTo(x, y);
    } else if (sp.closed) {
      path.closePath();
    }
  }
  const fillFactor = p >= 1 ? 1 : Math.max(0, (p - 0.55) / 0.45);
  if (m.fillOpacity > 0 && fillFactor > 0) {
    ctx.fillStyle = rgba(m.fill, m.fillOpacity * o * fillFactor);
    ctx.fill(path);
  }
  if (m.strokeWidth > 0 && m.strokeOpacity > 0) {
    ctx.strokeStyle = rgba(m.stroke, m.strokeOpacity * o);
    ctx.lineWidth = m.strokeWidth * s * 0.0125;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke(path);
  }
}
