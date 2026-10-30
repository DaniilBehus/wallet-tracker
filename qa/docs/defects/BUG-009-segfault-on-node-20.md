**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-009-segfault-on-node-20.md)

# BUG-009 · The server segfaults on Node 20 in CI, so the first build was red

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The first CI attempt on Node 20 crashed at the native database layer; the historical failure is a runtime-compatibility case, not an application test pass.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | P0 — nothing in the pipeline can run |
| Component | `.github/workflows/ci.yml` — `NODE_VERSION`, and `package.json` `engines` |
| Found / affected build | S15; exact build only where recorded below |
| Environment / frequency | ubuntu-latest, Node 20, better-sqlite3 13.0.3; frequency only if stated below |

## Preconditions and test data

S15, the first CI run after the first push

## Reproduction

1. run the workflow on `ubuntu-latest` with `node-version: 20`.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

the same green suite as locally — 340 assertions, 92 e2e tests.
Spec §2 says Node 20+, and `package.json` said `engines: >=20`.

## Actual observation

The CI web server logged `Segmentation fault (core dumped)` and Playwright reported web-server **exit 139** (`SIGSEGV`). The API job's server also failed its health check. The dated CI output is reproduced in the investigation below.

## Evidence

- [Recorded CI workflow](../../../.github/workflows/ci.yml) and [package runtime constraint](../../../package.json).
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-009`.
- [GitHub Issue #9](https://github.com/DaniilBehus/wallet-tracker/issues/9) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

**CLOSED for the historical Node-20 floor mismatch.** The dated repair moved CI and the package engine declaration from Node 20 to a Node 22 floor required by `better-sqlite3@13.0.3`; the workflow was the regression check after the failed first run. The old report does not record a direct run ID in this front section. A later [runtime compatibility report](../test-report-runtime.md) documents the stricter current `22.14.0`/Node-API-10 guard. The exact native crash mechanism beyond the unsupported runtime was not isolated.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### Original report: BUG-009 · The server segfaults on Node 20 in CI, so the first build was red

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


</details>
