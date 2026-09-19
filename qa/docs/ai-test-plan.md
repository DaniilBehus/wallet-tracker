# AI expense entry — test plan and case register

Scope: the optional "Describe an expense" feature (`spec/ai-expense-entry.md`,
D-033…D-040). Written in S23 alongside the implementation; label provenance of
every case below is **AGENT_AUTHORED** until an independent review.

## 1. What must never happen

These are the product risks, in order. Every layer below exists to catch one of
them, and the case register names which.

| Risk | Rule | Where it is caught |
|---|---|---|
| A description creates an expense without Save | AI-R01 | integration (every branch counts rows), browser, evaluator |
| A number, date or currency is invented or coerced | AI-R05, R06 | normaliser unit tests, evaluator, production-guard controls |
| A foreign currency becomes a EUR expense | AI-R05 | scanner guard, evaluator control on `Lunch 10 USD` |
| A retry saves twice, or resurrects a deleted expense | AI-R16 | idempotency tests, Newman, pytest, browser lost-response retry |
| Two deliberate identical purchases collapse into one | AI-R17 | idempotency tests, unkeyed Newman/race D |
| Another user's data reaches the provider or the response | AI-R08 | integration isolation, payload privacy test |
| A key, prompt or provider body leaks into logs or errors | AI-R11 | integration log test, adapter tests |
| Spending is unbounded: retries, parallel users, restarts | AI-R18 | limits unit tests, integration limits, restart test |
| A test run reaches the internet | AI-R13 | network guard + its own fail-closed tests |
| An old response lands on a new description or account | UI state machine | browser stale-response tests |
| The feature makes manual Add worse | AI-R19, BUG-014 | layout tests at 320×568 / 375×667, main e2e suite |

## 2. Layers

| Command | What runs | Network |
|---|---|---|
| `npm run test:ai` | node:test — normaliser, contracts, config, adapter, limits, HTTP integration, idempotency, network guard, evaluator controls, live-evaluator safety (real evaluator process, fake provider): allowance, database identity, holdout ledger, content provenance, report rendering; provider selection and the Gemini evaluation adapter (D-040); UI state machine (component level), demo | guard preloaded; fake provider on loopback; synthetic databases and disposable source copies in the OS temp directory |
| `npm run eval:ai` | fixture evaluation of 116 corpus rows through the production service; report carries the content manifest | guard loaded |
| `npm run eval:ai:live -- --dry-run` | corpus + config validation, planned calls, manifest; reads an existing evaluation database read-only | zero calls, zero writes |
| `npm run test:ai:e2e` | Playwright, live-mode server with fake provider + demo server | loopback only |
| `npm run test:api` | Newman folder 11: off-mode AI contract, keyed saves, 413 | loopback |
| `npm run test:python` | `test_ai_keyed.py` | loopback |
| `npm run check` | C6 AI routes in the collection; C7 new testids in POMs; C8 statuses from collection **or** `qa/ai` | — |

Real-model evaluation is a separate, explicitly enabled step and is **not** part
of any default command (see `qa/docs/ai-evaluation.md`).

## 3. Entry and exit

Entry: spec and decisions written (D-033…D-035), corpus frozen with a manifest
hash before the normaliser was tuned, baseline suites green (P0).

Exit for the offline block: every command in §2 green; negative controls run and
recorded, including the ones that did **not** turn red; screenshots inspected;
nothing claimed about model quality.

## 4. Case register (TC-AI)

Kept here, separate from `qa/docs/test-cases.md`, which catalogues the core
application. The AI cases keep their own `TC-AI-###` ids.

| ID | Case | Evidence |
|---|---|---|
| TC-AI-001 | Capabilities in live mode: exact flags, no secret | integration `capabilities: live-mode flags…` |
| TC-AI-002 | Off mode: capability disabled, draft 503, keypad save still 201 | integration; Newman 11 |
| TC-AI-003 | Live requested with a key but no model: unavailable, names logged, key not | integration |
| TC-AI-004 | Nine pre-dispatch refusals (401, extra key, blank, 501 chars, >8 KiB, malformed JSON, date ±3, consent false/missing) — zero calls, zero rows | integration |
| TC-AI-005 | Reference date ±1 day accepted | integration |
| TC-AI-006 | More than 100 categories → 422 before any call | integration |
| TC-AI-007 | Ready UK draft: exact cents, category, yesterday, provenance, versions; payload has no ids, e-mail, JWT | integration |
| TC-AI-008 | 15 transport fixtures: null currency on USD, reference-date mismatch, unknown ref, 180-vs-18, invented note, refusal, incomplete, malformed envelope, upstream 429 and 500, redirect, 128 KiB body over the 64 KiB cap, non-expense intent | integration × `fixtures/transport-cases.json` |
| TC-AI-009 | User isolation of category context | integration |
| TC-AI-010 | Global daily cap holds across 8 parallel users; Retry-After | integration |
| TC-AI-011 | Provider timeout → 504; failed attempts keep their reservation; minute cap follows | integration |
| TC-AI-012 | Daily counts survive a restart | integration |
| TC-AI-013 | One in-flight request per user; client abort releases the slot | integration |
| TC-AI-014 | Logs hold outcome codes only | integration |
| TC-AI-015 | Keyed replay, key order, 20 concurrent same-key saves → 1 row | idempotency; pytest |
| TC-AI-016 | Conflict 409; per-user keys; different keys and unkeyed duplicates stay separate | idempotency; Newman 11; pytest |
| TC-AI-017 | Replay after delete → 409, no resurrection; replay after edit keeps the edit | idempotency; Newman 11 |
| TC-AI-018 | Invalid keys and keyed saves without date → 400; foreign category refused | idempotency; Newman 11 |
| TC-AI-019 | Key survives restart; database without the new tables upgrades twice | idempotency |
| TC-AI-020 | Network guard: fetch, TCP, TLS to public hosts refused; loopback allowed; live server without fake fails 502 | network-guard |
| TC-AI-021 | Evaluator refuses omitted row, edited row, empty corpus, missing file | evaluator controls |
| TC-AI-022 | Evaluator fails a mislabelled row, all-unsupported answers, errors, zero rows | evaluator controls |
| TC-AI-023 | Production guard: 180-vs-18, null currency on USD, unknown ref | evaluator controls |
| TC-AI-024 | Demo: banner, EN/UK/SK examples, unknown text DEMO_UNSUPPORTED, missing category, env key ignored, ordinary server stays off | demo tests; browser demo |
| TC-AI-025 | Browser: consent unchecked, no call until Suggest | `ai-entry.spec.js` |
| TC-AI-026 | Browser: ready draft reviewed and saved only on Save; manual Add untouched | `ai-entry.spec.js` |
| TC-AI-027 | Browser: needs-input blocks Save until corrected | `ai-entry.spec.js` |
| TC-AI-028 | Browser: unsupported explanation; provider failure recoverable | `ai-entry.spec.js` |
| TC-AI-029 | Browser: response after Cancel / after editing the text is not applied | `ai-entry.spec.js` |
| TC-AI-030 | Browser: double Save → one row; lost response → uncertain state → same-key retry → one row | `ai-entry.spec.js` |
| TC-AI-031 | Browser: previous-month date says "Saved for …" | `ai-entry.spec.js` |
| TC-AI-032 | Browser: markup shown as text, never executed | `ai-entry.spec.js` |
| TC-AI-033 | Browser: 500 emoji fit, 501 do not (code points) | `ai-entry.spec.js` |
| TC-AI-034 | Browser: keyboard open, focus, Escape, focus return; feature off hides entry | `ai-entry.spec.js` |
| TC-AI-035 | Browser 320×568: every review field and Save reachable, no sideways scroll | `ai-entry.spec.js` |
| TC-AI-036 | BUG-014: category list ≥ 120 px, two rows visible, flow completes at 320×568 and 375×667 | `add-layout.spec.js` |
| TC-AI-037 | The entry button never covers the amount (4 viewports) | `add-layout.spec.js` |
| TC-AI-038 | BUG-019: oversized JSON → 413 PAYLOAD_TOO_LARGE | Newman 11; pytest |
| TC-AI-039 | R1–R4: glued currency codes, minus before marker, digits glued to letters, weekday/"ago" dates never yield a ready draft | `normalize.test.js` R1–R4 |
| TC-AI-040 | R5: one wrong non-null amount or date fails the evaluation | `evaluator.test.js` R5 |
| TC-AI-041 | R6–R8: silent save ends "not confirmed"; malformed 201 keeps the key; abandon resets controls | `ui-state.test.js` |
| TC-AI-042 | R9: a response delivered despite abort is not applied (generation check), with its mutation control | `ui-state.test.js` |
| TC-AI-043 | L1–L6: live evaluator needs its own allowance, never uses or raises app pilot caps, never the app DB, stable users, holdout once, dry run guard-proven | `evaluator-live.test.js` |
| TC-AI-044 | L7: a billed incomplete or invalid provider answer keeps its token usage (incl. reasoning tokens) | `openai-adapter.test.js` L7; `evaluator-live.test.js` L4 |
| TC-AI-045 | U1–U2: an old session's answer or 401 never reaches the new person; a category deleted before Save is refused, reloaded, and a new choice gets a new key | `ui-state.test.js` U1, U2 (with mutation controls) |
| TC-AI-046 | N1: the live evaluator refuses an application database reached by the same path, a relative or other-case spelling, a directory junction/symlink, a hard link, a file symlink (where creatable), a not-yet-created file under an aliased folder, the default `data/wallet.db` with or without `DB_PATH`, a SQLite companion name, a Windows alternate data stream — exit 2, zero calls, sentinel bytes and schema unchanged; a distinct evaluation DB works, keeps its quota, and a dry run reads it without change | `eval-db-identity.test.js` N1.1–N1.7 (controls M-N1a…M-N1e, M-N1ab) |
| TC-AI-047 | N2: live `--split all` refused; dev never touches the ledger; first holdout run recorded with corpus, model and versions, repeat refused, reason reruns and keeps history; two racing processes → one run; a killed run keeps its reservation; a provider error still counts; a holdout run that does not fit today's allowance is refused before reserving; old ledger rows preserved and counted; an unrelated comment grants no new first run | `eval-holdout.test.js` N2.1–N2.9 (controls M-N2a…M-N2g) |
| TC-AI-048 | N3: an untracked normaliser or evaluator change changes the recorded identity; secrets, databases and reports never enter the manifest; a change during a run is reported; checkout and no-Git copy give the same manifest and the same file list as `git ls-files`; links are not followed; missing required inputs are named | `eval-provenance.test.js` N3.1–N3.7 (controls M-N3a…M-N3c) |
| TC-AI-049 | N4: live-test-seam and fixture reports render requests, usage, scope and verdict with nothing undefined; 216 renderer combinations; same heading for PASS/FAIL/INCOMPLETE; unknown usage never 0; pilot never acceptance, dev and holdout verdicts distinct; real vs fake requests; no invented cost; Markdown agrees with JSON | `eval-report.test.js` N4.1–N4.8 (controls M-N4a…M-N4c) |
| TC-AI-050 | Provider selection: default openai/off; an unknown provider enables nothing; each provider's prerequisites named without values; no fallback; the application never builds Gemini (unit and real server with the OpenAI fake installed and unused), fixed 503 message, keypad save works, no key in logs | `provider-selection.test.js` P1–P8 (controls M-P1…M-P3) |
| TC-AI-051 | Gemini adapter (generateContent since S31, D-044; the Interactions API before): exact `POST models/{model}:generateContent` request with the unchanged schema as `responseJsonSchema`, key only in `x-goog-api-key`, unsafe model ids refused, no redirects; a Gemini answer yields the same draft as an OpenAI answer and the shared guards still refuse; malformed/truncated/oversized/blocked/cut-off/multi-candidate/multi-text answers; usage from `usageMetadata` incl. thought tokens; timeout, abort, 429/503/5xx/4xx, network failure; no key in errors; network guard blocks the real host; a non-2xx answer keeps only its numeric HTTP status, never body or headers, and the application error stays generic (D-042); the documented GenerateContentResponse shape; thinking answers (S32): thought parts and a signature-only part before one final JSON text part accepted, a thought's text never extracted, returned or logged, one final text part required last, function call/media/code/unknown/malformed parts and a thought after the answer refused, schema-invalid output after a thought still refused | `gemini-adapter.test.js` G1–G13 (controls M-G1…M-G10; M-H0 green, M-H1…M-H5 red; S31 M-A0 green, M-A1…M-A9 red; S32 M-T0 green, M-T1…M-T13 red) |
| TC-AI-055 | Read-only Gemini model list (D-044): `GET /v1beta/models` only, paged; each Gemini model name with generateContent yes/no; configured model available / unavailable for this key / listed without generateContent, exact id only, candidates never selected; 404/401/403/500/redirect give the status only, malformed or oversized lists unusable, no body/header/key leak; exit codes; no generateContent or Interactions request, no file, report or database written; missing key or model runs nothing; test seam needs the real guard | `gemini-models.test.js` M1–M8 (control M-M0 green; M-M1…M-M10 red) |
| TC-AI-053 | Evaluator test seam (D-041): a typed `WALLET_NO_NETWORK_GUARD=active` without the real guard opens nothing; the guard's proof is process-local and withdrawn if a connect function is replaced; fake URLs outside loopback, with another scheme, credentials, path, query, fragment, or a missing/invalid port are refused before any evaluation database, report or request; the real guard with a plain loopback URL still reaches the fake | `eval-test-seam.test.js` T1–T5 (control M-T0 green; M-T1…M-T10 red) |
| TC-AI-054 | Evaluator rolling window (D-043): at most 5 provider calls in any rolling 10 minutes, stored in the evaluation database; a sixth call, or a run planning more than the free slots or more than 5, refused before any request with the next available time; atomic reservation at dispatch across 8 processes and 3 parallel evaluators; failed, 4xx and timed-out calls keep their slots; expiry exactly at +10 min, clock set back still counts, rows never deleted; restart persistence; a read-only look writes nothing; a mid-run refusal stops the run INCOMPLETE; `wallet.db` and the checkout's pilot evidence byte-identical; the evaluator reads no application call limit, so with the application default of 3 per minute (and 1) `--limit 5` makes all five calls without a wait and a sixth is refused by the window | `eval-window.test.js` W1–W13 (control M-W0 green; M-W1…M-W12 red) |
| TC-AI-052 | Gemini in the evaluator: missing key or unknown provider runs nothing and never borrows OpenAI; requests reach only the local Gemini fake; report names provider and model; no key in stdout or reports; holdout ledger separates providers with S24 keys unchanged and S24 ledgers migrated; dry-run notice; test runner scrubs `GEMINI_*`/`GOOGLE_*`; a non-2xx answer is reported per row and in total by its numeric HTTP status only, with no upstream body or header, prompt, description or key (D-042) | `eval-gemini.test.js` E1–E8 (controls M-E1…M-E6, M-S1; M-H1, M-H2, M-H6…M-H8 red) |

## 5. What these tests cannot tell you

- Whether a real model extracts well. Fixture outputs are the labels' ideal
  answers; they check the normaliser and the evaluator (`MODEL_QUALITY=NOT_MEASURED`).
- Whether the real OpenAI endpoint accepts the request exactly as built. The
  adapter follows the documented Responses REST shape and is tested against a
  fake that speaks it; no call to the real service has been made.
- The same for Gemini: the adapter and `fake-gemini.js` follow the documented
  generateContent shape. No successful real Gemini request has been made, so a
  real thinking answer's shape is still unseen, although the parser accepts
  thought parts before the final text.
- That the browser hides the entry when `WALLET_AI_PROVIDER=gemini` is shown in
  two linked steps, not one browser test: the real server reports the capability
  disabled (P7), and the existing browser test proves a disabled capability hides
  the entry (TC-AI-034).
- Physical-device behaviour. Phone sizes are emulated Chromium viewports; the
  on-screen keyboard is not simulated.
- The generation-counter check only at component level: browser tests cannot
  reach the window where a response resolves just before its abort, so
  `ui-state.test.js` runs the real module with a fetch that ignores abort (R9).
  Account switch during a pending request and a category deleted before Save
  (U1, U2) are also component-level only: the product has no category delete,
  and the browser suite does not switch accounts mid-request.
- Page reload during an uncertain save: not handled and not tested; the draft
  and its key live in memory only (plan §14.3 #15).
- Whether 600 output tokens are enough for a reasoning model (open risk R-L1).
- The evaluation-database check against a process that swaps folders or files
  between the check and the open. It runs twice (before reading, just before
  opening); nothing stronger is claimed.
- File symbolic links on this Windows account: creating one needs a privilege
  the account lacks, so N1.4b is reported as skipped here. Junctions, hard links
  and the file-identity comparison are tested. On Linux the symlink case would
  run; remote CI has not been run.
