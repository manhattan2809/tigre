// Componentes de interfaz: hojas inferiores, confirmaciones, avisos y temporizador.
import { icon } from './icons.js';
import { esc } from './utils.js';
import { S } from './db.js';

// ---------- Toast ----------
let toastT;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- Hoja inferior (sheet) ----------
export function openSheet(html, bind) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = `<div class="sheet-wrap"><div class="sheet-bg" data-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  const sheet = root.querySelector('.sheet');
  const close = () => { root.innerHTML = ''; };
  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  if (bind) bind(sheet, close);
  return close;
}
export function closeSheet() { document.getElementById('sheet-root').innerHTML = ''; }

export function confirmDialog({ title, text = '', ok = 'Confirmar', danger = false, cancel = 'Cancelar' }) {
  return new Promise(resolve => {
    openSheet(`
      <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="stack" style="margin-top:20px">
        <button class="btn block ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>
        <button class="btn block" data-no>${esc(cancel)}</button>
      </div>`, (sh, close) => {
      sh.querySelector('[data-ok]').onclick = () => { close(); resolve(true); };
      sh.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
      sh.parentElement.querySelector('.sheet-bg').addEventListener('click', () => resolve(false));
    });
  });
}

// Menú de acciones: items = [{label, danger?, run}]
export function actionSheet(title, items) {
  openSheet(`${title ? `<h3 style="margin-bottom:14px">${esc(title)}</h3>` : ''}
    <div class="list">${items.map((it, i) => `<button class="list-item ${it.danger ? 'danger' : ''}" data-i="${i}">${esc(it.label)}</button>`).join('')}</div>
    <button class="btn block" style="margin-top:12px" data-close>Cancelar</button>`, (sh, close) => {
    sh.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { close(); items[+b.dataset.i].run(); });
  });
}

export function topbar({ back, title = '', right = '' } = {}) {
  return `<div class="topbar">${back ? `<button class="icon-btn" data-back aria-label="Volver">${icon('back')}</button>` : ''}<h1>${esc(title)}</h1><div class="spacer"></div>${right}</div>`;
}
export function bindBack(root, fallback = '#/hoy') {
  const b = root.querySelector('[data-back]');
  if (b) b.onclick = () => { if (history.length > 1 && sessionStorage.getItem('tigre-nav') === '1') history.back(); else location.hash = fallback; };
}

// ---------- Temporizador de descanso ----------
export function parseRest(str) {
  const s = String(str || '');
  let sec = 0;
  const m = s.match(/(\d+)\s*'/); if (m) sec += Number(m[1]) * 60;
  const q = s.match(/(\d+)\s*(?:"|''|s\b|seg)/); if (q) sec += Number(q[1]);
  if (!m && !q) { const n = s.match(/\d+/); if (n) sec = Number(n[0]) > 10 ? Number(n[0]) : Number(n[0]) * 60; }
  return sec || 90;
}

let audioCtx;
export function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (_) { /* sin audio */ }
}
function beep() {
  if (!audioCtx || !S.settings.soundOn) return;
  const t0 = audioCtx.currentTime;
  [0, 0.28, 0.56].forEach((d, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
    o.connect(g).connect(audioCtx.destination); o.start(t0 + d); o.stop(t0 + d + 0.25);
  });
}

const timer = { endAt: 0, total: 0, iv: null, ended: false };
export function startTimer(sec) {
  if (!S.settings.timerOn) return;
  unlockAudio();
  timer.total = sec; timer.endAt = Date.now() + sec * 1000; timer.ended = false;
  clearInterval(timer.iv); timer.iv = setInterval(tickTimer, 250); tickTimer();
}
export function stopTimer() { clearInterval(timer.iv); timer.iv = null; timer.endAt = 0; document.getElementById('timer').hidden = true; }
function tickTimer() {
  const el = document.getElementById('timer');
  const left = Math.ceil((timer.endAt - Date.now()) / 1000);
  if (left <= 0 && !timer.ended) {
    timer.ended = true; beep();
    try { navigator.vibrate && navigator.vibrate([300, 120, 300]); } catch (_) { }
    setTimeout(() => { if (timer.ended) stopTimer(); }, 6000);
  }
  const mm = Math.max(0, left);
  el.hidden = false;
  el.className = 'timer' + (timer.ended ? ' end' : '');
  el.innerHTML = timer.ended
    ? `<div class="grow"><div class="lbl">Descanso terminado</div><div class="t">¡A la próxima serie!</div></div><button data-t="x" aria-label="Cerrar">OK</button>`
    : `<div class="grow"><div class="lbl">Descanso</div><div class="t num">${Math.floor(mm / 60)}:${String(mm % 60).padStart(2, '0')}</div></div>
       <button data-t="-15">−15</button><button data-t="+15">+15</button><button data-t="x" aria-label="Cerrar">${icon('x')}</button>`;
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    const v = b.dataset.t;
    if (v === 'x') return stopTimer();
    timer.endAt += Number(v) * 1000; tickTimer();
  });
  const svg = el.querySelector('svg'); if (svg) { svg.style.width = '20px'; svg.style.height = '20px'; }
}
// Si la app vuelve del fondo, el temporizador se recalcula con la hora real.
document.addEventListener('visibilitychange', () => { if (!document.hidden && timer.iv) tickTimer(); });
