**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/LIMIT-001-serialised-database-work.md)

# LIMIT-001 · Every request queues behind database work — 23× slower under write load

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Under the measured write load, database work serialized requests and made health latency approximately 23 times slower. This is an accepted design limit, not a product defect.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Accepted design limit |
| Status | **ACCEPTED** — current canonical register |
| Severity | Not applicable |
| Priority | Not recorded separately |
| Component | `src/db.js` — `better-sqlite3`, synchronous by design |
| Found / affected build | S07; exact build only where recorded below |
| Environment / frequency | Node v24.13.1, local server on port 3100, WAL mode; frequency only if stated below |

## Preconditions and test data

S07, by the k6 load smoke `qa/load/expense-write.js`

## Observation or measurement procedure

1. 50 users writing expenses as fast as they can for 30 seconds, while `GET /api/health` is polled throughout and, for 5 seconds beforehand, against an idle server.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

This is a measured performance boundary, not an unmet functional assertion. The dated load smoke supplies its threshold and workload.

## Actual observation

With 50 writers over 30 seconds, `GET /api/health` p95 increased from **1.4 ms idle to 32.4 ms under load** (23.4×). The request stayed well below the test's 250 ms threshold, while the increase disclosed synchronous request serialization.

## Evidence

- [Recorded source: `qa/load/expense-write.js`](../../../qa/load/expense-write.js)
- [Recorded source: `src/db.js`](../../../src/db.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `LIMIT-001`.
- [GitHub Issue #11](https://github.com/DaniilBehus/wallet-tracker/issues/11) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

**ACCEPTED design limit, not a defect.** `better-sqlite3` work is synchronous on one Node event loop, so writes make other requests queue even with SQLite WAL. The dated load smoke measured the 1.4→32.4 ms health p95 change without a failed threshold or lost write. The trade-off is documented; this report does not claim a performance repair or a new load run.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### Original report: LIMIT-001 · Every request queues behind database work — 23× slower under write load

[← Back to README](../../../README.md#qa-evidence) · [Next: write-load test →](../../../qa/load/expense-write.js)

![type](https://img.shields.io/badge/type-limit-blueviolet?style=flat-square)
![state](https://img.shields.io/badge/state-ACCEPTED-blue?style=flat-square)

| | |
|---|---|
| **Type** | Limit — a measured boundary of the design, **not a defect** |
| **State** | ACCEPTED 2026-09-02 |
| **Found by** | TC-LOAD-001, `qa/load/expense-write.js` (k6) |
| **Component** | `src/db.js` — `better-sqlite3`, synchronous by design |
| **Environment** | Node v24.13.1, local server on port 3100, WAL mode |
| **Fixed in** | — nothing to fix; accepted with the number written down |

## Why this is here at all

`LIMIT-###` is not a defect id. This entry exists because everything the load
smoke found is recorded, and because a limit that is measured and
written down is a **decision**, while the same limit discovered in production is
an **incident**.

Keeping it in the same register as the defects, under a different id prefix, is
deliberate: the taxonomy carries the difference so the prose does not have to.

## What was measured

50 users writing expenses as fast as they can for 30 seconds, while
`GET /api/health` is polled throughout — and, for five seconds beforehand,
against an idle server.

<details>
<summary>k6 output</summary>

```
writes            79322 requests, 2097/s
failed            0.000 %
server errors     0
write latency     avg 19.0 ms   p95 26.4 ms   max 55.7 ms

GET /api/health - the same trivial request, measured twice:
  idle            avg 1.0 ms    p95 1.4 ms
  under load      avg 19.5 ms   p95 32.4 ms
  cost of load    23.4x slower at p95
```

</details>

## What was expected and did not happen

`SQLITE_BUSY`, a locked database, a 5xx, a corrupted row, a lost write.

**None appeared. 79 322 writes, zero errors.** That is worth stating as plainly
as a failure would be: the thing the smoke went looking for is not there, and a
report that only records hits is a report that quietly overstates its own
coverage.

## Why it is not there

`better-sqlite3` is synchronous and Node is single-threaded, so writes cannot
actually overlap inside one process. They are serialised by the event loop
before SQLite ever sees contention, and WAL mode handles the rest.

**The design that causes the slowdown is the same design that prevents the
corruption.** That is the whole finding.

## The limit, stated

Throughput is about **2 100 writes/second**, and while the database is busy
every request — including ones that never touch it — is roughly **20× slower**.

For a personal application with one user, nobody will meet this. A household of
four will never see it. It would matter if this ever became multi-tenant, and at
that point the answer is not a faster query but moving the work off the request
thread.

## Not the same as BUG-004

Same mechanism, two orders of magnitude apart:

| | LIMIT-001 | [BUG-004](BUG-004-bcrypt-blocks-event-loop.md) |
|---|---|---|
| What the queue is behind | ~0.5 ms of database work | ~50 ms of deliberate CPU burn |
| Cost to an unrelated request | 23× | 1495× |
| Caused by | a library with no async form | a `Sync` call that had an async twin |
| Outcome | accepted | fixed |

The last row follows from the third. This one has no fix that keeps the design;
that one had a one-word fix.

## Accepted

On the basis above. If this ever grows a second concurrent user in earnest, this
entry is the starting point rather than a surprise.

## → Rule R6

Measure the same cheap endpoint idle and under load **in one run**. Without the
idle baseline, 32 ms looks fine.


</details>
