const CACHE_NAME = 'voicetask-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/ticktick.js',
  './js/parser.js',
  './js/speech.js',
  './js/queue.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Let API requests pass through to network
  if (e.request.url.includes('api.ticktick.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
