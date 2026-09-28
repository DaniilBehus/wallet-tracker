# Category spending limits — owner acceptance script

[← Back to README](../../README.md#qa-evidence) · [Local automated report](test-report-category-limits.md) · [Requirements](analysis-category-limits.md)

**Not executed or signed by the owner.** Automated browser checks are not UAT.
Use a disposable account and database, never personal records or `npm start`
(which loads a local environment file and defaults to the real database).

## Safe setup

In a separate terminal, start the real app without loading any environment file:

```powershell
$env:DB_PATH="./data/uat-category-limits.db"
$env:JWT_SECRET="uat-only-not-a-real-secret"
$env:WALLET_AI_MODE="off"
$env:PORT="3035"
node src/server.js
```

Use a database path that does not exist yet. Open `http://localhost:3035` and
register a synthetic account such as `category-uat@example.test`. No provider key
or external service is needed. Stop the server afterwards and close the terminal
so these test-only environment variables cannot affect a later development run.

## Steps

| # | Action | Expected |
|---|---|---|
| 1 | On Add save €50.00 in Groceries; open Month and tap its category row | Editor names Groceries; empty limit input |
| 2 | Set 200.00 | €50.00 of €200.00; Within limit · €150.00 left, white outline |
| 3 | Set 50.00 | Limit reached; solid red box, white words, never called over |
| 4 | Set 40.00 | Over limit by €10.00; same red box |
| 5 | Add another €10.00 to Groceries | Save succeeds; month €60.00, over by €20.00 |
| 6 | Set overall limit 10.00, income 1000.00; set category limit 200.00 | Overall is over, category within; no warning about their sum; income unchanged |
| 7 | Reopen category editor | Current value 200.00 prefilled; input focused |
| 8 | Type abc, then -1, try Save each time | Inline error; editor remains open and stored limit unchanged |
| 9 | Type 99.00 then Cancel; reopen | No change; still 200.00 |
| 10 | Set 0 | Real zero limit; over by €60.00, not cleared |
| 11 | Clear input and Save; reload Month | Spending row remains; no status box or budget |
| 12 | At 320px width set 60.00 again; read row, amount, reached box; use Tab/Escape in editor | No sideways clipping; controls reachable; focus returns to row |
| 13 | Create a categorized subscription in Transport; return to Month before paying, then pay it on Upcoming | Planned instalment does not add spending; paid instalment appears in Transport |

A category with no spending and no limit has no row to tap. Its first budget
needs its first expense or the API; this is the accepted CL-D10 scope, not an
all-category settings screen. Uncategorised has no limit or editor. Limited
zero-spend rows, ownership and historical-month behaviour have automated
coverage in the report; they are not fabricated manual UAT observations.

## Owner sign-off

| Build SHA | Date | Reviewer | Result | Observations |
|---|---|---|---|---|
| | | | | |
