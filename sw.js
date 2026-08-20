/**
 * Service Worker for Offline PWA Support & Asset Caching
 */
const CACHE_NAME = 'mrp-codisa-v2-cache';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/data.js',
  '/js/core/config.js',
  '/js/core/formatter.js',
  '/js/core/mrpEngine.js',
  '/js/core/cache.js',
  '/js/core/excelExporter.js',
  '/js/api/client.js',
  '/js/ui/theme.js',
  '/js/ui/toast.js',
  '/js/ui/modal.js',
  '/js/ui/commandPalette.js',
  '/js/ui/kpiRenderer.js',
  '/js/ui/tableRenderer.js',
  '/js/charts/chartManager.js',
  '/js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets could not be pre-cached:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-first for API routes
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
