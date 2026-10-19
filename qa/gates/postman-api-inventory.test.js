'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const api = require('../../scripts/postman-api-inventory');

const ROOT = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const collection = JSON.parse(read('qa/api/wallet.postman_collection.json'));
const catalogue = read('qa/docs/test-cases.md');
const acceptedMappings = [
  'postman-health.json', 'postman-token.json', 'postman-categories.json',
  'postman-transactions.json',
].map(name => JSON.parse(read(`qa/traceability/${name}`)));
const batch = JSON.parse(read('qa/traceability/postman-api-batch.json'));
const extended = JSON.parse(read('qa/traceability/postman-api-extended-cases.json'));
const clone = value => structuredClone(value);
const fixture = () => ({ collection: clone(collection), catalogue,
  acceptedMappings: clone(acceptedMappings), batch: clone(batch), extended: clone(extended) });
const folder = (data, name) => data.item.find(item => item.name === name);
const category = '13 · Category spending limits';
const editing = '10 · Editing (D-029)';

test('one API-only inventory accounts for all 271 requests and all 141 catalogue rows', () => {
  const result = api.validateAggregate(fixture());
  assert.equal(result.status, 'STATIC_SOURCE_INVENTORY');
  assert.equal(result.execution, 'NOT_RUN');
  assert.equal(result.otherLayers, 'NOT_CHECKED');
  assert.equal(result.counts.requests, 271);
  assert.equal(result.counts.acceptedRequests, 45);
  assert.equal(result.counts.batchRequests, 226);
  assert.equal(result.counts.mainCases, 141);
  assert.deepEqual(result.gaps, { missingMainCases: [], unclassifiedRequests: [],
    missingExtendedCases: [] });
  assert.equal(result.completeApiAccounting, true);
  const fresh = api.buildInventory(ROOT);
  const saved = JSON.parse(read('qa/docs/postman-api-inventory.json'));
  assert.deepEqual(saved, fresh);
});

test('deleted, moved, extra and changed source requests fail closed', () => {
  const deleted = fixture();
  folder(deleted.collection, editing).item.shift();
  assert.throws(() => api.validateAggregate(deleted), /missing or changed reviewed request/i);

  const moved = fixture();
  const item = folder(moved.collection, editing).item.shift();
  folder(moved.collection, category).item.push(item);
  assert.throws(() => api.validateAggregate(moved), /missing or changed reviewed request|unreviewed source request/i);

  const extra = fixture();
  const added = clone(folder(extra.collection, editing).item[0]);
  added.name = 'unreviewed extra';
  folder(extra.collection, editing).item.push(added);
  assert.throws(() => api.validateAggregate(extra), /unreviewed source request/i);

  const changed = fixture();
  folder(changed.collection, category).item.find(item => item.name ===
    'TC-API-120 · invalid value refused').request.body.raw = '{"monthly_limit_cents":0}';
  assert.throws(() => api.validateAggregate(changed), /missing or changed reviewed request/i);
});

test('body, authorization, prerequest, assertion and shared helper drift fail', () => {
  const body = fixture();
  folder(body.collection, editing).item.find(item => item.name ===
    'PATCH /transactions/:id note null clears it').request.body.raw = '{"note":""}';
  assert.throws(() => api.validateAggregate(body), /missing or changed reviewed request/i);

  const auth = fixture();
  folder(auth.collection, category).item.find(item => item.name ===
    'TC-API-124 · foreign category refuses update').request.auth.bearer[0].value = '{{clToken}}';
  assert.throws(() => api.validateAggregate(auth), /missing or changed reviewed request/i);

  const pre = fixture();
  const ai = folder(pre.collection, '11 · AI drafts and keyed saves (D-033–D-035)')
    .item.find(item => item.name === 'POST /transactions with a body over the parser limit → 413, not 500 (BUG-019)');
  ai.event[0].script.exec = ai.event[0].script.exec.map(line =>
    line.replace('120 * 1024', '10 * 1024'));
  assert.throws(() => api.validateAggregate(pre), /missing or changed reviewed request/i);

  const assertion = fixture();
  const item = folder(assertion.collection, category).item.find(entry =>
    entry.name === 'TC-API-141 · oversized category body is 413');
  item.event.at(-1).script.exec = item.event.at(-1).script.exec.map(line =>
    line.replace('expectError(413', 'expectError(400'));
  assert.throws(() => api.validateAggregate(assertion), /missing or changed reviewed request/i);

  const helper = fixture();
  helper.collection.event[0].script.exec[0] += ' // changed';
  assert.throws(() => api.validateAggregate(helper),
    /collection context changed|collection helper\/context fingerprint changed/i);
});

test('missing/conflicting edges, unknown IDs and duplicate catalogue/register/mapping IDs fail', () => {
  const edge = fixture();
  edge.batch.nodes.shift();
  assert.throws(() => api.validateAggregate(edge), /unreviewed source request/i);

  const conflict = fixture();
  conflict.batch.nodes.push(clone(conflict.batch.nodes[0]));
  assert.throws(() => api.validateAggregate(conflict), /duplicate reviewed identity/i);

  const unknown = fixture();
  unknown.batch.nodes.find(node => node.classification === 'business_assertion' && node.caseIds.length)
    .caseIds = ['TC-API-999'];
  assert.throws(() => api.validateAggregate(unknown), /unknown or wrong-family case ID/i);

  const wrongFamily = fixture();
  wrongFamily.batch.nodes.find(node => node.selector.folder === category &&
    node.classification === 'business_assertion').caseIds = ['TC-API-043'];
  assert.throws(() => api.validateAggregate(wrongFamily), /wrong-family case link/i);

  const duplicateRow = fixture();
  const line = duplicateRow.catalogue.split(/\r?\n/).find(value => value.startsWith('| TC-API-114 |'));
  duplicateRow.catalogue += '\n' + line + '\n';
  assert.throws(() => api.validateAggregate(duplicateRow), /duplicate catalogue ID/i);

  const duplicateRegister = fixture();
  duplicateRegister.extended.records.push(clone(duplicateRegister.extended.records[0]));
  assert.throws(() => api.validateAggregate(duplicateRegister), /duplicate extended ID/i);

  const duplicateAccepted = fixture();
  duplicateAccepted.acceptedMappings.push(clone(duplicateAccepted.acceptedMappings[0]));
  assert.throws(() => api.validateAggregate(duplicateAccepted), /four accepted mappings/i);
});

test('setup/control nodes cannot silently disappear or masquerade as case proof', () => {
  const unclassified = fixture();
  const setup = unclassified.batch.nodes.find(node => node.classification === 'case_arrange');
  assert.ok(setup);
  setup.classification = 'skip';
  assert.throws(() => api.validateAggregate(unclassified), /unsupported classification/i);

  const promoted = fixture();
  promoted.batch.nodes.find(node => node.classification === 'case_arrange').classification =
    'business_assertion';
  assert.throws(() => api.validateAggregate(promoted), /reviewed source classification mismatch|missing assertion marker/i);

  const deleted = fixture();
  const control = deleted.batch.nodes.find(node => node.classification === 'case_cleanup');
  assert.ok(control);
  const source = folder(deleted.collection, control.selector.folder);
  source.item = source.item.filter(item => api.requestKey(control.selector.folder, item) !==
    api.edgeKey(control));
  assert.throws(() => api.validateAggregate(deleted), /missing or changed reviewed request/i);
});

test('same display name with different bodies is represented by distinct full identities', () => {
  const result = api.validateAggregate(fixture());
  const repeated = result.requests.filter(node => node.selector.folder === category &&
    node.selector.name === 'TC-API-119 · empty/unknown/server-owned PATCH refused');
  assert.equal(repeated.length, 6);
  assert.equal(new Set(repeated.map(api.edgeKey)).size, 6);
  const altered = fixture();
  const rows = folder(altered.collection, category).item.filter(item =>
    item.name === 'TC-API-119 · empty/unknown/server-owned PATCH refused');
  rows[1].request.body.raw = rows[0].request.body.raw;
  assert.throws(() => api.validateAggregate(altered), /duplicate source identity|missing or changed reviewed request/i);
});

test('many requests per case, multiple cases per request, reorder and CRLF are valid', () => {
  const baseline = api.validateAggregate(fixture());
  assert.ok(baseline.cases.find(row => row.id === 'TC-API-119').requestKeys.length > 1);
  assert.equal(baseline.requests.find(node => node.selector.name ===
    'One attempt past the limit → 429 with Retry-After').caseIds.length, 2);
  const reordered = fixture();
  reordered.collection.item.reverse();
  for (const entry of reordered.collection.item) entry.item.reverse();
  reordered.batch.nodes.reverse();
  assert.equal(api.validateAggregate(reordered).counts.requests, 271);
  const crlf = fixture();
  crlf.catalogue = crlf.catalogue.replace(/\r?\n/g, '\r\n');
  assert.equal(api.validateAggregate(crlf).counts.mainCases, 141);
});

test('empty/malformed/nested inputs, artifact drift and output collision fail', () => {
  assert.throws(() => api.validateAggregate({ ...fixture(), collection: {} }), /missing collection folders/i);
  assert.throws(() => api.validateAggregate({ ...fixture(), batch: {} }), /malformed batch manifest/i);
  assert.throws(() => api.validateAggregate({ ...fixture(), extended: {} }), /malformed extended register/i);
  const empty = fixture();
  folder(empty.collection, category).item = [];
  assert.throws(() => api.validateAggregate(empty), /missing or changed reviewed request|empty reviewed folder/i);
  const nested = fixture();
  folder(nested.collection, category).item[0].item = [];
  assert.throws(() => api.validateAggregate(nested), /nested or unsupported request/i);
  const fresh = api.buildInventory(ROOT);
  const stale = clone(fresh);
  stale.counts.requests -= 1;
  assert.throws(() => api.checkInventory(stale, fresh), /generated artifact drift/i);
  assert.throws(() => api.assertOutputSeparate({
    outputPath: path.join(ROOT, 'qa/api/wallet.postman_collection.json'),
    inputPaths: [path.join(ROOT, 'qa/api/wallet.postman_collection.json')],
  }), /output collides with source input/i);
});
