#!/usr/bin/env node
'use strict';

// API-only structural source inventory. Postman scripts are inspected as text,
// never evaluated. A reviewed manifest supplies identities; this checker does
// not invent request-to-case links or infer behavior from request titles.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateSources } = require('./postman-inventory');

const ROOT = path.join(__dirname, '..');
const ACCEPTED = [
  ['01 · Health and registration', 'postman-health.json'],
  ['02 · Token handling', 'postman-token.json'],
  ['03 · Categories', 'postman-categories.json'],
  ['04 · Transactions', 'postman-transactions.json'],
];
const BATCH_FOLDERS = [
  '05 · Schedules and loans', '06 · Summary', '07 · Contract edges',
  '08 · Settings and the month balance', '10 · Editing (D-029)',
  '11 · AI drafts and keyed saves (D-033–D-035)',
  '12 · Monthly spending limit', '13 · Category spending limits',
  '09 · Login rate limiting',
  'Synthetic batch import (offline caller-supplied records)',
];
const CLASSES = new Set(['business_assertion', 'case_arrange', 'case_cleanup',
  'supporting_control', 'provisional_import']);
const SECTION_FOLDERS = new Map([
  ['## API · Schedules and loans', ['05 · Schedules and loans']],
  ['## API · Summary and contract edges', ['06 · Summary', '07 · Contract edges']],
  ['## API · Login rate limiting · folder `09`', ['09 · Login rate limiting']],
  ['## API · Settings and the month balance · folder `08`',
    ['08 · Settings and the month balance']],
  ['## API · Monthly spending limit · folder `12`', ['12 · Monthly spending limit']],
  ['## Category-limit API contract and decisions', ['13 · Category spending limits']],
]);
const H = value => crypto.createHash('sha256').update(value).digest('hex');
const fingerprint = value => H(JSON.stringify(value));
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = message => { throw new Error(`Postman API inventory: ${message}`); };

function selector(folder, item) {
  if (!plain(item) || item.item !== undefined || !plain(item.request) ||
      !text(item.name) || !text(item.request.method) ||
      !text(item.request.url?.raw) || !Array.isArray(item.event) ||
      item.event.length === 0) fail('nested or unsupported request');
  return { folder, name: item.name, method: item.request.method,
    rawUrl: item.request.url.raw };
}

function edgeKey(edge) {
  const s = edge?.selector;
  if (!plain(s) || !['folder', 'name', 'method', 'rawUrl'].every(key => text(s[key])) ||
      !hash(edge.requestEventSha256)) fail('malformed reviewed identity');
  return JSON.stringify([s.folder, s.name, s.method, s.rawUrl,
    edge.requestEventSha256]);
}

function requestKey(folder, item) {
  return edgeKey({ selector: selector(folder, item),
    requestEventSha256: fingerprint({ request: item.request, event: item.event }) });
}

function context(collection, folder) {
  return fingerprint({ collectionEvent: collection.event || null,
    collectionVariable: collection.variable || null,
    collectionAuth: collection.auth || null,
    folderEvent: folder.event || null, folderAuth: folder.auth || null });
}

function parseCatalogue(markdown) {
  if (!text(markdown)) fail('empty or malformed catalogue');
  const rows = new Map();
  const sections = new Map();
  let section = '';
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('## ')) section = line;
    if (!line.startsWith('|')) continue;
    const first = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (!first) continue;
    const id = first[1].trim();
    if (id.startsWith('TC-API-') && !/^TC-API-\d{3}$/.test(id)) {
      fail(`malformed active catalogue ID ${id}`);
    }
    if (!/^TC-API-\d{3}$/.test(id)) continue;
    if (rows.has(id)) fail(`duplicate catalogue ID ${id}`);
    rows.set(id, H(line));
    sections.set(id, section);
  }
  if (!rows.size) fail('empty active API catalogue');
  return { rows, sections };
}

function reviewDigest(node) {
  return fingerprint({ classification: node.classification, caseIds: node.caseIds,
    extendedIds: node.extendedIds, testMarker: node.testMarker,
    oracleReason: node.oracleReason });
}

function validateAggregate({ collection, catalogue, acceptedMappings, batch, extended } = {}) {
  if (!plain(collection) || !Array.isArray(collection.item)) fail('missing collection folders');
  if (!plain(batch) || batch.schemaVersion !== 1 ||
      !Array.isArray(batch.folders) || !Array.isArray(batch.acceptedMappings) ||
      !plain(batch.caseRowSha256) || !Array.isArray(batch.nodes) ||
      !hash(batch.extendedContentSha256) ||
      !hash(batch.reviewedClassificationsSha256)) fail('malformed batch manifest');
  if (!plain(extended) || extended.schemaVersion !== 1 ||
      !Array.isArray(extended.records) || !extended.records.length ||
      extended.status !== 'SOURCE_DECLARATIONS_NOT_OWNER_APPROVED') {
    fail('malformed extended register');
  }
  const { rows, sections } = parseCatalogue(catalogue);
  if (!Array.isArray(acceptedMappings) || acceptedMappings.length !== ACCEPTED.length ||
      batch.acceptedMappings.length !== ACCEPTED.length) fail('four accepted mappings required');
  if (collection.item.length !== ACCEPTED.length + BATCH_FOLDERS.length) {
    fail('missing or extra collection folder');
  }
  const folders = new Map();
  for (const folder of collection.item) {
    if (!plain(folder) || !text(folder.name) || !Array.isArray(folder.item)) {
      fail('nested or unsupported collection folder');
    }
    if (folders.has(folder.name)) fail(`duplicate collection folder ${folder.name}`);
    folders.set(folder.name, folder);
  }
  const expectedFolders = new Set([...ACCEPTED.map(row => row[0]), ...BATCH_FOLDERS]);
  if ([...folders.keys()].some(name => !expectedFolders.has(name)) ||
      [...expectedFolders].some(name => !folders.has(name))) fail('missing or extra collection folder');

  const acceptedByFolder = new Map(acceptedMappings.map(mapping => [mapping?.scope?.folder, mapping]));
  if (acceptedByFolder.size !== ACCEPTED.length) fail('duplicate accepted mapping ID');
  const reviewedAccepted = new Map();
  const mainCoverage = new Map([...rows.keys()].map(id => [id, []]));
  for (const [folderName] of ACCEPTED) {
    const mapping = acceptedByFolder.get(folderName);
    const pin = batch.acceptedMappings.find(entry => entry?.folder === folderName);
    if (!mapping || !pin || !hash(pin.contentSha256) ||
        pin.contentSha256 !== fingerprint(mapping)) fail('accepted mapping source drift');
    const result = validateSources({ collection, catalogue, mapping });
    for (const edge of mapping.edges) {
      const key = edgeKey(edge);
      if (reviewedAccepted.has(key)) fail('duplicate accepted request identity');
      reviewedAccepted.set(key, { ...edge, classification: 'business_assertion',
        extendedIds: [], status: 'SOURCE_LINK_DECLARED_ONLY' });
      for (const id of edge.caseIds) mainCoverage.get(id)?.push(key);
    }
    if (result.counts.requests !== folders.get(folderName).item.length) {
      fail('accepted mapping folder count mismatch');
    }
  }
  if (batch.acceptedMappings.some(entry =>
    !ACCEPTED.some(([name]) => name === entry?.folder)) ||
    new Set(batch.acceptedMappings.map(entry => entry.folder)).size !== ACCEPTED.length) {
    fail('duplicate or unknown accepted mapping ID');
  }

  if (batch.folders.length !== BATCH_FOLDERS.length ||
      new Set(batch.folders.map(entry => entry?.name)).size !== BATCH_FOLDERS.length) {
    fail('missing or duplicate batch folder');
  }
  for (const name of BATCH_FOLDERS) {
    const pin = batch.folders.find(entry => entry?.name === name);
    if (!pin || !hash(pin.contextSha256) ||
        pin.contextSha256 !== context(collection, folders.get(name))) {
      fail(`collection context changed for ${name}`);
    }
    if (!folders.get(name).item.length) fail(`empty reviewed folder ${name}`);
  }
  if (batch.folders.some(entry => !BATCH_FOLDERS.includes(entry.name))) {
    fail('unknown batch folder');
  }

  const expectedIds = new Set([...ACCEPTED.flatMap(([name]) =>
    Object.keys(acceptedByFolder.get(name).caseRowSha256)),
  ...Object.keys(batch.caseRowSha256)]);
  if (expectedIds.size !== 141 || rows.size !== 141) fail('active API catalogue count changed');
  for (const [id, currentHash] of rows) {
    if (!expectedIds.has(id)) fail(`unreviewed catalogue ID ${id}`);
    const reviewedHash = batch.caseRowSha256[id] ||
      acceptedByFolder.get(ACCEPTED.find(([name]) =>
        Object.hasOwn(acceptedByFolder.get(name).caseRowSha256, id))?.[0])?.caseRowSha256[id];
    if (currentHash !== reviewedHash) fail(`catalogue row changed for ${id}`);
  }
  for (const id of Object.keys(batch.caseRowSha256)) {
    if (!/^TC-API-\d{3}$/.test(id) || !hash(batch.caseRowSha256[id]) ||
        ACCEPTED.some(([name]) => Object.hasOwn(acceptedByFolder.get(name).caseRowSha256, id))) {
      fail(`duplicate or malformed batch case ID ${id}`);
    }
  }

  const extendedById = new Map();
  for (const record of extended.records) {
    if (!plain(record) || !text(record.id) ||
        !/^SRC-API-(EDIT|AI|IMPORT)-[A-Z0-9-]+$/.test(record.id) ||
        !['extended', 'provisional'].includes(record.kind) ||
        !text(record.oracleReason) || !plain(record.selector) ||
        !hash(record.requestEventSha256)) fail('malformed extended record');
    if (extendedById.has(record.id)) fail(`duplicate extended ID ${record.id}`);
    extendedById.set(record.id, record);
  }
  if (batch.extendedContentSha256 !== fingerprint(extended)) {
    fail('extended register source drift');
  }

  const source = new Map();
  for (const name of BATCH_FOLDERS) {
    for (const item of folders.get(name).item) {
      const key = requestKey(name, item);
      if (source.has(key)) fail('duplicate source identity');
      source.set(key, item);
    }
  }
  const reviewed = new Map();
  const extendedCoverage = new Map([...extendedById.keys()].map(id => [id, []]));
  for (const node of batch.nodes) {
    if (!plain(node) || !CLASSES.has(node.classification)) {
      fail('unsupported classification or malformed reviewed node');
    }
    const key = edgeKey(node);
    if (reviewed.has(key)) fail('duplicate reviewed identity');
    if (!source.has(key)) fail('missing or changed reviewed request');
    if (!Array.isArray(node.caseIds) || !Array.isArray(node.extendedIds) ||
        !text(node.testMarker) || !text(node.oracleReason)) fail('malformed reviewed node');
    if (new Set(node.caseIds).size !== node.caseIds.length ||
        new Set(node.extendedIds).size !== node.extendedIds.length) {
      fail('duplicate case annotation');
    }
    for (const id of node.caseIds) {
      if (!Object.hasOwn(batch.caseRowSha256, id)) fail(`unknown or wrong-family case ID ${id}`);
      if (!SECTION_FOLDERS.get(sections.get(id))?.includes(node.selector.folder)) {
        fail(`wrong-family case link ${id}`);
      }
    }
    for (const id of node.extendedIds) {
      if (!extendedById.has(id)) fail(`unknown extended ID ${id}`);
      const expectedFolder = id.startsWith('SRC-API-EDIT-') ? '10 · Editing (D-029)' :
        id.startsWith('SRC-API-AI-') ? '11 · AI drafts and keyed saves (D-033–D-035)' :
          'Synthetic batch import (offline caller-supplied records)';
      if (node.selector.folder !== expectedFolder) fail(`wrong-family extended link ${id}`);
      if (['business_assertion', 'provisional_import'].includes(node.classification) &&
          edgeKey(extendedById.get(id)) !== key) fail(`extended source mismatch ${id}`);
    }
    if (!node.caseIds.length && !node.extendedIds.length) fail('unrelated setup/control node');
    if (node.classification === 'provisional_import' &&
        (!node.extendedIds.length || node.caseIds.length ||
         node.extendedIds.some(id => extendedById.get(id).kind !== 'provisional'))) {
      fail('provisional import classification mismatch');
    }
    if (node.classification === 'business_assertion' &&
        node.extendedIds.some(id => extendedById.get(id).kind !== 'extended')) {
      fail('extended business classification mismatch');
    }
    const scripts = source.get(key).event.flatMap(event => event?.script?.exec || []);
    if (!scripts.every(line => typeof line === 'string') ||
        !scripts.join('\n').includes(node.testMarker)) fail('missing assertion marker');
    reviewed.set(key, { ...node, status: 'SOURCE_LINK_DECLARED_ONLY' });
    if (['business_assertion', 'provisional_import'].includes(node.classification)) {
      for (const id of node.caseIds) mainCoverage.get(id).push(key);
      for (const id of node.extendedIds) extendedCoverage.get(id).push(key);
    }
  }
  for (const key of source.keys()) if (!reviewed.has(key)) fail('unreviewed source request');
  const reviewSignatures = [...reviewed.values()].map(node =>
    [edgeKey(node), reviewDigest(node)]).sort((a, b) => a[0].localeCompare(b[0], 'en'));
  if (fingerprint(reviewSignatures) !== batch.reviewedClassificationsSha256) {
    fail('reviewed source classification mismatch');
  }
  for (const [id, edges] of mainCoverage) if (!edges.length) fail(`case without assertion edge ${id}`);
  for (const [id, edges] of extendedCoverage) if (!edges.length) fail(`extended case without assertion edge ${id}`);
  if (reviewedAccepted.size !== 45 || source.size !== 226 ||
      reviewed.size !== 226) fail('API request accounting changed');

  const requests = [...reviewedAccepted.values(), ...reviewed.values()]
    .map(node => ({ selector: node.selector, requestEventSha256: node.requestEventSha256,
      classification: node.classification, caseIds: node.caseIds,
      extendedIds: node.extendedIds, oracleReason: node.oracleReason,
      status: 'SOURCE_LINK_DECLARED_ONLY' }))
    .sort((a, b) => edgeKey(a).localeCompare(edgeKey(b), 'en'));
  const cases = [...mainCoverage].map(([id, keys]) => ({ id, rowSha256: rows.get(id),
    requestKeys: keys.sort(), status: 'CATALOGUE_LINK_DECLARED_ONLY' }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const extendedCases = [...extendedCoverage].map(([id, keys]) => ({ id,
    kind: extendedById.get(id).kind, requestKeys: keys.sort(),
    status: 'LOCAL_SOURCE_DECLARATION_ONLY' }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const batchClasses = Object.fromEntries([...CLASSES].map(kind =>
    [kind, [...reviewed.values()].filter(node => node.classification === kind).length]));
  const allClasses = { ...batchClasses,
    business_assertion: batchClasses.business_assertion + reviewedAccepted.size };
  return { schemaVersion: 1, status: 'STATIC_SOURCE_INVENTORY',
    execution: 'NOT_RUN', otherLayers: 'NOT_CHECKED', apiOnly: true,
    completeApiAccounting: true,
    counts: { requests: requests.length, acceptedRequests: reviewedAccepted.size,
      batchRequests: reviewed.size, mainCases: cases.length,
      extendedCases: extendedCases.filter(row => row.kind === 'extended').length,
      provisionalCases: extendedCases.filter(row => row.kind === 'provisional').length,
      batchClasses, allClasses },
    gaps: { missingMainCases: [], unclassifiedRequests: [], missingExtendedCases: [] },
    requests, cases, extendedCases };
}

function buildInventory(root = ROOT) {
  const files = { collection: 'qa/api/wallet.postman_collection.json',
    catalogue: 'qa/docs/test-cases.md',
    acceptedHealth: 'qa/traceability/postman-health.json',
    acceptedToken: 'qa/traceability/postman-token.json',
    acceptedCategories: 'qa/traceability/postman-categories.json',
    acceptedTransactions: 'qa/traceability/postman-transactions.json',
    batch: 'qa/traceability/postman-api-batch.json',
    extended: 'qa/traceability/postman-api-extended-cases.json' };
  const raw = Object.fromEntries(Object.entries(files).map(([key, relative]) =>
    [key, fs.readFileSync(path.join(root, relative))]));
  const parse = key => JSON.parse(raw[key].toString('utf8'));
  const result = validateAggregate({ collection: parse('collection'),
    catalogue: raw.catalogue.toString('utf8'),
    acceptedMappings: ['acceptedHealth', 'acceptedToken', 'acceptedCategories',
      'acceptedTransactions'].map(parse), batch: parse('batch'), extended: parse('extended') });
  const sources = Object.fromEntries(Object.entries(files).map(([key, relative]) =>
    [key, { path: relative, sha256: H(raw[key]) }]));
  return { ...result, sources };
}

function checkInventory(saved, fresh) {
  try { assert.deepStrictEqual(saved, fresh); }
  catch { fail('generated artifact drift'); }
}

function assertOutputSeparate({ outputPath, inputPaths }) {
  if (!text(outputPath) || !Array.isArray(inputPaths) || !inputPaths.length) {
    fail('missing output/input path');
  }
  const canonical = value => {
    const resolved = path.resolve(value);
    const real = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    return process.platform === 'win32' ? real.toLowerCase() : real;
  };
  if (inputPaths.some(value => canonical(value) === canonical(outputPath))) {
    fail('output collides with source input');
  }
}

function main(argv) {
  if (argv.length > 1 || (argv.length && !['--write', '--check'].includes(argv[0]))) {
    fail('use no option, --check, or --write');
  }
  const fresh = buildInventory(ROOT);
  const outputPath = path.join(ROOT, 'qa/docs/postman-api-inventory.json');
  const inputPaths = [
    'qa/api/wallet.postman_collection.json', 'qa/docs/test-cases.md',
    ...ACCEPTED.map(([, file]) => `qa/traceability/${file}`),
    'qa/traceability/postman-api-batch.json',
    'qa/traceability/postman-api-extended-cases.json',
  ].map(relative => path.join(ROOT, relative));
  if (argv[0] === '--write') {
    assertOutputSeparate({ outputPath, inputPaths });
    fs.writeFileSync(outputPath, JSON.stringify(fresh, null, 2) + '\n');
    console.log(`Postman API inventory: ${fresh.counts.requests} requests; static only, NOT_RUN`);
  } else if (argv[0] === '--check') {
    checkInventory(JSON.parse(fs.readFileSync(outputPath, 'utf8')), fresh);
    console.log('Postman API inventory: current generated artifact matches sources');
  } else console.log(JSON.stringify(fresh, null, 2));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { validateAggregate, buildInventory, checkInventory,
  assertOutputSeparate, edgeKey, requestKey, reviewDigest, main };
