// REFLEXA v3.0 — Protocol & Security Analysis
// HTTP/2, HTTP/3 (QUIC), TLS version, HSTS, IPv6

// ── HTTP Protocol Detection via Performance API ───────────────────
function detectProtocolFromPerf() {
  const entries = performance.getEntriesByType('resource');
  const protocols = new Set();
  entries.forEach(e => { if (e.nextHopProtocol) protocols.add(e.nextHopProtocol); });
  return protocols;
}

export async function detectHTTPProtocol() {
  // نستخدم فقط مضيفات مسموحة في CSP (speed.cloudflare.com + 1.1.1.1)
  const testUrl = 'https://speed.cloudflare.com/__down?bytes=1';
  let cfProtocol = null;

  try {
    await fetch(testUrl, { cache: 'no-store' });
    await new Promise(r => setTimeout(r, 100));
    const entries = performance.getEntriesByName(testUrl, 'resource');
    if (entries.length > 0) {
      cfProtocol = entries[entries.length - 1].nextHopProtocol;
    }
  } catch { /* ignore */ }

  // Also check the current page protocol
  const allProtocols = detectProtocolFromPerf();

  const http2  = allProtocols.has('h2')  || cfProtocol === 'h2';
  const http3  = allProtocols.has('h3')  || cfProtocol === 'h3';

  // Get actual protocol from Cloudflare trace (most reliable)
  let cfHttp = cfProtocol;
  try {
    const r = await fetch('https://1.1.1.1/cdn-cgi/trace', { cache: 'no-store' });
    const text = await r.text();
    const httpMatch = text.match(/http=(.+)/);
    if (httpMatch) cfHttp = httpMatch[1];
  } catch { /* ignore */ }

  return {
    http2:  http2  || cfHttp === 'http/2',
    http3:  http3  || cfHttp === 'http/3',
    http11: !http2 && !http3,
    protocol: cfHttp || (http3 ? 'h3' : http2 ? 'h2' : 'http/1.1'),
    detected: [...allProtocols],
  };
}

// ── HTTP/3 (QUIC) Support via Performance API ─────────────────────
export async function detectHTTP3Support() {
  // ملاحظة: لا نطلب cloudflare.com/google.com مباشرة (CSP + no-cors يمنع قراءة headers)
  // نعتمد على Performance API + نتيجة trace من detectHTTPProtocol
  const protocols = detectProtocolFromPerf();
  const h3Supported = protocols.has('h3');
  const altSvcValues = [];

  return { supported: h3Supported, altSvc: altSvcValues[0] || null };
}

// ── TLS Version Detection ─────────────────────────────────────────
export async function detectTLS() {
  // Get from Cloudflare trace (most reliable source)
  let tlsVersion = null;
  let cipher = null;

  try {
    const r = await fetch('https://1.1.1.1/cdn-cgi/trace', { cache: 'no-store' });
    const text = await r.text();
    const tlsMatch = text.match(/tls=(.+)/);
    if (tlsMatch) tlsVersion = tlsMatch[1];
  } catch { /* ignore */ }

  // Determine from Performance API (secureConnectionStart timing)
  const perf = performance.getEntriesByType('resource');
  const secure = perf.filter(e => e.nextHopProtocol === 'h2' || e.nextHopProtocol === 'h3');
  const hasTLS = secure.length > 0 || location.protocol === 'https:';

  // If we got h3 from Cloudflare, it's TLS 1.3 (QUIC requires it)
  const tls13Likely = tlsVersion === 'TLSv1.3' || detectProtocolFromPerf().has('h3');

  return {
    version:   tlsVersion || (tls13Likely ? 'TLSv1.3' : hasTLS ? 'TLS' : 'None'),
    tls13:     tls13Likely,
    tls12:     tlsVersion === 'TLSv1.2',
    encrypted: hasTLS,
    cipher:    cipher || 'Not accessible (browser security)',
  };
}

// ── HSTS Check ────────────────────────────────────────────────────
export function detectHSTS() {
  // We can't read response headers due to CORS for cross-origin
  // But we can check if the browser enforces HTTPS for known preloaded domains
  const preloaded = ['google.com', 'facebook.com', 'github.com', 'cloudflare.com'];
  return {
    browserEnforces: location.protocol === 'https:',
    // Actual HSTS header requires server-side check
    note: 'HSTS header verification requires server-side access',
  };
}

// ── IPv6 Connectivity ─────────────────────────────────────────────
export async function checkIPv6() {
  const endpoints = [
    'https://ipv6.icanhazip.com/',
    'https://v6.ident.me/',
  ];

  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const ip = (await r.text()).trim();
        return { supported: true, address: ip };
      }
    } catch { /* try next */ }
  }

  return { supported: false, address: null };
}

// ── Full Protocol Report ──────────────────────────────────────────
export async function runProtocolAnalysis() {
  const [http, h3, tls, ipv6] = await Promise.all([
    detectHTTPProtocol(),
    detectHTTP3Support(),
    detectTLS(),
    checkIPv6(),
  ]);

  // Merge HTTP/3 detection results
  http.http3 = http.http3 || h3.supported;

  // Calculate protocol score
  let score = 0;
  if (http.http3)     score += 30; // HTTP/3 = excellent
  else if (http.http2) score += 20; // HTTP/2 = good
  if (tls.tls13)       score += 25; // TLS 1.3 = excellent
  else if (tls.encrypted) score += 15; // TLS = good
  if (ipv6.supported)  score += 25; // IPv6 = future-ready
  score += 20; // base score for having any connection

  return {
    http,
    tls,
    ipv6,
    score: Math.min(100, score),
    grade: score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D',
    summary: [
      { label: 'HTTP Protocol', value: http.http3 ? 'HTTP/3 (QUIC)' : http.http2 ? 'HTTP/2' : 'HTTP/1.1', ok: http.http2 || http.http3 },
      { label: 'TLS Version',   value: tls.version, ok: tls.tls13 },
      { label: 'IPv6 Support',  value: ipv6.supported ? `Active (${ipv6.address})` : 'Not Available', ok: ipv6.supported },
      { label: 'Encryption',    value: tls.encrypted ? 'HTTPS Encrypted' : 'Unencrypted', ok: tls.encrypted },
    ],
  };
}
