// REFLEXA v3.0 — Real WebRTC IP Leak Detection
// Uses RTCPeerConnection ICE candidates to discover all IPs

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:3478' },
];

function classifyIP(ip) {
  if (/^10\./.test(ip))                         return 'private';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip))   return 'private';
  if (/^192\.168\./.test(ip))                   return 'private';
  if (/^169\.254\./.test(ip))                   return 'link-local';
  if (/^127\./.test(ip))                        return 'loopback';
  if (/^::1$/.test(ip))                         return 'loopback';
  if (/^fe80:/i.test(ip))                       return 'link-local-ipv6';
  if (ip.includes(':'))                         return 'ipv6-public';
  return 'public';
}

export async function detectWebRTCLeaks() {
  const ips = { public: [], private: [], ipv6: [], linkLocal: [] };
  const candidates = [];

  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    // Must create a data channel to trigger ICE gathering
    pc.createDataChannel('rxflx_probe');

    const timeout = setTimeout(() => {
      pc.close();
      resolve(buildResult(ips, candidates));
    }, 6000);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      const sdp = event.candidate.candidate;
      candidates.push(sdp);

      // Extract IPv4
      const ipv4Match = sdp.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
      if (ipv4Match) {
        const ip = ipv4Match[1];
        const type = classifyIP(ip);
        if (type === 'public'    && !ips.public.includes(ip))   ips.public.push(ip);
        if (type === 'private'   && !ips.private.includes(ip))  ips.private.push(ip);
        if (type === 'link-local'&& !ips.linkLocal.includes(ip))ips.linkLocal.push(ip);
      }

      // Extract IPv6
      const ipv6Match = sdp.match(/([a-f0-9]{1,4}(?::[a-f0-9]{0,4}){2,7})/i);
      if (ipv6Match) {
        const ip = ipv6Match[1];
        if (!ips.ipv6.includes(ip) && ip.includes(':') && ip.length > 4) {
          const type = classifyIP(ip);
          if (type === 'ipv6-public') ips.ipv6.push(ip);
        }
      }

      // If we have what we need, resolve early
      if (ips.public.length > 0 || ips.private.length >= 2) {
        clearTimeout(timeout);
        pc.close();
        resolve(buildResult(ips, candidates));
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        pc.close();
        resolve(buildResult(ips, candidates));
      }
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => { clearTimeout(timeout); pc.close(); resolve(buildResult(ips, candidates)); });
  });
}

function buildResult(ips, candidates) {
  const hasPublicIPv4 = ips.public.length > 0;
  const hasPrivateIP  = ips.private.length > 0;
  const hasIPv6       = ips.ipv6.length > 0;

  // Risk assessment
  let riskLevel, riskColor, verdict;

  if (!hasPublicIPv4 && !hasPrivateIP && !hasIPv6) {
    riskLevel = 'BLOCKED';
    riskColor = '#10B981';
    verdict = 'WebRTC is blocked or no candidates gathered';
  } else if (hasIPv6) {
    riskLevel = 'MEDIUM';
    riskColor = '#F59E0B';
    verdict = 'IPv6 address exposed via WebRTC — may reveal real IP through VPN';
  } else if (hasPrivateIP && !hasPublicIPv4) {
    riskLevel = 'LOW';
    riskColor = '#10B981';
    verdict = 'Only private LAN IP visible — normal for VPN users';
  } else if (hasPublicIPv4) {
    riskLevel = 'INFO';
    riskColor = '#00D4FF';
    verdict = 'Public IP visible via WebRTC — normal without VPN';
  } else {
    riskLevel = 'NONE';
    riskColor = '#10B981';
    verdict = 'No significant WebRTC IP exposure detected';
  }

  return {
    publicIPs:   ips.public,
    privateIPs:  ips.private,
    ipv6IPs:     ips.ipv6,
    linkLocal:   ips.linkLocal,
    candidateCount: candidates.length,
    riskLevel,
    riskColor,
    verdict,
    webrtcEnabled: candidates.length > 0,
    recommendations: buildRecommendations(ips, riskLevel),
  };
}

function buildRecommendations(ips, risk) {
  const recs = [];
  if (risk === 'MEDIUM' && ips.ipv6.length > 0) {
    recs.push('Disable IPv6 or use a VPN that handles IPv6 leak prevention');
    recs.push('In Firefox: set media.peerconnection.enabled = false in about:config');
    recs.push('In Chrome: use an extension that blocks WebRTC or disable WebRTC');
  }
  if (risk === 'INFO') {
    recs.push('If using a VPN and this shows your real IP, your VPN has a WebRTC leak');
    recs.push('Switch to a VPN with WebRTC leak protection enabled');
  }
  return recs;
}
