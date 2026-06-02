// REFLEXA v3.0 — Production Build Pipeline
// Step 1: Bundle ES modules with Rollup
// Step 2: Obfuscate with javascript-obfuscator
// Step 3: Generate production index.html
// Step 4: Report sizes

import { rollup }              from 'rollup';
import JavaScriptObfuscator    from 'javascript-obfuscator';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { fileURLToPath }       from 'url';
import { dirname, join }       from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const DIST   = join(__dir, 'dist');

// ── Ensure dist/ exists ───────────────────────────────────────────
mkdirSync(DIST, { recursive: true });

console.log('\n🔨 REFLEXA Build Pipeline v3.0\n');

// ────────────────────────────────────────────────────────────────
// STEP 1 — BUNDLE with Rollup
// ────────────────────────────────────────────────────────────────
console.log('📦 Step 1: Bundling modules with Rollup…');

const bundle = await rollup({
  input: join(__dir, 'src', 'app.js'),
  onwarn(warning, warn) {
    // Suppress circular dependency and eval warnings
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'EVAL') return;
    warn(warning);
  },
});

const { output } = await bundle.generate({
  format: 'iife',            // Self-executing — works without module system
  name:   'RXFLX_APP',
  generatedCode: { arrowFunctions: true, constBindings: true },
  compact: true,
});

const bundledCode = output[0].code;
await bundle.close();

const bundlePath = join(DIST, 'reflexa.bundle.js');
writeFileSync(bundlePath, bundledCode);
console.log(`   ✅ Bundle: ${formatSize(bundledCode.length)}`);

// ────────────────────────────────────────────────────────────────
// STEP 2 — OBFUSCATE with javascript-obfuscator
// ────────────────────────────────────────────────────────────────
console.log('🔒 Step 2: Obfuscating with javascript-obfuscator…');

const obfuscationResult = JavaScriptObfuscator.obfuscate(bundledCode, {
  // ── Core protection ─────────────────────────────────────────
  compact: true,
  simplify: true,

  // ── Control Flow Obfuscation ─────────────────────────────────
  // Makes logic flow unreadable — high performance cost (0.75 = balanced)
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,

  // ── Dead Code Injection ──────────────────────────────────────
  // Adds fake code paths — confuses reverse engineers
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,

  // ── String Encryption ────────────────────────────────────────
  // All string literals are encrypted with RC4 + base64
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.8,
  stringArrayEncoding: ['rc4', 'base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.85,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',

  // ── Identifier Obfuscation ───────────────────────────────────
  identifierNamesGenerator: 'mangled-shuffled',
  renameGlobals: false,         // true can break window.RXFLX — keep false
  renameProperties: false,      // true breaks DOM property access
  transformObjectKeys: true,

  // ── Anti-Tampering ───────────────────────────────────────────
  // Code refuses to run if modified
  selfDefending: true,

  // ── Anti-Debugging ───────────────────────────────────────────
  // Detects DevTools and interrupts execution
  debugProtection: true,
  debugProtectionInterval: 4000, // Check every 4 seconds

  // ── Misc ─────────────────────────────────────────────────────
  unicodeEscapeSequence: false,  // Avoid — too slow and detectable
  numbersToExpressions: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
});

const obfuscatedCode = obfuscationResult.getObfuscatedCode();
const minPath = join(DIST, 'reflexa.min.js');
writeFileSync(minPath, obfuscatedCode);
console.log(`   ✅ Obfuscated: ${formatSize(obfuscatedCode.length)} (${ratio(bundledCode.length, obfuscatedCode.length)}x original)`);

// ────────────────────────────────────────────────────────────────
// STEP 3 — Anti-Tampering Integrity Guard
// Compute SHA-256 of the obfuscated bundle and inject into HTML
// ────────────────────────────────────────────────────────────────
console.log('🛡️  Step 3: Computing integrity hashes…');

const bundleHash = await sha256hex(obfuscatedCode);
console.log(`   Bundle SHA-256: ${bundleHash.slice(0, 32)}…`);

// SRI hash for the script tag (base64 of raw SHA-256)
const sriHash = 'sha256-' + await sha256base64(obfuscatedCode);

// ────────────────────────────────────────────────────────────────
// STEP 4 — Generate Production index.html
// ────────────────────────────────────────────────────────────────
console.log('📄 Step 4: Generating production index.html…');

let html = readFileSync(join(__dir, 'index.html'), 'utf-8');

// Replace module script with obfuscated bundle
html = html.replace(
  /<script type="module" src="src\/app\.js"><\/script>/,
  `<script src="dist/reflexa.min.js" integrity="${sriHash}" crossorigin="anonymous"></script>`
);

// Update version comment
html = html.replace(
  /<!-- App Module -->/,
  `<!-- REFLEXA v3.0 Production Build | SHA-256: ${bundleHash.slice(0, 16)} -->`
);

// Add Content-Security-Policy meta (production — stricter than dev)
const cspContent = [
  "default-src 'none'",
  `script-src 'self' '${sriHash}' https://cdn.jsdelivr.net/npm/chart.js@4/`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "connect-src 'self' https://speed.cloudflare.com https://1.1.1.1 https://ipapi.co https://cloudflare-dns.com https://dns.google https://dns.quad9.net https://dns.nextdns.io https://dns.adguard-dns.com https://doh.opendns.com https://ipv6.icanhazip.com https://v6.ident.me https://www.gstatic.com wss://stun.l.google.com wss://stun.cloudflare.com",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// Insert CSP before </head>
html = html.replace(
  '</head>',
  `  <meta http-equiv="Content-Security-Policy" content="${cspContent}">\n</head>`
);

const prodHtmlPath = join(DIST, 'index.prod.html');
writeFileSync(prodHtmlPath, html);
console.log(`   ✅ Production HTML: ${formatSize(html.length)}`);

// ────────────────────────────────────────────────────────────────
// STEP 5 — Write Build Manifest
// ────────────────────────────────────────────────────────────────
const manifest = {
  version:     '3.0.0',
  builtAt:     new Date().toISOString(),
  bundleSize:  bundledCode.length,
  minSize:     obfuscatedCode.length,
  sha256:      bundleHash,
  sri:         sriHash,
};
writeFileSync(join(DIST, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('   ✅ Build manifest saved');

// ────────────────────────────────────────────────────────────────
// REPORT
// ────────────────────────────────────────────────────────────────
console.log('\n📊 Build Summary:');
console.log(`   Bundle:      ${formatSize(bundledCode.length)}`);
console.log(`   Obfuscated:  ${formatSize(obfuscatedCode.length)}`);
console.log(`   SHA-256:     ${bundleHash.slice(0, 32)}…`);
console.log(`   Output:      dist/reflexa.min.js`);
console.log(`   HTML:        dist/index.prod.html`);
console.log('\n✅ Build complete!\n');
console.log('Next steps:');
console.log('  1. Test locally: copy dist/index.prod.html → index.html and open in browser');
console.log('  2. Deploy: npm run deploy\n');

// ── Helpers ───────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function ratio(original, result) {
  return (result / original).toFixed(1);
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256base64(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
