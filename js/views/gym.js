// Registro de gimnasio: series con kg y reps, última vez, sugerencia y temporizador.
import { S, logById, putLog, delLog, lastExercise, exerciseNames } from '../db.js';
import { fmtDayLong, fmtDateShort, esc, num, fmtKg, suggestion, setsText, debounce, parseReps, isValidDate } from '../utils.js';
import { icon } from '../icons.js';
import { topbar, bindBack, actionSheet, openSheet, confirmDialog, toast, startTimer, parseRest, unlockAudio } from '../ui.js';

export function renderGym(view, [id]) {
  const log = logById(id);
  if (!log) { view.innerHTML = `${topbar({ back: true })}<div class="empty">Este registro ya no existe.</div>`; bindBack(view); return; }
  const save = debounce(() => putLog(log), 250);
  const back = log.planId ? `#/dia/${log.date}` : '#/hoy';

  const exHTML = (e, ei) => {
    const last = lastExercise(e.name, { before: log.date, excludeId: log.id });
    const sug = last ? suggestion(last.sets, e.target?.reps) : null;
    const { max } = parseReps(e.target?.reps);
    const meta = e.target ? [`${e.sets.length} × ${esc(e.target.reps || '–')}`, e.target.rest ? `descanso ${esc(e.target.rest)}` : ''].filter(Boolean).join(' · ') : `${e.sets.length} series`;
    return `<div class="ex" data-ei="${ei}">
      <div class="ex-h">
        <div class="grow"><div class="ex-name">${esc(e.name)}</div><div class="ex-meta">${meta}</div>${e.target?.note ? `<div class="ex-note">${esc(e.target.note)}</div>` : ''}</div>
        <button class="icon-btn" data-exmenu="${ei}" aria-label="Opciones del ejercicio" style="margin:-8px -10px 0 0">${icon('more')}</button>
      </div>
      ${sug ? `<div class="row" style="gap:8px"><div class="ex-sug grow ${sug.up ? 'up' : ''}">${sug.up ? '↑ ' : ''}${esc(sug.text)}</div>${sug.up && sug.kg ? `<button class="link-btn" data-apply="${ei}" data-kg="${sug.kg}" style="padding:0 4px">Usar</button>` : ''}</div>` : ''}
      <div class="set-head"><span>#</span><span>kg</span><span></span><span>reps</span><span></span></div>
      <div class="sets">${e.sets.map((s, si) => `
        <div class="set-row ${s.done ? 'done' : ''}">
          <span class="i num">${si + 1}</span>
          <input class="input num" inputmode="decimal" enterkeyhint="next" data-kg="${ei}:${si}" value="${esc(s.kg)}" placeholder="0" aria-label="Peso serie ${si + 1}">
          <span class="x">×</span>
          <input class="input num" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" data-reps="${ei}:${si}" value="${esc(s.reps)}" placeholder="${max ?? ''}" aria-label="Reps serie ${si + 1}">
          <button class="set-ok ${s.done ? 'on' : ''}" data-ok="${ei}:${si}" aria-label="Marcar serie hecha">${icon('check')}</button>
        </div>`).join('')}</div>
      <div class="set-tools"><button class="link-btn" data-addset="${ei}">+ Serie</button>${e.sets.length > 1 ? `<button class="link-btn muted" data-rmset="${ei}">− Serie</button>` : ''}</div>
      <div class="ex-last">${last ? `Última vez · ${fmtDateShort(last.date)}: <b>${esc(setsText(last.sets))}</b>` : 'Primera vez con este ejercicio'}</div>
    </div>`;
  };

  const render = () => {
    const y = window.scrollY;
    view.innerHTML = `
      ${topbar({ back: true, title: '', right: `<button class="icon-btn" data-menu aria-label="Opciones">${icon('more')}</button>` })}
      <div class="eyebrow">Gimnasio · <span style="text-transform:none">${fmtDayLong(log.date)}</span></div>
      <h1 class="title-l" style="margin-bottom:6px">${esc(log.title || 'Entreno')}</h1>
      <div class="small muted" style="margin-bottom:20px">Se guarda solo mientras anotás.</div>
      ${S.settings.profile?.note ? `<div class="profile-note">${esc(S.settings.profile.note)}</div>` : ''}
      ${log.exercises.length ? log.exercises.map(exHTML).join('') : '<div class="card muted">Agregá tu primer ejercicio.</div>'}
      <button class="btn block" style="margin-top:16px" data-addex>${icon('plus')}Agregar ejercicio</button>
      <button class="btn primary block" style="margin-top:12px" data-finish>Terminar</button>
    `;
    window.scrollTo(0, y);
    bindBack(view, back);
    bind();
  };

  const bind = () => {
    view.querySelectorAll('[data-kg]').forEach(inp => {
      if (inp.tagName !== 'INPUT') return;
      inp.oninput = () => { const [ei, si] = inp.dataset.kg.split(':').map(Number); log.exercises[ei].sets[si].kg = inp.value.trim(); save(); };
      inp.onfocus = () => inp.select();
    });
    view.querySelectorAll('[data-reps]').forEach(inp => {
      inp.oninput = () => { const [ei, si] = inp.dataset.reps.split(':').map(Number); log.exercises[ei].sets[si].reps = inp.value.replace(/\D/g, ''); save(); };
      inp.onfocus = () => inp.select();
    });
    view.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => {
      unlockAudio();
      const [ei, si] = b.dataset.ok.split(':').map(Number);
      const e = log.exercises[ei], s = e.sets[si];
      s.done = !s.done;
      if (s.done && !num(s.reps)) { const { max } = parseReps(e.target?.reps); if (max) s.reps = String(max); }
      if (s.done && si > 0 && !s.kg && e.sets[si - 1].kg) s.kg = e.sets[si - 1].kg;
      save.flush();
      const isLast = ei === log.exercises.length - 1 && e.sets.every(x => x.done);
      if (s.done && !isLast) startTimer(parseRest(e.target?.rest));
      render();
    });
    view.querySelectorAll('[data-addset]').forEach(b => b.onclick = () => {
      const e = log.exercises[+b.dataset.addset]; const prev = e.sets[e.sets.length - 1];
      e.sets.push({ kg: prev ? prev.kg : '', reps: '', done: false }); save.flush(); render();
    });
    view.querySelectorAll('[data-rmset]').forEach(b => b.onclick = () => { log.exercises[+b.dataset.rmset].sets.pop(); save.flush(); render(); });
    view.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => {
      log.exercises[+b.dataset.apply].sets.forEach(s => { if (!s.done) s.kg = String(b.dataset.kg); }); save.flush(); render(); toast(`Peso actualizado a ${fmtKg(Number(b.dataset.kg))} kg`);
    });
    view.querySelectorAll('[data-exmenu]').forEach(b => b.onclick = () => {
      const ei = +b.dataset.exmenu; const ex = log.exercises;
      actionSheet(ex[ei].name, [
        ...(ei > 0 ? [{ label: 'Mover arriba', run: () => { [ex[ei - 1], ex[ei]] = [ex[ei], ex[ei - 1]]; save.flush(); render(); } }] : []),
        ...(ei < ex.length - 1 ? [{ label: 'Mover abajo', run: () => { [ex[ei + 1], ex[ei]] = [ex[ei], ex[ei + 1]]; save.flush(); render(); } }] : []),
        { label: 'Quitar de este entreno', danger: true, run: () => { ex.splice(ei, 1); save.flush(); render(); } },
      ]);
    });
    view.querySelector('[data-addex]').onclick = addExercise;
    view.querySelector('[data-finish]').onclick = async () => { save.flush(); toast('Entreno guardado'); location.hash = back; };
    view.querySelector('[data-menu]').onclick = () => actionSheet('Registro', [
      { label: 'Cambiar fecha', run: changeDate },
      { label: 'Borrar este registro', danger: true, run: async () => { if (await confirmDialog({ title: 'Borrar registro', text: 'Se borra lo que anotaste en este entreno. No se puede deshacer.', ok: 'Borrar', danger: true })) { await delLog(log.id); toast('Registro borrado'); location.hash = back; } } },
    ]);
  };

  const addExercise = () => {
    const names = exerciseNames();
    openSheet(`<h3>Agregar ejercicio</h3>
      <label class="field"><span>Nombre</span><input class="input" list="exnames" data-n placeholder="Ej: Press de banca" autocomplete="off"></label>
      <datalist id="exnames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="two" style="margin-top:16px"><label class="field"><span>Series</span><input class="input" inputmode="numeric" data-s value="3"></label><label class="field"><span>Reps objetivo</span><input class="input" data-r value="8–12"></label></div>
      <label class="field" style="margin-top:16px"><span>Descanso</span><input class="input" data-rest value="90&quot;"></label>
      <div class="stack" style="margin-top:20px"><button class="btn primary block" data-ok>Agregar</button><button class="btn block" data-close>Cancelar</button></div>`,
    (sh, close) => {
      sh.querySelector('[data-ok]').onclick = () => {
        const name = sh.querySelector('[data-n]').value.trim();
        if (!name) return toast('Escribí un nombre');
        const n = Math.min(10, Math.max(1, parseInt(sh.querySelector('[data-s]').value, 10) || 3));
        const last = lastExercise(name, { before: log.date, excludeId: log.id });
        const kg = last ? String(Math.max(...last.sets.map(s => num(s.kg) || 0)) || '') : '';
        log.exercises.push({ name, target: { sets: n, reps: sh.querySelector('[data-r]').value.trim(), rest: sh.querySelector('[data-rest]').value.trim(), note: '' }, sets: Array.from({ length: n }, () => ({ kg, reps: '', done: false })) });
        save.flush(); close(); render();
      };
    });
  };

  const changeDate = () => openSheet(`<h3>Cambiar fecha</h3>
    <label class="field"><span>Fecha</span><input class="input" type="date" data-d value="${log.date}"></label>
    <div class="stack" style="margin-top:20px"><button class="btn primary block" data-ok>Guardar</button><button class="btn block" data-close>Cancelar</button></div>`,
  (sh, close) => { sh.querySelector('[data-ok]').onclick = () => { const d = sh.querySelector('[data-d]').value; if (!isValidDate(d)) return; log.date = d; save.flush(); close(); render(); }; });

  render();
}
