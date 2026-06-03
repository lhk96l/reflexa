// REFLEXA v3.3 — Service Worker
// Network-First للـ JS/HTML، Cache-First للـ Fonts/CDN، تحديث فوري

const VERSION = '3.4.0';
const CACHE   = `reflexa-v${VERSION}`;

const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

const BYPASS = [
  'speed.cloudflare.com', '1.1.1.1', 'ipapi.co',
  'icanhazip.com', 'cloudflare-dns.com', 'dns.google',
  'dns.quad9.net', 'dns.nextdns.io', 'dns.adguard-dns.com',
  'doh.opendns.com', 'stun.l.google.com', 'stun.cloudflare.com',
  'workers.dev',
  'lemonsqueezy.com', 'resend.com',
];

// INSTALL — تثبيت فوري بدون انتظار
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['./index.html', './manifest.json']).catch(() => {}))
  );
});

// ACTIVATE — حذف الكاشات القديمة + الاستيلاء الفوري على جميع الـ clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim()) // يُطبّق على جميع التبويبات المفتوحة فوراً
  );
});

// FETCH
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (BYPASS.some(h => url.href.includes(h))) return;

  // CDN — Cache-First (ثابتة ونادراً تتغير)
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        // استنسخ فوراً (متزامن) قبل أن يُقرأ الـ body
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  // كل ملفات التطبيق — Network-First (يضمن آخر نسخة دائماً)
  e.respondWith(
    fetch(req).then(res => {
      // استنسخ فوراً (متزامن) قبل return لتفادي "body already used"
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req).then(c => c || caches.match('./index.html'))
    )
  );
});

// MESSAGE — استقبال أوامر من التطبيق
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
