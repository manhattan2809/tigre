// Ajustes, bienvenida (primera vez) y editor de rutinas.
import { S, saveSettings, loadPlanSource, clearPlan, exportAll, importAll, routineList, putRoutine, delRoutine, putPlan } from '../db.js';
import { esc, uid, num, todayStr, fmtDateYear, daysBetween, debounce } from '../utils.js';
import { icon } from '../icons.js';
import { topbar, bindBack, confirmDialog, toast, actionSheet } from '../ui.js';

export async function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (_) { }
  return false;
}
async function persisted() {
  try { if (navigator.storage && navigator.storage.persisted) return await navigator.storage.persisted(); } catch (_) { }
  return null;
}
async function fetchBundledPlan() {
  const r = await fetch('plan-data.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('No se encontró el plan incluido.');
  return r.json();
}
function pickFile() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return resolve(null);
      try { resolve(JSON.parse(await f.text())); } catch (_) { toast('El archivo no es un JSON válido'); resolve(null); }
    };
    inp.click();
  });
}

// ---------- Bienvenida ----------
export function renderSetup(view) {
  view.innerHTML = `<div class="setup">
    <div class="logo-mark">T</div>
    <h1 class="title-xl" style="margin-top:28px">TIGRE</h1>
    <p class="text-2" style="font-size:17px;margin:10px 0 32px">Tu registro de running y gimnasio. Todo queda en este teléfono, sin cuentas ni internet.</p>
    <button class="card option tap" data-opt="plan"><div class="title-m">Usar el plan incluido</div><div class="small muted">Media Maratón de Montevideo · 23 nov 2026 → 9 may 2027, con 3 rutinas de gimnasio.</div></button>
    <button class="card option tap" data-opt="empty"><div class="title-m">Empezar sin plan</div><div class="small muted">Registro libre. Podés crear tus rutinas y sesiones cuando quieras.</div></button>
    <button class="card option tap" data-opt="import"><div class="title-m">Importar un plan</div><div class="small muted">Si alguien te armó un archivo plan-data.json.</div></button>
    <button class="link-btn muted" data-opt="backup" style="margin-top:16px">Restaurar un backup de Tigre</button>
  </div>`;
  const finish = async () => { await saveSettings({ setupDone: true }); requestPersist(); if (location.hash === '#/hoy') window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '#/hoy'; };
  view.querySelectorAll('[data-opt]').forEach(b => b.onclick = async () => {
    try {
      const o = b.dataset.opt;
      if (o === 'plan') { await loadPlanSource(await fetchBundledPlan()); await finish(); }
      else if (o === 'empty') { await finish(); }
      else if (o === 'import') { const d = await pickFile(); if (!d) return; await loadPlanSource(d); await finish(); }
      else if (o === 'backup') { const d = await pickFile(); if (!d) return; await importAll(d); toast('Backup restaurado'); await finish(); }
    } catch (e) { toast(e.message || 'Algo salió mal'); }
  });
}

// ---------- Ajustes ----------
export async function renderSettings(view) {
  const st = S.settings;
  const pers = await persisted();
  const lastB = st.lastBackup ? daysBetween(st.lastBackup.slice(0, 10), todayStr()) : null;
  const sw = (key, label, sub) => `<label class="list-item" style="cursor:pointer"><div class="grow"><div>${label}</div>${sub ? `<div class="wsub">${sub}</div>` : ''}</div>
    <input type="checkbox" data-sw="${key}" ${st[key] ? 'checked' : ''} style="width:24px;height:24px;accent-color:#FFD60A"></label>`;

  view.innerHTML = `
    <h1 class="title-l" style="margin-top:4px">Ajustes</h1>

    <div class="section"><div class="section-h"><h2>Perfil</h2><span class="tiny muted">Solo en este teléfono</span></div>
      <div class="card">
        <label class="field"><span>Nombre (para el resumen)</span><input class="input" data-p="name" value="${esc(st.profile.name || '')}" placeholder="Opcional" style="background:var(--s2)"></label>
        <label class="field"><span>Altura (cm)</span><input class="input num" inputmode="numeric" data-p="heightCm" value="${st.profile.heightCm ?? ''}" placeholder="Opcional" style="background:var(--s2)"></label>
        <label class="field"><span>Molestias o lesiones a tener en cuenta</span><textarea class="textarea" data-p="note" placeholder="Se muestra arriba de cada entreno de gimnasio" style="background:var(--s2)">${esc(st.profile.note || '')}</textarea></label>
        <a class="btn block sm" href="#/progreso?tab=peso" style="margin-top:16px">Registrar peso corporal</a>
      </div>
    </div>

    <div class="section"><div class="section-h"><h2>Tus datos</h2></div>
      ${lastB === null || lastB > 7 ? `<div class="banner"><span class="dot"></span><span>${lastB === null ? 'Todavía no hiciste ningún backup.' : `Último backup hace ${lastB} días.`} Guardalo en Archivos o iCloud Drive.</span></div>` : ''}
      <div class="stack">
        <button class="btn primary block" data-export>Exportar backup</button>
        <button class="btn block" data-import>Importar backup</button>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="kv"><span class="k">Último backup</span><span>${st.lastBackup ? fmtDateYear(st.lastBackup.slice(0, 10)) : 'Nunca'}</span></div>
        <div class="kv"><span class="k">Registros</span><span class="num">${S.logs.length}</span></div>
        <div class="kv"><span class="k">Almacenamiento persistente</span><span>${pers === true ? '<span class="accent">Activado</span>' : pers === false ? 'No activado' : 'No disponible'}</span></div>
        ${pers === false ? '<button class="link-btn" data-persist>Pedir almacenamiento persistente</button><div class="tiny muted">En iPhone funciona mejor con la app agregada a la pantalla de inicio. Igual, hacé backups.</div>' : ''}
      </div>
    </div>

    <div class="section"><div class="section-h"><h2>Plan</h2></div>
      <div class="list">
        <div class="list-item"><div class="grow"><div>${esc(st.planName || 'Sin plan')}</div><div class="wsub">${S.plan.length} sesiones planificadas</div></div></div>
        <a class="list-item" href="#/rutinas"><div class="grow">Rutinas de gimnasio</div><span class="muted small">${routineList().length}</span>${icon('chev')}</a>
        <a class="list-item" href="#/sesion/nueva?date=${todayStr()}"><div class="grow">Agregar sesión al plan</div>${icon('chev')}</a>
        <button class="list-item" data-plan-import><div class="grow"><div>Importar plan nuevo</div><div class="wsub">Reemplaza el plan. Tus registros se mantienen.</div></div></button>
        <button class="list-item" data-plan-reset><div class="grow"><div>Restablecer plan original</div><div class="wsub">Deshace tus ediciones del plan.</div></div></button>
        ${S.plan.length ? '<button class="list-item danger" data-plan-clear><div class="grow">Quitar el plan</div></button>' : ''}
      </div>
    </div>

    <div class="section"><div class="section-h"><h2>Entreno</h2></div>
      <div class="list">
        ${sw('timerOn', 'Temporizador de descanso', 'Arranca al marcar una serie')}
        ${sw('soundOn', 'Sonido al terminar el descanso', 'En iPhone la vibración no está disponible para apps web')}
      </div>
    </div>

    ${st.paces?.length ? `<div class="section"><div class="section-h"><h2>Ritmos del plan</h2></div><div class="card">${st.paces.map(p => `<div class="kv"><span class="k">${esc(p.zone)}</span><span class="num" style="text-align:right">${esc(p.pace)}</span></div>`).join('')}</div></div>` : ''}

    <div class="section"><div class="section-h"><h2>App</h2></div>
      <div class="list">
        <button class="list-item" data-update><div class="grow">Buscar actualización</div></button>
      </div>
      <p class="tiny muted center" style="margin-top:20px">Tigre · Tus datos se guardan solo en este dispositivo. Nada se envía a internet.</p>
    </div>
  `;

  const saveProfile = debounce(() => saveSettings({ profile: { ...S.settings.profile } }), 300);
  view.querySelectorAll('[data-p]').forEach(i => i.oninput = () => {
    const k = i.dataset.p; S.settings.profile[k] = k === 'heightCm' ? num(i.value) : i.value; saveProfile();
  });
  view.querySelectorAll('[data-sw]').forEach(c => c.onchange = () => saveSettings({ [c.dataset.sw]: c.checked }));

  view.querySelector('[data-export]').onclick = () => exportBackup().then(() => renderSettings(view));
  view.querySelector('[data-import]').onclick = async () => {
    const d = await pickFile(); if (!d) return;
    if (!['Tigre', 'Tempo'].includes(d.app)) return toast('Este archivo no es un backup de Tigre');
    const n = (d.logs || []).length;
    if (!(await confirmDialog({ title: 'Importar backup', text: `Se van a reemplazar todos los datos de este teléfono por los del backup (${n} registros).`, ok: 'Importar', danger: true }))) return;
    try { await importAll(d); toast('Backup importado'); renderSettings(view); } catch (e) { toast(e.message); }
  };
  const pb = view.querySelector('[data-persist]');
  if (pb) pb.onclick = async () => { const ok = await requestPersist(); toast(ok ? 'Almacenamiento persistente activado' : 'iOS no lo concedió todavía'); renderSettings(view); };

  view.querySelector('[data-plan-import]').onclick = async () => {
    const d = await pickFile(); if (!d) return;
    if (!Array.isArray(d.plan)) return toast('El archivo no tiene un plan válido');
    if (!(await confirmDialog({ title: 'Importar plan nuevo', text: `Se reemplaza el plan actual por "${d.name || 'plan nuevo'}" (${d.plan.length} sesiones). Tus registros no se tocan.`, ok: 'Importar' }))) return;
    try { await loadPlanSource(d); toast('Plan importado'); renderSettings(view); } catch (e) { toast(e.message); }
  };
  view.querySelector('[data-plan-reset]').onclick = async () => {
    if (!(await confirmDialog({ title: 'Restablecer plan original', text: 'Se pierden los cambios que hiciste al plan y a las rutinas del plan. Tus registros no se tocan.', ok: 'Restablecer', danger: true }))) return;
    try { await loadPlanSource(S.settings.planSource || await fetchBundledPlan()); toast('Plan restablecido'); renderSettings(view); } catch (e) { toast(e.message); }
  };
  const pc = view.querySelector('[data-plan-clear]');
  if (pc) pc.onclick = async () => {
    if (!(await confirmDialog({ title: 'Quitar el plan', text: 'Tigre queda como registro libre. Tus registros y rutinas se mantienen. Podés volver a cargarlo con "Restablecer plan original".', ok: 'Quitar plan', danger: true }))) return;
    await clearPlan(); toast('Plan quitado'); renderSettings(view);
  };
  view.querySelector('[data-update]').onclick = async () => {
    if (window.tigreCheckUpdate) { await window.tigreCheckUpdate(); toast('Si hay una versión nueva, vas a ver el aviso arriba'); } else toast('Las actualizaciones funcionan cuando la app está publicada');
  };
}

async function exportBackup() {
  const data = exportAll();
  const name = `tigre-backup-${todayStr()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  let ok = false;
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: 'Backup de Tigre' }); ok = true;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  if (!ok) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  await saveSettings({ lastBackup: new Date().toISOString() });
  toast('Backup listo');
}

// ---------- Rutinas ----------
export function renderRoutines(view) {
  const list = routineList();
  view.innerHTML = `
    ${topbar({ back: true, title: 'Rutinas' })}
    ${list.length ? `<div class="list">${list.map(r => `<a class="list-item" href="#/rutina/${r.id}"><div class="grow"><div>${esc(r.name)}</div><div class="wsub">${r.exercises.length} ejercicios${r.source === 'plan' ? ' · del plan' : ''}</div></div>${icon('chev')}</a>`).join('')}</div>`
      : '<div class="empty">Todavía no tenés rutinas.</div>'}
    <button class="btn block section" data-new>${icon('plus')}Nueva rutina</button>`;
  bindBack(view, '#/ajustes');
  view.querySelector('[data-new]').onclick = async () => {
    const r = { id: uid('r'), name: 'Rutina nueva', source: 'user', exercises: [] };
    await putRoutine(r); location.hash = `#/rutina/${r.id}`;
  };
}

export function renderRoutineEdit(view, [id]) {
  const r = S.routines[id];
  if (!r) { view.innerHTML = `${topbar({ back: true })}<div class="empty">Esta rutina ya no existe.</div>`; bindBack(view, '#/rutinas'); return; }
  const save = debounce(() => putRoutine(r), 300);
  const render = () => {
    view.innerHTML = `
      ${topbar({ back: true, title: '', right: `<button class="icon-btn" data-menu aria-label="Opciones">${icon('more')}</button>` })}
      <label class="field"><span>Nombre de la rutina</span><input class="input" data-name value="${esc(r.name)}" style="font-size:20px;font-weight:600"></label>
      <div class="small muted" style="margin:8px 0 20px">Los cambios se guardan solos y se usan en los próximos entrenos.</div>
      ${r.exercises.map((e, i) => `<div class="ed-ex" data-i="${i}">
        <input class="input" data-f="name" value="${esc(e.name)}" placeholder="Nombre del ejercicio" style="font-weight:600">
        <div class="grid3">
          <label><span class="lbl">Series</span><input class="input num" inputmode="numeric" data-f="sets" value="${esc(e.sets)}"></label>
          <label><span class="lbl">Reps</span><input class="input num" data-f="reps" value="${esc(e.reps)}" placeholder="8–10"></label>
          <label><span class="lbl">Descanso</span><input class="input num" data-f="rest" value="${esc(e.rest)}" placeholder="90&quot;"></label>
        </div>
        <label><span class="lbl">Nota</span><input class="input" data-f="note" value="${esc(e.note || '')}" placeholder="Opcional"></label>
        <div class="ed-tools">
          <button class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Subir">${icon('up')}</button>
          <button class="icon-btn" data-down="${i}" ${i === r.exercises.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Bajar">${icon('down')}</button>
          <button class="icon-btn danger" data-rm="${i}" aria-label="Quitar">${icon('x')}</button>
        </div>
      </div>`).join('')}
      <button class="btn block" style="margin-top:16px" data-add>${icon('plus')}Agregar ejercicio</button>`;
    bindBack(view, '#/rutinas');
    view.querySelector('[data-name]').oninput = (ev) => { r.name = ev.target.value; save(); };
    view.querySelectorAll('[data-f]').forEach(inp => inp.oninput = () => {
      const i = +inp.closest('[data-i]').dataset.i, f = inp.dataset.f;
      r.exercises[i][f] = f === 'sets' ? (parseInt(inp.value, 10) || '') : inp.value; save();
    });
    const move = (i, j) => { [r.exercises[i], r.exercises[j]] = [r.exercises[j], r.exercises[i]]; save.flush(); render(); };
    view.querySelectorAll('[data-up]').forEach(b => b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1));
    view.querySelectorAll('[data-down]').forEach(b => b.onclick = () => move(+b.dataset.down, +b.dataset.down + 1));
    view.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      const i = +b.dataset.rm;
      if (await confirmDialog({ title: 'Quitar ejercicio', text: r.exercises[i].name, ok: 'Quitar', danger: true })) { r.exercises.splice(i, 1); save.flush(); render(); }
    });
    view.querySelector('[data-add]').onclick = () => { r.exercises.push({ id: uid('e'), name: '', sets: 3, reps: '8–12', rest: '90"', note: '' }); save.flush(); render(); const all = view.querySelectorAll('[data-f="name"]'); all[all.length - 1]?.focus(); };
    view.querySelector('[data-menu]').onclick = () => actionSheet(r.name, [
      { label: 'Duplicar rutina', run: async () => { const c = { ...JSON.parse(JSON.stringify(r)), id: uid('r'), name: `${r.name} (copia)`, source: 'user' }; await putRoutine(c); location.hash = `#/rutina/${c.id}`; } },
      { label: 'Borrar rutina', danger: true, run: async () => {
        const used = S.plan.filter(p => p.routine === r.id);
        if (!(await confirmDialog({ title: 'Borrar rutina', text: used.length ? `Se usa en ${used.length} sesiones del plan; esas sesiones quedan como entreno libre. Tus registros no se tocan.` : 'Tus registros no se tocan.', ok: 'Borrar', danger: true }))) return;
        for (const p of used) await putPlan({ ...p, routine: null });
        await delRoutine(r.id); toast('Rutina borrada'); location.replace('#/rutinas');
      } },
    ]);
  };
  render();
}
