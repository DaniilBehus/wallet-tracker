**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-011-startup-database-lock.md)

# BUG-011 · Two servers started at once on one database, and one dies at boot

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Starting two servers on one SQLite database exposed a startup lock failure in one process.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `src/db.js` — the boot pragmas |
| Found / affected build | S16; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S16, the first time `qa/race/` tried to start two servers against one file

## Reproduction

1. delete the database file, then start two servers with the same `DB_PATH` at the same moment. Under CPU load, one of them dies before it listens.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

both start. Nothing in the app claims a database may have only one
process on it, and SQLite is built for exactly this.

## Actual observation

```
SqliteError: database is locked
    at Database.pragma (better-sqlite3/lib/methods/pragma.js:11:44)
    at Object.<anonymous> (src/db.js:16:4)
  code: 'SQLITE_BUSY'
```

## Evidence

- [Recorded source: `qa/race/`](../../../qa/race/)
- [Recorded source: `src/db.js`](../../../src/db.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-011`.
- [GitHub Issue #12](https://github.com/DaniilBehus/wallet-tracker/issues/12) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

**CLOSED.** Database bootstrap now sets `busy_timeout` first, retries lock-sensitive PRAGMA/schema steps for up to five seconds, and reads journal mode before changing it. Under the same six-CPU-hog condition, the old code had **2 startup deaths in 20 trials** and the fixed code **0 in 20**; `qa/race/` also starts two servers on one file each run. This startup-lock mechanism is separate from BUG-012's deferred-transaction write upgrade.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-011 · Two servers started at once on one database, and one dies at boot · Medium · CLOSED

| | |
|---|---|
| Found in | S16, the first time `qa/race/` tried to start two servers against one file |
| Component | `src/db.js` — the boot pragmas |

**Steps to reproduce:** delete the database file, then start two servers with
the same `DB_PATH` at the same moment. Under CPU load, one of them dies before
it listens.

**Expected:** both start. Nothing in the app claims a database may have only one
process on it, and SQLite is built for exactly this.

**Actual:**

```
SqliteError: database is locked
    at Database.pragma (better-sqlite3/lib/methods/pragma.js:11:44)
    at Object.<anonymous> (src/db.js:16:4)
  code: 'SQLITE_BUSY'
```

**Root cause:** `db.pragma('journal_mode = WAL')` needs a lock no other
connection is holding. On a **fresh** file both processes attempt the switch,
and the loser gets SQLITE_BUSY. Later boots are unaffected — the file is already
in WAL and the statement is a no-op — which is why it is a first-boot defect and
why it hid for so long.

`busy_timeout` alone does not fix it, and finding that out is the useful part:
after adding it, a run still died — this time inside the **read** of
`journal_mode`. Some pragma paths refuse rather than queue, and a pragma that
cannot be read is not one that can be waited for.

**Measured, because the first attempt to reproduce it failed and a defect
nobody can provoke on demand is a story:**

| | deaths |
|---|---|
| original code, idle machine, 42 trials | 0 |
| original code, **6 CPU hogs running**, 20 trials | **2** (SQLITE_BUSY) |
| fixed code, same load, 20 trials | 0 |

Load is the trigger: it widens the window between the first process's schema
write and the second process's pragma. Two earlier sightings had both happened
while the machine was busy, which at the time looked like coincidence.

**Fix:** `busy_timeout` first, then a `whileLocked(label, step)` helper that
retries a boot step for up to five seconds while SQLite reports a lock — applied
to the pragmas and to the schema replay. The journal mode is now **read before
it is set**, so the contended write happens only on the one boot that has to
perform it.

**Regression:** the 20-trial harness under load, and `qa/race/` itself, which
starts two servers on one file every time it runs.

**→ Rule R12.**

---

</details>
