// Офлайн-работа: оболочка приложения кладётся в кеш при установке.
// Данные тут ни при чём — они в IndexedDB и кешем не управляются.

const VERSION = 'pk89-v25';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/store.js',
  './js/model.js',
  './js/format.js',
  './js/presets.js',
  './js/zip.js',
  './js/xlsx.js',
  './js/report.js',
  './js/backup.js',
  './js/sync.js',
  './js/requestsReport.js',
  './js/packingsReport.js',
  './js/views/products.js',
  './js/views/recipe.js',
  './js/views/packing.js',
  './js/views/accounting.js',
  './js/views/settings.js',
  './js/views/requests.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Навигация: сначала сеть (чтобы подхватить обновление), при отказе — кеш.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  // Остальное: сначала кеш — в цеху связи может не быть вовсе.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
