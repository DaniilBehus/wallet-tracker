**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-003-pay-button-stuck.md)

# BUG-003 · Pay button stays on its busy label after a refused payment

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

A refused schedule payment showed the correct conflict toast but left the Pay button permanently labelled as busy.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | Medium |
| Priority | P1 — a control that misstates what it does |
| Component | `public/app.js` — `paySchedule`, `withBusy` |
| Found / affected build | S04; exact build only where recorded below |
| Environment / frequency | Chromium, Pixel 5 and desktop viewports, local server; frequency only if stated below |

## Preconditions and test data

S04, by TC-E2E-030 (`qa/e2e/pay-conflict.spec.js`) — a case written on suspicion, not a failure that showed up on its own

## Reproduction

1. Create a loan with `total_count = 1` and open Upcoming.
2. Close the loan from elsewhere — a second tab, another device, a direct
   `PATCH /api/schedules/:id/pay`. Do not reload the screen.
3. Press `Zaplatiť`.

## Expected and requirement

the conflict is reported and the button returns to offering the
action — `Zaplatiť`, enabled, accessible name unchanged. Spec §4.2 makes the
409 a documented state transition, so the interface has to survive it.

## Actual observation

The conflict toast appeared, but the button stayed on `Platím…` while its accessible name still said `Zaplatiť Posledná splátka`. The visible and announced states disagreed after a 409.

## Evidence

- [Recorded source: `public/app.js`](../../../public/app.js)
- [Recorded source: `qa/e2e/upcoming.spec.js`](../../../qa/e2e/upcoming.spec.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-003`.
- [GitHub Issue #3](https://github.com/DaniilBehus/wallet-tracker/issues/3) — external metadata can differ; the local register is the documentation status authority.

## Resolution and verification

**CLOSED.** `withBusy` now snapshots the original label before applying the temporary busy label, then restores that original label in `finally`. The recorded TC-E2E-030 regression kept the button enabled and labelled `Zaplatiť` after refusal; the subsequent full browser run reported **60 passed (11.6 s)**. This is dated evidence, not a new run.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### Original report: BUG-003 · The pay button stays on its busy label after a refused payment

[← Back to README](../../../README.md#qa-evidence) · [Next: browser regression tests →](../../../qa/e2e/upcoming.spec.js)

![severity](https://img.shields.io/badge/severity-Medium-yellow?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | Medium |
| **Priority** | P1 — a control that misstates what it does |
| **State** | CLOSED 2026-09-02 |
| **Found by** | TC-E2E-030, `qa/e2e/pay-conflict.spec.js` |
| **Component** | `public/app.js` — `paySchedule`, `withBusy` |
| **Affects** | Upcoming screen (spec §6.3) |
| **Environment** | Chromium, Pixel 5 and desktop viewports, local server |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Summary

When a payment is refused by the server, the `Zaplatiť` button keeps the
temporary label `Platím…` permanently. It stays that way until the screen is
re-rendered by other means, and its accessible name still reads
`Zaplatiť <name>` — so the visible text and the name announced to a screen
reader disagree about what the button does.

## Steps to reproduce

1. Sign in and create a loan with `total_count = 1`.
2. Open **Čoskoro** (Upcoming). The row shows a `Zaplatiť` button.
3. Close that loan from somewhere else — a second tab, another device, or a
   direct `PATCH /api/schedules/:id/pay`. The screen is not reloaded.
4. Press `Zaplatiť` on the still-open screen.

## Expected

The error toast appears, and the button goes back to offering the action:
label `Zaplatiť`, enabled, accessible name unchanged. Spec §4.2 makes this
path a normal, expected state transition — 409 is a documented answer, not a
crash — so the interface has to recover from it in a usable state.

## Actual

The toast is correct: *Táto platba je už uzavretá.* The button is left as:

```html
<button data-testid="schedule-pay-60" aria-label="Zaplatiť Posledná splátka">Platím…</button>
```

Enabled, clickable, permanently labelled with a progress message for an
operation that finished.

<details>
<summary>Test output</summary>

```
Expected: "Zaplatiť"
Received: "Platím…"
    14 × locator resolved to <button … aria-label="Zaplatiť Posledná splátka">Platím…</button>
```

</details>

## Root cause

An ordering mistake between a caller and a helper, not a logic error in either.

`withBusy(button, fn)` disables a button for the duration of an async action.
It snapshots `button.textContent` first and restores it in a `finally`, so
whatever happens the button ends up as it started.

`paySchedule` set the busy label **itself, one line before calling it**:

```js
button.textContent = T.paying;      // 'Platím…'
await withBusy(button, async () => { … });
```

So the snapshot captured `Platím…` rather than `Zaplatiť`, and the restore that
was meant to undo the change instead made it permanent. Every other caller of
`withBusy` was correct, because none of them changed the label — which is why
the defect appeared on exactly one button.

It stayed invisible on the successful path: a payment that succeeds triggers a
re-render of the whole list, and the freshly built button carries the right
label. Only the path with no re-render — the refusal — leaves the damaged
button on screen. A defect visible only in the error path is precisely what an
end-to-end test that exercises error paths is for.

## Fix

The busy label moved inside the helper, after the snapshot, as an optional
third argument:

```js
async function withBusy(button, fn, busyLabel) {
  const label = button ? button.textContent : null;   // snapshot first
  if (button) {
    button.disabled = true;
    if (busyLabel) button.textContent = busyLabel;    // then change
  }
  …
}
```

`paySchedule` passes `T.paying` and no longer touches the button itself. The
helper now owns both halves of the change, so it cannot restore a label it did
not set.

## Regression

TC-E2E-030 is the regression case and stays in the suite. Full run afterwards:

```
60 passed (11.6s)
```

## → Rule R5

A helper that restores state must be the only thing that changes it. If a
caller mutates what the helper snapshots, "restore" writes back the temporary
value and the change becomes permanent.


</details>
