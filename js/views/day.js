// Detalle de un día + edición de sesiones del plan.
import { S, planByDate, logsByDate, weekInfo, putPlan, delPlan, planById, routineList } from '../db.js';
import { fmtDayLong, cap, esc, TYPE_LABEL, uid, num, isValidDate, todayStr, fmtNum } from '../utils.js';
import { icon, typeIcon } from '../icons.js';
import { topbar, bindBack, actionSheet, openSheet, confirmDialog, toast } from '../ui.js';
import { chooseLog, sessionLog, logSummary, logTitle, logFromSession } from '../actions.js';
import { sessionHero, DEFAULT_TITLE } from './today.js';

export function renderDay(view, [date]) {
  const ps = planByDate(date);
  const logs = logsByDate(date);
  const extra = logs.filter(l => !ps.some(p => sessionLog(p)?.id === l.id));
  const wi = weekInfo(date);

  view.innerHTML = `
    ${topbar({ back: true, title: '' })}
    <div class="eyebrow">${wi ? `Semana ${wi.week + 1} · ${esc(wi.phase)}` : date === todayStr() ? 'Hoy' : 'Fuera del plan'}</div>
    <h1 class="title-l" style="margin-bottom:20px">${cap(fmtDayLong(date))}</h1>

    ${ps.length ? ps.map(p => `${sessionHero(p, { big: false })}
      <div class="row" style="justify-content:flex-end;margin:-4px 0 8px"><button class="link-btn muted" data-opts="${p.id}">Opciones de la sesión</button></div>`).join('')
      : `<div class="card"><div class="muted">No hay nada planificado este día.</div></div>`}

    ${extra.length ? `<div class="section"><div class="section-h"><h2>Registrado</h2></div><div class="list">${extra.map(l => `
      <a class="list-item" href="#/${l.kind}/${l.id}"><span class="ticon">${typeIcon(l.kind)}</span><div class="grow"><div>${esc(logTitle(l))}</div><div class="wsub">${esc(logSummary(l))}</div></div>${icon('chev')}</a>`).join('')}</div></div>` : ''}

    <div class="section stack">
      <button class="btn block" data-free>${icon('plus')}Registrar entreno</button>
      <a class="btn ghost block" href="#/sesion/nueva?date=${date}">Agregar sesión al plan</a>
    </div>
  `;
  bindBack(view, '#/calendario');
  view.querySelectorAll('[data-log]').forEach(b => b.onclick = () => logFromSession(planById(b.dataset.log)));
  view.querySelector('[data-free]').onclick = () => chooseLog(date);
  view.querySelectorAll('[data-opts]').forEach(b => b.onclick = () => sessionOptions(planById(b.dataset.opts), () => renderDay(view, [date])));
}

export function sessionOptions(p, refresh) {
  actionSheet(p.title, [
    { label: 'Editar', run: () => { location.hash = `#/sesion/${p.id}`; } },
    { label: 'Mover a otro día…', run: () => moveSession(p, refresh) },
    ...(p.type !== 'rest' ? [{ label: 'Marcar como día libre', run: async () => { await putPlan({ ...p, type: 'rest', title: DEFAULT_TITLE.rest, detail: p.title ? `Era: ${p.title}` : '', km: null, pace: '', routine: null }); toast('Marcado como libre'); refresh(); } }] : []),
    { label: 'Borrar sesión', danger: true, run: async () => { if (await confirmDialog({ title: 'Borrar sesión', text: 'Se quita del plan. Tus registros no se borran.', ok: 'Borrar', danger: true })) { await delPlan(p.id); toast('Sesión borrada'); refresh(); } } },
  ]);
}

function moveSession(p, refresh) {
  openSheet(`
    <h3>Mover sesión</h3><p>${esc(p.title)}</p>
    <label class="field"><span>Nueva fecha</span><input class="input" type="date" value="${p.date}" data-d></label>
    <div class="stack" style="margin-top:20px"><button class="btn primary block" data-ok>Mover</button><button class="btn block" data-close>Cancelar</button></div>`,
  (sh, close) => {
    sh.querySelector('[data-ok]').onclick = async () => {
      const d = sh.querySelector('[data-d]').value;
      if (!isValidDate(d)) return toast('Elegí una fecha');
      const wi = weekInfo(d);
      await putPlan({ ...p, date: d, ...(wi ? { week: wi.week, phase: wi.phase } : {}) });
      close(); toast('Sesión movida'); location.hash = `#/dia/${d}`;
      refresh && refresh();
    };
  });
}

export function renderSessionEdit(view, [id], params) {
  const isNew = id === 'nueva';
  const p = isNew
    ? { id: uid('p'), date: params.get('date') || todayStr(), type: 'run', title: DEFAULT_TITLE.run, intensity: 'suave', where: '', detail: '', km: null, pace: '', routine: null, week: null, phase: null }
    : planById(id);
  if (!p) { view.innerHTML = `${topbar({ back: true })}<div class="empty">Esta sesión ya no existe.</div>`; bindBack(view, '#/calendario'); return; }
  const routines = routineList();

  view.innerHTML = `
    ${topbar({ back: true, title: isNew ? 'Nueva sesión' : 'Editar sesión' })}
    <form class="stack" data-form autocomplete="off">
      <label class="field"><span>Fecha</span><input class="input" type="date" name="date" value="${p.date}" required></label>
      <label class="field"><span>Tipo</span><select class="select" name="type">
        ${['run', 'gym', 'race', 'other', 'rest'].map(t => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${TYPE_LABEL[t]}</option>`).join('')}
      </select></label>
      <label class="field" data-intf><span>Tipo de rodaje</span><select class="select" name="intensity">
        <option value="suave" ${p.intensity !== 'intenso' ? 'selected' : ''}>Rodaje suave</option>
        <option value="intenso" ${p.intensity === 'intenso' ? 'selected' : ''}>Rodaje intenso</option>
      </select></label>
      <label class="field" data-titlef><span>Título</span><input class="input" name="title" value="${esc(p.title)}" placeholder="Ej: Carrera 10K"></label>
      <label class="field" data-detf><span data-detl>Descripción o notas</span><textarea class="textarea" name="detail" placeholder="Ej: 6 km + 4 strides">${esc(p.detail)}</textarea></label>
      <div class="two" data-runf>
        <label class="field"><span>Km</span><input class="input" name="km" inputmode="decimal" value="${p.km != null ? fmtNum(p.km, 2) : ''}" placeholder="0"></label>
        <label class="field"><span>Ritmo objetivo</span><input class="input" name="pace" value="${esc(p.pace || '')}" placeholder="6:50–7:10"></label>
      </div>
      <label class="field" data-wheref><span>Dónde / cuándo</span><input class="input" name="where" value="${esc(p.where || '')}" placeholder="Ej: Cinta, mañana"></label>
      <label class="field" data-gymf><span>Rutina</span><select class="select" name="routine">
        <option value="">Sin rutina (entreno libre)</option>
        ${routines.map(r => `<option value="${r.id}" ${p.routine === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select></label>
      <button class="btn primary block" type="submit" style="margin-top:24px">Guardar</button>
      ${!isNew ? '<button class="btn danger block" type="button" data-del>Borrar sesión</button>' : ''}
    </form>`;
  bindBack(view, `#/dia/${p.date}`);
  const f = view.querySelector('[data-form]');
  const sync = () => {
    const t = f.type.value;
    view.querySelector('[data-runf]').hidden = !['run', 'race', 'other'].includes(t);
    view.querySelector('[data-gymf]').hidden = t !== 'gym';
    view.querySelector('[data-intf]').hidden = t !== 'run';
    view.querySelector('[data-wheref]').hidden = !['run', 'race'].includes(t);
    view.querySelector('[data-titlef]').hidden = ['run', 'gym', 'rest'].includes(t);
    view.querySelector('[data-detf]').hidden = t === 'gym';
  };
  f.type.onchange = sync; sync();
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!isValidDate(f.date.value)) return toast('Elegí una fecha');
    const t = f.type.value;
    const wi = weekInfo(f.date.value);
    const item = {
      ...p, date: f.date.value, type: t,
      title: t === 'run' ? (f.intensity.value === 'intenso' ? 'Rodaje intenso' : 'Rodaje suave') : (DEFAULT_TITLE[t] && t !== 'run' ? DEFAULT_TITLE[t] : (f.title.value.trim() || TYPE_LABEL[t])),
      intensity: t === 'run' ? f.intensity.value : null,
      where: ['run', 'race'].includes(t) ? f.where.value.trim() : '',
      detail: t === 'gym' ? '' : f.detail.value.trim(),
      km: ['run', 'race', 'other'].includes(t) ? num(f.km.value) : null,
      pace: ['run', 'race', 'other'].includes(t) ? f.pace.value.trim() : '',
      routine: t === 'gym' ? (f.routine.value || null) : null,
      ...(wi && (isNew || f.date.value !== p.date) ? { week: wi.week, phase: wi.phase } : {}),
    };
    await putPlan(item);
    toast('Guardado');
    location.replace(`#/dia/${item.date}`);
  };
  const del = view.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    if (await confirmDialog({ title: 'Borrar sesión', text: 'Se quita del plan. Tus registros no se borran.', ok: 'Borrar', danger: true })) {
      await delPlan(p.id); toast('Sesión borrada'); location.replace(`#/dia/${p.date}`);
    }
  };
}
