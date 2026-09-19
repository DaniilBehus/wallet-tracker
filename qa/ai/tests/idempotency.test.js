'use strict';

// Keyed saves over real HTTP (D-035, AI-R09). The AI review screen retries a
// save whose answer was lost; these tests are why a retry cannot create a
// second expense, resurrect a deleted one, or undo an edit.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const { startWallet, client, registerUser, localToday, countTransactions } = require('../support/wallet-server');

let wallet;

test.before(async () => {
  wallet = await startWallet({ mode: 'off' });
});

test.after(async () => {
  if (wallet) await wallet.stop();
});

const newKey = () => `ai-${crypto.randomUUID()}`;

function save(u, body, key) {
  return u.api('POST', '/transactions', { body, headers: key === undefined ? {} : { 'Idempotency-Key': key } });
}

function expense(u, extra = {}) {
  return { amount_cents: 1800, category_id: u.categories[3].id, spent_on: localToday(-1), note: 'lunch', ...extra };
}

test('same key and same payload: one expense, the replay says so', async () => {
  const u = await registerUser(wallet.baseUrl, 'replay');
  const key = newKey();
  const first = await save(u, expense(u), key);
  assert.equal(first.status, 201);
  assert.equal(first.headers.get('idempotency-replayed'), null);

  const second = await save(u, expense(u), key);
  assert.equal(second.status, 201);
  assert.equal(second.headers.get('idempotency-replayed'), 'true');
  assert.deepEqual(second.data, first.data);
  assert.equal(await countTransactions(u.api), 1);
});

test('JSON key order is not part of the payload identity', async () => {
  const u = await registerUser(wallet.baseUrl, 'order');
  const key = newKey();
  const e = expense(u);
  assert.equal((await save(u, e, key)).status, 201);
  const reordered = { note: e.note, spent_on: e.spent_on, category_id: e.category_id, amount_cents: e.amount_cents };
  const again = await save(u, reordered, key);
  assert.equal(again.status, 201);
  assert.equal(again.headers.get('idempotency-replayed'), 'true');
  assert.equal(await countTransactions(u.api), 1);
});

test('20 concurrent saves with one key create exactly one expense', async () => {
  const u = await registerUser(wallet.baseUrl, 'burst');
  const key = newKey();
  const results = await Promise.all(Array.from({ length: 20 }, () => save(u, expense(u), key)));
  assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.status)));
  assert.equal(new Set(results.map((r) => r.data.id)).size, 1);
  assert.equal(results.filter((r) => r.headers.get('idempotency-replayed') === 'true').length, 19);
  assert.equal(await countTransactions(u.api), 1);
});

test('same key, different payload: 409 conflict, nothing new', async () => {
  const u = await registerUser(wallet.baseUrl, 'conflict');
  const key = newKey();
  assert.equal((await save(u, expense(u), key)).status, 201);
  const res = await save(u, expense(u, { amount_cents: 1900 }), key);
  assert.equal(res.status, 409);
  assert.equal(res.data.error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(await countTransactions(u.api), 1);
});

test('keys are per user: two users with one key get two expenses', async () => {
  const a = await registerUser(wallet.baseUrl, 'ka');
  const b = await registerUser(wallet.baseUrl, 'kb');
  const key = newKey();
  assert.equal((await save(a, expense(a), key)).status, 201);
  const other = await save(b, expense(b), key);
  assert.equal(other.status, 201);
  assert.equal(other.headers.get('idempotency-replayed'), null);
  assert.equal(await countTransactions(a.api), 1);
  assert.equal(await countTransactions(b.api), 1);
});

test('different keys are different expenses; unkeyed duplicates stay allowed', async () => {
  const u = await registerUser(wallet.baseUrl, 'distinct');
  assert.equal((await save(u, expense(u), newKey())).status, 201);
  assert.equal((await save(u, expense(u), newKey())).status, 201);
  assert.equal((await save(u, expense(u))).status, 201);
  assert.equal((await save(u, expense(u))).status, 201);
  assert.equal(await countTransactions(u.api), 4, 'the keypad path keeps its old behaviour');
});

test('replay after delete is 409 and does not bring the expense back', async () => {
  const u = await registerUser(wallet.baseUrl, 'deleted');
  const key = newKey();
  const first = await save(u, expense(u), key);
  assert.equal((await u.api('DELETE', `/transactions/${first.data.id}`)).status, 204);
  const res = await save(u, expense(u), key);
  assert.equal(res.status, 409);
  assert.equal(res.data.error.code, 'IDEMPOTENCY_REPLAY_UNAVAILABLE');
  assert.equal(await countTransactions(u.api), 0);
});

test('replay after an edit does not undo the edit', async () => {
  const u = await registerUser(wallet.baseUrl, 'edited');
  const key = newKey();
  const first = await save(u, expense(u), key);
  assert.equal((await u.api('PATCH', `/transactions/${first.data.id}`, { body: { amount_cents: 2500 } })).status, 200);
  const replay = await save(u, expense(u), key);
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get('idempotency-replayed'), 'true');
  const list = await u.api('GET', `/transactions?from=1900-01-01&to=${localToday(1)}`);
  assert.equal(list.data.total, 1);
  assert.equal(list.data.items[0].amount_cents, 2500, 'the stored row keeps the edit');
});

test('invalid keyed requests are 400 and write nothing', async () => {
  const u = await registerUser(wallet.baseUrl, 'invalid');
  for (const bad of ['short', 'has space in it', 'x'.repeat(65), 'ünïcode-key']) {
    const res = await save(u, expense(u), bad);
    assert.equal(res.status, 400, `key ${JSON.stringify(bad)}`);
    assert.equal(res.data.error.code, 'VALIDATION_FAILED');
  }
  const noDate = expense(u);
  delete noDate.spent_on;
  const res = await save(u, noDate, newKey());
  assert.equal(res.status, 400);
  assert.equal(res.data.error.code, 'VALIDATION_FAILED');
  assert.equal(await countTransactions(u.api), 0);
});

test('a keyed save still refuses another user\'s category', async () => {
  const a = await registerUser(wallet.baseUrl, 'own-a');
  const b = await registerUser(wallet.baseUrl, 'own-b');
  const res = await save(a, expense(a, { category_id: b.categories[0].id }), newKey());
  assert.ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
  assert.equal(await countTransactions(a.api), 0);
  assert.equal(await countTransactions(b.api), 0);
});

test('a key survives a restart, and an old database without the new tables upgrades', async () => {
  const env = { JWT_SECRET: 'idempotency-restart-secret-'.padEnd(64, 'y') };
  const first = await startWallet({ mode: 'off', env });
  const u = await registerUser(first.baseUrl, 'restart');
  const key = newKey();
  const saved = await save(u, expense(u), key);
  assert.equal(saved.status, 201);
  await first.stop({ keepDatabase: true });
  const dbPath = first.databasePath;

  try {
    const second = await startWallet({ mode: 'off', env, dbPath });
    try {
      const again = { ...u, api: client(second.baseUrl, u.token) };
      const replay = await save(again, expense(u), key);
      assert.equal(replay.status, 201);
      assert.equal(replay.headers.get('idempotency-replayed'), 'true');
      assert.equal(replay.data.id, saved.data.id);
    } finally {
      await second.stop({ keepDatabase: true });
    }

    // Simulate a database from before this feature: the new tables are gone.
    const raw = new Database(dbPath);
    raw.exec('DROP TABLE transaction_requests; DROP TABLE ai_quota;');
    raw.close();

    for (let run = 0; run < 2; run++) {
      const upgraded = await startWallet({ mode: 'off', env, dbPath });
      try {
        const api = client(upgraded.baseUrl, u.token);
        assert.equal(await countTransactions(api), 1, `run ${run}: existing expenses kept`);
        const keyed = await save({ ...u, api }, expense(u, { note: `after upgrade ${run}` }), newKey());
        assert.equal(keyed.status, 201, `run ${run}`);
        await api('DELETE', `/transactions/${keyed.data.id}`);
      } finally {
        await upgraded.stop({ keepDatabase: true });
      }
    }
  } finally {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  }
});
