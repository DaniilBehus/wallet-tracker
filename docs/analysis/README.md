# Analysis models — current Wallet behaviour

[← Back to README](../../README.md#start-here)

These are **current-state models of a personal project**, not evidence of
enterprise or banking analysis. The AI diagrams describe the application
boundary; they do not claim live-model evaluation or measured model quality.

## Choose a question

| Question | Model |
|---|---|
| What happens between describing an expense and saving it? | [AI expense entry — BPMN 2.0](ai-expense-process.md) |
| Does a spending limit prevent an expense from being recorded? | [Monthly limit — BPMN 2.0](monthly-limit-process.md) |
| What goals can a person accomplish in Wallet? | [UML use cases](use-cases.md) |
| Which component writes, and what happens on a retry? | [Draft then explicit save — sequence](draft-save-sequence.md) |
| Which relationships does SQLite actually enforce? | [Implemented database — ERD](database.md) |

BPMN solid arrows are sequence flows within a participant; dashed arrows are
messages between participants. These are descriptive, non-executable BPMN 2.0
models, not deployed workflow engines. SVG previews open without a modeler.

## Follow one requirement

[REQ-ML-05 and its decision table](../../qa/docs/analysis-monthly-limit.md#3-decision-table--limit-state)
→ [limit process](monthly-limit-process.md)
→ [implementation](../../src/settings.js)
→ [TC-API-095–100](../../qa/docs/test-cases.md#api--monthly-spending-limit--folder-12)
→ [recorded report](../../qa/docs/test-report-monthly-limit.md).

For AI, follow [AI-R01 / AI-R02 / AI-R16](../../spec/ai-expense-entry.md#2-rules-acceptance-ids)
→ [sequence](draft-save-sequence.md)
→ [HTTP integration tests](../../qa/ai/tests/integration.test.js)
and [keyed-save tests](../../qa/ai/tests/idempotency.test.js).
Test links identify coverage; they do not assert a new behavioural run here.

## Maintain and reproduce

Each page lists authoritative sources and simplifications. **Re-verified
against the code at `4829b7d` on 2026-09-27.** The draft-and-save sequence
needed changing: it did not parse in Mermaid, and it now tells an editable
result from a refusal, shows the keyed save committing or rolling back, and
carries the request id. The database model, both BPMN models and the use cases
matched the code as drafted; one BPMN label was moved clear of a task. A stale
test comment is noted on the sequence page; it is not used as a requirement.

- Re-read the current contract, route, schema and tests before editing a model.
- Preserve optional fields, zero versus `NULL`, failure outcomes and write boundaries.
- Draw only declared database FKs; keep application ownership rules separate.
- Edit `.bpmn` / `.mmd` sources (the UML SVG is its editable source), regenerate
  previews, and keep Mermaid blocks in their pages identical to the `.mmd` files.
- Parse, render and visually inspect every model; check links, then run
  `npm run check` and `git diff --check`. Syntax does not prove semantic accuracy.

Temporary export tools live in Git-ignored `output/`; no project dependency or
lockfile change is needed. The repository's installed Playwright browser is used.

```bash
npm install --prefix output/analysis-tools --no-save --package-lock=false --ignore-scripts bpmn-js@18.30.1 mermaid@12.0.0
node scripts/render-analysis.js output/analysis-tools
```

The script uses bpmn-js import (with the bpmn-moddle XML parser) and Mermaid's
actual `parse` and `render` APIs. Import warnings, broken local links, mismatched
Mermaid blocks, cropped text or a label that leaves its own box — a note, an
actor, a task — fail the check. Four generated SVGs are refreshed; the UML SVG is
checked but not regenerated. The previews are byte-stable: arrow markers are
numbered instead of named at random, and Mermaid's line jitter has a fixed seed,
so a second run changes nothing. Five review PNGs go to `output/analysis-review/`
and are not committed; look at them too, because a label crossing a line is not
something a bounding-box check sees.

Tool references: [bpmn-js](https://bpmn.io/toolkit/bpmn-js/),
[Mermaid API](https://mermaid.js.org/config/usage),
[Mermaid ER notation](https://mermaid.js.org/syntax/entityRelationshipDiagram).

[Next: AI expense process →](ai-expense-process.md)
