**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-028-evaluator-setup-race.md)

# BUG-028 · Concurrent evaluator setup can abort before quota exercise

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Concurrent offline-evaluator children raced while creating one synthetic user and could abort before quota logic ran.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `qa/ai/evaluate.js` synthetic-user factory |
| Found / affected build | 2026-10-10 controlled setup race; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-10, synchronized copied-evaluator control

## Reproduction

1. start three guarded evaluator children on one disposable database, synchronized before their first get-or-create for the same synthetic email.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

one fully initialized user and category set; all children reach provider/quota work without setup errors.

## Actual observation

two children reported `UNIQUE constraint failed: users.email` before provider dispatch. An injected post-seed failure separately left one user and ten categories.

## Evidence

- [Recorded source: `qa/ai/evaluate.js`](../../../qa/ai/evaluate.js)
- [Recorded source: `qa/docs/test-report-evaluator-concurrency.md`](../../../qa/docs/test-report-evaluator-concurrency.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-028`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Synchronized evaluator setup control](../../../qa/docs/test-report-evaluator-concurrency.md); offline AI CI passed. This does not prove the separate historical W9 cause.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-028 · Concurrent evaluator setup can abort before quota exercise · High · IN PROGRESS

| Found in | 2026-10-10, synchronized copied-evaluator control |
| Component | `qa/ai/evaluate.js` synthetic-user factory |

**Steps to reproduce:** start three guarded evaluator children on one disposable database, synchronized before their first get-or-create for the same synthetic email.
**Expected:** one fully initialized user and category set; all children reach provider/quota work without setup errors.
**Actual before repair:** two children reported `UNIQUE constraint failed: users.email` before provider dispatch. An injected post-seed failure separately left one user and ten categories.
**Root cause:** lookup, insert and category initialization were not enclosed in one cross-process transaction.
**Fix:** local and uncommitted; synchronous immediate transaction covers lookup through category read, and the cache receives only committed identity. Provider work remains outside it.
**Regression:** four new concurrency/report controls passed; affected tests 25/25 and full offline AI 240 passed, one Windows privilege skip. W9's rolling quota assertions are unchanged and an aborted child now has a separate diagnostic. This proves the race mechanism, not the cause of the earlier full-suite W9 failure.
**→ No rule — one-off.** [Details](../../../qa/docs/test-report-evaluator-concurrency.md).

</details>
