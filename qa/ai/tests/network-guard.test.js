'use strict';

// The guard is only a boundary if it fails closed. These tests try to leave
// the machine the way the real adapter would, and expect to be stopped.

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const tls = require('tls');

const { startWallet, registerUser, localToday } = require('../support/wallet-server');

test('the guard is preloaded into this process', () => {
  // D-041: the process-local record, not an environment variable, is the proof.
  const { isGuardActive } = require('../support/network-guard-state');
  assert.equal(isGuardActive(), true, 'run with --require qa/ai/support/no-network.js');
});

test('fetch to api.openai.com is refused before any connection', async () => {
  await assert.rejects(
    fetch('https://api.openai.com/v1/responses', { method: 'POST', body: '{}' }),
    (err) => JSON.stringify({ m: err.message, c: err.cause && err.cause.message, code: err.cause && err.cause.code })
      .includes('NETWORK_BLOCKED_IN_TESTS'),
  );
});

function refusedWith(socket) {
  return new Promise((resolve) => socket.once('error', (err) => resolve(err.code)));
}

test('raw TCP and TLS to a public host are refused; loopback is allowed', async () => {
  assert.equal(await refusedWith(net.connect(443, 'api.openai.com')), 'NETWORK_BLOCKED_IN_TESTS');
  assert.equal(await refusedWith(tls.connect({ host: 'api.openai.com', port: 443 })), 'NETWORK_BLOCKED_IN_TESTS');
  assert.equal(await refusedWith(new net.Socket().connect({ host: '8.8.8.8', port: 53 })), 'NETWORK_BLOCKED_IN_TESTS');

  const server = net.createServer((s) => s.end());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await new Promise((resolve, reject) => {
    const s = net.connect(server.address().port, '127.0.0.1', () => { s.destroy(); resolve(); });
    s.on('error', reject);
  });
  await new Promise((r) => server.close(r));
});

test('a live server without the fake cannot reach OpenAI: the draft fails, nothing leaks', async () => {
  // The real adapter with a key in the environment and no forwarding fetch:
  // the only thing between it and api.openai.com is the guard.
  const wallet = await startWallet({
    mode: 'live',
    env: { OPENAI_API_KEY: 'sk-guard-test-not-a-real-key', WALLET_AI_MODEL: 'guard-test-model', WALLET_AI_LIVE_ALLOWED: 'true' },
  });
  try {
    const u = await registerUser(wallet.baseUrl, 'guard');
    const res = await u.api('POST', '/ai/expense-draft', {
      body: { text: 'Lunch 9 EUR', reference_date: localToday(), locale: 'auto', consent_to_external_processing: true },
    });
    assert.equal(res.status, 502, JSON.stringify(res.data));
    assert.equal(res.data.error.code, 'AI_PROVIDER_FAILED');
    assert.ok(!wallet.output().includes('sk-guard-test-not-a-real-key'));
  } finally {
    await wallet.stop();
  }
});
