'use strict';

// Pure source-identity controls. Only checker modules are imported; no test
// module, browser, server, database, Newman or provider is started here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const inventory = require('../../scripts/test-source-inventory');
const { buildInventory: apiInventory } = require('../../scripts/postman-api-inventory');

const ROOT = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifest = JSON.parse(read('qa/traceability/test-source-manifest.json'));
const catalogue = read('qa/docs/test-cases.md');
const api = apiInventory();
const sources = Object.fromEntries(inventory.discover().map(file => [file, read(file)]));
const configs = Object.fromEntries(inventory.discoverConfigs().map(file => [file, read(file)]));
const copy = value => structuredClone(value);
const check = (m = manifest, c = catalogue, a = api, s = sources, k = configs) =>
  inventory.validate({ manifest: m, catalogue: c, api: a, sources: s, configs: k });

test('executable extensions and nested reports are discovered, canonical output is not', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-source-discovery-'));
  try {
    for (const directory of ['qa/e2e/reports', 'qa/e2e/__pycache__',
      'qa/e2e/node_modules', 'qa/reports', 'scripts']) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    const executable = ['new.spec.ts', 'new.spec.mjs', 'new.spec.mts',
      'new.spec.cjs', 'new.spec.cts', 'new.spec.jsx', 'new.spec.tsx',
      'new.test.js', 'new.test.py', 'reports/new.spec.js', '__pycache__/new.spec.js'];
    for (const name of executable) {
      const target = path.join(root, 'qa/e2e', name);
      fs.writeFileSync(target, name.endsWith('.py') ? 'def test_new(): pass\n' : "test('new', () => {});\n");
    }
    fs.writeFileSync(path.join(root, 'qa/reports', 'old.spec.js'), "test('generated', () => {});\n");
    fs.writeFileSync(path.join(root, 'qa/e2e/node_modules', 'old.spec.js'), "test('dependency', () => {});\n");
    const found = inventory.discover(root);
    for (const name of executable) {
      assert.ok(found.includes(`qa/e2e/${name}`), `missed qa/e2e/${name}`);
    }
    assert.ok(!found.includes('qa/reports/old.spec.js'));
    assert.ok(!found.includes('qa/e2e/node_modules/old.spec.js'));
    for (const name of ['new.spec.ts', 'new.spec.mjs',
      'reports/new.spec.js', '__pycache__/new.spec.js']) {
      const extra = { ...sources, [`qa/e2e/${name}`]: "test('new', () => {});\n" };
      assert.throws(() => check(manifest, catalogue, api, extra), /new, deleted or moved/);
    }
  } finally {
    const owned = path.resolve(root);
    assert.ok(owned.startsWith(path.resolve(os.tmpdir()) + path.sep) &&
      path.basename(owned).startsWith('wallet-source-discovery-'));
    fs.rmSync(owned, { recursive: true, force: true });
  }
});

test('all 280 main rows and each current source path are accounted for, without execution', () => {
  const result = check();
  assert.equal(result.counts.mainCases, 280);
  assert.deepEqual(result.counts.mainByFamily,
    { API: 141, E2E: 90, REG: 3, PY: 17, SEL: 9, DB: 6, CONTRACT: 11, LOAD: 3 });
  assert.equal(result.counts.sourceFiles, inventory.discover().length);
  assert.ok(result.counts.parameters > 0);
  assert.equal(result.completeSourceAccounting, true);
  assert.equal(result.execution, 'NOT_RUN');
  assert.deepEqual(inventory.buildInventory(), JSON.parse(read('qa/docs/test-source-inventory.json')));
});

test('new, deleted, moved, or changed executable source fails closed', () => {
  const file = 'qa/e2e/add-expense.spec.js';
  const changed = { ...sources, [file]: sources[file] + "\ntest('unannotated',()=>{});\n" };
  assert.throws(() => check(manifest, catalogue, api, changed), /changed source/);
  const missing = { ...sources }; delete missing[file];
  assert.throws(() => check(manifest, catalogue, api, missing), /missing source/);
  const moved = { ...sources }; moved['qa/e2e/renamed.spec.js'] = moved[file]; delete moved[file];
  assert.throws(() => check(manifest, catalogue, api, moved), /missing source/);
  const extra = { ...sources, 'qa/e2e/new.spec.js': "test('new',()=>{});" };
  assert.throws(() => check(manifest, catalogue, api, extra), /new, deleted or moved/);
});

test('known execution config drift and new supported config candidate fail closed', () => {
  const changed = { ...configs, 'playwright.config.js': configs['playwright.config.js'] + '\n// drift\n' };
  assert.throws(() => check(manifest, catalogue, api, sources, changed), /changed config/);
  const changedCommand = { ...configs, 'package.json': configs['package.json'] + '\n' };
  assert.throws(() => check(manifest, catalogue, api, sources, changedCommand), /changed config/);
  const extra = { ...configs, 'playwright.new.config.ts': 'export default {};\n' };
  assert.throws(() => check(manifest, catalogue, api, sources, extra), /new, deleted or moved config candidate/);
  const missing = { ...configs }; delete missing['pytest.ini'];
  assert.throws(() => check(manifest, catalogue, api, sources, missing), /missing or changed config/);
});

test('discovery finds new root and nested supported config candidates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-config-discovery-'));
  try {
    fs.mkdirSync(path.join(root, 'qa/python'), { recursive: true });
    for (const file of ['package.json', 'package-lock.json', 'pytest.ini',
      'playwright.config.js', 'playwright.ai.config.js', 'playwright.a11y.config.js',
      'playwright.new.config.ts', 'qa/python/pyproject.toml']) {
      fs.writeFileSync(path.join(root, file), '{}\n');
    }
    assert.ok(inventory.discoverConfigs(root).includes('playwright.new.config.ts'));
    assert.ok(inventory.discoverConfigs(root).includes('qa/python/pyproject.toml'));
  } finally {
    const owned = path.resolve(root);
    assert.ok(owned.startsWith(path.resolve(os.tmpdir()) + path.sep) &&
      path.basename(owned).startsWith('wallet-config-discovery-'));
    fs.rmSync(owned, { recursive: true, force: true });
  }
});

test('missing main case, wrong family, unknown ID and duplicate links fail', () => {
  const removed = copy(manifest);
  const db = removed.files.find(file => file.path === 'qa/db/migration.test.js');
  db.links = db.links.filter(link => link.caseId !== 'TC-DB-001');
  assert.throws(() => check(removed), /unaccounted main-file scenario|catalogue cases without source/);
  const wrong = copy(manifest);
  wrong.files.find(file => file.path === 'qa/db/migration.test.js').links[0].caseId = 'TC-PY-001';
  assert.throws(() => check(wrong), /wrong-family/);
  const unknown = copy(manifest);
  unknown.files.find(file => file.path === 'qa/db/migration.test.js').links[0].caseId = 'TC-DB-999';
  assert.throws(() => check(unknown), /unknown or wrong-family/);
  const duplicate = copy(manifest);
  const links = duplicate.files.find(file => file.path === 'qa/db/migration.test.js').links;
  links.push(copy(links[0]));
  assert.throws(() => check(duplicate), /duplicate case link/);
});

test('reviewed browser support controls stay separate from all 280 main cases', () => {
  const result = check();
  assert.equal(result.counts.mainCases, 280);
  assert.ok(result.counts.browserSupportControls >= 3);
  const browser = result.files.find(file => file.path === 'qa/e2e/double-submit.spec.js');
  assert.ok(browser.links.some(link => link.caseId === 'TC-E2E-045'));
  assert.ok(browser.otherScenarios.some(item => item.classification === 'support_control' && item.reason));

  const changed = transform => {
    const m = copy(manifest);
    const file = m.files.find(item => item.path === 'qa/e2e/double-submit.spec.js');
    transform(file);
    return m;
  };
  assert.throws(() => check(changed(file => file.otherScenarios.pop())), /unaccounted main-file scenario/);
  assert.throws(() => check(changed(file => { file.otherScenarios[0].sourceMarker = '__phantom__'; })), /invalid named other scenario/);
  assert.throws(() => check(changed(file => { file.otherScenarios[0].reason = ''; })), /invalid named other scenario/);
  assert.throws(() => check(changed(file => { file.otherScenarios[0].classification = 'provisional_import'; })), /invalid named other scenario/);
  assert.throws(() => check(changed(file => file.otherScenarios.push(copy(file.otherScenarios[0])))), /invalid named other scenario/);
  assert.throws(() => check(changed(file => {
    const link = file.links.find(item => item.caseId === 'TC-E2E-045');
    file.links = file.links.filter(item => item !== link);
    file.otherScenarios.push({ scenario: link.scenario, sourceMarker: link.scenario,
      classification: 'support_control', reason: 'Attempted replacement of a required main link' });
  })), /catalogue cases without source|invalid named other scenario/);
});

test('catalogue row, support source, parameter, and API component drift fail', () => {
  const row = catalogue.replace('| TC-DB-001 |', '| TC-DB-001 | edited ');
  assert.throws(() => check(manifest, row), /changed catalogue row/);
  const duplicate = catalogue + '\n' + catalogue.split('\n').find(line => line.startsWith('| TC-DB-001 |'));
  assert.throws(() => check(manifest, duplicate), /duplicate catalogue ID/);
  const support = { ...sources }; delete support['qa/e2e/fixtures/wallet.js'];
  assert.throws(() => check(manifest, catalogue, api, support), /missing source/);
  const param = copy(manifest);
  const carrier = param.files.find(file => file.parameters.length);
  assert.ok(carrier);
  carrier.parameters[0].sourceMarker = '__missing_parameter__';
  assert.throws(() => check(param), /unresolved parameter/);
  const missingParameter = copy(manifest);
  missingParameter.files.find(file => file.path === carrier.path).parameters.pop();
  assert.throws(() => check(missingParameter), /missing or unreviewed parameter expansion/);
  const brokenApi = copy(api); brokenApi.completeApiAccounting = false;
  assert.throws(() => check(manifest, catalogue, brokenApi), /API component missing/);
  const hiddenAi = copy(manifest);
  hiddenAi.files.find(file => file.path === 'qa/python/test_ai_keyed.py').role = 'helper';
  assert.throws(() => check(hiddenAi), /changed reviewed source role/);
  const missingSeparate = copy(manifest);
  missingSeparate.files.find(file => file.path === 'qa/python/test_ai_keyed.py').sourceOnly.pop();
  assert.throws(() => check(missingSeparate), /unaccounted separate scenario/);
});

test('malformed and duplicated manifest paths, stale output, collision fail', () => {
  assert.throws(() => check({ files: [] }), /malformed manifest/);
  const dup = copy(manifest); dup.files.push(copy(dup.files[0]));
  assert.throws(() => check(dup), /duplicate source path/);
  const current = inventory.buildInventory();
  const stale = copy(current); stale.counts.mainCases = 279;
  assert.throws(() => inventory.checkInventory(stale, current), /stale generated artifact/);
  assert.throws(() => inventory.assertOutputSeparate(ROOT,
    ['qa/docs/test-source-inventory.json']), /source\/output collision/);
});

test('legitimate multiple links, reviewed parameters/viewports and CRLF normalize', () => {
  const many = copy(manifest);
  const security = many.files.find(file => file.path === 'qa/e2e/security.spec.js');
  assert.ok(security.links.length >= 5 && security.parameters.length >= 3);
  const db = many.files.find(file => file.path === 'qa/db/migration.test.js');
  db.links.push({ ...copy(db.links[1]), scenario: db.links[0].scenario });
  assert.equal(check(many).counts.mainCases, 280);
  const crlf = { ...sources };
  const name = 'qa/db/migration.test.js';
  crlf[name] = sources[name].replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n');
  assert.equal(check(manifest, catalogue, api, crlf).counts.mainCases, 280);
  assert.ok(manifest.files.some(file => file.role === 'main_selenium' &&
    file.parameters.some(param => param.identity.includes('phone-375'))));
});
