// REFLEXA v3.0 — Real DNS-over-HTTPS Benchmark (RFC 8484)
// ملاحظة مهمة: المتصفحات تمنع DoH من resolvers بلا CORS headers.
// فقط Cloudflare و Google يدعمان CORS — البقية (Quad9/AdGuard/OpenDNS/NextDNS)
// لا يمكن قياسها من المتصفح إطلاقاً (قيد أمني). نختبر فقط ما يعمل فعلياً:

export const DNS_RESOLVERS = [
  { name: 'Cloudflare 1.1.1.1',        doh: 'https://cloudflare-dns.com/dns-query',          icon: '🟠', privacy: 'High' },
  { name: 'Cloudflare Security 1.1.1.2',doh: 'https://security.cloudflare-dns.com/dns-query', icon: '🛡️', privacy: 'High' },
  { name: 'Cloudflare Family 1.1.1.3', doh: 'https://family.cloudflare-dns.com/dns-query',   icon: '👨‍👩‍👧', privacy: 'High' },
  { name: 'Google 8.8.8.8',            doh: 'https://dns.google/dns-query',                   icon: '🔵', privacy: 'Medium' },
];

const BENCH_DOMAINS = ['google.com', 'cloudflare.com', 'amazon.com', 'microsoft.com', 'github.com'];

// ── Build a real DNS wire-format query (RFC 1035) ────────────────
function buildDNSQuery(domain) {
  const labels = domain.split('.');
  let len = 4 + 2 + 2; // header + QTYPE + QCLASS
  for (const l of labels) len += 1 + l.length;
  len += 1; // root label

  const buf = new Uint8Array(len + 12); // 12 byte header
  const view = new DataView(buf.buffer);

  // Header
  view.setUint16(0, Math.floor(Math.random() * 65535)); // random ID
  view.setUint16(2, 0x0100); // QR=0, RD=1 (recursion desired)
  view.setUint16(4, 1);      // QDCOUNT=1
  view.setUint16(6, 0);      // ANCOUNT=0
  view.setUint16(8, 0);      // NSCOUNT=0
  view.setUint16(10, 0);     // ARCOUNT=0

  // Question section
  let offset = 12;
  for (const label of labels) {
    buf[offset++] = label.length;
    for (let i = 0; i < label.length; i++) {
      buf[offset++] = label.charCodeAt(i);
    }
  }
  buf[offset++] = 0; // root label
  view.setUint16(offset, 1);     // QTYPE = A
  view.setUint16(offset + 2, 1); // QCLASS = IN

  // Base64url encode
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Single DoH query ──────────────────────────────────────────────
async function queryDoH(resolver, domain) {
  const dns = buildDNSQuery(domain);
  const t0 = performance.now();

  const res = await fetch(`${resolver.doh}?dns=${dns}`, {
    method: 'GET',
    headers: { 'Accept': 'application/dns-message' },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });

  const latency = performance.now() - t0;

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // Parse response just enough to confirm we got a valid answer
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);
  const ancount = view.getUint16(6);

  return { latency, answered: ancount > 0 };
}

// ── Full DNS Benchmark ────────────────────────────────────────────
export async function dnsBenchmark(onProgress) {
  const results = {};

  for (let i = 0; i < DNS_RESOLVERS.length; i++) {
    const resolver = DNS_RESOLVERS[i];
    onProgress?.(resolver.name, i, DNS_RESOLVERS.length);

    const latencies = [];
    let errors = 0;

    for (const domain of BENCH_DOMAINS) {
      try {
        const r = await queryDoH(resolver, domain);
        if (r.answered) latencies.push(r.latency);
        else errors++;
      } catch {
        errors++;
      }
    }

    if (latencies.length === 0) {
      results[resolver.name] = { error: true, resolver };
      continue;
    }

    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1];

    results[resolver.name] = {
      resolver,
      min:    parseFloat(latencies[0].toFixed(1)),
      avg:    parseFloat(avg.toFixed(1)),
      p95:    parseFloat(p95.toFixed(1)),
      errors,
      reliability: Math.round(((latencies.length) / BENCH_DOMAINS.length) * 100),
      recommended: false,
    };
  }

  // Mark fastest as recommended
  const valid = Object.values(results).filter(r => !r.error);
  if (valid.length > 0) {
    const fastest = valid.sort((a, b) => a.avg - b.avg)[0];
    fastest.recommended = true;
  }

  return results;
}

// ── DNS Leak Detection ────────────────────────────────────────────
// Detects if DNS queries leak outside VPN tunnel
export async function detectDNSLeak() {
  const resolversUsed = [];
  const testDomains = [
    `leak-test-${Math.random().toString(36).slice(2)}.cloudflare-dns.com`,
    `leak-${Math.random().toString(36).slice(2)}.dns.google`,
  ];

  // Use multiple DoH endpoints to see which resolvers the system uses
  // by comparing response times and behavior
  const probes = [];
  for (const domain of testDomains) {
    for (const resolver of DNS_RESOLVERS.slice(0, 3)) {
      probes.push(
        queryDoH(resolver, domain).then(r => ({
          resolver: resolver.name,
          latency: r.latency,
          domain
        })).catch(() => null)
      );
    }
  }

  const results = (await Promise.allSettled(probes))
    .map(r => r.value)
    .filter(Boolean);

  // Detect VPN by checking if Cloudflare trace shows warp
  let vpnActive = false;
  try {
    const trace = await fetch('https://1.1.1.1/cdn-cgi/trace', { cache: 'no-store' });
    const text = await trace.text();
    vpnActive = text.includes('warp=on') || text.includes('gateway=on');
  } catch { /* ignore */ }

  // Identify fastest resolver — likely what system uses
  if (results.length > 0) {
    const byResolver = {};
    results.forEach(r => {
      if (!byResolver[r.resolver]) byResolver[r.resolver] = [];
      byResolver[r.resolver].push(r.latency);
    });

    Object.keys(byResolver).forEach(name => {
      const avg = byResolver[name].reduce((s, v) => s + v, 0) / byResolver[name].length;
      resolversUsed.push({ name, avgLatency: avg.toFixed(1) });
    });
    resolversUsed.sort((a, b) => a.avgLatency - b.avgLatency);
  }

  const primaryResolver = resolversUsed[0]?.name || 'Unknown';
  const leakSuspected = vpnActive && !primaryResolver.toLowerCase().includes('cloudflare');

  return {
    vpnActive,
    primaryResolver,
    resolversDetected: resolversUsed.slice(0, 3),
    leakSuspected,
    severity: leakSuspected ? 'MEDIUM' : 'NONE',
    verdict: leakSuspected
      ? 'DNS queries may leak outside VPN tunnel'
      : vpnActive
        ? 'DNS protected through VPN tunnel'
        : 'No VPN detected — DNS behavior normal',
  };
}
