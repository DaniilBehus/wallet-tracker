**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-002-paid-loan-counter.md)

# BUG-002 · A fully paid loan still shows one instalment left

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

After the last loan payment, the row showed the finished state but still claimed one instalment and money remained.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `public/app.js` — `paySchedule`, `markRowFinished` |
| Found / affected build | S03; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S03, paying a 3-instalment loan to the end on the Upcoming screen

## Reproduction

1. Create a loan with `total_count = 3`.
2. Open Upcoming and press `Zaplatiť` three times.
3. Read the countdown line on that row.

## Expected and requirement

`zostáva 0 z 3 · 0,00 €` alongside the finished state. Spec §4.2:
on the last payment `remaining_count` is 0 and the response carries
`"finished": true` **"so the UI can celebrate"**.

## Actual observation

The row showed the finished state (`Splatené 🎉`, Pay button removed) but the countdown still read `zostáva 1 z 3 · 100,00 €` after the last payment.

## Evidence

- [Recorded source: `public/app.js`](../../../public/app.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-002`.
- [GitHub Issue #2](https://github.com/DaniilBehus/wallet-tracker/issues/2) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

**CLOSED.** The final-payment DOM path now uses the same `remainingText(...)` function as the initial render and the `remaining_count` returned by the Pay response. In the recorded two-instalment regression, the countdown went from `2 z 2 · 100,00 €` to `1 z 2 · 50,00 €` and finally `0 z 2 · 0,00 €`; the finished row remained visible and the Pay button disappeared. This rewrite ran no new test.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-002 · A fully paid loan still shows one instalment left · High · CLOSED

| | |
|---|---|
| Found in | S03, paying a 3-instalment loan to the end on the Upcoming screen |
| Component | `public/app.js` — `paySchedule`, `markRowFinished` |

**Steps to reproduce:**
1. Create a loan with `total_count = 3`.
2. Open Upcoming and press `Zaplatiť` three times.
3. Read the countdown line on that row.

**Expected:** `zostáva 0 z 3 · 0,00 €` alongside the finished state. Spec §4.2:
on the last payment `remaining_count` is 0 and the response carries
`"finished": true` **"so the UI can celebrate"**.

**Actual:** the finished state appeared correctly — green row, `Splatené 🎉`,
pay button removed — but the countdown still read:

```
zostáva 1 z 3 · 100,00 €
```

A loan the user has just finished paying claimed one instalment was still owed.

**Root cause:** two code paths updated the row and only one of them wrote the
countdown. A payment that does not finish the loan calls `loadUpcoming()`, which
re-renders every row from the server and is therefore always current. The final
payment deliberately does *not* reload — the list is filtered to `active=1`, so
a refresh would delete the row and the user would never see it complete — and
instead patched the row in place via `markRowFinished`, which changed styling
and removed the button but never touched the text. The displayed count was left
holding the value from the previous render.

This is the same failure the spec designs against in §5 by refusing to store
`next_due` and `remaining_count`: a derived value kept somewhere other than
where it is computed goes stale. The server obeys that rule; the DOM had quietly
become a second place where the value was kept.

**Fix:** the countdown string is now produced by one function,
`remainingText(total_count, remaining_count, amount_cents)`, called both by the
initial render and by the final payment — which passes `remaining_count`
straight from the `PATCH /pay` response. Two writers remain, but they can no
longer disagree about the text.

**Regression:** a fresh 2-instalment loan paid to the end, reading the countdown
at each step:

```
start       zostáva 2 z 2 · 100,00 €
after 1st   zostáva 1 z 2 · 50,00 €
after 2nd   zostáva 0 z 2 · 0,00 €
finished    row--done: true, "Splatené 🎉", pay button removed
```

**→ Rule R3.**

---

</details>
