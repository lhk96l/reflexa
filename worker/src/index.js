// REFLEXA v3.0 — Cloudflare Worker
// Handles: LemonSqueezy webhooks, license validation API, key management
//
// Environment Variables (set in Cloudflare Dashboard):
//   RXFLX_SECRET      — HMAC signing secret (min 32 chars, random)
//   LS_SIGNING_SECRET — LemonSqueezy webhook signing secret
//   RESEND_API_KEY    — Resend email API key
//   LICENSES          — Cloudflare KV namespace binding

import { generateKey, verifyKey } from './keygen.js';
import { sendLicenseEmail }       from './email.js';

// ── CORS headers ─────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  'https://lhk96l.github.io',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── Verify LemonSqueezy Webhook Signature ─────────────────────────
// LemonSqueezy signs with HMAC-SHA256 of the raw body
async function verifyLSSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const expected = await crypto.subtle.sign(
    'HMAC', key,
    new TextEncoder().encode(body)
  );
  const expectedHex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expectedHex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ── Map LemonSqueezy product to plan ID ───────────────────────────
function getPlanId(event) {
  const name    = (event.data?.attributes?.product_name || '').toLowerCase();
  const variant = (event.data?.attributes?.variant_name || '').toLowerCase();
  if (name.includes('enterprise'))              return 'enterprise';
  if (variant.includes('annual') || name.includes('annual')) return 'pro-annual';
  return 'pro-monthly';
}

// ── Route: POST /webhook/lemonsqueezy ─────────────────────────────
async function handleLemonSqueezyWebhook(request, env) {
  const rawBody  = await request.text();
  const sig      = request.headers.get('X-Signature') || '';
  const eventName = request.headers.get('X-Event-Name') || '';

  // Verify signature
  const valid = await verifyLSSignature(rawBody, sig, env.LS_SIGNING_SECRET);
  if (!valid) return json({ error: 'Invalid signature' }, 401);

  // Only process successful orders and subscriptions
  const triggerEvents = [
    'order_created',
    'subscription_created',
    'subscription_payment_success',
  ];
  if (!triggerEvents.includes(eventName)) {
    return json({ ok: true, skipped: eventName });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const email   = event.data?.attributes?.user_email;
  const planId  = getPlanId(event);
  const orderId = event.data?.id || 'unknown';

  if (!email) return json({ error: 'No email in payload' }, 400);

  // Check if already processed (idempotency)
  const existingKey = await env.LICENSES.get(`order:${orderId}`);
  if (existingKey) {
    return json({ ok: true, idempotent: true, key: existingKey });
  }

  // Generate license key
  const licenseKey = await generateKey(email, planId, env.RXFLX_SECRET);

  // Store in KV with metadata
  const meta = {
    email,
    planId,
    orderId,
    createdAt: new Date().toISOString(),
    used: 0,
    active: true,
  };
  await env.LICENSES.put(`key:${licenseKey}`,   JSON.stringify(meta), { expirationTtl: 366 * 86400 });
  await env.LICENSES.put(`order:${orderId}`,     licenseKey);
  await env.LICENSES.put(`email:${email}:latest`, licenseKey);

  // Send email
  const emailResult = await sendLicenseEmail(email, licenseKey, planId, env.RESEND_API_KEY);

  return json({
    ok: true,
    key: licenseKey,
    emailSent: emailResult.ok,
  });
}

// ── Route: POST /api/validate ─────────────────────────────────────
// Called optionally by the app to server-validate (client can also validate locally)
async function handleValidate(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ valid: false, reason: 'Invalid JSON' }, 400); }

  const key = (body.key || '').trim().toUpperCase();
  if (!key) return json({ valid: false, reason: 'No key provided' }, 400);

  // Cryptographic validation
  const result = await verifyKey(key, env.RXFLX_SECRET);
  if (!result.valid) return json(result);

  // Check revocation in KV
  const meta = await env.LICENSES.get(`key:${key}`);
  if (meta) {
    const parsed = JSON.parse(meta);
    if (!parsed.active) return json({ valid: false, reason: 'Key revoked' });

    // Increment usage counter
    parsed.used = (parsed.used || 0) + 1;
    parsed.lastSeen = new Date().toISOString();
    await env.LICENSES.put(`key:${key}`, JSON.stringify(parsed), { expirationTtl: 366 * 86400 });
  }

  return json({ ...result, serverValidated: true });
}

// ── Route: POST /api/resend-key ───────────────────────────────────
// Resend license key to email (for lost keys)
async function handleResendKey(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false }, 400); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ ok: false, reason: 'Invalid email' }, 400);

  const key = await env.LICENSES.get(`email:${email}:latest`);
  if (!key) return json({ ok: false, reason: 'No license found for this email' }, 404);

  const meta = await env.LICENSES.get(`key:${key}`);
  const planId = meta ? JSON.parse(meta).planId : 'pro-monthly';

  await sendLicenseEmail(email, key, planId, env.RESEND_API_KEY);
  return json({ ok: true });
}

// ── Route: GET /api/health ────────────────────────────────────────
function handleHealth() {
  return json({ status: 'ok', version: '3.0.0', ts: Date.now() });
}

// ── Main Request Handler ──────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (url.pathname === '/webhook/lemonsqueezy' && method === 'POST')
        return await handleLemonSqueezyWebhook(request, env);

      if (url.pathname === '/api/validate' && method === 'POST')
        return await handleValidate(request, env);

      if (url.pathname === '/api/resend-key' && method === 'POST')
        return await handleResendKey(request, env);

      if (url.pathname === '/api/health' && method === 'GET')
        return handleHealth();

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('[RXFLX Worker]', err);
      return json({ error: 'Internal server error' }, 500);
    }
  }
};
