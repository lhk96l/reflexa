/*!
 * REFLEXA — Advanced Network Diagnostic Tool
 * Copyright (c) 2025 Eng. Mohanad Al-Mothafer. All Rights Reserved.
 * Proprietary & Confidential. Unauthorized copying, modification, distribution,
 * reverse engineering, or reuse — in whole or in part — is strictly prohibited.
 * See LICENSE. "REFLEXA" is a trademark of Eng. Mohanad Al-Mothafer.
 */

// REFLEXA — Cloudflare KV backup / restore
//
//   Backup  :  node scripts/kv-backup.mjs
//   Restore :  node scripts/kv-backup.mjs --restore backups/<file>.json [--yes]
//
// Backups capture EVERY key + value + expiration from the LICENSES namespace
// into a timestamped JSON file under worker/backups/ (git-ignored — contains
// customer emails & license data).
//
// Restore re-writes only DURABLE license keys (key: / order: / email:),
// skipping ephemeral keys (ratelimit:/ban:/magic:) and already-expired keys.
// It is a no-op preview unless you pass --yes.

import { exec }                                     from 'node:child_process';
import { promisify }                                from 'node:util';
import { readFileSync, writeFileSync, mkdirSync }   from 'node:fs';
import { fileURLToPath }                            from 'node:url';
import { dirname, join }                            from 'node:path';

const execP   = promisify(exec);
const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dir, '..');              // worker/
const BACKUPS = join(ROOT, 'backups');

// Durable prefixes worth restoring; everything else is short-lived/TTL state.
const DURABLE = ['key:', 'order:', 'email:'];

// ── helpers ────────────────────────────────────────────────────────
function namespaceId() {
  const toml = readFileSync(join(ROOT, 'wrangler.toml'), 'utf-8');
  // first top-level `id = "..."` line (preview_id starts with "preview_", excluded)
  const m = toml.match(/^\s*id\s*=\s*"([a-f0-9]+)"/m);
  if (!m) throw new Error('LICENSES namespace id not found in wrangler.toml');
  return m[1];
}

const q = s => `"${String(s).replace(/"/g, '\\"')}"`;   // quote one shell arg

async function wrangler(args, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  // Run through the shell (Windows npx is a .cmd shim); quote every value.
  const cmd = ['npx', 'wrangler', ...args.map(q)].join(' ');
  const { stdout } = await execP(cmd, { maxBuffer, windowsHide: true });
  return stdout;
}

function extractJson(stdout) {
  // wrangler prints the JSON payload to stdout; tolerate stray banner lines.
  const s = stdout.indexOf('[');
  const e = stdout.lastIndexOf(']');
  if (s === -1 || e === -1) throw new Error('Unexpected wrangler output (no JSON array)');
  return JSON.parse(stdout.slice(s, e + 1));
}

// run async tasks with bounded concurrency
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  }));
  return out;
}

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function summarize(keys) {
  const by = {};
  for (const k of keys) {
    const pre = (k.name.split(':')[0] || '') + ':';
    by[pre] = (by[pre] || 0) + 1;
  }
  return by;
}

// ── backup ─────────────────────────────────────────────────────────
async function backup() {
  const id = namespaceId();
  console.log(`\n🔐 REFLEXA KV backup — namespace ${id}\n`);

  console.log('📋 Listing keys…');
  const list = extractJson(await wrangler(['kv', 'key', 'list', '--namespace-id', id, '--remote']));
  console.log(`   ${list.length} keys found`);

  console.log('⬇️  Fetching values (this calls wrangler per key)…');
  let done = 0;
  const entries = await pool(list, 6, async (k) => {
    const stdout = await wrangler(['kv', 'key', 'get', k.name, '--namespace-id', id, '--remote']);
    done++;
    if (done % 10 === 0 || done === list.length) process.stdout.write(`   ${done}/${list.length}\r`);
    return {
      name:       k.name,
      expiration: k.expiration ?? null,
      metadata:   k.metadata   ?? null,
      value:      stdout.replace(/\r?\n$/, ''),   // strip single trailing newline
    };
  });
  process.stdout.write('\n');

  mkdirSync(BACKUPS, { recursive: true });
  const file = join(BACKUPS, `kv-backup-${stamp()}.json`);
  const payload = {
    exportedAt:  new Date().toISOString(),
    namespaceId: id,
    count:       entries.length,
    keys:        entries,
  };
  writeFileSync(file, JSON.stringify(payload, null, 2));

  console.log(`\n✅ Backup written: ${file}`);
  console.log('   Breakdown:', summarize(entries));
  console.log('   ⚠️  Contains customer data — keep private (git-ignored).\n');
}

// ── restore ────────────────────────────────────────────────────────
async function restore(file, apply) {
  const id = namespaceId();
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  const now  = Math.floor(Date.now() / 1000);

  const items = [];
  let skippedEphemeral = 0, skippedExpired = 0;
  for (const k of data.keys) {
    if (!DURABLE.some(p => k.name.startsWith(p))) { skippedEphemeral++; continue; }
    let ttl;
    if (k.expiration) {
      ttl = k.expiration - now;
      if (ttl <= 60) { skippedExpired++; continue; }   // expired / about to expire
    }
    const item = { key: k.name, value: k.value };
    if (ttl) item.expiration_ttl = ttl;
    items.push(item);
  }

  console.log(`\n♻️  Restore from ${file} → namespace ${id}`);
  console.log(`   durable keys to restore: ${items.length}`);
  console.log(`   skipped ephemeral: ${skippedEphemeral} · skipped expired: ${skippedExpired}`);

  if (!apply) {
    console.log('\n   (preview only — re-run with --yes to write to KV)\n');
    return;
  }

  mkdirSync(BACKUPS, { recursive: true });
  const tmp = join(BACKUPS, `.restore-${stamp()}.json`);
  writeFileSync(tmp, JSON.stringify(items));
  console.log('\n⬆️  Writing via wrangler kv bulk put…');
  await wrangler(['kv', 'bulk', 'put', tmp, '--namespace-id', id, '--remote']);
  console.log(`✅ Restored ${items.length} keys.\n`);
}

// ── entry ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const ri   = argv.indexOf('--restore');
try {
  if (ri !== -1) {
    const file = argv[ri + 1];
    if (!file) throw new Error('Usage: --restore <backup-file.json> [--yes]');
    await restore(file, argv.includes('--yes'));
  } else {
    await backup();
  }
} catch (err) {
  console.error('\n❌', err.message, '\n');
  process.exit(1);
}
