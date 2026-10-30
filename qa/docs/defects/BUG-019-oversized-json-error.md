**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-019-oversized-json-error.md)

# BUG-019 · Oversized JSON is reported as an internal server failure

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

Oversized JSON received an internal-error response instead of the intended payload-too-large response.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | Not recorded separately |
| Component | `src/server.js` — JSON parsing and global error handler |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, isolated HTTP validation probe

## Reproduction

1. POST a syntactically valid JSON expense containing a note of 110000 ASCII characters against the local test server.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

a controlled payload-too-large response (413), not INTERNAL.

## Actual observation

500 with error.code INTERNAL; body-parser reports entity.too.large.

## Evidence

- [Recorded source: `src/server.js`](../../../src/server.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-019`.

## Resolution and verification

Current disposition: **CLOSED**. Register fix field: published in `2face59`. This status is limited to the documented finding and its own regression evidence.

Newman `POST /transactions with a body over the parser limit →
413, not 500 (BUG-019)`; pytest `test_ai_draft_with_the_feature_off_and_an_oversized_body`.
Both assert status and code; the Newman helper also asserts "never a 500".

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-019 · Oversized JSON is reported as an internal server failure · Medium · CLOSED

| | |
|---|---|
| Found in | S21, isolated HTTP validation probe |
| Component | `src/server.js` — JSON parsing and global error handler |

**Steps to reproduce:** POST a syntactically valid JSON expense containing a
note of 110000 ASCII characters against the local test server.
**Expected:** a controlled payload-too-large response (413), not INTERNAL.
**Actual:** 500 with error.code INTERNAL; body-parser reports entity.too.large.
**Root cause:** entity.parse.failed is handled, entity.too.large is not, so the
default 500 path replaces the parser's client-error status.
**Fix:** S23, uncommitted. `src/server.js` maps `entity.too.large` to 413
`PAYLOAD_TOO_LARGE` in the single error renderer, so the body never reaches the
UNHANDLED log. The global parser limit is unchanged; the AI draft route refuses
bodies over 8 KiB itself (400).
**Regression:** Newman `POST /transactions with a body over the parser limit →
413, not 500 (BUG-019)`; pytest `test_ai_draft_with_the_feature_off_and_an_oversized_body`.
Both assert status and code; the Newman helper also asserts "never a 500".
**→ Rule R14.**

</details>
