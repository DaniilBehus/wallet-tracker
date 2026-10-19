'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { validateSources, buildInventory } = require('../../scripts/postman-inventory');

const ROOT = path.join(__dirname, '..', '..');
const collectionPath = path.join(ROOT, 'qa/api/wallet.postman_collection.json');
const cataloguePath = path.join(ROOT, 'qa/docs/test-cases.md');
const mappingPath = path.join(ROOT, 'qa/traceability/postman-transactions.json');
const inventoryPath = path.join(ROOT, 'qa/docs/postman-transactions-inventory.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const catalogue = fs.readFileSync(cataloguePath, 'utf8');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const clone = value => structuredClone(value);
const fixture = () => ({ collection: clone(collection), catalogue, mapping: clone(mapping) });
const folder = data => data.item.find(item => item.name === mapping.scope.folder);
const request = (data, name) => {
  const item = folder(data).item.find(entry => entry.name === name);
  assert.ok(item, `source request ${name} exists`);
  return item;
};
const row = id => {
  const found = catalogue.split(/\r?\n/).find(line => line.startsWith(`| ${id} |`));
  assert.ok(found, `source row ${id} exists`);
  return found;
};

test('Transactions has 21 bidirectional declaration edges and fresh derived JSON', () => {
  const result = validateSources(fixture());
  assert.deepEqual(result.counts, { requests: 21, cases: 21, edges: 21 });
  assert.deepEqual(result.gaps, { declaredOnly: [], sourceOnly: [] });
  assert.equal(result.status, 'PARTIAL_STATIC_SOURCE_INVENTORY');
  assert.equal(result.execution, 'NOT_RUN');
  assert.equal(result.otherLayers, 'NOT_CHECKED');
  const fresh = buildInventory({ collectionPath, cataloguePath, mappingPath, root: ROOT });
  const saved = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  assert.deepEqual(saved, fresh, 'generated inventory must match current source bytes and mapping');
});

test('unknown/nonfamily IDs and missing edge/row fail closed', () => {
  const unknown = fixture();
  unknown.mapping.edges[0].caseIds = ['TC-API-999'];
  assert.throws(() => validateSources(unknown), /unknown catalogue ID TC-API-999/i);

  const nonfamily = fixture();
  nonfamily.mapping.edges[0].caseIds = ['TC-API-015'];
  assert.throws(() => validateSources(nonfamily), /nonpilot ID outside pilot section/i);

  const missingEdge = fixture();
  missingEdge.mapping.edges.shift();
  assert.throws(() => validateSources(missingEdge), /unclassified extra request/i);

  const missingRow = fixture();
  missingRow.catalogue = missingRow.catalogue.replace(row('TC-API-022'), '');
  assert.throws(() => validateSources(missingRow), /missing or deleted catalogue row TC-API-022/i);
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
  added.name = 'Unreviewed Transactions request';
  folder(extra.collection).item.push(added);
  assert.throws(() => validateSources(extra), /unclassified extra request/i);
});

test('money JSON type, ceiling fixture and response assertion drift fail', () => {
  const moneyType = fixture();
  request(moneyType.collection, 'POST /transactions amount_cents as a string → 400').request.body.raw =
    '{"amount_cents":1250,"category_id":{{catA}}}';
  assert.throws(() => validateSources(moneyType), /request\/event fingerprint changed/i);

  const ceiling = fixture();
  ceiling.collection.variable.find(entry => entry.key === 'ceiling').value = '100000001';
  assert.throws(() => validateSources(ceiling), /collection helper\/context fingerprint changed/i);

  const assertion = fixture();
  const item = request(assertion.collection, 'POST /transactions amount_cents = ceiling → 201');
  item.event[0].script.exec = item.event[0].script.exec.map(line =>
    line.replace('to.eql(100000000)', 'to.eql(99999999)'));
  assert.throws(() => validateSources(assertion), /request\/event fingerprint changed/i);
});

test('future-date construction, tokenB authorization and raw query URL drift fail', () => {
  const date = fixture();
  const future = request(date.collection, 'POST /transactions spent_on far in the future → 400');
  future.event[0].script.exec = future.event[0].script.exec.map(line =>
    line.replace('getDate() + 30', 'getDate() + 1'));
  assert.throws(() => validateSources(date), /request\/event fingerprint changed/i);

  const auth = fixture();
  request(auth.collection, "DELETE /transactions/:id another user's row → 404, not 403")
    .request.auth.bearer[0].value = '{{token}}';
  assert.throws(() => validateSources(auth), /request\/event fingerprint changed/i);

  const query = fixture();
  request(query.collection, 'GET /transactions?limit=201 → 400').request.url.raw =
    '{{baseUrl}}/api/transactions?limit=200';
  assert.throws(() => validateSources(query), /missing, moved or deleted request/i);
});

test('status, no-403 assertion and shared helper drift fail', () => {
  const status = fixture();
  const malformed = request(status.collection, 'POST /transactions broken JSON → 400, not 500');
  malformed.event[0].script.exec = malformed.event[0].script.exec.map(line =>
    line.replace('expectError(400', 'expectError(500'));
  assert.throws(() => validateSources(status), /request\/event fingerprint changed/i);

  const forbidden = fixture();
  const foreign = request(forbidden.collection, "DELETE /transactions/:id another user's row → 404, not 403");
  foreign.event[0].script.exec = foreign.event[0].script.exec.filter(line => line !== 'expectNotForbidden();');
  assert.throws(() => validateSources(forbidden), /request\/event fingerprint changed/i);

  const helper = fixture();
  const script = helper.collection.event[0].script.exec;
  const index = script.findIndex(line => line.includes('function expectError(code, errCode)'));
  assert.ok(index >= 0);
  script[index] = script[index].replace('expectError(code, errCode)', 'expectError(code)');
  assert.throws(() => validateSources(helper), /collection helper\/context fingerprint changed/i);
});

test('duplicate selector/annotation and malformed or empty inputs fail', () => {
  const selector = fixture();
  selector.mapping.edges.push(clone(selector.mapping.edges[0]));
  assert.throws(() => validateSources(selector), /duplicate or conflicting request selector/i);

  const annotation = fixture();
  annotation.mapping.edges[0].caseIds.push('TC-API-022');
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
  assert.deepEqual(validateSources(reordered).counts, { requests: 21, cases: 21, edges: 21 });

  const crlf = fixture();
  crlf.catalogue = crlf.catalogue.replace(/\r?\n/g, '\r\n');
  assert.equal(validateSources(crlf).counts.cases, 21);

  const many = fixture();
  const second = clone(folder(many.collection).item[0]);
  second.name = 'Alternate verified Transactions request';
  folder(many.collection).item.push(second);
  const edge = clone(many.mapping.edges[0]);
  edge.selector.name = second.name;
  many.mapping.edges.push(edge);
  assert.deepEqual(validateSources(many).counts, { requests: 22, cases: 21, edges: 22 });
});
