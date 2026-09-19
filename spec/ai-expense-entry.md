# Wallet · AI expense entry — feature contract

Status: ACTIVE since 2026-09-14.

This file is normative for the feature. `spec/handoff.md` §1, §5, §6.1 and §9
point here. Where this file and the plan disagree, this file wins and the
difference is listed in D-036.

---

## 1. What it is

An optional second way to start an expense on Add. The person types one short
description of **one expense already paid in EUR**. The server returns an
**editable draft**. Nothing is stored until the person reviews the draft and
presses **Save expense**, which uses the ordinary `POST /api/transactions`.

The language model is an extractor with no authority: no tools, no SQL, no
history, no ability to save, delete, pay, schedule or change income.

Input languages v1: English, Ukrainian, Slovak. Russian/transliteration are
exploratory only. Out of scope: OCR, voice, multiple expenses, currency
conversion, income, refunds, transfers, schedules, chat memory, RAG, tool calls.

## 2. Rules (acceptance IDs)

| ID | Rule |
|---|---|
| AI-R01 | Parsing never creates or changes a financial record |
| AI-R02 | Every save is an explicit action after an editable review |
| AI-R03 | Keypad entry works with AI off, unavailable, limited or misconfigured |
| AI-R04 | Exactly one completed expense; several are never merged or summed |
| AI-R05 | A missing or ambiguous amount stays empty; nothing is invented |
| AI-R06 | Amounts are converted by digit strings into integer cents |
| AI-R07 | EUR only; an explicit other currency is unsupported, never converted |
| AI-R08 | Relative dates use the validated reference date and calendar rules |
| AI-R09 | A missing date defaults visibly to today; an unparsed date never does |
| AI-R10 | Category suggestions come only from the user's own categories |
| AI-R11 | An unknown category stays unselected |
| AI-R12 | No input text, provider body, auth header or key in ordinary logs |
| AI-R13 | No real network calls in default tests or PR CI |
| AI-R14 | Refusal, truncation, invalid output, timeout and upstream failure are distinct |
| AI-R15 | Editing, cancelling, signing out or leaving invalidates a pending request |
| AI-R16 | Retrying one confirmed save cannot insert a second expense |
| AI-R17 | Two deliberate identical purchases remain two expenses |
| AI-R18 | Limits are enforced before any provider call, also under concurrency |
| AI-R19 | Keyboard-usable, works at 320×568, matches the existing style |
| AI-R20 | Reports separate model errors, application rejection and transport failure |
| AI-R21 | Claims about the feature stay within what its tests and reports show |

## 3. Modes

`WALLET_AI_MODE` = `off` (default) · `demo` · `live`.

- **off** — no provider is constructed; the capability says disabled.
- **demo** — only through `npm run ai:demo`, which installs synthetic fixture
  answers for a small named set of example sentences. Anything else returns
  `unsupported` with `DEMO_UNSUPPORTED`. Setting `WALLET_AI_MODE=demo` on the
  ordinary server does **not** enable anything: fixtures live under `qa/`.
  The demo runner widens the daily/minute caps because it calls no paid
  service; the limiter itself still runs (D-036).
- **live** — enabled only when all of `OPENAI_API_KEY`, `WALLET_AI_MODEL` and
  `WALLET_AI_LIVE_ALLOWED=true` are present. Missing prerequisites disable the
  capability without crashing Wallet. Live never falls back to demo.

`WALLET_AI_PROVIDER` = `openai` (default, also when empty) · `gemini` (D-040).

- **openai** — the only provider the application can use in live mode.
- **gemini** — Gemini Free, for the synthetic evaluation corpus only
  (`qa/ai/evaluate.js --live`). The application never constructs it, whatever
  key, model or switch is present: the capability is disabled and a draft
  request is `503 AI_UNAVAILABLE` with the fixed message "The Gemini test
  provider is for synthetic evaluation only and does not accept real financial
  records; enter the expense manually".
- Any other value enables nothing. No provider ever falls back to another, and
  one provider's key never satisfies the other's prerequisites.

## 4. Endpoints (both behind `requireAuth`)

### 4.1 `GET /api/ai/capabilities` → 200

```json
{ "enabled": false, "mode": "off", "provider": null, "max_input_chars": 500,
  "languages": ["en", "uk", "sk"], "requires_external_consent": false }
```

`provider` is `"OpenAI"` in live, `"demo"` in demo, `null` when off or
unavailable (including `WALLET_AI_PROVIDER=gemini`, D-040).
`requires_external_consent` is true only in live. No secret names, quotas,
account details or URLs are ever returned.

### 4.2 `POST /api/ai/expense-draft`

Request — exactly these keys, no others:

| Key | Rule |
|---|---|
| `text` | required string, not whitespace-only, ≤ 500 Unicode code points after NFC |
| `reference_date` | required `YYYY-MM-DD`, within one calendar day of server-local today |
| `locale` | optional `en` · `uk` · `sk` · `auto` (default `auto`) |
| `consent_to_external_processing` | optional boolean; must be `true` in live |

The raw JSON body of this route must not exceed 8 KiB.

Success → **200**:

```json
{
  "request_id": "uuid",
  "mode": "live",
  "status": "ready | needs_input | unsupported",
  "draft": { "amount_cents": 1800, "category_id": 12, "spent_on": "2026-09-13", "note": "обід" },
  "provenance": { "amount": "source", "category": "suggested", "date": "source",
                  "currency": "source", "note": "source" },
  "issues": [ { "field": "date", "code": "DATE_DEFAULTED", "severity": "info" } ],
  "versions": { "schema": "1", "prompt": "1", "normalizer": "2" }
}
```

Every draft field may be `null`. Provenance values: `source` (literal text found
in the description), `suggested` (category inference), `default` (EUR / today),
`none`. `unsupported` responses have all draft fields `null`.

### 4.3 Status precedence and errors

Order of checks; every step before 7 proves zero provider calls:

1. JSON parser (size, syntax) — as for the whole app
2. authentication
3. request shape, length, body bytes, reference date
4. mode enabled
5. consent (live)
6. category context bounds
7. concurrency slot, then atomic quota reservation
8. provider call
9. provider output validation
10. deterministic normalisation

| HTTP | Code | When |
|---|---|---|
| 400 | VALIDATION_FAILED | wrong shape, keys, types, length, body bytes |
| 400 | REFERENCE_DATE_MISMATCH | reference date more than one day from server today |
| 401 | UNAUTHORIZED | existing auth failure |
| 403 | AI_CONSENT_REQUIRED | live request without `consent_to_external_processing: true` |
| 413 | PAYLOAD_TOO_LARGE | any route whose JSON exceeds the parser limit (closes BUG-019) |
| 422 | AI_CONTEXT_TOO_LARGE | more than 100 categories or 8000 UTF-8 bytes of names |
| 429 | AI_RATE_LIMITED | local quota or concurrency, with `Retry-After` |
| 502 | AI_INVALID_RESPONSE | invalid shape, unknown category ref, source violation, truncation |
| 502 | AI_PROVIDER_FAILED | upstream HTTP/network/redirect/config failure |
| 503 | AI_UNAVAILABLE | mode off or live prerequisites missing |
| 503 | AI_PROVIDER_BUSY | upstream 429/503 |
| 504 | AI_TIMEOUT | provider deadline exceeded |

A provider **refusal** is a 200 `unsupported` result with `MODEL_REFUSED`,
never the refusal text. Error bodies keep `{error:{code,message}}` with fixed
messages; no upstream body is ever returned or logged.

## 5. Provider output (untrusted)

Exactly these keys, all present, `null` when absent, no extra keys:

| Key | Type |
|---|---|
| `intent` | `expense` · `multiple_expenses` · `non_expense` · `unclear` |
| `language` | `en` · `uk` · `sk` · `other` · `mixed` · `unknown` |
| `amount_text` | string ≤ 40 or null |
| `currency_text` | string ≤ 24 or null |
| `date_text` | string ≤ 60 or null |
| `category_ref` | one of this request's refs (`c0`…`c99`) or null |
| `note_text` | string ≤ 200 or null |

Every non-null `*_text` must be a literal substring of the NFC-normalised
description. `amount_text` must additionally be one whole numeric token of the
description (`18` inside `180` is a violation) after currency markers at its
edges are removed — `"18 €"`, `"€18"` and `"18"` name the same token (D-036).
Violations are 502.

The model never supplies cents, dates, IDs or explanations. The server derives
all final values.

## 6. Deterministic guards (independent of the model)

The server scans the description itself. A guard can only make the result
**safer** (ready → needs_input → unsupported), never the reverse.

**Unsupported** regardless of model output: an explicit non-EUR currency
(`USD $ GBP £ CZK Kč UAH ₴ грн CHF PLN zł HUF Ft`, dollar/dolár/долар/гривн…);
two or more currency-marked amounts; future intention (`tomorrow`, `zajtra`,
`завтра`, `will`, `буду`, `budem`…); simple negation (`did not`, `didn't`,
`не купив`, `nekúpil`…); income/refund/transfer/recurring words (`salary`,
`refund`, `transfer`, `every month`, `зарплата`, `повернення`, `переказ`,
`щомісяця`, `výplata`, `vrátenie`, `prevod`, `každý mesiac`…); model intent other
than `expense`/`unclear`.

**Amount** — money tokens are digits with optional group separators (space,
U+00A0, U+202F) in threes and an optional `.`/`,` decimal part.

| Input | Result |
|---|---|
| `18`, `18.5`, `18,50`, `1 234,56`, `1 234.56` | exact cents |
| `≤ 0`, `> 1 000 000.00` | `INVALID_AMOUNT` / `AMOUNT_OUT_OF_RANGE`, amount null |
| more than two decimals, or one separator followed by exactly three digits (`1,234`, `2.345`) | `AMBIGUOUS_AMOUNT` |
| both `.` and `,` (`1,234.56`, `1.234,56`) | `AMBIGUOUS_AMOUNT` |
| `about`, `approx`, `~`, `cca`, `okolo`, `приблизно`, `близько` | `APPROXIMATE_AMOUNT` |
| alternatives or ranges (`18 or 20`, `18-20`, `або`, `alebo`) | `AMBIGUOUS_AMOUNT` |
| arithmetic (`minus`, `discount`, `plus`, `tip`, `split`, `знижка`, `zľava`) | `AMBIGUOUS_AMOUNT` |
| a leading minus sign, also before a currency marker (`-€10`, `-EUR 10`) | `INVALID_AMOUNT` |
| digits touching letters that are not a currency word (`1e3`, `Cafe2Go`, `3x`) | `AMBIGUOUS_AMOUNT` |
| currency mention but no digits (`eighteen euros`) | `NUMERIC_AMOUNT_REQUIRED` |
| no number at all | `AMOUNT_REQUIRED` |

Candidate selection: date tokens are excluded; if exactly one money token is
adjacent to a currency marker it is the amount; with no marked token, a single
remaining number is the amount (and currency defaults); several unmarked numbers
are `AMBIGUOUS_AMOUNT`. If the model's `amount_text` names a different token than
the scan selected, or is null while the scan found one, the result is
`AMBIGUOUS_AMOUNT` — neither side is trusted over the other.

**Currency** — EUR markers: `€`, `EUR`, `eur`, `euro`, `euros`, `eura`, `eurá`,
`євро`. Currency words may touch digits (`10USD`, `USD10`, `18EUR`); only
letters end them (D-037). No marker at all → `CURRENCY_DEFAULTED` (info). A model currency that is
not a recognised marker → `AMBIGUOUS_CURRENCY`.

**Date** — supported source forms: ISO `YYYY-MM-DD`; `D.M.YYYY`; today /
yesterday / day before yesterday; dnes / včera / predvčerom; сьогодні / вчора /
учора / позавчора. No date expression → reference date with `DATE_DEFAULTED`
(info). Ambiguous slashes, day.month without year, weekday names and phrases
(`Monday`, `v pondelok`, `у понеділок`), `N days ago` / `N дні тому` /
`pred N dňami`, `last month` → `AMBIGUOUS_DATE` or `UNSUPPORTED_DATE_FORMAT`,
also when the model omits them (D-037). Impossible dates →
`INVALID_DATE`. Two date expressions → `AMBIGUOUS_DATE`. Outside
1900-01-01 … server-local tomorrow → `DATE_OUT_OF_RANGE`. Model/scan
disagreement → `AMBIGUOUS_DATE`. No rollover, no UTC parsing.

**Category** — `category_ref` resolved through the per-request map to an owned
ID; null → `CATEGORY_REQUIRED`.

**Note** — `note_text` only; longer than 60 code points is cut at a word
boundary with `NOTE_TRUNCATED` (info).

Severity: `info` never blocks Save; `needs_input` blocks until corrected;
`unsupported` offers rewriting or manual entry.

## 7. Limits (D-034)

| Variable | Default | Bounds |
|---|---|---|
| `WALLET_AI_TIMEOUT_MS` | 15000 | 1000–30000 |
| `WALLET_AI_MAX_OUTPUT_TOKENS` | 600 | 100–2000 |
| `WALLET_AI_GLOBAL_DAILY_CALLS` | 20 | 1–10000 |
| `WALLET_AI_USER_DAILY_CALLS` | 5 | 1–1000 |
| `WALLET_AI_USER_MINUTE_CALLS` | 3 | 1–100 |
| `WALLET_AI_MAX_CONCURRENT` | 2 (and 1 per user) | 1–20 |

Daily and minute counters are reserved atomically in SQLite (`ai_quota`) before
dispatch using server time, stay consumed after failures, survive restarts and
hold only day/scope/user/count. The concurrency limiter is process-local and is
**not** multi-process protection. Provider response bodies are capped at 64 KiB
while streaming. One attempt is at most one provider request: no retries, no
repair calls, no second model.

## 8. Keyed save (D-035)

`POST /api/transactions` accepts an optional `Idempotency-Key` header
(8–64 chars of `A-Z a-z 0-9 -`). Without it, behaviour is unchanged.

With it:

- `spent_on` is required (400 otherwise);
- one `BEGIN IMMEDIATE` transaction looks up `(user_id, key)`;
- new key → validate, insert the expense and the key record together → 201;
- same key, same canonical payload → the original 201 body, header
  `Idempotency-Replayed: true`, no insert;
- same key, different payload → **409 IDEMPOTENCY_CONFLICT**;
- same key after the expense was deleted → **409 IDEMPOTENCY_REPLAY_UNAVAILABLE**
  (never recreated);
- after the expense was edited, replay returns the original result and does not
  undo the edit;
- keys are namespaced per user and kept for the life of the account.

Canonical payload: `[amount_cents, category_id or null, spent_on, note or null]`
after shape validation; object key order is irrelevant.

## 9. Privacy

The provider receives fixed instructions, the schema, the description, the
reference date, the locale hint and this user's category names under opaque refs.
Never: JWT, e-mail, password, user ID, balances, history, other categories'
IDs, environment. `store: false`; this is not a promise of zero retention and
the UI does not say otherwise.

Gemini Free (D-040) may use submitted content to improve Google products. It
therefore receives only rows of the synthetic evaluation corpus, never a real
person's description, and only through the live evaluator after an explicit
operator decision. The Gemini adapter also sends `store: false`; that controls
server-side interaction storage, not Free Tier data use. Logs carry only a request id, outcome code,
duration, versions and token counts.
