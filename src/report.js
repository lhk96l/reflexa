// REFLEXA v3.0 — Report Generator (PNG + CSV + Text)

// ── PNG Result Image ──────────────────────────────────────────────
export function generateResultImage(data) {
  const W = 800, H = 460;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0B0F1E');
  bg.addColorStop(1, '#130B2B');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Top accent bar
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, '#00D4FF'); bar.addColorStop(1, '#8B5CF6');
  ctx.fillStyle = bar; ctx.fillRect(0, 0, W, 5);

  // Logo
  ctx.font = 'bold 32px system-ui, Arial';
  ctx.fillStyle = '#00D4FF';
  ctx.fillText('REFLEXA', 36, 58);
  ctx.font = '14px system-ui, Arial';
  ctx.fillStyle = '#64748B';
  ctx.fillText('Advanced Network Diagnostic — v3.0', 36, 80);

  // Date
  ctx.textAlign = 'right';
  ctx.font = '13px system-ui, Arial';
  ctx.fillStyle = '#4B5563';
  ctx.fillText(new Date().toLocaleString(), W - 36, 58);
  ctx.textAlign = 'left';

  // Network Score (large, right side)
  if (data.score) {
    ctx.font = 'bold 96px system-ui, Arial';
    ctx.fillStyle = data.score.color || '#10B981';
    ctx.textAlign = 'right';
    ctx.fillText(data.score.letter, W - 40, 170);
    ctx.font = 'bold 18px system-ui, Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`${data.score.score}/100`, W - 40, 200);
    ctx.textAlign = 'left';
  }

  // ITU-T Class
  if (data.itu) {
    ctx.font = '13px system-ui, Arial';
    ctx.fillStyle = data.itu.color;
    ctx.fillText(`ITU-T ${data.itu.label} — ${data.itu.description}`, 36, 108);
  }

  // Separator
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, 120); ctx.lineTo(W - 36, 120); ctx.stroke();

  // Metrics grid
  const metrics = [
    { label: '⬇ Download',     val: data.dl   ? `${data.dl.toFixed(1)} Mbps`   : '—', color: '#00D4FF', x: 36,  y: 180 },
    { label: '⬆ Upload',       val: data.ul   ? `${data.ul.toFixed(1)} Mbps`   : '—', color: '#8B5CF6', x: 230, y: 180 },
    { label: '📡 Ping',         val: data.ping ? `${data.ping} ms`              : '—', color: '#10B981', x: 430, y: 180 },
    { label: '〰 Jitter',       val: data.jitter ? `${data.jitter} ms`          : '—', color: '#F59E0B', x: 36,  y: 270 },
    { label: '📦 Packet Loss',  val: data.loss !== undefined ? `${data.loss}%`  : '—', color: data.loss === 0 ? '#10B981' : '#EF4444', x: 230, y: 270 },
    { label: '🌊 Bufferbloat',  val: data.bloat ? data.bloat.grade             : '—', color: '#8B5CF6', x: 430, y: 270 },
    { label: 'MOS Score',       val: data.mos  ? `${data.mos.score} (${data.mos.label})` : '—', color: '#34D399', x: 36,  y: 360 },
    { label: 'TCP Efficiency',  val: data.rfc  ? `${data.rfc.tcpEfficiency}%`  : '—', color: '#00D4FF', x: 230, y: 360 },
    { label: 'P95 Latency',     val: data.p95  ? `${data.p95} ms`              : '—', color: '#F59E0B', x: 430, y: 360 },
  ];

  metrics.forEach(m => {
    ctx.font = '11px system-ui, Arial';
    ctx.fillStyle = '#4B5563';
    ctx.fillText(m.label, m.x, m.y - 20);
    ctx.font = 'bold 28px system-ui, Arial';
    ctx.fillStyle = m.color;
    ctx.fillText(m.val, m.x, m.y);
  });

  // Footer
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath(); ctx.moveTo(36, H - 40); ctx.lineTo(W - 36, H - 40); ctx.stroke();
  ctx.font = '12px system-ui, Arial';
  ctx.fillStyle = '#374151';
  ctx.fillText('lhk96l.github.io/reflexa', 36, H - 16);
  ctx.textAlign = 'right';
  ctx.fillText('REFLEXA v3.0 © 2025 — Eng. Mohanad Al-Mothafer', W - 36, H - 16);

  return canvas;
}

export function downloadPNG(data) {
  const canvas = generateResultImage(data);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REFLEXA-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }, 'image/png');
}

// ── CSV Export ────────────────────────────────────────────────────
export function downloadCSV(history) {
  const headers = [
    'Date', 'Time', 'Download (Mbps)', 'Upload (Mbps)',
    'Ping (ms)', 'Jitter (ms)', 'Packet Loss (%)',
    'Bufferbloat Grade', 'MOS Score', 'Network Score', 'Grade',
    'TCP Efficiency (%)', 'P95 Latency (ms)', 'ITU-T Class',
    'ISP', 'Server'
  ];

  const rows = history.map(r => [
    r.date || '', r.time || '',
    (r.dl   || 0).toFixed(2), (r.ul || 0).toFixed(2),
    r.ping  || '', r.jitter || '', r.loss || '',
    r.bloatGrade || '', r.mos || '',
    r.score || '', r.grade || '',
    r.tcpEff || '', r.p95 || '',
    r.ituClass !== undefined ? `Class ${r.ituClass}` : '',
    r.isp || '', r.server || 'Cloudflare',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `REFLEXA-Report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── PDF Export (Print-to-PDF) ─────────────────────────────────────
export function downloadPDF(data, history = []) {
  const d = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  const score = data.score || {};
  const itu   = data.itu   || {};
  const mos   = data.mos   || {};
  const rfc   = data.rfc   || {};
  const bloat = data.bloat || {};

  const row = (label, value, color = '') =>
    `<tr><td class="lbl">${label}</td><td class="val" style="color:${color || 'inherit'}">${value || '—'}</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>REFLEXA Network Report — ${d}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#fff; color:#0F172A; padding:32px; font-size:13px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #00D4FF; }
  .logo { font-size:28px; font-weight:900; letter-spacing:2px; color:#00D4FF; }
  .logo-sub { font-size:11px; color:#64748B; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
  .date { text-align:right; font-size:12px; color:#64748B; }
  .grade-box { display:inline-block; font-size:64px; font-weight:900; color:${score.color || '#10B981'}; line-height:1; }
  .summary { display:grid; grid-template-columns:auto 1fr; gap:24px; background:#F8FAFF; border-radius:12px; padding:20px; margin-bottom:20px; }
  .summary-right h2 { font-size:14px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
  .summary-right .score-num { font-size:22px; font-weight:800; color:${score.color || '#10B981'}; }
  .summary-right .itu { font-size:13px; color:#0F172A; font-weight:600; margin-top:4px; }
  .summary-right .itu-sub { font-size:11px; color:#64748B; }
  .section { margin-bottom:18px; }
  .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#64748B; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #E2E8F0; }
  table { width:100%; border-collapse:collapse; }
  tr:nth-child(even) { background:#F8FAFF; }
  td { padding:7px 10px; }
  td.lbl { color:#64748B; font-weight:600; width:45%; }
  td.val { font-weight:700; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .recs { background:#FFF7ED; border:1px solid #FED7AA; border-radius:8px; padding:14px; }
  .rec-item { font-size:12px; color:#92400E; margin-bottom:4px; }
  .footer { margin-top:24px; padding-top:12px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; font-size:10px; color:#94A3B8; }
  .hist-table { width:100%; border-collapse:collapse; font-size:11px; }
  .hist-table th { background:#F1F5F9; padding:6px 8px; text-align:left; font-weight:700; color:#64748B; }
  .hist-table td { padding:5px 8px; border-bottom:1px solid #F1F5F9; }
  @media print {
    body { padding:16px; }
    @page { margin:1cm; size:A4; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">REFLEXA</div>
    <div class="logo-sub">Advanced Network Diagnostic Report</div>
  </div>
  <div class="date">
    <div>${d}</div>
    <div style="margin-top:4px">v3.0.0</div>
  </div>
</div>

<!-- Summary -->
<div class="summary">
  <div class="grade-box">${score.letter || '—'}</div>
  <div class="summary-right">
    <h2>Network Score</h2>
    <div class="score-num">${score.score || '—'}/100</div>
    <div class="itu">${itu.label || ''} ${itu.description ? '— ' + itu.description : ''}</div>
    <div class="itu-sub">ITU-T Y.1541 Classification · MOS Score: ${mos.score || '—'} (${mos.label || '—'})</div>
  </div>
</div>

<div class="grid2">
  <!-- Speed Metrics -->
  <div class="section">
    <div class="section-title">Speed Metrics (RFC 6349)</div>
    <table>
      ${row('Download', data.dl ? data.dl.toFixed(2) + ' Mbps' : '—', '#00D4FF')}
      ${row('Upload', data.ul ? data.ul.toFixed(2) + ' Mbps' : '—', '#8B5CF6')}
      ${row('TCP Efficiency', rfc.tcpEfficiency ? rfc.tcpEfficiency + '%' : '—', rfc.compliant ? '#10B981' : '#F59E0B')}
      ${row('Transfer Time Ratio', rfc.ttr || '—')}
      ${row('Bandwidth-Delay Product', rfc.bdp || '—')}
      ${row('Retransmission Rate', rfc.retransmitRate ? rfc.retransmitRate + '%' : '—')}
    </table>
  </div>

  <!-- Latency Analysis -->
  <div class="section">
    <div class="section-title">Latency Analysis</div>
    <table>
      ${row('Ping (Min RTT)', data.ping ? data.ping + ' ms' : '—', '#10B981')}
      ${row('Mean RTT', data.mean ? data.mean + ' ms' : '—')}
      ${row('Jitter', data.jitter ? data.jitter + ' ms' : '—', '#F59E0B')}
      ${row('P95 Latency', data.p95 ? data.p95 + ' ms' : '—')}
      ${row('P99 Latency', data.p99 ? data.p99 + ' ms' : '—')}
      ${row('MOS Score (G.107)', mos.score ? mos.score + ' — ' + mos.label : '—', mos.color)}
    </table>
  </div>

  <!-- Reliability -->
  <div class="section">
    <div class="section-title">Reliability</div>
    <table>
      ${row('Packet Loss', data.loss !== undefined ? data.loss + '%' : '—', data.loss === 0 ? '#10B981' : '#EF4444')}
      ${row('Bufferbloat Grade', bloat.grade || '—', bloat.color)}
      ${row('Bufferbloat Increase', bloat.increase ? bloat.increase + '%' : '—')}
      ${row('Baseline RTT', bloat.baseline ? bloat.baseline + ' ms' : '—')}
      ${row('Loaded RTT', bloat.loaded ? bloat.loaded + ' ms' : '—')}
    </table>
  </div>

  <!-- Standards Compliance -->
  <div class="section">
    <div class="section-title">Standards Compliance</div>
    <table>
      ${row('ITU-T Y.1541 Class', itu.label + (itu.description ? ' — ' + itu.description : ''), itu.color)}
      ${row('RFC 6349 Grade', rfc.grade || '—', rfc.compliant ? '#10B981' : '#F59E0B')}
      ${row('RFC 7567 Bufferbloat', bloat.grade ? 'Grade ' + bloat.grade + ' — ' + bloat.label : '—', bloat.color)}
      ${row('ITU-T G.107 MOS', mos.r_factor ? 'R-Factor: ' + mos.r_factor : '—')}
    </table>
  </div>
</div>

${bloat.advice ? `
<div class="section">
  <div class="recs">
    <div style="font-weight:700;margin-bottom:6px;color:#92400E">Recommendations</div>
    <div class="rec-item">• ${bloat.advice}</div>
  </div>
</div>` : ''}

${history.length > 0 ? `
<div class="section">
  <div class="section-title">Test History (Last ${history.length} Tests)</div>
  <table class="hist-table">
    <thead><tr><th>Date</th><th>Time</th><th>↓ Mbps</th><th>↑ Mbps</th><th>Ping</th><th>Grade</th><th>MOS</th></tr></thead>
    <tbody>
      ${history.slice(-10).map(r => `<tr>
        <td>${r.date || ''}</td><td>${r.time || ''}</td>
        <td>${r.dl?.toFixed(1) || '—'}</td><td>${r.ul?.toFixed(1) || '—'}</td>
        <td>${r.ping || '—'} ms</td><td><strong>${r.grade || '—'}</strong></td>
        <td>${r.mos || '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<div class="footer">
  <span>REFLEXA v3.0 — Advanced Network Diagnostic Tool</span>
  <span>By Eng. Mohanad Al-Mothafer · lhk96l.github.io/reflexa</span>
</div>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    // Fallback: download as HTML if popup blocked
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `REFLEXA-Report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ── Text Copy Result ──────────────────────────────────────────────
export function buildShareText(data, lang = 'en') {
  const isAr = lang === 'ar';
  const lines = [
    isAr ? '📊 نتائج اختبار REFLEXA للشبكة' : '📊 REFLEXA Network Test Results',
    '─────────────────────────────',
    isAr ? `⬇ التنزيل : ${data.dl?.toFixed(1) || '—'} Mbps` : `⬇ Download  : ${data.dl?.toFixed(1) || '—'} Mbps`,
    isAr ? `⬆ الرفع    : ${data.ul?.toFixed(1) || '—'} Mbps` : `⬆ Upload    : ${data.ul?.toFixed(1) || '—'} Mbps`,
    isAr ? `📡 الاستجابة: ${data.ping || '—'} ms`            : `📡 Ping     : ${data.ping || '—'} ms`,
    isAr ? `〰 الاهتزاز  : ${data.jitter || '—'} ms`         : `〰 Jitter   : ${data.jitter || '—'} ms`,
    isAr ? `📦 فقدان الحزم: ${data.loss || 0}%`              : `📦 Pkt Loss : ${data.loss || 0}%`,
    data.bloat ? (isAr ? `🌊 Bufferbloat: ${data.bloat.grade}` : `🌊 Bufferbloat: ${data.bloat.grade}`) : '',
    data.mos   ? (isAr ? `🎵 MOS: ${data.mos.score} (${data.mos.label})` : `🎵 MOS Score: ${data.mos.score} (${data.mos.label})`) : '',
    data.score ? (isAr ? `🏆 التقييم: ${data.score.letter} (${data.score.score}/100)` : `🏆 Score    : ${data.score.letter} (${data.score.score}/100)`) : '',
    data.itu   ? (isAr ? `📋 تصنيف ITU-T: ${data.itu.label} — ${data.itu.description}` : `📋 ITU-T    : ${data.itu.label} — ${data.itu.description}`) : '',
    '─────────────────────────────',
    '🌐 https://lhk96l.github.io/reflexa/',
  ].filter(Boolean);

  return lines.join('\n');
}
