'use strict';

// N3 (independent review 2026-09-16): an evaluation report must identify the code it
// ran. HEAD plus `git diff HEAD` omits untracked files — src/ai/normalize.js,
// public/ai-expense.js and qa/ai/evaluate.js were all untracked — so different
// code could carry the same identity.
//
// The evaluator runs from disposable copies of the source tree (no Git at
// all), and every change is made to the copy. This checkout is only read.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFakeOpenAI } = require('../support/fake-openai');
const { ROOT, liveEnv, runEvaluator, reportPaths, makeWalletCopy, sha256File, linkDirectory, removeDirectoryLink } = require('../support/eval-cli');

const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const DEV = ROWS.filter((r) => r.split === 'dev');
const FAKE_SECRET = 'sk-provenance-control-not-a-real-key-0000';

let copy;
let base;

async function fixtureCode(root) {
  const r = await runEvaluator({ root });
  assert.equal(r.code, 0, r.out);
  const paths = reportPaths(r.out, root);
  assert.ok(paths, r.out);
  return { report: JSON.parse(fs.readFileSync(paths.json, 'utf8')), md: fs.readFileSync(paths.md, 'utf8'), json: fs.readFileSync(paths.json, 'utf8') };
}

/** Changes a file in the copy, runs `body`, and restores the exact bytes. */
async function withChange(file, change, body) {
  const original = fs.readFileSync(file);
  const before = sha256File(file);
  change(file);
  try {
    return await body();
  } finally {
    fs.writeFileSync(file, original);
    assert.equal(sha256File(file), before, `${path.basename(file)} restored`);
  }
}

test.before(async () => {
  copy = makeWalletCopy('n3');
  base = await fixtureCode(copy);
});

test.after(() => {
  if (copy) fs.rmSync(copy, { recursive: true, force: true });
});

// --------------------------------------------------------- red against HEAD

test('N3.1 · changing only an implementation file Git does not track changes the recorded code identity', async () => {
  await withChange(path.join(copy, 'src', 'ai', 'normalize.js'), (f) => fs.appendFileSync(f, '\n// N3.1 control\n'), async () => {
    const changed = await fixtureCode(copy);
    assert.notEqual(JSON.stringify(changed.report.code), JSON.stringify(base.report.code), 'the same identity was recorded for different code');
    assert.notEqual(changed.report.code.manifest.aggregate_sha256, base.report.code.manifest.aggregate_sha256);
    const entry = (r) => r.code.manifest.files.find((f) => f.path === 'src/ai/normalize.js');
    assert.notEqual(entry(changed.report).sha256, entry(base.report).sha256, 'the manifest names the changed file');
  });
});

test('N3.2 · changing only the evaluator implementation changes the recorded code identity', async () => {
  await withChange(path.join(copy, 'qa', 'ai', 'evaluate.js'), (f) => fs.appendFileSync(f, '\n// N3.2 control\n'), async () => {
    const changed = await fixtureCode(copy);
    assert.notEqual(JSON.stringify(changed.report.code), JSON.stringify(base.report.code), 'the same identity was recorded for different code');
    assert.notEqual(changed.report.code.manifest.aggregate_sha256, base.report.code.manifest.aggregate_sha256);
  });
});

test('N3.3 · secrets, databases and reports are never read into the manifest', async () => {
  const planted = [
    ['.env', `OPENAI_API_KEY=${FAKE_SECRET}\n`],
    ['src/.env', `OPENAI_API_KEY=${FAKE_SECRET}\n`],
    ['public/.env.local', `OPENAI_API_KEY=${FAKE_SECRET}\n`],
    ['qa/ai/data/leftover.db', 'not a real database'],
    ['qa/ai/data/leftover.db-wal', 'not a real wal'],
    ['qa/ai/data/leftover.sqlite', 'not a real database'],
    ['qa/reports/ai-eval/planted.md', `report mentioning ${FAKE_SECRET}`],
    ['scripts/credentials.pem', 'not a real key'],
  ];
  for (const [rel, content] of planted) {
    fs.mkdirSync(path.dirname(path.join(copy, rel)), { recursive: true });
    fs.writeFileSync(path.join(copy, rel), content);
  }
  try {
    const after = await fixtureCode(copy);
    assert.equal(JSON.stringify(after.report.code), JSON.stringify(base.report.code));
    assert.equal(after.json.includes(FAKE_SECRET), false, 'the fake secret is not in the JSON report');
    assert.equal(after.md.includes(FAKE_SECRET), false, 'the fake secret is not in the Markdown report');
    const listed = after.report.code.manifest.files.map((f) => f.path);
    for (const [rel] of planted) assert.equal(listed.includes(rel), false, `${rel} is not listed`);
  } finally {
    for (const [rel] of planted) fs.rmSync(path.join(copy, rel), { force: true });
  }
});

test('N3.4 · a source change during a run is reported, not attributed to one snapshot', async () => {
  const fake = createFakeOpenAI();
  const fakeUrl = await fake.listen();
  const evalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-n3-live-'));
  try {
    await withChange(path.join(copy, 'src', 'ai', 'normalize.js'), () => {}, async () => {
      fake.plan({ output: DEV[0].fixture_output, gate: 'mid-run' });
      const pending = runEvaluator({ root: copy, args: ['--live', '--limit', '1'], env: liveEnv({ WALLET_AI_EVAL_DB: path.join(evalDir, 'ai-eval.db') }), fakeUrl });
      const deadline = Date.now() + 20000;
      while (fake.requests.length === 0) {
        if (Date.now() > deadline) throw new Error('the run never dispatched');
        await new Promise((r) => setTimeout(r, 25));
      }
      fs.appendFileSync(path.join(copy, 'src', 'ai', 'normalize.js'), '\n// N3.4 changed while the run was in flight\n');
      fake.openGate('mid-run');
      const r = await pending;
      const paths = reportPaths(r.out, copy);
      assert.ok(paths, r.out);
      const report = JSON.parse(fs.readFileSync(paths.json, 'utf8'));
      assert.equal(report.code.changed_during_run, true, 'the report noticed the change');
      assert.deepEqual(report.code.changed_files, ['src/ai/normalize.js']);
      assert.notEqual(r.code, 0, 'a run over changing code is not a clean pass');
      assert.match(fs.readFileSync(paths.md, 'utf8'), /SOURCE CHANGED DURING RUN/);
    });
  } finally {
    await fake.close();
    fs.rmSync(evalDir, { recursive: true, force: true });
  }
});

// ------------------------------------------------ properties of the manifest

test('N3.5 · this checkout and a no-Git copy of the same bytes give the same manifest; Git only lists the same files', () => {
  const { buildManifest } = require('../provenance');
  const here = buildManifest({ root: ROOT });
  const there = buildManifest({ root: copy });
  assert.equal(there.aggregate_sha256, here.aggregate_sha256);
  assert.deepEqual(there.files, here.files);
  assert.deepEqual(here.missing_required, []);

  // Same enumeration as `git ls-files -co --exclude-standard` over the roots,
  // the method the independent review used for its fingerprint.
  const git = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '--', ...here.roots], { cwd: ROOT, encoding: 'utf8' });
  if (git.status === 0) {
    const listed = [...new Set(git.stdout.split('\n').filter(Boolean))].filter((f) => fs.existsSync(path.join(ROOT, f))).sort();
    assert.deepEqual(here.files.map((f) => f.path), listed);
  }
});

test('N3.6 · links inside the tree are not followed and are reported', () => {
  const { buildManifest } = require('../provenance');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-n3-outside-'));
  const link = path.join(copy, 'src', 'ai', 'linked-outside');
  try {
    fs.writeFileSync(path.join(outside, 'elsewhere.js'), '// outside the source tree\n');
    linkDirectory(outside, link);
    const m = buildManifest({ root: copy });
    assert.equal(m.aggregate_sha256, base.report.code.manifest.aggregate_sha256);
    assert.deepEqual(m.skipped_links, ['src/ai/linked-outside']);
    assert.equal(m.files.some((f) => f.path.startsWith('src/ai/linked-outside')), false);
  } finally {
    if (fs.existsSync(link)) removeDirectoryLink(link);
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('N3.7 · a missing required input is reported by name', async () => {
  const { buildManifest } = require('../provenance');
  const file = path.join(copy, 'public', 'ai-expense.js');
  await withChange(file, (f) => fs.rmSync(f), async () => {
    const m = buildManifest({ root: copy });
    assert.deepEqual(m.missing_required, ['public/ai-expense.js']);
  });
});
