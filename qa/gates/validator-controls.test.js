'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const BASELINE_REF = process.env.WALLET_GATE_BASELINE_REF;
if (BASELINE_REF && !/^[0-9a-f]{40}$/.test(BASELINE_REF)) {
  throw new Error('WALLET_GATE_BASELINE_REF must be a full commit SHA');
}
function readSource(file) {
  if (!BASELINE_REF) return fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  return execFileSync('git', ['show', `${BASELINE_REF}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
}

async function raceControl({ bad = '', empty = '', pairs = '1', sentinel = false,
  shutdownStuck = false, swappedDirectory = false } = {}) {
  const file = path.join(ROOT, 'qa', 'race', 'run.js');
  const source = readSource(file);
  const removed = [];
  let summary;
  const output = [];
  let statCalls = 0;
  const fakeFs = {
    mkdirSync() {},
    mkdtempSync(prefix) { return `${prefix}owned`; },
    realpathSync(value) { return path.resolve(value); },
    lstatSync() {
      statCalls++;
      return { isSymbolicLink: () => false, dev: 1,
        ino: swappedDirectory && statCalls > 1 ? 2 : 1 };
    },
    existsSync() { return sentinel; },
    readdirSync() { return sentinel ? ['race-other-run.db'] : []; },
    writeFileSync(_file, body) { summary = JSON.parse(body); },
    rmSync(target) { removed.push(path.resolve(target)); },
  };
  const processMock = { env: { RACE_PAIRS: pairs }, execPath: process.execPath, exitCode: undefined };
  const originalRequire = createRequire(file);
  const context = {
    __dirname: path.dirname(file),
    process: processMock,
    console: { log: (...args) => output.push(args.join(' ')), error: (...args) => output.push(args.join(' ')) },
    require(id) {
      if (id === 'fs') return fakeFs;
      if (id === 'child_process') return { spawn() { throw new Error('control must not start a server'); } };
      return originalRequire(id);
    },
    Buffer,
    setTimeout: shutdownStuck ? (fn) => { queueMicrotask(fn); return 1; } : setTimeout,
    clearTimeout: shutdownStuck ? () => {} : clearTimeout,
  };
  const result = (label) => ({
    outcomes: empty === label ? new Map() : new Map([['synthetic pair', 1]]),
    violations: label === bad ? 1 : 0,
  });
  const seam = `
startServer = () => { ${shutdownStuck ? "servers.push({ server: { once() {}, kill() {} }, isGone: () => false });" : ''} };
waitForServer = async () => {};
payVsEdit = async (_a, _b, label) => globalThis.scenarioResult(label);
editVsDelete = async (_a, _b, label) => globalThis.scenarioResult(label);
doubleSubmit = async () => ({ outcomes: ${empty === 'D' ? 'new Map()' : "new Map([['201 · 201', 1], ['2 rows', 1]])"}, duplicated: 1, violations: 7 });
client = (port) => async () => ({ status: port === PORTS[0] ? 201 : ${bad === 'E' ? 500 : 409}, data: { token: 'synthetic' } });
${empty === 'E' ? 'registerTwice = async () => ({ outcomes: new Map(), violations: 0 });' : ''}
globalThis.finished = main();
`;
  context.scenarioResult = result;
  vm.runInNewContext(source.replace(/main\(\);\s*$/, seam), context, { filename: file });
  await context.finished;
  return { exitCode: processMock.exitCode, summary, output, removed };
}

function gateControl({ missing = '', empty = '', emptyCollection = false, exceptions } = {}) {
  const checkFile = path.join(ROOT, 'scripts', 'check.js');
  const coverageFile = path.join(ROOT, 'scripts', 'coverage-gates.js');
  const output = [];
  let exitCode;
  const unavailable = (file) => missing && (
    path.resolve(file) === path.join(ROOT, missing) ||
    path.resolve(file).startsWith(path.join(ROOT, missing) + path.sep)
  );
  const fakeFs = {
    ...fs,
    existsSync(file) { return unavailable(file) ? false : fs.existsSync(file); },
    readdirSync(dir, options) {
      if (empty && (path.resolve(dir) === path.join(ROOT, empty) ||
        path.resolve(dir).startsWith(path.join(ROOT, empty) + path.sep))) return [];
      return fs.readdirSync(dir, options);
    },
    readFileSync(file, options) {
      if (exceptions !== undefined && path.resolve(file) === path.join(ROOT, 'scripts/check-exceptions.json')) {
        return JSON.stringify(exceptions);
      }
      if (emptyCollection && path.resolve(file) === path.join(ROOT, 'qa/api/wallet.postman_collection.json')) {
        return JSON.stringify({ item: [] });
      }
      return fs.readFileSync(file, options);
    },
  };
  function load(file, extra = {}) {
    const actualRequire = createRequire(file);
    const module = { exports: {} };
    const context = {
      __dirname: path.dirname(file), module, exports: module.exports,
      require(id) { return id === 'fs' ? fakeFs : id === './coverage-gates' ? extra.coverage : actualRequire(id); },
      process: { exit(code) { exitCode = code; } },
      console: { log: (...args) => output.push(args.join(' ')) },
      Buffer,
    };
    vm.runInNewContext(readSource(file), context, { filename: file });
    return module.exports;
  }
  const coverage = load(coverageFile);
  load(checkFile, { coverage });
  return { exitCode, output };
}

test('race: E-only registration violation fails the real main aggregation', async () => {
  const run = await raceControl({ bad: 'E' });
  assert.equal(run.summary.scenarios.E.violations, 1);
  assert.equal(run.exitCode, 1);
});

test('race: each enforcing scenario contributes, while D stays measurement-only', async () => {
  for (const bad of ['A', 'B1', 'B2', 'B3', 'C']) {
    const run = await raceControl({ bad });
    assert.equal(run.summary.scenarios.E.violations, 0);
    assert.equal(run.exitCode, 1, `${bad} was omitted`);
  }
  const measurement = await raceControl();
  assert.equal(measurement.summary.scenarios.E.violations, 0);
  assert.equal(measurement.summary.scenarios.D.measuredOnly, true);
  assert.equal(measurement.summary.scenarios.D.duplicated, 1);
  assert.equal(measurement.exitCode, 0, 'D is measured, even when it reports duplicates');
});

test('race: invalid pair counts fail before scenario execution', async () => {
  for (const pairs of ['0', '-1', 'NaN', '1.5']) {
    const run = await raceControl({ pairs });
    assert.equal(run.exitCode, 1, `invalid pair count ${pairs} passed`);
    assert.equal(run.summary, undefined, `invalid pair count ${pairs} executed scenarios`);
    assert.match(run.output.join('\n'), /RACE_PAIRS must be a positive safe integer/);
  }
});

test('race: each scenario needs nonempty execution evidence', async () => {
  for (const empty of ['A', 'B1', 'B2', 'B3', 'C', 'D', 'E']) {
    const run = await raceControl({ empty });
    assert.equal(run.exitCode, 1, `${empty} had no execution evidence`);
    assert.match(run.output.join('\n'), new RegExp(`${empty}: expected .* observed outcome`));
  }
});

test('race: never removes a different run’s database sentinel', async () => {
  const run = await raceControl({ sentinel: true });
  assert.equal(run.removed.some(item => item.endsWith('race-other-run.db')), false);
});

test('race: incomplete child shutdown preserves its owned DB and fails', async () => {
  const run = await raceControl({ shutdownStuck: true });
  assert.equal(run.exitCode, 1);
  assert.equal(run.summary.cleanup, 'preserved: server still running');
  assert.deepEqual(run.removed, []);
});

test('race: changed directory identity blocks cleanup and fails', async () => {
  const run = await raceControl({ swappedDirectory: true });
  assert.equal(run.exitCode, 1);
  assert.equal(run.summary.cleanup, 'preserved: cleanup failed');
  assert.deepEqual(run.removed, []);
});

test('race: owned cleanup removes only its canonical temp directory', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-race-control-'));
  const parent = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(fs.realpathSync(fixture)), parent);
  try {
    const data = path.join(fixture, 'data');
    fs.mkdirSync(data);
    const sentinel = path.join(data, 'race-other-run.db');
    fs.writeFileSync(sentinel, 'other run');
    const file = path.join(ROOT, 'qa', 'race', 'run.js');
    const original = readSource(file);
    const isolated = original.replace(
      "const ROOT = path.join(__dirname, '..', '..');",
      `const ROOT = ${JSON.stringify(fixture)};`
    );
    assert.notEqual(isolated, original, 'test seam must target the actual runner');
    const context = {
      __dirname: path.dirname(file), require: createRequire(file),
      process: { env: { RACE_PAIRS: '1' }, execPath: process.execPath },
      console, Buffer, setTimeout, clearTimeout,
    };
    const seam = `createOwnedDatabase(); globalThis.owned = DB_PATH; removeOwnedDatabase();`;
    vm.runInNewContext(isolated.replace(/main\(\);\s*$/, seam), context, { filename: file });
    assert.equal(fs.existsSync(context.owned), false);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'other run');
    assert.deepEqual(fs.readdirSync(data), ['race-other-run.db']);
  } finally {
    const canonical = fs.realpathSync(fixture);
    assert.equal(path.dirname(canonical), parent);
    fs.rmSync(canonical, { recursive: true });
  }
});

for (const missing of [
  'spec/architecture.md', 'spec/architecture.sha256', 'src', 'public',
  'qa/e2e', 'qa/e2e/pages', 'src/server.js',
  'src/routes/transactions.js',
  'qa/api/wallet.postman_collection.json', 'scripts/check-exceptions.json',
]) {
  test(`check: missing required ${missing} fails`, () => {
    const run = gateControl({ missing });
    assert.equal(run.exitCode, 1, run.output.join('\n'));
  });
}

for (const empty of ['src', 'public', 'qa/e2e', 'qa/e2e/pages']) {
  test(`check: empty required ${empty} inventory fails`, () => {
    const run = gateControl({ empty });
    assert.equal(run.exitCode, 1, run.output.join('\n'));
  });
}

test('check: an empty collection inventory fails', () => {
  const run = gateControl({ emptyCollection: true });
  assert.equal(run.exitCode, 1, run.output.join('\n'));
});

const reason = 'A deliberate static inventory exception with documented scope.';
function exceptionControl(gate, item) {
  const exceptions = { C6: [], C7: [], C8: [{ item: '500', reason }] };
  exceptions[gate].push({ item, reason });
  return gateControl({ exceptions });
}

for (const [gate, item] of [
  ['C6', 'GET /api/no-such-route'], ['C7', 'no-such-testid'], ['C8', '599'],
]) {
  test(`check: ${gate} rejects a stale exception identity`, () => {
    const run = exceptionControl(gate, item);
    assert.equal(run.exitCode, 1, run.output.join('\n'));
    assert.match(run.output.join('\n'), /stale exception/);
  });
}

test('check: rejects a redundant already-covered exception', () => {
  const run = exceptionControl('C8', '200');
  assert.equal(run.exitCode, 1, run.output.join('\n'));
  assert.match(run.output.join('\n'), /redundant exception/);
});

test('check: rejects duplicate and invalid exception entries', () => {
  for (const entries of [
    [{ item: '500', reason }, { item: '500', reason }],
    [{ item: 500, reason }],
    [{ item: '500', reason: 42 }],
    [null],
    [[]],
  ]) {
    const run = gateControl({ exceptions: { C6: [], C7: [], C8: entries } });
    assert.equal(run.exitCode, 1, run.output.join('\n'));
  }
});

test('check: malformed exception top-level shape fails clearly', () => {
  const run = gateControl({ exceptions: { C6: [], C7: [], C8: {} } });
  assert.equal(run.exitCode, 1, run.output.join('\n'));
  assert.match(run.output.join('\n'), /C8.*array/);
});

test('check: unavailable inventory does not invent stale exceptions', () => {
  const run = gateControl({ missing: 'src/server.js' });
  assert.equal(run.exitCode, 1);
  assert.match(run.output.join('\n'), /inventory unavailable/);
  assert.doesNotMatch(run.output.join('\n'), /stale exception/);
});

test('check: in-memory negative controls restore the real inputs unchanged', () => {
  const files = ['scripts/check.js', 'scripts/coverage-gates.js', 'scripts/check-exceptions.json'];
  const hashes = files.map(file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex'));
  assert.equal(exceptionControl('C7', 'not-a-real-testid').exitCode, 1);
  const restored = gateControl();
  assert.equal(restored.exitCode, 0, restored.output.join('\n'));
  assert.match(restored.output.join('\n'), /C9  PASS/);
  assert.deepEqual(files.map(file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')), hashes);
});
