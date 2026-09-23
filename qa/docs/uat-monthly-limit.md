# Monthly spending limit — UAT script

Ten minutes, one person, a browser. No test tooling and no API client: this is
the acceptance pass a non-technical reviewer can run and sign. Requirements and
the decision table it checks: [`analysis-monthly-limit.md`](analysis-monthly-limit.md).

**Environment.** A local run (`npm start`, then `http://localhost:3000`) with a
fresh account — register a new e-mail for the pass, so the month starts empty.
Nothing here needs an AI key or an external service.

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

**Sign-off**

| | |
|---|---|
| Date | |
| Build (commit) | |
| Steps passed | / 11 |
| Defects raised | |
| Accepted by | |

**Out of scope for this pass** (agreed in the analysis, not gaps found here):
per-category limits, notifications, blocking saves, a different limit per month,
and any forecast.
