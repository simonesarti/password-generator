/*
 * Service worker: makes the site work offline.
 *
 * Strategy: network first, cache as fallback. Online visitors always get
 * the latest version (and the cache is refreshed as they browse); offline
 * visitors get the last copy they loaded. Only this site's own files are
 * handled; there is nothing else to fetch.
 */
'use strict';

const CACHE = 'pwg-v1';
const PRECACHE = [
  './',
  'index.html',
  'favicon.svg',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/js/theme.js',
  'assets/js/wordlist.js',
  'assets/js/generator.js',
  'assets/js/app.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./');
        return Response.error();
      })
  );
});
