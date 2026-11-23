// Resumen semanal + texto para el entrenador.
import { S, isFilled, weekInfo, planById } from '../db.js';
import { todayStr, mondayOf, addDays, fmtRange, fmtDay, fmtNum, fmtKg, fmtDuration, fmtPace, paceOf, num, esc, setsText, TYPE_LABEL } from '../utils.js';
import { icon, typeIcon } from '../icons.js';
import { sessionLog, logSummary, logTitle } from '../actions.js';
import { toast } from '../ui.js';

const state = { mon: null };

function bestBefore(name, beforeDate) {
  let best = 0; const k = name.trim().toLowerCase();
  for (const l of S.logs) {
    if (l.kind !== 'gym' || l.date >= beforeDate) continue;
    for (const e of l.exercises || []) if (e.name.trim().toLowerCase() === k) for (const s of e.sets) if (num(s.reps) > 0) best = Math.max(best, num(s.kg) || 0);
  }
  return best;
}

export function weekData(mon) {
  const sun = addDays(mon, 6);
  const plan = S.plan.filter(p => p.date >= mon && p.date <= sun);
  const logs = S.logs.filter(l => l.date >= mon && l.date <= sun && isFilled(l));
  const planned = plan.filter(p => p.type !== 'rest');
  const doneSessions = planned.filter(p => sessionLog(p));
  const linked = new Set(planned.map(p => sessionLog(p)?.id).filter(Boolean));
  const extras = logs.filter(l => !linked.has(l.id));
  const kmPlan = plan.filter(p => p.type === 'run' || p.type === 'race').reduce((s, p) => s + (p.km || 0), 0);
  const kmReal = logs.filter(l => l.kind === 'run').reduce((s, l) => s + (num(l.km) || 0), 0);
  const feels = logs.map(l => l.feel).filter(Boolean);
  const feelAvg = feels.length ? feels.reduce((a, b) => a + b, 0) / feels.length : null;
  const bw = S.body.filter(b => b.date >= mon && b.date <= sun);
  const bwAvg = bw.length ? bw.reduce((s, b) => s + b.kg, 0) / bw.length : null;
  // Récords: mejor peso de la semana mayor que cualquier semana anterior.
  const recs = new Map();
  for (const l of logs.filter(l => l.kind === 'gym')) for (const e of l.exercises) {
    const kg = Math.max(0, ...e.sets.filter(s => num(s.reps) > 0).map(s => num(s.kg) || 0));
    if (!kg) continue;
    const prev = bestBefore(e.name, mon);
    if (prev > 0 && kg > prev && kg > (recs.get(e.name)?.kg || 0)) recs.set(e.name, { name: e.name, kg, prev });
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    return { date: d, plan: plan.filter(p => p.date === d), logs: logs.filter(l => l.date === d) };
  });
  return { mon, sun, plan, planned, doneSessions, extras, kmPlan, kmReal, feelAvg, bwAvg, records: [...recs.values()], days, logs, info: weekInfo(mon) };
}

function logLines(l) {
  const out = [];
  if (l.kind === 'run') {
    const p = paceOf({ km: num(l.km), timeSec: l.timeSec });
    out.push(`  Hecho: ${[num(l.km) ? `${fmtNum(num(l.km), 2)} km` : '', l.timeSec ? `en ${fmtDuration(l.timeSec)}` : '', p ? `(${fmtPace(p)}/km)` : ''].filter(Boolean).join(' ')}${l.feel ? ` · sensación ${l.feel}/10` : ''}`);
  } else if (l.kind === 'gym') {
    for (const e of l.exercises) { const t = setsText(e.sets); if (t) out.push(`  - ${e.name}: ${t}`); }
  } else {
    out.push(`  Hecho: ${[l.activity, l.durationSec ? fmtDuration(l.durationSec) : '', num(l.km) ? `${fmtNum(num(l.km), 2)} km` : ''].filter(Boolean).join(' · ')}${l.feel ? ` · sensación ${l.feel}/10` : ''}`);
  }
  if (l.note) out.push(`  Nota: ${l.note.trim()}`);
  return out;
}

export function weekText(w) {
  const L = [];
  const name = S.settings.profile?.name ? ` · ${S.settings.profile.name}` : '';
  L.push(`RESUMEN SEMANAL${name}`);
  L.push(`${fmtRange(w.mon, w.sun)}${w.info ? ` · Semana ${w.info.week + 1} · ${w.info.phase}` : ''}`);
  L.push('');
  L.push(`Km: ${fmtNum(w.kmReal, 1)}${w.kmPlan ? ` de ${fmtNum(w.kmPlan, 1)} planificados` : ''}`);
  L.push(`Sesiones: ${w.doneSessions.length} de ${w.planned.length} planificadas${w.extras.length ? ` (+${w.extras.length} extra)` : ''}`);
  if (w.feelAvg) L.push(`Sensación promedio: ${fmtNum(w.feelAvg, 1)}/10`);
  if (w.bwAvg) L.push(`Peso corporal promedio: ${fmtNum(w.bwAvg, 1)} kg`);
  if (w.records.length) L.push(`Récords: ${w.records.map(r => `${r.name} ${fmtKg(r.kg)} kg (antes ${fmtKg(r.prev)})`).join('; ')}`);
  L.push('');
  for (const d of w.days) {
    const used = new Set();
    for (const p of d.plan) {
      const tl = TYPE_LABEL[p.type] || 'Sesión';
      const label = p.type === 'gym' && S.routines[p.routine] ? S.routines[p.routine].name : p.title;
      const head = `${fmtDay(d.date)} · ${tl}${label && label !== tl ? `: ${label}` : ''}`;
      if (p.type === 'rest') { L.push(head); continue; }
      const target = [p.km ? `${fmtNum(p.km, 1)} km` : '', p.pace ? `a ${p.pace}` : ''].filter(Boolean).join(' ');
      L.push(head + (target ? ` (plan: ${target})` : ''));
      if ((p.type === 'run' || p.type === 'race') && p.detail) L.push(`  Plan: ${p.detail}`);
      const l = sessionLog(p);
      if (l) { used.add(l.id); L.push(...logLines(l)); } else if (d.date <= todayStr()) L.push('  No realizado');
    }
    for (const l of d.logs.filter(l => !used.has(l.id))) {
      L.push(`${fmtDay(d.date)} · ${l.kind === 'gym' ? 'Gimnasio' : l.kind === 'run' ? 'Running' : 'Otro'} (extra): ${logTitle(l)}`);
      L.push(...logLines(l));
    }
  }
  return L.join('\n');
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { } ta.remove(); return ok;
  }
}

export function renderSummary(view) {
  const today = todayStr();
  if (!state.mon) state.mon = mondayOf(today);
  const w = weekData(state.mon);
  const pctKm = w.kmPlan ? Math.min(100, (w.kmReal / w.kmPlan) * 100) : 0;
  const pctS = w.planned.length ? Math.min(100, (w.doneSessions.length / w.planned.length) * 100) : 0;

  view.innerHTML = `
    <h1 class="title-l" style="margin-top:4px">Resumen</h1>
    <div class="cal-head">
      <button class="icon-btn" data-nav="-1" aria-label="Semana anterior">${icon('left')}</button>
      <div class="t"><div class="m">${fmtRange(w.mon, w.sun)}</div><div class="p">${w.info ? `Semana ${w.info.week + 1} · ${esc(w.info.phase)}` : 'Fuera del plan'}</div></div>
      <button class="icon-btn" data-nav="1" aria-label="Semana siguiente">${icon('right')}</button>
    </div>
    <div class="stats" style="margin-top:12px">
      <div class="stat"><div class="v num">${fmtNum(w.kmReal, 1)}<small>/ ${fmtNum(w.kmPlan, 1)} km</small></div><div class="k">Km reales / plan</div><div class="bar-track"><i style="width:${pctKm}%"></i></div></div>
      <div class="stat"><div class="v num">${w.doneSessions.length}<small>/ ${w.planned.length}</small></div><div class="k">Sesiones${w.extras.length ? ` · +${w.extras.length} extra` : ''}</div><div class="bar-track"><i style="width:${pctS}%"></i></div></div>
      <div class="stat"><div class="v num">${w.feelAvg ? fmtNum(w.feelAvg, 1) : '–'}<small>/10</small></div><div class="k">Sensación media</div></div>
      <div class="stat"><div class="v num">${w.bwAvg ? fmtNum(w.bwAvg, 1) : '–'}<small>kg</small></div><div class="k">Peso promedio</div></div>
    </div>
    ${w.records.length ? `<div class="section"><div class="section-h"><h2>Récords de la semana</h2></div><div class="list">${w.records.map(r => `
      <div class="list-item"><span class="accent" style="width:22px;height:22px;flex:none">${icon('trophy')}</span><div class="grow"><div>${esc(r.name)}</div><div class="wsub">antes ${fmtKg(r.prev)} kg</div></div><div class="accent num" style="font-weight:700">${fmtKg(r.kg)} kg</div></div>`).join('')}</div></div>` : ''}
    <div class="section"><div class="section-h"><h2>Día por día</h2></div><div class="list">${w.days.map(d => {
      const items = [...d.plan.map(p => ({ p, l: p.type !== 'rest' ? sessionLog(p) : null }))];
      const used = new Set(items.map(i => i.l?.id).filter(Boolean));
      d.logs.filter(l => !used.has(l.id)).forEach(l => items.push({ p: null, l }));
      if (!items.length) return `<a class="list-item" href="#/dia/${d.date}"><div style="width:76px" class="small muted">${fmtDay(d.date)}</div><div class="grow muted">—</div></a>`;
      return items.map(({ p, l }) => `<a class="list-item" href="${l ? `#/${l.kind}/${l.id}` : `#/dia/${d.date}`}">
        <div style="width:76px" class="small muted">${fmtDay(d.date)}</div>
        <span class="ticon ${p ? p.type : l.kind}">${typeIcon(p ? p.type : l.kind)}</span>
        <div class="grow"><div class="${p && p.type === 'rest' ? 'muted' : ''}">${esc(p ? p.title : logTitle(l))}${!p ? ' <span class="tiny muted">extra</span>' : ''}</div>${l ? `<div class="wsub">${esc(logSummary(l))}</div>` : p && p.type !== 'rest' && d.date < today ? '<div class="wsub">No realizado</div>' : ''}</div>
        ${l ? `<span class="check">${icon('check')}</span>` : ''}</a>`).join('');
    }).join('')}</div></div>
    <button class="btn primary block section" data-copy>${icon('copy')}Copiar resumen para mi entrenador</button>
    <details style="margin-top:16px"><summary class="small muted" style="min-height:44px;display:flex;align-items:center">Ver el texto</summary><pre class="small text-2" style="white-space:pre-wrap;font-family:inherit;background:var(--s1);padding:14px;border-radius:12px;margin:0">${esc(weekText(w))}</pre></details>
  `;
  view.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { state.mon = addDays(state.mon, 7 * Number(b.dataset.nav)); renderSummary(view); });
  view.querySelector('[data-copy]').onclick = async () => { (await copy(weekText(w))) ? toast('Copiado. Pegalo en el chat.') : toast('No se pudo copiar. Usá "Ver el texto".'); };
}
