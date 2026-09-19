'use strict';

// `npm run ai:demo` as a user meets it: a separate process, its own database,
// the named examples working, everything else refused honestly.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { startWallet, client, registerUser, localToday, countTransactions, freePort, ROOT } = require('../support/wallet-server');
const { EXAMPLES } = require('../demo');

let child;
let baseUrl;
let dir;
let output = '';

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-demo-'));
  const port = await freePort();
  child = spawn(process.execPath, [path.join(ROOT, 'qa', 'ai', 'demo.js')], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
      AI_DEMO_DIR: dir, AI_DEMO_PORT: String(port),
      // A key in the environment must not turn the demo into a live run.
      OPENAI_API_KEY: 'sk-demo-test-not-a-real-key', WALLET_AI_MODEL: 'x', WALLET_AI_LIVE_ALLOWED: 'true', WALLET_AI_MODE: 'live',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const deadline = Date.now() + 20000;
  for (;;) {
    const m = output.match(/listening on http:\/\/localhost:(\d+)/);
    if (m) { baseUrl = `http://127.0.0.1:${m[1]}`; break; }
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`demo did not start:\n${output}`);
    await new Promise((r) => setTimeout(r, 100));
  }
});

test.after(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise((r) => child.once('exit', r));
    child.kill();
    await exited;
  }
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const body = (text) => ({ text, reference_date: localToday(), locale: 'auto' });

test('the banner says demo and names the examples; the database is the demo folder', () => {
  assert.match(output, /Wallet AI DEMO — sample responses, no AI service contacted/);
  for (const e of EXAMPLES) assert.ok(output.includes(e.text), e.text);
  assert.ok(fs.existsSync(path.join(dir, 'demo.db')));
});

test('capabilities: demo, no external consent, never OpenAI even with a key in the environment', async () => {
  const u = await registerUser(baseUrl, 'demo-caps');
  const res = await u.api('GET', '/ai/capabilities');
  assert.equal(res.status, 200);
  assert.equal(res.data.mode, 'demo');
  assert.equal(res.data.provider, 'demo');
  assert.equal(res.data.requires_external_consent, false);
});

test('the three "18 euros for lunch yesterday" examples give the same draft in EN, UK and SK', async () => {
  const u = await registerUser(baseUrl, 'demo-lunch');
  const restaurants = u.categories.find((c) => c.name === 'Restaurants');
  for (const e of EXAMPLES.filter((x) => x.source_case <= 'AI-EVAL-003')) {
    const res = await u.api('POST', '/ai/expense-draft', { body: body(e.text) });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.mode, 'demo');
    assert.equal(res.data.status, 'ready', e.language);
    assert.equal(res.data.draft.amount_cents, 1800);
    assert.equal(res.data.draft.category_id, restaurants.id);
    assert.equal(res.data.draft.spent_on, localToday(-1));
  }
  assert.equal(await countTransactions(u.api), 0, 'a demo draft is not an expense');
});

test('every example produces its labelled status', async () => {
  const u = await registerUser(baseUrl, 'demo-all');
  for (const e of EXAMPLES) {
    const res = await u.api('POST', '/ai/expense-draft', { body: body(`  ${e.text} `) });
    assert.equal(res.status, 200, `${e.source_case}: ${JSON.stringify(res.data)}`);
    assert.equal(res.data.status, e.shows, e.source_case);
  }
});

test('text outside the examples is DEMO_UNSUPPORTED, never a made-up draft', async () => {
  const u = await registerUser(baseUrl, 'demo-other');
  const res = await u.api('POST', '/ai/expense-draft', { body: body('Dinner 25 EUR yesterday') });
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'unsupported');
  assert.deepEqual(res.data.issues.map((i) => i.code), ['DEMO_UNSUPPORTED']);
  assert.deepEqual(res.data.draft, { amount_cents: null, category_id: null, spent_on: null, note: null });
});

test('a user without the named category gets CATEGORY_REQUIRED, not someone else\'s id', async () => {
  const u = await registerUser(baseUrl, 'demo-renamed');
  const restaurants = u.categories.find((c) => c.name === 'Restaurants');
  // There is no rename endpoint; the demo database is this test's own file.
  const raw = new Database(path.join(dir, 'demo.db'));
  raw.pragma('busy_timeout = 5000');
  raw.prepare('UPDATE categories SET name = ? WHERE id = ?').run('Eating out', restaurants.id);
  raw.close();
  const res = await u.api('POST', '/ai/expense-draft', { body: body(EXAMPLES[0].text) });
  assert.equal(res.status, 200);
  assert.equal(res.data.draft.category_id, null);
  assert.ok(res.data.issues.some((i) => i.code === 'CATEGORY_REQUIRED'));
});

test('WALLET_AI_MODE=demo on the ordinary server enables nothing', async () => {
  const plain = await startWallet({ mode: 'demo' });
  try {
    const u = await registerUser(plain.baseUrl, 'plain-demo');
    assert.equal((await u.api('GET', '/ai/capabilities')).data.enabled, false);
    const res = await client(plain.baseUrl, u.token)('POST', '/ai/expense-draft', { body: body(EXAMPLES[0].text) });
    assert.equal(res.status, 503);
    assert.equal(res.data.error.code, 'AI_UNAVAILABLE');
  } finally {
    await plain.stop();
  }
});
