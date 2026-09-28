'use strict';

require('../ai/support/no-network');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { freePort, localToday } = require('../ai/support/wallet-server');
const { ROOT } = require('../../scripts/lib/openapi');

const PASS = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'LANG', 'TZ'];
function isolatedEnv(extra) {
  const env = {};
  for (const name of PASS) if (process.env[name] !== undefined) env[name] = process.env[name];
  // No inherited NODE_OPTIONS/NODE_PATH, DB path, JWT, provider or API key.
  return { ...env, ...extra };
}

async function startServer(mode) {
  assert.ok(mode === 'off' || mode === 'demo', 'Only offline modes allowed');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-contract-'));
  let child, closed;
  function removeOwnDirectory() {
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('wallet-contract-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    if (closed) await closed;
    removeOwnDirectory();
  }
  try {
    const port = await freePort();
    child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
      env: isolatedEnv({
        PORT: String(port), DB_PATH: path.join(dir, 'wallet.db'),
        JWT_SECRET: crypto.randomBytes(48).toString('hex'), WALLET_AI_MODE: mode,
        LOGIN_MAX_FAILURES: '3', LOGIN_WINDOW_MS: '60000',
      }),
    });
    let output = '', failed = false;
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    // Keep logs in memory for leak assertions; never print them on failure.
    closed = new Promise(resolve => {
      child.once('close', resolve);
      child.once('error', () => { failed = true; });
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 20000;
    for (;;) {
      if (failed || child.exitCode !== null) throw new Error('Disposable contract server failed to start; raw logs withheld');
      try {
        const response = await fetch(baseUrl + '/api/health', { signal: AbortSignal.timeout(1000) });
        await response.arrayBuffer();
        if (response.status === 200) break;
      } catch { /* bounded startup polling, loopback only */ }
      if (Date.now() >= deadline) throw new Error('Disposable contract server startup timeout; raw logs withheld');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return { baseUrl, stop, output: () => output, databasePath: path.join(dir, 'wallet.db') };
  } catch (error) { await stop(); throw error; }
}

async function capture(server, method, route, { token, body, raw, headers = {} } = {}) {
  assert.ok(route.startsWith('/api/'), 'Only relative API routes allowed');
  const response = await fetch(server.baseUrl + route, {
    method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw === undefined ? body === undefined ? undefined : JSON.stringify(body) : raw,
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text === '' ? null : JSON.parse(text); } catch { /* validator rejects non-JSON */ }
  return { status: response.status, headers: Object.fromEntries(response.headers), text, body: parsed };
}

module.exports = { startServer, capture, localToday, isolatedEnv };
