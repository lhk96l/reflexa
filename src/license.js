// REFLEXA v3.0 — HMAC-SHA256 License Validation (no server required)
// Key format: RXFLX-XXXXXX-XXXXXX-XXXXXX-XX (28 chars after prefix)

function enc(s) { return new TextEncoder().encode(s); }

// Secret derived at runtime — never stored as a plain string
function deriveSecret() {
  const p = ['RXF', 'LX3', '_S3C', 'R3T_', '2025_', 'K3Y'];
  return [p[2], p[0], p[4], p[3], p[1], p[5]].join('').split('').reverse().join('');
}

async function hmac(data) {
  const key = await crypto.subtle.importKey(
    'raw', enc(deriveSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const license = {
  // Validate a Pro license key
  async validate(key) {
    if (!key) return { valid: false, reason: 'No key provided' };
    const clean = key.trim().toUpperCase().replace(/\s/g, '');

    // Format: RXFLX-[payload]-[checksum 4 chars]
    if (!clean.startsWith('RXFLX-')) return { valid: false, reason: 'Invalid prefix' };

    const body = clean.slice(6); // Remove "RXFLX-"
    const parts = body.split('-');
    if (parts.length < 3) return { valid: false, reason: 'Invalid format' };

    // Last part is 4-char checksum, rest is payload
    const checksum = parts[parts.length - 1];
    const payload = parts.slice(0, -1).join('-');

    // Compute expected checksum
    const expected = (await hmac(payload + deriveSecret())).slice(0, 4).toUpperCase();
    if (!constantTimeEq(checksum, expected)) return { valid: false, reason: 'Invalid signature' };

    // Decode payload: base-36 expiry encoded in first segment
    try {
      const expiry = parseInt(parts[0], 36) * 1000; // ms timestamp
      if (Date.now() > expiry) return { valid: false, reason: 'License expired' };

      // Features from second segment
      const featCode = parseInt(parts[1] || '0', 36);
      const features = {
        unlimited: !!(featCode & 1),
        export: !!(featCode & 2),
        history30: !!(featCode & 4),
        advanced: !!(featCode & 8),
      };

      return { valid: true, expiry, features };
    } catch {
      return { valid: false, reason: 'Malformed payload' };
    }
  },

  // Quick regex check for UI validation (before full crypto check)
  looksValid(key) {
    return /^RXFLX-[A-Z0-9]{4,}-[A-Z0-9]{4,}-[A-Z0-9]{4}$/i.test(key.trim());
  },

  // Legacy key support (v2.x simple keys)
  isLegacyKey(key) {
    return /^REFLEXA-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key.trim());
  }
};
