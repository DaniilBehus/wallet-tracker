**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-020-early-year-dates.md)

# BUG-020 · Valid early-year dates produce malformed next dates

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Accepted early-year and end-of-range dates could yield malformed next dates, including values outside the four-digit domain.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `src/dates.js` — clampToMonth / dayAfter / nextDue |
| Found / affected build | S21 + 2026-10-10 controls; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, pure date helper boundary probes

## Reproduction

1. call isValidDate('0001-01-31'), dayAfter for that date and nextDue(15, '0001-01-31').

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

accepted dates retain YYYY-MM-DD; next due is not before input.

## Actual observation

For `0001-01-31`, accepted date helpers returned strings such as `1-02-01` and a next due before the input. At the opposite edge, `9999-12-31` could advance outside the four-digit domain.

## Evidence

- [Recorded source: `src/dates.js`](../../../src/dates.js)
- [Recorded source: `qa/docs/test-report-date-boundaries.md`](../../../qa/docs/test-report-date-boundaries.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-020`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Date-boundary report](../../../qa/docs/test-report-date-boundaries.md) and date/contract tasks in the API CI group; only the stated four-digit domain is claimed.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-020 · Valid early-year dates produce malformed next dates · Medium · IN PROGRESS

| | |
|---|---|
| Found in | S21, pure date helper boundary probes |
| Component | `src/dates.js` — clampToMonth / dayAfter / nextDue |

**Steps to reproduce:** call isValidDate('0001-01-31'), dayAfter for that date
and nextDue(15, '0001-01-31').
**Expected:** accepted dates retain YYYY-MM-DD; next due is not before input.
**Actual before repair:** true, '1-02-01', '1-01-15' respectively. The latter
is earlier. At the opposite edge `9999-12-31` could become `10000-01-01`.
The same defect let schedule POST/PATCH return success and persist a row whose
computed next due was outside the declared four-digit domain.
**Root cause:** a parsed numeric year was interpolated without four-digit padding;
lexicographic comparisons then lost their fixed-width-date guarantee. The
arithmetic also had no upper-domain refusal before schedule writes.
**Fix:** local and uncommitted. Pure helpers preserve four-digit years0000–9999
and throw a coded range error for an unavailable successor. Schedule create/edit
validate computed next due before writing; a legacy edge row produces a
controlled 400 on list. No stored row is migrated or deleted.
**Regression:** initial pure controls 1/3, final 4/4; real disposable HTTP
control failed before on POST/PATCH/GET and passed after. Full contract 15/15,
340 validated responses. [Details](../../../qa/docs/test-report-date-boundaries.md).
Separate historical 2020–2032 matrix: 147219 checks,
0 mismatches. That matrix cannot certify years outside its range.
**→ Rule R14.**

</details>
