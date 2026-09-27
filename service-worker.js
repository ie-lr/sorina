/**
 * service-worker.js
 * -----------------------------------------------------------------------
 * Progressive Web App Service Worker.
 * Caches static shell assets for fast loading and offline capability.
 * Never caches dynamic or authenticated API responses (Section 7.1).
 * -----------------------------------------------------------------------
 */

const CACHE_NAME = 'sorina-portal-v1.0';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/styles.css',
  './assets/js/api.js',
  './assets/js/auth.js',
  './assets/js/pwaInstall.js',
  './assets/js/app.js',
  './assets/js/reportCard.js',
  './assets/images/school-logo.jpeg',
  './assets/images/campus.jpeg',
  './assets/images/campus-2.jpeg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS).catch(err => {
        Logger.log ? Logger.log(err) : console.warn('PWA Pre-cache notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only for API calls or POST requests
  if (event.request.method !== 'GET' || url.searchParams.has('action') || url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first, fallback to network for static shell assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // If offline and request is HTML document, return index.html
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
