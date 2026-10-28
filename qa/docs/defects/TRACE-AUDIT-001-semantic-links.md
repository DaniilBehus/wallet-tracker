**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/TRACE-AUDIT-001-semantic-links.md)

# TRACE-AUDIT-001 · Public semantic traceability drift

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

The public case catalogue and AI risk links referenced existing IDs whose meanings no longer matched. This is a traceability finding, not a newly observed runtime defect.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Traceability audit finding |
| Status | **CLOSED** — current canonical register |
| Severity | Not applicable |
| Priority | Not recorded separately |
| Component | Public architecture references, case catalogue, feature-rule anchors and AI risk table |
| Found / affected build | 2026-10-12 F13 review; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

2026-10-12, F13 read-only inventory and bounded local repair

## Observation or measurement procedure

A complete numbered reproduction recipe was not recorded in the historical observation. See the dated evidence below; do not treat a reconstructed recipe as an executed test.

## Expected and requirement

Links from a test case or risk to a requirement ID should match that requirement’s meaning, not merely an existing anchor.

## Actual observation

The catalogue contained retired architecture clause numbers and some AI risk links pointed to existing IDs with different meanings; existence checks alone passed those links.

## Evidence

- [Recorded source: `qa/docs/test-report-traceability.md`](../../../qa/docs/test-report-traceability.md)
- [Recorded source: `scripts/check.js`](../../../scripts/check.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `TRACE-AUDIT-001`.

## Resolution and verification

Current register status: **CLOSED**. The dated reconciliation records: [F13 semantic-link correction and negative controls](../../../qa/docs/test-report-traceability.md), scoped independent acceptance and current CI `f13-traceability` task. The checker cannot prove all case semantics; synthetic import remains provisional.

The original investigation below may use an earlier `IN PROGRESS` or “local/uncommitted” label. It is preserved as historical evidence, not a competing current status. This documentation migration ran no new scenario.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### TRACE-AUDIT-001 · Public semantic traceability drift · IN PROGRESS

| Found in | 2026-10-12, F13 read-only inventory and bounded local repair |
| Component | Public architecture references, case catalogue, feature-rule anchors and AI risk table |

**Observation:** the 280-row catalogue used retired architecture clause
numbers, and some AI risk links pointed at real IDs with different meanings.
Existence of an ID alone did not prove semantic traceability. The synthetic
import analysis is still explicitly provisional.

**Local repair:** a public core-rule migration index, stable anchors on
existing feature-rule sources, corrected catalogue and AI-plan links, plus a
standalone built-in-only static identity/link checker with negative controls.
The two authorized architecture edits and paired SHA are reviewed in the
[F13 report](../../../qa/docs/test-report-traceability.md). No historic case
result was rerun or changed.

**Verification:** local Node 22.14.0: 17/17 new static controls, 280 case
IDs / 78 rule definitions in the standalone checker, and existing
`scripts/check.js` 8/8. Static identity cannot establish case meaning,
executed coverage, owner acceptance or a new CI result. Independent main/
Critic review and publication remain pending. **Do not mark FIXED** from this
local result.

**ORD-087 independent-review addendum, 2026-10-12 — IN PROGRESS:** the
ORD-086 review withheld local F13 acceptance for four semantically wrong
monthly-limit links (TC-API-096–099) and a source-definition parser that
accepted an extra anchored CORE-999. The four links now target REQ-ML-05.
An in-memory CORE-999 control failed before the parser repair (17 pass /
1 fail); bounded source-family, LF/CRLF and wrong-family controls were added
without promoting repeated references to definitions. Latest focused
results and artifact hashes are in the
[F13 report](../../../qa/docs/test-report-traceability.md). This addendum does
not change historical statuses, establish runtime behavior or close the
audit; independent follow-up and publication remain pending.

<!-- F20-F21 status addendum begin -->

</details>
