# Category spending limits — planned BPMN 2.0 process

[← Back to README](../../README.md#start-here) · [Analysis index](README.md) · [Next: database model →](database.md)

**Planned behaviour, not implemented or tested yet.** This model is part of the
frozen category-limit specification. Existing overall-limit behaviour is shown
separately in the [monthly limit model](monthly-limit-process.md).

![Planned category-limit process: validate and scope a set or clear request, save expenses without budget blocking, then judge each month-breakdown row on read](category-limit-process.svg)

[Full-size SVG](category-limit-process.svg) · [Editable BPMN 2.0 source](category-limit-process.bpmn)

## Read the process

1. An authenticated person sets or clears a category limit, or records a valid
   expense / paid instalment. Invalid limit input is refused without a write;
   a missing category and another account's category both return `404`.
2. A limit write stores one current integer value, including `0`, or explicitly
   clears it with `null`. An empty / unknown-field PATCH is invalid, not a clear.
   Saving an otherwise valid expense never checks whether a budget is exceeded.
3. A separate `GET /api/summary` read aggregates actual expenses for the selected
   month. Paid instalments are expenses; unpaid instalments and income are not.
   Limited categories are listed even at zero spend. No-limit, no-spend categories
   stay hidden; Uncategorised is listed only when it has spending.
4. The expanded multi-instance subprocess judges each listed row. Uncategorised
   and a `NULL` limit are `not_set`. Otherwise `T < L` is `within`, `T = L` is
   `reached` (including both zero), and `T > L` is `exceeded`. Remaining is `L - T`.
5. The browser uses the returned state: white outline while budget remains;
   solid red box with white text at reached / exceeded. Words distinguish those
   two states; no-limit rows show no box and Uncategorised has no editor.

## Scope and simplifications

- Solid arrows stay within a participant; dashed arrows are messages across
  participants. This is descriptive, non-executable BPMN, not a workflow engine.
- The diagram follows a write and its subsequent breakdown refresh. A standalone
  summary read uses the same aggregation and judgement without any preceding
  write. A category limit never changes the overall limit or validates their sum.
- The person/browser participant is a black box. Authentication is a precondition;
  invalid expense / schedule input keeps its existing validation and conflict
  behaviour, outside this category-limit process. “Saved whatever the limit says”
  means valid expenses only, not arbitrary invalid requests.
- Current limits apply to any queried month; no per-month history, forecast,
  notification, category rename/delete or automatic payment is introduced.
- The per-row loop can be empty. Status and remaining are derived, never stored.

## Specification and future proof

- [CL-D1…CL-D12, requirements and decision table](../../qa/docs/analysis-category-limits.md).
- [Architecture: target data model](../../spec/architecture.md#3-data-model-and-invariants),
  [API](../../spec/architecture.md#4-api-design) and
  [interface](../../spec/architecture.md#5-interface-and-interaction-design).
- [Existing judgement function](../../src/settings.js): reuse `limitState`, not a
  second browser-side comparison. This link is a reuse target, not completed
  category-limit coverage.
- [Planned traceability](../../qa/docs/analysis-category-limits.md#5-traceability):
  case IDs and results remain empty until actual implementation and execution.

No API, database, browser regression or owner UAT success is claimed here.
