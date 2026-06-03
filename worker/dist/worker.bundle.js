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

// ── SECURITY LAYER 4 — Origin-restricted CORS ────────────────────
const ALLOWED_ORIGINS = [
  'https://lhk96l.github.io',
  'http://localhost',        // للتطوير المحلي
  'http://127.0.0.1',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o + ':') || origin.startsWith(o + '/'));
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://lhk96l.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  };
}

// ── SECURITY LAYER 5 — Security headers on every response ────────
const SEC_HEADERS = {
  'X-Content-Type-Options':    'nosniff',
  'X-Frame-Options':           'DENY',
  'Referrer-Policy':           'no-referrer',
  'Cache-Control':             'no-store, no-cache, must-revalidate',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

function json(data, status = 200, request = null) {
  const cors = request ? corsHeaders(request) : { 'Access-Control-Allow-Origin': 'https://lhk96l.github.io' };
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...SEC_HEADERS },
  });
}

// ── SECURITY LAYER 5b — Request body size guard ──────────────────
const MAX_BODY_SIZE = 4096; // 4KB — أكبر من أي طلب شرعي بكثير

async function safeJson(request) {
  const contentLength = parseInt(request.headers.get('Content-Length') || '0');
  if (contentLength > MAX_BODY_SIZE) return { _tooLarge: true };
  const text = await request.text();
  if (text.length > MAX_BODY_SIZE) return { _tooLarge: true };
  try { return JSON.parse(text); } catch { return { _badJson: true }; }
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

// مفتاح REFLEXA الشرعي لا يتجاوز ~40 حرف — أي أطول = هجوم
const MAX_KEY_LEN = 48;
const KEY_PATTERN = /^RXFLX-[A-Z0-9]{4,12}-[A-Z0-9]{4,8}-[A-Z0-9]{1,3}-[A-F0-9]{8}$/;

async function handleValidate(request, env) {
  const body = await safeJson(request);
  if (body._tooLarge) return json({ valid: false, reason: 'Request too large' }, 413, request);
  if (body._badJson)  return json({ valid: false, reason: 'Bad request' }, 400, request);

  const key = (body.key || '').trim().toUpperCase();
  if (!key) return json({ valid: false, reason: 'No key' }, 400, request);

  // طبقة 6: التحقق من الطول والصيغة قبل أي معالجة (يمنع DoS وbrute force)
  if (key.length > MAX_KEY_LEN) return json({ valid: false, reason: 'Invalid format' }, 400, request);
  if (!KEY_PATTERN.test(key))   return json({ valid: false, reason: 'Invalid format' }, 400, request);

  // Rate limiting — 10 طلبات / دقيقة لكل IP
  const ip    = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = `ratelimit:validate:${ip}`;
  const rl    = parseInt(await env.LICENSES.get(rlKey) || '0');
  if (rl >= 10) return json({ valid: false, reason: 'Too many requests. Try again later.' }, 429, request);
  await env.LICENSES.put(rlKey, String(rl + 1), { expirationTtl: 60 });

  const result = await verifyKey(key, env.RXFLX_SECRET);
  if (!result.valid) return json(result, 200, request);

  const meta = await env.LICENSES.get(`key:${key}`);
  if (meta) {
    const parsed = JSON.parse(meta);
    if (!parsed.active) return json({ valid: false, reason: 'Revoked' }, 200, request);
    parsed.used = (parsed.used || 0) + 1;
    parsed.lastSeen = new Date().toISOString();
    await env.LICENSES.put(`key:${key}`, JSON.stringify(parsed), { expirationTtl: 366 * 86400 });
  }
  return json({ ...result, serverValidated: true }, 200, request);
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

// ══ Magic Link System ═════════════════════════════════════════════
// POST /api/magic-link — يرسل رابط تفعيل للإيميل
async function handleMagicLink(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, reason: 'Bad request' }, 400); }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ ok: false, reason: 'Invalid email' }, 400);

  // Rate limit: مرة واحدة كل 60 ثانية لنفس الإيميل
  const rateLimitKey = `ratelimit:ml:${email}`;
  const lastRequest  = await env.LICENSES.get(rateLimitKey);
  if (lastRequest) return json({ ok: false, reason: 'Please wait 60 seconds before requesting again' }, 429);

  // فحص وجود ترخيص نشط
  const licenseKey = await env.LICENSES.get(`email:${email}:latest`);
  if (!licenseKey) return json({ ok: false, reason: 'No active license found for this email' }, 404);

  // التحقق أن الترخيص لم ينتهِ
  const keyMeta = await env.LICENSES.get(`key:${licenseKey}`);
  if (keyMeta) {
    const parsed = JSON.parse(keyMeta);
    if (!parsed.active) return json({ ok: false, reason: 'License has been revoked' }, 403);
  }

  // توليد Magic Token — صالح 10 دقائق
  const nonce    = Math.random().toString(36).slice(2);
  const exp      = Date.now() + 10 * 60 * 1000;
  const payload  = `${email}|${exp}|${nonce}`;
  const sigHex   = await hmacHex(payload, env.RXFLX_SECRET);
  const token    = btoa(payload).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'') + '.' + sigHex.slice(0,12).toUpperCase();

  // حفظ في KV مع انتهاء 10 دقائق
  await env.LICENSES.put(`magic:${token}`, JSON.stringify({ email, exp, licenseKey, used: false }), { expirationTtl: 600 });

  // Rate limit — 60 ثانية
  await env.LICENSES.put(rateLimitKey, '1', { expirationTtl: 60 });

  // رابط التفعيل
  const activationUrl = `https://lhk96l.github.io/reflexa/?rxflx_token=${encodeURIComponent(token)}`;

  // إرسال الإيميل
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,sans-serif;background:#0B0F1E;color:#F1F5F9;margin:0;padding:0;}
    .wrap{max-width:520px;margin:0 auto;padding:40px 20px;}
    .logo{font-size:26px;font-weight:900;color:#00D4FF;letter-spacing:2px;margin-bottom:4px;}
    .sub{font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:28px;}
    .card{background:#151D2E;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:28px;margin-bottom:16px;text-align:center;}
    .title{font-size:20px;font-weight:800;margin-bottom:8px;}
    .desc{font-size:13px;color:#94A3B8;margin-bottom:24px;line-height:1.6;}
    .btn{display:inline-block;padding:15px 36px;background:linear-gradient(135deg,#00D4FF,#8B5CF6);border-radius:50px;color:#0B0F1E;font-weight:900;font-size:15px;text-decoration:none;letter-spacing:.5px;}
    .warn{font-size:11px;color:#4B5563;margin-top:16px;}
    .footer{font-size:11px;color:#374151;text-align:center;margin-top:24px;line-height:1.9;}
  </style></head><body><div class="wrap">
    <div class="logo">REFLEXA</div>
    <div class="sub">Advanced Network Diagnostic Tool</div>
    <div class="card">
      <div class="title">🔗 Activate Pro on your device</div>
      <div class="desc">Click the button below to instantly activate REFLEXA Pro on this device.<br>This link expires in <strong>10 minutes</strong>.</div>
      <a href="${activationUrl}" class="btn">⚡ Activate REFLEXA Pro</a>
      <div class="warn">⚠️ Do not share this link. One-time use only.</div>
    </div>
    <div class="footer">REFLEXA · By Eng. Mohanad Al-Mothafer<br>If you didn't request this, ignore this email.</div>
  </div></body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'REFLEXA <onboarding@resend.dev>',
      to:      [email],
      subject: '🔗 Activate REFLEXA Pro — Magic Link (10 min)',
      html,
    }),
  });

  return json({ ok: true, message: 'Magic link sent to your email' });
}

// GET /api/activate?rxflx_token=xxx — يتحقق من التوكن ويرجع الترخيص
async function handleActivateToken(request, env) {
  const url   = new URL(request.url);
  const token = url.searchParams.get('rxflx_token') || '';
  if (!token) return json({ valid: false, reason: 'No token' }, 400);

  const stored = await env.LICENSES.get(`magic:${token}`);
  if (!stored) return json({ valid: false, reason: 'Token expired or invalid' }, 404);

  const data = JSON.parse(stored);

  // فحص انتهاء الصلاحية
  if (Date.now() > data.exp) return json({ valid: false, reason: 'Token expired' }, 410);

  // فحص الاستخدام المسبق
  if (data.used) return json({ valid: false, reason: 'Token already used' }, 409);

  // تحقق HMAC من التوكن
  const parts   = token.split('.');
  if (parts.length !== 2) return json({ valid: false, reason: 'Malformed token' }, 400);
  const payload  = atob(parts[0].replace(/-/g,'+').replace(/_/g,'/'));
  const sigCheck = (await hmacHex(payload, env.RXFLX_SECRET)).slice(0,12).toUpperCase();
  if (sigCheck !== parts[1]) return json({ valid: false, reason: 'Invalid token signature' }, 401);

  // تفعيل — وضع علامة "مستخدم"
  data.used = true;
  await env.LICENSES.put(`magic:${token}`, JSON.stringify(data), { expirationTtl: 60 });

  // جلب معلومات الترخيص
  const keyResult = await verifyKey(data.licenseKey, env.RXFLX_SECRET);

  return json({
    valid:      true,
    key:        data.licenseKey,
    email:      data.email,
    expiry:     keyResult.expiry,
    features:   keyResult.features,
  });
}

// ══ Admin Authentication System ══════════════════════════════════
// ADMIN_EMAIL + ADMIN_PASSWORD_HASH (SHA-256) set in Cloudflare env
// JWT session token — 24 hours validity

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function createAdminToken(email, secret) {
  const exp     = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = `${email}|${exp}`;
  const sig     = (await hmacHex(payload, secret)).slice(0, 16).toUpperCase();
  return btoa(payload).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'') + '.' + sig;
}

async function verifyAdminToken(token, secret) {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const payload = atob(parts[0].replace(/-/g,'+').replace(/_/g,'/'));
    const [email, expStr] = payload.split('|');
    if (Date.now() > parseInt(expStr)) return false;
    const expected = (await hmacHex(payload, secret)).slice(0, 16).toUpperCase();
    return parts[1] === expected;
  } catch { return false; }
}

async function handleAdminLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false }, 400); }

  const email    = (body.email    || '').trim().toLowerCase();
  const password = (body.password || '').trim();
  if (!email || !password) return json({ ok: false, reason: 'Missing credentials' }, 400);

  // Rate limit — 5 محاولات كل 15 دقيقة
  const rlKey = `ratelimit:admin:${email}`;
  const rl    = await env.LICENSES.get(rlKey);
  if (rl && parseInt(rl) >= 5) return json({ ok: false, reason: 'Too many attempts. Wait 15 minutes.' }, 429);
  await env.LICENSES.put(rlKey, String((parseInt(rl)||0)+1), { expirationTtl: 900 });

  // التحقق من الإيميل والباسورد
  const adminEmail    = env.ADMIN_EMAIL    || '';
  const adminPassHash = env.ADMIN_PASS_HASH || '';
  const inputHash     = await sha256hex(password);

  if (email !== adminEmail.toLowerCase() || inputHash !== adminPassHash) {
    return json({ ok: false, reason: 'Invalid email or password' }, 401);
  }

  // إزالة rate limit بعد نجاح تسجيل الدخول
  await env.LICENSES.delete(rlKey);

  const token = await createAdminToken(email, env.RXFLX_SECRET);
  return json({ ok: true, token });
}

async function requireAdmin(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  const valid = await verifyAdminToken(token, env.RXFLX_SECRET);
  return valid;
}

async function handleAdminGenerateKey(request, env) {
  if (!await requireAdmin(request, env)) return json({ ok: false, reason: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, reason: 'Bad JSON' }, 400); }

  const email  = (body.email  || '').trim().toLowerCase();
  const planId = body.plan    || 'pro-monthly';
  if (!email || !email.includes('@')) return json({ ok: false, reason: 'Invalid email' }, 400);

  const orderId    = `admin-${Date.now()}`;
  const licenseKey = await generateKey(email, planId, env.RXFLX_SECRET);

  const meta = { email, planId, orderId, createdAt: new Date().toISOString(), used: 0, active: true, adminGenerated: true };
  await env.LICENSES.put(`key:${licenseKey}`,    JSON.stringify(meta), { expirationTtl: 366 * 86400 });
  await env.LICENSES.put(`order:${orderId}`,      licenseKey);
  await env.LICENSES.put(`email:${email}:latest`, licenseKey);

  let emailSent = false;
  if (body.sendEmail !== false) {
    const r = await sendLicenseEmail(email, licenseKey, planId, env.RESEND_API_KEY);
    emailSent = r.ok;
  }

  return json({ ok: true, key: licenseKey, emailSent });
}

// ── SECURITY LAYER 7 — Honeypot + Auto-ban ───────────────────────
// مسارات الطُّعم: أي محاولة وصول لها = مهاجم → حظر IP فوراً
// ملاحظة: لا نضع '/admin' لأن /admin/login و /admin/generate-key شرعيان
const HONEYPOT_PATHS = [
  '/.env', '/.git', '/config.json', '/wp-admin', '/wp-login.php',
  '/admin.php', '/phpmyadmin', '/.aws', '/api/keys',
  '/api/users', '/api/admin', '/backup', '/.ssh', '/shell',
  '/api/secrets', '/credentials', '/.htaccess', '/server-status',
];

async function isBanned(ip, env) {
  return !!(await env.LICENSES.get(`ban:${ip}`));
}

async function banIP(ip, env, reason) {
  await env.LICENSES.put(`ban:${ip}`, JSON.stringify({ reason, ts: Date.now() }), { expirationTtl: 86400 });
}

// كشف الـ bots والأدوات الآلية المعروفة
function looksLikeAttacker(request) {
  const ua = (request.headers.get('User-Agent') || '').toLowerCase();
  if (!ua) return true; // طلب بلا User-Agent = مشبوه
  const badAgents = ['sqlmap', 'nikto', 'nmap', 'masscan', 'havij', 'acunetix', 'nessus', 'metasploit', 'hydra', 'gobuster', 'dirbuster', 'wpscan', 'curl/7.', 'python-requests'];
  return badAgents.some(a => ua.includes(a));
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;
    const ip     = request.headers.get('CF-Connecting-IP') || 'unknown';

    // طبقة 7a: فحص الحظر أولاً (أسرع رفض)
    if (await isBanned(ip, env)) {
      return new Response('Forbidden', { status: 403, headers: SEC_HEADERS });
    }

    // طبقة 7b: Honeypot — أي وصول لمسار طُعم = حظر فوري 24 ساعة
    if (HONEYPOT_PATHS.some(p => url.pathname.toLowerCase().startsWith(p))) {
      await banIP(ip, env, `honeypot:${url.pathname}`);
      return new Response('Not Found', { status: 404, headers: SEC_HEADERS });
    }

    // طبقة 7c: حظر أدوات الاختراق المعروفة
    if (looksLikeAttacker(request) && url.pathname !== '/api/health') {
      await banIP(ip, env, 'attack-tool-ua');
      return new Response('Forbidden', { status: 403, headers: SEC_HEADERS });
    }

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders(request), ...SEC_HEADERS } });
    }

    try {
      if (url.pathname === '/webhook/lemonsqueezy' && method === 'POST') return await handleWebhook(request, env);
      if (url.pathname === '/api/validate'         && method === 'POST') return await handleValidate(request, env);
      if (url.pathname === '/api/resend-key'       && method === 'POST') return await handleResendKey(request, env);
      if (url.pathname === '/api/magic-link'       && method === 'POST') return await handleMagicLink(request, env);
      if (url.pathname === '/api/activate'         && method === 'GET')  return await handleActivateToken(request, env);
      if (url.pathname === '/api/health'           && method === 'GET')  return json({ status: 'ok', version: '3.4.0', ts: Date.now() }, 200, request);
      // Admin endpoints
      if (url.pathname === '/admin/login'          && method === 'POST') return await handleAdminLogin(request, env);
      if (url.pathname === '/admin/generate-key'   && method === 'POST') return await handleAdminGenerateKey(request, env);
      return json({ error: 'Not found' }, 404, request);
    } catch (err) {
      console.error('[RXFLX Worker]', err);
      return json({ error: 'Internal server error' }, 500, request);
    }
  }
};
