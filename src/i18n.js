/*!
 * REFLEXA — Advanced Network Diagnostic Tool
 * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.
 * Proprietary & Confidential. Unauthorized copying, modification, distribution,
 * reverse engineering, or reuse — in whole or in part — is strictly prohibited.
 * See LICENSE. "REFLEXA" is a trademark of Eng. Mohanad Al-Mothafer.
 */
// REFLEXA v3.0 — Internationalization
export const STRINGS = {
  en: {
    tagline:'Network Diagnostics',appTitle:'REFLEXA — Advanced Network Diagnostic',
    install:'Install App',
    // Nav
    navSpeed:'Speed Test',navAdvanced:'Advanced',navDNS:'DNS',navSecurity:'Security',navReport:'Report',
    // Speed Test
    startTest:'⚡ Start Test',testing:'⏳ Testing...',retry:'↺ Retry',
    download:'Download',upload:'Upload',ping:'Ping',jitter:'Jitter',
    packetLoss:'Packet Loss',bufferbloat:'Bufferbloat',
    // Phases
    phasePing:'Measuring Latency...',phaseLoss:'Checking Packet Loss...',
    phaseDL:'Testing Download...',phaseUL:'Testing Upload...',
    phaseBloat:'Analyzing Bufferbloat...',phaseDone:'Complete ✓',
    // Metrics
    netScore:'Network Score',quality:'Quality',
    tcpEfficiency:'TCP Efficiency',bdp:'Bandwidth-Delay Product',
    ttr:'Transfer Time Ratio',rtt:'RTT',p95:'P95 Latency',p99:'P99 Latency',
    mosScore:'MOS Score',retransmit:'Retransmit Rate',
    ituClass:'ITU-T Class',rfcGrade:'RFC 6349',
    // Net Info
    netInfo:'Network Information',ipAddr:'IP Address',connType:'Connection',
    ispLabel:'ISP',locationLabel:'Location',server:'Test Server',status:'Status',
    history:'Speed History',
    // Bufferbloat grades
    bloatA:'Excellent — No Bufferbloat',bloatB:'Good — Minimal',
    bloatC:'Fair — Some Bufferbloat',bloatD:'Poor — Significant',bloatF:'Failing — Severe',
    // DNS
    dnsBenchmark:'DNS Benchmark',dnsRecommended:'Recommended',dnsLeak:'DNS Leak Test',
    dnsLeakNone:'No DNS Leak Detected',dnsLeakFound:'DNS Leak Detected',
    dnsRunning:'Running DNS benchmark...',dnsStart:'Start DNS Benchmark',
    dnsAvg:'Avg',dnsMin:'Min',dnsP95:'P95',
    // WebRTC
    webrtcLeak:'WebRTC Leak Test',webrtcRunning:'Detecting IPs...',
    webrtcStart:'Start WebRTC Test',webrtcLocal:'Local IPs',webrtcPublic:'Public IP',
    webrtcIPv6:'IPv6 IPs',webrtcRisk:'Risk Level',
    webrtcNone:'No leak detected',webrtcLow:'Low risk',webrtcMed:'Medium risk',webrtcHigh:'High risk',
    // ISP
    ispThrottle:'ISP Throttling Detection',ispRunning:'Analyzing traffic...',
    ispStart:'Run Throttle Test',ispDetected:'Throttling Detected',
    ispNone:'No Throttling Detected',ispVariance:'Speed Variance',
    // Protocol
    protocolTitle:'Protocol Analysis',http2:'HTTP/2',http3:'HTTP/3 (QUIC)',
    tls13:'TLS 1.3',hsts:'HSTS',
    // Geo Latency
    geoLatency:'Global Latency Map',geoRunning:'Pinging global servers...',
    geoStart:'Run Latency Map',
    // Score labels
    scoreExcellent:'Excellent',scoreGood:'Good',scoreFair:'Fair',scorePoor:'Poor',
    // ITU-T Classes
    ituClass0:'Class 0 — Real-Time HD',ituClass1:'Class 1 — Interactive VoIP',
    ituClass2:'Class 2 — Critical Data',ituClass3:'Class 3 — Standard Data',
    ituClass4:'Class 4 — Low Loss',ituClass5:'Class 5 — Best Effort',
    // Pro
    upgradePro:'✨ Pro',proTitle:'Upgrade to REFLEXA Pro',
    proDesc:'Unlimited tests, advanced reports & 30-day history',
    proF1:'Unlimited speed tests per day',proF2:'Export PDF & CSV reports',
    proF3:'30-day history (vs 10 free)',proF4:'Priority test servers',proF5:'Ad-free experience',
    getProNow:'🚀 Get Pro Now',maybeLater:'Maybe later',
    alreadyPro:'Already purchased?',enterKey:'🔑 Enter License Key',
    activateTitle:'Activate Pro',activateDesc:'Enter your license key',
    activateBtn:'✅ Activate',back:'← Back',
    proActive:'REFLEXA Pro — Active',deactivate:'Deactivate',
    // Share / Export
    saveImage:'Save Image',copyResult:'Copy',share:'Share',exportCSV:'Export CSV',exportPDF:'Export PDF',
    // History
    histFree:'Last 10 tests',histPro:'Last 30 tests (Pro)',noHistory:'No tests yet',
    // System
    freeUsage:'Tests today:',freeOf:'of 5 free',unlimited:'Unlimited ∞',
    limitReached:'Daily limit reached — Upgrade to Pro',
    keyInvalid:'Invalid license key format',proActivated:'✅ Pro activated!',
    statusOnline:'Online',statusOffline:'Offline',copied:'Copied!',
    notTested:'Not tested',loading:'Loading...',
    // MOS Labels
    mosExcellent:'Excellent (HD VoIP)',mosGood:'Good (VoIP)',mosFair:'Fair (Acceptable)',
    mosPoor:'Poor (Degraded)',mosBad:'Bad (Unusable)',
    // Report
    reportTitle:'Network Diagnostic Report',reportGenerated:'Generated',
    reportBy:'By Eng. Mohanad Al-Mothafer',reportSummary:'Executive Summary',
    reportSpeed:'Speed Metrics',reportLatency:'Latency Analysis',
    reportBufferbloat:'Bufferbloat Analysis',reportDNS:'DNS Benchmark',
    reportSecurity:'Security Analysis',reportRecommendations:'Recommendations',
  },
  ar: {
    tagline:'تشخيص الشبكة',appTitle:'REFLEXA — أداة تشخيص الشبكة المتقدمة',
    install:'تثبيت التطبيق',
    navSpeed:'اختبار السرعة',navAdvanced:'متقدم',navDNS:'DNS',navSecurity:'الأمان',navReport:'التقرير',
    startTest:'⚡ ابدأ الاختبار',testing:'⏳ جاري الاختبار...',retry:'↺ إعادة',
    download:'تنزيل',upload:'رفع',ping:'استجابة',jitter:'اهتزاز',
    packetLoss:'فقدان الحزم',bufferbloat:'تأخر التحميل',
    phasePing:'قياس الكمون...',phaseLoss:'فحص فقدان الحزم...',
    phaseDL:'اختبار التنزيل...',phaseUL:'اختبار الرفع...',
    phaseBloat:'تحليل Bufferbloat...',phaseDone:'اكتمل ✓',
    netScore:'تقييم الشبكة',quality:'الجودة',
    tcpEfficiency:'كفاءة TCP',bdp:'حاصل عرض النطاق × الكمون',
    ttr:'نسبة وقت النقل',rtt:'زمن الرحلة',p95:'كمون P95',p99:'كمون P99',
    mosScore:'درجة MOS',retransmit:'معدل إعادة الإرسال',
    ituClass:'تصنيف ITU-T',rfcGrade:'RFC 6349',
    netInfo:'معلومات الشبكة',ipAddr:'عنوان IP',connType:'نوع الاتصال',
    ispLabel:'مزود الخدمة',locationLabel:'الموقع',server:'خادم الاختبار',status:'الحالة',
    history:'سجل السرعات',
    bloatA:'ممتاز — لا يوجد تأخر',bloatB:'جيد — تأخر بسيط',
    bloatC:'مقبول — بعض التأخر',bloatD:'ضعيف — تأخر كبير',bloatF:'فشل — تأخر شديد',
    dnsBenchmark:'مقارنة DNS',dnsRecommended:'الأسرع',dnsLeak:'فحص تسريب DNS',
    dnsLeakNone:'لا يوجد تسريب DNS',dnsLeakFound:'تم اكتشاف تسريب DNS',
    dnsRunning:'جاري اختبار DNS...',dnsStart:'ابدأ مقارنة DNS',
    dnsAvg:'متوسط',dnsMin:'أدنى',dnsP95:'P95',
    webrtcLeak:'فحص تسريب WebRTC',webrtcRunning:'جاري الكشف...',
    webrtcStart:'ابدأ فحص WebRTC',webrtcLocal:'IPs محلية',webrtcPublic:'IP عام',
    webrtcIPv6:'IPv6',webrtcRisk:'مستوى الخطر',
    webrtcNone:'لا يوجد تسريب',webrtcLow:'خطر منخفض',webrtcMed:'خطر متوسط',webrtcHigh:'خطر عالٍ',
    ispThrottle:'كشف تقنيص ISP',ispRunning:'تحليل حركة البيانات...',
    ispStart:'ابدأ فحص التقنيص',ispDetected:'تم اكتشاف تقنيص',
    ispNone:'لا يوجد تقنيص',ispVariance:'تباين السرعة',
    protocolTitle:'تحليل البروتوكولات',http2:'HTTP/2',http3:'HTTP/3 (QUIC)',
    tls13:'TLS 1.3',hsts:'HSTS',
    geoLatency:'خريطة الكمون العالمي',geoRunning:'قياس السرعة للخوادم العالمية...',
    geoStart:'قياس الكمون العالمي',
    scoreExcellent:'ممتاز',scoreGood:'جيد',scoreFair:'مقبول',scorePoor:'ضعيف',
    ituClass0:'الفئة 0 — بث حي HD',ituClass1:'الفئة 1 — VoIP تفاعلي',
    ituClass2:'الفئة 2 — بيانات حيوية',ituClass3:'الفئة 3 — بيانات عادية',
    ituClass4:'الفئة 4 — فقدان منخفض',ituClass5:'الفئة 5 — أفضل جهد',
    upgradePro:'✨ Pro',proTitle:'الترقية إلى REFLEXA Pro',
    proDesc:'اختبارات غير محدودة وتقارير متقدمة وسجل 30 يوم',
    proF1:'اختبارات غير محدودة يومياً',proF2:'تصدير تقارير PDF وCSV',
    proF3:'سجل 30 يوم (مقابل 10 مجانية)',proF4:'خوادم اختبار أولوية',proF5:'بدون إعلانات',
    getProNow:'🚀 احصل على Pro الآن',maybeLater:'ربما لاحقاً',
    alreadyPro:'اشتريت مسبقاً؟',enterKey:'🔑 أدخل مفتاح الترخيص',
    activateTitle:'تفعيل Pro',activateDesc:'أدخل مفتاح الترخيص من إيميل الشراء',
    activateBtn:'✅ تفعيل',back:'→ رجوع',
    proActive:'REFLEXA Pro — مفعّل',deactivate:'إلغاء التفعيل',
    saveImage:'حفظ كصورة',copyResult:'نسخ',share:'مشاركة',exportCSV:'تصدير CSV',exportPDF:'تصدير PDF',
    histFree:'آخر 10 اختبارات',histPro:'آخر 30 اختبار (Pro)',noHistory:'لا توجد اختبارات',
    freeUsage:'اختبارات اليوم:',freeOf:'من 5 مجانية',unlimited:'لامحدود ∞',
    limitReached:'وصلت للحد اليومي — قم بالترقية',
    keyInvalid:'صيغة مفتاح الترخيص غير صحيحة',proActivated:'✅ تم تفعيل Pro!',
    statusOnline:'متصل',statusOffline:'غير متصل',copied:'تم النسخ!',
    notTested:'لم يُختبر',loading:'جاري التحميل...',
    mosExcellent:'ممتاز (VoIP HD)',mosGood:'جيد (VoIP)',mosFair:'مقبول',
    mosPoor:'ضعيف',mosBad:'سيء (غير صالح)',
    reportTitle:'تقرير تشخيص الشبكة',reportGenerated:'تاريخ التقرير',
    reportBy:'بقلم المهندس مهند المظفر',reportSummary:'الملخص التنفيذي',
    reportSpeed:'مقاييس السرعة',reportLatency:'تحليل الكمون',
    reportBufferbloat:'تحليل Bufferbloat',reportDNS:'مقارنة DNS',
    reportSecurity:'تحليل الأمان',reportRecommendations:'التوصيات',
  }
};

let _lang = localStorage.getItem('rxflx_lang') || 'en';

export const i18n = {
  get lang() { return _lang; },
  t(key) { return STRINGS[_lang]?.[key] ?? STRINGS.en[key] ?? key; },
  toggle() {
    _lang = _lang === 'en' ? 'ar' : 'en';
    localStorage.setItem('rxflx_lang', _lang);
    this.apply();
  },
  apply() {
    document.documentElement.lang = _lang;
    document.documentElement.dir = _lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    const lb = document.getElementById('langBtn');
    if (lb) lb.textContent = _lang === 'en' ? 'AR' : 'EN';
  }
};
