#!/usr/bin/env node
'use strict';

// Self-check gate:  node scripts/check.js
// Prints OK, or the violations and exits 1.
//
// This is not a test suite. These checks assert invariants that are expensive
// to discover late: a spec that drifted, float money on the server, a testid
// that was never added, a route or status nobody tests. Behaviour is checked
// by the test layers in qa/.
//
// No dependencies, by design (spec §2). Node built-ins only.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const coverage = require('./coverage-gates');

const ROOT = path.join(__dirname, '..');
const at = (...s) => path.join(ROOT, ...s);
const has = (f) => fs.existsSync(at(f));

const results = [];
const pass = (id, name, note) => results.push({ id, name, state: 'PASS', note });
const skip = (id, name, why) => results.push({ id, name, state: 'SKIP', why });
const fail = (id, name, lines) => results.push({ id, name, state: 'FAIL', lines });

// Walk a directory, returning every file matching `ext`.
function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, ext, out);
    else if (e.name.endsWith(ext)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------- C1
// The spec is immutable. If this fails, either it was edited by accident or a
// deliberate change was made and nobody re-recorded the hash. Both need a
// human, so this check never auto-heals.
function c1SpecUnchanged() {
  const id = 'C1', name = 'spec/handoff.md unchanged';
  if (!has('spec/handoff.md') || !has('spec/handoff.sha256')) {
    return skip(id, name, 'spec or recorded hash is missing');
  }
  const actual = crypto.createHash('sha256')
    .update(fs.readFileSync(at('spec/handoff.md')))
    .digest('hex');
  const recorded = fs.readFileSync(at('spec/handoff.sha256'), 'utf8').trim();
  if (actual === recorded) return pass(id, name);
  fail(id, name, [
    `recorded  ${recorded}`,
    `actual    ${actual}`,
    'The spec was edited. Revert it — or, if the change is intended, record',
    'why in the commit message and re-run:',
    '  sha256sum spec/handoff.md | cut -d" " -f1 > spec/handoff.sha256',
  ]);
}

// ---------------------------------------------------------------------- C2
// Money is integer cents on the server, always (spec §3). Converting to a
// display string happens only in the browser, at the edge. So the server has
// no legitimate reason to contain float arithmetic or currency formatting —
// if one of these appears in src/, money has leaked into a float.
const FLOAT_MONEY = [
  [/\bparseFloat\s*\(/, 'parseFloat'],
  [/\.toFixed\s*\(/, '.toFixed'],
  [/\.toLocaleString\s*\(/, '.toLocaleString'],
  [/\/\s*100\b/, 'division by 100'],
  [/\*\s*100\b/, 'multiplication by 100'],
];
function c2NoFloatMoney() {
  const id = 'C2', name = 'no float money arithmetic in src/';
  if (!has('src')) return skip(id, name, 'src/ does not exist yet');
  const hits = [];
  for (const file of walk(at('src'), '.js')) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const [re, label] of FLOAT_MONEY) {
        if (re.test(line)) hits.push(`${rel}:${i + 1}  ${label}  ${line.trim()}`);
      }
    });
  }
  if (hits.length === 0) return pass(id, name);
  fail(id, name, [...hits, '',
    'Money is amount_cents, an integer, everywhere on the server.',
    'Formatting belongs in public/, not here (spec §3).']);
}

// ---------------------------------------------------------------------- C3
// Every testid from spec §6.5 must be present in public/. This check is the
// whole reason the attributes go in from the start: retrofitting them across
// four screens is tedious, and a separate project depends on them existing.
const TESTIDS_EXACT = [
  'amount-display', 'keypad-clear', 'expense-save-btn', 'month-total',
  'nav-add', 'nav-month', 'nav-upcoming', 'nav-schedules',
  'toast-success', 'toast-error',
  ...Array.from({ length: 10 }, (_, n) => `keypad-${n}`),
];
// Built at runtime from a row id — the prefix is what can be asserted.
const TESTIDS_PREFIX = [
  'category-tile-', 'tx-row-', 'tx-delete-', 'category-bar-',
  'schedule-row-', 'schedule-pay-', 'schedule-next-due-', 'schedule-remaining-',
];
function c3Testids() {
  const id = 'C3', name = 'every data-testid from spec §6.5 is present';
  if (!has('public')) return skip(id, name, 'public/ does not exist yet');
  const files = [...walk(at('public'), '.html'), ...walk(at('public'), '.js')];
  if (files.length === 0) return skip(id, name, 'public/ has no .html or .js yet');
  const blob = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const missing = [
    ...TESTIDS_EXACT.filter((t) => !blob.includes(t)),
    ...TESTIDS_PREFIX.filter((t) => !blob.includes(t)),
  ];
  if (missing.length === 0) return pass(id, name);
  fail(id, name, [`missing ${missing.length}:`, ...missing.map((m) => `  ${m}`)]);
}

// ---------------------------------------------------------------------- C5
// Two rules the end-to-end suite is built on, both of which are invisible once
// broken and expensive to unpick later:
//
//   a) no fixed waits — the suite waits only through web-first assertions
//      (D-013). One sleep added under deadline pressure is how a suite starts
//      encoding guesses about someone else's machine;
//   b) no CSS or XPath selectors — locators go through getByTestId or
//      getByRole only. A selector copied out of DevTools breaks on the next
//      restyle and tests nothing a user can perceive.
//
// Both were verified by hand once. This is what stops them from having to be.
const E2E_FORBIDDEN = [
  [/\bwaitForTimeout\s*\(/, 'waitForTimeout — use a web-first assertion (D-013)'],
  [/\bsetTimeout\s*\(/, 'setTimeout — use a web-first assertion (D-013)'],
  [/networkidle/, "waitForLoadState('networkidle') — unreliable, and D-013 rules it out"],
  [/\bwaitForSelector\s*\(/, 'waitForSelector — assert on the locator instead'],
  [/\.locator\s*\(/, '.locator() — use getByTestId or getByRole'],
  [/\bpage\.\$\$?\s*\(/, 'page.$ / page.$$ — use getByTestId or getByRole'],
  [/\bquerySelector\b/, 'querySelector — use getByTestId or getByRole'],
  [/['"`](?:css|xpath)=/, 'an explicit css= or xpath= selector'],
];
function c5E2eDiscipline() {
  const id = 'C5', name = 'no fixed waits and no CSS selectors in qa/e2e';
  if (!has('qa/e2e')) return skip(id, name, 'qa/e2e does not exist yet');

  const hits = [];
  for (const file of walk(at('qa/e2e'), '.js')) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      // Comments explain the rules; they are not violations of them.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const [re, label] of E2E_FORBIDDEN) {
        if (re.test(line)) hits.push(`${rel}:${i + 1}  ${label}`);
      }
    });
  }

  if (hits.length === 0) return pass(id, name);
  fail(id, name, [...hits, '',
    'Web-first assertions only (D-013); getByTestId or getByRole locators (D-012).',
    'If one of these genuinely has to change, that is a new D-### first.']);
}

// ---------------------------------------------------------------------- run
c1SpecUnchanged();
c2NoFloatMoney();
c3Testids();
c5E2eDiscipline();

// Coverage gates live in their own module: C1-C5 ask how things are written,
// C6-C9 ask whether what exists is actually covered.
const report = { pass, skip, fail };
const { data: exceptions, problems: exceptionProblems } = coverage.loadExceptions();
coverage.c6RoutesCovered(report, exceptions);
coverage.c7TestidsInPageObjects(report, exceptions);
coverage.c8StatusesAsserted(report, exceptions);
coverage.c9ExceptionsExplained(report, exceptionProblems);

let failed = 0, skipped = 0;
for (const r of results) {
  if (r.state === 'FAIL') failed++;
  if (r.state === 'SKIP') skipped++;
  const suffix = r.why ? ' — ' + r.why : r.note ? ' — ' + r.note : '';
  console.log(r.id + '  ' + r.state + '  ' + r.name + suffix);
  if (r.lines) r.lines.forEach((l) => console.log(`        ${l}`));
}

const counts = `${results.length - failed - skipped} pass, ${skipped} skip, ${failed} fail`;
console.log('');
console.log(failed === 0 ? `OK — ${counts}` : `FAILED — ${counts}`);
process.exit(failed === 0 ? 0 : 1);
