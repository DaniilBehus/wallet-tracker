#!/usr/bin/env node
'use strict';

// Bounded JSON-native source inventory for one reviewed Postman folder. This
// does not execute Newman, parse arbitrary Markdown or certify all Wallet QA.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const fingerprint = value => sha256(JSON.stringify(value));
const hashOk = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;

function fail(message) { throw new Error(`Postman pilot inventory: ${message}`); }

function parseCatalogue(markdown, heading) {
  if (!text(markdown) || !text(heading)) fail('catalogue and section heading required');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const starts = lines.flatMap((line, index) => line === heading ? [index] : []);
  if (starts.length !== 1) fail('missing or ambiguous pilot catalogue section');
  const start = starts[0];
  let end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  if (end < 0) fail('missing pilot catalogue section boundary');

  const known = new Set();
  const scoped = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('|')) continue;
    const first = line.match(/^\|\s*([^|]+?)\s*\|/);
    if (!first) {
      if (index > start && index < end) fail('malformed first-cell catalogue row');
      continue;
    }
    const cell = first[1].trim();
    if (cell === 'ID' || /^-+:?-*$/.test(cell)) continue;
    if (!/^TC-[A-Z0-9]+-\d{3}$/.test(cell)) {
      // Other tables are outside the pilot, but a TC-shaped first cell is an
      // active case candidate anywhere; silently omitting it corrupts the
      // whole-catalogue known-ID set used to reject unknown metadata IDs.
      if (cell.startsWith('TC-') || (index > start && index < end)) {
        fail(`malformed active ID in first cell: ${cell}`);
      }
      continue; // Non-case/service tables remain outside this bounded parser.
    }
    if (known.has(cell)) fail(`duplicate catalogue ID ${cell}`);
    known.add(cell);
    if (index > start && index < end) scoped.set(cell, sha256(line));
  }
  if (!scoped.size) fail('empty pilot catalogue section');
  return { known, scoped };
}

function selector(folder, item) {
  const request = item?.request;
  const rawUrl = request?.url?.raw;
  if (!text(item?.name) || !text(request?.method) || !text(rawUrl) ||
      !Array.isArray(item.event) || !item.event.length || item.item !== undefined) {
    fail('malformed or unsupported request in exact pilot folder');
  }
  return { folder, name: item.name, method: request.method, rawUrl };
}

function selectorKey(value) {
  if (!plain(value) || !['folder', 'name', 'method', 'rawUrl'].every(key => text(value[key]))) {
    fail('malformed request selector');
  }
  return JSON.stringify([value.folder, value.name, value.method, value.rawUrl]);
}

function collectionContext(collection, folder) {
  return {
    collectionEvent: collection.event || null,
    collectionVariable: collection.variable || null,
    collectionAuth: collection.auth || null,
    folderEvent: folder.event || null,
    folderAuth: folder.auth || null,
  };
}

function validateSources({ collection, catalogue, mapping } = {}) {
  if (!plain(mapping) || mapping.schemaVersion !== 1 || !plain(mapping.scope) ||
      !text(mapping.scope.folder) || !text(mapping.scope.catalogueSection) ||
      !hashOk(mapping.scope.collectionContextSha256) ||
      !plain(mapping.caseRowSha256) || !Array.isArray(mapping.edges) || !mapping.edges.length) {
    fail('missing or malformed mapping scope, cases or edges');
  }
  if (!plain(collection) || !Array.isArray(collection.item)) fail('missing collection item list');
  const folders = collection.item.filter(item => item?.name === mapping.scope.folder);
  if (folders.length !== 1 || !Array.isArray(folders[0].item) || !folders[0].item.length) {
    fail('missing, ambiguous or empty exact pilot folder');
  }
  const folder = folders[0];
  if (fingerprint(collectionContext(collection, folder)) !== mapping.scope.collectionContextSha256) {
    fail('collection helper/context fingerprint changed');
  }
  const { known, scoped } = parseCatalogue(catalogue, mapping.scope.catalogueSection);
  const expectedCases = Object.keys(mapping.caseRowSha256);
  if (!expectedCases.length) fail('empty reviewed case set');
  for (const id of expectedCases) {
    if (!hashOk(mapping.caseRowSha256[id])) fail(`malformed reviewed row fingerprint for ${id}`);
    if (!scoped.has(id)) fail(`missing or deleted catalogue row ${id}`);
    if (scoped.get(id) !== mapping.caseRowSha256[id]) fail(`catalogue row fingerprint changed for ${id}`);
  }
  for (const id of scoped.keys()) {
    if (!Object.hasOwn(mapping.caseRowSha256, id)) fail(`unreviewed active catalogue row ${id}`);
  }

  const requests = new Map();
  for (const item of folder.item) {
    const selected = selector(mapping.scope.folder, item);
    const key = selectorKey(selected);
    if (requests.has(key)) fail(`duplicate current request selector ${selected.name}`);
    requests.set(key, { selected, item });
  }
  const edges = new Map();
  const caseToRequests = new Map([...scoped.keys()].map(id => [id, []]));
  for (const edge of mapping.edges) {
    if (!plain(edge) || !plain(edge.selector) ||
        edge.selector.folder !== mapping.scope.folder ||
        !hashOk(edge.requestEventSha256) || !text(edge.testMarker) ||
        !text(edge.oracleReason) || !Array.isArray(edge.caseIds) || !edge.caseIds.length) {
      fail('malformed reviewed request edge');
    }
    const key = selectorKey(edge.selector);
    if (edges.has(key)) fail(`duplicate or conflicting request selector ${edge.selector.name}`);
    edges.set(key, edge);
    const source = requests.get(key);
    if (!source) fail(`missing, moved or deleted request ${edge.selector.name}`);
    if (fingerprint({ request: source.item.request, event: source.item.event }) !== edge.requestEventSha256) {
      fail(`request/event fingerprint changed for ${edge.selector.name}`);
    }
    const scripts = source.item.event.flatMap(event => event?.script?.exec || []);
    if (!scripts.every(line => typeof line === 'string') ||
        !scripts.join('\n').includes(edge.testMarker)) {
      fail(`reviewed assertion marker missing for ${edge.selector.name}`);
    }
    const uniqueIds = new Set();
    for (const id of edge.caseIds) {
      if (!text(id) || uniqueIds.has(id)) fail(`duplicate or malformed case annotation in ${edge.selector.name}`);
      uniqueIds.add(id);
      if (!known.has(id)) fail(`unknown catalogue ID ${id}`);
      if (!scoped.has(id)) fail(`nonpilot ID outside pilot section ${id}`);
      caseToRequests.get(id).push(edge.selector);
    }
  }
  for (const { selected } of requests.values()) {
    if (!edges.has(selectorKey(selected))) fail(`unclassified extra request ${selected.name}`);
  }
  for (const [id, selected] of caseToRequests) {
    if (!selected.length) fail(`declared-only pilot case has no request edge ${id}`);
  }
  const sourceRows = [...edges.values()].map(edge => ({
    selector: edge.selector,
    requestEventSha256: edge.requestEventSha256,
    caseIds: [...edge.caseIds],
    oracleReason: edge.oracleReason,
    status: 'SOURCE_LINK_DECLARED_ONLY',
  })).sort((a, b) => selectorKey(a.selector).localeCompare(selectorKey(b.selector), 'en'));
  const caseRows = [...caseToRequests].map(([id, selected]) => ({
    id, rowSha256: scoped.get(id),
    requests: selected.sort((a, b) => selectorKey(a).localeCompare(selectorKey(b), 'en')),
    status: 'CATALOGUE_LINK_DECLARED_ONLY',
  })).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return {
    schemaVersion: 1,
    status: 'PARTIAL_STATIC_SOURCE_INVENTORY',
    execution: 'NOT_RUN',
    otherLayers: 'NOT_CHECKED',
    scope: { folder: mapping.scope.folder, catalogueSection: mapping.scope.catalogueSection,
      note: 'Only this reviewed Postman folder and matching catalogue section' },
    counts: { requests: requests.size, cases: scoped.size,
      edges: sourceRows.reduce((sum, row) => sum + row.caseIds.length, 0) },
    gaps: { declaredOnly: [], sourceOnly: [] },
    requests: sourceRows,
    cases: caseRows,
  };
}

function buildInventory({ collectionPath, cataloguePath, mappingPath, root = process.cwd() }) {
  const sourcePaths = { collection: collectionPath, catalogue: cataloguePath, mapping: mappingPath };
  for (const key of Object.keys(sourcePaths)) if (!text(sourcePaths[key])) fail(`missing ${key} path`);
  const raw = Object.fromEntries(Object.entries(sourcePaths).map(([key, value]) =>
    [key, fs.readFileSync(value)]));
  let collection, mapping;
  try {
    collection = JSON.parse(raw.collection.toString('utf8'));
    mapping = JSON.parse(raw.mapping.toString('utf8'));
  } catch (error) { fail(`invalid JSON input: ${error.message}`); }
  const result = validateSources({ collection, catalogue: raw.catalogue.toString('utf8'), mapping });
  const sources = Object.fromEntries(Object.entries(sourcePaths).map(([key, value]) => {
    const relative = path.relative(root, path.resolve(value)).replace(/\\/g, '/');
    return [key, { path: relative.startsWith('../') || path.isAbsolute(relative)
      ? path.basename(value) : relative, sha256: sha256(raw[key]) }];
  }));
  return { ...result, sources };
}

function assertOutputSeparate({ collectionPath, cataloguePath, mappingPath, outputPath }) {
  if (!text(outputPath)) fail('missing explicit output path');
  const canonical = value => {
    const resolved = path.resolve(value);
    const actual = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    return process.platform === 'win32' ? actual.toLowerCase() : actual;
  };
  const target = canonical(outputPath);
  for (const source of [collectionPath, cataloguePath, mappingPath]) {
    if (target === canonical(source)) fail('output path must not overwrite an input source');
  }
}

function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--collection', '--catalogue', '--mapping', '--output'].includes(key) ||
        !text(value) || Object.hasOwn(options, key)) fail('invalid, repeated or missing CLI option');
    options[key] = value;
  }
  if (!['--collection', '--catalogue', '--mapping'].every(key => text(options[key]))) {
    fail('explicit collection, catalogue and mapping paths are required');
  }
  const inventory = buildInventory({
    collectionPath: options['--collection'],
    cataloguePath: options['--catalogue'],
    mappingPath: options['--mapping'],
    root: process.cwd(),
  });
  if (options['--output']) {
    assertOutputSeparate({ collectionPath: options['--collection'],
      cataloguePath: options['--catalogue'], mappingPath: options['--mapping'],
      outputPath: options['--output'] });
    if (!fs.existsSync(path.dirname(options['--output']))) fail('output parent does not exist');
    fs.writeFileSync(options['--output'], JSON.stringify(inventory, null, 2) + '\n');
    console.log(`Postman pilot inventory: ${inventory.counts.requests} requests, ${inventory.counts.cases} cases, ${inventory.counts.edges} edges; static only, NOT_RUN`);
  } else console.log(JSON.stringify(inventory, null, 2));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { validateSources, buildInventory, parseCatalogue, assertOutputSeparate, main };
