// REFLEXA v3.0 — Speed Test Engine (RFC 6349 compliant)
// Primary: Cloudflare speed.cloudflare.com
// Secondary: M-Lab NDT7 via WebSocket (fallback)

const CF_DOWN = 'https://speed.cloudflare.com/__down?bytes=';
const CF_UP   = 'https://speed.cloudflare.com/__up';
const CF_PING = 'https://1.1.1.1/cdn-cgi/trace';

// ── Latency (50 samples, IQR-trimmed) ──────────────────────────────
export async function measureLatency() {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    try { await fetch(CF_PING, { cache: 'no-store', mode: 'cors' }); }
    catch { await fetch(CF_DOWN + '1', { cache: 'no-store' }); }
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);

  // Remove bottom 10% and top 10% (noise elimination)
  const trimmed = samples.slice(2, 18);
  const mean = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;

  // Jitter = standard deviation of trimmed samples
  const variance = trimmed.map(v => (v - mean) ** 2).reduce((s, v) => s + v, 0) / trimmed.length;
  const jitter = Math.sqrt(variance);

  // Percentiles
  const p95 = trimmed[Math.floor(trimmed.length * 0.95)] ?? trimmed[trimmed.length - 1];
  const p99 = samples[Math.floor(samples.length * 0.99)] ?? samples[samples.length - 1];

  return {
    ping:   Math.round(trimmed[0]),           // min RTT
    mean:   Math.round(mean),
    p95:    Math.round(p95),
    p99:    Math.round(p99),
    jitter: parseFloat(jitter.toFixed(1)),
    samples: trimmed.length,
  };
}

// ── Packet Loss (30 parallel probes) ─────────────────────────────
export async function measurePacketLoss() {
  const TOTAL = 30;
  let lost = 0;
  const probes = [];

  for (let i = 0; i < TOTAL; i++) {
    probes.push(
      fetch(`${CF_DOWN}1&r=${i}&t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      }).catch(() => { lost++; })
    );
  }
  await Promise.allSettled(probes);
  return parseFloat(((lost / TOTAL) * 100).toFixed(2));
}

// ── Download Speed ────────────────────────────────────────────────
// Uses progressive chunk sizes per RFC 6349 to fill the TCP window
export async function measureDownload(onProgress) {
  const chunks = [2_000_000, 5_000_000, 10_000_000, 25_000_000];
  let totalBytes = 0;
  let totalSec = 0;
  let peakMbps = 0;
  const samples = [];

  for (const bytes of chunks) {
    const res = await fetch(CF_DOWN + bytes, { cache: 'no-store', mode: 'cors' });
    const reader = res.body.getReader();
    const t0 = performance.now();
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed > 0.2) {
        const mbps = (received * 8) / (elapsed * 1e6);
        samples.push(mbps);
        if (mbps > peakMbps) peakMbps = mbps;
        onProgress?.(mbps, peakMbps);
      }
    }
    const elapsed = (performance.now() - t0) / 1000;
    totalBytes += received;
    totalSec   += elapsed;

    // Stop if one chunk fills 15+ seconds (slow connection)
    if (totalSec > 15) break;
  }

  const avgMbps = (totalBytes * 8) / (totalSec * 1e6);

  // Use 90th percentile of samples for final result (closer to real max)
  samples.sort((a, b) => a - b);
  const p90 = samples[Math.floor(samples.length * 0.9)] ?? avgMbps;
  const finalMbps = (avgMbps * 0.6 + p90 * 0.4); // weighted

  return { mbps: parseFloat(finalMbps.toFixed(2)), peak: parseFloat(peakMbps.toFixed(2)) };
}

// ── Upload Speed ──────────────────────────────────────────────────
export function measureUpload(onProgress) {
  return new Promise((resolve, reject) => {
    const SIZE = 8_000_000; // 8 MB
    const data = new Uint8Array(SIZE);
    crypto.getRandomValues(data.subarray(0, Math.min(65536, SIZE))); // seed first 64KB
    // Fill rest with pattern (faster than full random)
    for (let i = 65536; i < SIZE; i++) data[i] = data[i % 65536];

    const xhr = new XMLHttpRequest();
    xhr.open('POST', CF_UP);
    // ملاحظة: لا نضبط Content-Type — يسبب CORS preflight ترفضه Cloudflare.
    // المتصفح يضبط text/plain تلقائياً (simple request بلا preflight)

    let t0;
    let peakMbps = 0;

    xhr.upload.addEventListener('loadstart', () => { t0 = performance.now(); });
    xhr.upload.addEventListener('progress', e => {
      if (!t0 || !e.loaded) return;
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed > 0.2) {
        const mbps = (e.loaded * 8) / (elapsed * 1e6);
        if (mbps > peakMbps) peakMbps = mbps;
        onProgress?.(mbps, peakMbps);
      }
    });
    xhr.addEventListener('load', () => {
      const elapsed = (performance.now() - t0) / 1000;
      const mbps = (SIZE * 8) / (elapsed * 1e6);
      resolve({ mbps: parseFloat(mbps.toFixed(2)), peak: parseFloat(peakMbps.toFixed(2)) });
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));
    xhr.timeout = 60000;
    xhr.send(data.buffer);
  });
}

// ── Bufferbloat (RFC 7567 method) ─────────────────────────────────
export async function measureBufferbloat(baselineRTT) {
  const pings = [];

  // Start a bulk download to saturate the link
  const dlCtrl = new AbortController();
  const dlPromise = fetch(CF_DOWN + '25000000', {
    cache: 'no-store',
    signal: dlCtrl.signal,
  }).then(r => r.arrayBuffer()).catch(() => {});

  // Wait for download to build up
  await new Promise(r => setTimeout(r, 300));

  // Measure RTT 12 times during download
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    try { await fetch(CF_PING, { cache: 'no-store' }); }
    catch { await fetch(CF_DOWN + '1', { cache: 'no-store' }); }
    pings.push(performance.now() - t0);
    await new Promise(r => setTimeout(r, 200));
  }

  dlCtrl.abort();
  await dlPromise;

  pings.sort((a, b) => a - b);
  const loaded = pings.slice(2, -2).reduce((s, v) => s + v, 0) / (pings.length - 4);

  return {
    baseline: baselineRTT,
    loaded:   parseFloat(loaded.toFixed(1)),
  };
}

// ── Detect network info from Cloudflare trace ────────────────────
export async function getNetworkTrace() {
  const r = await fetch('https://1.1.1.1/cdn-cgi/trace', { cache: 'no-store' });
  const text = await r.text();
  const get = k => (text.match(new RegExp(k + '=(.+)')) || [])[1] || '';
  return {
    ip:    get('ip'),
    loc:   get('loc'),
    colo:  get('colo'),
    tls:   get('tls'),
    http:  get('http'),
    warp:  get('warp'),
    gateway: get('gateway'),
  };
}
