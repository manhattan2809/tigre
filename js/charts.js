// Gráficos simples en SVG propio (sin librerías).
import { esc } from './utils.js';

const W = 340;

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min, raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

/**
 * Gráfico de líneas.
 * series: [{points:[{x:number,y:number}], color, width, dots, dash}]
 * xLabels: [{x, text}], yFmt: fn, invert: true para que valores menores estén arriba (ritmo).
 */
export function lineChart({ series, xLabels = [], yFmt = String, invert = false, height = 200, highlight = null }) {
  const pts = series.flatMap(s => s.points);
  if (!pts.length) return '';
  const padL = 40, padR = 10, padT = 12, padB = 26;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 1; x1 += 1; }
  const { lo, hi, ticks } = niceTicks(Math.min(...ys), Math.max(...ys));
  const sx = (x) => padL + ((x - x0) / (x1 - x0)) * (W - padL - padR);
  const sy = (y) => { const t = (y - lo) / (hi - lo || 1); return invert ? padT + t * (height - padT - padB) : height - padB - t * (height - padT - padB); };
  const grid = ticks.map(t => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${padL - 8}" y="${sy(t) + 4}" text-anchor="end">${esc(yFmt(t))}</text>`).join('');
  const xl = xLabels.map(l => `<text x="${sx(l.x)}" y="${height - 6}" text-anchor="middle">${esc(l.text)}</text>`).join('');
  const lines = series.map(s => {
    const p = s.points.slice().sort((a, b) => a.x - b.x);
    const d = p.map((q, i) => `${i ? 'L' : 'M'}${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join('');
    const path = p.length > 1 ? `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>` : '';
    const dots = s.dots ? p.map(q => `<circle cx="${sx(q.x).toFixed(1)}" cy="${sy(q.y).toFixed(1)}" r="${highlight && highlight(q) ? 4.5 : 3}" fill="${highlight && highlight(q) ? '#FFD60A' : s.color}" stroke="#1C1C1E" stroke-width="1.5"/>`).join('') : '';
    return path + dots;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img">${grid}${xl}${lines}</svg>`;
}

/**
 * Barras agrupadas (plan vs real). groups: [{label, a, b, current}] — a = plan (gris), b = real (amarillo).
 */
export function barChart({ groups, height = 200, yFmt = String, barW = 9, gap = 3, groupGap = 10 }) {
  if (!groups.length) return '';
  const padL = 34, padR = 8, padT = 12, padB = 26;
  const gw = barW * 2 + gap + groupGap;
  const width = Math.max(W, padL + padR + groups.length * gw);
  const max = Math.max(1, ...groups.flatMap(g => [g.a || 0, g.b || 0]));
  const { hi, ticks } = niceTicks(0, max);
  const sy = (v) => height - padB - (v / hi) * (height - padT - padB);
  const grid = ticks.map(t => `<line class="grid" x1="${padL}" x2="${width - padR}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${padL - 6}" y="${sy(t) + 4}" text-anchor="end">${esc(yFmt(t))}</text>`).join('');
  const bars = groups.map((g, i) => {
    const x = padL + groupGap / 2 + i * gw;
    const ha = Math.max(0, sy(0) - sy(g.a || 0)), hb = Math.max(0, sy(0) - sy(g.b || 0));
    return `<rect x="${x}" y="${sy(0) - ha}" width="${barW}" height="${ha}" rx="2.5" fill="#3A3A3D"/>
      <rect x="${x + barW + gap}" y="${sy(0) - hb}" width="${barW}" height="${hb}" rx="2.5" fill="#FFD60A"/>
      ${g.label ? `<text x="${x + barW + gap / 2}" y="${height - 6}" text-anchor="middle" ${g.current ? 'style="fill:#F5F5F7;font-weight:600"' : ''}>${esc(g.label)}</text>` : ''}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" style="width:${width}px;max-width:none" role="img">${grid}${bars}</svg>`;
}
