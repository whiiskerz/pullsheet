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

const CACHE_NAME = 'pullsheet-v1.7';

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

  /*
    cache.addAll() is all-or-nothing — if even ONE request in the
    list fails (a flaky connection at the exact moment a new version
    installs, a transient CDN hiccup), the WHOLE batch is rejected
    and nothing gets cached under the new CACHE_NAME. Combined with
    activate() deleting the old cache regardless, that's a real
    failure mode: the device is left with an empty new cache and no
    old one to fall back to, so the next load can hit a script tag
    with nothing cached AND a failed network fetch — "Chart is not
    defined" / "JSZip is not defined", exactly the offline-reliability
    problem this service worker exists to prevent.

    Caching each file independently via allSettled means one bad
    fetch only loses that one file — everything else that DID
    succeed is still cached and still helps.
  */

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.error('SW install: could not cache', url, err);
            throw err;
          })
        )
      ).then((results) => {

        const failed = results.filter((r) => r.status === 'rejected').length;

        if (failed) {
          console.warn(`SW install: ${failed}/${APP_SHELL.length} app shell files failed to cache — the rest are still cached.`);
        }

      })
    )
  );

  self.skipWaiting();

});

self.addEventListener('activate', (event) => {

  /*
    If install ran during a near-total network outage, the new
    CACHE_NAME cache could be empty or nearly so (allSettled means
    it's rarely ALL 13 files, but a bad enough connection could still
    do it). Deleting every old cache unconditionally in that case
    would leave a device that was fine on the previous version with
    nothing cached at all the moment it's offline — the opposite of
    what this service worker is for. Only purge old caches once the
    new one actually has real content to fall back on.
  */

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.keys())
      .then((keys) => {

        if (!keys.length) {
          console.warn('SW activate: new cache is empty (install likely had no network) — keeping old cache(s) around instead of deleting them.');
          return;
        }

        return caches.keys().then((names) =>
          Promise.all(
            names
              .filter((n) => n !== CACHE_NAME)
              .map((n) => caches.delete(n))
          )
        );

      })
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
