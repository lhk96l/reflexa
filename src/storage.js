// REFLEXA v3.0 — AES-256-GCM Encrypted Storage
const PREFIX = 'rxflx_';

async function getKey() {
  const fp = await fingerprint();
  const raw = await crypto.subtle.importKey('raw', enc(fp), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc('RXFLX_SALT_V3'), iterations: 100000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function enc(s) { return new TextEncoder().encode(s); }

async function fingerprint() {
  const parts = [
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    navigator.hardwareConcurrency || 4,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  const buf = await crypto.subtle.digest('SHA-256', enc(parts.join('|')));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).slice(0, 32);
}

export const storage = {
  async set(key, value) {
    try {
      const k = await getKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        k,
        enc(JSON.stringify(value))
      );
      localStorage.setItem(PREFIX + key, JSON.stringify({
        iv: Array.from(iv),
        d: Array.from(new Uint8Array(encrypted)),
        v: 3
      }));
    } catch {
      // Fallback to plain storage if crypto unavailable
      localStorage.setItem(PREFIX + key, JSON.stringify({ plain: value, v: 0 }));
    }
  },

  async get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return fallback;
      const stored = JSON.parse(raw);
      if (stored.v === 0) return stored.plain;
      const k = await getKey();
      const dec = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(stored.iv) },
        k,
        new Uint8Array(stored.d)
      );
      return JSON.parse(new TextDecoder().decode(dec));
    } catch {
      return fallback;
    }
  },

  remove(key) { localStorage.removeItem(PREFIX + key); },

  // Unencrypted fast access for non-sensitive prefs
  pref: {
    get(key, fallback = null) {
      const v = localStorage.getItem(PREFIX + 'pref_' + key);
      return v !== null ? v : fallback;
    },
    set(key, value) { localStorage.setItem(PREFIX + 'pref_' + key, value); }
  }
};
