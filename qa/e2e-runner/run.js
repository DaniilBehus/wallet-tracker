#!/usr/bin/env node
'use strict';

// This parent owns both children and the default database directory. A
// Playwright globalTeardown runs before its webServer teardown, so it cannot
// safely remove SQLite files (especially on Windows).
require('../ai/support/no-network');

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const ROOT = path.join(__dirname, '..', '..');
const GUARD = path.join(ROOT, 'qa', 'ai', 'support', 'no-network.js');
const SERVER = path.join(ROOT, 'src', 'server.js');
const CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const PASSTHROUGH = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP',
  'HOME', 'USERPROFILE', 'LANG', 'TZ', 'CI', 'PLAYWRIGHT_BROWSERS_PATH'];

function samePath(a, b) {
  const normalize = value => process.platform === 'win32' ? path.normalize(value).toLowerCase() : path.normalize(value);
  return normalize(a) === normalize(b);
}

function validateTarget(sourceEnv) {
  if (sourceEnv.QA_BASE_URL) throw new Error('refusing external or reused QA_BASE_URL; use the managed loopback server');
  const raw = sourceEnv.QA_E2E_PORT === undefined ? '3002' : String(sourceEnv.QA_E2E_PORT);
  if (!/^[0-9]+$/.test(raw)) throw new Error('invalid QA_E2E_PORT');
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('invalid QA_E2E_PORT');
  return port;
}

function cleanChildEnv(sourceEnv, extra = {}) {
  const env = {};
  for (const key of PASSTHROUGH) if (sourceEnv[key] !== undefined) env[key] = sourceEnv[key];
  const guard = GUARD.split(path.sep).join('/');
  env.NODE_OPTIONS = `--require ${guard.includes(' ') ? `"${guard}"` : guard}`;
  return { ...env, ...extra };
}

function allocateDatabase({ sourceEnv = process.env, tempParent = os.tmpdir() } = {}) {
  if (sourceEnv.DB_PATH !== undefined) {
    const raw = String(sourceEnv.DB_PATH);
    if (!raw.trim() || raw !== raw.trim()) throw new Error('refusing empty or ambiguous DB_PATH');
    const target = path.resolve(ROOT, raw);
    const basename = path.basename(target);
    if (!/^[A-Za-z0-9._-]+\.db$/.test(basename) || basename.includes(':')) {
      throw new Error('refusing ambiguous DB_PATH name or SQLite sidecar');
    }
    const lexicalParent = path.dirname(target);
    let parent;
    try { parent = fs.realpathSync(lexicalParent); }
    catch { throw new Error('refusing DB_PATH without an existing validated parent'); }
    if (!samePath(parent, lexicalParent)) throw new Error('refusing DB_PATH through symlink or junction');
    const dataParent = fs.existsSync(path.join(ROOT, 'data'))
      ? fs.realpathSync(path.join(ROOT, 'data')) : path.join(ROOT, 'data');
    if (samePath(parent, dataParent) && /^(wallet|e2e)\.db$/i.test(basename)) {
      throw new Error('refusing protected application or old E2E database');
    }
    // lstat, not exists: an existing dangling symlink is still a sidecar
    // collision. This is a preflight refusal, not a lock against another
    // process creating a sidecar after the check.
    for (const suffix of ['-wal', '-shm', '-journal']) {
      try {
        fs.lstatSync(target + suffix);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw new Error('refusing uninspectable adjacent SQLite sidecar');
      }
      throw new Error('refusing existing adjacent SQLite sidecar');
    }
    let fd;
    try { fd = fs.openSync(target, 'wx'); }
    catch { throw new Error('refusing existing or unreservable DB_PATH'); }
    finally { if (fd !== undefined) fs.closeSync(fd); }
    return { path: target, root: null, parent: null, identity: null };
  }
  const parent = fs.realpathSync(tempParent);
  const root = fs.realpathSync(fs.mkdtempSync(path.join(parent, 'wallet-e2e-')));
  const identity = fs.lstatSync(root);
  if (!samePath(path.dirname(root), parent) || !path.basename(root).startsWith('wallet-e2e-') ||
      identity.isSymbolicLink()) throw new Error('owned E2E directory escaped temp parent');
  return { path: path.join(root, 'wallet.db'), root, parent, identity };
}

function removeOwnedDatabase(database) {
  if (!database.root) return false; // Explicit overrides belong to the caller.
  const { root, parent, identity } = database;
  const current = fs.lstatSync(root);
  if (current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino ||
      !samePath(fs.realpathSync(root), root) || !samePath(path.dirname(root), parent) ||
      !path.basename(root).startsWith('wallet-e2e-')) {
    throw new Error('refusing cleanup of a directory not owned by this E2E run');
  }
  fs.rmSync(root, { recursive: true, maxRetries: 5, retryDelay: 100 });
  return true;
}

function finalizeDatabase(database, { serverClosed, browserClosed }) {
  if (!serverClosed || !browserClosed) {
    throw new Error('child exit not confirmed; E2E database preserved');
  }
  return removeOwnedDatabase(database);
}

async function assertPortAvailable(port) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', () => reject(new Error('refusing occupied E2E port')));
    probe.listen(port, '127.0.0.1', resolve);
  });
  await new Promise(resolve => probe.close(resolve));
}

function childClose(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
}

async function waitForReady(child, closed, port, timeoutMs) {
  let banner = false;
  let output = '';
  child.stdout.on('data', chunk => {
    output = (output + chunk.toString('utf8')).slice(-512);
    if (/wallet .* listening/.test(output)) banner = true;
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (closed.done) throw new Error('managed E2E server exited before readiness');
    if (banner) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) });
        await response.arrayBuffer();
        if (response.status === 200 && !closed.done) return;
      } catch { /* bounded local readiness polling */ }
    }
    await delay(50);
  }
  throw new Error('managed E2E server readiness timed out');
}

async function waitWithTimeout(promise, timeoutMs) {
  const controller = new AbortController();
  try {
    return await Promise.race([promise, new Promise(resolve => {
      delay(timeoutMs, null, { signal: controller.signal }).then(() => resolve(null), () => resolve(null));
    })]);
  } finally { controller.abort(); }
}

async function stopServer(child, closePromise, timeoutMs) {
  if (child.exitCode === null && child.signalCode === null) child.kill();
  let result = await waitWithTimeout(closePromise, timeoutMs);
  if (result !== null) return result;
  child.kill('SIGKILL');
  result = await waitWithTimeout(closePromise, 1000);
  if (result === null) throw new Error('managed E2E server did not confirm exit; database preserved');
  return result;
}

async function runManaged({ sourceEnv = process.env, tempParent = os.tmpdir(),
  serverEntry = __filename, browserEntry = CLI, args = [], port = validateTarget(sourceEnv),
  onEvent = () => {}, readyTimeoutMs = 60000, stopTimeoutMs = 5000 } = {}) {
  validateTarget(sourceEnv);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('invalid managed E2E port');
  await assertPortAvailable(port);
  const database = allocateDatabase({ sourceEnv, tempParent });
  let server = null;
  let serverClose = null;
  let serverClosed = false;
  let shutdownRequested = false;
  let prematureServerExit = false;
  let browserClosed = true;
  let cleaned = false;
  let exitCode = 1;
  let problem = null;
  let browser = null;
  let interrupted = null;
  const interrupt = signal => {
    interrupted = signal;
    if (browser && browser.exitCode === null && browser.signalCode === null) browser.kill();
    else if (server && server.exitCode === null && server.signalCode === null) server.kill();
  };
  const onSigint = () => interrupt('SIGINT');
  const onSigterm = () => interrupt('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    const serverEnv = cleanChildEnv(sourceEnv, {
      PORT: String(port), DB_PATH: database.path, JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      WALLET_AI_MODE: 'off', LOGIN_WINDOW_MS: '1000', WALLET_E2E_SERVER: '1',
    });
    server = spawn(process.execPath, serverEntry === __filename ? [serverEntry, '--serve'] : [serverEntry],
      { cwd: ROOT, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = { done: false };
    serverClose = childClose(server).then(result => {
      closed.done = true; serverClosed = true;
      if (!shutdownRequested) prematureServerExit = true;
      onEvent('server-close'); return result;
    }, error => { closed.done = true; throw error; });
    serverClose.catch(() => {}); // observed by stopServer; avoid an early unhandled rejection
    await waitForReady(server, closed, port, readyTimeoutMs);
    if (interrupted) throw new Error('managed E2E interrupted before browser start');
    const browserEnv = cleanChildEnv(sourceEnv, {
      QA_E2E_MANAGED: '1', QA_E2E_BASE_URL: `http://127.0.0.1:${port}`,
    });
    browser = spawn(process.execPath, [browserEntry, ...(browserEntry === CLI ? ['test'] : []), ...args],
      { cwd: ROOT, env: browserEnv, stdio: 'inherit' });
    browserClosed = false;
    const outcome = await childClose(browser);
    browserClosed = true;
    onEvent('browser-close');
    exitCode = interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 :
      outcome.code === null ? (outcome.signal === 'SIGINT' ? 130 : 143) : outcome.code;
  } catch (error) {
    if (!interrupted) problem = error;
  }
  shutdownRequested = true;
  if (server) {
    try { await stopServer(server, serverClose, stopTimeoutMs); }
    catch (error) { problem = problem || error; }
  }
  if (prematureServerExit && !interrupted) {
    problem = problem || new Error('managed E2E server exited before runner shutdown');
  }
  try { cleaned = finalizeDatabase(database, { serverClosed: !server || serverClosed, browserClosed });
    if (cleaned) onEvent('cleanup'); }
  catch (error) { problem = problem || error; }
  process.removeListener('SIGINT', onSigint);
  process.removeListener('SIGTERM', onSigterm);
  if (interrupted) exitCode = interrupted === 'SIGINT' ? 130 : 143;
  if (problem) throw problem;
  return { exitCode, database, cleaned, serverClosed };
}

function serve() {
  if (process.env.WALLET_E2E_SERVER !== '1' || !path.isAbsolute(process.env.DB_PATH || '') ||
      !Number.isInteger(Number(process.env.PORT))) {
    throw new Error('managed E2E server child requires runner-provided database and port');
  }
  // Require the production three-argument loopback signature in this managed
  // child. Its isolated database and no-network guard remain parent-owned.
  const express = require('express');
  const original = express.application.listen;
  express.application.listen = function (port, host, callback) {
    if (port !== Number(process.env.PORT) || host !== '127.0.0.1' ||
        typeof callback !== 'function') {
      throw new Error('unexpected managed server listen signature');
    }
    return original.call(this, port, host, callback);
  };
  require(SERVER);
}

if (require.main === module) {
  if (process.argv[2] === '--serve') serve();
  else runManaged({ args: process.argv.slice(2) }).then(result => {
    process.exitCode = result.exitCode;
    console.log(`E2E lifecycle: server closed; owned default database ${result.cleaned ? 'removed' : 'not removed (explicit override)'}`);
  }).catch(error => {
    console.error(`E2E lifecycle failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { allocateDatabase, removeOwnedDatabase, finalizeDatabase,
  cleanChildEnv, validateTarget, runManaged };
