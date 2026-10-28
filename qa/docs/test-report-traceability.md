**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-traceability.md)

# F13 semantic traceability repair — local review report

[← Back to README](../../README.md#qa-evidence) ·
[Core-rule index](../../spec/core-requirements.md) ·
[Case catalogue](test-cases.md)

Status: **IN PROGRESS — local, uncommitted; main and independent review
pending**. This is a static documentation/identity repair, not a new
behavioral run, remote CI result, owner UAT sign-off or CV skill claim.
It works on branch `work/claude-wallet-2026-09-24`, HEAD
`b270355c8c850282b10cc0a7bdeb81c88b784765`; the pre-edit
ORD-083 baseline matched 41/41 files.

## What changed, by source family

| Family | Definition source | Current mapping |
|---|---|---|
| Core | [core-requirements.md](../../spec/core-requirements.md) | 28 stable IDs derived from current public architecture/OpenAPI/support evidence; implementation-only detail is labelled, not presented as a recovered owner decision |
| Overall monthly limit | [analysis-monthly-limit.md](analysis-monthly-limit.md) | Existing REQ-ML-01…10 with explicit anchors; cases point to the exact rule |
| Category limit | [analysis-category-limits.md](analysis-category-limits.md) | Existing REQ-CL-01…13 with explicit anchors; shorthand multi-ID cells expanded to exact links |
| AI draft | [ai-expense-entry.md](../../spec/ai-expense-entry.md) | Existing AI-R01…21 with explicit anchors; the AI risk table corrects currency (R07), dates (R08/R09), ownership (CORE-04/R10), logging (R12/CORE-24) and manual Add (R03/R19) |
| Contract checks | [API README](../../docs/api/README.md#requirements-for-the-contract-checks) | Existing REQ-CONTRACT-01…06 with explicit anchors and exact catalogue links |
| Historical D and § labels | [migration index](../../spec/core-requirements.md#legacy-reference-migration-index) | Navigation only; original rationale/approval **UNKNOWN**. D-017 is environment/port context, not product behavior |
| Provisional import | [synthetic-import analysis](analysis-synthetic-import.md) | Still agent-authored and provisional; no fabricated accepted REQ or new catalogue row |

The catalogue still has **280 distinct case IDs**. Its steps, expected values,
priority and historical status cells were not rewritten. The first 229
seven-column rows received semantic current-rule/defect links; the remaining
51 category/contract rows received direct links in their existing
requirement/check cells. This changes navigation, not the date or result of
any historical run. Named `TC-CONTRACT-IMPORT` remains outside the catalogue;
F19 must reconcile executable inventory separately.

Some legacy case expectations still quote former clause numbers or dated UI
wording. Those expected-value cells are preserved as historical evidence, not
presented as current architecture anchors. The introductory trace wording
now explicitly separates link validity from semantic truth and execution.
The test plan's obsolete spec §4.1–4.3/§6/§6.5/§9 references now target current
rules or architecture sections; the runtime row links the maintained Node
policy instead of asserting an obsolete floor.

Manual source review corrected three easy-to-confuse boundaries in the core
index: the 8/72-byte password rule is for **registration**; expense
`spent_on` may reach server-local tomorrow while schedule `starts_on` has
no relative date bound; and a fresh account reads income `0`, while the
**limit**, not income, is nullable. This is why syntactically valid links
still need an independent semantic read.

## Architecture and checksum review

Only two architecture edits were made:

1. The stale `Node.js 22+` runtime row now links the actual version policy in
   `docs/testing.md` and `package.json`.
2. The quality section now links the new public rule index.

No other architecture rule or §5 test-ID contract changed. Raw-byte length
changed **8192 → 8349**. SHA-256 changed
`b0a9dd0a75c26dda1af571011ea286dce0a520c50cf38c851ee584acf19cbb06`
→ `32eb753d83cd5d3aa0b68f88f540ac0516c331523e02ac778f86cab0ae018836`.
The checksum file was updated alongside the document; C1 was not weakened.

## Static checker and bounded controls

`scripts/traceability.js` uses only Node built-ins. It fails closed for
empty/missing inputs, duplicate source definitions/anchors and case IDs,
missing or wrong anchors, unknown/unlinked IDs, wrong-source links, invalid
defect references and unsupported row forms. It treats repeated references
as references, not duplicate definitions. It reports the provisional import
boundary. AI has its own case register, so the checker does **not** require
every AI/feature requirement to appear in the 280-row core catalogue.

`qa/gates/traceability.test.js` had 17 pure in-memory controls at the
ORD-086 review freeze; ORD-087 adds four focused controls, for 21 now. The old
`§5 health` trace is a failing **fixture** and the repaired explicit link
passes; no claim is made that the old full tree was executed against this new
checker. Controls cover LF/CRLF, removed/misspelled/duplicate anchors,
definitions and cases, wrong-source and missing targets, unknown/unlinked
IDs, empty input, unsupported forms and defect references. A valid CORE-01
plus unsupported CORE-999 initially escaped the checker (16 pass / 1 fail);
after a generalized unknown-ID scan the same test passed (17/17).
A deliberately
wrong but syntactically valid health→auth link remains green: semantic
equivalence requires human review.

The standalone checker is **not wired into `npm run check` or CI** because
`scripts/check.js`, package metadata and workflow edits are outside this
order. F19 still owns full executable bidirectionality and current inventory.
This report therefore does not call static PASS full coverage.

## Actual local verification and limits

| Command, Node 22.14.0 portable | Result |
|---|---|
| `node --test qa/gates/traceability.test.js` | 21 pass, 0 fail, 0 skip after ORD-087; the earlier 17/17 belongs to the previous freeze |
| `node scripts/traceability.js` | STATIC PASS: 280 case IDs, 78 rule definitions |
| `node scripts/check.js` | C1/C2/C3/C5/C6/C7/C8/C9: 8 pass, 0 fail |

No server, browser, HTTP, database, AI provider, full suite, owner UAT or
remote CI was run here. The earlier five-second readiness failure remains
separate and unresolved; this work cannot relabel it green. The final
readback found all 39 protected ORD-083 hashes unchanged; the other two
frozen files (`test-plan.md`, `log/BUGS.md`) are the authorized edits.
All 280 case IDs and their steps, expected values, priorities and status
cells match the pre-repair catalogue exactly. Git status has 53 affected
paths: all 41 pre-existing dirty paths plus 12 additional paths, each of
those 12 in this order's allowlist; no unexpected path or clean-up occurred.
The prefix of `log/BUGS.md` before this new audit record hashes to
`27f15a779872891a368cf4c96f466e65fd7fd60db10b67f64c149e173edff5f9`,
identical to the frozen baseline; the log edit is append-only.

## Current artifact SHA-256

Raw-byte hashes of every changed ORD-085/087 artifact except this report itself
(a file cannot contain its own final hash):

```text
spec/core-requirements.md              468c2cbc34f5ab30fc2439a3874488a07010bbc106bfd65aa4aa959c6b8a4d27
spec/architecture.md                   32eb753d83cd5d3aa0b68f88f540ac0516c331523e02ac778f86cab0ae018836
spec/architecture.sha256               8fd9cc0c7b549f989469922db5d3a3740f7f1abb851a14705df209d6ad937d43
qa/docs/test-cases.md                  a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d
qa/docs/test-plan.md                   2eb700778afdb3590950cf7539335533a2b3c0d8b46501450752c61d2e3cd370
qa/docs/ai-test-plan.md                e0af218eefbc6f8279677bb63ba72747cc83df2db07183b5e694e1fedad9887c
qa/docs/analysis-monthly-limit.md      7994aa327f3ef81df4f5bb78076bce7611b42bd1edd7c4ea7b4c6efadc77d886
qa/docs/analysis-category-limits.md   796ef379ddba571bc0ef5eae7fa0c6eb4afd86e80d284b7cad19ee6942f5fdb0
spec/ai-expense-entry.md               2cb400a8843038bfea1cb01ece6c4d3d6b5216633a969fa4015b508e7b8a9510
docs/api/README.md                     add82b9668cfe1618648f849b97223d90858b7bcb18a1ebc44d3127ff549419a
scripts/traceability.js                0618ed8b86312816d7b493beec869790a8ec11df7716e29c5c0b4a59aec9722a
qa/gates/traceability.test.js          ebe5aa804a83a39428aacb29ad1c1f20a55c4a8fc934f2500688ace3884844a2
log/BUGS.md                            41771ab1a063072eac0a06f671cdc54a027fa863794c841afa339093c2bdd7cf
```

## ORD-087 narrow independent-review correction

The independent ORD-086 review **withheld local acceptance** for two bounded
findings; neither was a Wallet runtime defect.

- R01: TC-API-096/097/098/099 are decision-table rows R3–R8. Their four
  trace cells now all link [REQ-ML-05](analysis-monthly-limit.md#req-ml-05),
  not the unrelated ML-06/07/08/09 rules. The reviewed control pins this
  explicit expectation and nearby distinct cases (101→06, 102/103→07,
  104/105→08, E2E-065/066→09). It is a human-reviewed mapping assertion,
  not semantics inferred by the static parser.
- R02: appending `REQ-CORE-999` as an anchored source heading previously
  yielded `ok:true` and 78 definitions. The exact in-memory witness was
  added first and produced the expected red 17 pass / 1 fail. Source
  candidates are now found before validating typed family/ID/shape in each
  bounded definition block; an anchored rule-shaped definition outside its
  block also fails. Parallel LF/CRLF controls cover all five source families,
  wrong-family candidates and repeated plain references outside the block.
  A malformed or unsupported candidate cannot hide behind a valid source
  definition. This remains a bounded Markdown-format gate, not a general
  parser or a semantic oracle.

All pre-existing 17 controls remain; the current suite has 21. No product,
architecture, CI, package, existing executable scenario or case status changed
in ORD-087. F13 stays **IN PROGRESS** pending main and focused independent
follow-up; no new remote CI, owner UAT or F19 inventory claim is made.
The final readback found all **48/48** other ORD-086 file hashes unchanged.
Only the five ordered paths changed. The earlier 17/17 result remains evidence
for the ORD-086 freeze, not a claim about the new helper.
