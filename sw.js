/*
  PULLSHEET service worker — caches the app shell (this page, the
  vendored JSZip/Chart.js/Hammer/zoom-plugin scripts, icons) so the
  app still opens and can analyze a log with zero signal, e.g. at
  the track or in a garage.

  Bump CACHE_NAME on every release that changes any cached file —
  the activate handler deletes anything not matching the current
  name, which is what actually rolls users onto the new version
  instead of them being stuck on a stale cached copy forever.
*/

const CACHE_NAME = 'pullsheet-v1.3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './vendor/jszip.min.js',
  './vendor/chart.umd.js',
  './vendor/hammer.min.js',
  './vendor/chartjs-plugin-zoom.min.js',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => {
        // A single missing/renamed asset shouldn't block install
        // entirely — log it and let whatever DID cache still help.
        console.error('SW install: could not cache full app shell', err);
      })
  );

  self.skipWaiting();

});

self.addEventListener('activate', (event) => {

  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );

  self.clients.claim();

});

self.addEventListener('fetch', (event) => {

  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Leave cross-origin requests (Google Fonts) alone entirely —
  // don't try to cache or intercept them. They just fail naturally
  // when offline and CSS falls back to system fonts.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {

      const networkFetch = fetch(event.request)
        .then((response) => {

          if (response && response.ok) {

            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });

          }

          return response;

        })
        .catch(() => cached);

      // Stale-while-revalidate: serve the cached copy immediately
      // if there is one (fast, and works offline), while still
      // fetching in the background to keep the cache fresh for
      // next time. Falls through to the network fetch itself only
      // when there's nothing cached yet.
      return cached || networkFetch;

    })
  );

});
