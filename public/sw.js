const CACHE_NAME = 'lumere-shell-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/') || url.pathname.includes('/api/')) {
    return;
  }

  // SPA document navigations (Back / Forward / Refresh / direct deep links):
  // Always Network-First so internal routes like /tasks or /projects refresh cleanly;
  // if offline, fall back to cached /index.html SPA shell before /offline.html.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) return cachedShell;
        const cachedOffline = await caches.match('/offline.html');
        return cachedOffline || Response.error();
      })
    );
    return;
  }

  // Same-origin static assets: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(response => response || Response.error()))
  );
});
