# AI expense entry — evaluation

**Status on 2026-09-15:** fixture evaluation PASS · real-model evaluation **NOT RUN**.

Nothing on this page measures how well any language model extracts expenses.
The only numbers here come from fixture mode, where the corpus labels' own ideal
answers stand in for the model.

## 1. Dataset

`qa/ai/data/eval-cases.jsonl`, frozen as version 1 on 2026-09-14 with
`qa/ai/data/manifest.json` (sha256 `4b7e5bf4…3ff67`). The evaluator refuses to
run if the file's hash, row counts or holdout ids differ from the manifest.

| | Rows |
|---|---|
| Total | 116 |
| Supported natural-language rows (`kind: nl`) | 113 — dev 93, holdout 20 |
| by language | en 56 · uk 28 · sk 27 · mixed 2 |
| by expected status | ready 46 · needs_input 38 · unsupported 29 |
| Exploratory (Russian; never in a denominator) | 3 |
| Transport fixtures (separate file, not NL) | 15 in `qa/ai/fixtures/transport-cases.json` |

Every row has an id, split, language, tags, text, reference date, category
context, `fixture_output`, expected status / amount / allowed categories / date /
issue codes, and a rationale. `label_provenance` is `AGENT_AUTHORED` on all of
them: the labels were written together with the normaliser, by the same author,
and have not yet been reviewed independently.

**Holdout honesty.** The 20 holdout rows have never been shown to a model — no
model has been called. They were, however, run in fixture mode through the
normaliser, which was written by the same author. They are unseen by a model,
not independent of the code.

## 2. Modes

| Command | Mode | What answers | What it measures |
|---|---|---|---|
| `npm run eval:ai` | FIXTURE | each row's `fixture_output` | contracts, category refs, quota path, normaliser and this evaluator |
| `npm run eval:ai:live -- --dry-run` | — | nothing | corpus integrity, configuration, planned call count |
| `npm run eval:ai:live -- --limit N` | LIVE | the real OpenAI adapter | model extraction on the synthetic corpus |

Both runnable modes use the production draft service (`src/ai/service.js`) on a
throwaway or dedicated database with the clock set to each row's reference date
— not a re-implementation of the pipeline.

## 3. Metrics and targets

For supported rows (targets chosen for this project, plan §15; not benchmarks):

| Metric | Denominator | Target |
|---|---|---|
| Complete correct draft | rows labelled ready | ≥ 90 % |
| Amount | rows with a non-null expected amount | ≥ 98 % |
| Date | rows with a non-null expected date | ≥ 98 % |
| Category (allowed alternatives) | rows with expected categories | ≥ 90 % |
| False ready | all rows | 0 |
| Invented amount or date | all rows | 0 |
| Wrong non-null amount or date (D-037) | all rows | 0 |
| Fixture consistency (fixture mode only) | all rows | 100 % |

Also reported: coverage, status accuracy, expected-issue recall, invented
category, errors, per-language and per-split tables, p50/p95 latency and tokens
(live only). A guard rejection of a wrong model answer counts as an extraction
failure; an empty result is not scored as correct just because it is safe.

## 4. Fixture result (2026-09-15)

`MODE=FIXTURE MODEL_QUALITY=NOT_MEASURED RESULT=PASS`

| Metric | Result |
|---|---|
| Rows matching label | 113/113 |
| Complete correct draft | 46/46 |
| Amount / Date / Category | 60/60 · 75/75 · 79/79 |
| Coverage / Status / Issue recall | 46/46 · 113/113 · 113/113 |
| False ready / invented amount-date / wrong amount-date / invented category / errors | 0 · 0 · 0 · 0 · 0 |
| en · uk · sk · mixed | 56/56 · 28/28 · 27/27 · 2/2 |
| dev · holdout | 93/93 · 20/20 |
| Exploratory (not counted) | 3/3 |

Versions: schema 1, prompt 1 (instructions sha256 `bc229627…dbf43`), provider
schema sha256 `cca6754f…90e17`, normaliser 2 (D-037; the result is identical
under normaliser 1). Code: an earlier version of this
repository (its content hash is recorded in each JSON report).
Reports: `qa/reports/ai-eval/fixture-*.json|md` (git-ignored; ids and values only,
no descriptions, prompts or keys).

**Reading it correctly.** 100 % here means the normaliser, contracts and evaluator
agree with the labels when the "model" gives the labelled answer. It is a
consistency check. It would be alarming if it were lower; it says nothing about
a model when it is not.

## 5. Negative controls — can the evaluator fail?

`qa/ai/tests/evaluator.test.js`, run as part of `npm run test:ai`. Each control
damages one thing in a disposable copy; production files are not touched.

| Target | Damage | Expected | Observed |
|---|---|---|---|
| baseline | unmodified copy, resealed | PASS | exit 0, PASS |
| EVALUATOR | one row omitted | refused before scoring | exit 2, "total rows 115, manifest says 116" |
| EVALUATOR | row edited, manifest not resealed | refused | exit 2, hash mismatch |
| EVALUATOR | empty corpus; missing corpus file | no zero-case pass | exit 2 both |
| EVALUATOR | label amount 1800 → 1900 | FAIL naming row and field | exit 1, "fixture consistency 112/113", "AI-EVAL-001 … failed amount" |
| EVALUATOR | every answer "unsupported" | FAIL despite zero false-ready | complete 0/46, amount 0/60 |
| EVALUATOR | every answer an error; zero rows scored | FAIL | 113 errors; "no supported rows were scored" |
| EVALUATOR | two structural problems | both reported | both listed |
| EVALUATOR (R5) | one wrong non-null amount, accuracy still 98.3 % | FAIL | `wrong_numeric_fields 1` |
| EVALUATOR (R5) | one wrong non-null date | FAIL | `wrong_numeric_fields 1` |
| PRODUCTION GUARD | text says 180, model says 18 | not accepted | `AI_INVALID_RESPONSE` on that row |
| PRODUCTION GUARD | `currency_text: null` on "Lunch 10 USD" | never ready EUR | row still unsupported; false ready 0 |
| PRODUCTION GUARD | category ref `c999` | rejected, not mapped | `AI_INVALID_RESPONSE` |

## 6. Real-model evaluation

Real-model evaluation is **off by default** and is never part of `npm test` or
CI. It needs an explicitly configured key, model and finite allowance in a local
`.env` (never committed) and runs only through `npm run eval:ai:live`. This
repository claims **no real-model quality result**: two synthetic pilot requests
to Gemini Free ended with provider errors before any usable output, and no OpenAI
request has been made.

Setup, in a local `.env`:

```bash
OPENAI_API_KEY=…                  # a project-specific key with a spending limit set in the provider dashboard
WALLET_AI_MODEL=<a model checked against the current Structured Outputs docs>
WALLET_AI_LIVE_ALLOWED=true
WALLET_AI_EVAL_LIVE=true
WALLET_AI_EVAL_DAILY_CALLS=5      # the evaluation's own finite allowance (accepted 1–200)
```

then `npm run eval:ai:live -- --dry-run`, and only after reading its plan,
`npm run eval:ai:live -- --limit 1`, its usage line, and then a larger `--limit`.

**The evaluator has its own limits.** Do not raise `WALLET_AI_GLOBAL_DAILY_CALLS`
or `WALLET_AI_USER_DAILY_CALLS` for an evaluation: the same `.env` feeds
`npm start`, so that would raise the app's live limits too. The evaluator does not
read the application's call limits at all (`WALLET_AI_GLOBAL_DAILY_CALLS`,
`WALLET_AI_USER_DAILY_CALLS`, `WALLET_AI_USER_MINUTE_CALLS`,
`WALLET_AI_MAX_CONCURRENT`). It uses `WALLET_AI_EVAL_DAILY_CALLS`, counted in
`data/ai-eval.db` (never the app database) across runs with stable synthetic
users, the rolling window below, and fixed evaluator values: a non-binding minute
allowance of 100 and one concurrent call. A daily refusal ends the run as
INCOMPLETE. It does still use the shared request settings `WALLET_AI_TIMEOUT_MS`
and `WALLET_AI_MAX_OUTPUT_TOKENS`.

**Rolling window.** Independently of the daily allowance, the evaluator makes at
most 5 provider calls in any rolling 10 minutes — a constant in
`qa/ai/eval-window.js`, stored in the evaluation database (`eval_provider_calls`,
never pruned), shared by restarts, parallel processes and both providers. A run
planning more calls than are free is refused before any request (exit 3) with
`next call available at <time>`; each call reserves its slot atomically just
before dispatch and keeps it if it fails; a slot taken by another process
mid-run stops the run as INCOMPLETE. A `--limit 5` run makes its five calls
without a minute wait, whatever the application's `WALLET_AI_USER_MINUTE_CALLS`
says (W13).

**Two providers.** `WALLET_AI_PROVIDER` chooses `openai` (default) or `gemini`.
Gemini Free is for this synthetic corpus only, needs `GEMINI_API_KEY` and
`WALLET_AI_GEMINI_MODEL` (never an OpenAI key), and is refused by the
application, because free-tier input may be used to improve the provider's
products. A provider 429 is an error for that row, not a pause. Reports and the
holdout ledger name the provider, so a Gemini result is never read as an OpenAI
result. `npm run eval:ai:models` only lists the models a Gemini key can use; it
never generates.

What the live evaluator refuses (tested in
`qa/ai/tests/eval-*.test.js`):

- **An evaluation database that is an application database by any spelling** —
  same file through a junction, symlink, hard link, other letter case, SQLite
  companion name or a not-yet-created file under an aliased folder. Both
  `data/wallet.db` and `DB_PATH` are protected. Exit 2, before anything is read.
- **`--split all` in live mode.** One split per run: `--split dev` (default) or
  `--split holdout`. Exit 2.
- **A second holdout run** for the same corpus, model and declared versions,
  whoever started it and however it ended (errored, stopped, killed), unless
  `--rerun-holdout "<reason>"` records why. The reservation is one transaction
  before the first call; records are never deleted. Exit 3.
- **A holdout run that does not fit today's remaining allowance.** Exit 3,
  nothing reserved.

The dry run sends nothing and writes nothing. If `data/ai-eval.db` already
exists it opens it read-only to show how many calls are left today.

Every report now says:

- **Scope** — `FULL` or `PARTIAL`, and selected/available rows for the split.
- **Verdict** — `PILOT_ONLY` for any partial live run (a `--limit 1` PASS is a
  passing pilot, not acceptance), `DEV_THRESHOLDS_MET`/`_NOT_MET` or
  `HOLDOUT_THRESHOLDS_MET`/`_NOT_MET` only for a whole split, `NOT_ASSESSED` for
  an incomplete run or a source change during the run.
- **Requests** — real provider requests and local fake requests, separately.
- **Token usage** — known for K of N calls; the rest unknown, never 0; answers
  that were unusable but still reported usage (billed, e.g. `incomplete`,
  D-038 L7) are counted. No cost is computed.
- **Code** — a content manifest: sha256 of every allowlisted source file plus an
  aggregate, taken at start and end, including untracked files. Git HEAD is
  supplemental.

Before the first real call: confirm the chosen model against the current OpenAI
documentation for the Responses API with `text.format` JSON Schema, `store:false`
and refusal handling. The adapter was built from that documentation and tested
against a local fake; compatibility with a real account is unverified.

Holdout policy for when it does run: dev first; at most two documented prompt
revisions; then holdout once per frozen version (`--split holdout`), recorded
here with every failure and its classification. No reruns until a favourable
number appears. Note that a `--split holdout --limit 1` pilot already counts as
the holdout run for its versions and model.
