**English** · [Slovenčina](../../locales/sk/docs/analysis/README.md)

# Analysis models — Wallet behaviour and category limits

[← Back to README](../../README.md#start-here)

These are **models of a personal project**, not evidence of
enterprise or banking analysis. The AI diagrams describe the application
boundary; they do not claim live-model evaluation or measured model quality.

**Read the status first.** The existing AI and overall-monthly-limit processes
and sequence describe implemented behaviour. Category limits were frozen before
code at `4d08651` on 2026-09-28; their implementation is now public.
The [recorded test report](../../qa/docs/test-report-category-limits.md) separates
automated evidence from the [owner-reported 13/13 category UAT](../../qa/docs/uat-category-limits.md)
on the later named test build. The [current-build record](../../qa/docs/uat-current-build.md)
also records schedule editing, keyboard focus and Month refresh as owner-reported
PASS; optional lost Save/Pay response is **NOT RUN**. Models alone are not
evidence of executed tests or a general release waiver.

The six visible SVGs are **explanatory modular maps**, not BPMN or UML exports.
Each page links its retained formal SVG and editable `.bpmn` or `.mmd` model;
the original UML SVG is retained as its own formal source.

### Dated publication evidence — 2026-09-29

The category implementation and OpenAPI checks were published in
[build `ed22c71`](https://github.com/DaniilBehus/wallet-tracker/commit/ed22c717eb2a405c3f262aceea8d96739b619809).
[CI for that exact build](https://github.com/DaniilBehus/wallet-tracker/actions/runs/36531663045)
completed successfully, including the API contract and browser checks.
This is a dated publication record, not a promise about later builds; the live
CI badge is on the [root README](../../README.md#analyst-portfolio).
This dated CI result preceded the [later scoped owner acceptance](../../qa/docs/uat-category-limits.md).

## Choose a question

| Question | Model |
|---|---|
| What happens between describing an expense and saving it? | [AI expense map and formal BPMN](ai-expense-process.md) |
| Does a spending limit prevent an expense from being recorded? | [Monthly-limit map and formal BPMN](monthly-limit-process.md) |
| How is a category limit changed and judged? | [Category-limit map and formal BPMN](category-limit-process.md) |
| What goals can a person accomplish in Wallet? | [Capability map and formal UML](use-cases.md) |
| Which component writes, and what happens on a retry? | [Draft-and-save map and formal sequence](draft-save-sequence.md) |
| Which relationships and constraints exist? | [Data-model map and formal ERD](database.md) |

In the retained formal BPMN, solid arrows are sequence flows within a
participant and dashed arrows are messages between participants. These are
descriptive, non-executable models, not deployed workflow engines. The modular
maps use ordinary explanatory arrows; do not interpret them as BPMN notation.

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

For category limits, follow the specification and recorded proof:
[CL-D1…12 / REQ-CL-01…13](../../qa/docs/analysis-category-limits.md)
→ [process](category-limit-process.md)
→ [column and database CHECK](database.md)
→ [traceability](../../qa/docs/analysis-category-limits.md#5-traceability)
→ [recorded report](../../qa/docs/test-report-category-limits.md)
→ [owner-reported 13/13 acceptance](../../qa/docs/uat-category-limits.md).

[Whole-API contract and executable checks](../api/README.md) ·
[Selenium + Python browser checks](../../qa/selenium/README.md)

## Maintain and reproduce

Each page lists authoritative sources and simplifications. **Existing behaviour
was re-verified against the code at `4829b7d` on 2026-09-27.** The draft-and-save sequence
needed changing: it did not parse in Mermaid, and it now tells an editable
result from a refusal, shows the keyed save committing or rolling back, and
carries the request id. The database model, both BPMN models and the use cases
matched the code as drafted; one BPMN label was moved clear of a task. A stale
test comment is noted on the sequence page; it is not used as a requirement.

On 2026-09-28 the category formal models were completed against the accepted
specification, before category-limit production code. The later implementation
added the PATCH, column and editor. The visible modular maps describe
implementation; publication is recorded above and owner acceptance remains
separate. The dated freeze is retained in Git. The status change does not
change CL-D1…12 or the acceptance rules.

- Re-read the current contract, route, schema and tests before editing a model.
- Preserve optional fields, zero versus `NULL`, failure outcomes and write boundaries.
- Draw only declared database FKs; keep application ownership rules separate.
- Edit `.bpmn` / `.mmd` sources (the formal UML SVG is its editable source),
  regenerate formal SVGs under `formal/`, and keep Mermaid blocks in their
  pages identical to the `.mmd` files. Update the modular generator separately.
- Parse, render and visually inspect every model; check links, then run
  `npm run check` and `git diff --check`. Syntax does not prove semantic accuracy.

The modular maps need only Node and can be regenerated or checked without
installing packages:

```bash
node scripts/render-analysis-maps.js
node scripts/render-analysis-maps.js --check
```

Formal exporter tools, when available, live in Git-ignored `output/`; no
project dependency or lockfile change is needed. It uses a Playwright browser.
The first command below is a one-time optional tool setup, not a project
dependency change. `--check` compares retained formal SVG bytes without
rewriting them; omit it only when intentionally regenerating formal assets.

```bash
npm install --prefix output/analysis-tools --no-save --package-lock=false --ignore-scripts bpmn-js@18.30.1 mermaid@12.0.0
node scripts/render-analysis.js --check output/analysis-tools
node scripts/render-analysis.js output/analysis-tools
```

The formal script uses bpmn-js import (with the bpmn-moddle XML parser) and Mermaid's
actual `parse` and `render` APIs. Import warnings, broken local links, mismatched
Mermaid blocks, cropped text or a label that leaves its own box — a note, an
actor, a task — fail the check. Five formal SVGs under `formal/` are refreshed;
the retained formal UML SVG is checked but not regenerated. The exports are
byte-stable: arrow markers are
numbered instead of named at random, and Mermaid's line jitter has a fixed seed,
so a second run changes nothing. Six review PNGs go to `output/analysis-review/`
and are not committed; look at them too, because a label crossing a line is not
something a bounding-box check sees.

Tool references: [bpmn-js](https://bpmn.io/toolkit/bpmn-js/),
[Mermaid API](https://mermaid.js.org/config/usage),
[Mermaid ER notation](https://mermaid.js.org/syntax/entityRelationshipDiagram).

[Next: AI expense process →](ai-expense-process.md)
