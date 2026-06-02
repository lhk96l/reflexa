// REFLEXA v3.0 — License Validator
// Primary: Server-side validation via Cloudflare Worker (authoritative)
// Fallback: Local HMAC validation (offline support)

const WORKER = 'https://reflexa-license.hanodeking15.workers.dev';

function enc(s) { return new TextEncoder().encode(s); }
function _S() {
  const f = ['RFX3_K9p', '#mZw_202', '5_License', 'Key_REFLE', 'XA_v3_SEC', 'URE_48cha', 'rs!'];
  return f.reduce((a, b) => a + b, '');
}
async function hmacHex(data, secret) {
  const k = await crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, enc(data));
  return Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const license = {

  // التحقق عبر الـ Worker أولاً (الأدق والأأمن)
  async validate(key) {
    if (!key) return { valid: false, reason: 'No key' };
    const clean = key.trim().toUpperCase().replace(/\s/g, '');
    if (!clean.startsWith('RXFLX-')) return { valid: false, reason: 'Invalid format' };

    // Server validation (primary)
    try {
      const res = await fetch(`${WORKER}/api/validate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: clean }),
        signal:  AbortSignal.timeout(6000),
      });
      const data = await res.json();
      if (data.valid !== undefined) return data;
    } catch { /* offline — use local fallback */ }

    // Local HMAC fallback (offline)
    return this._local(clean);
  },

  async _local(clean) {
    const parts = clean.slice(6).split('-');
    if (parts.length !== 4) return { valid: false, reason: 'Invalid format' };
    const [expiry, eHash, features, checksum] = parts;
    const expected = (await hmacHex(`${expiry}-${eHash}-${features}`, _S())).slice(0, 8).toUpperCase();
    if (checksum !== expected) return { valid: false, reason: 'Invalid signature' };
    const expiryMs = parseInt(expiry, 36);
    if (isNaN(expiryMs) || Date.now() > expiryMs) return { valid: false, reason: 'Key expired' };
    const bits = parseInt(features, 36);
    return {
      valid: true,
      expiry: new Date(expiryMs).toLocaleDateString(),
      features: { unlimited: !!(bits&1), export: !!(bits&2), history30: !!(bits&4), advanced: !!(bits&8) },
    };
  },

  isLegacyKey(key) {
    return /^REFLEXA-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key.trim());
  },

  looksValid(key) {
    return /^RXFLX-/i.test(key.trim()) && key.trim().length > 20;
  },
};
