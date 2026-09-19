'use strict';

// Starts a disposable Wallet server for AI tests.
//
//   * a new temporary directory and database per server (never data/wallet.db)
//   * a random JWT secret
//   * an environment rebuilt from an allow-list: inherited OPENAI_* and
//     WALLET_AI_* values cannot leak in and switch anything on
//   * the network guard preloaded, so the server cannot reach the internet
//   * stop() waits for the process to exit before anything is deleted (R8)

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const GUARD = path.join(__dirname, 'no-network.js');
// NODE_PATH lets a disposable source copy (negative controls) use the installed
// dependencies; it carries no secret and switches nothing on.
const PASS_THROUGH = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LANG', 'TZ', 'NODE_PATH'];

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function cleanEnv(extra) {
  const env = {};
  for (const key of PASS_THROUGH) if (process.env[key] !== undefined) env[key] = process.env[key];
  // NODE_OPTIONS treats backslashes as escapes, so a Windows path loses them.
  const guard = GUARD.split(path.sep).join('/');
  const quoted = guard.includes(' ') ? `"${guard}"` : guard;
  env.NODE_OPTIONS = `--require ${quoted}`;
  return { ...env, ...extra };
}

async function startWallet({ mode = 'off', fakeUrl = null, env = {}, dbPath = null } = {}) {
  const port = await freePort();
  const dir = dbPath ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-'));
  const database = dbPath || path.join(dir, 'wallet.db');
  const entry = mode === 'live'
    ? path.join(__dirname, 'test-server.js')
    : path.join(ROOT, 'src', 'server.js');

  const child = spawn(process.execPath, [entry], {
    cwd: ROOT,
    env: cleanEnv({
      PORT: String(port),
      DB_PATH: database,
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      WALLET_AI_MODE: mode,
      ...(fakeUrl ? { WALLET_AI_TEST_FAKE_URL: fakeUrl } : {}),
      ...env,
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  let exited = false;
  const exitPromise = new Promise((resolve) => child.once('exit', () => { exited = true; resolve(); }));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;
  for (;;) {
    if (exited) throw new Error(`server exited during start:\n${output}`);
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) break;
    } catch { /* not listening yet */ }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server did not become healthy:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  async function stop({ keepDatabase = false } = {}) {
    if (!exited) {
      child.kill();
      await exitPromise;
    }
    if (dir && !keepDatabase) fs.rmSync(dir, { recursive: true, force: true });
  }

  return { baseUrl, databasePath: database, stop, output: () => output };
}

/** A tiny JSON client with an auth token. */
function client(baseUrl, token) {
  return async function call(method, route, { body, headers = {}, raw } = {}) {
    const res = await fetch(`${baseUrl}/api${route}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
}

async function registerUser(baseUrl, label = 'u') {
  const email = `${label}-${crypto.randomUUID()}@wallet.test`;
  const anon = client(baseUrl);
  const res = await anon('POST', '/auth/register', { body: { email, password: 'synthetic-password-1' } });
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  const api = client(baseUrl, res.data.token);
  const categories = (await api('GET', '/categories')).data;
  return { email, token: res.data.token, api, categories };
}

/** Local calendar date, the way the browser computes reference_date. */
function localToday(offsetDays = 0) {
  const d = new Date();
  const shifted = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${String(shifted.getFullYear()).padStart(4, '0')}-${p(shifted.getMonth() + 1)}-${p(shifted.getDate())}`;
}

/** Every expense a user has, regardless of month. */
async function countTransactions(api) {
  const res = await api('GET', `/transactions?from=1900-01-01&to=${localToday(1)}&limit=200`);
  if (res.status !== 200) throw new Error(`count failed: ${res.status}`);
  return res.data.total;
}

module.exports = { startWallet, client, registerUser, localToday, countTransactions, freePort, ROOT };
