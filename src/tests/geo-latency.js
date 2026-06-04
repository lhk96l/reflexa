/*!
 * REFLEXA — Advanced Network Diagnostic Tool
 * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.
 * Proprietary & Confidential. Unauthorized copying, modification, distribution,
 * reverse engineering, or reuse — in whole or in part — is strictly prohibited.
 * See LICENSE. "REFLEXA" is a trademark of Eng. Mohanad Al-Mothafer.
 */
// REFLEXA v3.0 — Global Latency Map
// Pings Cloudflare PoPs worldwide to build a latency heat map

export const GLOBAL_POPS = [
  // Middle East & Africa
  { city: 'Riyadh',       country: 'SA', code: 'RUH', colo: 'RUH', lat: 24.68, lon: 46.72, region: 'ME' },
  { city: 'Dubai',        country: 'AE', code: 'DXB', colo: 'DXB', lat: 25.25, lon: 55.36, region: 'ME' },
  { city: 'Kuwait City',  country: 'KW', code: 'KWI', colo: 'KWI', lat: 29.24, lon: 47.96, region: 'ME' },
  { city: 'Doha',         country: 'QA', code: 'DOH', colo: 'DOH', lat: 25.26, lon: 51.61, region: 'ME' },
  { city: 'Bahrain',      country: 'BH', code: 'BAH', colo: 'BAH', lat: 26.21, lon: 50.60, region: 'ME' },
  { city: 'Muscat',       country: 'OM', code: 'MCT', colo: 'MCT', lat: 23.60, lon: 58.59, region: 'ME' },
  { city: 'Amman',        country: 'JO', code: 'AMM', colo: 'AMM', lat: 31.72, lon: 35.99, region: 'ME' },
  { city: 'Cairo',        country: 'EG', code: 'CAI', colo: 'CAI', lat: 30.05, lon: 31.24, region: 'AF' },
  { city: 'Johannesburg', country: 'ZA', code: 'JNB', colo: 'JNB', lat: -26.13,lon: 28.21, region: 'AF' },
  // Europe
  { city: 'Frankfurt',    country: 'DE', code: 'FRA', colo: 'FRA', lat: 50.03, lon: 8.55,  region: 'EU' },
  { city: 'London',       country: 'GB', code: 'LHR', colo: 'LHR', lat: 51.47, lon: -0.45, region: 'EU' },
  { city: 'Paris',        country: 'FR', code: 'CDG', colo: 'CDG', lat: 49.01, lon: 2.55,  region: 'EU' },
  { city: 'Amsterdam',    country: 'NL', code: 'AMS', colo: 'AMS', lat: 52.31, lon: 4.76,  region: 'EU' },
  { city: 'Istanbul',     country: 'TR', code: 'IST', colo: 'IST', lat: 41.27, lon: 28.74, region: 'EU' },
  { city: 'Madrid',       country: 'ES', code: 'MAD', colo: 'MAD', lat: 40.47, lon: -3.56, region: 'EU' },
  // Americas
  { city: 'New York',     country: 'US', code: 'EWR', colo: 'EWR', lat: 40.69, lon: -74.17,region: 'US' },
  { city: 'Los Angeles',  country: 'US', code: 'LAX', colo: 'LAX', lat: 33.94, lon: -118.4,region: 'US' },
  { city: 'Chicago',      country: 'US', code: 'ORD', colo: 'ORD', lat: 41.97, lon: -87.91,region: 'US' },
  { city: 'Dallas',       country: 'US', code: 'DFW', colo: 'DFW', lat: 32.90, lon: -97.04,region: 'US' },
  { city: 'São Paulo',    country: 'BR', code: 'GRU', colo: 'GRU', lat: -23.43,lon: -46.47,region: 'SA' },
  // Asia Pacific
  { city: 'Singapore',    country: 'SG', code: 'SIN', colo: 'SIN', lat: 1.35,  lon: 103.99,region: 'AP' },
  { city: 'Tokyo',        country: 'JP', code: 'NRT', colo: 'NRT', lat: 35.76, lon: 140.38,region: 'AP' },
  { city: 'Hong Kong',    country: 'HK', code: 'HKG', colo: 'HKG', lat: 22.31, lon: 113.91,region: 'AP' },
  { city: 'Mumbai',       country: 'IN', code: 'BOM', colo: 'BOM', lat: 19.09, lon: 72.87, region: 'AP' },
  { city: 'Sydney',       country: 'AU', code: 'SYD', colo: 'SYD', lat: -33.94,lon: 151.18,region: 'AP' },
  { city: 'Seoul',        country: 'KR', code: 'ICN', colo: 'ICN', lat: 37.46, lon: 126.44,region: 'AP' },
];

// Cloudflare allows pinging their PoPs via the colo= response
const CF_TRACE = 'https://1.1.1.1/cdn-cgi/trace';

async function pingPop(colo) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      await fetch(`${CF_TRACE}?colo=${colo}&r=${Math.random()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      times.push(performance.now() - t0);
    } catch { /* timeout or unreachable */ }
  }
  if (times.length === 0) return null;
  times.sort((a, b) => a - b);
  return parseFloat(times[0].toFixed(1)); // best RTT
}

// Color scale: green (fast) → yellow → red (slow)
function latencyColor(ms) {
  if (!ms)       return '#4B5563';  // grey = unreachable
  if (ms < 50)   return '#10B981';  // green
  if (ms < 100)  return '#34D399';  // light green
  if (ms < 150)  return '#F59E0B';  // yellow
  if (ms < 250)  return '#F97316';  // orange
  return '#EF4444';                  // red
}

export async function runGeoLatency(onProgress) {
  const results = {};
  const total = GLOBAL_POPS.length;

  // Run in batches of 4 to avoid overwhelming the network
  for (let i = 0; i < total; i += 4) {
    const batch = GLOBAL_POPS.slice(i, i + 4);
    const batchResults = await Promise.all(
      batch.map(async (pop) => {
        const rtt = await pingPop(pop.colo);
        return { pop, rtt };
      })
    );

    batchResults.forEach(({ pop, rtt }) => {
      results[pop.code] = {
        ...pop,
        rtt,
        color: latencyColor(rtt),
        label: rtt ? `${rtt}ms` : 'Timeout',
      };
    });

    onProgress?.(Math.min(i + 4, total), total);
  }

  // Sort by RTT to find nearest servers
  const sorted = Object.values(results)
    .filter(r => r.rtt != null)
    .sort((a, b) => a.rtt - b.rtt);

  return {
    pops: results,
    nearest: sorted.slice(0, 5),
    farthest: sorted.slice(-3),
    avgGlobal: sorted.length > 0
      ? parseFloat((sorted.reduce((s, r) => s + r.rtt, 0) / sorted.length).toFixed(1))
      : null,
  };
}
