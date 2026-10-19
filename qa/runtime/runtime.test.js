'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');
const ENGINE = '^22.14.0 || >=23.6.0';
const RUNTIME = path.join(ROOT, 'src', 'runtime.js');
const runtime = fs.existsSync(RUNTIME) ? require(RUNTIME) : null;

function assertWorkflowFloor(source) {
  const text = source.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const globalEnv = lines.findIndex(line => /^env:\s*$/.test(line));
  assert.ok(globalEnv >= 0 && lines.filter(line => /^env:\s*$/.test(line)).length === 1,
    'one literal global env mapping is required');
  let globalEnvEnd = globalEnv + 1;
  while (globalEnvEnd < lines.length && !/^\S/.test(lines[globalEnvEnd])) globalEnvEnd++;
  const floor = lines.flatMap((line, index) =>
    !/^\s*#/.test(line) && /\bNODE_VERSION\s*:/.test(line) ? [index] : []);
  assert.deepEqual(floor, [lines.findIndex((line, index) =>
    index > globalEnv && index < globalEnvEnd && /^  NODE_VERSION: '22\.14\.0'\s*$/.test(line))],
  'exactly one global NODE_VERSION: 22.14.0; no job or step override');
  assert.ok(floor[0] >= 0, 'global NODE_VERSION floor must exist');

  // This workflow uses literal six-space list steps. Unsupported step/YAML
  // forms fail closed rather than borrowing inputs from another action.
  const setupMentions = lines.flatMap((line, index) =>
    !/^\s*#/.test(line) && line.includes('actions/setup-node@') ? [index] : []);
  const setupStarts = setupMentions.filter(index =>
    /^      - uses: actions\/setup-node@v4\s*$/.test(lines[index]));
  assert.ok(setupStarts.length > 0, 'setup-node must be present');
  assert.equal(setupStarts.length, setupMentions.length, 'unsupported setup-node step shape');
  for (const start of setupStarts) {
    let end = start + 1;
    while (end < lines.length && !/^      - /.test(lines[end]) &&
      !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[end]) && !/^\S/.test(lines[end])) end++;
    const step = lines.slice(start, end);
    const withFields = step.flatMap((line, index) => /^\s*with\s*:/.test(line) ? [index] : []);
    assert.equal(withFields.length, 1, 'setup-node needs exactly one own with mapping');
    const withIndex = withFields[0];
    assert.match(step[withIndex], /^        with:\s*$/, 'unsupported setup-node with form');
    let withEnd = withIndex + 1;
    while (withEnd < step.length && (!/\S/.test(step[withEnd]) || /^\s*#/.test(step[withEnd]) ||
      /^ {10}\S/.test(step[withEnd]))) withEnd++;
    const entries = step.slice(withIndex + 1, withEnd)
      .filter(line => /\S/.test(line) && !/^\s*#/.test(line));
    for (const entry of entries) assert.match(entry, /^ {10}[A-Za-z0-9_-]+:\s*\S.*$/,
      'unsupported setup-node with entry');
    for (const tail of step.slice(withEnd).filter(line => /\S/.test(line) && !/^\s*#/.test(line))) {
      assert.match(tail, /^ {8}[A-Za-z0-9_-]+:\s*\S.*$/, 'unsupported setup-node step tail');
    }
    const versions = entries.filter(line => /^ {10}node-version\s*:/.test(line));
    assert.equal(versions.length, 1, 'setup-node needs exactly one own node-version input');
    assert.match(versions[0], /^ {10}node-version: \$\{\{ env\.NODE_VERSION \}\}\s*$/,
      'setup-node must bind to global NODE_VERSION');
    assert.equal(step.filter(line => /^\s*node-version\s*:/.test(line)).length, 1,
      'node-version outside own with mapping');
  }
}

test('package and lock root agree on the exact stable native-compatible engine', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.engines.node, ENGINE);
  assert.equal(lock.packages[''].engines.node, ENGINE);
});

test('stable Node and Node-API boundaries reject unsupported or malformed values', () => {
  assert.ok(runtime, 'pure built-in runtime guard must exist');
  for (const [node, napi, expected] of [
    ['22.13.0', '10', false], ['22.14.0', '10', true],
    ['22.99.0', '10', true], ['23.0.0', '10', false],
    ['23.5.0', '10', false], ['23.6.0', '10', true],
    ['24.0.0', '10', true], ['25.0.0', '10', true],
    ['22.14.0', '9', false], ['22.14.0', undefined, false],
    ['22.14.0', 'abc', false], ['22.14.0', '10.0', false],
    ['22.14.0-rc.1', '10', false], ['v22.14.0', '10', false],
    ['22.14', '10', false], ['022.14.0', '10', false],
  ]) {
    assert.equal(runtime.isSupportedRuntime({ node, napi }), expected, `${node}/${napi}`);
  }
  assert.throws(() => runtime.assertSupportedRuntime({ node: '22.9.0', napi: '9' }),
    error => error.code === 'ERR_UNSUPPORTED_WALLET_RUNTIME' && /upgrade|Node/i.test(error.message));
});

test('CI pins exact floor and every setup-node binds to it, including mutated negatives', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  assertWorkflowFloor(workflow);
  assert.throws(() => assertWorkflowFloor(workflow.replace("NODE_VERSION: '22.14.0'", "NODE_VERSION: '22.9.0'")));
  assert.throws(() => assertWorkflowFloor(workflow.replace('node-version: ${{ env.NODE_VERSION }}', 'node-version: 22')));
  assertWorkflowFloor(workflow.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n'));
});

test('CI rejects an API setup-node version moved into upload-artifact inputs', () => {
  const source = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  const lf = source.replace(/\r\n?/g, '\n');
  const start = lf.indexOf('\n  api:\n');
  const end = lf.indexOf('\n  python:\n', start + 1);
  assert.ok(start >= 0 && end > start);
  const block = lf.slice(start, end);
  const setup = '      - uses: actions/setup-node@v4\n        with:\n          node-version: ${{ env.NODE_VERSION }}\n          cache: npm';
  const upload = '        uses: actions/upload-artifact@v4\n        with:\n';
  assert.ok(block.includes(setup) && block.includes(upload));
  const moved = block.replace(setup, '      - uses: actions/setup-node@v4\n        with:\n          cache: npm')
    .replace(upload, `${upload}          node-version: \${{ env.NODE_VERSION }}\n`);
  const mutant = lf.slice(0, start) + moved + lf.slice(end);
  for (const text of [mutant, mutant.replace(/\n/g, '\r\n')]) {
    assert.throws(() => assertWorkflowFloor(text));
  }
});

test('CI rejects missing, duplicate, wrong, shadowed and unsupported bindings in LF and CRLF', () => {
  const lf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
    .replace(/\r\n?/g, '\n');
  const start = lf.indexOf('\n  api:\n');
  const end = lf.indexOf('\n  python:\n', start + 1);
  assert.ok(start >= 0 && end > start);
  const block = lf.slice(start, end);
  const binding = '          node-version: ${{ env.NODE_VERSION }}\n';
  assert.ok(block.includes(binding));
  const mutateApi = changed => lf.slice(0, start) + changed + lf.slice(end);
  const mutants = {
    missing: mutateApi(block.replace(binding, '')),
    duplicate: mutateApi(block.replace(binding, binding + binding)),
    wrong: mutateApi(block.replace(binding, '          node-version: 22\n')),
    duplicateWith: mutateApi(block.replace('        with:\n' + binding,
      '        with:\n        with:\n' + binding)),
    unsupportedWith: mutateApi(block.replace('        with:\n' + binding,
      '        with: { node-version: "22.14.0" }\n' + binding)),
    jobShadow: lf.replace('\n  api:\n', '\n  api:\n    env:\n      NODE_VERSION: 22.9.0\n'),
    stepShadow: mutateApi(block.replace(binding,
      binding + '        env:\n          NODE_VERSION: 22.9.0\n')),
    inlineShadow: lf.replace('\n  api:\n', '\n  api:\n    env: { NODE_VERSION: 22.9.0 }\n'),
    nestedWith: mutateApi(block.replace(binding,
      binding + '            unsupported: nested\n')),
    unsupportedVersion: mutateApi(block.replace('actions/setup-node@v4', 'actions/setup-node@v5')),
  };
  for (const [name, mutant] of Object.entries(mutants)) {
    assert.notEqual(mutant, lf, `${name} fixture must change`);
    for (const [ending, text] of [['LF', mutant], ['CRLF', mutant.replace(/\n/g, '\r\n')]]) {
      assert.throws(() => assertWorkflowFloor(text), `${name}/${ending}`);
    }
  }
  assertWorkflowFloor(lf);
  assertWorkflowFloor(lf.replace(/\n/g, '\r\n'));
});

test('db import refuses unsupported child runtime before native load or data writes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-runtime-'));
  try {
    const dbPath = path.join(dir, 'no-created-db', 'wallet.db');
    const code = `
      Object.defineProperty(process.versions,'node',{configurable:true,value:'22.9.0'});
      Object.defineProperty(process.versions,'napi',{configurable:true,value:'9'});
      const fs=require('node:fs');const Module=require('node:module');
      let native=false,mkdir=false;const load=Module._load;
      Module._load=function(request,...args){if(request==='better-sqlite3'){native=true;throw Error('NATIVE_ATTEMPT')}return load.call(this,request,...args)};
      fs.mkdirSync=function(){mkdir=true;throw Error('MKDIR_ATTEMPT')};
      let code='NO_ERROR';try{require(${JSON.stringify(path.join(ROOT, 'src', 'db.js'))})}catch(error){code=error.code||error.message}
      process.stdout.write(JSON.stringify({code,native,mkdir,dbExists:fs.existsSync(${JSON.stringify(dbPath)})}));
    `;
    const child = spawnSync(process.execPath, ['-e', code], {
      cwd: ROOT, encoding: 'utf8', timeout: 5000,
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DB_PATH: dbPath },
    });
    assert.equal(child.status, 0, child.stderr);
    const observed = JSON.parse(child.stdout);
    assert.deepEqual(observed, {
      code: 'ERR_UNSUPPORTED_WALLET_RUNTIME', native: false, mkdir: false, dbExists: false,
    });
    assert.equal(fs.existsSync(path.dirname(dbPath)), false);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
