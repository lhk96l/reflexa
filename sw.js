// REFLEXA Service Worker v2.0.0
// By Eng. Mohanad Al-Mothafer | ICT-Lead

const CACHE_NAME    = 'reflexa-v2.0.0';
const SHELL_CACHE   = 'reflexa-shell-v2';
const DYNAMIC_CACHE = 'reflexa-dynamic-v2';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Tajawal:wght@300;400;500;700;800;900&display=swap',
];

// ── INSTALL: cache app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      await shellCache.addAll(SHELL_ASSETS);

      // Cache CDN assets (non-critical, ignore failures)
      const dynCache = await caches.open(DYNAMIC_CACHE);
      await Promise.allSettled(
        CDN_ASSETS.map(url => dynCache.add(url).catch(() => null))
      );

      await self.skipWaiting();
    })()
  );
});

// ── ACTIVATE: clean old caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name !== SHELL_CACHE && name !== DYNAMIC_CACHE)
          .map(name => caches.delete(name))
      );
      await clients.claim();
    })()
  );
});

// ── FETCH: cache-first for shell, network-first for speed test ────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Cloudflare speed test requests
  if (url.hostname === 'speed.cloudflare.com' ||
      url.hostname === '1.1.1.1' ||
      url.hostname === 'api.ipify.org') {
    return; // Let browser handle directly
  }

  // Shell assets: cache-first
  if (SHELL_ASSETS.some(a => event.request.url.endsWith(a.replace('./', '')))) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // CDN & fonts: cache-first with network fallback
  if (url.hostname.includes('googleapis') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('gstatic')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(DYNAMIC_CACHE).then(c => c.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(cached => cached || caches.match('./index.html'))
    )
  );
});
