'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze, loadTree } = require('../../scripts/traceability');

const core = 'spec/core-requirements.md';
const ml = 'qa/docs/analysis-monthly-limit.md';
const cl = 'qa/docs/analysis-category-limits.md';
const ai = 'spec/ai-expense-entry.md';
const contract = 'docs/api/README.md';
const catalogue = 'qa/docs/test-cases.md';
const plan = 'qa/docs/ai-test-plan.md';
const bugs = 'log/BUGS.md';

function fixture() {
  return {
    [core]: '# Core\n## Current core rules\n### <a id="req-core-01"></a>REQ-CORE-01 · Health\n### <a id="req-core-02"></a>REQ-CORE-02 · Auth\n## Legacy reference migration index\n',
    [ml]: '# Monthly\n## 2. Requirements\n| <a id="req-ml-01"></a>REQ-ML-01 | Set | AC |\n## 3. Decision table\n| REQ-ML-01 | reference, not a second definition | TC-API-001 |\n',
    [cl]: '# Category\n## 2. Requirements\n### <a id="req-cl-01"></a>REQ-CL-01 · Set\n## 3. Decision table\n',
    [ai]: '# AI\n## 2. Rules\n| <a id="ai-r01"></a>AI-R01 | No save |\n## 3. Modes\n',
    [contract]: '# Contract\n## Requirements for the contract checks\n| <a id="req-contract-01"></a>REQ-CONTRACT-01 | Check |\n',
    [catalogue]: [
      '| TC-API-001 | Health | step | expected | [REQ-CORE-01](../../spec/core-requirements.md#req-core-01) | P2 | PASS |',
      '| TC-CONTRACT-001 | [REQ-CONTRACT-01](../../docs/api/README.md#req-contract-01): strict | Local PASS |',
      '',
    ].join('\n'),
    [plan]: '# AI plan\n## 1. What must never happen\n| Risk | Rule | Caught |\n|---|---|---|\n| Save | [AI-R01](../../spec/ai-expense-entry.md#ai-r01) | unit |\n## 2. Layers\n',
    [bugs]: '# Bugs\n### BUG-001 · Saved defect\n### LIMIT-001 · Accepted limit\n',
  };
}
const check = inputs => analyze(inputs, { expectedCaseCount: 2 });
const failsWith = (inputs, pattern) => {
  const result = check(inputs);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), pattern);
};

test('positive LF fixture distinguishes repeated references from definitions', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace('Health | step', 'Health | step [REQ-CORE-01](../../spec/core-requirements.md#req-core-01)');
  const result = check(f);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.caseCount, 2);
});

test('CRLF source and catalogue parse identically', () => {
  const f = fixture();
  for (const key of Object.keys(f)) f[key] = f[key].replace(/\n/g, '\r\n');
  assert.equal(check(f).ok, true);
});

test('old §5 health trace fails before semantic-reference repair', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace('[REQ-CORE-01](../../spec/core-requirements.md#req-core-01)', '§5 health');
  failsWith(f, /unmapped trace in TC-API-001/);
  assert.equal(check(fixture()).ok, true, 'repaired explicit trace passes');
});

test('removed requirement definition fails', () => {
  const f = fixture();
  f[core] = f[core].replace(/^### .*REQ-CORE-01.*\n/m, '');
  failsWith(f, /missing target definition REQ-CORE-01/);
});

test('missing and misspelled source anchors fail', () => {
  const f = fixture();
  f[core] = f[core].replace('<a id="req-core-01"></a>', '');
  failsWith(f, /missing or wrong anchor/);
  const g = fixture();
  g[core] = g[core].replace('id="req-core-01"', 'id="req-core-99"');
  failsWith(g, /missing or wrong anchor/);
});

test('duplicate definitions and duplicate anchors fail', () => {
  const f = fixture();
  f[core] = f[core].replace(
    '## Legacy reference migration index',
    '### <a id="req-core-01"></a>REQ-CORE-01 · Duplicate\n## Legacy reference migration index',
  );
  failsWith(f, /duplicate definition REQ-CORE-01/);
  assert.match(check(f).errors.join('\n'), /duplicate anchor/);
});

test('unsupported additional CORE-999 source definition fails closed', () => {
  const inputs = loadTree();
  inputs[core] += '\n### <a id="req-core-999"></a>REQ-CORE-999 · Unsupported definition\n';
  const result = analyze(inputs, { expectedCaseCount: 280 });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unsupported definition ID REQ-CORE-999/);
});

test('unsupported definition IDs fail in every source family with LF and CRLF', () => {
  const extra = [
    [core, '## Legacy reference migration index', '### <a id="req-core-999"></a>REQ-CORE-999 · unsupported\n', 'REQ-CORE-999'],
    [ml, '## 3. Decision table', '| <a id="req-ml-999"></a>REQ-ML-999 | unsupported | AC |\n', 'REQ-ML-999'],
    [cl, '## 3. Decision table', '### <a id="req-cl-999"></a>REQ-CL-999 · unsupported\n', 'REQ-CL-999'],
    [ai, '## 3. Modes', '| <a id="ai-r999"></a>AI-R999 | unsupported |\n', 'AI-R999'],
    [contract, null, '| <a id="req-contract-999"></a>REQ-CONTRACT-999 | unsupported |\n', 'REQ-CONTRACT-999'],
  ];
  for (const [file, boundary, row, id] of extra) {
    for (const ending of ['\n', '\r\n']) {
      const f = fixture();
      f[file] = boundary ? f[file].replace(boundary, row + boundary) : f[file] + row;
      if (ending === '\r\n') {
        for (const key of Object.keys(f)) f[key] = f[key].replace(/\n/g, '\r\n');
      }
      failsWith(f, new RegExp(`unsupported definition ID ${id}`));
    }
  }
});

test('wrong-family source definitions fail but unanchored reference rows remain references', () => {
  const f = fixture();
  f[core] = f[core].replace(
    '## Legacy reference migration index',
    '### <a id="req-ml-01"></a>REQ-ML-01 · wrong family\n## Legacy reference migration index',
  );
  failsWith(f, /unsupported definition ID REQ-ML-01 in spec\/core-requirements\.md/);
  const g = fixture();
  g[ml] = g[ml].replace(
    '## 3. Decision table',
    '| <a id="req-core-01"></a>REQ-CORE-01 | wrong family | AC |\n## 3. Decision table',
  );
  failsWith(g, /unsupported definition ID REQ-CORE-01 in qa\/docs\/analysis-monthly-limit\.md/);
  assert.equal(check(fixture()).ok, true, 'plain ML reference in §3 is not a second definition');
});

test('reviewed monthly decision-table mappings stay exact', () => {
  const rows = loadTree()[catalogue].split(/\r?\n/);
  const expected = {
    'TC-API-096': 'REQ-ML-05', 'TC-API-097': 'REQ-ML-05',
    'TC-API-098': 'REQ-ML-05', 'TC-API-099': 'REQ-ML-05',
    'TC-API-101': 'REQ-ML-06', 'TC-API-102': 'REQ-ML-07',
    'TC-API-103': 'REQ-ML-07', 'TC-API-104': 'REQ-ML-08',
    'TC-API-105': 'REQ-ML-08', 'TC-E2E-065': 'REQ-ML-09',
    'TC-E2E-066': 'REQ-ML-09',
  };
  for (const [id, rule] of Object.entries(expected)) {
    const row = rows.find(line => line.startsWith(`| ${id} |`));
    assert.ok(row, `${id} exists`);
    const trace = row.split('|')[5];
    assert.match(trace, new RegExp(`\\[${rule}\\]\\(analysis-monthly-limit\\.md#${rule.toLowerCase()}\\)`), id);
  }
  // This is a reviewed expected mapping, not semantic inference by the static parser.
});

test('duplicate case ID fails', () => {
  const f = fixture();
  f[catalogue] += f[catalogue].split('\n')[0] + '\n';
  failsWith(f, /duplicate TC ID TC-API-001/);
});

test('valid ID linked to the wrong source fails', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace('../../spec/core-requirements.md#req-core-01', 'analysis-monthly-limit.md#req-core-01');
  failsWith(f, /wrong source for REQ-CORE-01/);
});

test('missing target and wrong target anchor fail', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace(/REQ-CORE-01/g, 'REQ-CORE-99').replace(/req-core-01/g, 'req-core-99');
  failsWith(f, /missing target definition REQ-CORE-99/);
  const g = fixture();
  g[catalogue] = g[catalogue].replace('#req-core-01', '#req-core-02');
  failsWith(g, /wrong target anchor/);
});

test('unknown family and unlinked requirement fail', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace(/REQ-CORE-01/g, 'REQ-OTHER-01');
  failsWith(f, /unknown trace ID REQ-OTHER-01/);
  const g = fixture();
  g[catalogue] = g[catalogue].replace('[REQ-CORE-01](../../spec/core-requirements.md#req-core-01)', 'REQ-CORE-01');
  failsWith(g, /unlinked or unknown trace ID/);
});

test('a valid trace cannot hide an unsupported three-digit ID beside it', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace(
    '[REQ-CORE-01](../../spec/core-requirements.md#req-core-01)',
    '[REQ-CORE-01](../../spec/core-requirements.md#req-core-01), [REQ-CORE-999](../../spec/core-requirements.md#req-core-999)',
  );
  failsWith(f, /unknown trace ID REQ-CORE-999/);
});

test('empty or missing required source fails closed', () => {
  const f = fixture();
  f[ml] = '';
  failsWith(f, /empty required input/);
  const g = fixture();
  delete g[cl];
  failsWith(g, /empty required input/);
});

test('unsupported case row and AI risk forms fail', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace('| P2 | PASS |', '| extra | P2 | PASS |');
  failsWith(f, /unsupported case row form/);
  const g = fixture();
  g[plan] = g[plan].replace('| Save | [AI-R01](../../spec/ai-expense-entry.md#ai-r01) | unit |', '| Save | unsupported | unit |');
  failsWith(g, /unmapped trace in AI risk/);
});

function modernRegisterFixture() {
  const f = fixture();
  f[bugs] = [
    '# Defect, limit and traceability register',
    '',
    '## Current register',
    '',
    '| ID / full report | Problem or boundary | Severity | Status | Recorded fix disposition |',
    '|---|---|---|---|---|',
    '| [BUG-001](../qa/docs/defects/BUG-001-save-button-contrast.md) | Save control | High | CLOSED | fixed |',
    '| [LIMIT-001](../qa/docs/defects/LIMIT-001-serialised-database-work.md) | Queue | — | ACCEPTED | — |',
    '| [TRACE-AUDIT-001](../qa/docs/defects/TRACE-AUDIT-001-semantic-links.md) | Trace | — | CLOSED | verified |',
    '',
    '## Historical evidence',
    'BUG-999 is a prose reference, not a definition.',
    '',
  ].join('\n');
  f[catalogue] = f[catalogue].replace(
    '[REQ-CORE-01](../../spec/core-requirements.md#req-core-01)',
    '[BUG-001](../../log/BUGS.md)',
  );
  return f;
}

function runModernRegisterControls() {
  for (const ending of ['\n', '\r\n']) {
    const withEnding = f => {
      if (ending === '\r\n') for (const key of Object.keys(f)) f[key] = f[key].replace(/\n/g, '\r\n');
      return f;
    };
    const valid = check(withEnding(modernRegisterFixture()));
    assert.equal(valid.ok, true, valid.errors.join('\n'));
    assert.equal(valid.caseCount, 2);

    const missing = modernRegisterFixture();
    missing[bugs] = missing[bugs].replace(/^\| \[BUG-001\].*\n/m, '');
    failsWith(withEnding(missing), /missing defect definition BUG-001/);

    const malformed = modernRegisterFixture();
    malformed[bugs] = malformed[bugs].replace(
      '| [BUG-001](../qa/docs/defects/BUG-001-save-button-contrast.md) | Save control | High | CLOSED | fixed |',
      '| [BUG-001](../qa/docs/defects/BUG-001-save-button-contrast.md) | Save control | High | CLOSED |',
    );
    withEnding(malformed);
    failsWith(malformed, /unsupported defect register row/);
    failsWith(malformed, /missing defect definition BUG-001/);

    const duplicate = modernRegisterFixture();
    const row = duplicate[bugs].split('\n').find(line => line.startsWith('| [BUG-001]'));
    duplicate[bugs] = duplicate[bugs].replace(row, row + '\n' + row);
    failsWith(withEnding(duplicate), /duplicate defect definition BUG-001/);

    const wrong = modernRegisterFixture();
    wrong[bugs] = wrong[bugs].replace('BUG-001-save-button-contrast.md', 'BUG-002-paid-loan-counter.md');
    withEnding(wrong);
    failsWith(wrong, /wrong defect report target for BUG-001/);
    failsWith(wrong, /missing defect definition BUG-001/);

    const outside = modernRegisterFixture();
    outside[bugs] = outside[bugs]
      .replace(/^\| \[BUG-001\].*\n/m, '')
      .replace('BUG-999 is a prose reference', '### BUG-001 · pseudo-definition\nBUG-001 and BUG-999 are prose references');
    failsWith(withEnding(outside), /missing defect definition BUG-001/);

    const noBlock = modernRegisterFixture();
    noBlock[bugs] = noBlock[bugs].replace('## Current register', '## Other register') + '\n### BUG-001 · pseudo-definition\n';
    failsWith(withEnding(noBlock), /missing current defect register block/);

    const unknown = modernRegisterFixture();
    unknown[bugs] = unknown[bugs]
      .replace('# Defect, limit and traceability register', '# Unrecognized register')
      .replace('## Current register', '## Other register')
      .concat('\n### BUG-001 · pseudo-definition\n');
    failsWith(withEnding(unknown), /missing current defect register block/);

    const wrongSource = modernRegisterFixture();
    wrongSource[catalogue] = wrongSource[catalogue].replace('[BUG-001](../../log/BUGS.md)', '[BUG-001](../../spec/core-requirements.md)');
    failsWith(withEnding(wrongSource), /wrong defect source for BUG-001/);
  }
}

test('defect links require a real heading and the correct source', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace('[REQ-CORE-01](../../spec/core-requirements.md#req-core-01)', '[BUG-999](../../log/BUGS.md)');
  failsWith(f, /missing defect definition BUG-999/);
  const g = fixture();
  g[catalogue] = g[catalogue].replace('[REQ-CORE-01](../../spec/core-requirements.md#req-core-01)', '[BUG-001](../../spec/core-requirements.md)');
  failsWith(g, /wrong defect source/);
  runModernRegisterControls();
});

test('unmapped feature requirements are permitted; AI owns its separate register', () => {
  const result = check(fixture());
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.match(result.provisional, /F19/);
});

test('semantic mismatch witness stays green and requires human review', () => {
  const f = fixture();
  f[catalogue] = f[catalogue].replace('[REQ-CORE-01](../../spec/core-requirements.md#req-core-01)', '[REQ-CORE-02](../../spec/core-requirements.md#req-core-02)');
  assert.equal(check(f).ok, true, 'the checker cannot know that auth is not health');
});

test('actual 280-row tree passes only static identity/link checks', () => {
  const result = analyze(loadTree(), { expectedCaseCount: 280 });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.definitionCount, 78);
});
