// Static identity/link gate only: no HTTP, test execution or semantic inference.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCES = Object.freeze({
  CORE: { file: 'spec/core-requirements.md', link: '../../spec/core-requirements.md', prefix: 'REQ-CORE', heading: true },
  ML: { file: 'qa/docs/analysis-monthly-limit.md', link: 'analysis-monthly-limit.md', prefix: 'REQ-ML' },
  CL: { file: 'qa/docs/analysis-category-limits.md', link: 'analysis-category-limits.md', prefix: 'REQ-CL', heading: true },
  AI: { file: 'spec/ai-expense-entry.md', link: '../../spec/ai-expense-entry.md', prefix: 'AI-R' },
  CONTRACT: { file: 'docs/api/README.md', link: '../../docs/api/README.md', prefix: 'REQ-CONTRACT' },
});
const CATALOGUE = 'qa/docs/test-cases.md';
const AI_PLAN = 'qa/docs/ai-test-plan.md';
const BUGS = 'log/BUGS.md';

function linesOf(value, name, errors) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`empty required input: ${name}`);
    return [];
  }
  return value.replace(/\r\n/g, '\n').split('\n');
}

function parseDefinitions(inputs, errors) {
  const definitions = new Map();
  const anchors = new Map();
  for (const [family, source] of Object.entries(SOURCES)) {
    const lines = linesOf(inputs[source.file], source.file, errors);
    const localAnchors = new Set();
    const starts = {
      CORE: /^## Current core rules\s*$/,
      ML: /^## 2\. Requirements/,
      CL: /^## 2\. Requirements/,
      AI: /^## 2\. Rules/,
      CONTRACT: /^## Requirements for the contract checks\s*$/,
    };
    const ends = {
      CORE: /^## Legacy reference migration index\s*$/,
      ML: /^## 3\./,
      CL: /^## 3\./,
      AI: /^## 3\./,
      CONTRACT: /^## /,
    };
    const start = lines.findIndex(line => starts[family].test(line));
    const next = lines.findIndex((line, index) => index > start && ends[family].test(line));
    const end = next < 0 && family === 'CONTRACT' ? lines.length : next;
    if (start < 0 || end <= start) errors.push(`missing definition block in ${source.file}`);
    const supportedID = id => source.prefix === 'AI-R'
      ? /^AI-R\d{2}$/.test(id)
      : new RegExp(`^${source.prefix}-\\d{2}$`).test(id);
    for (const [i, line] of lines.entries()) {
      for (const match of line.matchAll(/<a\s+id="([^"]+)"\s*><\/a>/g)) {
        if (localAnchors.has(match[1])) errors.push(`duplicate anchor ${source.file}#${match[1]}`);
        localAnchors.add(match[1]);
      }
      if (i <= start || i >= end) {
        // An anchored rule-shaped row/heading outside the definition block is
        // still a definition candidate. Plain IDs in prose or trace matrices
        // remain repeated references, not new definitions.
        const outside = source.heading
          ? line.match(/^###\s+(?:<a\s+id="[^"]+"\s*><\/a>)?((?:REQ|AI)-[A-Z0-9-]+)\b/)
          : line.match(/^\|\s*<a\s+id="[^"]+"\s*><\/a>((?:REQ|AI)-[A-Z0-9-]+)\s*\|/);
        if (outside) {
          if (!supportedID(outside[1])) errors.push(`unsupported definition ID ${outside[1]} in ${source.file}:${i + 1}`);
          else errors.push(`definition outside required block ${outside[1]} in ${source.file}:${i + 1}`);
        }
        continue;
      }
      const candidate = source.heading
        ? /^###\s+/.test(line)
        : /^\|\s*/.test(line) && !/^\|\s*(?:ID\s*\||:?-{2,})/.test(line);
      if (!candidate) continue;
      const broad = source.heading
        ? line.match(/^###\s+(?:<a\s+id="[^"]+"\s*><\/a>)?([A-Z][A-Z0-9-]*)\b/)
        : line.match(/^\|\s*(?:<a\s+id="[^"]+"\s*><\/a>)?([A-Z][A-Z0-9-]*)\s*\|/);
      if (!broad) {
        errors.push(`unsupported definition form ${source.file}:${i + 1}`);
        continue;
      }
      const id = broad[1];
      if (!supportedID(id)) {
        errors.push(`unsupported definition ID ${id} in ${source.file}:${i + 1}`);
        continue;
      }
      const expectedAnchor = id.toLowerCase();
      const exact = `<a id="${expectedAnchor}"></a>${id}`;
      if (!line.includes(exact)) errors.push(`missing or wrong anchor for ${id} at ${source.file}:${i + 1}`);
      if (definitions.has(id)) errors.push(`duplicate definition ${id}`);
      else definitions.set(id, { file: source.file, link: source.link, anchor: expectedAnchor, family });
    }
    anchors.set(source.file, localAnchors);
    if (!lines.length) continue;
    if (![...definitions.values()].some(def => def.file === source.file))
      errors.push(`no definitions in ${source.file}`);
  }
  for (const [id, def] of definitions) {
    if (!anchors.get(def.file).has(def.anchor)) errors.push(`missing target anchor ${def.file}#${def.anchor}`);
  }
  return definitions;
}

function parseDefectDefinitions(value, errors) {
  const lines = linesOf(value, BUGS, errors);
  const ids = new Set();
  const currentHeading = '## Current register';
  const modern = lines.includes('# Defect, limit and traceability register') || lines.includes(currentHeading);
  if (!modern) {
    if (lines[0] !== '# Bugs') {
      errors.push('missing current defect register block');
      return ids;
    }
    // Keep the original heading fixture contract. A current register never
    // falls back to headings or prose when its table is missing or malformed.
    for (const line of lines) {
      const match = line.match(/^### ((?:BUG|LIMIT)-\d{3})\b/);
      if (!match) continue;
      if (ids.has(match[1])) errors.push(`duplicate defect heading ${match[1]}`);
      ids.add(match[1]);
    }
    return ids;
  }

  const starts = lines.flatMap((line, index) => line === currentHeading ? [index] : []);
  if (starts.length !== 1) {
    errors.push('missing current defect register block');
    return ids;
  }
  const start = starts[0];
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  if (end < 0) {
    errors.push('unterminated current defect register block');
    return ids;
  }
  const block = lines.slice(start + 1, end).filter(line => line.trim());
  const header = '| ID / full report | Problem or boundary | Severity | Status | Recorded fix disposition |';
  const divider = '|---|---|---|---|---|';
  if (block[0] !== header || block[1] !== divider || block.length < 3) {
    errors.push('unsupported current defect register table');
    return ids;
  }
  const seen = new Set();
  for (const [index, line] of block.slice(2).entries()) {
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length !== 7 || cells[0] || cells[6] || cells.slice(1, 6).some(cell => !cell)) {
      errors.push(`unsupported defect register row ${index + 1}`);
      continue;
    }
    const match = cells[1].match(/^\[((?:BUG|LIMIT)-\d{3}|TRACE-AUDIT-\d{3})\]\(([^)\s]+)\)$/);
    if (!match) {
      errors.push(`unsupported defect register ID/link cell ${index + 1}`);
      continue;
    }
    const [, id, target] = match;
    const report = new RegExp(`^\\.\\./qa/docs/defects/${id}-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`);
    if (!report.test(target)) {
      errors.push(`wrong defect report target for ${id}: ${target}`);
      continue;
    }
    if (seen.has(id)) errors.push(`duplicate defect definition ${id}`);
    seen.add(id);
    if (/^(?:BUG|LIMIT)-/.test(id)) ids.add(id);
  }
  return ids;
}

function validateLinks(cell, where, definitions, bugIDs, errors, { aiOnly = false } = {}) {
  const ruleLinks = [...cell.matchAll(/\[((?:REQ-[A-Z][A-Z0-9-]*|AI-R[A-Z0-9-]+))\]\(([^)#\s]+)#([^)\s]+)\)/g)];
  const linked = [];
  for (const [, id, target, anchor] of ruleLinks) {
    if (!/^(?:REQ-(?:CORE|ML|CL|CONTRACT)-\d{2}|AI-R\d{2})$/.test(id)) {
      errors.push(`unknown trace ID ${id} in ${where}`);
      continue;
    }
    const def = definitions.get(id);
    if (!def) { errors.push(`missing target definition ${id} in ${where}`); continue; }
    const expectedLink = aiOnly && def.family === 'AI' ? '../../spec/ai-expense-entry.md' : def.link;
    if (path.posix.normalize(target) !== path.posix.normalize(expectedLink))
      errors.push(`wrong source for ${id} in ${where}: ${target}`);
    if (anchor !== def.anchor) errors.push(`wrong target anchor for ${id} in ${where}: ${anchor}`);
    linked.push(id);
  }
  const idTokens = [...cell.matchAll(/\b(?:REQ-[A-Z][A-Z0-9-]*|AI-R[A-Z0-9-]+)\b/g)].map(m => m[0]);
  for (const id of idTokens) {
    if (!linked.includes(id)) errors.push(`unlinked or unknown trace ID ${id} in ${where}`);
  }
  const defects = [...cell.matchAll(/\[((?:BUG|LIMIT)-\d{3})\]\(([^)#\s]+)(?:#([^)\s]+))?\)/g)];
  for (const [, id, target] of defects) {
    if (target !== '../../log/BUGS.md') errors.push(`wrong defect source for ${id} in ${where}`);
    if (!bugIDs.has(id)) errors.push(`missing defect definition ${id} in ${where}`);
  }
  const defectTokens = [...cell.matchAll(/\b(?:BUG|LIMIT)-\d{3}\b/g)].map(m => m[0]);
  for (const id of defectTokens) {
    if (!defects.some(d => d[1] === id)) errors.push(`unlinked defect ${id} in ${where}`);
  }
  if (!linked.length && !defects.length) errors.push(`unmapped trace in ${where}`);
}

function analyze(inputs, options = {}) {
  const errors = [];
  const definitions = parseDefinitions(inputs, errors);
  const bugIDs = parseDefectDefinitions(inputs[BUGS], errors);
  const rows = linesOf(inputs[CATALOGUE], CATALOGUE, errors).filter(line => /^\| TC-/.test(line));
  if (!rows.length) errors.push('no catalogue case rows');
  const cases = new Set();
  for (const row of rows) {
    const cells = row.split('|').map(c => c.trim());
    const id = cells[1];
    if (!/^TC-[A-Z0-9]+-\d{3}$/.test(id)) errors.push(`unsupported TC ID ${id}`);
    if (cases.has(id)) errors.push(`duplicate TC ID ${id}`);
    cases.add(id);
    if (![9, 6, 5].includes(cells.length)) {
      errors.push(`unsupported case row form ${id}: ${cells.length} cells`);
      continue;
    }
    const trace = cells.length === 9 ? cells[5] : cells[2];
    if (!trace) { errors.push(`empty trace ${id}`); continue; }
    validateLinks(trace, id, definitions, bugIDs, errors);
  }
  if (options.expectedCaseCount !== undefined && cases.size !== options.expectedCaseCount)
    errors.push(`case count ${cases.size}, expected ${options.expectedCaseCount}`);

  const planLines = linesOf(inputs[AI_PLAN], AI_PLAN, errors);
  const start = planLines.findIndex(line => /^## 1\. What must never happen/.test(line));
  const end = planLines.findIndex((line, i) => i > start && /^## 2\./.test(line));
  if (start < 0 || end < 0) errors.push('unsupported AI risk-table form');
  else {
    const risks = planLines.slice(start, end).filter(line => /^\| (?!Risk|---)[^|]+ \|/.test(line));
    if (!risks.length) errors.push('empty AI risk table');
    for (const [i, row] of risks.entries()) {
      const cells = row.split('|').map(c => c.trim());
      if (cells.length !== 5) { errors.push(`unsupported AI risk row ${i + 1}`); continue; }
      validateLinks(cells[2], `AI risk ${i + 1}`, definitions, bugIDs, errors, { aiOnly: true });
    }
  }

  return {
    ok: errors.length === 0, errors, caseCount: cases.size,
    definitionCount: definitions.size,
    provisional: 'Synthetic import is agent-authored/provisional; TC-CONTRACT-IMPORT is not in the 280-row catalogue. F19 must reconcile executable inventory separately.',
  };
}

function loadTree(root = path.resolve(__dirname, '..')) {
  const inputs = {};
  for (const file of [...Object.values(SOURCES).map(s => s.file), CATALOGUE, AI_PLAN, BUGS]) {
    inputs[file] = fs.readFileSync(path.join(root, file), 'utf8');
  }
  return inputs;
}

if (require.main === module) {
  try {
    const result = analyze(loadTree(), { expectedCaseCount: 280 });
    if (!result.ok) {
      for (const error of result.errors) console.error(`TRACEABILITY STATIC FAIL: ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`TRACEABILITY STATIC PASS: ${result.caseCount} case IDs; ${result.definitionCount} rule definitions. No semantic or execution claim.`);
      console.log(result.provisional);
    }
  } catch (error) {
    console.error(`TRACEABILITY STATIC FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { analyze, loadTree };
