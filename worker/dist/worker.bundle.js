// REFLEXA v3.0 — Cloudflare Worker (Single Bundle)
// كود مدمج جاهز للنسخ في Cloudflare Dashboard Editor

// ══ keygen.js ═══════════════════════════════════════════════════
const PLAN_FEATURES = {
  'pro-monthly':  { bits: 0b1111, days: 31  },
  'pro-annual':   { bits: 0b1111, days: 366 },
  'enterprise':   { bits: 0b11111,days: 366 },
};

function enc(s) { return new TextEncoder().encode(s); }

async function hmacHex(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(data));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function emailHash(email) {
  const buf = await crypto.subtle.digest('SHA-256', enc(email.toLowerCase().trim()));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 6).toUpperCase();
}

async function generateKey(email, planId, secret) {
  const plan    = PLAN_FEATURES[planId] ?? PLAN_FEATURES['pro-monthly'];
  const expiry   = (Date.now() + plan.days * 86_400_000).toString(36).toUpperCase();
  const features = plan.bits.toString(36).toUpperCase();
  const eHash    = await emailHash(email);
  const payload  = `${expiry}-${eHash}-${features}`;
  const checksum = (await hmacHex(payload, secret)).slice(0, 8).toUpperCase();
  return `RXFLX-${expiry}-${eHash}-${features}-${checksum}`;
}

async function verifyKey(key, secret) {
  const clean = key.trim().toUpperCase();
  if (!clean.startsWith('RXFLX-')) return { valid: false, reason: 'Invalid prefix' };
  const parts = clean.slice(6).split('-');
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
  };
}

// ══ email.js ═════════════════════════════════════════════════════
async function sendLicenseEmail(to, licenseKey, plan, resendApiKey) {
  const planLabel  = plan.includes('annual') ? 'Pro Annual' : plan.includes('enterprise') ? 'Enterprise' : 'Pro Monthly';
  const expiryDate = new Date(parseInt(licenseKey.split('-')[1], 36))
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0B0F1E;color:#F1F5F9;margin:0;padding:0;}
    .wrap{max-width:560px;margin:0 auto;padding:40px 20px;}
    .logo{font-size:28px;font-weight:900;letter-spacing:2px;color:#00D4FF;margin-bottom:4px;}
    .sub{font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:28px;}
    .card{background:#151D2E;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px;margin-bottom:16px;}
    .card-title{font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}
    .key{font-family:'Courier New',monospace;font-size:17px;font-weight:700;color:#00D4FF;background:#0B0F1E;border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px;letter-spacing:1.5px;word-break:break-all;margin-bottom:8px;}
    .note{font-size:11px;color:#4B5563;}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;}
    .row:last-child{border-bottom:none;}
    .lbl{color:#64748B;} .val{color:#F1F5F9;font-weight:600;}
    ol{list-style:none;padding:0;counter-reset:s;}
    li{counter-increment:s;display:flex;align-items:flex-start;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:#94A3B8;}
    li:last-child{border-bottom:none;}
    li::before{content:counter(s);min-width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#00D4FF,#8B5CF6);color:#0B0F1E;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;}
    .btn{display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#00D4FF,#8B5CF6);border-radius:50px;color:#0B0F1E;font-weight:800;font-size:14px;text-decoration:none;margin:16px 0;}
    .footer{font-size:11px;color:#374151;text-align:center;margin-top:28px;line-height:1.9;}
    .footer a{color:#4B5563;}
  </style></head><body><div class="wrap">
    <div class="logo">REFLEXA</div>
    <div class="sub">Advanced Network Diagnostic Tool</div>
    <div class="card">
      <div class="card-title">👑 Your License Key</div>
      <div class="key">${licenseKey}</div>
      <div class="note">⚠️ This key is linked to your email. Do not share it.</div>
    </div>
    <div class="card">
      <div class="card-title">📋 Subscription Details</div>
      <div class="row"><span class="lbl">Plan</span><span class="val">${planLabel}</span></div>
      <div class="row"><span class="lbl">Valid Until</span><span class="val">${expiryDate}</span></div>
      <div class="row"><span class="lbl">Email</span><span class="val">${to}</span></div>
      <div class="row"><span class="lbl">Features</span><span class="val">Unlimited · CSV Export · 30-day History · All Tools</span></div>
    </div>
    <div class="card">
      <div class="card-title">🚀 How to Activate</div>
      <ol>
        <li>Open <a href="https://lhk96l.github.io/reflexa/" style="color:#00D4FF">lhk96l.github.io/reflexa</a></li>
        <li>Click <strong>✨ Pro</strong> in the top bar</li>
        <li>Click <strong>🔑 Enter License Key</strong></li>
        <li>Paste your key and click <strong>Activate</strong></li>
      </ol>
    </div>
    <div style="text-align:center">
      <a href="https://lhk96l.github.io/reflexa/" class="btn">Open REFLEXA →</a>
    </div>
    <div class="footer">
      REFLEXA — Advanced Network Diagnostic Tool<br>
      By <strong>Eng. Mohanad Al-Mothafer</strong> | ICT-Lead / CTO<br>
      <a href="https://github.com/lhk96l/reflexa">GitHub</a> ·
      <a href="mailto:hanodeking15@gmail.com">Support</a><br><br>
      © 2025 MIT License
    </div>
  </div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'REFLEXA <onboarding@resend.dev>',
      to:      [to],
      subject: `👑 Your REFLEXA ${planLabel} License Key`,
      html,
    }),
  });
  return { ok: res.ok, status: res.status };
}

// ══ index.js (Main Handler) ═══════════════════════════════════════
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

async function verifyLSSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    'raw', enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, enc(body));
  const hex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function getPlanId(event) {
  const name    = (event.data?.attributes?.product_name || '').toLowerCase();
  const variant = (event.data?.attributes?.variant_name || '').toLowerCase();
  if (name.includes('enterprise'))                              return 'enterprise';
  if (variant.includes('annual') || name.includes('annual'))   return 'pro-annual';
  return 'pro-monthly';
}

async function handleWebhook(request, env) {
  const rawBody   = await request.text();
  const sig       = request.headers.get('X-Signature') || '';
  const eventName = request.headers.get('X-Event-Name') || '';
  const valid = await verifyLSSignature(rawBody, sig, env.LS_SIGNING_SECRET);
  if (!valid) return json({ error: 'Invalid signature' }, 401);

  const triggers = ['order_created', 'subscription_created', 'subscription_payment_success'];
  if (!triggers.includes(eventName)) return json({ ok: true, skipped: eventName });

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'Bad JSON' }, 400); }

  const email   = event.data?.attributes?.user_email;
  const planId  = getPlanId(event);
  const orderId = event.data?.id || 'unknown';
  if (!email) return json({ error: 'No email' }, 400);

  // Idempotency
  const existing = await env.LICENSES.get(`order:${orderId}`);
  if (existing) return json({ ok: true, idempotent: true });

  const licenseKey = await generateKey(email, planId, env.RXFLX_SECRET);
  const meta = { email, planId, orderId, createdAt: new Date().toISOString(), used: 0, active: true };

  await env.LICENSES.put(`key:${licenseKey}`,    JSON.stringify(meta), { expirationTtl: 366 * 86400 });
  await env.LICENSES.put(`order:${orderId}`,      licenseKey);
  await env.LICENSES.put(`email:${email}:latest`, licenseKey);

  const emailResult = await sendLicenseEmail(email, licenseKey, planId, env.RESEND_API_KEY);
  return json({ ok: true, key: licenseKey, emailSent: emailResult.ok });
}

async function handleValidate(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ valid: false }, 400); }
  const key = (body.key || '').trim().toUpperCase();
  if (!key) return json({ valid: false, reason: 'No key' }, 400);

  const result = await verifyKey(key, env.RXFLX_SECRET);
  if (!result.valid) return json(result);

  const meta = await env.LICENSES.get(`key:${key}`);
  if (meta) {
    const parsed = JSON.parse(meta);
    if (!parsed.active) return json({ valid: false, reason: 'Revoked' });
    parsed.used = (parsed.used || 0) + 1;
    parsed.lastSeen = new Date().toISOString();
    await env.LICENSES.put(`key:${key}`, JSON.stringify(parsed), { expirationTtl: 366 * 86400 });
  }
  return json({ ...result, serverValidated: true });
}

async function handleResendKey(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false }, 400); }
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ ok: false, reason: 'Invalid email' }, 400);
  const key = await env.LICENSES.get(`email:${email}:latest`);
  if (!key) return json({ ok: false, reason: 'Not found' }, 404);
  const meta    = await env.LICENSES.get(`key:${key}`);
  const planId  = meta ? JSON.parse(meta).planId : 'pro-monthly';
  await sendLicenseEmail(email, key, planId, env.RESEND_API_KEY);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      if (url.pathname === '/webhook/lemonsqueezy' && method === 'POST') return await handleWebhook(request, env);
      if (url.pathname === '/api/validate'         && method === 'POST') return await handleValidate(request, env);
      if (url.pathname === '/api/resend-key'       && method === 'POST') return await handleResendKey(request, env);
      if (url.pathname === '/api/health'           && method === 'GET')  return json({ status: 'ok', version: '3.0.0', ts: Date.now() });
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('[RXFLX Worker]', err);
      return json({ error: 'Internal server error' }, 500);
    }
  }
};
