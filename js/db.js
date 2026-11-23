// Almacenamiento local en IndexedDB + copia en memoria para leer rápido.
// "Plan" (lo que planeás) y "registros" (lo que hiciste) viven en almacenes separados.
import { uid, num, mondayOf, addDays } from './utils.js';

const DB_NAME = 'tigre';
const DB_VERSION = 1;
let db;

export const S = {
  settings: null,
  plan: [],      // sesiones planificadas: {id, date, type, title, detail, km, pace, routine, week, phase}
  routines: {},  // {id: {id, name, source:'plan'|'user', exercises:[{id,name,sets,reps,rest,note}]}}
  logs: [],      // registros: {id, kind:'gym'|'run'|'other', date, planId, ...}
  body: [],      // peso corporal: {date, kg}
};

const DEFAULT_SETTINGS = {
  key: 'settings',
  setupDone: false,
  planName: null,
  races: [],
  paces: [],
  progressionRule: '',
  planSource: null,   // copia del último plan cargado, para "Restablecer plan original"
  lastBackup: null,
  profile: { name: '', heightCm: null, note: '' },
  timerOn: true,
  soundOn: true,
};

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function done(tx) { return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); }

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('plan')) d.createObjectStore('plan', { keyPath: 'id' }).createIndex('date', 'date');
      if (!d.objectStoreNames.contains('routines')) d.createObjectStore('routines', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('logs')) d.createObjectStore('logs', { keyPath: 'id' }).createIndex('date', 'date');
      if (!d.objectStoreNames.contains('body')) d.createObjectStore('body', { keyPath: 'date' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function all(store) { return req(db.transaction(store).objectStore(store).getAll()); }
async function put(store, val) { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val); return done(tx); }
async function del(store, key) { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); return done(tx); }

const clone = (o) => JSON.parse(JSON.stringify(o));
const sortPlan = () => S.plan.sort((a, b) => a.date.localeCompare(b.date) || (a.order ?? 0) - (b.order ?? 0));
const sortLogs = () => S.logs.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));

export async function init() {
  db = db || await open();
  const [meta, plan, routines, logs, body] = await Promise.all(['meta', 'plan', 'routines', 'logs', 'body'].map(all));
  const st = meta.find(m => m.key === 'settings');
  S.settings = { ...clone(DEFAULT_SETTINGS), ...(st || {}), profile: { ...DEFAULT_SETTINGS.profile, ...(st?.profile || {}) } };
  S.plan = plan; sortPlan();
  S.routines = Object.fromEntries(routines.map(r => [r.id, r]));
  S.logs = logs; sortLogs();
  S.body = body.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Ajustes ----------
export async function saveSettings(patch) {
  Object.assign(S.settings, patch);
  await put('meta', clone(S.settings));
}

// ---------- Plan ----------
export async function putPlan(item) {
  const i = S.plan.findIndex(p => p.id === item.id);
  if (i >= 0) S.plan[i] = item; else S.plan.push(item);
  sortPlan();
  await put('plan', clone(item));
}
export async function delPlan(id) { S.plan = S.plan.filter(p => p.id !== id); await del('plan', id); }
export const planById = (id) => S.plan.find(p => p.id === id);
export const planByDate = (date) => S.plan.filter(p => p.date === date);

// Semana y fase del plan para cualquier fecha (según las sesiones de esa semana).
export function weekInfo(date) {
  const mon = mondayOf(date), sun = addDays(mon, 6);
  const hit = S.plan.find(p => p.date >= mon && p.date <= sun && p.phase != null);
  if (!hit) return null;
  const weeks = [...new Set(S.plan.map(p => p.week).filter(w => w != null))];
  return { week: hit.week, phase: hit.phase, total: weeks.length };
}

// Carga un archivo de plan (plan-data.json). Reemplaza plan y rutinas del plan; NO toca registros.
export async function loadPlanSource(src, { keepSource = true } = {}) {
  if (!src || !Array.isArray(src.plan)) throw new Error('El archivo no tiene un plan válido.');
  const tx = db.transaction(['plan', 'routines'], 'readwrite');
  const ps = tx.objectStore('plan'), rs = tx.objectStore('routines');
  ps.clear();
  const newPlan = src.plan.map((p, i) => ({
    id: `p_${p.date}_${i}`, order: i,
    date: p.date, type: p.type || 'other', title: p.title || '', detail: p.detail || '',
    km: num(p.km), pace: p.pace || '', routine: p.routine || null, intensity: p.intensity || null, where: p.where || '',
    week: p.week ?? null, phase: p.phase || null,
  }));
  newPlan.forEach(p => ps.put(p));
  for (const r of Object.values(S.routines)) if (r.source === 'plan') rs.delete(r.id);
  const newRoutines = Object.entries(src.routines || {}).map(([key, r]) => ({
    id: key, name: r.name || key, source: 'plan',
    exercises: (r.exercises || []).map(e => ({ id: uid('e'), name: e.name, sets: e.sets || 3, reps: String(e.reps ?? ''), rest: e.rest || '', note: e.note || '' })),
  }));
  newRoutines.forEach(r => rs.put(r));
  await done(tx);
  S.plan = newPlan; sortPlan();
  for (const id of Object.keys(S.routines)) if (S.routines[id].source === 'plan') delete S.routines[id];
  newRoutines.forEach(r => { S.routines[r.id] = r; });
  await saveSettings({
    planName: src.name || 'Plan', races: src.races || [], paces: src.paces || [],
    progressionRule: src.progressionRule || '',
    ...(keepSource ? { planSource: clone(src) } : {}),
  });
}

export async function clearPlan() {
  const tx = db.transaction(['plan'], 'readwrite');
  tx.objectStore('plan').clear();
  await done(tx);
  S.plan = [];
  await saveSettings({ planName: null, races: [], paces: [] });
}

// ---------- Rutinas ----------
export async function putRoutine(r) { S.routines[r.id] = r; await put('routines', clone(r)); }
export async function delRoutine(id) { delete S.routines[id]; await del('routines', id); }
export const routineList = () => Object.values(S.routines).sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === 'plan' ? -1 : 1));

// ---------- Registros ----------
export async function putLog(log) {
  log.updatedAt = Date.now();
  const i = S.logs.findIndex(l => l.id === log.id);
  if (i >= 0) S.logs[i] = log; else S.logs.push(log);
  sortLogs();
  await put('logs', clone(log));
}
export async function delLog(id) { S.logs = S.logs.filter(l => l.id !== id); await del('logs', id); }
export const logById = (id) => S.logs.find(l => l.id === id);
export const logsByDate = (date) => S.logs.filter(l => l.date === date && isFilled(l));

export function isFilled(l) {
  if (!l) return false;
  if (l.kind === 'gym') return (l.exercises || []).some(e => (e.sets || []).some(s => num(s.reps) > 0));
  if (l.kind === 'run') return num(l.km) > 0 || num(l.timeSec) > 0;
  if (l.kind === 'other') return !!(l.activity || l.durationSec || l.note);
  return false;
}
export async function purgeEmpty(exceptId) {
  for (const l of S.logs.filter(l => l.id !== exceptId && !isFilled(l))) await delLog(l.id);
}

// Último registro de un ejercicio (por nombre) antes de una fecha / distinto a un registro.
export function lastExercise(name, { before, excludeId } = {}) {
  const key = name.trim().toLowerCase();
  for (let i = S.logs.length - 1; i >= 0; i--) {
    const l = S.logs[i];
    if (l.kind !== 'gym' || l.id === excludeId) continue;
    if (before && l.date > before) continue;
    const e = (l.exercises || []).find(x => x.name.trim().toLowerCase() === key);
    if (e && e.sets.some(s => num(s.reps) > 0)) return { date: l.date, sets: e.sets.filter(s => num(s.reps) > 0), logId: l.id };
  }
  return null;
}
export function exerciseNames() {
  const set = new Map();
  for (const r of Object.values(S.routines)) for (const e of r.exercises) set.set(e.name.toLowerCase(), e.name);
  for (const l of S.logs) if (l.kind === 'gym') for (const e of l.exercises || []) set.set(e.name.toLowerCase(), e.name);
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

// ---------- Peso corporal ----------
export async function putBody(entry) {
  const i = S.body.findIndex(b => b.date === entry.date);
  if (i >= 0) S.body[i] = entry; else S.body.push(entry);
  S.body.sort((a, b) => a.date.localeCompare(b.date));
  await put('body', clone(entry));
}
export async function delBody(date) { S.body = S.body.filter(b => b.date !== date); await del('body', date); }

// ---------- Backup ----------
export function exportAll() {
  return {
    app: 'Tigre', format: 1, exportedAt: new Date().toISOString(),
    settings: clone({ ...S.settings, lastBackup: new Date().toISOString() }),
    plan: clone(S.plan), routines: clone(Object.values(S.routines)), logs: clone(S.logs), body: clone(S.body),
  };
}
export async function importAll(data) {
  if (!data || !['Tigre', 'Tempo'].includes(data.app)) throw new Error('Este archivo no es un backup de Tigre.');
  const stores = ['meta', 'plan', 'routines', 'logs', 'body'];
  const tx = db.transaction(stores, 'readwrite');
  stores.forEach(s => tx.objectStore(s).clear());
  tx.objectStore('meta').put({ ...clone(DEFAULT_SETTINGS), ...data.settings, key: 'settings', setupDone: true });
  (data.plan || []).forEach(p => tx.objectStore('plan').put(p));
  (data.routines || []).forEach(r => tx.objectStore('routines').put(r));
  (data.logs || []).forEach(l => tx.objectStore('logs').put(l));
  (data.body || []).forEach(b => tx.objectStore('body').put(b));
  await done(tx);
  await init();
}
