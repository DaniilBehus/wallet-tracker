'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { validateSources, buildInventory } = require('../../scripts/postman-inventory');

const ROOT = path.join(__dirname, '..', '..');
const collectionPath = path.join(ROOT, 'qa/api/wallet.postman_collection.json');
const cataloguePath = path.join(ROOT, 'qa/docs/test-cases.md');
const mappingPath = path.join(ROOT, 'qa/traceability/postman-token.json');
const inventoryPath = path.join(ROOT, 'qa/docs/postman-token-inventory.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const catalogue = fs.readFileSync(cataloguePath, 'utf8');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const clone = value => structuredClone(value);
const fixture = () => ({ collection: clone(collection), catalogue, mapping: clone(mapping) });
const folder = data => data.item.find(item => item.name === mapping.scope.folder);
const row = id => {
  const found = catalogue.split(/\r?\n/).find(line => line.startsWith(`| ${id} |`));
  assert.ok(found, `source row ${id} exists`);
  return found;
};

test('Token handling has five bidirectional declaration edges and fresh derived JSON', () => {
  const result = validateSources(fixture());
  assert.deepEqual(result.counts, { requests: 5, cases: 5, edges: 5 });
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
  missingRow.catalogue = missingRow.catalogue.replace(row('TC-API-010'), '');
  assert.throws(() => validateSources(missingRow), /missing or deleted catalogue row TC-API-010/i);
});

test('removed/moved request and changed Authorization header are detected', () => {
  const removed = fixture();
  folder(removed.collection).item.shift();
  assert.throws(() => validateSources(removed), /missing, moved or deleted request/i);

  const moved = fixture();
  const item = folder(moved.collection).item.shift();
  moved.collection.item.find(entry => entry.name !== mapping.scope.folder).item.push(item);
  assert.throws(() => validateSources(moved), /missing, moved or deleted request/i);

  const changed = fixture();
  folder(changed.collection).item[1].request.header[0].value = 'Bearer {{token}}';
  assert.throws(() => validateSources(changed), /request\/event fingerprint changed/i);
});

test('corruption prerequest and expiration oracle drift fail by full event fingerprint', () => {
  const corruption = fixture();
  const corruptRequest = folder(corruption.collection).item.find(item => item.name === 'Corrupted token → 401');
  const corruptLine = corruptRequest.event[0].script.exec.findIndex(value => value.includes("set('tokenCorrupt'"));
  assert.ok(corruptLine >= 0);
  corruptRequest.event[0].script.exec[corruptLine] = "pm.collectionVariables.set('tokenCorrupt', token);";
  assert.throws(() => validateSources(corruption), /request\/event fingerprint changed/i);

  const expiration = fixture();
  const expiredRequest = folder(expiration.collection).item.find(item => item.name === 'Expired token → 401');
  const line = expiredRequest.event[0].script.exec.findIndex(value => value.includes('to.be.below(Date.now())'));
  assert.ok(line >= 0);
  expiredRequest.event[0].script.exec[line] = expiredRequest.event[0].script.exec[line]
    .replace('to.be.below(Date.now())', 'to.be.above(Date.now())');
  assert.throws(() => validateSources(expiration), /request\/event fingerprint changed/i);
});

test('duplicate selector/annotation and malformed or empty inputs fail', () => {
  const selector = fixture();
  selector.mapping.edges.push(clone(selector.mapping.edges[0]));
  assert.throws(() => validateSources(selector), /duplicate or conflicting request selector/i);

  const annotation = fixture();
  annotation.mapping.edges[0].caseIds.push('TC-API-010');
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
  assert.deepEqual(validateSources(reordered).counts, { requests: 5, cases: 5, edges: 5 });

  const crlf = fixture();
  crlf.catalogue = crlf.catalogue.replace(/\r?\n/g, '\r\n');
  assert.equal(validateSources(crlf).counts.cases, 5);

  const many = fixture();
  const second = clone(folder(many.collection).item[0]);
  second.name = 'No token alternate verified request → 401';
  folder(many.collection).item.push(second);
  const edge = clone(many.mapping.edges[0]);
  edge.selector.name = second.name;
  many.mapping.edges.push(edge);
  assert.deepEqual(validateSources(many).counts, { requests: 6, cases: 5, edges: 6 });
});
