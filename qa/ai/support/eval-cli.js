'use strict';

// Runs the real evaluator (qa/ai/evaluate.js) as a child process for the live
// safety tests: network guard preloaded, a synthetic unusable key, provider
// requests forwarded to a loopback fake through WALLET_AI_EVAL_TEST_FAKE_URL
// (honoured by evaluate.js only while that guard is active). Nothing started
// from here can reach a real provider or the owner's data/wallet.db.
//
// makeWalletCopy() gives a disposable copy of the source tree in the OS temp
// directory. It is the isolated root for tests that need the evaluator's
// default paths (data/wallet.db, data/ai-eval.db, qa/reports) or that change
// source files: the copy is changed, never this checkout.

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const GUARD = path.join(ROOT, 'qa', 'ai', 'support', 'no-network.js').split(path.sep).join('/');

// The source roots a copy needs; the same set the content manifest covers.
const COPY_ROOTS = ['src', 'public', 'qa/ai', 'qa/e2e', 'qa/python', 'qa/api', 'scripts', 'spec', '.github/workflows',
  'package.json', 'package-lock.json', 'playwright.config.js', 'playwright.ai.config.js', 'pytest.ini', '.env.example'];
const SKIP_NAMES = new Set(['node_modules', '.git', '__pycache__', '.pytest_cache']);

const liveEnv = (extra = {}) => ({
  OPENAI_API_KEY: 'sk-evalcli-test-not-a-real-key',
  WALLET_AI_MODEL: 'fake-model-for-eval-tests',
  WALLET_AI_LIVE_ALLOWED: 'true',
  WALLET_AI_EVAL_LIVE: 'true',
  WALLET_AI_EVAL_DAILY_CALLS: '200',
  WALLET_AI_USER_MINUTE_CALLS: '100',
  ...extra,
});

/**
 * @returns {Promise<{code: number|null, signal: string|null, out: string}>}
 * `onChild` receives the ChildProcess, for tests that interrupt a run.
 */
function runEvaluator({ root = ROOT, args = [], env = {}, fakeUrl = null, onChild = null, preloadGuard = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'qa', 'ai', 'evaluate.js'), ...args], {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        // A copy in the temp directory must not discover some other repository
        // above it; the evaluator's provenance may not depend on one.
        GIT_CEILING_DIRECTORIES: os.tmpdir(),
        // preloadGuard: false exists only for tests proving the evaluator
        // refuses its test seam when the guard is not really loaded.
        ...(preloadGuard ? { NODE_OPTIONS: `--require "${GUARD}"` } : {}),
        // The dependencies this process resolved, so a copy without
        // node_modules still runs against the same installed packages.
        NODE_PATH: path.resolve(path.dirname(require.resolve('better-sqlite3/package.json')), '..'),
        ...(fakeUrl ? { WALLET_AI_EVAL_TEST_FAKE_URL: fakeUrl, WALLET_AI_EVAL_TEST_NO_WAIT: '1' } : {}),
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, out }));
    if (onChild) onChild(child);
  });
}

const callsAttempted = (out) => {
  const m = out.match(/provider calls attempted: (\d+)/);
  return m ? Number(m[1]) : null;
};

/** The report file the evaluator names on its last line, resolved against `root`. */
function reportPaths(out, root = ROOT) {
  const m = out.match(/^report: (.+\.md)\s*$/m);
  if (!m) return null;
  const md = path.resolve(root, m[1].trim());
  return { md, json: md.replace(/\.md$/, '.json') };
}

function makeWalletCopy(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wallet-ai-${label}-`));
  for (const rel of COPY_ROOTS) {
    const from = path.join(ROOT, rel);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(dir, rel), {
      recursive: true,
      filter: (src) => {
        const st = fs.lstatSync(src);
        if (st.isSymbolicLink()) return false;
        const name = path.basename(src);
        if (SKIP_NAMES.has(name) && st.isDirectory()) return false;
        return !name.endsWith('.pyc');
      },
    });
  }
  return dir;
}

const sha256File = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** A directory alias that needs no privilege: a junction on Windows, a symlink elsewhere. */
function linkDirectory(target, alias) {
  fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
}

/** Removes the alias itself, never what it points to. */
function removeDirectoryLink(alias) {
  if (!fs.lstatSync(alias).isSymbolicLink()) throw new Error(`${alias} is not a link`);
  try {
    fs.unlinkSync(alias);
  } catch {
    fs.rmdirSync(alias);           // a Windows junction is removed as a directory entry
  }
}

module.exports = { ROOT, GUARD, liveEnv, runEvaluator, callsAttempted, reportPaths, makeWalletCopy, sha256File, linkDirectory, removeDirectoryLink };
