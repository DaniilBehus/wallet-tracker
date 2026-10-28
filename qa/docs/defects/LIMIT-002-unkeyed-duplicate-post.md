**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/LIMIT-002-unkeyed-duplicate-post.md)

# LIMIT-002 · The same POST twice creates two expenses (unkeyed requests; keyed saves replay — D-035)

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Two identical unkeyed POSTs are separate expense creations. Keyed saves later gained replay protection; the unkeyed behavior remains an accepted boundary, not a defect.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Accepted design limit |
| Status | **ACCEPTED** — current canonical register |
| Severity | Not applicable |
| Priority | Not recorded separately |
| Component | `src/routes/transactions.js` — `POST /`, and the absence of an idempotency key |
| Found / affected build | S16; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S16, `qa/race/` scenario D — a check requested explicitly

## Observation or measurement procedure

1. two byte-identical `POST /api/transactions` requests sent with `Promise.all`, forty times.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

This accepted limit does not have a defect-style expected result. Unkeyed requests are separate saves; keyed requests replay as specified in the dated D-035 update below.

## Actual observation

Forty pairs of byte-identical, unkeyed requests each returned 201/201 and created two rows. This is the recorded observation, not an inferred failure.

## Evidence

- [Recorded source: `qa/ai/tests/idempotency.test.js`](../../../qa/ai/tests/idempotency.test.js)
- [Recorded source: `qa/race/`](../../../qa/race/)
- [Recorded source: `src/routes/transactions.js`](../../../src/routes/transactions.js)
- [Recorded source: `qa/e2e/double-submit.spec.js`](../../../qa/e2e/double-submit.spec.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `LIMIT-002`.
- [GitHub Issue #15](https://github.com/DaniilBehus/wallet-tracker/issues/15) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

**ACCEPTED, not repaired as a general duplicate-request ban.** The 40 recorded unkeyed pairs each returned 201/201 and created two expenses. A client that needs retry safety must send a valid `Idempotency-Key`: the dated keyed-save control sent 20 concurrent same-key requests and retained one row. The AI review path sends such a key; the normal unkeyed keypad path still creates a new expense for a deliberate second Save. No new test ran for this rewrite.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### LIMIT-002 · The same POST twice creates two expenses · ACCEPTED

> **S23 update (D-035).** Narrowed, not closed. A POST that carries an
> `Idempotency-Key` is now retry-safe: same key and payload replays the first
> 201 (`Idempotency-Replayed: true`), a different payload is 409, a deleted
> expense is not resurrected. The AI review screen always sends a key. Unkeyed
> POSTs — the keypad path, Newman, pytest — behave exactly as measured below,
> and that remains correct HTTP. Evidence: `qa/ai/tests/idempotency.test.js`
> (20 concurrent same-key saves → 1 row), Newman folder 11, pytest
> `test_parallel_retries_with_one_key_create_one_expense`.

| | |
|---|---|
| Found in | S16, `qa/race/` scenario D — a check requested explicitly |
| Component | `src/routes/transactions.js` — `POST /`, and the absence of an idempotency key |

**What was measured:** two byte-identical `POST /api/transactions` requests sent
with `Promise.all`, forty times.

```
D · the same POST twice, as a network retry would send it
      40 × 201 · 201
      40 × 2 row(s) stored
    pairs that produced a duplicate row: 40 of 40
```

**Every pair duplicated. There is no deduplication of any kind.**

**This was classified in advance — "if it duplicates, it is a real defect,
full report." The measurement disagrees, and the disagreement is the report.**

Two POSTs producing two rows is HTTP working as specified: POST is not
idempotent, and a server that quietly collapsed two of them would be wrong in a
way much harder to see than a duplicate. Two €2.00 coffees on one day is an
ordinary thing to buy. A screen that deduplicated them would hide an expense
that really happened, and the missing row is far harder to notice than the extra
one.

So the question is not "does the API duplicate" — it does, correctly — but
**can a person using this application produce a duplicate?** That was tested
from the only side a person can reach (`qa/e2e/double-submit.spec.js`):

| Attempt | Result |
|---|---|
| Two fast taps on Save | one expense |
| Enter pressed twice on the schedule form | one schedule |
| A second Save after the first finished | two expenses — correctly |

`withBusy` disables the control synchronously, before the first request is
awaited, so the second event lands on a disabled button. **No reachable path in
this application produces a duplicate.**

**What remains, stated rather than dismissed:** a transport-level retry would
duplicate, and nothing here would stop it. Browsers do not retry POSTs on their
own and this app has no service worker, so there is no such path today. If one
ever appears — an offline queue, a retrying proxy — the fix is an
`Idempotency-Key` header, which is a change to the API contract in spec §5 and
therefore a `D-###`, not a patch.

**Accepted** on that basis: correct protocol behaviour, no reachable defect, and
the mechanism that protects it named — because a protection nobody can point at
is a coincidence waiting to be refactored away.

**→ No rule.** The guard already exists (`withBusy`) and predates this check.

---

</details>
