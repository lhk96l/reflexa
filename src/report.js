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
