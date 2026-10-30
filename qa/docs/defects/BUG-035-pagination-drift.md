**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-035-pagination-drift.md)

# BUG-035 · Offset paging can duplicate or skip expenses after another client's write

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Offset pagination could repeat or skip expenses when another client inserted or deleted a row between page requests.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | See original observation |
| Found / affected build | 2026-10-16 HTTP/browser controls; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-16 disposable HTTP and two-viewport browser controls.

## Reproduction

1. read the first expense page; insert a newer row from a second client, then use `offset=2` for the next page. In a separate run, delete a seen row before continuing with the old offset.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

every surviving unseen expense appears once; a changed live total
does not produce an impossible Month counter.

## Actual observation

HTTP insertion repeated the already seen boundary ID;
HTTP deletion skipped an unseen surviving ID. In the browser, insertion
rendered 52 of 52 instead of restarting, while deletion showed a deleted row
instead of the remaining unseen one. Both phone and desktop witnesses failed
as expected.

## Evidence

- [Recorded source: `qa/docs/analysis-pagination-consistency.md`](../../../qa/docs/analysis-pagination-consistency.md)
- [Recorded source: `qa/docs/test-report-pagination-consistency.md`](../../../qa/docs/test-report-pagination-consistency.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-035`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Insert/delete drift witnesses and cursor regressions](../../../qa/docs/test-report-pagination-consistency.md); contract and Playwright CI passed. Cursor continuation is not an immutable snapshot.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-035 · Offset paging can duplicate or skip expenses after another client's write · Medium · IN PROGRESS

**Found in:** 2026-10-16 disposable HTTP and two-viewport browser controls.
**Steps:** read the first expense page; insert a newer row from a second client,
then use `offset=2` for the next page. In a separate run, delete a seen row
before continuing with the old offset.
**Expected:** every surviving unseen expense appears once; a changed live total
does not produce an impossible Month counter.
**Actual before repair:** HTTP insertion repeated the already seen boundary ID;
HTTP deletion skipped an unseen surviving ID. In the browser, insertion
rendered 52 of 52 instead of restarting, while deletion showed a deleted row
instead of the remaining unseen one. Both phone and desktop witnesses failed
as expected.
**Cause:** a numeric offset follows the shifted current list, not the last
seen `(spent_on, id)` position.
**Local repair:** optional cursor mode applies a parameterized keyset predicate
with account/filter-bound, strictly checked tokens. Legacy offset callers keep
their accepted response and behavior. Month uses cursor continuation and makes
one first-page restart when the live total changes; it does not poll.
**Regression:** focused synthetic HTTP controls 2/2, full local contract
17/17, managed pagination browser 8/8, editing 18/18 and focused editor/a11y
4/4 after a separate port-collision harness retry. This is not an immutable
snapshot: edits moving sort position, same-total external mutations and cached
rows remain limits. Independent agent code/evidence review accepted this
bounded local repair on 2026-10-16; BUG-035 remains **IN PROGRESS** for
combined-tree verification and publication, not because another known
insertion/deletion failure remains. No human audit, owner UAT, remote CI or
release is inferred. [Analysis](../../../qa/docs/analysis-pagination-consistency.md) ·
[run report](../../../qa/docs/test-report-pagination-consistency.md).

</details>
