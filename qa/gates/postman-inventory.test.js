'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { validateSources, buildInventory, assertOutputSeparate } = require('../../scripts/postman-inventory');

const ROOT = path.join(__dirname, '..', '..');
const collectionPath = path.join(ROOT, 'qa/api/wallet.postman_collection.json');
const cataloguePath = path.join(ROOT, 'qa/docs/test-cases.md');
const mappingPath = path.join(ROOT, 'qa/traceability/postman-health.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const catalogue = fs.readFileSync(cataloguePath, 'utf8');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const clone = value => structuredClone(value);

function fixture() {
  return { collection: clone(collection), catalogue, mapping: clone(mapping) };
}

function pilot(items) {
  return items.item.find(item => item.name === mapping.scope.folder);
}

function catalogueRow(id) {
  const row = catalogue.split(/\r?\n/).find(line => line.startsWith(`| ${id} |`));
  assert.ok(row, `fixture row ${id} exists`);
  return row;
}

test('reviewed pilot is a nonempty, bidirectional 12-request/12-case inventory', () => {
  const result = validateSources(fixture());
  assert.equal(result.counts.requests, 12);
  assert.equal(result.counts.cases, 12);
  assert.equal(result.counts.edges, 12);
  assert.deepEqual(result.gaps, { declaredOnly: [], sourceOnly: [] });
  assert.equal(result.status, 'PARTIAL_STATIC_SOURCE_INVENTORY');
  assert.equal(result.execution, 'NOT_RUN');
  assert.equal(result.otherLayers, 'NOT_CHECKED');
  const built = buildInventory({
    collectionPath, cataloguePath, mappingPath,
    root: ROOT,
  });
  assert.deepEqual(built.counts, result.counts);
  for (const key of ['collection', 'catalogue', 'mapping']) {
    assert.match(built.sources[key].sha256, /^[0-9a-f]{64}$/);
    assert.ok(built.sources[key].path && !path.isAbsolute(built.sources[key].path));
  }
});

test('deleted and moved requests fail; order is not identity', () => {
  const deleted = fixture();
  pilot(deleted.collection).item.shift();
  assert.throws(() => validateSources(deleted), /missing|unmatched|deleted/i);

  const moved = fixture();
  const request = pilot(moved.collection).item.shift();
  moved.collection.item.find(item => item.name !== mapping.scope.folder).item.push(request);
  assert.throws(() => validateSources(moved), /missing|unmatched|deleted/i);

  const reordered = fixture();
  pilot(reordered.collection).item.reverse();
  assert.equal(validateSources(reordered).counts.requests, 12);
});

test('unknown and nonpilot IDs cannot borrow a case row elsewhere', () => {
  const unknown = fixture();
  unknown.mapping.edges[0].caseIds = ['TC-API-999'];
  assert.throws(() => validateSources(unknown), /unknown.*TC-API-999/i);

  const otherSection = fixture();
  otherSection.mapping.edges[0].caseIds = ['TC-API-010'];
  assert.throws(() => validateSources(otherSection), /outside.*pilot|nonpilot/i);
});

test('duplicate or deleted catalogue rows and missing edge fail closed', () => {
  const duplicate = fixture();
  duplicate.catalogue = duplicate.catalogue.replace(catalogueRow('TC-API-001'),
    `${catalogueRow('TC-API-001')}\n${catalogueRow('TC-API-001')}`);
  assert.throws(() => validateSources(duplicate), /duplicate.*TC-API-001/i);

  const deletedRow = fixture();
  deletedRow.catalogue = deletedRow.catalogue.replace(catalogueRow('TC-API-001'), '');
  assert.throws(() => validateSources(deletedRow), /missing.*TC-API-001|deleted.*TC-API-001/i);

  const missingEdge = fixture();
  missingEdge.mapping.edges.shift();
  assert.throws(() => validateSources(missingEdge), /unclassified|missing.*request/i);

  const changedRow = fixture();
  changedRow.catalogue = changedRow.catalogue.replace(catalogueRow('TC-API-001'),
    catalogueRow('TC-API-001').replace('db` is `ok`', 'db` is `degraded`'));
  assert.throws(() => validateSources(changedRow), /row fingerprint changed/i);

  const newRow = fixture();
  newRow.catalogue = newRow.catalogue.replace(catalogueRow('TC-API-001'),
    `${catalogueRow('TC-API-001')}\n| TC-API-999 | New unreviewed case | step | expected | rule | P2 | PASS |`);
  assert.throws(() => validateSources(newRow), /unreviewed active catalogue row/i);
});

test('changed assertions, changed helper and unclassified extra request fail', () => {
  const changedAssertion = fixture();
  pilot(changedAssertion.collection).item[0].event[0].script.exec[1] = "expectOk(204, 'health');";
  assert.throws(() => validateSources(changedAssertion), /fingerprint/i);

  const changedHelper = fixture();
  changedHelper.collection.event[0].script.exec.push('// changed collection helper');
  assert.throws(() => validateSources(changedHelper), /context.*fingerprint/i);

  const extra = fixture();
  const newRequest = clone(pilot(extra.collection).item[0]);
  newRequest.name = 'GET /health additional unchecked request';
  pilot(extra.collection).item.push(newRequest);
  assert.throws(() => validateSources(extra), /unclassified|extra.*request/i);

  const duplicateSource = fixture();
  pilot(duplicateSource.collection).item.push(clone(pilot(duplicateSource.collection).item[0]));
  assert.throws(() => validateSources(duplicateSource), /duplicate current request selector/i);
});

test('conflicting selector and empty/malformed inputs fail', () => {
  const conflict = fixture();
  const edge = clone(conflict.mapping.edges[0]);
  edge.caseIds = ['TC-API-002'];
  conflict.mapping.edges.push(edge);
  assert.throws(() => validateSources(conflict), /duplicate.*selector|conflict/i);

  const repeatedAnnotation = fixture();
  repeatedAnnotation.mapping.edges[0].caseIds.push('TC-API-001');
  assert.throws(() => validateSources(repeatedAnnotation), /duplicate.*annotation/i);

  assert.throws(() => validateSources({ ...fixture(), collection: {} }), /collection|folder/i);
  assert.throws(() => validateSources({ ...fixture(), catalogue: '' }), /catalogue|section/i);
  assert.throws(() => validateSources({ ...fixture(), mapping: {} }), /mapping|scope/i);
  const malformed = fixture();
  malformed.catalogue = malformed.catalogue.replace(catalogueRow('TC-API-001'),
    '| TC-API-1 | bad ID |');
  assert.throws(() => validateSources(malformed), /malformed.*ID|first.cell/i);

  const malformedNeighbor = fixture();
  malformedNeighbor.catalogue = malformedNeighbor.catalogue.replace(
    catalogueRow('TC-API-010'), catalogueRow('TC-API-010').replace('TC-API-010', 'TC-API-10'));
  assert.throws(() => validateSources(malformedNeighbor), /malformed active ID.*TC-API-10/i);

  const ambiguous = fixture();
  ambiguous.catalogue = ambiguous.catalogue.replace(mapping.scope.catalogueSection,
    `${mapping.scope.catalogueSection}\n${mapping.scope.catalogueSection}`);
  assert.throws(() => validateSources(ambiguous), /ambiguous.*section/i);

  const noBoundary = fixture();
  noBoundary.catalogue = noBoundary.catalogue.slice(0,
    noBoundary.catalogue.indexOf('## API · Token handling'));
  assert.throws(() => validateSources(noBoundary), /missing.*boundary/i);
});

test('LF/CRLF and legitimate many requests for one case are accepted', () => {
  const crlf = fixture();
  crlf.catalogue = crlf.catalogue.replace(/\r?\n/g, '\r\n');
  assert.equal(validateSources(crlf).counts.cases, 12);

  const many = fixture();
  const request = clone(pilot(many.collection).item[0]);
  request.name = 'GET /health second verified view';
  pilot(many.collection).item.push(request);
  const edge = clone(many.mapping.edges[0]);
  edge.selector.name = request.name;
  many.mapping.edges.push(edge);
  const result = validateSources(many);
  assert.equal(result.counts.requests, 13);
  assert.equal(result.counts.cases, 12);
  assert.equal(result.counts.edges, 13);
});

test('explicit generator output cannot overwrite any source input', () => {
  const inputs = { collectionPath, cataloguePath, mappingPath };
  for (const outputPath of Object.values(inputs)) {
    assert.throws(() => assertOutputSeparate({ ...inputs, outputPath }),
      /output path must not overwrite an input source/i);
  }
  assert.doesNotThrow(() => assertOutputSeparate({ ...inputs,
    outputPath: path.join(ROOT, 'qa/docs/postman-health-inventory.json') }));
});
