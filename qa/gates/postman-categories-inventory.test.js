'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { validateSources, buildInventory } = require('../../scripts/postman-inventory');

const ROOT = path.join(__dirname, '..', '..');
const collectionPath = path.join(ROOT, 'qa/api/wallet.postman_collection.json');
const cataloguePath = path.join(ROOT, 'qa/docs/test-cases.md');
const mappingPath = path.join(ROOT, 'qa/traceability/postman-categories.json');
const inventoryPath = path.join(ROOT, 'qa/docs/postman-categories-inventory.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const catalogue = fs.readFileSync(cataloguePath, 'utf8');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const clone = value => structuredClone(value);
const fixture = () => ({ collection: clone(collection), catalogue, mapping: clone(mapping) });
const folder = data => data.item.find(item => item.name === mapping.scope.folder);
const request = (data, name) => folder(data).item.find(item => item.name === name);
const row = id => {
  const found = catalogue.split(/\r?\n/).find(line => line.startsWith(`| ${id} |`));
  assert.ok(found, `source row ${id} exists`);
  return found;
};

test('Categories has seven bidirectional declaration edges and fresh derived JSON', () => {
  const result = validateSources(fixture());
  assert.deepEqual(result.counts, { requests: 7, cases: 7, edges: 7 });
  assert.deepEqual(result.gaps, { declaredOnly: [], sourceOnly: [] });
  assert.equal(result.status, 'PARTIAL_STATIC_SOURCE_INVENTORY');
  assert.equal(result.execution, 'NOT_RUN');
  assert.equal(result.otherLayers, 'NOT_CHECKED');
  const fresh = buildInventory({ collectionPath, cataloguePath, mappingPath, root: ROOT });
  const saved = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  assert.deepEqual(saved, fresh, 'generated inventory must match current source bytes and mapping');
});

test('unknown/nonpilot annotation and missing edge/row fail closed', () => {
  const unknown = fixture();
  unknown.mapping.edges[0].caseIds = ['TC-API-999'];
  assert.throws(() => validateSources(unknown), /unknown catalogue ID TC-API-999/i);

  const nonpilot = fixture();
  nonpilot.mapping.edges[0].caseIds = ['TC-API-001'];
  assert.throws(() => validateSources(nonpilot), /nonpilot ID outside pilot section/i);

  const missingEdge = fixture();
  missingEdge.mapping.edges.shift();
  assert.throws(() => validateSources(missingEdge), /unclassified extra request/i);

  const missingRow = fixture();
  missingRow.catalogue = missingRow.catalogue.replace(row('TC-API-015'), '');
  assert.throws(() => validateSources(missingRow), /missing or deleted catalogue row TC-API-015/i);
});

test('removed, moved and extra requests fail closed', () => {
  const removed = fixture();
  folder(removed.collection).item.shift();
  assert.throws(() => validateSources(removed), /missing, moved or deleted request/i);

  const moved = fixture();
  const item = folder(moved.collection).item.shift();
  moved.collection.item.find(entry => entry.name !== mapping.scope.folder).item.push(item);
  assert.throws(() => validateSources(moved), /missing, moved or deleted request/i);

  const extra = fixture();
  const added = clone(folder(extra.collection).item[0]);
  added.name = 'Unreviewed Categories request';
  folder(extra.collection).item.push(added);
  assert.throws(() => validateSources(extra), /unclassified extra request/i);
});

test('tokenB auth, create body and response assertions are fingerprinted', () => {
  const auth = fixture();
  request(auth.collection, 'GET /categories as user B → different ids').request.auth.bearer[0].value = '{{token}}';
  assert.throws(() => validateSources(auth), /request\/event fingerprint changed/i);

  const body = fixture();
  request(body.collection, 'POST /categories → 201').request.body.raw = '{"name":"QA fixed","icon":"🧪"}';
  assert.throws(() => validateSources(body), /request\/event fingerprint changed/i);

  const response = fixture();
  const duplicate = request(response.collection, 'POST /categories duplicate name → 409');
  duplicate.event[0].script.exec = duplicate.event[0].script.exec.map(line =>
    line.replace('expectError(409', 'expectError(201'));
  assert.throws(() => validateSources(response), /request\/event fingerprint changed/i);
});

test('three-space body and 61/60-character boundary scripts are fingerprinted', () => {
  const blank = fixture();
  request(blank.collection, 'POST /categories empty name → 400').request.body.raw = '{"name":""}';
  assert.throws(() => validateSources(blank), /request\/event fingerprint changed/i);

  const over = fixture();
  const name61 = request(over.collection, 'POST /categories name of 61 characters → 400');
  name61.event[0].script.exec = name61.event[0].script.exec.map(line => line.replace('repeat(61)', 'repeat(60)'));
  assert.throws(() => validateSources(over), /request\/event fingerprint changed/i);

  const boundary = fixture();
  const name60 = request(boundary.collection, 'POST /categories name of exactly 60 → 201');
  name60.event[0].script.exec = name60.event[0].script.exec.map(line => line.replace('padEnd(60', 'padEnd(59'));
  assert.throws(() => validateSources(boundary), /request\/event fingerprint changed/i);

  const assertion = fixture();
  const stored = request(assertion.collection, 'POST /categories name of exactly 60 → 201');
  stored.event[1].script.exec = stored.event[1].script.exec.map(line => line.replace('lengthOf(60)', 'lengthOf(59)'));
  assert.throws(() => validateSources(assertion), /request\/event fingerprint changed/i);
});

test('duplicate selectors/annotations and malformed or empty inputs fail', () => {
  const selector = fixture();
  selector.mapping.edges.push(clone(selector.mapping.edges[0]));
  assert.throws(() => validateSources(selector), /duplicate or conflicting request selector/i);

  const annotation = fixture();
  annotation.mapping.edges[0].caseIds.push('TC-API-015');
  assert.throws(() => validateSources(annotation), /duplicate or malformed case annotation/i);

  assert.throws(() => validateSources({ ...fixture(), mapping: {} }), /missing or malformed mapping/i);
  assert.throws(() => validateSources({ ...fixture(), collection: {} }), /missing collection item list/i);
  assert.throws(() => validateSources({ ...fixture(), catalogue: '' }), /catalogue and section heading required/i);
  const emptyFolder = fixture();
  folder(emptyFolder.collection).item = [];
  assert.throws(() => validateSources(emptyFolder), /empty exact pilot folder/i);
});

test('reorder, CRLF and legitimate many-to-one request edges remain valid', () => {
  const reordered = fixture();
  folder(reordered.collection).item.reverse();
  assert.deepEqual(validateSources(reordered).counts, { requests: 7, cases: 7, edges: 7 });

  const crlf = fixture();
  crlf.catalogue = crlf.catalogue.replace(/\r?\n/g, '\r\n');
  assert.equal(validateSources(crlf).counts.cases, 7);

  const many = fixture();
  const second = clone(folder(many.collection).item[0]);
  second.name = 'Alternate verified Categories request';
  folder(many.collection).item.push(second);
  const edge = clone(many.mapping.edges[0]);
  edge.selector.name = second.name;
  many.mapping.edges.push(edge);
  assert.deepEqual(validateSources(many).counts, { requests: 8, cases: 7, edges: 8 });
});
