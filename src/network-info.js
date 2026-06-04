/*!
 * REFLEXA — Advanced Network Diagnostic Tool
 * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.
 * Proprietary & Confidential. Unauthorized copying, modification, distribution,
 * reverse engineering, or reuse — in whole or in part — is strictly prohibited.
 * See LICENSE. "REFLEXA" is a trademark of Eng. Mohanad Al-Mothafer.
 */
// REFLEXA v3.0 — Network Information Collector

const COLO_MAP = {
  DXB:'Dubai',AMS:'Amsterdam',LHR:'London',CDG:'Paris',FRA:'Frankfurt',
  JFK:'New York',EWR:'Newark',LAX:'Los Angeles',SIN:'Singapore',NRT:'Tokyo',
  SYD:'Sydney',HKG:'Hong Kong',BOM:'Mumbai',GRU:'São Paulo',YYZ:'Toronto',
  ICN:'Seoul',RUH:'Riyadh',KWI:'Kuwait City',DOH:'Doha',BAH:'Bahrain',
  MCT:'Muscat',AMM:'Amman',CAI:'Cairo',IST:'Istanbul',MAD:'Madrid',
  BCN:'Barcelona',ZRH:'Zurich',VIE:'Vienna',WAW:'Warsaw',DME:'Moscow',
  ATL:'Atlanta',ORD:'Chicago',DFW:'Dallas',MIA:'Miami',SEA:'Seattle',
  SJC:'San Jose',IAD:'Washington DC',JNB:'Johannesburg',
};

export async function collectNetworkInfo() {
  const info = {
    ip: null, isp: null, org: null, asn: null,
    city: null, country: null, countryCode: null, flag: null,
    lat: null, lon: null,
    colo: null, coloCity: null,
    tls: null, http: null, warp: null,
    connection: null, effectiveType: null, downlink: null,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    platform: navigator.platform || '',
  };

  // ── Cloudflare trace (fast, reliable) ─────────────────────────
  try {
    const r = await fetch('https://1.1.1.1/cdn-cgi/trace', { cache: 'no-store' });
    const text = await r.text();
    const get = k => (text.match(new RegExp(k + '=(.+)')) || [])[1] || null;

    info.ip     = get('ip');
    info.colo   = get('colo');
    info.coloCity = COLO_MAP[info.colo] || info.colo;
    info.tls    = get('tls');
    info.http   = get('http');
    info.warp   = get('warp') === 'on';

    if (get('loc')) {
      info.countryCode = get('loc');
      info.flag = getFlag(info.countryCode);
    }
  } catch { /* continue */ }

  // ── ipapi.co (ISP + geo details) ──────────────────────────────
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch('https://ipapi.co/json/', { cache: 'no-store', signal: ctrl.signal });
    const d = await r.json();

    if (d.org)      info.isp = d.org.replace(/^AS\d+\s*/, '');
    if (d.asn)      info.asn = d.asn;
    if (d.city)     info.city = d.city;
    if (d.country_name) info.country = d.country_name;
    if (d.country_code) info.countryCode = d.country_code;
    if (d.latitude) info.lat = d.latitude;
    if (d.longitude) info.lon = d.longitude;
    if (d.country_code) info.flag = getFlag(d.country_code);

    // Detect VPN/proxy
    info.proxy    = d.proxy || false;
    info.vpn      = d.vpn || false;
    info.hosting  = d.hosting || false;
  } catch { /* continue */ }

  // ── Network API ───────────────────────────────────────────────
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    info.connection    = conn.type || null;
    info.effectiveType = conn.effectiveType?.toUpperCase() || null;
    info.downlink      = conn.downlink || null;
    info.rtt           = conn.rtt || null;
    info.saveData      = conn.saveData || false;
  }

  // Guess connection type if API not available
  if (!info.connection) {
    info.connection = 'WiFi / Ethernet';
  }

  return info;
}

function getFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

export function formatConnectionType(info) {
  const parts = [];
  if (info.effectiveType) parts.push(info.effectiveType);
  if (info.connection && info.connection !== info.effectiveType) parts.push(info.connection);
  if (info.downlink) parts.push(`${info.downlink} Mbps`);
  return parts.join(' · ') || '—';
}
