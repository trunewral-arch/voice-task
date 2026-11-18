const CACHE_NAME = 'kanban-voice-v3.0';
const ASSETS = [
  './',
  './index.html',
  './voice.html',
  './manifest.json',
  './icon-192.png',
  './icon-maskable-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
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
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Never intercept ntfy.sh buffer calls or non-GET calls
  if (e.request.url.includes('ntfy.sh') || e.request.method !== 'GET') {
    return;
  }

  // ULTRA-FAST ZERO-LATENCY CACHE STRATEGY (Instant 0ms Startup on Android):
  // 1. Check local cache ignoring search query parameters (e.g. ?v=3.0 or ?utm_source=homescreen)
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
      // Background revalidation: fetch newest copy without delaying user UI
      const networkUpdate = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        return cachedResponse;
      }

      // If navigation request (opening the app) and exact URL wasn't matched, return cached index.html
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html').then((indexCached) => {
          return indexCached || networkUpdate;
        });
      }

      return networkUpdate;
    })
  );
});
