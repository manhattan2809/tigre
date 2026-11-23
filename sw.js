// Service worker de Tigre: guarda la app para usarla sin internet.
// Cuando publiques una versión nueva, cambiá VERSION (ej. 'tigre-v2').
const VERSION = 'tigre-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './plan-data.json',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/icons.js',
  './js/ui.js',
  './js/actions.js',
  './js/charts.js',
  './js/views/today.js',
  './js/views/calendar.js',
  './js/views/day.js',
  './js/views/gym.js',
  './js/views/run.js',
  './js/views/progress.js',
  './js/views/summary.js',
  './js/views/settings.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Primero el caché (funciona sin internet); si no está, la red.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
