// Acciones compartidas entre pantallas: crear registros, resúmenes, estado "hecho".
import { S, putLog, routineList, lastExercise, planById, isFilled } from './db.js';
import { uid, num, fmtNum, fmtDuration, fmtPace, paceOf, setsText } from './utils.js';
import { actionSheet } from './ui.js';

const kindOfType = (t) => (t === 'gym' ? 'gym' : t === 'run' || t === 'race' ? 'run' : t === 'other' ? 'other' : null);

export function exercisesFromRoutine(routine, date) {
  return (routine?.exercises || []).map(e => {
    const last = lastExercise(e.name, { before: date });
    const lastKg = last ? Math.max(...last.sets.map(s => num(s.kg) || 0)) : null;
    const n = Math.max(1, Number(e.sets) || 3);
    return {
      name: e.name, target: { sets: n, reps: e.reps, rest: e.rest, note: e.note || '' },
      sets: Array.from({ length: n }, () => ({ kg: lastKg ? String(lastKg) : '', reps: '', done: false })),
    };
  });
}

// Crea un registro y abre su pantalla.
export async function startLog(kind, date, { planId = null, routineId = null } = {}) {
  const plan = planId ? planById(planId) : null;
  const existing = planId && S.logs.find(l => l.planId === planId);
  if (existing) { location.hash = `#/${existing.kind}/${existing.id}`; return; }
  const log = { id: uid('l'), kind, date, planId, createdAt: Date.now(), title: plan?.title || '' };
  if (kind === 'gym') {
    const rid = routineId || plan?.routine || null;
    const r = rid ? S.routines[rid] : null;
    log.routineId = r ? r.id : null;
    log.title = r?.name || 'Entreno libre';
    log.exercises = exercisesFromRoutine(r, date);
  } else if (kind === 'run') {
    Object.assign(log, { km: '', timeSec: 0, feel: null, note: '', title: plan?.title || 'Running' });
  } else {
    Object.assign(log, { activity: '', durationSec: 0, km: '', feel: null, note: '', title: '' });
  }
  await putLog(log);
  location.hash = `#/${kind}/${log.id}`;
}

// Registrar desde una sesión del plan.
export function logFromSession(session) {
  const kind = kindOfType(session.type);
  if (kind) return startLog(kind, session.date, { planId: session.id });
  return chooseLog(session.date);
}

// Menú "¿Qué hiciste?" para registrar algo fuera del plan.
export function chooseLog(date) {
  const routines = routineList();
  actionSheet('Registrar entreno', [
    { label: 'Running', run: () => startLog('run', date) },
    { label: 'Gimnasio', run: () => chooseRoutine(date, routines) },
    { label: 'Otra actividad', run: () => startLog('other', date) },
  ]);
}
function chooseRoutine(date, routines) {
  actionSheet('¿Qué rutina?', [
    ...routines.map(r => ({ label: r.name, run: () => startLog('gym', date, { routineId: r.id }) })),
    { label: 'Entreno libre (sin rutina)', run: () => startLog('gym', date) },
  ]);
}

export function sessionLog(session) {
  const kind = kindOfType(session.type);
  return S.logs.find(l => isFilled(l) && (l.planId === session.id || (!l.planId && kind && l.kind === kind && l.date === session.date)));
}

export function logSummary(l) {
  if (l.kind === 'run') {
    const parts = [];
    if (num(l.km)) parts.push(`${fmtNum(num(l.km), 2)} km`);
    if (l.timeSec) parts.push(fmtDuration(l.timeSec));
    const p = paceOf({ km: num(l.km), timeSec: l.timeSec }); if (p) parts.push(`${fmtPace(p)}/km`);
    if (l.feel) parts.push(`sensación ${l.feel}/10`);
    return parts.join(' · ');
  }
  if (l.kind === 'gym') {
    const ex = (l.exercises || []).filter(e => e.sets.some(s => num(s.reps) > 0));
    const sets = ex.reduce((a, e) => a + e.sets.filter(s => num(s.reps) > 0).length, 0);
    return `${ex.length} ejercicio${ex.length === 1 ? '' : 's'} · ${sets} series`;
  }
  const parts = [];
  if (l.durationSec) parts.push(fmtDuration(l.durationSec));
  if (num(l.km)) parts.push(`${fmtNum(num(l.km), 2)} km`);
  if (l.feel) parts.push(`sensación ${l.feel}/10`);
  return parts.join(' · ');
}
export function logTitle(l) {
  if (l.kind === 'other') return l.activity || 'Otra actividad';
  return l.title || (l.kind === 'run' ? 'Running' : 'Gimnasio');
}
export function gymDetailText(l) {
  return (l.exercises || []).filter(e => e.sets.some(s => num(s.reps) > 0)).map(e => `${e.name}: ${setsText(e.sets)}`);
}
