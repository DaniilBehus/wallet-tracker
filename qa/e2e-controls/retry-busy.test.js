'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { devices } = require('@playwright/test');
const { mutateBusySource } = require('./busy-mutation');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'playwright.config.js');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const RUNNER = path.join(ROOT, 'qa', 'e2e-runner', 'run.js');
let uuidCounter = 0;

function evaluateConfig(source, ci = true) {
  const context = {
    module: { exports: {} },
    require: name => {
      if (name === 'node:crypto') return { randomUUID: () =>
        `12345678-1234-4234-8234-${String(++uuidCounter).padStart(12, '0')}` };
      assert.equal(name, '@playwright/test');
      return { defineConfig: value => value, devices };
    },
    process: { env: { CI: ci ? '1' : '', QA_E2E_MANAGED: '1',
      QA_E2E_BASE_URL: 'http://127.0.0.1:39999/' } },
    URL,
  };
  vm.runInNewContext(source, context, { filename: CONFIG });
  return context.module.exports;
}

function verifyPolicy(source, ci = true) {
  const config = evaluateConfig(source, ci);
  assert.equal(config.retries, ci ? 1 : 0);
  assert.equal(config.failOnFlakyTests, ci);
  assert.equal(config.use.trace, 'retain-on-first-failure');
  assert.equal(config.reporter.filter(item => item[0] === 'json').length, 1);
  const jsonPath = config.reporter.find(item => item[0] === 'json')[1].outputFile;
  assert.match(jsonPath,
    /^qa\/reports\/playwright-main\/results-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/);
  assert.notEqual(config.reporter.find(item => item[0] === 'html')[1].outputFolder,
    config.outputDir);
  return jsonPath;
}

function verifyArtifactWiring(source) {
  const normal = source.replace(/\r\n/g, '\n');
  const header = '\n  e2e:\n';
  const jobStart = normal.indexOf(header);
  assert.ok(jobStart >= 0, 'e2e job must exist');
  const after = normal.slice(jobStart + header.length);
  const jobEnd = after.search(/\n  [a-z][a-z0-9_-]*:\n/);
  const job = after.slice(0, jobEnd < 0 ? undefined : jobEnd);
  const start = job.indexOf('- name: Upload Playwright report and traces');
  assert.ok(start >= 0, 'e2e report upload step must exist');
  const next = job.indexOf('\n      - ', start + 1);
  const upload = job.slice(start, next < 0 ? undefined : next);
  assert.match(upload, /if: failure\(\)/);
  assert.match(upload, /uses: actions\/upload-artifact@v4/);
  assert.match(upload, /^\s+qa\/reports\/playwright-main\/results-\*\.json$/m);
}

function attemptSummary(report) {
  const tests = [];
  function visit(suite) {
    for (const spec of suite.specs || []) for (const entry of spec.tests || []) tests.push(entry);
    for (const nested of suite.suites || []) visit(nested);
  }
  for (const suite of report.suites || []) visit(suite);
  assert.ok(tests.length > 0, 'empty test report is not run evidence');
  const counts = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  const attempts = { passed: 0, failed: 0, skipped: 0, timedOut: 0, interrupted: 0 };
  for (const entry of tests) {
    assert.ok(Object.hasOwn(counts, entry.status), `unknown test outcome: ${entry.status}`);
    counts[entry.status] += 1;
    assert.ok(Array.isArray(entry.results), 'missing attempt results');
    if (!entry.results.length) assert.equal(entry.status, 'skipped');
    for (const result of entry.results) {
      assert.ok(Object.hasOwn(attempts, result.status), `unknown attempt status: ${result.status}`);
      attempts[result.status] += 1;
    }
  }
  assert.ok(report.stats && typeof report.stats === 'object', 'missing native stats');
  for (const key of Object.keys(counts)) {
    assert.ok(Number.isSafeInteger(report.stats[key]) && report.stats[key] >= 0,
      `invalid native stats.${key}`);
    assert.equal(counts[key], report.stats[key], `stats.${key} disagrees with test outcomes`);
  }
  return { counts, attempts, tests };
}

function fixtureDir() {
  const parent = path.join(ROOT, 'output', 'playwright');
  fs.mkdirSync(parent, { recursive: true });
  return fs.mkdtempSync(path.join(parent, 'F22-'));
}

function runManaged(args) {
  const result = spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: ROOT, env: { ...process.env, QA_E2E_PORT: undefined, DB_PATH: undefined,
      QA_BASE_URL: undefined }, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

test('CI retry, first trace, JSON reporter and scoped artifact wiring fail closed', () => {
  const config = fs.readFileSync(CONFIG, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW, 'utf8');
  for (const source of [config.replace(/\r\n/g, '\n'), config.replace(/\r?\n/g, '\r\n')]) {
    assert.notEqual(verifyPolicy(source, true), verifyPolicy(source, true),
      'two config loads must not reuse one JSON evidence identity');
    verifyPolicy(source, false);
    assert.throws(() => verifyPolicy(source.replace('failOnFlakyTests: !!process.env.CI',
      'failOnFlakyTests: false')));
    assert.throws(() => verifyPolicy(source.replace("trace: 'retain-on-first-failure'",
      "trace: 'on-first-retry'")));
    assert.throws(() => verifyPolicy(source.replace("['json', { outputFile: `qa/reports/playwright-main/results-${randomUUID()}.json` }],", '')));
    const fixed = source.replace('randomUUID()', "'12345678-1234-4234-8234-123456789abc'");
    assert.throws(() => assert.notEqual(verifyPolicy(fixed, true), verifyPolicy(fixed, true)));
  }
  for (const source of [workflow.replace(/\r\n/g, '\n'), workflow.replace(/\r?\n/g, '\r\n')]) {
    verifyArtifactWiring(source);
    assert.throws(() => verifyArtifactWiring(source.replace('qa/reports/playwright-main/results-*.json',
      'qa/reports/playwright-main/missing.json')));
    assert.throws(() => verifyArtifactWiring(source.replace('if: failure()', 'if: success()')));
  }
  // A path elsewhere in the workflow may not lend false support to e2e.
  assert.throws(() => verifyArtifactWiring(workflow.replace(
    '            qa/reports/playwright-main/results-*.json', '') +
    '\n  unrelated:\n    steps:\n      - path: qa/reports/playwright-main/results-*.json\n'));
});

test('machine summary separates passed, flaky and failed', () => {
  const report = { suites: [{ specs: [{ tests: [
    { status: 'expected', results: [{ status: 'passed' }] },
    { status: 'expected', results: [{ status: 'failed' }] }, // test.fail is not a passed attempt
    { status: 'flaky', results: [{ status: 'failed' }, { status: 'passed' }] },
    { status: 'unexpected', results: [{ status: 'failed' }, { status: 'failed' }] },
    { status: 'skipped', results: [] },
  ] }] }], stats: { expected: 2, flaky: 1, unexpected: 1, skipped: 1 } };
  const summary = attemptSummary(report);
  assert.deepEqual(summary.counts, { expected: 2, flaky: 1, unexpected: 1, skipped: 1 });
  assert.deepEqual(summary.attempts, { passed: 2, failed: 4, skipped: 0, timedOut: 0, interrupted: 0 });
  // The local 6-case Playwright JSON witness (13:04 UTC) used the same native
  // expected/attempt-passed shape; this fixture must remain self-contained.
  assert.throws(() => attemptSummary({ suites: [] }));
  assert.throws(() => attemptSummary({ suites: [{ specs: [{ tests: [
    { status: 'passed', results: [{ status: 'passed' }] },
  ] }] }], stats: { expected: 1, flaky: 0, unexpected: 0, skipped: 0 } }));
});

test('negative witness mutates browser guards without changing product source', () => {
  const original = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  const mutated = mutateBusySource(original);
  assert.notEqual(mutated, original);
  assert.match(original, /if \(state\.busy\) return;/);
  assert.doesNotMatch(mutated.slice(mutated.indexOf('async function saveExpense() {'),
    mutated.indexOf('async function ', mutated.indexOf('async function saveExpense() {') + 1)),
  /if \(state\.busy\) return;/);
  assert.throws(() => mutateBusySource(original.replace('button.disabled = true;',
    'button.disabled = false;')));
  assert.throws(() => mutateBusySource(original.replace('function renderAmount() {',
    'function renderAmountChanged() {')));
  assert.throws(() => mutateBusySource(original.replace('button.disabled = true;',
    'button.disabled = true; button.disabled = true;')));
});

test('real browser negative: bypassed busy guards fail TC-E2E-045', { timeout: 150000 }, () => {
  const dir = fixtureDir();
  const configPath = path.join(dir, 'mutation.config.cjs');
  fs.writeFileSync(configPath, `const base = require(${JSON.stringify(CONFIG)});\nmodule.exports = {
    ...base, testDir: ${JSON.stringify(path.join(ROOT, 'qa', 'e2e'))},
    testMatch: 'double-submit.spec.js', projects: [{ name: 'f22-busy-mutation', use: { ...require('@playwright/test').devices['Desktop Chrome'] } }],
    retries: 0, failOnFlakyTests: false, outputDir: ${JSON.stringify(path.join(dir, 'results'))},
    reporter: [['list'], ['json', {outputFile: ${JSON.stringify(path.join(dir, 'mutation.json'))}}]],
  };\n`);
  const result = runManaged(['--config', configPath, '--grep', 'two fast taps on Save']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /toBeDisabled|second native tap must not start another POST/);
  assert.match(result.stdout + result.stderr, /owned default database removed/);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'mutation.json'), 'utf8'));
  const summary = attemptSummary(report);
  assert.equal(summary.counts.unexpected, 1);
  assert.equal(summary.tests.length, 1);
});

test('real browser flaky fixture retains first trace and exits nonzero in CI', { timeout: 150000 }, () => {
  const dir = fixtureDir();
  const configPath = path.join(dir, 'flaky.config.cjs');
  const specPath = path.join(dir, 'flaky.spec.cjs');
  fs.writeFileSync(specPath, `const { test, expect } = require(${JSON.stringify(path.join(ROOT, 'node_modules', '@playwright', 'test'))});\n
    test('F22 diagnostic first failure then pass', async ({ page }, info) => {
      await page.goto('data:text/html,<h1>Ready</h1>');
      await expect(page.getByRole('heading', {name: info.retry ? 'Ready' : 'Missing'})).toBeVisible();
    });\n`);
  fs.writeFileSync(configPath, `const base = require(${JSON.stringify(CONFIG)});\nmodule.exports = {
    ...base, testDir: __dirname, testMatch: 'flaky.spec.cjs',
    projects: [{name:'f22-fixture', use:{...require('@playwright/test').devices['Desktop Chrome']}}],
    retries: 1, failOnFlakyTests: true, outputDir: ${JSON.stringify(path.join(dir, 'results'))},
    reporter: [['list'], ['json', {outputFile: ${JSON.stringify(path.join(dir, 'flaky.json'))}}]],
  };\n`);
  const result = runManaged(['--config', configPath]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /flaky/i);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'flaky.json'), 'utf8'));
  const summary = attemptSummary(report);
  assert.equal(summary.counts.flaky, 1);
  assert.deepEqual(summary.tests[0].results.map(item => item.status), ['failed', 'passed']);
  const first = summary.tests[0].results[0];
  const trace = first.attachments.find(item => item.name === 'trace');
  assert.ok(trace?.path, 'first failed attempt needs an attached trace');
  assert.ok(fs.existsSync(trace.path), 'first failed trace file must exist');
  assert.match(result.stdout + result.stderr, /owned default database removed/);
});

module.exports = { evaluateConfig, verifyPolicy, verifyArtifactWiring, attemptSummary };
