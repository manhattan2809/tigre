// Tigre — arranque, navegación y actualizaciones.
import { S, init, purgeEmpty } from './db.js';
import { ICONS } from './icons.js';
import { closeSheet } from './ui.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { renderDay, renderSessionEdit } from './views/day.js';
import { renderGym } from './views/gym.js';
import { renderRun, renderOther } from './views/run.js';
import { renderProgress } from './views/progress.js';
import { renderSummary } from './views/summary.js';
import { renderSettings, renderRoutines, renderRoutineEdit, renderSetup } from './views/settings.js';

export const APP_VERSION = '1.0.0';

const routes = [
  [/^hoy$/, renderToday, 'hoy'],
  [/^calendario$/, renderCalendar, 'calendario'],
  [/^dia\/(\d{4}-\d{2}-\d{2})$/, renderDay, 'calendario'],
  [/^sesion\/(.+)$/, renderSessionEdit, null],
  [/^gym\/(.+)$/, renderGym, null],
  [/^run\/(.+)$/, renderRun, null],
  [/^other\/(.+)$/, renderOther, null],
  [/^progreso$/, renderProgress, 'progreso'],
  [/^resumen$/, renderSummary, 'resumen'],
  [/^ajustes$/, renderSettings, 'ajustes'],
  [/^rutinas$/, renderRoutines, 'ajustes'],
  [/^rutina\/(.+)$/, renderRoutineEdit, 'ajustes'],
];

let current = null;
let navCount = 0;

async function route() {
  closeSheet();
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const view = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');

  if (!S.settings.setupDone) {
    tabbar.hidden = true; view.classList.add('no-tabs'); document.body.classList.add('no-tabs');
    return renderSetup(view, [], params);
  }
  let match = null;
  for (const [re, fn, tab] of routes) { const m = path.match(re); if (m) { match = { fn, tab, args: m.slice(1) }; break; } }
  if (!match) { location.replace('#/hoy'); return; }

  // Borra registros vacíos (abiertos y cerrados sin anotar nada).
  const openId = /^(gym|run|other)\//.test(path) ? path.split('/')[1] : null;
  await purgeEmpty(openId);

  const showTabs = !!match.tab;
  tabbar.hidden = !showTabs;
  view.classList.toggle('no-tabs', !showTabs);
  document.body.classList.toggle('no-tabs', !showTabs);
  tabbar.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === match.tab));

  if (current !== path) window.scrollTo(0, 0);
  current = path;
  await match.fn(view, match.args, params);
}

window.addEventListener('hashchange', () => { navCount++; if (navCount > 0) sessionStorage.setItem('tigre-nav', '1'); route(); });
export const rerender = () => route();

// ---------- Service worker y aviso de actualización ----------
function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const bar = document.getElementById('update-bar');
    const show = (w) => {
      bar.hidden = false;
      document.getElementById('update-btn').onclick = () => { bar.hidden = true; w.postMessage('skipWaiting'); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); });
    });
    const check = () => reg.update().catch(() => { });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    window.tigreCheckUpdate = check;
  }).catch(() => { });
}

async function boot() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = ICONS[el.dataset.icon] || ''; });
  try {
    await init();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty">No se pudo abrir el almacenamiento local.<br><span class="small">${e.message}</span></div>`;
    return;
  }
  if (!location.hash) location.replace('#/hoy');
  await route();
  setupSW();
}
boot();
