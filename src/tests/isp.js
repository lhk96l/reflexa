/*!
 * REFLEXA — Advanced Network Diagnostic Tool
 * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.
 * Proprietary & Confidential. Unauthorized copying, modification, distribution,
 * reverse engineering, or reuse — in whole or in part — is strictly prohibited.
 * See LICENSE. "REFLEXA" is a trademark of Eng. Mohanad Al-Mothafer.
 */
// REFLEXA v3.0 — ISP Throttling Detection
// Compares speeds to different CDN endpoints to detect content-based throttling

const TARGETS = [
  {
    name: 'Cloudflare CDN',
    url: 'https://speed.cloudflare.com/__down?bytes=5000000',
    type: 'cdn',
    icon: '🟠',
  },
  {
    name: 'Google CDN',
    url: 'https://www.gstatic.com/generate_204',
    type: 'neutral',
    icon: '🔵',
    isSmall: true,
  },
  {
    name: 'jsDelivr CDN',
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
    type: 'cdn',
    icon: '🟣',
  },
  {
    name: 'npm CDN',
    url: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
    type: 'cdn',
    icon: '🟢',
  },
  {
    name: 'Cloudflare R2',
    url: 'https://speed.cloudflare.com/__down?bytes=3000000',
    type: 'storage',
    icon: '⚪',
  },
];

async function measureEndpointSpeed(target, timeoutMs = 15000) {
  try {
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    const res = await fetch(target.url, {
      cache: 'no-store',
      signal: ctrl.signal,
    });

    if (target.isSmall) {
      await res.text();
      clearTimeout(timer);
      const elapsed = (performance.now() - t0) / 1000;
      const size = parseInt(res.headers.get('content-length') || '204');
      return { mbps: (size * 8) / (elapsed * 1e6), ttfb: elapsed * 1000 };
    }

    const reader = res.body.getReader();
    let received = 0;
    const speedSamples = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed > 0.5) speedSamples.push((received * 8) / (elapsed * 1e6));
    }

    clearTimeout(timer);
    const totalElapsed = (performance.now() - t0) / 1000;
    const mbps = (received * 8) / (totalElapsed * 1e6);
    speedSamples.sort((a, b) => a - b);
    const medianSample = speedSamples[Math.floor(speedSamples.length * 0.7)] ?? mbps;

    return {
      mbps: parseFloat((mbps * 0.5 + medianSample * 0.5).toFixed(2)),
      ttfb: parseFloat((totalElapsed * 1000 / received * 100).toFixed(1)),
      bytes: received,
    };
  } catch {
    return null;
  }
}

export async function detectThrottling(onProgress) {
  const results = {};

  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i];
    onProgress?.(target.name, i, TARGETS.length);
    const r = await measureEndpointSpeed(target);
    results[target.name] = { ...target, result: r };
  }

  // Statistical analysis
  const speeds = Object.values(results)
    .map(r => r.result?.mbps)
    .filter(v => v != null && v > 0);

  if (speeds.length < 2) {
    return {
      results,
      throttlingDetected: false,
      confidence: 'LOW',
      reason: 'Insufficient data points',
      variancePct: 0,
      throttledServices: [],
      verdict: 'Unable to determine — insufficient data',
    };
  }

  speeds.sort((a, b) => a - b);
  const median = speeds[Math.floor(speeds.length / 2)];
  const max    = speeds[speeds.length - 1];
  const min    = speeds[0];
  const variancePct = ((max - min) / max) * 100;

  // Services with speed < 50% of max are likely throttled
  const throttledServices = Object.entries(results)
    .filter(([, r]) => r.result?.mbps && r.result.mbps < max * 0.5)
    .map(([name]) => name);

  const throttlingDetected = variancePct > 35 && throttledServices.length > 0;
  const confidence = variancePct > 60 ? 'HIGH' : variancePct > 35 ? 'MEDIUM' : 'LOW';

  let verdict;
  if (throttlingDetected && confidence === 'HIGH') {
    verdict = `ISP throttling detected for: ${throttledServices.join(', ')}. Consider using a VPN or contacting your ISP.`;
  } else if (throttlingDetected) {
    verdict = 'Possible throttling detected — speed variance is significant across CDN providers.';
  } else {
    verdict = 'No throttling detected — all content types receive similar bandwidth treatment.';
  }

  return {
    results,
    throttlingDetected,
    confidence,
    variancePct: variancePct.toFixed(1),
    maxSpeed: max.toFixed(1),
    minSpeed: min.toFixed(1),
    medianSpeed: median.toFixed(1),
    throttledServices,
    verdict,
    recommendation: throttlingDetected
      ? ['Use a VPN to bypass ISP throttling', 'Test at different times of day', 'Contact your ISP to report throttling']
      : null,
  };
}
