/*!
 * REFLEXA — Advanced Network Diagnostic Tool
 * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.
 * Proprietary & Confidential. Unauthorized copying, modification, distribution,
 * reverse engineering, or reuse — in whole or in part — is strictly prohibited.
 * See LICENSE. "REFLEXA" is a trademark of Eng. Mohanad Al-Mothafer.
 */
// REFLEXA License Key Generator
// Runs ONLY in Cloudflare Worker — secret never exposed to client

const PLAN_FEATURES = {
  'pro-monthly':  { bits: 0b1111, days: 31  },
  'pro-annual':   { bits: 0b1111, days: 366 },
  'enterprise':   { bits: 0b11111,days: 366 },
};

function enc(s) {
  return new TextEncoder().encode(s);
}

async function hmacHex(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(data));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Email hash — ties the key to the purchaser (first 6 hex chars of SHA-256)
async function emailHash(email) {
  const buf = await crypto.subtle.digest('SHA-256', enc(email.toLowerCase().trim()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 6).toUpperCase();
}

export async function generateKey(email, planId, secret) {
  const plan = PLAN_FEATURES[planId] ?? PLAN_FEATURES['pro-monthly'];

  // Expiry: Unix ms timestamp in base-36 uppercase
  const expiry  = (Date.now() + plan.days * 86_400_000).toString(36).toUpperCase();

  // Features bitmask in base-36
  const features = plan.bits.toString(36).toUpperCase();

  // Email hash (binds key to buyer — sharing = both get locked out)
  const eHash = await emailHash(email);

  // Payload to sign
  const payload = `${expiry}-${eHash}-${features}`;

  // HMAC checksum — first 8 hex chars (32-bit entropy)
  const checksum = (await hmacHex(payload, secret)).slice(0, 8).toUpperCase();

  return `RXFLX-${expiry}-${eHash}-${features}-${checksum}`;
}

export async function verifyKey(key, secret) {
  const clean = key.trim().toUpperCase();
  if (!clean.startsWith('RXFLX-')) return { valid: false, reason: 'Invalid prefix' };

  const parts = clean.slice(6).split('-'); // Remove "RXFLX-"
  if (parts.length !== 4) return { valid: false, reason: 'Invalid format' };

  const [expiry, eHash, features, checksum] = parts;
  const payload  = `${expiry}-${eHash}-${features}`;
  const expected = (await hmacHex(payload, secret)).slice(0, 8).toUpperCase();

  if (checksum !== expected) return { valid: false, reason: 'Invalid signature' };

  const expiryMs = parseInt(expiry, 36);
  if (Date.now() > expiryMs) return { valid: false, reason: 'Key expired' };

  const featureBits = parseInt(features, 36);
  return {
    valid: true,
    expiry: new Date(expiryMs).toISOString(),
    features: {
      unlimited:  !!(featureBits & 1),
      export:     !!(featureBits & 2),
      history30:  !!(featureBits & 4),
      advanced:   !!(featureBits & 8),
      enterprise: !!(featureBits & 16),
    },
    emailHash: eHash,
  };
}
