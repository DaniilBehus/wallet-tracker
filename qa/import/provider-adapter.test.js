'use strict';

// Real loopback HTTP stub; no external network or live provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Database = require('better-sqlite3');
const { fetchSyntheticBatch, SyntheticProviderError } = require('../../src/integrations/synthetic-provider');
const { startWallet, registerUser, localToday, countTransactions } = require('../ai/support/wallet-server');

let wallet;
test.before(async () => { wallet = await startWallet({ mode: 'off' }); });
test.after(async () => { if (wallet) await wallet.stop(); });

function ledgerCount() {
  const db = new Database(wallet.databasePath, { readonly: true });
  try { return db.prepare('SELECT COUNT(*) AS n FROM transaction_requests').get().n; }
  finally { db.close(); }
}

async function stub(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/`,
    close: async () => {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

const record = category => ({ external_id: 'http-demo-1', amount_cents: 3500,
  spent_on: localToday(-1), category_name: category, note: 'Synthetic example' });
const send = (res, body, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

test('actual local HTTP preview needs explicit Confirm; lost-response replay saves once', async () => {
  const user = await registerUser(wallet.baseUrl, 'provider-success');
  let requests = 0;
  const provider = await stub((req, res) => {
    requests++;
    assert.equal(req.url, '/records');
    assert.equal(req.headers.authorization, 'Bearer synthetic-test-only');
    send(res, { records: [record(user.categories[0].name)] });
  });
  try {
    const before = ledgerCount();
    const body = await fetchSyntheticBatch({ providerBaseUrl: provider.baseUrl });
    assert.equal(requests, 1);
    assert.equal(body.source, 'synthetic-demo-v1');
    const preview = await user.api('POST', '/imports/preview', { body });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.records[0].state, 'new');
    assert.equal(await countTransactions(user.api), 0);
    assert.equal(ledgerCount(), before);
    const first = await user.api('POST', '/imports/confirm', { body });
    assert.equal(first.status, 201);
    assert.equal(first.data.records[0].replayed, false);
    assert.equal(await countTransactions(user.api), 1);
    assert.equal(ledgerCount(), before + 1);
    // Simulate an unseen response: retry exactly the fetched batch, not new IDs.
    const retry = await user.api('POST', '/imports/confirm', { body });
    assert.equal(retry.status, 200);
    assert.equal(retry.data.records[0].replayed, true);
    assert.equal(retry.data.records[0].transaction_id, first.data.records[0].transaction_id);
    assert.equal(await countTransactions(user.api), 1);
    assert.equal(ledgerCount(), before + 1);
  } finally { await provider.close(); }
});

test('identical provider identity and category name stay isolated by Wallet user', async () => {
  const a = await registerUser(wallet.baseUrl, 'provider-isolation-a');
  const b = await registerUser(wallet.baseUrl, 'provider-isolation-b');
  assert.equal(a.categories[0].name, b.categories[0].name);
  assert.notEqual(a.categories[0].id, b.categories[0].id);
  const provider = await stub((_req, res) => send(res, { records: [record(a.categories[0].name)] }));
  try {
    const before = ledgerCount();
    const body = await fetchSyntheticBatch({ providerBaseUrl: provider.baseUrl });
    const aPreview = await a.api('POST', '/imports/preview', { body });
    const bPreview = await b.api('POST', '/imports/preview', { body });
    assert.equal(aPreview.status, 200);
    assert.equal(bPreview.status, 200);
    assert.notEqual(aPreview.data.records[0].category_id, bPreview.data.records[0].category_id);
    assert.equal(ledgerCount(), before);
    const aSaved = await a.api('POST', '/imports/confirm', { body });
    const bSaved = await b.api('POST', '/imports/confirm', { body });
    assert.equal(aSaved.status, 201);
    assert.equal(bSaved.status, 201);
    assert.notEqual(aSaved.data.records[0].transaction_id, bSaved.data.records[0].transaction_id);
    assert.equal(await countTransactions(a.api), 1);
    assert.equal(await countTransactions(b.api), 1);
    assert.equal(ledgerCount(), before + 2);
  } finally { await provider.close(); }
});

test('upstream failures and bad responses are safe and never write Wallet state', async () => {
  const user = await registerUser(wallet.baseUrl, 'provider-errors');
  const valid = record(user.categories[0].name);
  const cases = [
    ['authorization 401', (_req, res) => send(res, 'fake-private-payload', 401), 'UPSTREAM_DENIED'],
    ['authorization 403', (_req, res) => send(res, 'fake-private-payload', 403), 'UPSTREAM_DENIED'],
    ['server 503', (_req, res) => send(res, 'fake-private-payload', 503), 'UPSTREAM_STATUS'],
    ['malformed JSON', (_req, res) => send(res, 'fake-private-payload'), 'INVALID_RESPONSE'],
    ['invalid amount type', (_req, res) => send(res, { records: [{ ...valid, amount_cents: '3500' }] }), 'INVALID_RESPONSE'],
    ['invalid shape', (_req, res) => send(res, { records: [{ ...valid, extra: true }] }), 'INVALID_RESPONSE'],
    ['too many records', (_req, res) => send(res, { records: Array.from({ length: 11 }, (_, i) => ({ ...valid, external_id: `id-${i}` })) }), 'INVALID_RESPONSE'],
    ['oversized body', (_req, res) => send(res, { records: [valid], padding: 'fake-private-payload'.repeat(1000) }), 'RESPONSE_TOO_LARGE'],
    ['redirect', (_req, res) => { res.writeHead(302, { location: 'https://example.invalid/private' }); res.end(); }, 'UPSTREAM_STATUS'],
    ['timeout', () => {}, 'UPSTREAM_TIMEOUT'],
  ];
  const before = ledgerCount();
  for (const [label, handler, code] of cases) {
    const provider = await stub(handler);
    try {
      await assert.rejects(
        fetchSyntheticBatch({ providerBaseUrl: provider.baseUrl,
          timeoutMs: label === 'timeout' ? 80 : 1000,
          maxResponseBytes: label === 'oversized body' ? 256 : 16384 }),
        error => {
          assert.ok(error instanceof SyntheticProviderError, label);
          assert.equal(error.code, code, label);
          assert.doesNotMatch(error.message, /synthetic-test-only|fake-private-payload/i, label);
          return true;
        }, label,
      );
      assert.equal(await countTransactions(user.api), 0, label);
      assert.equal(ledgerCount(), before, label);
    } finally { await provider.close(); }
  }
});

test('external host and unsafe target forms are rejected before HTTP', async () => {
  for (const providerBaseUrl of [
    'https://example.invalid:8443/', 'http://localhost:1234/',
    'http://127.0.0.1:1234/other', 'http://127.0.0.1:1234/?next=external',
  ]) {
    await assert.rejects(fetchSyntheticBatch({ providerBaseUrl }),
      error => error instanceof SyntheticProviderError && error.code === 'INVALID_TARGET');
  }
});
