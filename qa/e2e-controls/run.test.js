'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const RUNNER = path.join(ROOT, 'qa', 'e2e-runner', 'run.js');
const runner = fs.existsSync(RUNNER) ? require(RUNNER) : null;

function fixture(work) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-e2e-control-'));
  return Promise.resolve().then(() => work(dir)).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function childScripts(dir, browserExit = 0) {
  const server = path.join(dir, 'server.cjs');
  const browser = path.join(dir, 'browser.cjs');
  fs.writeFileSync(server, `const fs=require('node:fs');const http=require('node:http');\n` +
    `fs.writeFileSync(process.env.DB_PATH,'fresh');\n` +
    `http.createServer((req,res)=>{res.writeHead(200);res.end('ok')}).listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('wallet test listening'));\n`);
  fs.writeFileSync(browser, `process.exit(${browserExit});\n`);
  return { server, browser };
}

test('old fixed E2E path and direct CI browser entry are rejected by wiring controls', () => {
  const config = fs.readFileSync(path.join(ROOT, 'playwright.config.js'), 'utf8');
  const plan = require('../../scripts/verification-plan');
  assert.doesNotMatch(config, /path\.join\(__dirname, 'data', 'e2e\.db'\)/);
  assert.deepEqual(plan.GROUPS.e2e[0].args, ['qa/e2e-runner/run.js']);
  assert.ok(runner, 'managed E2E runner must exist');
});

test('two default allocations are fresh, distinct, and only their owned roots are removable', () => fixture(dir => {
  assert.ok(runner, 'managed E2E runner must exist');
  const first = runner.allocateDatabase({ tempParent: dir, sourceEnv: {} });
  const second = runner.allocateDatabase({ tempParent: dir, sourceEnv: {} });
  assert.notEqual(first.path, second.path);
  assert.equal(fs.existsSync(first.path), false);
  assert.equal(fs.existsSync(second.path), false);
  runner.removeOwnedDatabase(first);
  assert.equal(fs.existsSync(first.root), false);
  assert.equal(fs.existsSync(second.root), true);
  runner.removeOwnedDatabase(second);
}));

test('explicit existing, owner and old E2E paths fail before a child or byte change', () => fixture(dir => {
  assert.ok(runner, 'managed E2E runner must exist');
  const existing = path.join(dir, 'sentinel.db');
  fs.writeFileSync(existing, 'sentinel');
  assert.throws(() => runner.allocateDatabase({ sourceEnv: { DB_PATH: existing } }), /existing|refus|protected/i);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'sentinel');
  for (const name of ['wallet.db', 'e2e.db', 'wallet.db-wal']) {
    const protectedPath = path.join(ROOT, 'data', name);
    assert.throws(() => runner.allocateDatabase({ sourceEnv: { DB_PATH: protectedPath } }), /protected|refus/i);
  }
  const fresh = path.join(dir, 'new.db');
  const reserved = runner.allocateDatabase({ sourceEnv: { DB_PATH: fresh } });
  assert.equal(reserved.root, null);
  assert.equal(fs.existsSync(fresh), true);
  assert.throws(() => runner.allocateDatabase({ sourceEnv: { DB_PATH: fresh } }), /existing|refus/i);
  const alias = path.join(dir, 'alias.db');
  fs.linkSync(existing, alias);
  assert.throws(() => runner.allocateDatabase({ sourceEnv: { DB_PATH: alias } }), /existing|refus/i);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'sentinel');
}));

test('each adjacent SQLite sidecar refuses a new explicit base without changing sentinel bytes', () => fixture(dir => {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const base = path.join(dir, `adjacent-${suffix.slice(1)}.db`);
    const sidecar = base + suffix;
    const sentinel = Buffer.from(`sentinel:${suffix}`);
    fs.writeFileSync(sidecar, sentinel);
    const before = fs.lstatSync(sidecar);
    assert.equal(fs.existsSync(base), false);
    assert.throws(() => runner.allocateDatabase({ sourceEnv: { DB_PATH: base } }), /sidecar|refus/i, suffix);
    assert.equal(fs.existsSync(base), false, suffix);
    assert.deepEqual(fs.readFileSync(sidecar), sentinel, suffix);
    const after = fs.lstatSync(sidecar);
    assert.equal(after.dev, before.dev, suffix);
    assert.equal(after.ino, before.ino, suffix);
  }
}));

test('a dangling adjacent sidecar symlink is refused when this filesystem allows it', t => fixture(dir => {
  const base = path.join(dir, 'dangling.db');
  const sidecar = base + '-wal';
  try { fs.symlinkSync(path.join(dir, 'missing-target'), sidecar, 'file'); }
  catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      t.skip('symlink fixture unavailable; regular sidecar cases still run');
      return;
    }
    throw error;
  }
  assert.equal(fs.existsSync(sidecar), false);
  const before = fs.lstatSync(sidecar);
  assert.throws(() => runner.allocateDatabase({ sourceEnv: { DB_PATH: base } }), /sidecar|refus/i);
  assert.equal(fs.existsSync(base), false);
  assert.equal(fs.lstatSync(sidecar).ino, before.ino);
}));

test('all adjacent sidecars block the managed runner before either child starts', async () => fixture(async dir => {
  const server = path.join(dir, 'marker-server.cjs');
  const marker = path.join(dir, 'child-started');
  fs.writeFileSync(server, `require('node:fs').writeFileSync(${JSON.stringify(marker)},'started');\n`);
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const base = path.join(dir, `managed-${suffix.slice(1)}.db`);
    const sidecar = base + suffix;
    const sentinel = Buffer.from(`managed:${suffix}`);
    fs.writeFileSync(sidecar, sentinel);
    const before = fs.lstatSync(sidecar);
    await assert.rejects(runner.runManaged({ sourceEnv: { DB_PATH: base },
      serverEntry: server, port: await freePort(), readyTimeoutMs: 1000 }), /adjacent SQLite sidecar/, suffix);
    assert.equal(fs.existsSync(base), false, suffix);
    assert.equal(fs.existsSync(marker), false, suffix);
    assert.deepEqual(fs.readFileSync(sidecar), sentinel, suffix);
    assert.equal(fs.lstatSync(sidecar).ino, before.ino, suffix);
  }
}));

test('unconfirmed child exit and replaced owned directory cannot be cleaned or pass', () => fixture(dir => {
  const database = runner.allocateDatabase({ sourceEnv: {}, tempParent: dir });
  assert.throws(() => runner.finalizeDatabase(database, { serverClosed: false, browserClosed: true }), /not confirmed/);
  assert.equal(fs.existsSync(database.root), true);
  const moved = database.root + '-original';
  fs.renameSync(database.root, moved);
  fs.mkdirSync(database.root);
  fs.writeFileSync(path.join(database.root, 'sentinel'), 'not ours');
  assert.throws(() => runner.finalizeDatabase(database, { serverClosed: true, browserClosed: true }), /not owned/);
  assert.equal(fs.readFileSync(path.join(database.root, 'sentinel'), 'utf8'), 'not ours');
}));

test('direct internal server mode refuses startup without a runner-provided database', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--serve'], { cwd: ROOT, encoding: 'utf8',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires runner-provided database and port/);
});

test('real child success/failure closes browser and server before owned cleanup', async () => fixture(async dir => {
  assert.ok(runner, 'managed E2E runner must exist');
  const paths = [];
  for (const expected of [0, 7]) {
    const { server, browser } = childScripts(dir, expected);
    const events = [];
    const result = await runner.runManaged({ sourceEnv: {}, tempParent: dir,
      serverEntry: server, browserEntry: browser, port: await freePort(), onEvent: event => events.push(event),
      readyTimeoutMs: 3000, stopTimeoutMs: 3000 });
    assert.equal(result.exitCode, expected);
    paths.push(result.database.path);
    assert.equal(result.cleaned, true);
    assert.equal(fs.existsSync(result.database.root), false);
    assert.ok(events.indexOf('browser-close') < events.indexOf('server-close'));
    assert.ok(events.indexOf('server-close') < events.indexOf('cleanup'));
  }
  assert.notEqual(paths[0], paths[1]);
}));

test('the actual Wallet server is managed on loopback and leaves no default database', async () => fixture(async dir => {
  const browser = path.join(dir, 'browser.cjs');
  fs.writeFileSync(browser, 'process.exit(0);\n');
  const result = await runner.runManaged({ sourceEnv: {}, tempParent: dir,
    browserEntry: browser, port: await freePort(), readyTimeoutMs: 5000 });
  assert.equal(result.exitCode, 0);
  assert.equal(result.serverClosed, true);
  assert.equal(result.cleaned, true);
  assert.equal(fs.existsSync(result.database.root), false);
}));

test('an explicit new database is actually used and retained after real server shutdown', async () => fixture(async dir => {
  const browser = path.join(dir, 'browser.cjs');
  const database = path.join(dir, 'explicit.db');
  fs.writeFileSync(browser, 'process.exit(0);\n');
  const result = await runner.runManaged({ sourceEnv: { DB_PATH: database }, tempParent: dir,
    browserEntry: browser, port: await freePort(), readyTimeoutMs: 5000 });
  assert.equal(result.exitCode, 0);
  assert.equal(result.serverClosed, true);
  assert.equal(result.cleaned, false);
  assert.equal(result.database.path, database);
  assert.ok(fs.statSync(database).size > 0);
}));

test('an occupied port and an early server error never turn green or reuse a server', async () => fixture(async dir => {
  const occupied = net.createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(runner.runManaged({ sourceEnv: {}, tempParent: dir,
      port: occupied.address().port }), /occupied/);
    assert.equal(fs.readdirSync(dir).length, 0);
  } finally { await new Promise(resolve => occupied.close(resolve)); }
  const events = [];
  await assert.rejects(runner.runManaged({ sourceEnv: {}, tempParent: dir,
    serverEntry: path.join(dir, 'missing-server.cjs'), port: await freePort(),
    onEvent: event => events.push(event), readyTimeoutMs: 1000 }), /exited before readiness/);
  assert.ok(events.includes('server-close'));
  assert.ok(events.includes('cleanup'));
  assert.equal(fs.readdirSync(dir).filter(name => name.startsWith('wallet-e2e-')).length, 0);
}));

test('a server that exits after readiness but before the browser finishes cannot pass', async () => fixture(async dir => {
  const server = path.join(dir, 'short-server.cjs');
  const browser = path.join(dir, 'slow-browser.cjs');
  fs.writeFileSync(server, `const http=require('node:http');\n` +
    `const s=http.createServer((req,res)=>{res.writeHead(200);res.end('ok',()=>setTimeout(()=>s.close(()=>process.exit(0)),200))});\n` +
    `s.listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('wallet test listening'));\n`);
  fs.writeFileSync(browser, 'setTimeout(() => process.exit(0), 450);\n');
  const events = [];
  await assert.rejects(runner.runManaged({ sourceEnv: {}, tempParent: dir,
    serverEntry: server, browserEntry: browser, port: await freePort(),
    onEvent: event => events.push(event), readyTimeoutMs: 3000 }), /server exited before runner shutdown/);
  assert.ok(events.includes('server-close'));
  assert.ok(events.includes('cleanup'));
}));

test('a signalled browser has a nonzero verdict and still waits for server cleanup', async () => fixture(async dir => {
  const { server, browser } = childScripts(dir);
  fs.writeFileSync(browser, "process.kill(process.pid, 'SIGTERM');\n");
  const events = [];
  const result = await runner.runManaged({ sourceEnv: {}, tempParent: dir,
    serverEntry: server, browserEntry: browser, port: await freePort(),
    onEvent: event => events.push(event), readyTimeoutMs: 3000 });
  assert.notEqual(result.exitCode, 0);
  assert.equal(result.cleaned, true);
  assert.ok(events.indexOf('server-close') < events.indexOf('cleanup'));
}));

test('external target and inherited provider/auth variables never reach children', () => fixture(dir => {
  assert.ok(runner, 'managed E2E runner must exist');
  assert.throws(() => runner.validateTarget({ QA_BASE_URL: 'https://example.com' }), /loopback|external|refus/i);
  const env = runner.cleanChildEnv({ OPENAI_API_KEY: 'private', DB_PATH: 'wrong', JWT_SECRET: 'wrong',
    WALLET_HOST: '0.0.0.0', HOST: '0.0.0.0', QA_BASE_URL: 'https://example.com', PATH: process.env.PATH },
    { PORT: '3002', DB_PATH: path.join(dir, 'db'),
      JWT_SECRET: 'throwaway', WALLET_AI_MODE: 'off' });
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.QA_BASE_URL, undefined);
  assert.equal(env.WALLET_HOST, undefined);
  assert.equal(env.HOST, undefined);
  assert.equal(env.DB_PATH, path.join(dir, 'db'));
  assert.equal(env.JWT_SECRET, 'throwaway');
  assert.match(env.NODE_OPTIONS, /no-network\.js/);
}));
