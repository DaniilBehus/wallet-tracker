'use strict';

// N4 (independent review 2026-09-16): the human-readable report must render the
// current report schema — the live-test-seam Markdown said `real calls
// undefined` and `Tokens: input undefined, output undefined` — and a one-row
// pilot must not read as full-corpus quality acceptance.
//
// The evaluator runs from a disposable copy so its reports are written there.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFakeOpenAI } = require('../support/fake-openai');
const { ROOT, liveEnv, runEvaluator, reportPaths, makeWalletCopy } = require('../support/eval-cli');

const ROWS = fs.readFileSync(path.join(ROOT, 'qa', 'ai', 'data', 'eval-cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const DEV = ROWS.filter((r) => r.split === 'dev');

let copy;
let fake;
let fakeUrl;
let evalDir;

test.before(async () => {
  copy = makeWalletCopy('n4');
  fake = createFakeOpenAI();
  fakeUrl = await fake.listen();
  evalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-n4-'));
});

test.after(async () => {
  if (fake) await fake.close();
  for (const d of [copy, evalDir]) if (d) fs.rmSync(d, { recursive: true, force: true });
});

test.beforeEach(() => fake.reset());

function readReport(r) {
  const paths = reportPaths(r.out, copy);
  assert.ok(paths, r.out);
  return { md: fs.readFileSync(paths.md, 'utf8'), json: JSON.parse(fs.readFileSync(paths.json, 'utf8')) };
}

test('N4.1 · a live-test-seam report renders fake requests, known and unknown usage and a partial scope, with nothing undefined', async () => {
  fake.plan({ output: DEV[0].fixture_output });                                                     // usage reported
  fake.plan({ raw: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(DEV[1].fixture_output) }] }] } }); // no usage
  fake.plan({ incomplete: true, usage: { input_tokens: 50, output_tokens: 600, output_tokens_details: { reasoning_tokens: 600 } } }); // billed, unusable

  const r = await runEvaluator({ root: copy, args: ['--live', '--limit', '3'], env: liveEnv({ WALLET_AI_EVAL_DB: path.join(evalDir, 'n4-1.db') }), fakeUrl });
  const { md, json } = readReport(r);

  assert.doesNotMatch(md, /undefined|NaN/, md);
  assert.match(md, /^## RESULT: FAIL$/m);
  assert.match(md, /real provider requests: 0/);
  assert.match(md, /local fake requests: 3/);
  assert.match(md, /known for 2 of 3 attempted calls \(input 170, output 640 tokens/);
  assert.match(md, /unknown for 1 call/);
  assert.match(md, /Unusable answers that still reported usage: 1/);
  assert.match(md, /Cost: not computed/);
  assert.match(md, /PARTIAL — selected 3 of 96 rows in split dev \(supported 3 of 93, exploratory 0 of 3\)/);
  assert.match(md, /NOT_APPLICABLE/);

  assert.equal(json.provider.real_provider_requests, 0);
  assert.equal(json.provider.local_fake_requests, 3);
  assert.equal(json.usage.known_calls, 2);
  assert.equal(json.usage.unknown_calls, 1);
  assert.equal(json.usage.input_tokens_known, 170);
  assert.equal(json.usage.output_tokens_known, 640);
  assert.equal(json.selection.available_rows, 96);
  assert.equal(json.selection.selected_rows, 3);
  assert.equal(json.selection.partial, true);
});

test('N4.2 · a fixture report states zero real requests, no model quality and the full scope', async () => {
  const r = await runEvaluator({ root: copy });
  assert.equal(r.code, 0, r.out);
  const { md, json } = readReport(r);
  assert.doesNotMatch(md, /undefined|NaN/, md);
  assert.match(md, /^## RESULT: PASS$/m);
  assert.match(md, /MODEL_QUALITY=NOT_MEASURED/);
  assert.match(md, /real provider requests: 0/);
  assert.match(md, /FULL — selected 116 of 116 rows in split all \(supported 113 of 113, exploratory 3 of 3\)/);
  assert.equal(json.provider.real_provider_requests, 0);
  assert.equal(json.usage, null);
  assert.equal(json.verdict.code, 'NOT_APPLICABLE');
});

// ------------------------------------------- renderer over explicit objects

const { markdownReport, qualityVerdict } = require('../report');

const ratio = (num, den) => ({ num, den, value: den === 0 ? null : num / den });
const metrics = (n, pass = n) => ({
  rows: n, row_pass: ratio(pass, n), status_accuracy: ratio(pass, n), amount_accuracy: ratio(pass, n), date_accuracy: ratio(pass, n),
  category_accuracy: ratio(pass, n), complete_draft_rate: ratio(pass, n), coverage: ratio(pass, n), issue_recall: ratio(pass, n),
  false_ready: 0, invented_numeric_fields: 0, wrong_numeric_fields: n - pass, invented_category: 0, errors: 0,
});

/** A complete report in the evaluator's JSON schema; every field set explicitly. */
function reportObject({ mode = 'LIVE', result = 'PASS', split = 'dev', selected = 96, available = 96, scored = selected, usage = 'known', changed = false } = {}) {
  const supportedAvailable = split === 'holdout' ? available : available - 3;
  const supportedSelected = Math.min(selected, supportedAvailable);
  const calls = mode === 'FIXTURE' ? 0 : scored;
  const usageBy = {
    none: null,
    known: { calls, known_calls: calls, unknown_calls: 0, input_tokens_known: 120 * calls, output_tokens_known: 40 * calls, reasoning_tokens_known: null, reasoning_known_calls: 0, unusable_calls_with_usage: 0 },
    unknown: { calls, known_calls: 0, unknown_calls: calls, input_tokens_known: 0, output_tokens_known: 0, reasoning_tokens_known: null, reasoning_known_calls: 0, unusable_calls_with_usage: 0 },
    mixed: { calls, known_calls: 1, unknown_calls: calls - 1, input_tokens_known: 50, output_tokens_known: 600, reasoning_tokens_known: 600, reasoning_known_calls: 1, unusable_calls_with_usage: 1 },
  };
  const selection = {
    split, limit: selected < available ? selected : null, available_rows: available, selected_rows: selected, scored_rows: scored,
    supported: { selected: supportedSelected, available: supportedAvailable },
    exploratory: { selected: selected - supportedSelected, available: available - supportedAvailable },
    holdout_rows_selected: split === 'holdout' ? selected : 0,
    partial: selected < available || scored < selected,
    holdout_rerun_reason: null,
  };
  const manifest = { algorithm: 'sha256', line_format: 'x', roots: ['src'], file_count: 112, aggregate_sha256: 'a'.repeat(64), missing_required: [], skipped_links: [], files: [] };
  return {
    mode,
    model_quality: mode === 'LIVE' ? 'MEASURED_ON_SYNTHETIC_CORPUS' : 'NOT_MEASURED',
    result,
    verdict: qualityVerdict({ mode, result, split, partial: selection.partial, changedDuringRun: changed }),
    started_at: '2026-09-16T10:00:00.000Z',
    finished_at: '2026-09-16T10:01:00.000Z',
    corpus: { path: 'qa/ai/data/eval-cases.jsonl', sha256: 'c'.repeat(64), version: '1' },
    selection,
    versions: { schema: '1', prompt: '1', normalizer: '2', prompt_sha256: 'd'.repeat(64), schema_sha256: 'e'.repeat(64) },
    code: { manifest, end_aggregate_sha256: changed ? 'b'.repeat(64) : manifest.aggregate_sha256, changed_during_run: changed, changed_files: changed ? ['src/ai/normalize.js'] : [], git: { head: 'unavailable', dirty_diff_sha256: 'unavailable', note: 'supplemental' } },
    provider: {
      id: mode === 'FIXTURE' ? 'none' : 'openai',
      name: mode === 'FIXTURE' ? 'fixture' : mode === 'LIVE' ? 'OpenAI' : 'OpenAI adapter → local fake',
      model: mode === 'FIXTURE' ? 'none' : 'model-under-test',
      calls_attempted: calls,
      real_provider_requests: mode === 'LIVE' ? calls : 0,
      local_fake_requests: mode === 'LIVE-TEST-SEAM' ? calls : 0,
    },
    allowance: mode === 'FIXTURE' ? null : { daily_calls: 200, used_before_run: 0 },
    summary: { supported: metrics(supportedSelected, result === 'FAIL' ? supportedSelected - 1 : supportedSelected), by_split: { [split]: metrics(supportedSelected) }, by_language: { en: metrics(supportedSelected) }, exploratory: { rows: selected - supportedSelected, row_pass: ratio(0, selected - supportedSelected) } },
    threshold: result === 'FAIL' ? { ok: false, failures: ['amount_accuracy 92/93 below 0.98'] } : { ok: true, failures: [] },
    mismatches: [],
    latency_ms: mode === 'FIXTURE' ? null : { p50: 900, p95: 1400, n: calls },
    usage: mode === 'FIXTURE' ? null : usageBy[usage === 'none' ? 'known' : usage],
    stopped_by: result === 'INCOMPLETE' ? 'AI_RATE_LIMITED at AI-EVAL-010: evaluation allowance or rate limit reached (Retry-After 3600 s)' : null,
  };
}

test('N4.3 · no undefined, NaN or empty value in any mode, result, scope, usage or source-change combination', () => {
  let rendered = 0;
  for (const mode of ['FIXTURE', 'LIVE-TEST-SEAM', 'LIVE']) {
    for (const result of ['PASS', 'FAIL', 'INCOMPLETE']) {
      for (const [selected, split] of [[96, 'dev'], [1, 'dev'], [20, 'holdout'], [1, 'holdout']]) {
        for (const usage of ['known', 'unknown', 'mixed']) {
          for (const changed of [false, true]) {
            const available = split === 'holdout' ? 20 : 96;
            const md = markdownReport(reportObject({ mode, result, split, selected, available, scored: result === 'INCOMPLETE' ? Math.max(0, selected - 1) : selected, usage, changed }));
            assert.doesNotMatch(md, /undefined|NaN|\[object Object\]|: ;|null tokens/, `${mode} ${result} ${split} ${selected} ${usage} ${changed}`);
            rendered += 1;
          }
        }
      }
    }
  }
  assert.equal(rendered, 216);
});

test('N4.4 · PASS, FAIL and INCOMPLETE get the same heading in the same place', () => {
  for (const result of ['PASS', 'FAIL', 'INCOMPLETE']) {
    const lines = markdownReport(reportObject({ result })).split('\n');
    assert.equal(lines[2], `## RESULT: ${result}`);
  }
  const incomplete = markdownReport(reportObject({ result: 'INCOMPLETE', scored: 9 }));
  assert.ok(incomplete.indexOf('**STOPPED:**') < incomplete.indexOf('## Supported-language rows'), 'the stop reason comes before any number');
});

test('N4.5 · missing usage is unknown, never zero; billed unusable answers are counted', () => {
  const unknown = markdownReport(reportObject({ usage: 'unknown', selected: 2, scored: 2 }));
  assert.match(unknown, /known for 0 of 2 attempted calls \(no token totals known\); unknown for 2 call\(s\)/);
  assert.doesNotMatch(unknown, /input 0|output 0/);

  const mixed = markdownReport(reportObject({ usage: 'mixed', selected: 3, scored: 3 }));
  assert.match(mixed, /known for 1 of 3 attempted calls \(input 50, output 600 tokens, of which reasoning 600 where reported\); unknown for 2 call\(s\)/);
  assert.match(mixed, /Unusable answers that still reported usage: 1/);
});

test('N4.6 · a pilot is never acceptance; full dev and full holdout verdicts are distinct', () => {
  const pilot = reportObject({ selected: 1, scored: 1 });
  assert.equal(pilot.verdict.code, 'PILOT_ONLY');
  const pilotMd = markdownReport(pilot);
  assert.match(pilotMd, /SCOPE=PARTIAL/);
  assert.match(pilotMd, /this is not quality acceptance for the dev split/);
  assert.doesNotMatch(pilotMd, /THRESHOLDS_MET/);

  assert.equal(reportObject({ split: 'dev', selected: 96, available: 96 }).verdict.code, 'DEV_THRESHOLDS_MET');
  assert.equal(reportObject({ split: 'holdout', selected: 20, available: 20 }).verdict.code, 'HOLDOUT_THRESHOLDS_MET');
  assert.equal(reportObject({ split: 'dev', result: 'FAIL' }).verdict.code, 'DEV_THRESHOLDS_NOT_MET');
  assert.equal(reportObject({ split: 'holdout', selected: 1, available: 20 }).verdict.code, 'PILOT_ONLY');
  assert.equal(reportObject({ result: 'INCOMPLETE', scored: 50 }).verdict.code, 'NOT_ASSESSED');
  assert.equal(reportObject({ changed: true }).verdict.code, 'NOT_ASSESSED');
  assert.equal(reportObject({ mode: 'LIVE-TEST-SEAM' }).verdict.code, 'NOT_APPLICABLE');
});

test('N4.7 · real and fake requests are never confused, and no cost is invented', () => {
  const real = markdownReport(reportObject({ mode: 'LIVE', selected: 1, scored: 1 }));
  assert.match(real, /real provider requests: 1; local fake requests: 0/);
  const seam = markdownReport(reportObject({ mode: 'LIVE-TEST-SEAM', selected: 1, scored: 1 }));
  assert.match(seam, /real provider requests: 0; local fake requests: 1/);
  for (const md of [real, seam]) {
    assert.match(md, /Cost: not computed/);
    assert.doesNotMatch(md, /[$€£]\s?\d|\d\s?[$€£]|\bUSD\b|\bEUR\b/);
  }
});

test('N4.8 · Markdown agrees with the JSON object it renders; a source change is stated before any number', () => {
  const report = reportObject({ selected: 5, scored: 5, usage: 'mixed', changed: true });
  const md = markdownReport(report);
  assert.ok(md.includes(`RESULT=${report.result}`));
  assert.ok(md.includes(`VERDICT=${report.verdict.code}`));
  assert.ok(md.includes(`selected ${report.selection.selected_rows} of ${report.selection.available_rows} rows in split ${report.selection.split}`));
  assert.ok(md.includes(`sha256 ${report.code.manifest.aggregate_sha256.slice(0, 16)}… over ${report.code.manifest.file_count} files`));
  assert.ok(md.includes(`known for ${report.usage.known_calls} of ${report.usage.calls} attempted calls`));
  assert.ok(md.includes(`real provider requests: ${report.provider.real_provider_requests}; local fake requests: ${report.provider.local_fake_requests}`));
  assert.ok(md.indexOf('**SOURCE CHANGED DURING RUN**') > 0);
  assert.ok(md.indexOf('**SOURCE CHANGED DURING RUN**') < md.indexOf('## Supported-language rows'));
  assert.match(md, /changed: src\/ai\/normalize\.js/);
});
