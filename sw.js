// REFLEXA v3.2 — Service Worker
// استراتيجية: Network-First للـ JS/HTML، Cache-First للـ Fonts/CDN فقط

const VERSION = '3.2.0';
const CACHE   = `reflexa-v${VERSION}`;

const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

const BYPASS = [
  'speed.cloudflare.com', '1.1.1.1', 'ipapi.co',
  'icanhazip.com', 'cloudflare-dns.com', 'dns.google',
  'dns.quad9.net', 'dns.nextdns.io', 'dns.adguard-dns.com',
  'doh.opendns.com', 'stun.l.google.com', 'stun.cloudflare.com',
  'reflexa-license.hanodeking15.workers.dev',
  'lemonsqueezy.com', 'resend.com',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['./index.html', './manifest.json'])
        .catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (BYPASS.some(h => url.href.includes(h))) return;

  // CDN (fonts, chart.js) — Cache-First
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }))
    );
    return;
  }

  // كل ملفات التطبيق (HTML, JS, JSON) — Network-First دائماً
  // يضمن أن المستخدم يحصل على آخر نسخة في كل مرة
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() =>
      caches.match(req).then(cached => cached || caches.match('./index.html'))
    )
  );
});
