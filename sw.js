/* Service worker — cachar app-skalet så appen funkar offline. */
var CACHE = 'mittschema-v9';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/schedule.js',
  './js/storage.js',
  './js/app.js',
  './js/views/today.js',
  './js/views/schedule.js',
  './js/views/week.js',
  './js/views/requests.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (_) {} });
        return resp;
      }).catch(function () { return cached; });
    })
  );
});
