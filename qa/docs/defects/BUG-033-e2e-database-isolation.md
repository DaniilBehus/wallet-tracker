**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-033-e2e-database-isolation.md)

# BUG-033 · Main E2E reused one database between runs and ignored DB_PATH

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The main E2E configuration reused a fixed SQLite file and ignored a caller-provided DB_PATH, reducing run isolation.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `playwright.config.js`, managed main E2E runner |
| Found / affected build | 2026-10-11 config/control audit; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-11, main Playwright configuration and focused negative control

## Reproduction

A complete numbered reproduction recipe was not recorded in the historical observation. See the dated evidence below; do not treat a reconstructed recipe as an executed test.

## Expected and requirement

Each default E2E invocation should use a fresh owned database; a safe explicit DB_PATH override should be honored.

## Actual observation

The earlier Playwright configuration always selected `data/e2e.db` even when DB_PATH was supplied, so repeated invocations shared a persistent database.

## Evidence

- [Recorded source: `qa/docs/test-report-e2e-isolation.md`](../../../qa/docs/test-report-e2e-isolation.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-033`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Isolated database and sidecar negative controls](../../../qa/docs/test-report-e2e-isolation.md); E2E runner and Playwright CI passed. A forced kill or sidecar TOCTOU is not claimed solved.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-033 · Main E2E reused one database between runs and ignored DB_PATH · Medium · IN PROGRESS

| Found in | 2026-10-11, main Playwright configuration and focused negative control |
| Component | `playwright.config.js`, managed main E2E runner |

**Problem:** the prior config always selected `data/e2e.db`, regardless of a
caller-provided `DB_PATH`, so repeated suite invocations used a persistent
database. No observed 429, measured growth or data loss is asserted here.
**Expected:** a fresh default database for every main E2E invocation and a
safe explicit override; cleanup only after the owned server stops.
**Fix:** local and uncommitted. A parent runner outside browser specs owns both
children and a unique temporary directory, refuses existing/protected override
paths and external targets, and removes only its owned default after confirmed
child closure. Explicit new files remain with the caller. No application or
browser-spec assertions changed.
**Regression:** initial 0/5 included one real fixed-path failure and four
missing-runner harness failures; after the first implementation 4/5, with old
wiring remaining. Final focused Node controls 24/24 and static check 8/8 after
structural relocation and an actual retained-override control. One full local
main E2E run passed 192/192 across
phone and desktop, with confirmed server closure and owned-default cleanup;
old DB length/mtime stayed the same and the app DB remained absent. Remote CI
is not yet claimed. Forced parent termination may leave temporary data;
fixed-port parallel commands remain unsupported by default.
[Details](../../../qa/docs/test-report-e2e-isolation.md).
**→ No rule — one-off.**

**BUG-033 sidecar addendum, 2026-10-11:** the first explicit-path guard refused
sidecar *names* as `DB_PATH` but accepted a new base next to an existing
`-wal`, `-shm` or `-journal`. Disposable probes reproduced all three without
opening SQLite. A failing-before control exposed `-wal`; the local correction
now refuses all three via `lstat` before `wx`, with no base or child start and
unchanged sidecar sentinel bytes/identity. Affected controls: 26 pass, 1
optional dangling-symlink fixture skipped for Windows privilege, 0 fail;
static check 8/8. The earlier full 192/192 browser result was **before** this
guard, not a run of the newest tree. Concurrent sidecar creation after preflight
remains a TOCTOU limit; remote CI is still unverified.

</details>
