'use strict';

// Offline synthetic batch import: no provider, credentials, or production DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { startWallet, registerUser, localToday, countTransactions } = require('../ai/support/wallet-server');

let wallet;
test.before(async () => { wallet = await startWallet({ mode: 'off' }); });
test.after(async () => { if (wallet) await wallet.stop(); });

function batch(category, records = []) {
  return { source: 'synthetic-demo-v1', records: records.length ? records : [
    { external_id: 'synthetic-a', amount_cents: 3500, spent_on: localToday(-1), category_name: category, note: 'Synthetic example' },
  ] };
}
function ledgerCount() {
  const db = new Database(wallet.databasePath, { readonly: true });
  try { return db.prepare('SELECT COUNT(*) AS n FROM transaction_requests').get().n; }
  finally { db.close(); }
}

test('preview is read-only; explicit confirm saves and a lost-response retry replays', async () => {
  const u = await registerUser(wallet.baseUrl, 'import-preview');
  const body = batch(u.categories[0].name);
  const before = ledgerCount();
  const preview = await u.api('POST', '/imports/preview', { body });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.records[0].state, 'new');
  assert.equal(await countTransactions(u.api), 0);
  assert.equal(ledgerCount(), before);

  const first = await u.api('POST', '/imports/confirm', { body });
  assert.equal(first.status, 201);
  assert.equal(first.data.records[0].replayed, false);
  assert.equal(await countTransactions(u.api), 1);
  const replay = await u.api('POST', '/imports/confirm', { body });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.records[0].replayed, true);
  assert.equal(replay.data.records[0].transaction_id, first.data.records[0].transaction_id);
  assert.equal(await countTransactions(u.api), 1);
});

test('strict cents, date and owned category reject without writes', async () => {
  const u = await registerUser(wallet.baseUrl, 'import-invalid');
  const before = ledgerCount();
  const valid = batch(u.categories[0].name);
  const badRecords = [
    { ...valid.records[0], amount_cents: '3500' },
    { ...valid.records[0], amount_cents: 35.5 },
    { ...valid.records[0], amount_cents: 0 },
    { ...valid.records[0], spent_on: '2026-02-30' },
    { ...valid.records[0], category_name: 'Not owned' },
  ];
  for (const record of badRecords) {
    const result = await u.api('POST', '/imports/confirm', { body: { ...valid, records: [record] } });
    assert.ok(result.status >= 400 && result.status < 500, `unexpected ${result.status}`);
  }
  assert.equal(await countTransactions(u.api), 0);
  assert.equal(ledgerCount(), before);
});

test('strict batch shape and unauthorized access reject without writes', async () => {
  const u = await registerUser(wallet.baseUrl, 'import-shape');
  const valid = batch(u.categories[0].name);
  const before = ledgerCount();
  for (const body of [
    { ...valid, source: 'other-source' },
    { ...valid, records: [] },
    { ...valid, records: [valid.records[0], valid.records[0]] },
    { ...valid, records: [{ ...valid.records[0], unexpected: true }] },
    { ...valid, records: [{ ...valid.records[0], note: 35 }] },
    { ...valid, records: [{ ...valid.records[0], external_id: 'bad id' }] },
    { ...valid, unexpected: true },
  ]) {
    assert.equal((await u.api('POST', '/imports/preview', { body })).status, 400);
  }
  const unauthenticated = await fetch(`${wallet.baseUrl}/api/imports/confirm`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(valid),
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(await countTransactions(u.api), 0);
  assert.equal(ledgerCount(), before);
});

test('a later conflict rolls back an earlier new record; changed identity is 409', async () => {
  const u = await registerUser(wallet.baseUrl, 'import-atomic');
  const original = batch(u.categories[0].name);
  assert.equal((await u.api('POST', '/imports/confirm', { body: original })).status, 201);
  const changed = { ...original.records[0], amount_cents: 3501 };
  const earlier = { ...original.records[0], external_id: 'synthetic-before-conflict' };
  const before = ledgerCount();
  const result = await u.api('POST', '/imports/confirm', { body: batch(u.categories[0].name, [earlier, changed]) });
  assert.equal(result.status, 409);
  assert.equal(await countTransactions(u.api), 1);
  assert.equal(ledgerCount(), before);
});

test('a later unknown category rolls back an earlier valid new record', async () => {
  const u = await registerUser(wallet.baseUrl, 'import-unknown-late');
  const first = batch(u.categories[0].name).records[0];
  const second = { ...first, external_id: 'synthetic-unknown-late', category_name: 'Missing category' };
  const before = ledgerCount();
  const result = await u.api('POST', '/imports/confirm', {
    body: batch(u.categories[0].name, [first, second]),
  });
  assert.equal(result.status, 404);
  assert.equal(await countTransactions(u.api), 0);
  assert.equal(ledgerCount(), before);
});

test('one external ID is isolated by user and deleted originals are tombstones', async () => {
  const a = await registerUser(wallet.baseUrl, 'import-a');
  const b = await registerUser(wallet.baseUrl, 'import-b');
  const first = await a.api('POST', '/imports/confirm', { body: batch(a.categories[0].name) });
  const second = await b.api('POST', '/imports/confirm', { body: batch(b.categories[0].name) });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(first.data.records[0].transaction_id, second.data.records[0].transaction_id);
  assert.equal((await a.api('DELETE', `/transactions/${first.data.records[0].transaction_id}`)).status, 204);
  assert.equal((await a.api('POST', '/imports/confirm', { body: batch(a.categories[0].name) })).status, 409);
  assert.equal(await countTransactions(a.api), 0);
  assert.equal(await countTransactions(b.api), 1);
});

test('a category existing only in another account cannot be imported', async () => {
  const a = await registerUser(wallet.baseUrl, 'import-foreign-a');
  const b = await registerUser(wallet.baseUrl, 'import-foreign-b');
  const categoryName = 'Synthetic private category';
  assert.equal((await b.api('POST', '/categories', { body: { name: categoryName } })).status, 201);
  const before = ledgerCount();
  const denied = await a.api('POST', '/imports/confirm', { body: batch(categoryName) });
  assert.equal(denied.status, 404);
  assert.equal(await countTransactions(a.api), 0);
  assert.equal(ledgerCount(), before);
});
