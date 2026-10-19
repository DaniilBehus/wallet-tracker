#!/usr/bin/env node
'use strict';

// Bounded, reviewed source identity inventory. This is deliberately not a
// JavaScript/Python parser: unknown or edited files need a new source review.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildInventory: buildApiInventory } = require('./postman-api-inventory');

const ROOT = path.join(__dirname, '..');
const MANIFEST = 'qa/traceability/test-source-manifest.json';
const CATALOGUE = 'qa/docs/test-cases.md';
const OUTPUT = 'qa/docs/test-source-inventory.json';
const SOURCE_ROOTS = ['qa', 'scripts'];
const CONFIG_DIRS = ['', 'qa/python', 'qa/selenium'];
const REQUIRED_CONFIGS = ['package.json', 'package-lock.json', 'pytest.ini',
  'playwright.config.js', 'playwright.ai.config.js', 'playwright.a11y.config.js'];
const PLAYWRIGHT_CONFIG = /^playwright(?:\.[A-Za-z0-9_-]+)*\.config\.(?:[cm]?[jt]sx?)$/;
const PYTEST_CONFIG = /^(?:pytest\.ini|pyproject\.toml|tox\.ini|setup\.cfg)$/;
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?|py)$/;
const TEST_EXTENSION = /\.(?:spec|test)\.(?:[cm]?[jt]sx?)$/;
const MAIN = new Map([
  ['main_browser', new Set(['E2E', 'REG'])], ['main_python', new Set(['PY'])],
  ['main_selenium', new Set(['SEL'])], ['main_db', new Set(['DB'])],
  ['main_contract', new Set(['CONTRACT'])], ['main_load', new Set(['LOAD'])],
]);
const OTHER = new Set(['separate_ai', 'separate_a11y', 'provisional_import',
  'support_control', 'runner', 'helper', 'tooling']);
const REGISTERS = {
  separate_ai: 'qa/docs/ai-test-plan.md',
  separate_a11y: 'qa/docs/accessibility-baseline.md',
  provisional_import: 'qa/docs/analysis-synthetic-import.md',
};
const REQUIRED_PARAMETERS = {
  'qa/e2e/security.spec.js': ['TC-E2E-058:a script tag', 'TC-E2E-059:an image handler',
    'TC-E2E-060:a closing tag'],
  'qa/python/test_api.py': ['missing', 'negative', 'zero', 'fractional', 'string',
    'boolean', 'impossible-date', 'wrong-date-type'].map(name => `TC-PY-001:${name}`),
  'qa/selenium/test_expenses.py': ['TC-SEL-003:desktop', 'TC-SEL-008:phone-375'],
  'qa/selenium/test_limit.py': ['TC-SEL-004:within', 'TC-SEL-004:exactly-at',
    'TC-SEL-004:over'],
  'qa/e2e/ai/add-layout.spec.js': ['AI viewport 320x568', 'AI viewport 375x667',
    'AI viewport 393x727', 'AI viewport 1280x800'],
};
const H = value => crypto.createHash('sha256').update(value).digest('hex');
const normalized = value => String(value).replace(/\r\n?/g, '\n');
const sha = value => H(normalized(value));
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const fail = message => { throw new Error(`Test source inventory: ${message}`); };

function expectedRole(file) {
  if (/^qa\/e2e\/(?!ai\/)(?:[^/]+\/)*[^/]+\.(?:spec|test)\.(?:[cm]?[jt]sx?)$/.test(file) &&
      file !== 'qa/e2e/synthetic-import.spec.js') return 'main_browser';
  if (/^qa\/python\/test_[^/]+\.py$/.test(file) &&
      file !== 'qa/python/test_ai_keyed.py') return 'main_python';
  if (/^qa\/selenium\/test_[^/]+\.py$/.test(file)) return 'main_selenium';
  if (file === 'qa/db/migration.test.js') return 'main_db';
  if (file === 'qa/contract/contract.test.js') return 'main_contract';
  if (['qa/load/expense-write.js', 'qa/load/auth-burst.js',
    'qa/load/allowed-logins.js'].includes(file)) return 'main_load';
  if (['qa/e2e/synthetic-import.spec.js', 'qa/import/synthetic-import.test.js',
    'qa/import/provider-adapter.test.js'].includes(file)) return 'provisional_import';
  if ((file.startsWith('qa/e2e/ai/') && TEST_EXTENSION.test(file)) ||
      (file.startsWith('qa/ai/tests/') && TEST_EXTENSION.test(file)) ||
      file === 'qa/python/test_ai_keyed.py') return 'separate_ai';
  if (file.startsWith('qa/a11y/') && TEST_EXTENSION.test(file)) return 'separate_a11y';
  if (TEST_EXTENSION.test(file) ||
      /\/test_[^/]+\.py$/.test(file)) return 'support_control';
  if (file.endsWith('/run.js') || file === 'qa/race/run.js' ||
      file === 'scripts/verify-ci.js') return 'runner';
  return file.startsWith('scripts/') ? 'tooling' : 'helper';
}

function discover(root = ROOT) {
  const files = [];
  function walk(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (next === 'qa/reports' || entry.name === 'node_modules') continue;
        walk(next);
      } else if (entry.isFile() && SOURCE_EXTENSION.test(entry.name)) files.push(next);
      else if (entry.isSymbolicLink()) fail(`unsupported source symlink ${next}`);
    }
  }
  for (const sourceRoot of SOURCE_ROOTS) {
    if (fs.lstatSync(path.join(root, sourceRoot)).isSymbolicLink()) fail(`unsupported source root symlink ${sourceRoot}`);
    walk(sourceRoot);
  }
  return files.sort();
}

function configCandidate(directory, name) {
  return directory === '' ? PLAYWRIGHT_CONFIG.test(name) || PYTEST_CONFIG.test(name) :
    PYTEST_CONFIG.test(name);
}

function discoverConfigs(root = ROOT) {
  const found = new Set(REQUIRED_CONFIGS);
  for (const directory of CONFIG_DIRS) {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) continue;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (!configCandidate(directory, entry.name)) continue;
      const relative = directory ? `${directory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink() || !entry.isFile()) fail(`unsupported config candidate ${relative}`);
      found.add(relative);
    }
  }
  for (const required of REQUIRED_CONFIGS) {
    const absolute = path.join(root, required);
    if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile() ||
        fs.lstatSync(absolute).isSymbolicLink()) fail(`missing or unsupported config ${required}`);
  }
  return [...found].sort();
}

function declarations(source, file) {
  const found = [];
  if (file.endsWith('.py')) {
    for (const match of normalized(source).matchAll(/^\s*(?:async\s+)?def\s+(test_[A-Za-z0-9_]+)\s*\(/gm)) {
      found.push(match[1]);
    }
  } else {
    // Supported literal one-line test()/it() calls, including template titles.
    const input = normalized(source);
    for (const match of input.matchAll(/^\s*(?:test|it)(?:\.(?:skip|only|fixme))?\(\s*(['"`])/gm)) {
      const quote = match[1];
      let title = '', escaped = false, closed = false;
      for (let index = match.index + match[0].length; index < input.length; index++) {
        const char = input[index];
        if (char === '\n') break;
        if (char === quote && !escaped) { closed = true; break; }
        title += char;
        if (char === '\\' && !escaped) escaped = true;
        else escaped = false;
      }
      if (!closed) fail(`unsupported test title ${file}`);
      found.push(title);
    }
  }
  return found;
}

function catalogueRows(source) {
  const rows = new Map();
  for (const line of normalized(source).split('\n')) {
    const match = /^\| (TC-[A-Z0-9]+-\d{3}) \|/.exec(line);
    if (!match) continue;
    if (rows.has(match[1])) fail(`duplicate catalogue ID ${match[1]}`);
    rows.set(match[1], sha(line));
  }
  if (!rows.size) fail('empty catalogue');
  return rows;
}

function validate({ manifest, catalogue, api, sources, configs }) {
  if (!plain(manifest) || manifest.schemaVersion !== 1 ||
      !Array.isArray(manifest.files) || !manifest.files.length ||
      !plain(manifest.catalogueRows) || !Array.isArray(manifest.configs) ||
      !plain(sources) || !plain(configs)) fail('empty or malformed manifest/source/config');
  const configPaths = new Set();
  for (const record of manifest.configs) {
    if (!plain(record) || !text(record.path) || !validHash(record.sha256) ||
        configPaths.has(record.path)) fail('malformed or duplicate config record');
    configPaths.add(record.path);
    if (typeof configs[record.path] !== 'string' || H(configs[record.path]) !== record.sha256) {
      fail(`missing or changed config ${record.path}`);
    }
  }
  if (Object.keys(configs).length !== configPaths.size ||
      Object.keys(configs).some(file => !configPaths.has(file)) ||
      REQUIRED_CONFIGS.some(file => !configPaths.has(file))) fail('new, deleted or moved config candidate');
  const rows = catalogueRows(catalogue);
  const declaredRows = Object.keys(manifest.catalogueRows);
  if (rows.size !== 280 || declaredRows.length !== rows.size ||
      declaredRows.some(id => !rows.has(id) || manifest.catalogueRows[id] !== rows.get(id))) {
    fail('missing, new or changed catalogue row');
  }
  if (!plain(api) || api.status !== 'STATIC_SOURCE_INVENTORY' ||
      api.execution !== 'NOT_RUN' || !api.completeApiAccounting ||
      !Array.isArray(api.requests) || api.counts?.requests !== 271 ||
      api.counts?.mainCases !== 141) fail('current accepted API component missing');
  const covered = new Map([...rows.keys()].map(id => [id, []]));
  for (const request of api.requests) {
    if (request.classification !== 'business_assertion') continue;
    for (const id of request.caseIds || []) {
      if (!covered.has(id) || !id.startsWith('TC-API-')) fail(`unknown API edge ${id}`);
      covered.get(id).push({ path: 'qa/api/wallet.postman_collection.json',
        scenario: request.selector.name, role: 'main_api' });
    }
  }
  const paths = new Set();
  const globalSourceIds = new Set();
  const scenarioCount = {};
  const byRole = {};
  const allFiles = [];
  for (const file of manifest.files) {
    if (!plain(file) || !text(file.path) || !validHash(file.sha256) ||
        !text(file.role) || !text(file.roleNote) ||
        !Array.isArray(file.declarations) || !Array.isArray(file.links) ||
        !Array.isArray(file.parameters) || !Array.isArray(file.sourceOnly) ||
        !Array.isArray(file.otherScenarios)) fail('malformed source-file record');
    if (paths.has(file.path)) fail(`duplicate source path ${file.path}`);
    paths.add(file.path);
    if (!MAIN.has(file.role) && !OTHER.has(file.role)) fail(`unknown role ${file.role}`);
    if (file.role !== expectedRole(file.path)) fail(`changed reviewed source role ${file.path}`);
    if ((REGISTERS[file.role] || null) !== (file.register || null)) {
      fail(`missing or wrong separate-register pointer ${file.path}`);
    }
    const source = sources[file.path];
    if (typeof source !== 'string') fail(`missing source ${file.path}`);
    if (sha(source) !== file.sha256) fail(`changed source ${file.path}`);
    const found = declarations(source, file.path);
    if (JSON.stringify(found) !== JSON.stringify(file.declarations)) {
      fail(`unreviewed or missing scenario declaration ${file.path}`);
    }
    if (file.declarations.length && !TEST_EXTENSION.test(file.path) &&
        !/\/test_[^/]+\.py$/.test(file.path)) {
      fail(`unsupported executable shape ${file.path}`);
    }
    for (const param of file.parameters) {
      if (!plain(param) || !text(param.identity) || !text(param.sourceMarker) ||
          !source.includes(param.sourceMarker)) fail(`unresolved parameter ${file.path}`);
    }
    if (new Set(file.parameters.map(p => p.identity)).size !== file.parameters.length) {
      fail(`duplicate parameter ${file.path}`);
    }
    if (JSON.stringify(file.parameters.map(p => p.identity)) !==
        JSON.stringify(REQUIRED_PARAMETERS[file.path] || [])) {
      fail(`missing or unreviewed parameter expansion ${file.path}`);
    }
    if (new Set(file.links.map(link => JSON.stringify(link))).size !== file.links.length) {
      fail(`duplicate case link ${file.path}`);
    }
    for (const link of file.links) {
      if (!plain(link) || !text(link.caseId) || !text(link.scenario) ||
          !text(link.sourceMarker) || !source.includes(link.sourceMarker)) {
        fail(`malformed or missing case link ${file.path}`);
      }
      if (!MAIN.has(file.role)) fail(`non-main source claims catalogue case ${file.path}`);
      const family = link.caseId.split('-')[1];
      if (!MAIN.get(file.role).has(family) || !covered.has(link.caseId)) {
        fail(`unknown or wrong-family link ${link.caseId}`);
      }
      if (file.declarations.length && !file.declarations.includes(link.scenario)) {
        fail(`case link has no reviewed declaration ${link.caseId}`);
      }
      covered.get(link.caseId).push({ path: file.path, scenario: link.scenario, role: file.role });
    }
    const otherNames = new Set();
    for (const item of file.otherScenarios) {
      if (!plain(item) || !text(item.scenario) || !text(item.classification) ||
          !text(item.sourceMarker) || !source.includes(item.sourceMarker) ||
          !file.declarations.includes(item.scenario) || otherNames.has(item.scenario) ||
          file.links.some(link => link.scenario === item.scenario) ||
          !['support_control', 'provisional_import'].includes(item.classification) ||
          (file.role === 'main_browser' && (item.classification !== 'support_control' ||
            !text(item.reason) || item.sourceMarker !== item.scenario))) {
        fail(`invalid named other scenario ${file.path}`);
      }
      otherNames.add(item.scenario);
    }
    const sourceIds = new Set();
    for (const item of file.sourceOnly) {
      if (!plain(item) || !/^SRC-[A-Z0-9]+-[A-F0-9]{12}$/.test(item.id) ||
          !text(item.scenario) || !file.declarations.includes(item.scenario) ||
          sourceIds.has(item.id) || globalSourceIds.has(item.id)) {
        fail(`invalid source-only identity ${file.path}`);
      }
      sourceIds.add(item.id);
      globalSourceIds.add(item.id);
    }
    if (['separate_ai', 'separate_a11y', 'provisional_import'].includes(file.role) &&
        (file.sourceOnly.length !== file.declarations.length || file.links.length)) {
      fail(`unaccounted separate scenario ${file.path}`);
    }
    if (!['separate_ai', 'separate_a11y', 'provisional_import'].includes(file.role) &&
        file.sourceOnly.length) fail(`unreviewed source-only identity ${file.path}`);
    if (!['main_contract', 'main_browser'].includes(file.role) && file.otherScenarios.length) {
      fail(`unexpected mixed scenario classification ${file.path}`);
    }
    if (MAIN.has(file.role) && file.declarations.length) {
      const accounted = new Set([...file.links.map(link => link.scenario), ...otherNames]);
      if (accounted.size !== file.declarations.length ||
          file.declarations.some(name => !accounted.has(name))) {
        fail(`unaccounted main-file scenario ${file.path}`);
      }
    }
    if (MAIN.has(file.role) && !file.links.length) fail(`main source without cases ${file.path}`);
    if (file.role === 'main_load' &&
        (!source.includes('export function handleSummary') ||
         !sources['qa/load/run.js']?.includes(file.path))) {
      fail(`load script not linked by runner ${file.path}`);
    }
    if (!MAIN.has(file.role) && file.links.length) fail(`separate/support source has main link ${file.path}`);
    byRole[file.role] = (byRole[file.role] || 0) + 1;
    scenarioCount[file.role] = (scenarioCount[file.role] || 0) + file.declarations.length;
    allFiles.push({ path: file.path, role: file.role, roleNote: file.roleNote,
      sha256: file.sha256, declarations: file.declarations,
      links: file.links, parameters: file.parameters, sourceOnly: file.sourceOnly,
      otherScenarios: file.otherScenarios,
      register: file.register || null });
  }
  const discovered = Object.keys(sources).sort();
  if (discovered.length !== paths.size || discovered.some(file => !paths.has(file))) {
    fail('new, deleted or moved executable source path');
  }
  const missing = [...covered].filter(([, edges]) => !edges.length).map(([id]) => id);
  if (missing.length) fail(`catalogue cases without source ${missing.join(',')}`);
  const mainCounts = {};
  for (const id of rows.keys()) {
    const family = id.split('-')[1];
    mainCounts[family] = (mainCounts[family] || 0) + 1;
  }
  return { schemaVersion: 1, status: 'STATIC_SOURCE_INVENTORY', execution: 'NOT_RUN',
    otherLayers: 'NOT_CHECKED', completeSourceAccounting: true,
    counts: { mainCases: rows.size, mainByFamily: mainCounts,
      sourceFiles: paths.size, configFiles: configPaths.size, sourceFilesByRole: byRole,
      literalDeclarationsByRole: scenarioCount,
      parameters: allFiles.reduce((n, file) => n + file.parameters.length, 0),
      browserSupportControls: allFiles.filter(file => file.role === 'main_browser')
        .reduce((n, file) => n + file.otherScenarios.length, 0) },
    mainCaseLinks: Object.fromEntries([...covered]), files: allFiles,
    configs: manifest.configs,
    limits: ['Full-file LF-normalized hashes pin reviewed syntax; they do not prove semantics or runtime collection.',
      'Literal test()/it()/def test_ forms only; loop/parameter expansions are separately declared and source-pinned.',
      'Separate AI, a11y, synthetic import and supporting controls are not owner catalogue execution claims.',
      'Config bytes are pinned by reviewed paths; config files are not executed or semantically interpreted.'] };
}

function assertOutputSeparate(root, sources) {
  const target = path.join(root, OUTPUT);
  const real = p => fs.existsSync(p) ? fs.realpathSync(p) : path.resolve(p);
  const output = real(target).toLowerCase();
  for (const source of [MANIFEST, CATALOGUE, ...sources]) {
    if (output === real(path.join(root, source)).toLowerCase()) fail('source/output collision');
  }
}

function buildInventory(root = ROOT) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const manifest = JSON.parse(read(MANIFEST));
  for (const register of Object.values(REGISTERS)) {
    if (!fs.existsSync(path.join(root, register))) fail(`missing separate register ${register}`);
  }
  const catalogue = read(CATALOGUE);
  const sourcePaths = discover(root);
  const configPaths = discoverConfigs(root);
  assertOutputSeparate(root, [...sourcePaths, ...configPaths]);
  const sources = Object.fromEntries(sourcePaths.map(file => [file, read(file)]));
  const configs = Object.fromEntries(configPaths.map(file => [file, read(file)]));
  const inventory = validate({ manifest, catalogue, api: buildApiInventory(root), sources, configs });
  return { ...inventory, sourceHashes: {
    catalogue: { path: CATALOGUE, sha256: H(fs.readFileSync(path.join(root, CATALOGUE))) },
    manifest: { path: MANIFEST, sha256: H(fs.readFileSync(path.join(root, MANIFEST))) },
    apiInventory: { path: 'qa/docs/postman-api-inventory.json',
      sha256: H(fs.readFileSync(path.join(root, 'qa/docs/postman-api-inventory.json'))) },
  } };
}

function checkInventory(saved, fresh) {
  if (JSON.stringify(saved) !== JSON.stringify(fresh)) fail('stale generated artifact');
}

function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length && !['--check', '--write'].includes(args[0]))) {
    fail('use no option, --check, or --write');
  }
  const inventory = buildInventory();
  const rendered = JSON.stringify(inventory, null, 2) + '\n';
  if (args[0] === '--check') {
    checkInventory(JSON.parse(fs.readFileSync(path.join(ROOT, OUTPUT), 'utf8')), inventory);
    console.log('Test source inventory: current generated artifact matches reviewed sources');
  } else if (args[0] === '--write') {
    fs.writeFileSync(path.join(ROOT, OUTPUT), rendered);
    console.log(`Test source inventory: ${inventory.counts.mainCases} main cases; static only, NOT_RUN`);
  } else process.stdout.write(rendered);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { discover, discoverConfigs, declarations, catalogueRows, validate, assertOutputSeparate,
  buildInventory, checkInventory, main };
