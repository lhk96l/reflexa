// REFLEXA v3.0 — Professional Service Worker
// Strategy: Cache-First for shell, Network-First for test endpoints

const VERSION     = '3.1.0';
const SHELL_CACHE = `reflexa-shell-v${VERSION}`;
const CDN_CACHE   = `reflexa-cdn-v${VERSION}`;
const OLD_PATTERN = /^reflexa-(shell|cdn|dynamic|v\d)-/;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/app.js',
  './src/i18n.js',
  './src/storage.js',
  './src/license.js',
  './src/standards.js',
  './src/network-info.js',
  './src/report.js',
  './src/tests/speed.js',
  './src/tests/dns.js',
  './src/tests/webrtc.js',
  './src/tests/isp.js',
  './src/tests/protocol.js',
  './src/tests/geo-latency.js',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Tajawal:wght@300;400;500;700;800;900&display=swap',
];

// Never intercept speed test / diagnostic endpoints
const BYPASS_PATTERNS = [
  'speed.cloudflare.com',
  '1.1.1.1',
  'ipapi.co',
  'icanhazip.com',
  'ident.me',
  'cloudflare-dns.com/dns-query',
  'dns.google/dns-query',
  'dns.quad9.net/dns-query',
  'dns.nextdns.io/dns-query',
  'dns.adguard-dns.com/dns-query',
  'doh.opendns.com/dns-query',
  'stun.l.google.com',
  'stun.cloudflare.com',
  'ndt-',
  'measurement-lab.org',
];

function shouldBypass(url) {
  return BYPASS_PATTERNS.some(p => url.href.includes(p));
}

// ── INSTALL ───────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        SHELL_ASSETS.map(url =>
          shell.add(url).catch(e => console.warn('[SW] Shell miss:', url, e.message))
        )
      );

      const cdn = await caches.open(CDN_CACHE);
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          cdn.add(url).catch(e => console.warn('[SW] CDN miss:', url, e.message))
        )
      );

      await self.skipWaiting();
    })()
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => OLD_PATTERN.test(k) && k !== SHELL_CACHE && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      );
      await clients.claim();
    })()
  );
});

// ── FETCH ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (shouldBypass(url)) return;

  // Shell assets (our own files): Cache-First with network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) {
            caches.open(SHELL_CACHE).then(c => c.put(req, res.clone()));
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // CDN assets: Cache-First
  if (url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('jsdelivr')) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) {
            caches.open(CDN_CACHE).then(c => c.put(req, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else: Network-First
  event.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then(cached => cached || caches.match('./index.html'))
    )
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: VERSION });
  }
});
