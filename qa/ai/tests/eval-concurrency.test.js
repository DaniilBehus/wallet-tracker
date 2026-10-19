'use strict';

// These controls change only disposable copies of the evaluator. A loopback
// barrier releases all children before userFor enters its SQLite transaction;
// a fixed start timestamp makes report-name collisions deterministic.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { createFakeOpenAI } = require('../support/fake-openai');
const { ensureWindowTable } = require('../eval-window');
const { ROOT, liveEnv, runEvaluator, callsAttempted, reportPaths, makeWalletCopy } = require('../support/eval-cli');

const DEV = fs.readFileSync(path.join(ROOT, 'qa/ai/data/eval-cases.jsonl'), 'utf8').trim().split('\n')
  .map(JSON.parse).filter((row) => row.split === 'dev' && row.kind === 'nl');

function editCopy(copy, oldText, newText, expected = 1) {
  const file = path.join(copy, 'qa/ai/evaluate.js');
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(source.split(oldText).length - 1, expected, 'test instrumentation anchor changed');
  fs.writeFileSync(file, source.replaceAll(oldText, newText));
}

function freshDb(copy, name) {
  const file = path.join(copy, 'data', `${name}.db`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  ensureWindowTable(db);
  db.close();
  return file;
}

function dbCounts(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return {
      users: db.prepare("SELECT COUNT(*) AS n FROM users WHERE email LIKE 'eval-%@wallet.test'").get().n,
      categories: db.prepare('SELECT COUNT(*) AS n FROM categories').get().n,
      reservations: db.prepare('SELECT COUNT(*) AS n FROM eval_provider_calls').get().n,
    };
  } finally { db.close(); }
}

function plan(fake, count) {
  for (let i = 0; i < count; i++) fake.plan({ output: DEV[i].fixture_output });
}

function removeCopy(copy) {
  const resolved = fs.realpathSync(copy);
  const temp = fs.realpathSync(os.tmpdir());
  if (path.dirname(resolved) !== temp || !path.basename(resolved).startsWith('wallet-ai-')) {
    throw new Error('refusing cleanup outside the owned evaluator copy');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

async function barrierFor(count) {
  const sockets = [];
  const server = net.createServer((socket) => {
    socket.on('error', () => {}); // a timed-out child may close its test connection
    sockets.push(socket);
    if (sockets.length === count) for (const peer of sockets) peer.end('go');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

const BARRIER_CLIENT = [
  'const net=require("net");',
  'const socket=net.connect(Number(process.argv[1]),"127.0.0.1");',
  'socket.on("data",()=>{});',
  'socket.on("error",()=>{process.exitCode=2});',
].join('');

test('concurrent synthetic setup commits one complete user before provider work', async () => {
  const copy = makeWalletCopy('init-race');
  const fake = createFakeOpenAI();
  const barrier = await barrierFor(3);
  try {
    editCopy(copy, '    const key = JSON.stringify(categories);', [
      '    if (process.env.WALLET_AI_TEST_BARRIER_PORT && !globalThis.__walletUserBarrierDone) {',
      '      globalThis.__walletUserBarrierDone = true;',
      '      const result = require("child_process").spawnSync(process.execPath,',
      '        ["-e", ' + JSON.stringify(BARRIER_CLIENT) + ', process.env.WALLET_AI_TEST_BARRIER_PORT],',
      '        { timeout: 15000, stdio: "ignore" });',
      '      if (result.status !== 0) throw new Error("test setup barrier failed");',
      '    }',
      '    const key = JSON.stringify(categories);',
    ].join('\n'));
    const dbFile = freshDb(copy, 'init-race');
    const url = await fake.listen();
    plan(fake, 6);
    const env = liveEnv({ WALLET_AI_EVAL_DB: dbFile, WALLET_AI_TEST_BARRIER_PORT: String(barrier.port) });
    const runs = await Promise.all([1, 2, 3].map(() => runEvaluator({ root: copy, args: ['--live', '--limit', '2'], env, fakeUrl: url })));
    assert.ok(runs.every((run) => run.code !== 2 && run.signal === null),
      `setup aborted: ${runs.map((run) => `${run.code}/${run.signal}: ${run.out}`).join('\n---\n')}`);
    const counts = dbCounts(dbFile);
    assert.deepEqual({ users: counts.users, categories: counts.categories },
      { users: 1, categories: 10 });
    assert.equal(fake.requests.length, counts.reservations);
    assert.equal(runs.reduce((sum, run) => sum + (callsAttempted(run.out) || 0), 0), fake.requests.length);
    assert.equal(fake.requests.length, 5);
    assert.ok(runs.some((run) => /evaluation rate limit|EVAL_WINDOW_FULL/.test(run.out)));
  } finally {
    await fake.close();
    await barrier.close();
    removeCopy(copy);
  }
});

test('failed synthetic category seed rolls back the new user and categories', async () => {
  const copy = makeWalletCopy('init-rollback');
  const fake = createFakeOpenAI();
  try {
    editCopy(copy, "if (categories === 'default') app.seedCategories(userId);",
      "if (categories === 'default') { app.seedCategories(userId); throw new Error('test seed interruption'); }");
    const dbFile = freshDb(copy, 'init-rollback');
    const url = await fake.listen();
    plan(fake, 1);
    const run = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'],
      env: liveEnv({ WALLET_AI_EVAL_DB: dbFile }), fakeUrl: url });
    assert.equal(run.code, 2);
    assert.match(run.out, /test seed interruption/);
    assert.deepEqual(dbCounts(dbFile), { users: 0, categories: 0, reservations: 0 });
    assert.equal(fake.requests.length, 0);
  } finally {
    await fake.close();
    removeCopy(copy);
  }
});

test('fixed-clock concurrent reports keep two immutable pairs and identifiable latest view', async () => {
  const copy = makeWalletCopy('report-race');
  const fake = createFakeOpenAI();
  try {
    editCopy(copy, 'const started = new Date().toISOString();',
      "const started = '2026-10-10T12:00:00.000Z';", 2);
    const dbFile = freshDb(copy, 'report-race');
    const url = await fake.listen();
    plan(fake, 5);
    const env = liveEnv({ WALLET_AI_EVAL_DB: dbFile });
    const warmup = await runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env, fakeUrl: url });
    assert.notEqual(warmup.code, 2, warmup.out);
    const runs = await Promise.all([1, 2].map(() => runEvaluator({ root: copy,
      args: ['--live', '--limit', '2'], env, fakeUrl: url })));
    assert.ok(runs.every((run) => run.code !== 2 && run.signal === null), runs.map((run) => run.out).join('\n---\n'));
    const paths = runs.map((run) => reportPaths(run.out, copy));
    assert.ok(paths.every(Boolean), runs.map((run) => run.out).join('\n---\n'));
    assert.equal(new Set(paths.map((p) => p.md)).size, 2, 'two runs must not share a report path');
    for (const pair of paths) {
      assert.equal(JSON.parse(fs.readFileSync(pair.json, 'utf8')).provider.calls_attempted, 2);
      assert.match(fs.readFileSync(pair.md, 'utf8'), /## RESULT:/);
    }
    const latest = fs.readFileSync(path.join(copy, 'qa/reports/ai-eval/live-test-seam-latest.md'), 'utf8');
    const link = latest.match(/Latest completed report: \[([^\]]+\.md)\]\(([^)]+\.md)\)/);
    assert.ok(link, 'latest view must identify a complete immutable report');
    assert.ok(paths.some((pair) => path.basename(pair.md) === link[2]));
  } finally {
    await fake.close();
    removeCopy(copy);
  }
});

test('failed second report publication removes its own partial pair and does not announce a report', async () => {
  const copy = makeWalletCopy('report-write-failure');
  try {
    editCopy(copy, '    fs.linkSync(tempMd, mdPath);',
      "    throw Object.assign(new Error('test report write interruption'), { code: 'EIO' });");
    const run = await runEvaluator({ root: copy });
    assert.equal(run.code, 2);
    assert.match(run.out, /report pair write failed \(EIO\); cleanup failures: none/);
    assert.doesNotMatch(run.out, /^report: /m);
    const dir = path.join(copy, 'qa/reports/ai-eval');
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    removeCopy(copy);
  }
});
