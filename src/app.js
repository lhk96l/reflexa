// REFLEXA v3.0 — Main Application Orchestrator
import { i18n } from './i18n.js';
import { storage } from './storage.js';
import { license } from './license.js';
import { standards } from './standards.js';
import { collectNetworkInfo, formatConnectionType } from './network-info.js';
import { measureLatency, measurePacketLoss, measureDownload, measureUpload, measureBufferbloat, getNetworkTrace } from './tests/speed.js';
import { dnsBenchmark, detectDNSLeak, DNS_RESOLVERS } from './tests/dns.js';
import { detectWebRTCLeaks } from './tests/webrtc.js';
import { detectThrottling } from './tests/isp.js';
import { runProtocolAnalysis } from './tests/protocol.js';
import { runGeoLatency, GLOBAL_POPS } from './tests/geo-latency.js';
import { downloadPNG, downloadCSV, downloadPDF, buildShareText } from './report.js';

// ── State ─────────────────────────────────────────────────────────
const state = {
  testing: false,
  lastResult: null,
  networkInfo: null,
  proActive: false,
  history: [],
};

// ── Pro Management ────────────────────────────────────────────────
async function loadPro() {
  const key = await storage.get('pro_key', null);
  if (!key) { state.proActive = false; return; }
  if (license.isLegacyKey(key)) { state.proActive = true; return; }
  const result = await license.validate(key);
  state.proActive = result.valid;
  if (!result.valid) await storage.remove('pro_key');
}

async function activateLicense(key) {
  if (license.isLegacyKey(key)) {
    await storage.set('pro_key', key.trim().toUpperCase());
    state.proActive = true;
    return { valid: true };
  }
  const result = await license.validate(key);
  if (result.valid) {
    await storage.set('pro_key', key.trim().toUpperCase());
    state.proActive = true;
  }
  return result;
}

async function deactivatePro() {
  await storage.remove('pro_key');
  state.proActive = false;
}

// ── Freemium Control ──────────────────────────────────────────────
const FREE_LIMIT = 5;

async function canRunTest() {
  if (state.proActive) return true;
  const usage = await getUsage();
  return usage.count < FREE_LIMIT;
}

async function getUsage() {
  const today = new Date().toDateString();
  const u = await storage.get('usage', { date: today, count: 0 });
  if (u.date !== today) return { date: today, count: 0 };
  return u;
}

async function incrementUsage() {
  if (state.proActive) return;
  const u = await getUsage();
  u.count++;
  await storage.set('usage', u);
}

// ── History ───────────────────────────────────────────────────────
async function loadHistory() {
  state.history = await storage.get('history', []);
}

async function saveToHistory(result) {
  await loadHistory();
  state.history.push({
    ...result,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ts: Date.now(),
  });
  const limit = state.proActive ? 30 : 10;
  if (state.history.length > limit) state.history = state.history.slice(-limit);
  await storage.set('history', state.history);
}

// ── UI Utilities ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function setFreemiumUI() {
  getUsage().then(u => {
    const used = u.count;
    const dots = $('freeDots');
    if (!dots) return;
    dots.innerHTML = '';

    if (state.proActive) {
      for (let i = 0; i < 5; i++) {
        const d = document.createElement('div');
        d.className = 'fdot pro';
        dots.appendChild(d);
      }
      $('freeText').innerHTML = `<b style="color:var(--cyan)">👑 ${i18n.t('unlimited')}</b>`;
    } else {
      for (let i = 0; i < FREE_LIMIT; i++) {
        const d = document.createElement('div');
        d.className = 'fdot' + (i < used ? (used >= FREE_LIMIT ? ' done' : used >= 4 ? ' warn' : ' lit') : '');
        dots.appendChild(d);
      }
      $('freeText').innerHTML = `${i18n.t('freeUsage')} <b>${used}/${FREE_LIMIT}</b> ${i18n.t('freeOf')}`;
    }

    const proBanner = $('proBanner');
    if (proBanner) proBanner.classList.toggle('show', state.proActive);
    const btnPro = document.querySelector('.btn-pro');
    if (btnPro) btnPro.style.display = state.proActive ? 'none' : '';
  });
}

// ── Gauge ─────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 120;
function setGauge(val, max) {
  const fill = $('gaugeFill');
  if (fill) fill.style.strokeDashoffset = CIRC * (1 - Math.min(val / max, 1));
}
function setGaugeText(val, unit = 'Mbps') {
  const gv = $('gaugeVal'), gu = $('gaugeUnit');
  if (gv) gv.textContent = val === null ? '—' : val;
  if (gu) gu.textContent = unit;
}
function setPhaseText(key) {
  const el = $('gaugePhase');
  if (el) el.textContent = key ? i18n.t(key) : '';
}

// ── Step Indicator ────────────────────────────────────────────────
function setStep(n) {
  for (let i = 1; i <= 5; i++) {
    const dot = $('s' + i);
    if (dot) dot.className = 'step-dot' + (i < n ? ' done' : i === n ? ' active' : '');
    if (i < 5) {
      const line = $('l' + i);
      if (line) line.className = 'step-line' + (i < n ? ' done' : '');
    }
  }
}

// ── Result Cards ──────────────────────────────────────────────────
function setMetric(id, val, unit, color) {
  const el = $(id);
  if (!el) return;
  el.textContent = val;
  if (color) el.style.color = color;
}

function setResultCard(type, mbps, max) {
  const card = $(`${type}Card`);
  const val  = $(`${type}Val`);
  const bar  = $(`${type}Bar`);
  if (card) card.classList.add('active');
  const unit = type === 'png' ? 'ms' : 'Mbps';
  if (val) val.innerHTML = `${typeof mbps === 'number' ? mbps.toFixed(1) : mbps} <span>${unit}</span>`;
  if (bar) setTimeout(() => { bar.style.width = Math.min((mbps / max) * 100, 100) + '%'; }, 50);
}

// ── Advanced Metrics Panel ────────────────────────────────────────
function updateAdvancedMetrics(latency, rfc, itu, mos) {
  if (!$('advPanel')) return;

  if (latency) {
    setMetric('metP95',    latency.p95 + ' ms', null, null);
    setMetric('metP99',    latency.p99 + ' ms', null, null);
    setMetric('metMean',   latency.mean + ' ms', null, null);
  }
  if (rfc) {
    setMetric('metTCPEff', rfc.tcpEfficiency + '%', null, rfc.compliant ? 'var(--green)' : 'var(--orange)');
    setMetric('metBDP',    rfc.bdp, null, null);
    setMetric('metTTR',    rfc.ttr, null, rfc.grade === 'A' ? 'var(--green)' : 'var(--orange)');
    setMetric('metRFC',    'RFC 6349: ' + rfc.grade, null, rfc.compliant ? 'var(--green)' : 'var(--red)');
  }
  if (itu) {
    setMetric('metITU', `${itu.label} — ${itu.description}`, null, itu.color);
  }
  if (mos) {
    setMetric('metMOS', `${mos.score} (${mos.label})`, null, mos.color);
  }
}

// ── Chart ─────────────────────────────────────────────────────────
let _chart = null;

function updateChart() {
  const canvas = $('histChart');
  if (!canvas || !window.Chart) return;

  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gc = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tc = dark ? '#64748B' : '#94A3B8';

  const labels = state.history.map(r => r.time);
  const dlD    = state.history.map(r => +r.dl?.toFixed(1) || 0);
  const ulD    = state.history.map(r => +r.ul?.toFixed(1) || 0);

  if (!_chart) {
    const ctx = canvas.getContext('2d');
    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: i18n.t('download'), data: dlD, borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.07)', borderWidth: 2.5, pointBackgroundColor: '#00D4FF', pointRadius: 3, tension: 0.4, fill: true },
          { label: i18n.t('upload'),   data: ulD, borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.07)', borderWidth: 2.5, pointBackgroundColor: '#8B5CF6', pointRadius: 3, tension: 0.4, fill: true },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
          y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 } }, beginAtZero: true }
        }
      }
    });
  } else {
    _chart.data.labels = labels;
    _chart.data.datasets[0].data = dlD;
    _chart.data.datasets[1].data = ulD;
    _chart.update();
  }
}

// ── Network Info UI ───────────────────────────────────────────────
function renderNetworkInfo(info) {
  if (!info) return;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v || '—'; };
  const loc = [info.flag, info.city, info.country].filter(Boolean).join(' ');
  set('netIP',       info.ip);
  set('netISP',      info.isp || info.org);
  set('netLocation', loc);
  set('netType',     formatConnectionType(info));
  set('netServer',   `Cloudflare — ${info.coloCity || info.colo || '—'}`);
  set('netASN',      info.asn);
  set('netStatus',   navigator.onLine ? i18n.t('statusOnline') : i18n.t('statusOffline'));
  set('netTLS',      info.tls);
  set('netHTTP',     info.http);
  if (info.warp && $('netWarp')) $('netWarp').textContent = '✅ Cloudflare WARP';
}

// ── DNS UI ────────────────────────────────────────────────────────
function renderDNSResults(results) {
  const container = $('dnsResults');
  if (!container) return;
  container.innerHTML = '';

  Object.values(results).forEach(r => {
    const div = document.createElement('div');
    div.className = 'dns-row' + (r.recommended ? ' dns-recommended' : '');
    if (r.error) {
      div.innerHTML = `<span class="dns-name">${r.resolver.icon} ${r.resolver.name}</span><span class="dns-err">Error</span>`;
    } else {
      const bar = Math.min(100, (r.avg / 200) * 100);
      div.innerHTML = `
        <span class="dns-name">${r.resolver.icon} ${r.resolver.name}${r.recommended ? ' ⭐' : ''}</span>
        <div class="dns-bars">
          <div class="dns-bar-wrap"><div class="dns-bar-fill" style="width:${100-bar}%"></div></div>
        </div>
        <span class="dns-stat">${r.avg}ms avg</span>
        <span class="dns-stat dim">${r.p95}ms p95</span>
        <span class="dns-reliability ${r.reliability === 100 ? 'good' : 'warn'}">${r.reliability}%</span>
      `;
    }
    container.appendChild(div);
  });
}

// ── WebRTC UI ─────────────────────────────────────────────────────
function renderWebRTCResults(result) {
  const container = $('webrtcResults');
  if (!container) return;

  const riskBadge = `<span class="risk-badge" style="color:${result.riskColor}">${result.riskLevel}</span>`;
  const ips = [
    result.publicIPs.length  ? `Public IPv4: ${result.publicIPs.join(', ')}`    : '',
    result.privateIPs.length ? `Private LAN: ${result.privateIPs.join(', ')}`   : '',
    result.ipv6IPs.length    ? `IPv6: ${result.ipv6IPs.slice(0,2).join(', ')}` : '',
  ].filter(Boolean);

  container.innerHTML = `
    <div class="webrtc-verdict">${riskBadge} ${result.verdict}</div>
    ${ips.length ? `<div class="webrtc-ips">${ips.map(ip => `<div class="ip-row">${ip}</div>`).join('')}</div>` : ''}
    ${result.recommendations.length ? `
      <div class="webrtc-recs">
        ${result.recommendations.map(r => `<div class="rec-item">⚠️ ${r}</div>`).join('')}
      </div>` : '<div class="webrtc-ok">✅ No action needed</div>'}
  `;
}

// ── ISP Throttle UI ──────────────────────────────────────────────
function renderThrottleResults(result) {
  const container = $('throttleResults');
  if (!container) return;

  const max = parseFloat(result.maxSpeed);
  const rows = Object.values(result.results).map(r => {
    const mbps = r.result?.mbps || 0;
    const pct  = max > 0 ? Math.min(100, (mbps / max) * 100) : 0;
    const throttled = result.throttledServices.includes(r.name);
    return `
      <div class="throttle-row ${throttled ? 'throttled' : ''}">
        <span class="thr-name">${r.icon} ${r.name}</span>
        <div class="thr-bar-wrap">
          <div class="thr-bar-fill" style="width:${pct}%;background:${throttled ? '#EF4444' : '#10B981'}"></div>
        </div>
        <span class="thr-val">${mbps ? mbps.toFixed(1) + ' Mbps' : 'Error'}</span>
        ${throttled ? '<span class="thr-badge">Throttled</span>' : ''}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="throttle-verdict ${result.throttlingDetected ? 'detected' : 'ok'}">
      ${result.throttlingDetected ? '⚠️' : '✅'} ${result.verdict}
    </div>
    <div class="throttle-meta">
      Variance: ${result.variancePct}% · Confidence: ${result.confidence}
    </div>
    ${rows}
  `;
}

// ── Protocol UI ──────────────────────────────────────────────────
function renderProtocolResults(result) {
  const container = $('protocolResults');
  if (!container) return;

  const items = result.summary.map(s => `
    <div class="proto-item">
      <span class="proto-ic">${s.ok ? '✅' : '❌'}</span>
      <span class="proto-label">${s.label}</span>
      <span class="proto-val ${s.ok ? 'good' : 'warn'}">${s.value}</span>
    </div>`).join('');

  container.innerHTML = `
    <div class="proto-grade">Protocol Grade: <span style="color:${result.grade === 'A+' || result.grade === 'A' ? '#10B981' : '#F59E0B'}">${result.grade}</span> (${result.score}/100)</div>
    <div class="proto-grid">${items}</div>
  `;
}

// ── Geo Latency UI ───────────────────────────────────────────────
function renderGeoLatency(result) {
  const container = $('geoResults');
  if (!container) return;

  // Top 5 nearest
  const nearestHTML = result.nearest.map(p =>
    `<div class="geo-row"><span class="geo-flag">${p.country}</span> <span class="geo-city">${p.city}</span> <span class="geo-rtt" style="color:${p.color}">${p.label}</span></div>`
  ).join('');

  // All by region
  const regions = { ME: '🌙 Middle East', EU: '🇪🇺 Europe', US: '🌎 Americas', AP: '🌏 Asia Pacific', AF: '🌍 Africa', SA: '🌎 South America' };
  const regionHTML = Object.entries(regions).map(([code, label]) => {
    const pops = Object.values(result.pops).filter(p => p.region === code && p.rtt);
    if (!pops.length) return '';
    return `
      <div class="geo-region">
        <div class="geo-region-title">${label}</div>
        ${pops.map(p => `<div class="geo-pop"><span>${p.city}</span><span style="color:${p.color}">${p.label}</span></div>`).join('')}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="geo-nearest"><strong>5 Nearest Servers:</strong>${nearestHTML}</div>
    <div class="geo-avg">Global Average: <strong>${result.avgGlobal ? result.avgGlobal + 'ms' : '—'}</strong></div>
    <div class="geo-regions">${regionHTML}</div>
  `;
}

// ── MAIN TEST SEQUENCE ────────────────────────────────────────────
async function startTest() {
  if (state.testing) return;
  if (!await canRunTest()) {
    $('testStatus').textContent = i18n.t('limitReached');
    showModal('proOverlay');
    return;
  }

  state.testing = true;
  const btn = $('startBtn');
  btn.disabled = true;
  btn.classList.add('running');
  $('startBtnTxt').textContent = i18n.t('testing');
  $('retryBtn')?.classList.remove('show');
  $('shareBar')?.classList.remove('show');

  // Reset UI
  ['dl', 'ul', 'png'].forEach(id => {
    $(`${id}Card`)?.classList.remove('active');
    const v = $(`${id}Val`);
    if (v) v.innerHTML = `— <span>${id === 'png' ? 'ms' : 'Mbps'}</span>`;
    const b = $(`${id}Bar`);
    if (b) b.style.width = '0';
  });
  ['jitterVal','lossVal','bloatVal','scoreGrade','scoreNum'].forEach(id => {
    const el = $(id); if (el) { el.textContent = '—'; el.style.color = ''; }
  });
  if ($('scoreLabel')) $('scoreLabel').textContent = i18n.t('loading');
  setGauge(0, 100); setGaugeText(null); setStep(0);

  const result = {};

  try {
    // ── Step 1: Latency ──────────────────────────────────────────
    setStep(1); setPhaseText('phasePing');
    $('testStatus').textContent = i18n.t('phasePing');
    $('pngCard')?.classList.add('active');

    const latency = await measureLatency();
    result.ping   = latency.ping;
    result.jitter = latency.jitter;
    result.p95    = latency.p95;
    result.p99    = latency.p99;
    result.mean   = latency.mean;

    setResultCard('png', latency.ping, 200);
    setMetric('jitterVal', latency.jitter);
    setGaugeText(latency.ping, 'ms');
    updateAdvancedMetrics(latency, null, null, null);

    // ── Step 2: Packet Loss ──────────────────────────────────────
    setStep(2); setPhaseText('phaseLoss');
    $('testStatus').textContent = i18n.t('phaseLoss');

    const loss = await measurePacketLoss();
    result.loss = loss;
    setMetric('lossVal', loss, null, loss === 0 ? 'var(--green)' : loss < 2 ? 'var(--orange)' : 'var(--red)');

    // ── Step 3: Download ─────────────────────────────────────────
    setStep(3); setPhaseText('phaseDL');
    $('testStatus').textContent = i18n.t('phaseDL');
    $('dlCard')?.classList.add('active');
    setGaugeText(0);
    let dlPeak = 0;

    const dl = await measureDownload((mbps, peak) => {
      if (peak > dlPeak) dlPeak = peak;
      setGauge(mbps, Math.max(dlPeak * 1.3, 10));
      setGaugeText(mbps.toFixed(1));
      const v = $('dlVal');
      if (v) v.innerHTML = `${mbps.toFixed(1)} <span>Mbps</span>`;
    });
    result.dl = dl.mbps;
    setResultCard('dl', dl.mbps, Math.max(dl.mbps * 1.5, 100));

    // ── Step 4: Upload ───────────────────────────────────────────
    setStep(4); setPhaseText('phaseUL');
    $('testStatus').textContent = i18n.t('phaseUL');
    $('ulCard')?.classList.add('active');
    setGaugeText(0);
    let ulPeak = 0;

    const ul = await measureUpload((mbps, peak) => {
      if (peak > ulPeak) ulPeak = peak;
      setGauge(mbps, Math.max(ulPeak * 1.3, 10));
      setGaugeText(mbps.toFixed(1));
      const v = $('ulVal');
      if (v) v.innerHTML = `${mbps.toFixed(1)} <span>Mbps</span>`;
    });
    result.ul = ul.mbps;
    setResultCard('ul', ul.mbps, Math.max(ul.mbps * 1.5, 100));

    // ── Step 5: Bufferbloat ──────────────────────────────────────
    setStep(5); setPhaseText('phaseBloat');
    $('testStatus').textContent = i18n.t('phaseBloat');

    const bloatRaw = await measureBufferbloat(latency.ping);
    const bloat = standards.bufferbloatGrade(bloatRaw.baseline, bloatRaw.loaded);
    result.bloat = bloat;

    setMetric('bloatVal', bloat?.grade || '—', null, bloat?.color);
    const bn = $('bloatNote');
    if (bn) bn.textContent = bloat?.label || i18n.t('notTested');

    // ── Scoring ──────────────────────────────────────────────────
    const rfc = standards.rfc6349(result.dl, result.ul, result.ping);
    const itu = standards.ituY1541(result.ping, result.jitter, result.loss);
    const mos = standards.mosScore(result.ping, result.jitter, result.loss);
    const score = standards.overallScore(result.dl, result.ul, result.ping, result.jitter, result.loss);

    result.rfc   = rfc;
    result.itu   = itu;
    result.mos   = mos;
    result.score = score;

    // Show score
    setMetric('scoreGrade', score.letter, null, score.color);
    setMetric('scoreNum',   score.score + '/100', null, score.color);
    if ($('scoreLabel')) $('scoreLabel').textContent = itu.label + ' — ' + itu.description;

    // Show ITU-T class badge
    if ($('ituBadge')) {
      $('ituBadge').textContent = `${itu.label}: ${itu.description}`;
      $('ituBadge').style.color = itu.color;
    }

    // Update advanced panel
    updateAdvancedMetrics(latency, rfc, itu, mos);

    // Done!
    setPhaseText('phaseDone');
    $('testStatus').textContent = i18n.t('phaseDone');
    setGauge(result.dl, Math.max(result.dl * 1.5, 100));
    setGaugeText(result.dl.toFixed(1));

    state.lastResult = result;
    await incrementUsage();
    await saveToHistory({
      dl: result.dl, ul: result.ul,
      ping: result.ping, jitter: result.jitter, loss: result.loss,
      bloatGrade: bloat?.grade,
      mos: mos.score, score: score.score, grade: score.letter,
      tcpEff: rfc.tcpEfficiency, p95: result.p95,
      ituClass: itu.class,
      isp: state.networkInfo?.isp,
    });

    updateChart();
    $('shareBar')?.classList.add('show');

  } catch (err) {
    setPhaseText('');
    $('testStatus').textContent = '⚠️ Test failed — check your connection';
    $('retryBtn')?.classList.add('show');
    setGauge(0, 100); setGaugeText(null);
    console.error('[REFLEXA]', err);
  } finally {
    state.testing = false;
    btn.disabled = false;
    btn.classList.remove('running');
    $('startBtnTxt').textContent = i18n.t('startTest');
    setFreemiumUI();
  }
}

// ── DNS Benchmark Trigger ─────────────────────────────────────────
async function runDNS() {
  const btn = $('dnsStartBtn');
  const status = $('dnsStatus');
  const container = $('dnsResults');
  if (btn) { btn.disabled = true; btn.textContent = i18n.t('dnsRunning'); }
  if (status) status.textContent = i18n.t('dnsRunning');
  if (container) container.innerHTML = '<div class="loading-dots">⋯</div>';

  try {
    const results = await dnsBenchmark((name, i, total) => {
      if (status) status.textContent = `Testing ${name}… (${i + 1}/${total})`;
    });
    renderDNSResults(results);

    // Also run leak test
    const leakStatus = $('dnsLeakStatus');
    if (leakStatus) leakStatus.textContent = 'Checking for DNS leaks…';
    const leak = await detectDNSLeak();
    if (leakStatus) {
      leakStatus.textContent = leak.leakSuspected ? `⚠️ ${i18n.t('dnsLeakFound')}` : `✅ ${i18n.t('dnsLeakNone')}`;
      leakStatus.style.color = leak.leakSuspected ? 'var(--orange)' : 'var(--green)';
    }
    if ($('dnsLeakDetail')) {
      $('dnsLeakDetail').textContent = leak.verdict;
    }
    if (status) status.textContent = `✅ Benchmark complete — ${Object.keys(results).length} resolvers tested`;
  } catch (err) {
    if (status) status.textContent = '⚠️ DNS test failed';
    console.error('[REFLEXA DNS]', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = i18n.t('dnsStart'); }
  }
}

// ── WebRTC Trigger ────────────────────────────────────────────────
async function runWebRTC() {
  const btn = $('webrtcStartBtn');
  const status = $('webrtcStatus');
  if (btn) { btn.disabled = true; btn.textContent = i18n.t('webrtcRunning'); }
  if (status) status.textContent = i18n.t('webrtcRunning');
  if ($('webrtcResults')) $('webrtcResults').innerHTML = '<div class="loading-dots">⋯</div>';

  try {
    const result = await detectWebRTCLeaks();
    renderWebRTCResults(result);
    if (status) status.textContent = `✅ WebRTC scan complete — ${result.candidateCount} candidates found`;
  } catch (err) {
    if (status) status.textContent = '⚠️ WebRTC test failed';
    console.error('[REFLEXA WebRTC]', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = i18n.t('webrtcStart'); }
  }
}

// ── Throttle Trigger ──────────────────────────────────────────────
async function runThrottle() {
  const btn = $('throttleStartBtn');
  const status = $('throttleStatus');
  if (btn) { btn.disabled = true; btn.textContent = i18n.t('ispRunning'); }
  if (status) status.textContent = i18n.t('ispRunning');
  if ($('throttleResults')) $('throttleResults').innerHTML = '<div class="loading-dots">⋯</div>';

  try {
    const result = await detectThrottling((name, i, total) => {
      if (status) status.textContent = `Testing ${name}… (${i + 1}/${total})`;
    });
    renderThrottleResults(result);
    if (status) status.textContent = result.throttlingDetected ? `⚠️ ${i18n.t('ispDetected')}` : `✅ ${i18n.t('ispNone')}`;
  } catch (err) {
    if (status) status.textContent = '⚠️ Throttle test failed';
    console.error('[REFLEXA Throttle]', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = i18n.t('ispStart'); }
  }
}

// ── Protocol Analysis Trigger ─────────────────────────────────────
async function runProtocol() {
  if ($('protocolResults')) $('protocolResults').innerHTML = '<div class="loading-dots">Detecting protocols…</div>';
  try {
    const result = await runProtocolAnalysis();
    renderProtocolResults(result);
    // Also update IPv6 card in main panel
    const ipv6El = $('ipv6Val');
    if (ipv6El) {
      ipv6El.textContent = result.ipv6.supported ? '✅' : '❌';
      const ipv6Note = $('ipv6Note');
      if (ipv6Note) ipv6Note.textContent = result.ipv6.supported ? `Active (${result.ipv6.address})` : 'Not supported';
    }
  } catch (err) {
    if ($('protocolResults')) $('protocolResults').textContent = '⚠️ Protocol detection failed';
  }
}

// ── Geo Latency Trigger ───────────────────────────────────────────
async function runGeo() {
  const btn = $('geoStartBtn');
  const status = $('geoStatus');
  if (btn) { btn.disabled = true; btn.textContent = i18n.t('geoRunning'); }
  if (status) status.textContent = i18n.t('geoRunning');
  if ($('geoResults')) $('geoResults').innerHTML = '<div class="loading-dots">⋯</div>';

  try {
    const result = await runGeoLatency((done, total) => {
      if (status) status.textContent = `Pinging servers… ${done}/${total}`;
    });
    renderGeoLatency(result);
    if (status) status.textContent = `✅ Measured ${Object.values(result.pops).filter(p => p.rtt).length} global servers`;
  } catch (err) {
    if (status) status.textContent = '⚠️ Geo latency test failed';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = i18n.t('geoStart'); }
  }
}

// ── Share / Export ────────────────────────────────────────────────
function doDownloadPNG()  { if (state.lastResult) downloadPNG(state.lastResult); }
function doDownloadCSV()  {
  if (!state.proActive) { showModal('proOverlay'); return; }
  downloadCSV(state.history);
}
function doDownloadPDF() {
  if (!state.proActive) { showModal('proOverlay'); return; }
  if (!state.lastResult) return;
  downloadPDF(state.lastResult, state.history);
}
function doCopyResult() {
  if (!state.lastResult) return;
  const text = buildShareText(state.lastResult, i18n.lang);
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('copyBtn');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✅ ' + i18n.t('copied');
    setTimeout(() => btn.textContent = orig, 2000);
  });
}
function doShare() {
  if (!state.lastResult) return;
  const text = buildShareText(state.lastResult, i18n.lang);
  if (navigator.share) {
    navigator.share({ title: 'REFLEXA', text, url: 'https://lhk96l.github.io/reflexa/' }).catch(() => {});
  } else {
    doCopyResult();
  }
}

// ── Modal Management ──────────────────────────────────────────────
function showModal(id) { $(id)?.classList.add('show'); }
function hideModal(id) { $(id)?.classList.remove('show'); }

async function handleActivate() {
  const key = $('licenseInput')?.value || '';
  const errEl = $('keyError');
  if (!key) { if (errEl) { errEl.textContent = i18n.t('keyInvalid'); errEl.className = 'key-error'; } return; }

  const result = await activateLicense(key);
  if (result.valid) {
    if (errEl) { errEl.className = 'key-success'; errEl.textContent = i18n.t('proActivated'); }
    setFreemiumUI();
    setTimeout(() => hideModal('activateOverlay'), 1800);
  } else {
    if (errEl) { errEl.className = 'key-error'; errEl.textContent = i18n.t('keyInvalid') + (result.reason ? ` (${result.reason})` : ''); }
  }
}

// ── Magic Link System ─────────────────────────────────────────────
const WORKER_URL = 'https://reflexa-license.hanodeking15.workers.dev';

// طلب Magic Link بالإيميل
async function handleMagicLinkRequest() {
  const emailInput = $('magicEmailInput');
  const statusEl   = $('magicStatus');
  const btn        = $('magicBtn');
  const email      = emailInput?.value?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    if (statusEl) { statusEl.textContent = 'Please enter a valid email'; statusEl.style.color = 'var(--red)'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  if (statusEl) { statusEl.textContent = 'Sending magic link…'; statusEl.style.color = 'var(--sub)'; }

  try {
    const res  = await fetch(`${WORKER_URL}/api/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (data.ok) {
      if (statusEl) {
        statusEl.style.color = 'var(--green)';
        statusEl.textContent = `✅ Magic link sent to ${email} — check your inbox (10 min)`;
      }
    } else {
      if (statusEl) {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = `⚠️ ${data.reason || 'No license found for this email'}`;
      }
    }
  } catch {
    if (statusEl) { statusEl.textContent = '⚠️ Connection error — try again'; statusEl.style.color = 'var(--red)'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📧 Send Magic Link'; }
  }
}

// معالجة التوكن عند فتح الصفحة (?rxflx_token=...)
async function checkMagicToken() {
  const params = new URLSearchParams(location.search);
  const token  = params.get('rxflx_token');
  if (!token) return;

  // أزل التوكن من URL بدون تحديث الصفحة
  const cleanUrl = location.pathname;
  history.replaceState({}, '', cleanUrl);

  // أظهر رسالة انتظار
  const notify = document.createElement('div');
  notify.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--cyan);border-radius:12px;padding:14px 24px;z-index:999;font-size:13px;color:var(--cyan);box-shadow:0 4px 20px rgba(0,212,255,.2)';
  notify.textContent = '🔗 Verifying magic link…';
  document.body.appendChild(notify);

  try {
    const res  = await fetch(`${WORKER_URL}/api/activate?rxflx_token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (data.valid && data.key) {
      // تفعيل Pro مباشرة
      await activateLicense(data.key);
      state.proActive = true;
      setFreemiumUI();
      notify.style.borderColor = 'var(--green)';
      notify.style.color = 'var(--green)';
      notify.innerHTML  = `✅ REFLEXA Pro activated! Welcome back 👑`;
      setTimeout(() => notify.remove(), 4000);
    } else {
      notify.style.borderColor = 'var(--red)';
      notify.style.color = 'var(--red)';
      notify.textContent = `⚠️ ${data.reason || 'Invalid or expired link'}`;
      setTimeout(() => notify.remove(), 5000);
    }
  } catch {
    notify.textContent = '⚠️ Connection error — try again';
    setTimeout(() => notify.remove(), 4000);
  }
}

// ── Tab Navigation ────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabName));

  // Auto-run protocol analysis when security tab is opened
  if (tabName === 'security' && $('protocolResults') && !$('protocolResults').children.length) {
    runProtocol();
  }
}

// ── Theme ─────────────────────────────────────────────────────────
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  const newTheme = dark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  storage.pref.set('theme', newTheme);
  $('themeBtn').textContent = newTheme === 'dark' ? '🌙' : '☀️';
  updateChart();
}

// ── PWA Install ───────────────────────────────────────────────────
let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); _deferredPrompt = e;
  $('installBtn')?.classList.add('show');
});
function installPWA() {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then(() => { _deferredPrompt = null; $('installBtn')?.classList.remove('show'); });
}

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  // Theme
  const savedTheme = storage.pref.get('theme', 'dark');
  document.documentElement.setAttribute('data-theme', savedTheme);
  $('themeBtn').textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  // Language
  i18n.apply();

  // Pro
  await loadPro();
  setFreemiumUI();

  // History
  await loadHistory();
  updateChart();

  // Network info (background)
  collectNetworkInfo().then(info => {
    state.networkInfo = info;
    renderNetworkInfo(info);
  });

  // IPv6 + Protocol (auto)
  runProtocol();

  // Service Worker — مع كشف التحديثات التلقائي
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('./sw.js').catch(() => null);
    if (reg) {
      // كشف تحديث جديد وإعلام المستخدم فوراً
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            // يوجد تحديث جاهز — أعد التحميل تلقائياً
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
            newSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }
  }

  // Online/offline
  window.addEventListener('online',  () => setMetric('netStatus', i18n.t('statusOnline')));
  window.addEventListener('offline', () => setMetric('netStatus', i18n.t('statusOffline')));

  // Keyboard: Enter to start test
  window.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !state.testing && document.activeElement.tagName !== 'INPUT') startTest();
  });

  // فحص Magic Token عند فتح الصفحة
  await checkMagicToken();

  // Expose to HTML onclick
  window.RXFLX = {
    startTest, runDNS, runWebRTC, runThrottle, runGeo,
    toggleTheme, installPWA,
    toggleLang: () => { i18n.toggle(); setFreemiumUI(); updateChart(); },
    switchTab,
    showModal, hideModal,
    handleActivate,
    handleMagicLinkRequest,
    deactivatePro: async () => { if (confirm('Deactivate Pro?')) { await deactivatePro(); setFreemiumUI(); } },
    goToCheckout: (plan = 'monthly') => {
      const urls = {
        monthly: 'https://lhk96l.lemonsqueezy.com/checkout/buy/55058b83-34ae-4f1e-b734-3fe21a5b9df4',
        annual:  'https://lhk96l.lemonsqueezy.com/checkout/buy/d91818cb-e840-41fa-918f-5afaac1956c9',
      };
      // استخدم location.href على الموبايل لتجنب حجب popup
      const url = urls[plan] || urls.monthly;
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) { window.location.href = url; } else { window.open(url, '_blank'); }
    },
    doDownloadPNG, doDownloadCSV, doDownloadPDF, doCopyResult, doShare,
    sendFeedback: () => window.open('mailto:hanodeking15@gmail.com?subject=REFLEXA%20Feedback'),
  };
}

init().catch(console.error);
