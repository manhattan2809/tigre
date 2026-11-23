// Registro de running y de otras actividades.
import { logById, putLog, delLog, planById } from '../db.js';
import { fmtDayLong, esc, num, fmtNum, fmtPace, paceOf, splitTime, debounce, isValidDate } from '../utils.js';
import { icon } from '../icons.js';
import { topbar, bindBack, actionSheet, openSheet, confirmDialog, toast } from '../ui.js';

const timeInputs = (t, withSec = true) => `<div class="time-in">
  <input class="input num" inputmode="numeric" pattern="[0-9]*" data-h value="${t.h}" placeholder="h" aria-label="Horas">
  <span class="sep">:</span>
  <input class="input num" inputmode="numeric" pattern="[0-9]*" data-m value="${t.m === '' ? '' : String(t.m).padStart(2, '0')}" placeholder="mm" aria-label="Minutos">
  ${withSec ? `<span class="sep">:</span><input class="input num" inputmode="numeric" pattern="[0-9]*" data-s value="${t.s === '' ? '' : String(t.s).padStart(2, '0')}" placeholder="ss" aria-label="Segundos">` : ''}
</div>`;
const readTime = (root) => {
  const g = (k) => parseInt(root.querySelector(`[data-${k}]`)?.value, 10) || 0;
  return g('h') * 3600 + g('m') * 60 + g('s');
};
const feelHTML = (v) => `<div class="feel">${Array.from({ length: 10 }, (_, i) => `<button type="button" data-feel="${i + 1}" class="${v === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div>
  <div class="row tiny muted" style="justify-content:space-between;margin-top:6px"><span>Muy fácil</span><span>Al máximo</span></div>`;

function common(view, log, back, extraBind) {
  const save = debounce(() => putLog(log), 250);
  bindBack(view, back);
  view.querySelectorAll('[data-feel]').forEach(b => b.onclick = () => {
    const v = Number(b.dataset.feel); log.feel = log.feel === v ? null : v;
    view.querySelectorAll('[data-feel]').forEach(x => x.classList.toggle('on', Number(x.dataset.feel) === log.feel));
    save.flush();
  });
  const note = view.querySelector('[data-note]'); if (note) note.oninput = () => { log.note = note.value; save(); };
  view.querySelector('[data-finish]').onclick = () => { save.flush(); toast('Guardado'); location.hash = back; };
  view.querySelector('[data-menu]').onclick = () => actionSheet('Registro', [
    { label: 'Cambiar fecha', run: () => openSheet(`<h3>Cambiar fecha</h3><label class="field"><span>Fecha</span><input class="input" type="date" data-d value="${log.date}"></label>
        <div class="stack" style="margin-top:20px"><button class="btn primary block" data-ok>Guardar</button><button class="btn block" data-close>Cancelar</button></div>`,
      (sh, close) => { sh.querySelector('[data-ok]').onclick = () => { const d = sh.querySelector('[data-d]').value; if (!isValidDate(d)) return; log.date = d; save.flush(); close(); const el = view.querySelector('[data-date]'); if (el) el.textContent = fmtDayLong(d); }; }) },
    { label: 'Borrar este registro', danger: true, run: async () => { if (await confirmDialog({ title: 'Borrar registro', text: 'No se puede deshacer.', ok: 'Borrar', danger: true })) { await delLog(log.id); toast('Registro borrado'); location.hash = back; } } },
  ]);
  extraBind(save);
}

export function renderRun(view, [id]) {
  const log = logById(id);
  if (!log) { view.innerHTML = `${topbar({ back: true })}<div class="empty">Este registro ya no existe.</div>`; bindBack(view); return; }
  const plan = log.planId ? planById(log.planId) : null;
  const back = log.planId ? `#/dia/${log.date}` : '#/hoy';
  const t = splitTime(log.timeSec);

  view.innerHTML = `
    ${topbar({ back: true, right: `<button class="icon-btn" data-menu aria-label="Opciones">${icon('more')}</button>` })}
    <div class="eyebrow">Running · <span style="text-transform:none" data-date>${fmtDayLong(log.date)}</span></div>
    <input class="input title-l" data-title value="${esc(log.title || '')}" placeholder="Running" style="background:transparent;padding:0;min-height:44px;font-size:26px;font-weight:700" aria-label="Título">
    ${plan && (plan.km || plan.detail) ? `<div class="small muted" style="margin:4px 0 0">Plan: ${esc([plan.km ? `${fmtNum(plan.km, 1)} km` : '', plan.detail].filter(Boolean).join(' · '))}</div>` : ''}

    <div class="section stack">
      <label class="field"><span>Distancia (km)</span><input class="input num big-in" inputmode="decimal" data-km value="${log.km !== '' && log.km != null ? esc(String(log.km).replace('.', ',')) : ''}" placeholder="0,0"></label>
      <div class="field"><span>Tiempo total</span>${timeInputs(t)}</div>
    </div>

    <div class="section card pace-card">
      <div><div class="eyebrow">Tu ritmo</div><div class="v num" data-pace>–</div></div>
      <div style="text-align:right"><div class="eyebrow">Objetivo</div><div class="title-m num">${esc(plan?.pace || '—')}</div></div>
    </div>

    <div class="section"><div class="field"><span>Sensación (1–10)</span>${feelHTML(log.feel)}</div></div>
    <div class="section"><label class="field"><span>Nota (opcional)</span><textarea class="textarea" data-note placeholder="¿Cómo te sentiste? ¿Clima, molestias?">${esc(log.note || '')}</textarea></label></div>
    <button class="btn primary block section" data-finish>Listo</button>
  `;
  const showPace = () => {
    const p = paceOf({ km: num(log.km), timeSec: log.timeSec });
    view.querySelector('[data-pace]').innerHTML = p ? `${fmtPace(p)}<small>/km</small>` : '–';
  };
  showPace();
  common(view, log, back, (save) => {
    const km = view.querySelector('[data-km]');
    km.oninput = () => { log.km = num(km.value) ?? ''; showPace(); save(); };
    view.querySelectorAll('.time-in input').forEach(i => i.oninput = () => { log.timeSec = readTime(view); showPace(); save(); });
    const ti = view.querySelector('[data-title]'); ti.oninput = () => { log.title = ti.value; save(); };
  });
}

const ACTIVITIES = ['Bici', 'Natación', 'Caminata', 'Fútbol', 'Pádel', 'Movilidad', 'Yoga', 'Elíptica'];

export function renderOther(view, [id]) {
  const log = logById(id);
  if (!log) { view.innerHTML = `${topbar({ back: true })}<div class="empty">Este registro ya no existe.</div>`; bindBack(view); return; }
  const back = log.planId ? `#/dia/${log.date}` : '#/hoy';
  const t = splitTime(log.durationSec);
  view.innerHTML = `
    ${topbar({ back: true, right: `<button class="icon-btn" data-menu aria-label="Opciones">${icon('more')}</button>` })}
    <div class="eyebrow">Otra actividad · <span style="text-transform:none" data-date>${fmtDayLong(log.date)}</span></div>
    <h1 class="title-l" style="margin-bottom:20px">${esc(log.activity || 'Actividad')}</h1>
    <label class="field"><span>Actividad</span><input class="input" data-act value="${esc(log.activity || '')}" placeholder="Ej: Bici"></label>
    <div class="chips" style="margin-top:10px">${ACTIVITIES.map(a => `<button class="chip ${log.activity === a ? 'on' : ''}" data-chip="${a}">${a}</button>`).join('')}</div>
    <div class="section two">
      <div class="field"><span>Duración</span>${timeInputs(t, false)}</div>
      <label class="field"><span>Km (opcional)</span><input class="input num" style="min-height:64px;font-size:26px;font-weight:600;text-align:center" inputmode="decimal" data-km value="${log.km ? esc(String(log.km).replace('.', ',')) : ''}" placeholder="–"></label>
    </div>
    <div class="section"><div class="field"><span>Sensación (1–10)</span>${feelHTML(log.feel)}</div></div>
    <div class="section"><label class="field"><span>Nota (opcional)</span><textarea class="textarea" data-note>${esc(log.note || '')}</textarea></label></div>
    <button class="btn primary block section" data-finish>Listo</button>`;
  common(view, log, back, (save) => {
    const act = view.querySelector('[data-act]'), h1 = view.querySelector('h1');
    const setAct = (v) => { log.activity = v; h1.textContent = v || 'Actividad'; view.querySelectorAll('[data-chip]').forEach(c => c.classList.toggle('on', c.dataset.chip === v)); save(); };
    act.oninput = () => setAct(act.value.trim());
    view.querySelectorAll('[data-chip]').forEach(c => c.onclick = () => { act.value = c.dataset.chip; setAct(c.dataset.chip); save.flush(); });
    view.querySelectorAll('.time-in input').forEach(i => i.oninput = () => { log.durationSec = readTime(view); save(); });
    const km = view.querySelector('[data-km]'); km.oninput = () => { log.km = num(km.value) ?? ''; save(); };
  });
}
