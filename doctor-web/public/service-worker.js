/**
 * Service Worker — Doctor Web PWA
 * Caches app shell for offline/fast loading.
 * Network-first for API calls, cache-first for static assets.
 */

const CACHE_NAME = 'soc-doctor-v1';

// App shell files to pre-cache on install
const APP_SHELL = [
  '/',
  '/home',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
];

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls — always network, never cache
  if (request.url.includes('/api/')) return;

  // Static assets — try cache first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful responses for next time
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback — serve index.html for navigation requests (SPA)
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
