**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-034-node-native-runtime-floor.md)

# BUG-034 · Declared Node 22 floor could load a SQLite binding requiring Node-API 10

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The declared Node 22 minimum could load a SQLite native binding on a Node-API version below that binding’s requirement.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | package engine, CI Node baseline, database bootstrap |
| Found / affected build | 2026-10-11 runtime controls; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-11 runtime compatibility controls

## Reproduction

A complete numbered reproduction recipe was not recorded in the historical observation. See the dated evidence below; do not treat a reconstructed recipe as an executed test.

## Expected and requirement

The stated Node floor must match the binding’s Node-API requirement, with a clear failure before loading the native module on an unsupported runtime.

## Actual observation

Package metadata accepted Node 22.9 even though the installed SQLite binding required Node-API 10, which starts at Node 22.14 in the 22 line. The exact historical native-crash cause was not isolated.

## Evidence

- [Recorded source: `qa/docs/test-report-runtime.md`](../../../qa/docs/test-report-runtime.md)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-034`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [Version/Node-API guard controls](../../../qa/docs/test-report-runtime.md); current CI uses the declared Node 22.14.0 floor. Future runtime versions and the historical native crash mechanism are not proved.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-034 · Declared Node floor could load an incompatible native binding · High · IN PROGRESS

| Found in | 2026-10-11 runtime compatibility controls |
| Component | package engine, CI Node baseline, database bootstrap |

**Problem:** `>=22` accepted Node 22.9 while the installed SQLite binding
requires Node-API 10, first available in the 22 line at 22.14. The observed
native crash is consistent with this mismatch; the exact native failure cause
was not isolated.
**Expected:** truthful metadata and CI floor, plus a clear error before loading
the native binding or creating a data directory on an unsupported runtime.
**Fix:** local and uncommitted; the package and lock root use
`^22.14.0 || >=23.6.0`, CI pins 22.14.0, and the database bootstrap calls a
built-in-only stable-version/Node-API guard first.
**Regression:** focused [runtime controls](../../../qa/docs/test-report-runtime.md)
failed before the fix and cover the version/API boundaries, workflow wiring
and child-process import order. The exact final local results are in that
report. Full remote CI and future-version compatibility remain unverified.
**→ No rule — one-off.**

</details>
