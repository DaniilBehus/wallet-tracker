'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const { GROUPS, ALL_GROUPS } = require('../../scripts/verification-plan');
const { parseArgs, runVerification, safeChildEnv } = require('../../scripts/verify-ci');

function fixture(work) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-verify-control-'));
  try { return work(root); }
  finally {
    const canonical = fs.realpathSync(root);
    assert.equal(path.dirname(canonical), fs.realpathSync(os.tmpdir()));
    fs.rmSync(canonical, { recursive: true });
  }
}

const identity = { head: 'a'.repeat(40), dirty: true, fingerprint: 'b'.repeat(64), fileCount: 1 };
const task = (id, args) => ({ id, executable: process.execPath, args: ['-e', ...args] });

const REQUIRED_SOURCE_GATES = [
  ['f13-traceability', ['scripts/traceability.js']],
  ['api-source-inventory', ['scripts/postman-api-inventory.js', '--check']],
  ['all-test-source-inventory', ['scripts/test-source-inventory.js', '--check']],
  ['source-inventory-controls', ['--test',
    'qa/gates/traceability.test.js', 'qa/gates/postman-inventory.test.js',
    'qa/gates/postman-token-inventory.test.js',
    'qa/gates/postman-categories-inventory.test.js',
    'qa/gates/postman-transactions-inventory.test.js',
    'qa/gates/postman-api-inventory.test.js', 'qa/gates/login-oracle-controls.test.js',
    'qa/gates/test-source-inventory.test.js']],
];

function assertSourceGates(tasks) {
  const expensive = tasks.findIndex(item => item.id === 'newman');
  assert.ok(expensive > 0, 'Newman must remain in the API plan');
  let last = tasks.findIndex(item => item.id === 'verify-controls');
  assert.equal(last, 0, 'verification controls run first');
  for (const [id, args] of REQUIRED_SOURCE_GATES) {
    const matches = tasks.map((item, index) => ({ item, index }))
      .filter(entry => entry.item.id === id);
    assert.equal(matches.length, 1, `${id} must occur exactly once`);
    assert.equal(matches[0].item.executable, 'node');
    assert.deepEqual(matches[0].item.args, args, `${id} command changed`);
    assert.ok(matches[0].index > last && matches[0].index < expensive,
      `${id} must precede expensive runtime work in order`);
    last = matches[0].index;
  }
}

function workflowNeeds(workflow, job, need) {
  // Static inspection of this workflow's literal YAML shape, bounded to one
  // job. Unsupported syntax fails instead of borrowing a later job's needs.
  const lines = workflow.replace(/\r\n?/g, '\n').split('\n');
  const roots = lines.flatMap((line, index) => /^jobs:\s*$/.test(line) ? [index] : []);
  if (roots.length !== 1) throw new Error('workflow must have one literal jobs: block');
  let end = lines.length;
  for (let i = roots[0] + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i]) && !/^#/.test(lines[i])) { end = i; break; }
  }
  const headings = [];
  for (let i = roots[0] + 1; i < end; i++) {
    const header = /^  ([A-Za-z0-9_-]+):\s*$/.exec(lines[i]);
    if (header) headings.push({ name: header[1], index: i });
    else if (/^  \S/.test(lines[i]) && !/^  #/.test(lines[i])) {
      throw new Error(`unsupported job heading at line ${i + 1}`);
    }
  }
  if (new Set(headings.map(item => item.name)).size !== headings.length) {
    throw new Error('duplicate job heading');
  }
  const position = headings.findIndex(item => item.name === job);
  if (position < 0) throw new Error(`job ${job} not found`);
  const start = headings[position].index + 1;
  const stop = position + 1 < headings.length ? headings[position + 1].index : end;
  const needs = lines.slice(start, stop).filter(line => /^    needs\s*:/.test(line));
  if (needs.length !== 1) throw new Error(`job ${job} must have one literal needs line`);
  const scalar = /^    needs:\s*([A-Za-z0-9_-]+)\s*$/.exec(needs[0]);
  if (!scalar) throw new Error(`job ${job} has unsupported needs form`);
  return scalar[1] === need;
}

function workflowLineEndings(workflow) {
  const lf = workflow.replace(/\r\n?/g, '\n');
  return [['LF', lf], ['CRLF', lf.replace(/\n/g, '\r\n')]];
}

function withE2ENeed(workflow, replacement) {
  const lf = workflow.replace(/\r\n?/g, '\n');
  const start = lf.indexOf('\n  e2e:\n');
  const next = lf.indexOf('\n  selenium:\n', start + 1);
  const needle = '    needs: python\n';
  const edge = lf.indexOf(needle, start);
  assert.ok(start >= 0 && next > start && edge > start && edge < next);
  const changed = lf.slice(0, edge) + `    needs: ${replacement}\n` + lf.slice(edge + needle.length);
  return workflow.includes('\r\n') ? changed.replace(/\n/g, '\r\n') : changed;
}

test('plan includes every enforced CI group and task exactly once', () => {
  assert.deepEqual(ALL_GROUPS, ['secrets', 'api', 'python', 'e2e', 'selenium', 'ai']);
  const ids = ALL_GROUPS.flatMap(group => GROUPS[group].map(item => item.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const group of ALL_GROUPS) assert.ok(GROUPS[group].length > 0, group);
  assert.deepEqual(Object.fromEntries(ALL_GROUPS.map(group => [group, GROUPS[group].map(item => item.id)])), {
    secrets: ['history-secret-scan'],
    api: ['verify-controls', 'f13-traceability', 'api-source-inventory',
      'all-test-source-inventory', 'source-inventory-controls', 'gates', 'dates',
      'check', 'openapi', 'contract', 'db', 'import', 'newman', 'race'],
    python: ['python-api'],
    e2e: ['playwright', 'accessibility'],
    selenium: ['selenium'],
    ai: ['ai-offline', 'ai-fixture', 'ai-browser'],
  });
  assert.deepEqual(GROUPS.api[0].args, ['--test', 'qa/verify/verify-ci.test.js', 'qa/e2e-controls/run.test.js', 'qa/runtime/runtime.test.js']);
  assertSourceGates(GROUPS.api);
  assert.deepEqual(GROUPS.e2e[0].args, ['qa/e2e-runner/run.js']);
  const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['test:e2e'], 'node qa/e2e-runner/run.js');
  assert.equal(scripts['test:e2e:runner'], 'node --test qa/e2e-controls/run.test.js');
});

test('source gates fail closed when omitted, weakened, duplicated or delayed', () => {
  assertSourceGates(GROUPS.api);
  for (const [id] of REQUIRED_SOURCE_GATES) {
    assert.throws(() => assertSourceGates(GROUPS.api.filter(item => item.id !== id)),
      /exactly once/, id);
  }
  const altered = GROUPS.api.map(item => item.id === 'all-test-source-inventory'
    ? { ...item, args: ['scripts/test-source-inventory.js'] } : item);
  assert.throws(() => assertSourceGates(altered), /command changed/);
  const duplicate = [...GROUPS.api, GROUPS.api.find(item => item.id === 'api-source-inventory')];
  assert.throws(() => assertSourceGates(duplicate), /exactly once/);
  const delayed = GROUPS.api.filter(item => item.id !== 'source-inventory-controls');
  delayed.push(GROUPS.api.find(item => item.id === 'source-inventory-controls'));
  assert.throws(() => assertSourceGates(delayed), /precede expensive runtime work/);
});

test('CLI rejects unknown and empty group selections', () => {
  assert.throws(() => parseArgs(['--group', 'missing']), /unknown group/);
  assert.throws(() => parseArgs(['--group', '']), /empty group/);
  assert.deepEqual(parseArgs([]).groups, ALL_GROUPS);
});

test('--plan is inspection-only and marks every task NOT_RUN', () => {
  const run = spawnSync(process.execPath, ['scripts/verify-ci.js', '--plan'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /NOT_RUN/);
  assert.doesNotMatch(run.stdout, /\bPASS\b/);
});

test('real failing child fails fast and later task remains NOT_RUN', () => fixture(root => {
  const result = runVerification({ group: 'fixture', tasks: [
    task('fail', ['process.exit(7)']), task('never', ['process.exit(0)']),
  ], root, evidenceRoot: path.join(root, 'evidence'), identity, quiet: true });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.summary.tasks.map(item => item.status), ['FAIL', 'NOT_RUN']);
  assert.equal(result.summary.tasks[0].exitCode, 7);
  assert.equal(JSON.parse(fs.readFileSync(result.summaryPath, 'utf8')).verdict, 'FAIL');
}));

test('missing executable and signalled child cannot go green', () => fixture(root => {
  const missing = runVerification({ group: 'fixture', tasks: [
    { id: 'missing', executable: '__wallet_missing_executable__', args: [] },
  ], root, evidenceRoot: path.join(root, 'evidence'), identity, quiet: true });
  assert.equal(missing.exitCode, 1);
  assert.equal(missing.summary.tasks[0].status, 'FAIL');
  const signalled = runVerification({ group: 'fixture', tasks: [
    task('signal', ["process.kill(process.pid, 'SIGTERM')"]),
  ], root, evidenceRoot: path.join(root, 'evidence'), identity, quiet: true });
  assert.equal(signalled.exitCode, 1);
  assert.equal(signalled.summary.tasks[0].status, 'FAIL');
}));

test('unique ignored summaries disclose no raw credentials, env or personal path', () => fixture(root => {
  const secret = `private-${crypto.randomUUID()}`;
  const first = runVerification({ group: 'fixture', tasks: [task('ok', ['process.exit(0)'])],
    root, evidenceRoot: path.join(root, 'evidence'), identity, quiet: true,
    env: { PATH: process.env.PATH, QA_BASE_URL: `https://${secret}`, OPENAI_API_KEY: secret,
      DB_PATH: `C:\\Users\\private\\${secret}.db` } });
  const second = runVerification({ group: 'fixture', tasks: [task('ok', ['process.exit(0)'])],
    root, evidenceRoot: path.join(root, 'evidence'), identity, quiet: true });
  assert.notEqual(first.summaryPath, second.summaryPath);
  assert.equal(first.summary.verdict, 'PASS');
  const saved = fs.readFileSync(first.summaryPath, 'utf8');
  assert.doesNotMatch(saved, new RegExp(secret));
  assert.doesNotMatch(saved, /C:\\Users|OPENAI_API_KEY|QA_BASE_URL|DB_PATH/);
  const childEnv = safeChildEnv({ PATH: process.env.PATH, QA_BASE_URL: secret,
    OPENAI_API_KEY: secret, DB_PATH: secret, PYTHON: 'python' });
  assert.equal(childEnv.QA_BASE_URL, undefined);
  assert.equal(childEnv.OPENAI_API_KEY, undefined);
  assert.equal(childEnv.DB_PATH, undefined);
  assert.equal(childEnv.PYTHON, 'python');
}));

test('missing or unsafe producer artifacts fail and are not retained', () => fixture(root => {
  const rel = 'qa/reports/api-junit.xml';
  const absent = runVerification({ group: 'fixture', tasks: [{ ...task('absent', ['process.exit(0)']), artifacts: [rel] }],
    root, evidenceRoot: path.join(root, 'evidence'), identity, quiet: true });
  assert.equal(absent.exitCode, 1);
  assert.equal(absent.summary.tasks[0].artifacts[0].status, 'ABSENT');
  const script = `require('fs').mkdirSync('qa/reports',{recursive:true});` +
    `require('fs').writeFileSync(${JSON.stringify(rel)},'Bearer ' + 'x'.repeat(48))`;
  const unsafe = runVerification({ group: 'fixture', tasks: [{ ...task('unsafe', [script]), artifacts: [rel] }],
    root, evidenceRoot: path.join(root, 'evidence'), identity, quiet: true });
  assert.equal(unsafe.exitCode, 1);
  assert.equal(unsafe.summary.tasks[0].artifacts[0].status, 'WITHHELD_UNSAFE');
  assert.equal(fs.existsSync(path.join(path.dirname(unsafe.summaryPath), 'api-junit.xml')), false);
}));

test('unwritable evidence destination fails before any child runs', () => fixture(root => {
  const destination = path.join(root, 'not-a-directory');
  fs.writeFileSync(destination, 'sentinel');
  assert.throws(() => runVerification({ group: 'fixture', tasks: [task('never', ['process.exit(0)'])],
    root, evidenceRoot: destination, identity, quiet: true }));
  assert.equal(fs.readFileSync(destination, 'utf8'), 'sentinel');
}));

test('workflow uses exact shared groups and allowlisted v4 artifact uploads', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  for (const group of ALL_GROUPS) {
    assert.equal((workflow.match(new RegExp(`node scripts/verify-ci\\.js --group ${group}\\b`, 'g')) || []).length, 1, group);
  }
  for (const [job, need] of [['api', 'secrets'], ['python', 'api'], ['e2e', 'python'],
    ['selenium', 'python'], ['ai', 'api']]) {
    assert.equal(workflowNeeds(workflow, job, need), true, `${job} must need ${need}`);
  }
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /if:\s*\$\{\{\s*!cancelled\(\)\s*\}\}/);
  for (const name of ['api-report.html', 'api-junit.xml', 'python-junit.xml', 'race-summary.json', 'summary.json']) {
    assert.ok(workflow.includes(name), name);
  }
  assert.doesNotMatch(workflow, /path:\s*(?:\.\/|\.\s*$|qa\/reports\/\s*$)/m);
});

test('workflow dependency control rejects wrong e2e edge despite later selenium need', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  for (const [label, variant] of workflowLineEndings(workflow)) {
    const mutated = withE2ENeed(variant, 'api');
    assert.equal(workflowNeeds(variant, 'e2e', 'python'), true, label);
    assert.equal(workflowNeeds(mutated, 'e2e', 'python'), false, label);
  }
});

test('workflow dependency control accepts equivalent CRLF checkout', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  const crlf = workflowLineEndings(workflow)[1][1];
  assert.equal(workflowNeeds(crlf, 'e2e', 'python'), true);
});

test('workflow dependency control rejects ambiguous needs syntax', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  for (const [label, variant] of workflowLineEndings(workflow)) {
    const changed = withE2ENeed(variant, '[python]');
    assert.throws(() => workflowNeeds(changed, 'e2e', 'python'), /unsupported needs form/, label);
  }
});
