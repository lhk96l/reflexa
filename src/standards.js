// REFLEXA v3.0 — International Standards Engine
// RFC 6349, ITU-T Y.1541, ITU-T G.107 (E-Model), RFC 7567

export const standards = {

  // ── RFC 6349: TCP Throughput Testing ──────────────────────────────
  rfc6349(dl_mbps, ul_mbps, rtt_ms) {
    const dl_bps = dl_mbps * 1e6;
    const ul_bps = ul_mbps * 1e6;

    // Bandwidth-Delay Product (bytes)
    const bdp = (dl_bps * (rtt_ms / 1000)) / 8;

    // Theoretical max throughput at this RTT (simplified)
    const theoreticalMax = dl_mbps * 1.05; // 5% protocol overhead expected

    // TCP Efficiency = Goodput / Raw throughput (goal > 95%)
    const tcpEfficiency = Math.min(99.9, (dl_mbps / theoreticalMax) * 100);

    // Transfer Time Ratio = ideal / actual (goal: 1.0)
    // At 100% efficiency TTR = 1.0; overhead/retransmits push it toward 0
    const ttr = Math.min(1.0, tcpEfficiency / 100);

    // Retransmission rate estimate from efficiency
    const retransmitRate = Math.max(0, (100 - tcpEfficiency) * 0.5).toFixed(2);

    // BDP classification
    let bdpLabel;
    if (bdp < 1024) bdpLabel = bdp.toFixed(0) + ' B';
    else if (bdp < 1024 * 1024) bdpLabel = (bdp / 1024).toFixed(1) + ' KB';
    else bdpLabel = (bdp / (1024 * 1024)).toFixed(2) + ' MB';

    return {
      bdp: bdpLabel,
      bdp_bytes: bdp,
      tcpEfficiency: tcpEfficiency.toFixed(1),
      ttr: ttr.toFixed(3),
      retransmitRate,
      rwnd: (bdp * 2 / 1024).toFixed(0) + ' KB', // Optimal receive window
      grade: tcpEfficiency >= 95 ? 'A' : tcpEfficiency >= 85 ? 'B' : tcpEfficiency >= 70 ? 'C' : 'D',
      compliant: tcpEfficiency >= 95,
    };
  },

  // ── ITU-T Y.1541: IP Network Performance Classes ─────────────────
  ituY1541(delay_ms, jitter_ms, loss_pct) {
    const loss = loss_pct / 100;

    if (delay_ms < 100 && jitter_ms < 50 && loss < 0.001)
      return { class: 0, label: 'Class 0', description: 'Real-Time HD VoIP', color: '#10B981', excellent: true };
    if (delay_ms < 400 && jitter_ms < 50 && loss < 0.001)
      return { class: 1, label: 'Class 1', description: 'Interactive VoIP', color: '#10B981', excellent: false };
    if (delay_ms < 100 && loss < 0.001)
      return { class: 2, label: 'Class 2', description: 'Critical Data', color: '#00D4FF', excellent: false };
    if (delay_ms < 400 && loss < 0.001)
      return { class: 3, label: 'Class 3', description: 'Standard Data', color: '#F59E0B', excellent: false };
    if (loss < 0.001)
      return { class: 4, label: 'Class 4', description: 'Low Loss Data', color: '#F59E0B', excellent: false };
    return { class: 5, label: 'Class 5', description: 'Best Effort', color: '#EF4444', excellent: false };
  },

  // ── ITU-T G.107 E-Model: MOS Score ───────────────────────────────
  // Mean Opinion Score 1.0 (bad) → 4.5 (excellent)
  mosScore(rtt_ms, jitter_ms, loss_pct) {
    const d = rtt_ms / 2; // one-way delay
    const loss = loss_pct;

    // Impairment factors (simplified E-Model)
    const Id = 0.024 * d + 0.11 * Math.max(0, d - 177.3);
    const Ie = Math.min(30, loss * 2.5 + jitter_ms * 0.5);
    const A = 0; // no advantage factor for internet

    const R = Math.max(0, Math.min(100, 93.2 - Id - Ie + A));
    let mos;
    if (R < 0)   mos = 1.0;
    else if (R > 100) mos = 4.5;
    else mos = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
    mos = Math.max(1.0, Math.min(4.5, mos));

    let label, color;
    if (mos >= 4.3) { label = 'Excellent'; color = '#10B981'; }
    else if (mos >= 4.0) { label = 'Good'; color = '#10B981'; }
    else if (mos >= 3.6) { label = 'Fair'; color = '#F59E0B'; }
    else if (mos >= 3.1) { label = 'Poor'; color = '#EF4444'; }
    else { label = 'Bad'; color = '#EF4444'; }

    return { score: mos.toFixed(2), label, color, r_factor: R.toFixed(1) };
  },

  // ── RFC 7567 / Bufferbloat.net: Bufferbloat Grade ─────────────────
  bufferbloatGrade(baseline_ms, loaded_ms) {
    if (!baseline_ms || !loaded_ms) return null;
    const increase_pct = ((loaded_ms - baseline_ms) / baseline_ms) * 100;

    let grade, label, color, advice;
    if (increase_pct < 5) {
      grade = 'A+'; label = 'Excellent'; color = '#10B981';
      advice = 'Router uses FQ-CoDel/CAKE or has minimal buffering';
    } else if (increase_pct < 30) {
      grade = 'A'; label = 'Good'; color = '#10B981';
      advice = 'Minimal bufferbloat — acceptable for all use cases';
    } else if (increase_pct < 60) {
      grade = 'B'; label = 'Moderate'; color = '#F59E0B';
      advice = 'Some bufferbloat — may affect VoIP/gaming under load';
    } else if (increase_pct < 200) {
      grade = 'C'; label = 'Poor'; color = '#F59E0B';
      advice = 'Significant bufferbloat — enable SQM/FQ-CoDel in router';
    } else if (increase_pct < 400) {
      grade = 'D'; label = 'Bad'; color = '#EF4444';
      advice = 'Severe bufferbloat — router buffer fills under load';
    } else {
      grade = 'F'; label = 'Failing'; color = '#EF4444';
      advice = 'Critical bufferbloat — contact ISP or replace modem/router';
    }

    return {
      grade, label, color, advice,
      baseline: baseline_ms.toFixed(1),
      loaded: loaded_ms.toFixed(1),
      increase: increase_pct.toFixed(1),
    };
  },

  // ── Overall Network Score ─────────────────────────────────────────
  overallScore(dl, ul, ping, jitter, loss) {
    const dlS  = dl  > 100 ? 100 : dl  > 50 ? 92 : dl  > 25 ? 78 : dl  > 10 ? 58 : dl  > 5 ? 38 : 15;
    const ulS  = ul  >  50 ? 100 : ul  > 25 ? 92 : ul  > 10 ? 78 : ul  >  5 ? 58 : ul  > 2 ? 38 : 15;
    const pgS  = ping < 8  ? 100 : ping < 20 ? 93 : ping < 50 ? 80 : ping < 100 ? 60 : ping < 200 ? 35 : 10;
    const jtS  = jitter < 1 ? 100 : jitter < 3 ? 92 : jitter < 10 ? 75 : jitter < 25 ? 50 : 20;
    const lsS  = loss === 0 ? 100 : loss < 0.5 ? 88 : loss < 2 ? 65 : loss < 5 ? 40 : 10;

    const score = Math.round(dlS * 0.30 + ulS * 0.20 + pgS * 0.25 + jtS * 0.15 + lsS * 0.10);
    const letter = score >= 95 ? 'A+' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';
    const color  = score >= 80 ? '#10B981' : score >= 65 ? '#00D4FF' : score >= 50 ? '#F59E0B' : '#EF4444';
    return { score, letter, color };
  }
};
