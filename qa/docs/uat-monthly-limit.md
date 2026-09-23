# Monthly spending limit — UAT script

Ten minutes, one person, a browser. No test tooling and no API client: this is
the acceptance pass a non-technical reviewer can run and sign. Requirements and
the decision table it checks: [`analysis-monthly-limit.md`](analysis-monthly-limit.md).

**Environment — a throwaway database, not yours.** Do **not** start this pass
with `npm start`. That command loads `.env` if one exists and opens
`data/wallet.db`, so it would run the acceptance script against real records and
would apply the limit migration to them. Start a server that owns its own file
instead: a database path that does not exist yet, a secret that lives only for
this pass, the AI provider off, and no `.env` read at all.

```bash
DB_PATH=./data/uat-limit.db JWT_SECRET=uat-only-not-a-real-secret \
  WALLET_AI_MODE=off PORT=3000 node src/server.js
```

```powershell
$env:DB_PATH="./data/uat-limit.db"; $env:JWT_SECRET="uat-only-not-a-real-secret"
$env:WALLET_AI_MODE="off"; $env:PORT="3000"; node src/server.js
```

`node src/server.js` is the point: `npm start` is `node --env-file-if-exists=.env
src/server.js`, and the flag is what has to go. Then open
`http://localhost:3000` and register a new e-mail for the pass, so the month
starts empty. Delete `data/uat-limit.db` (and its `-wal` and `-shm` files)
afterwards; `data/` is git-ignored, so nothing from the pass can be committed by
accident. Nothing here needs an AI key, a network call or an external service.

**Data used.** Two expenses: €50.00 (Groceries) and €75.00 (Transport).

| # | Step | Expected result | Covers |
|---|---|---|---|
| 1 | Register, open **This month** on the empty account | The limit reads *Set limit*; no state line is shown | R1, REQ-ML-09 |
| 2 | Add the €50.00 expense on **Add**, return to **This month** | Total €50.00; the limit still reads *Set limit*; still no state line | R2 |
| 3 | Tap the limit, type `200.00`, save | A confirmation appears; the limit reads €200.00; the line says **Within limit · €150.00 left** | REQ-ML-10, R4 |
| 4 | Add the €75.00 expense, return | Total €125.00; the line says **Within limit · €75.00 left** | R4, REQ-ML-06 |
| 5 | Tap the limit, type `125.00`, save | The line says **Limit reached** — not "over" | R5, assumption A4 |
| 6 | Tap the limit, type `100.00`, save | The line says **Over limit by €25.00**, visibly marked | R6, REQ-ML-09 |
| 7 | Add one more expense of €10.00 | It is **saved** — the limit never blocks a save; the line now says **Over limit by €35.00** | REQ-ML-06, assumption A1 |
| 8 | Tap the limit, type `abc`, save | An error appears; the limit and the line are unchanged | REQ-ML-10 |
| 9 | Tap the limit, clear the field, save | The limit reads *Set limit* again; the state line disappears | REQ-ML-02, R2 |
| 10 | Reload the page | The limit is still cleared — the change was stored, not only shown | REQ-ML-01 |
| 11 | Repeat step 3 on a phone-sized window (about 375 px wide) | The limit, the state line and the donut are all readable; nothing overlaps | REQ-ML-09, the layout defect found in testing |

## Recorded run — 2026-09-23

**Run by Claude (an AI agent), not by a person.** It drove a Chromium pane
through the same eleven steps and wrote down what it saw. That is a rehearsal of
the script, not an acceptance: the owner's sign-off below is deliberately empty,
and nothing here should be read as the feature having been accepted.

Build: application code exactly as committed in `4ad444d` — `git diff` against
`src/` and `public/` was empty for the whole pass. Server:
`DB_PATH=./data/uat-limit.db JWT_SECRET=<throwaway> WALLET_AI_MODE=off PORT=3000
node src/server.js`, a database created empty for this pass and deleted after
it, no `.env` read, no network call. Account: `uat-limit@example.test`,
registered for the pass on that database only.

| # | Result | What was observed |
|---|---|---|
| 1 | PASS | Limit reads *Set limit*; the state line is `hidden`; total €0.00 |
| 2 | PASS | Total €50.00; limit still *Set limit*; state line still hidden |
| 3 | PASS | Toast **Limit saved**; limit €200.00; line **Within limit · €150.00 left**; the editor closed itself |
| 4 | PASS | Total €125.00; line **Within limit · €75.00 left** |
| 5 | PASS | Line **Limit reached** — the equality boundary behaved as A4 says |
| 6 | PASS | Line **Over limit by €25.00**, carrying the `figure--over` class as well as the words |
| 7 | PASS | Toast **Saved · €10.00** — the save was not blocked; total €135.00; line **Over limit by €35.00** |
| 8 | PASS | Error toast **Limit must be a number, for example 600.00**; limit stayed €100.00; the line stayed **Over limit by €35.00**; the editor stayed open with the text still in it |
| 9 | PASS | Toast **Limit removed**; limit reads *Set limit*; the state line is hidden again; the total is untouched |
| 10 | PASS | After a full page load the limit is still cleared — it was stored, not only drawn |
| 11 | PASS, by measurement rather than by eye | At 375 px the limit control sits at x 195–285 and the donut ends at x 177, so they do not share space; a hit test at the centre of the control returns the control, not the donut — which is exactly what the defect found in testing broke; the state line runs the full 306 px width below the donut and overlaps nothing; the page has no horizontal scroll (`scrollWidth` 375 = viewport) |

**How this run differs from a person doing it, and what that costs**

- The Claude window was behind another window for the whole pass, so the pane
  never painted: **no screenshot was captured and nothing was judged by eye.**
  Step 11 was verified from element geometry and hit testing instead, which
  answers "does anything overlap or block a tap" but not "does it look right".
- For the same reason `getComputedStyle` returned stale colours while the pane
  was throttled: the over-limit line read back as the ordinary header colour
  mid-pass and as `#ffd4ca` after a reload. The rule matches the element and a
  freshly inserted copy of it resolves to `#ffd4ca`, so this is a measurement
  artefact of a pane that is not drawing, not a finding about the application.
  A person running step 6 should still confirm the colour by looking.
- Backspace, Delete and Ctrl+A never reached the page in this pane. Typing
  digits and clicking buttons were real input events; clearing the field in
  step 9 had to be done by setting the input's value through the automation
  tool. At 375 px the same was true of clicks, so step 11's navigation and
  button presses were dispatched on the same controls from the page instead.
- One tester error, recorded because the numbers would not otherwise add up: an
  expense of €500,050.00 was saved by accident before step 2, because the Add
  screen keeps the amount typed earlier and the new digits appended to it. The
  row was deleted through the API and step 2 was started again from a zero
  month. It is not a defect in this feature; the retained amount is how the Add
  screen already behaved.

**Sign-off** — to be completed by a person, not by the agent above.

| | |
|---|---|
| Date | |
| Build (commit) | |
| Steps passed | / 11 |
| Defects raised | |
| Accepted by owner | |

**Out of scope for this pass** (agreed in the analysis, not gaps found here):
per-category limits, notifications, blocking saves, a different limit per month,
and any forecast.
