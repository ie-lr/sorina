/**
 * service-worker.js
 * -----------------------------------------------------------------------
 * Progressive Web App Service Worker for IE School Management System.
 * Caches static shell assets for fast loading and offline capability.
 * Never caches dynamic or authenticated API responses.
 * -----------------------------------------------------------------------
 */

const CACHE_NAME = 'ie-school-portal-v2.3';
const SHELL_ASSETS = [
  './',
  './index.html',
  './admins/',
  './staff/',
  './admins/manifest.json',
  './staff/manifest.json',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/api.js',
  './assets/js/auth.js',
  './assets/js/admin.js',
  './assets/js/teacher.js',
  './assets/js/student.js',
  './assets/js/pwaInstall.js',
  './assets/js/app.js',
  './assets/js/reportCard.js',
  './assets/js/iePortal.js',
  './assets/images/school-logo.png',
  './assets/images/campus.jpeg',
  './assets/images/campus-2.jpeg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS).catch(err => {
        console.warn('PWA Pre-cache notice:', err);
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

// Offline fallback: each portal falls back to its own page, never to another portal's.
function portalFallback(url) {
  if (url.pathname.includes('/admins')) return './admins/';
  if (url.pathname.includes('/staff')) return './staff/';
  return './index.html';
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only for API calls or POST requests
  if (event.request.method !== 'GET' || url.searchParams.has('action') || url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for JavaScript files so updates are immediately loaded
  if (url.pathname.endsWith('.js') || url.searchParams.has('v')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for HTML pages so page updates reach installed apps immediately
  const accept = event.request.headers.get('accept') || '';
  if (event.request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then(c => c || caches.match(portalFallback(url))))
    );
    return;
  }

  // Cache-first, fallback to network for static shell assets (images, css)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        return response;
      }).catch(() => {
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match(portalFallback(url));
        }
      });
    })
  );
});
