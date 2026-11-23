// Utilidades: fechas, formatos, cálculos.

export const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const TYPE_LABEL = { run: 'Running', gym: 'Gimnasio', rest: 'Descanso', race: 'Carrera', other: 'Otro' };

// ---------- Fechas (siempre como texto 'AAAA-MM-DD' en hora local) ----------
export function toStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function todayStr() { return toStr(new Date()); }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return toStr(d); }
export function mondayOf(s) { const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toStr(d); }
export function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
export function weekdayIdx(s) { return parseDate(s).getDay(); }
export function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }

export function fmtDay(s) { const d = parseDate(s); return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; }
export function fmtDayLong(s) { const d = parseDate(s); return `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; }
export const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
export function fmtDateShort(s) { const d = parseDate(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; }
export function fmtDateYear(s) { const d = parseDate(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; }
export function fmtRange(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (da.getMonth() === db.getMonth()) return `${da.getDate()}–${db.getDate()} ${MONTHS_SHORT[db.getMonth()]} ${db.getFullYear()}`;
  return `${da.getDate()} ${MONTHS_SHORT[da.getMonth()]} – ${db.getDate()} ${MONTHS_SHORT[db.getMonth()]} ${db.getFullYear()}`;
}

// ---------- Números ----------
export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export function fmtNum(n, dec = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const r = Math.round(n * 10 ** dec) / 10 ** dec;
  return String(r).replace('.', ',');
}
export function fmtKg(n) { return fmtNum(n, 2); }

// ---------- Tiempo y ritmo ----------
export function fmtDuration(sec) {
  if (!sec && sec !== 0) return '–';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export function fmtPace(secPerKm) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '–';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function paceOf(log) { return log && log.km > 0 && log.timeSec > 0 ? log.timeSec / log.km : null; }
export function splitTime(sec) {
  if (!sec) return { h: '', m: '', s: '' };
  return { h: Math.floor(sec / 3600) || '', m: Math.floor((sec % 3600) / 60), s: sec % 60 };
}

// ---------- Rango de reps y progresión ----------
export function parseReps(str) {
  const nums = String(str || '').match(/\d+/g);
  if (!nums) return { min: null, max: null };
  const a = Number(nums[0]), b = Number(nums[1] ?? nums[0]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}
function stepFor(kg) { return kg < 20 ? 0.5 : 1; }
export function nextWeight(kg) {
  const step = stepFor(kg);
  let n = Math.ceil((kg * 1.025) / step) * step;
  if (n <= kg) n = kg + step;
  return Math.round(n * 10) / 10;
}
// Devuelve {up:boolean, text} o null si no hay datos.
export function suggestion(lastSets, repsStr) {
  const sets = (lastSets || []).filter(s => num(s.reps) > 0);
  if (!sets.length) return null;
  const { max } = parseReps(repsStr);
  const kgs = sets.map(s => num(s.kg) || 0);
  const kg = Math.max(...kgs);
  const topReached = max !== null && sets.every(s => num(s.reps) >= max);
  if (kg <= 0) {
    return topReached ? { up: true, text: 'Llegaste al tope: suma dificultad o reps' } : { up: false, text: 'Intenta sumar reps' };
  }
  if (topReached) return { up: true, text: `Sube a ${fmtKg(nextWeight(kg))} kg`, kg: nextWeight(kg) };
  return { up: false, text: `Mantén ${fmtKg(kg)} kg e intenta sumar reps`, kg };
}

// ---------- Varios ----------
export function uid(prefix = '') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function debounce(fn, ms = 300) {
  let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}
export function setsText(sets) {
  return (sets || []).filter(s => num(s.reps) > 0)
    .map(s => (num(s.kg) ? `${fmtKg(num(s.kg))}×${num(s.reps)}` : `${num(s.reps)} reps`)).join(', ');
}
