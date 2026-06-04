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
  // DISABLED: uses Function(string) which needs CSP 'unsafe-eval', and freezes
  // the page for legitimate users who open DevTools. Other layers (string
  // encryption, control-flow flattening, self-defending) keep code unreadable.
  debugProtection: false,
  debugProtectionInterval: 0,

  // ── Misc ─────────────────────────────────────────────────────
  unicodeEscapeSequence: false,  // Avoid — too slow and detectable
  numbersToExpressions: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
});

// Prepend a preserved copyright banner (survives minification).
const BANNER =
  '/*! REFLEXA — Advanced Network Diagnostic Tool\n' +
  ' * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.\n' +
  ' * Proprietary & Confidential. Unauthorized copying, modification, or\n' +
  ' * reuse — in whole or in part — is strictly prohibited. See LICENSE. */\n';
const obfuscatedCode = BANNER + obfuscationResult.getObfuscatedCode();
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

// Swap the app <script> tag (raw module OR a prior obfuscated tag, with or
// without ?v= and integrity) for the freshly-built obfuscated bundle + SRI.
// CSP is intentionally NOT injected here: index.html holds the authoritative,
// hand-maintained Content-Security-Policy (the old injected CSP was outdated
// and omitted the license Worker + analytics, which broke the app).
const vtag   = bundleHash.slice(0, 8);
const before = html;
html = html.replace(
  /<script(?:\s+type="module")?\s+src="(?:src\/app\.js|dist\/reflexa\.min\.js)(?:\?[^"]*)?"(?:\s+integrity="[^"]*")?(?:\s+crossorigin="[^"]*")?><\/script>/,
  `<script src="dist/reflexa.min.js?v=${vtag}" integrity="${sriHash}"></script>`
);
if (html === before) {
  console.warn('   ⚠️  App <script> tag not found in index.html — index.prod.html was NOT updated');
}

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
console.log('  1. Copy dist/index.prod.html → index.html');
console.log('  2. TEST in a browser — obfuscation can break runtime: run a full speed test');
console.log('  3. Deploy: npm run deploy\n');

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
