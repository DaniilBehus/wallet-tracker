'use strict';

// Negative controls for the evaluator and for the guards it scores (plan §14.4).
// Each control damages ONE thing in a disposable copy of the corpus and checks
// that the evaluator notices. The production corpus and code are not touched.
//
// Target of each control is named: EVALUATOR (the scoring harness itself) or
// PRODUCTION GUARD (the real normaliser/contract, fed a wrong model answer).

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { loadCorpus, scoreCase, summarize, checkThresholds, CorpusError } = require('../evaluate');

const ROOT = path.join(__dirname, '..', '..', '..');
const CORPUS = path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl');
const MANIFEST = path.join(ROOT, 'qa', 'ai', 'data', 'manifest.json');
const EVALUATE = path.join(ROOT, 'qa', 'ai', 'evaluate.js');

const originalRows = () => fs.readFileSync(CORPUS, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const originalManifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const dirs = [];
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/** Writes a mutated copy. `reseal` re-hashes the manifest so only the content change is tested. */
function copy({ rows, manifest = originalManifest(), reseal = true }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-evalctl-'));
  dirs.push(dir);
  const corpusPath = path.join(dir, 'eval-cases.jsonl');
  const text = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
  fs.writeFileSync(corpusPath, text);
  const m = { ...manifest };
  if (reseal) m.sha256 = crypto.createHash('sha256').update(text).digest('hex');
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(m));
  return { corpusPath, manifestPath };
}

function evaluate(paths) {
  const r = spawnSync(process.execPath, [EVALUATE, '--corpus', paths.corpusPath, '--manifest', paths.manifestPath], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function mutateRow(id, change) {
  return originalRows().map((row) => (row.id === id ? change(structuredClone(row)) : row));
}

// ------------------------------------------------------------ baseline

test('baseline: the unmodified corpus copy passes, so every red below is caused by its mutation', () => {
  const rows = originalRows();
  const resealed = copy({ rows });
  const r = evaluate(resealed);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /MODE=FIXTURE MODEL_QUALITY=NOT_MEASURED RESULT=PASS/);
});

// ------------------------------------------------------ EVALUATOR controls

test('EVALUATOR: one omitted row is refused before scoring', () => {
  const rows = originalRows().filter((r) => r.id !== 'AI-EVAL-040');
  const r = evaluate(copy({ rows }));
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /total rows 115, manifest says 116/);
  assert.doesNotMatch(r.out, /RESULT=PASS/);
});

test('EVALUATOR: an edited row without a new manifest hash is refused', () => {
  const rows = mutateRow('AI-EVAL-001', (row) => { row.expected.amount_cents = 1900; return row; });
  const r = evaluate(copy({ rows, reseal: false }));
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /does not match manifest/);
});

test('EVALUATOR: an empty corpus and a missing corpus file cannot produce a passing zero-case run', () => {
  const empty = copy({ rows: [], manifest: { ...originalManifest(), total_rows: 0, nl_rows: 0, nl_by_split: {}, holdout_ids: [] } });
  const r = evaluate(empty);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /corpus has no rows/);

  const missing = copy({ rows: originalRows() });
  fs.rmSync(missing.corpusPath);
  const m = evaluate(missing);
  assert.equal(m.code, 2, m.out);
  assert.match(m.out, /corpus file not found/);
});

test('EVALUATOR: a label that disagrees with the pipeline fails the run and names the row and field', () => {
  const rows = mutateRow('AI-EVAL-001', (row) => { row.expected.amount_cents = 1900; return row; });
  const r = evaluate(copy({ rows }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /RESULT=FAIL/);
  assert.match(r.out, /fixture consistency 112\/113/);
  const md = fs.readFileSync(path.join(ROOT, 'qa', 'reports', 'ai-eval', 'fixture-latest.md'), 'utf8');
  assert.match(md, /AI-EVAL-001 \(en, dev\): failed amount;/);
});

test('EVALUATOR: answering "unsupported" to everything is not scored as safe-and-correct', () => {
  const rows = originalRows();
  const scored = rows.map((row) => scoreCase(row, {
    kind: 'draft', status: 'unsupported', amount_cents: null, category_name: null, spent_on: null, issues: ['UNSUPPORTED_INTENT'],
  }));
  const summary = summarize(scored);
  const verdict = checkThresholds(summary, { expectedRows: 113 });
  assert.equal(verdict.ok, false);
  assert.equal(summary.supported.false_ready, 0, 'it is safe…');
  assert.equal(summary.supported.complete_draft_rate.num, 0, '…and useless');
  assert.ok(verdict.failures.some((f) => f.startsWith('complete_draft_rate 0/')));
  assert.ok(verdict.failures.some((f) => f.startsWith('amount_accuracy 0/')));
});

test('EVALUATOR: errors instead of drafts count as failures, and zero scored rows fail', () => {
  const rows = originalRows();
  const scored = rows.map((row) => scoreCase(row, { kind: 'error', code: 'AI_PROVIDER_FAILED' }));
  const verdict = checkThresholds(summarize(scored), { expectedRows: 113 });
  assert.equal(verdict.ok, false);
  assert.equal(summarize(scored).supported.errors, 113);

  const none = checkThresholds(summarize([]), { expectedRows: 113 });
  assert.equal(none.ok, false);
  assert.ok(none.failures.includes('no supported rows were scored'));
  assert.ok(none.failures.includes('scored 0 supported rows, selected 113'));
});

test('EVALUATOR: the loader reports every structural problem, not only the first', () => {
  const rows = originalRows();
  delete rows[0].expected.spent_on;
  rows[1].expected.status = 'maybe';
  const paths = copy({ rows });
  assert.throws(() => loadCorpus(paths), (err) => {
    assert.ok(err instanceof CorpusError);
    assert.ok(err.problems.some((p) => p.includes('expected.spent_on missing')));
    assert.ok(err.problems.some((p) => p.includes('expected.status "maybe"')));
    return true;
  });
});

// ------------------------------------------------- PRODUCTION GUARD controls

test('PRODUCTION GUARD: model says 180 where the text says 18 — detected, not accepted', () => {
  // Plan §14.4: "source amount changed from 18 to 180 while amount_text says 18".
  // Here the text is changed and the model answer kept, which is the same lie.
  const rows = mutateRow('AI-EVAL-001', (row) => { row.text = row.text.replace('18', '180'); return row; });
  const r = evaluate(copy({ rows }));
  assert.equal(r.code, 1, r.out);
  const report = JSON.parse(fs.readFileSync(latestJson(), 'utf8'));
  const row = report.mismatches.find((m) => m.id === 'AI-EVAL-001');
  assert.ok(row, 'the damaged row is reported');
  assert.deepEqual(row.actual, { error: 'AI_INVALID_RESPONSE' }, 'a span that is not in the text is a contract failure, not a draft');
});

test('PRODUCTION GUARD: currency_text null on "Lunch 10 USD" does not default to EUR', () => {
  const rows = mutateRow('AI-EVAL-028', (row) => { row.fixture_output.currency_text = null; return row; });
  const r = evaluate(copy({ rows }));
  // The guard holds, so the row still matches its label and the run passes.
  // A pass here is the evidence: the scanner saw USD without the model.
  assert.equal(r.code, 0, r.out);
  const report = JSON.parse(fs.readFileSync(latestJson(), 'utf8'));
  assert.equal(report.summary.supported.false_ready, 0);
  assert.ok(!report.mismatches.some((m) => m.id === 'AI-EVAL-028'));
});

test('PRODUCTION GUARD: a category ref that was never offered is rejected, not mapped', () => {
  const rows = mutateRow('AI-EVAL-001', (row) => { row.fixture_output.category_ref = 'c999'; return row; });
  const r = evaluate(copy({ rows }));
  assert.equal(r.code, 1, r.out);
  const report = JSON.parse(fs.readFileSync(latestJson(), 'utf8'));
  const row = report.mismatches.find((m) => m.id === 'AI-EVAL-001');
  assert.deepEqual(row.actual, { error: 'AI_INVALID_RESPONSE' });
});

function latestJson() {
  const dir = path.join(ROOT, 'qa', 'reports', 'ai-eval');
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('fixture-') && f.endsWith('.json'));
  files.sort();
  return path.join(dir, files[files.length - 1]);
}

test('R5 · EVALUATOR: one wrong non-null amount fails the run, even when accuracy stays above 98%', () => {
  // Independent review 2026-09-15: 59/60 = 98.3% passed the amount threshold, and
  // "invented" only counted numbers where none was expected. A confidently
  // wrong amount is the most expensive mistake this feature can make.
  const rows = originalRows();
  let altered = null;
  const scored = rows.map((row) => {
    const e = row.expected;
    const actual = {
      kind: 'draft', status: e.status, amount_cents: e.amount_cents, spent_on: e.spent_on,
      category_name: e.category_names ? e.category_names[0] : null, issues: e.issues_include,
    };
    if (!altered && e.status === 'ready' && e.amount_cents !== null) {
      altered = row.id;
      actual.amount_cents = 987654;
    }
    return scoreCase(row, actual);
  });
  const summary = summarize(scored);
  assert.ok(summary.supported.amount_accuracy.value >= 0.98, 'the control really stays above the accuracy target');
  const verdict = checkThresholds(summary, { expectedRows: 113 });
  assert.equal(verdict.ok, false, `${altered} carried a wrong amount and the run passed`);
  assert.equal(summary.supported.wrong_numeric_fields, 1);
  assert.ok(verdict.failures.some((f) => f.startsWith('wrong_numeric_fields 1')), verdict.failures.join('; '));
});

test('R5 · EVALUATOR: a wrong non-null date counts the same way', () => {
  const rows = originalRows();
  let done = false;
  const scored = rows.map((row) => {
    const e = row.expected;
    const actual = { kind: 'draft', status: e.status, amount_cents: e.amount_cents, spent_on: e.spent_on, category_name: e.category_names ? e.category_names[0] : null, issues: e.issues_include };
    if (!done && e.spent_on !== null) { done = true; actual.spent_on = '1999-01-01'; }
    return scoreCase(row, actual);
  });
  const summary = summarize(scored);
  assert.equal(summary.supported.wrong_numeric_fields, 1);
  assert.equal(checkThresholds(summary, { expectedRows: 113 }).ok, false);
});
