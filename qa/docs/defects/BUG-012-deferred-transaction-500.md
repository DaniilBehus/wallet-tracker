# BUG-012 · Two processes writing one database answer 500

[← Back to README](../../../README.md#qa-evidence) · [Next: race test source →](../../../qa/race/run.js)

![severity](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | High |
| **Priority** | P1 — a status the specification says is unreachable |
| **State** | CLOSED 2026-09-06 |
| **Found by** | `qa/race/` scenario C, on the first run that got two servers up |
| **Component** | `src/routes/schedules.js` — both transactions |
| **Affects** | any deployment with more than one server process on one database |
| **Environment** | Windows 11, Node v24.13.1, better-sqlite3 13.0.3, WAL |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Summary

Pay a loan on one server while editing it on another, both sharing one SQLite
file, and **4 pairs in 40 answer 500**.

Spec §5 lists 500 as "unhandled — **must never be reachable through the UI**".
It was reachable, and the only reason nobody had seen it is that nothing had
ever run two servers against one database before this session.

## What the run said

<details>
<summary>Scenario C, before the fix</summary>

```
C · pay vs edit — TWO processes, one database file
  outcomes
      36 × pay 200 · edit 200
       4 × pay 200 · edit 500
    violations: 4

4 invariant violations:
  C pair 14: a 5xx (pay 200, edit 500)
  C pair 22: a 5xx (pay 200, edit 500)
  C pair 27: a 5xx (pay 200, edit 500)
  C pair 37: a 5xx (pay 200, edit 500)
```

```
SqliteError: database is locked
    at src/routes/schedules.js:199:8
    at sqliteTransaction (better-sqlite3/lib/methods/transaction.js:65:24)
  code: 'SQLITE_BUSY'
```

</details>

## Root cause

**The type of the transaction, not the code inside it.**

`db.transaction(fn)` issues a plain `BEGIN`, which SQLite treats as
**deferred**: the transaction takes a *read* lock when it starts and tries to
upgrade to a *write* lock at its first write. If another connection has written
in between, the upgrade cannot succeed — the snapshot this transaction has been
reading is now stale — so SQLite refuses **immediately** with `SQLITE_BUSY`.

The crucial part: **`busy_timeout` does not apply to that refusal.** Waiting is
pointless when the problem is that what you already read is out of date, so
SQLite does not wait. The five-second timeout added one defect earlier
(BUG-011) protects nothing here.

Two defects, both reporting "database is locked", with different mechanisms and
different fixes. That is the trap: the second one looked like a recurrence of
the first, and treating it as one would have produced a longer timeout and the
same 500s.

## Fix

```js
res.status(200).json(pay.immediate());
res.status(200).json(edit.immediate());
```

`BEGIN IMMEDIATE` takes the write lock **up front**, before reading anything.
There is no upgrade to fail, and acquiring that lock is an operation
`busy_timeout` does govern — so a second writer queues for up to five seconds
instead of being refused.

The rule this generalises to, and where it now lives: **D-030** — every handler
that reads a row, decides from it and writes does all three inside one
`.immediate()` transaction.

## Regression

```
before   4 of 40 cross-process pairs answered 500
after    40 of 40 answered 200, zero invariant violations
```

`qa/race/` runs two servers on one database on every invocation, so the
condition is now exercised rather than hypothetical.

## What this cost, stated

`BEGIN IMMEDIATE` holds the write lock for longer, so under heavy cross-process
write load, writers queue where a deferred begin might have slipped through. A
queued writer is a slow request; a refused one is a 500. The trade is right and
it is not free, and nothing measures it yet — the load smoke runs one process
per script. Recorded as the open half of D-030.

## → Rule R12

On SQLite in WAL mode, a transaction that will write must be `BEGIN IMMEDIATE`.
A deferred transaction that upgrades to a write is refused, not queued, and
`busy_timeout` will not save it.
