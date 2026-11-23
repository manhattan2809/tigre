// Pantalla "Hoy".
import { S, planByDate, logsByDate, weekInfo } from '../db.js';
import { todayStr, fmtDayLong, cap, daysBetween, fmtNum, esc, TYPE_LABEL, addDays, fmtDateYear } from '../utils.js';
import { icon, typeIcon } from '../icons.js';
import { logFromSession, chooseLog, sessionLog, logSummary, logTitle } from '../actions.js';

export const DEFAULT_TITLE = { gym: 'Sesión de gimnasio', rest: 'Los tigres también duermen', run: 'Rodaje suave' };
const BUTTON = { gym: 'A entrenar como un tigre', run: 'A correr, tigre', race: 'A correr, tigre' };

// Zona de ritmo del plan que corresponde al ritmo objetivo (ej. "5:55" → "Pasadas 800 m–1,5 km").
function zoneFor(pace) {
  const zones = S.settings.paces || [];
  if (!pace || !zones.length) return null;
  if (/\bRM\b/.test(pace) && !/^\d/.test(pace)) return zones.find(z => /RM/.test(z.zone))?.zone || null;
  const toSec = (t) => { const m = String(t).match(/(\d+):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const s = toSec(pace); if (s == null) return null;
  for (const z of zones) {
    const ts = (z.pace.match(/\d+:\d{2}/g) || []).map(toSec);
    if (!ts.length) continue;
    const lo = Math.min(...ts), hi = Math.max(...ts);
    if (s >= lo - 2 && s <= hi + 2 && !/RM/.test(z.zone)) return z.zone;
  }
  return null;
}

export function sessionHero(p, { big = true } = {}) {
  const done = sessionLog(p);
  const title = p.title || DEFAULT_TITLE[p.type] || TYPE_LABEL[p.type];
  const isRun = p.type === 'run' || p.type === 'race';
  let body = '';

  if (p.type === 'gym') {
    const r = p.routine && S.routines[p.routine];
    if (r) body = `<div class="metrics"><div class="metric"><div class="v" style="font-size:22px">${esc(r.name)}</div><div class="k">Rutina</div></div>
      <div class="metric"><div class="v num">${r.exercises.length}</div><div class="k">Ejercicios</div></div></div>`;
  } else if (isRun) {
    const zone = zoneFor(p.pace);
    const rows = [zone ? ['Zona', zone] : null, p.where ? ['Dónde', p.where] : null].filter(Boolean);
    body = `${p.detail ? `<div class="eyebrow" style="margin-top:18px">Descripción</div><p class="detail" style="margin-top:0">${esc(p.detail)}</p>` : ''}
      ${p.km || p.pace || rows.length ? `<div class="before">
        <div class="eyebrow">Antes de salir</div>
        ${p.km || p.pace ? `<div class="metrics" style="margin-top:10px">
          ${p.km ? `<div class="metric"><div class="v num">${fmtNum(p.km, 1)}<small>km</small></div><div class="k">Distancia</div></div>` : ''}
          ${p.pace ? `<div class="metric"><div class="v num" style="font-size:${p.pace.length > 9 ? 20 : 30}px">${esc(p.pace)}</div><div class="k">Ritmo objetivo</div></div>` : ''}
        </div>` : ''}
        ${rows.length ? `<div style="margin-top:14px">${rows.map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span style="text-align:right">${esc(v)}</span></div>`).join('')}</div>` : ''}
      </div>` : ''}`;
  } else if (p.detail) {
    body = `<p class="detail">${esc(p.detail)}</p>`;
  }

  const canLog = p.type !== 'rest';
  return `<div class="card hero">
    <div class="type-tag ${p.type}">${typeIcon(p.type)}${TYPE_LABEL[p.type] || 'Sesión'}</div>
    <h2 class="${big ? 'title-xl' : 'title-l'}">${esc(title)}</h2>
    ${body}
    ${done
      ? `<a class="done-line" href="#/${done.kind}/${done.id}">${icon('check')}<span>Hecho · ${esc(logSummary(done))}</span></a>`
      : canLog ? `<button class="btn primary block" data-log="${p.id}">${BUTTON[p.type] || 'Registrar'}</button>` : ''}
  </div>`;
}

export async function renderToday(view) {
  const today = todayStr();
  const sessions = planByDate(today);
  const extra = logsByDate(today).filter(l => !sessions.some(s => sessionLog(s)?.id === l.id));
  const next = (S.settings.races || []).filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const wi = weekInfo(today);
  const tomorrow = planByDate(addDays(today, 1)).filter(p => p.type !== 'rest');

  const lastB = S.settings.lastBackup ? daysBetween(S.settings.lastBackup.slice(0, 10), today) : null;
  const needsBackup = S.logs.length > 0 && (lastB === null || lastB > 7);

  view.innerHTML = `
    <div class="row" style="margin-top:4px"><div class="brand grow">Tigre<b>.</b></div>${wi ? `<span class="small muted">Sem ${wi.week + 1} · ${esc(wi.phase)}</span>` : ''}</div>
    <div class="today-date">${cap(fmtDayLong(today))}</div>

    ${needsBackup ? `<a class="banner" href="#/ajustes"><span class="dot"></span><span class="grow">${lastB === null ? 'Todavía no hiciste un backup.' : `Hace ${lastB} días de tu último backup.`} Tocá para hacerlo.</span>${icon('chev')}</a>` : ''}

    ${sessions.length
      ? sessions.map(p => sessionHero(p)).join('')
      : `<div class="card hero"><div class="type-tag">${icon('other')}Sin plan</div><h2 class="title-xl">Día libre</h2><p class="detail">No hay nada planificado. Si entrenaste, registralo igual.</p><button class="btn primary block" data-free>Registrar entreno</button></div>`}

    ${extra.length ? `<div class="section"><div class="section-h"><h2>También hoy</h2></div><div class="list">${extra.map(l => `
      <a class="list-item" href="#/${l.kind}/${l.id}"><span class="ticon">${typeIcon(l.kind)}</span><div class="grow"><div>${esc(logTitle(l))}</div><div class="wsub">${esc(logSummary(l))}</div></div><span class="check">${icon('check')}</span></a>`).join('')}</div></div>` : ''}

    ${sessions.length ? `<button class="link-btn" data-free style="margin-top:8px">+ Registrar otro entreno</button>` : ''}

    ${next ? (() => { const d = daysBetween(today, next.date); return `<div class="section"><div class="card countdown">
      <div><div class="eyebrow">Próxima carrera</div><div class="title-m">${esc(next.name)}</div><div class="small muted" style="margin-top:2px">${fmtDateYear(next.date)}${next.km ? ` · ${fmtNum(next.km, 1)} km` : ''}</div></div>
      <div class="big num">${d === 0 ? '¡Hoy!' : `${d}<small>${d === 1 ? 'día' : 'días'}</small>`}</div></div></div>`; })() : ''}

    ${tomorrow.length ? `<div class="section"><div class="section-h"><h2>Mañana</h2></div><a class="list" href="#/dia/${addDays(today, 1)}" style="display:block">${tomorrow.map(p => `
      <div class="list-item"><span class="ticon ${p.type}">${typeIcon(p.type)}</span><div class="grow"><div>${esc(p.title)}</div>${p.km ? `<div class="wsub">${fmtNum(p.km, 1)} km${p.pace ? ` · ${esc(p.pace)}` : ''}</div>` : ''}</div>${icon('chev')}</div>`).join('')}</a></div>` : ''}
  `;
  view.querySelectorAll('[data-log]').forEach(b => b.onclick = () => logFromSession(sessions.find(s => s.id === b.dataset.log)));
  view.querySelectorAll('[data-free]').forEach(b => b.onclick = () => chooseLog(today));
}
