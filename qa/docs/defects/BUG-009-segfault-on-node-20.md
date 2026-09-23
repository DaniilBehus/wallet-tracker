# BUG-009 · The server segfaults on Node 20 in CI, so the first build was red

[← Back to README](../../../README.md#qa-evidence) · [Next: CI configuration →](../../../.github/workflows/ci.yml)

![severity](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | High |
| **Priority** | P0 — nothing in the pipeline can run |
| **State** | CLOSED 2026-09-05 |
| **Found by** | the first CI run after the first push |
| **Component** | `.github/workflows/ci.yml` — `NODE_VERSION`; `package.json` — `engines` |
| **Affects** | both jobs that start the server: **api** and **e2e** |
| **Environment** | ubuntu-latest, Node 20, better-sqlite3 13.0.3 |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Summary

The application runs green on the machine it is written on — 340 API
assertions, 92 end-to-end tests — and its server dies on startup in CI with a
segmentation fault.

## What CI said

The e2e job, where the server is started in the foreground by Playwright:

```
[WebServer] Segmentation fault (core dumped)
Error: Process from config.webServer was not able to start. Exit code: 139
```

139 is 128 + 11: **SIGSEGV**.

The api job had hit the same thing one job earlier and said so much more
quietly, because its server is started in the background:

```
the server at http://localhost:3001 never became healthy (fetch failed)
```

## Root cause

`better-sqlite3@13.0.3` declares:

```json
"engines": { "node": ">=22" }
```

CI pinned Node **20**. npm treats `engines` as advice unless `engine-strict` is
turned on, so `npm ci` installed happily, and the native binary was loaded into
a runtime it was not built for. It did not throw — native code cannot politely
decline an ABI mismatch — it died with SIGSEGV.

Two of our own files carried the same wrong claim:

| | Said | True |
|---|---|---|
| `package.json` `engines` | `>=20` | `>=22`, forced by better-sqlite3 |
| `.github/workflows/ci.yml` | `NODE_VERSION: '20'` | a runtime the dependency does not support |

Nothing lied deliberately. The floor was written when the dependency list was
short, and the dependency raised its own floor later — quietly, in a version
bump nobody re-read. **A stated minimum version is a claim, and a claim nothing
checks decays.**

## Why it could not be seen locally

The machine it is developed on runs Node v24.13.1, which satisfies `>=22`. The
only environment that used Node 20 was CI, and CI had never run — this was the
first push. So the defect existed from the day `better-sqlite3` went to 13 and
was undetectable until the moment it was detected.

**Also worth stating separately:** Node 20 reached end of life in April 2026.
CI was pinned to an unsupported runtime, which is a problem in its own right;
the segfault only made it visible.

## Fix

```yaml
NODE_VERSION: '22'
```

```json
"engines": { "node": ">=22" }
```

Recorded as **D-028**, which also records the conflict with spec §2's
"Node.js 20+". The spec is not edited — the departure is a dated decision, the
same procedure as D-004.

**Why 22 and not the 24 this is written on.** 22 is the floor the project now
claims, and the floor is the version most likely to break. The top of the range
is already covered by the machine it is developed on. A CI that only ever tests
the newest runtime cannot tell you whether your stated minimum is a real number
or a hopeful one.

## Regression

The workflow itself, and its previous run is the failing case — kept in the run
history rather than described from memory.

## → Rule R11

A minimum supported version is a claim, and every dependency can invalidate it
without saying so. Check what the dependencies actually require, and run CI at
the floor rather than at the version you happen to develop on.
