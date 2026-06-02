// REFLEXA v3.0 — License Validator
// Server-only validation — no local HMAC complexity

const WORKER = 'https://reflexa-license.hanodeking15.workers.dev';

export const license = {

  async validate(key) {
    if (!key) return { valid: false, reason: 'No key provided' };
    const clean = key.trim().toUpperCase().replace(/\s/g, '');
    if (!clean.startsWith('RXFLX-')) return { valid: false, reason: 'Invalid format' };

    try {
      const res = await fetch(`${WORKER}/api/validate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: clean }),
        signal:  AbortSignal.timeout(8000),
      });
      if (!res.ok) return { valid: false, reason: 'Server error' };
      return await res.json();
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return { valid: false, reason: 'Connection timeout — check your internet' };
      }
      return { valid: false, reason: 'No internet connection' };
    }
  },

  isLegacyKey(key) {
    return /^REFLEXA-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key.trim());
  },

  looksValid(key) {
    return /^RXFLX-/i.test(key.trim()) && key.trim().length > 20;
  },
};
