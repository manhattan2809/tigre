// Calendario: vista semanal (por defecto) y mensual.
import { S, planByDate, logsByDate, weekInfo } from '../db.js';
import { daysBetween as daysBetweenS, todayStr, mondayOf, addDays, parseDate, toStr, DAYS_SHORT, MONTHS, fmtRange, fmtNum, esc } from '../utils.js';
import { icon, typeIcon } from '../icons.js';
import { sessionLog } from '../actions.js';

const state = { mode: 'week', anchor: null };

function dayDone(date) {
  const ps = planByDate(date).filter(p => p.type !== 'rest');
  const logs = logsByDate(date);
  if (!ps.length) return logs.length > 0;
  return ps.every(p => sessionLog(p));
}

export function renderCalendar(view) {
  const today = todayStr();
  if (!state.anchor) state.anchor = today;
  const week = state.mode === 'week';

  let head, body;
  if (week) {
    const mon = mondayOf(state.anchor), sun = addDays(mon, 6);
    const wi = weekInfo(mon);
    head = `<div class="m">${fmtRange(mon, sun)}</div><div class="p">${wi ? `Semana ${wi.week + 1} de ${wi.total} · ${esc(wi.phase)}` : 'Fuera del plan'}</div>`;
    body = `<div class="list week-list">${Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i), dt = parseDate(d);
      const ps = planByDate(d), logs = logsByDate(d);
      const extra = logs.filter(l => !ps.some(p => sessionLog(p)?.id === l.id));
      const items = ps.length ? ps : [];
      const main = items[0];
      const title = items.length ? items.map(p => esc(p.title)).join(' + ') : extra.length ? 'Entreno extra' : '—';
      const sub = items.map(p => p.km ? `${fmtNum(p.km, 1)} km${p.pace ? ' · ' + esc(p.pace) : ''}` : p.type === 'gym' && S.routines[p.routine] ? esc(S.routines[p.routine].name) : '').filter(Boolean).join(' · ')
        + (extra.length && items.length ? ` · +${extra.length} extra` : '');
      const t = main ? main.type : extra.length ? extra[0].kind : 'none';
      return `<a class="list-item" href="#/dia/${d}">
        <div class="wday ${d === today ? 'today' : ''}"><div class="d">${DAYS_SHORT[dt.getDay()]}</div><div class="n num">${dt.getDate()}</div></div>
        <span class="ticon ${t}">${t === 'none' ? '' : typeIcon(t)}</span>
        <div class="grow"><div class="wtitle ${t === 'rest' || t === 'none' ? 'rest' : ''}">${title}</div>${sub ? `<div class="wsub">${sub}</div>` : ''}</div>
        ${dayDone(d) ? `<span class="check">${icon('check')}</span>` : ''}
      </a>`;
    }).join('')}</div>`;
  } else {
    const a = parseDate(state.anchor);
    const first = toStr(new Date(a.getFullYear(), a.getMonth(), 1, 12));
    const start = mondayOf(first);
    const month = a.getMonth();
    const wi = weekInfo(first) || weekInfo(addDays(first, 14));
    head = `<div class="m">${MONTHS[month]} ${a.getFullYear()}</div><div class="p">${wi ? esc(wi.phase) : '&nbsp;'}</div>`;
    const cells = [];
    const dim = new Date(a.getFullYear(), month + 1, 0).getDate();
    const total = Math.ceil((daysBetweenS(start, first) + dim) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const d = addDays(start, i), dt = parseDate(d);
      const out = dt.getMonth() !== month;
      const ps = planByDate(d);
      const kinds = ps.length ? ps.map(p => p.type) : logsByDate(d).map(l => l.kind);
      cells.push(`<a class="mcell ${out ? 'out' : ''} ${d === today ? 'today' : ''}" href="#/dia/${d}">
        <span class="n num">${dt.getDate()}</span>
        <span class="ics">${out ? '' : [...new Set(kinds)].filter(k => k !== 'rest').slice(0, 2).map(k => `<span class="${k}">${typeIcon(k)}</span>`).join('')}</span>
        ${!out && dayDone(d) ? '<span class="ok"></span>' : ''}
      </a>`);
    }
    body = `<div class="month-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div>
      <div class="legend"><span>${typeIcon('run')}Running</span><span>${typeIcon('gym')}Gym</span><span>${typeIcon('race')}Carrera</span><span><i style="width:6px;height:6px;border-radius:3px;background:var(--accent);display:inline-block"></i>Hecho</span></div>`;
  }

  view.innerHTML = `
    <div class="row" style="margin-top:4px"><h1 class="title-l grow">Calendario</h1></div>
    <div class="seg" style="margin-top:16px"><button data-mode="week" class="${week ? 'on' : ''}">Semana</button><button data-mode="month" class="${!week ? 'on' : ''}">Mes</button></div>
    <div class="cal-head">
      <button class="icon-btn" data-nav="-1" aria-label="Anterior">${icon('left')}</button>
      <div class="t">${head}</div>
      <button class="icon-btn" data-nav="1" aria-label="Siguiente">${icon('right')}</button>
    </div>
    ${body}
    <div class="row" style="justify-content:center;margin-top:12px"><button class="link-btn" data-today>Ir a hoy</button></div>
  `;
  view.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { state.mode = b.dataset.mode; renderCalendar(view); });
  view.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const n = Number(b.dataset.nav);
    if (state.mode === 'week') state.anchor = addDays(state.anchor, 7 * n);
    else { const a = parseDate(state.anchor); state.anchor = toStr(new Date(a.getFullYear(), a.getMonth() + n, 1, 12)); }
    renderCalendar(view);
  });
  view.querySelector('[data-today]').onclick = () => { state.anchor = today; renderCalendar(view); };
}
