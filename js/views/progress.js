// Progreso: fuerza por ejercicio, running y peso corporal.
import { S, putBody, delBody, isFilled, planById } from '../db.js';
import { todayStr, parseDate, daysBetween, fmtNum, fmtKg, fmtPace, paceOf, num, esc, mondayOf, addDays, fmtDateShort, MONTHS_SHORT, isValidDate } from '../utils.js';
import { lineChart, barChart } from '../charts.js';
import { icon } from '../icons.js';
import { toast, confirmDialog } from '../ui.js';

const state = { tab: 'fuerza', exercise: null, metric: 'kg', runFilter: 'rodajes' };

const dayNum = (s) => Math.round(parseDate(s).getTime() / 86400000);
const monthLabels = (minX, maxX) => {
  const out = []; const a = new Date(minX * 86400000), b = new Date(maxX * 86400000);
  const d = new Date(a.getFullYear(), a.getMonth() + (a.getDate() > 1 ? 1 : 0), 1, 12);
  while (d <= b) { out.push({ x: Math.round(d.getTime() / 86400000), text: MONTHS_SHORT[d.getMonth()] }); d.setMonth(d.getMonth() + 1); }
  if (out.length > 6) return out.filter((_, i) => i % 2 === 0);
  return out;
};

function strength() {
  const byName = new Map();
  for (const l of S.logs) {
    if (l.kind !== 'gym') continue;
    for (const e of l.exercises || []) {
      const sets = e.sets.filter(s => num(s.reps) > 0);
      if (!sets.length) continue;
      const k = e.name.trim();
      if (!byName.has(k)) byName.set(k, []);
      const best = Math.max(...sets.map(s => num(s.kg) || 0));
      const vol = sets.reduce((a, s) => a + (num(s.kg) || 0) * num(s.reps), 0);
      byName.get(k).push({ date: l.date, best, vol, sets });
    }
  }
  const names = [...byName.keys()].sort((a, b) => {
    const la = byName.get(a).at(-1).date, lb = byName.get(b).at(-1).date; return lb.localeCompare(la);
  });
  if (!names.length) return `<div class="empty">Cuando registres entrenos de gimnasio, acá vas a ver la evolución de cada ejercicio.</div>`;
  if (!state.exercise || !byName.has(state.exercise)) state.exercise = names[0];
  const data = byName.get(state.exercise).sort((a, b) => a.date.localeCompare(b.date));
  const key = state.metric === 'kg' ? 'best' : 'vol';
  const pts = data.map(d => ({ x: dayNum(d.date), y: d[key] }));
  const maxV = Math.max(...pts.map(p => p.y));
  const first = data[0], last = data.at(-1);
  const delta = last[key] - first[key];
  return `
    <label class="field"><span>Ejercicio</span><select class="select" data-ex>${names.map(n => `<option ${n === state.exercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div class="seg" style="margin-top:12px"><button data-metric="kg" class="${state.metric === 'kg' ? 'on' : ''}">Mejor peso</button><button data-metric="vol" class="${state.metric === 'vol' ? 'on' : ''}">Volumen</button></div>
    <div class="stats" style="margin-top:16px">
      <div class="stat"><div class="v num accent">${state.metric === 'kg' ? `${fmtKg(maxV)}<small>kg</small>` : fmtNum(maxV, 0)}</div><div class="k">${state.metric === 'kg' ? 'Récord' : 'Mejor volumen'}</div></div>
      <div class="stat"><div class="v num">${delta >= 0 ? '+' : ''}${state.metric === 'kg' ? fmtKg(delta) : fmtNum(delta, 0)}${state.metric === 'kg' ? '<small>kg</small>' : ''}</div><div class="k">Desde el inicio</div></div>
    </div>
    <div class="card" style="margin-top:12px">
      ${pts.length > 1 ? lineChart({ series: [{ points: pts, color: '#F5F5F7', dots: true }], xLabels: monthLabels(pts[0].x, pts.at(-1).x), yFmt: v => state.metric === 'kg' ? fmtNum(v, 1) : fmtNum(v, 0), highlight: q => q.y === maxV })
        : `<div class="empty" style="padding:16px">Hace falta al menos 2 sesiones para ver la línea.</div>`}
    </div>
    <div class="section"><div class="section-h"><h2>Sesiones</h2></div><div class="list">${data.slice().reverse().slice(0, 12).map(d => `
      <div class="list-item"><div style="width:62px" class="small muted">${fmtDateShort(d.date)}</div><div class="grow small num">${esc(d.sets.map(s => num(s.kg) ? `${fmtKg(num(s.kg))}×${num(s.reps)}` : `${num(s.reps)}`).join(' · '))}</div>${d.best === maxV && state.metric === 'kg' ? `<span class="accent" style="width:18px;height:18px">${icon('trophy')}</span>` : ''}</div>`).join('')}</div></div>`;
}

function isEasyRun(l) {
  const p = l.planId ? planById(l.planId) : null;
  const t = `${l.title || ''} ${p?.title || ''}`.toLowerCase();
  if (p && p.type === 'race') return false;
  if (/rodaje|suave|fondo|regenerativ|z2/.test(t)) return true;
  return !p && !/serie|pasada|tempo|test|carrera|cambio|fartlek/.test(t);
}

function running() {
  const runs = S.logs.filter(l => l.kind === 'run' && isFilled(l));
  const today = todayStr();
  // Semanas: desde el primer plan/registro hasta el último.
  const dates = [...S.plan.filter(p => p.km && (p.type === 'run' || p.type === 'race')).map(p => p.date), ...runs.map(r => r.date)];
  let bars = '';
  if (dates.length) {
    const start = mondayOf(dates.reduce((a, b) => (a < b ? a : b))), end = mondayOf(dates.reduce((a, b) => (a > b ? a : b)));
    const groups = [];
    for (let w = start; w <= end; w = addDays(w, 7)) {
      const e = addDays(w, 6);
      const a = S.plan.filter(p => p.date >= w && p.date <= e && (p.type === 'run' || p.type === 'race')).reduce((s, p) => s + (p.km || 0), 0);
      const b = runs.filter(r => r.date >= w && r.date <= e).reduce((s, r) => s + (num(r.km) || 0), 0);
      const d = parseDate(w);
      groups.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, a, b, current: today >= w && today <= e, w });
    }
    const labeled = groups.map((g, i) => ({ ...g, label: i % 2 === 0 || g.current ? g.label : '' }));
    bars = `<div class="card"><div class="eyebrow">Km por semana</div><div class="chart-scroll" data-scroll data-before="${today < start ? 1 : 0}">${barChart({ groups: labeled, yFmt: v => fmtNum(v, 0) })}</div>
      <div class="chart-legend"><span><i style="background:#3A3A3D"></i>Plan</span><span><i style="background:#FFD60A"></i>Real</span></div></div>`;
  }
  const filtered = runs.filter(r => paceOf({ km: num(r.km), timeSec: r.timeSec }) && (state.runFilter === 'todas' || isEasyRun(r)));
  const pts = filtered.map(r => ({ x: dayNum(r.date), y: paceOf({ km: num(r.km), timeSec: r.timeSec }) }));
  const totalKm = runs.reduce((s, r) => s + (num(r.km) || 0), 0);
  const best = pts.length ? Math.min(...pts.map(p => p.y)) : null;
  return `
    <div class="stats">
      <div class="stat"><div class="v num">${fmtNum(totalKm, 1)}<small>km</small></div><div class="k">Total corrido</div></div>
      <div class="stat"><div class="v num">${runs.length}</div><div class="k">Salidas</div></div>
    </div>
    <div style="margin-top:12px">${bars || '<div class="empty">Todavía no hay datos de running.</div>'}</div>
    <div class="card" style="margin-top:12px">
      <div class="row"><div class="eyebrow grow" style="margin:0">Ritmo</div>
        <div class="chips"><button class="chip ${state.runFilter === 'rodajes' ? 'on' : ''}" data-rf="rodajes">Rodajes</button><button class="chip ${state.runFilter === 'todas' ? 'on' : ''}" data-rf="todas">Todas</button></div></div>
      ${pts.length > 1 ? `<div style="margin-top:12px">${lineChart({ series: [{ points: pts, color: '#F5F5F7', dots: true }], xLabels: monthLabels(Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x))), yFmt: v => fmtPace(v), invert: true, highlight: q => q.y === best })}</div>
        <div class="small muted" style="margin-top:8px">Más arriba = más rápido. Mejor: <span class="accent num">${fmtPace(best)}/km</span></div>`
        : `<div class="empty" style="padding:16px">Registrá al menos 2 salidas con km y tiempo.</div>`}
    </div>`;
}

function weight() {
  const today = todayStr();
  const b = S.body;
  const pts = b.map(e => ({ x: dayNum(e.date), y: e.kg }));
  const avg = b.map(e => {
    const win = b.filter(o => o.date <= e.date && daysBetween(o.date, e.date) < 7);
    return { x: dayNum(e.date), y: win.reduce((s, o) => s + o.kg, 0) / win.length };
  });
  const last = b.at(-1);
  return `
    <div class="card">
      <div class="eyebrow">Registrar peso</div>
      <div class="row" style="margin-top:10px;gap:8px">
        <input class="input" type="date" data-wd value="${today}" style="flex:1.2;min-width:0">
        <input class="input num" inputmode="decimal" data-wkg placeholder="kg" value="" style="flex:1;min-width:0;text-align:center;font-weight:600">
        <button class="btn primary sm" data-wsave style="min-height:52px">Guardar</button>
      </div>
    </div>
    ${b.length ? `<div class="stats" style="margin-top:12px">
      <div class="stat"><div class="v num">${fmtNum(last.kg, 1)}<small>kg</small></div><div class="k">Último · ${fmtDateShort(last.date)}</div></div>
      <div class="stat"><div class="v num">${fmtNum(avg.at(-1).y, 1)}<small>kg</small></div><div class="k">Promedio 7 días</div></div>
    </div>` : ''}
    <div class="card" style="margin-top:12px">${pts.length > 1
      ? `${lineChart({ series: [{ points: pts, color: '#636366', dots: true, width: 0 }, { points: avg, color: '#FFD60A', width: 2.5 }], xLabels: monthLabels(pts[0].x, pts.at(-1).x), yFmt: v => fmtNum(v, 1) })}
         <div class="chart-legend"><span><i style="background:#636366"></i>Pesajes</span><span><i style="background:#FFD60A"></i>Promedio 7 días</span></div>`
      : '<div class="empty" style="padding:16px">Registrá tu peso un par de veces para ver la tendencia.</div>'}</div>
    ${b.length ? `<div class="section"><div class="section-h"><h2>Historial</h2></div><div class="list">${b.slice().reverse().slice(0, 20).map(e => `
      <div class="list-item"><div class="grow">${fmtDateShort(e.date)}</div><div class="num" style="font-weight:600">${fmtNum(e.kg, 1)} kg</div><button class="icon-btn" data-wdel="${e.date}" aria-label="Borrar">${icon('x')}</button></div>`).join('')}</div></div>` : ''}`;
}

export function renderProgress(view, _a, params) {
  if (params && params.get('tab')) state.tab = params.get('tab');
  const body = state.tab === 'fuerza' ? strength() : state.tab === 'running' ? running() : weight();
  view.innerHTML = `
    <h1 class="title-l" style="margin-top:4px">Progreso</h1>
    <div class="seg" style="margin:16px 0 20px"><button data-tab="fuerza" class="${state.tab === 'fuerza' ? 'on' : ''}">Fuerza</button><button data-tab="running" class="${state.tab === 'running' ? 'on' : ''}">Running</button><button data-tab="peso" class="${state.tab === 'peso' ? 'on' : ''}">Peso</button></div>
    ${body}`;
  const re = () => renderProgress(view, _a, null);
  view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; re(); });
  const ex = view.querySelector('[data-ex]'); if (ex) ex.onchange = () => { state.exercise = ex.value; re(); };
  view.querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { state.metric = b.dataset.metric; re(); });
  view.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { state.runFilter = b.dataset.rf; re(); });
  const sc = view.querySelector('[data-scroll]');
  if (sc) { const cur = sc.querySelector('text[style]'); sc.scrollLeft = cur ? Math.max(0, Number(cur.getAttribute('x')) - sc.clientWidth / 2) : (sc.dataset.before === '1' ? 0 : sc.scrollWidth); }
  const ws = view.querySelector('[data-wsave]');
  if (ws) ws.onclick = async () => {
    const d = view.querySelector('[data-wd]').value, kg = num(view.querySelector('[data-wkg]').value);
    if (!isValidDate(d) || !kg || kg < 20 || kg > 400) return toast('Revisá la fecha y el peso');
    await putBody({ date: d, kg }); toast('Peso guardado'); re();
  };
  view.querySelectorAll('[data-wdel]').forEach(b => b.onclick = async () => {
    if (await confirmDialog({ title: 'Borrar pesaje', text: fmtDateShort(b.dataset.wdel), ok: 'Borrar', danger: true })) { await delBody(b.dataset.wdel); re(); }
  });
}
