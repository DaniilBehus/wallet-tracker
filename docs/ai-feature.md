# AI expense entry

[← Back to Wallet Tracker](../README.md#ai-expense-entry)

<img src="screenshots/ai-3-review-ready-demo.png" alt="Review of a suggested expense in demo mode" width="260"> <img src="screenshots/ai-4-review-needs-input-demo.png" alt="A suggestion that still needs an amount, in demo mode" width="260">

*Both pictures are demo mode — sample responses, no AI service contacted.*

Type *"Учора витратив 18 євро на обід"* and Wallet fills in the Add form for you:
€18.00, Restaurants, yesterday, "обід". You check it and press Save; nothing is
stored before that. English, Ukrainian and Slovak; euro only; one expense at a
time. The keypad is unchanged and is still the fastest way in.

The model is treated as untrusted input. It may only point at text in your
description and pick a category from your own list; the server computes the
cents and the date itself, rejects anything that is not literally in the text,
and independently refuses what it can see is unsupported — `10 USD` never
becomes a euro expense, whatever the model says. Saves from the review screen
carry an `Idempotency-Key`, so a retry after a lost response cannot create a
second expense. Contract: [`spec/ai-expense-entry.md`](../spec/ai-expense-entry.md).

**Real AI is off by default.** Every AI test, the evaluation and the demo run
offline: a network guard is preloaded, the provider is a local fake or a fixed
set of sample answers, and nothing needs a key.

```bash
npm run ai:demo        # http://localhost:3100 — fixed examples, no AI service, own database
```

| Mode | How | What happens |
|---|---|---|
| off | default | no entry point; nothing is sent anywhere |
| demo | `npm run ai:demo` | seven named example sentences; anything else says it is not in the demo |
| live | `WALLET_AI_MODE=live` + `OPENAI_API_KEY` + `WALLET_AI_MODEL` + `WALLET_AI_LIVE_ALLOWED=true` in a local `.env` | the description and your category names go to OpenAI after you tick a consent box; small daily and per-minute limits |

**What the evaluation does and does not show.** `npm run eval:ai` runs the
116-row corpus through the production service with fixture answers, so it
checks the normaliser, the guards and the scorer — not a model
(`MODEL_QUALITY=NOT_MEASURED`). A separate, explicitly enabled live evaluator
has its own finite allowance and a 5-calls-per-10-minutes window; no real-model
quality result is claimed here. Details:
[`qa/docs/ai-evaluation.md`](../qa/docs/ai-evaluation.md).
