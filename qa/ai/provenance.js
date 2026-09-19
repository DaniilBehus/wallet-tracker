'use strict';

/*
 * Content provenance for evaluation reports (N3, independent review 2026-09-16).
 *
 * A report must say which code produced it. HEAD plus `git diff HEAD` cannot:
 * untracked files are in neither, and in S23 the normaliser, the UI module and
 * the evaluator itself were untracked. So the identity is the files' bytes.
 *
 *   buildManifest({ root })   walks an allowlist of roots under `root`, hashes
 *                             every file, and returns the list plus one
 *                             aggregate hash. Git is never consulted for it.
 *   compareManifests(a, b)    what changed between two manifests.
 *   gitSupplement(root)       HEAD and a hash of `git diff HEAD` — supplemental
 *                             context only, "unavailable" outside a repository.
 *
 * Aggregate: SHA-256 of the LF-joined lines "<posix path> <lowercase sha256>",
 * sorted by path, no final LF. With the roots below this is the same fingerprint
 * the independent review computed from `git ls-files -co --exclude-standard`, so
 * the two can be compared directly. The same bytes give the same manifest in a
 * clean tree, a dirty tree and a copy with no Git at all. Line-ending
 * conversion on checkout changes bytes and therefore the hash; that is correct.
 *
 * Never read: .env files (except .env.example), key/credential files, SQLite
 * databases and their companions, reports, dependencies, virtual environments,
 * caches, Git internals, temporary output. Links are not followed; each is
 * listed in `skipped_links` so a link is visible rather than silently absent.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MANIFEST_ROOTS = [
  'src', 'public', 'qa/ai', 'qa/e2e', 'qa/python', 'qa/api', 'scripts', 'spec', '.github/workflows',
  'package.json', 'package-lock.json', 'playwright.config.js', 'playwright.ai.config.js', 'pytest.ini', '.env.example',
];

// Inputs an evaluation result depends on. Absence is reported by name.
const REQUIRED_INPUTS = [
  'package.json', 'package-lock.json',
  'src/db.js', 'src/schema.sql', 'src/dates.js', 'src/errors.js',
  'src/ai/config.js', 'src/ai/contract.js', 'src/ai/limits.js', 'src/ai/normalize.js',
  'src/ai/openai.js', 'src/ai/gemini.js', 'src/ai/transport.js', 'src/ai/provider.js', 'src/ai/prompt.js', 'src/ai/service.js',
  'public/ai-expense.js',
  'qa/ai/evaluate.js', 'qa/ai/provenance.js', 'qa/ai/db-identity.js', 'qa/ai/holdout-ledger.js', 'qa/ai/report.js', 'qa/ai/eval-window.js',
  'qa/ai/data/eval-cases.jsonl', 'qa/ai/data/manifest.json',
];

const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', 'playwright-report', 'test-results', 'coverage']);

function excludedFile(name) {
  const lower = name.toLowerCase();
  if (lower === '.env.example') return false;
  if (lower === '.env' || lower.startsWith('.env.')) return true;
  if (/\.(db|sqlite|sqlite3)(-wal|-shm|-journal)?$/.test(lower)) return true;
  if (/\.(pem|key|p12|pfx|crt|keystore)$/.test(lower) || lower.startsWith('id_rsa') || lower.startsWith('id_ed25519')) return true;
  if (/\.(pyc|pyo|log|tmp|swp)$/.test(lower) || lower === '.ds_store') return true;
  return false;
}

const toPosix = (rel) => rel.split(path.sep).join('/');
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

function buildManifest({ root }) {
  const files = [];
  const skippedLinks = [];

  const visit = (abs, rel) => {
    let st;
    try {
      st = fs.lstatSync(abs);
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    if (st.isSymbolicLink()) {
      skippedLinks.push(rel);
      return;
    }
    if (st.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(path.basename(abs))) return;
      for (const name of fs.readdirSync(abs)) visit(path.join(abs, name), `${rel}/${name}`);
      return;
    }
    if (!st.isFile() || excludedFile(path.basename(abs))) return;
    const bytes = fs.readFileSync(abs);
    files.push({ path: rel, sha256: sha256(bytes), bytes: bytes.length });
  };

  for (const entry of MANIFEST_ROOTS) visit(path.join(root, ...entry.split('/')), entry);

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  skippedLinks.sort();
  const listed = new Set(files.map((f) => f.path));
  return {
    algorithm: 'sha256',
    line_format: '<posix path> <sha256>, sorted by path, LF-joined, no final LF',
    roots: MANIFEST_ROOTS,
    file_count: files.length,
    aggregate_sha256: sha256(files.map((f) => `${f.path} ${f.sha256}`).join('\n')),
    missing_required: REQUIRED_INPUTS.filter((p) => !listed.has(p)),
    skipped_links: skippedLinks,
    files,
  };
}

function compareManifests(a, b) {
  const before = new Map(a.files.map((f) => [f.path, f.sha256]));
  const after = new Map(b.files.map((f) => [f.path, f.sha256]));
  const changed = [...after.keys()].filter((p) => before.has(p) && before.get(p) !== after.get(p));
  const added = [...after.keys()].filter((p) => !before.has(p));
  const removed = [...before.keys()].filter((p) => !after.has(p));
  return { same: a.aggregate_sha256 === b.aggregate_sha256, changed, added, removed };
}

function gitSupplement(root) {
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
  };
  const head = git(['rev-parse', 'HEAD']);
  const diff = head === null ? null : git(['diff', 'HEAD']);
  return {
    head: head === null ? 'unavailable' : head.trim(),
    dirty_diff_sha256: diff === null ? 'unavailable' : sha256(diff),
    note: 'supplemental only: git diff HEAD omits untracked files; the content manifest is the code identity',
  };
}

module.exports = { MANIFEST_ROOTS, REQUIRED_INPUTS, buildManifest, compareManifests, gitSupplement, excludedFile };
