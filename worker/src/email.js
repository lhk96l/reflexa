/*!
 * REFLEXA — Advanced Network Diagnostic Tool
 * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.
 * Proprietary & Confidential. Unauthorized copying, modification, distribution,
 * reverse engineering, or reuse — in whole or in part — is strictly prohibited.
 * See LICENSE. "REFLEXA" is a trademark of Eng. Mohanad Al-Mothafer.
 */
// REFLEXA — Email Sender via Resend API
// Resend: free 3,000 emails/month, best for Cloudflare Workers

const RESEND_API = 'https://api.resend.com/emails';

export async function sendLicenseEmail(to, licenseKey, plan, resendApiKey) {
  const planLabel = plan.includes('annual') ? 'Pro Annual' : plan.includes('enterprise') ? 'Enterprise' : 'Pro Monthly';
  const expiryDate = new Date(parseInt(licenseKey.split('-')[1], 36)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0B0F1E; color: #F1F5F9; margin: 0; padding: 0; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
  .logo { font-size: 28px; font-weight: 900; letter-spacing: 2px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
  .subtitle { font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 32px; }
  .card { background: #151D2E; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 28px; margin-bottom: 20px; }
  .card-title { font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .key { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #00D4FF; background: #0B0F1E; border: 1px solid #00D4FF30; border-radius: 10px; padding: 14px 18px; letter-spacing: 2px; word-break: break-all; margin-bottom: 8px; }
  .key-note { font-size: 11px; color: #4B5563; }
  .steps { list-style: none; padding: 0; counter-reset: steps; }
  .steps li { counter-increment: steps; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; color: #94A3B8; display: flex; align-items: center; gap: 12px; }
  .steps li::before { content: counter(steps); width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #00D4FF, #8B5CF6); color: #0B0F1E; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .steps li:last-child { border-bottom: none; }
  .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #64748B; }
  .info-val { color: #F1F5F9; font-weight: 600; }
  .btn { display: inline-block; padding: 13px 28px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); border-radius: 50px; color: #0B0F1E; font-weight: 800; font-size: 14px; text-decoration: none; margin: 16px 0; }
  .footer { font-size: 11px; color: #374151; text-align: center; margin-top: 32px; line-height: 1.8; }
  .footer a { color: #4B5563; }
</style></head>
<body>
<div class="wrap">
  <div class="logo">REFLEXA</div>
  <div class="subtitle">Advanced Network Diagnostic Tool</div>

  <div class="card">
    <div class="card-title">👑 Your License Key</div>
    <div class="key">${licenseKey}</div>
    <div class="key-note">⚠️ This key is bound to your email address. Do not share it.</div>
  </div>

  <div class="card">
    <div class="card-title">📋 Subscription Details</div>
    <div class="info-row"><span class="info-label">Plan</span><span class="info-val">${planLabel}</span></div>
    <div class="info-row"><span class="info-label">Valid Until</span><span class="info-val">${expiryDate}</span></div>
    <div class="info-row"><span class="info-label">Email</span><span class="info-val">${to}</span></div>
    <div class="info-row"><span class="info-label">Features</span><span class="info-val">Unlimited Tests • CSV Export • 30-day History • All Tools</span></div>
  </div>

  <div class="card">
    <div class="card-title">🚀 How to Activate</div>
    <ol class="steps">
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
    © 2025 MIT License · You purchased a Pro license, not ownership of the software.
  </div>
</div>
</body>
</html>`;

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'REFLEXA <noreply@reflexa.io>',
      to:   [to],
      subject: `👑 Your REFLEXA ${planLabel} License Key`,
      html,
    }),
  });

  const result = await response.json();
  return { ok: response.ok, status: response.status, result };
}
