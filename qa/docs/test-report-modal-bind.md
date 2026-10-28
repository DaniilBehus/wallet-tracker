**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-modal-bind.md)

# Expense modal and default listener — local verification

[← Back to README](../../README.md#qa-evidence) · [Accessibility baseline](accessibility-baseline.md) · [QA status](../../docs/qa-status.md)

## Technical contract — recorded before implementation, 2026-10-16

The existing expense editor must become a named modal. Opening it focuses Amount; while open, background controls cannot receive focus or pointer activation, and Tab/Shift+Tab remain inside the editor. Escape, Cancel and a backdrop click dismiss without writing; focus returns to the opener if it still exists. Save, unchanged Save, validation/error and deleted-row/404 behavior remain usable. Logout closes the editor. At 320×568, every field and action remains vertically reachable without horizontal overflow.

The normal production listener defaults explicitly to IPv4 loopback `127.0.0.1`. `WALLET_HOST` is the deliberate opt-in for another host; generic `HOST` and empty/unset `WALLET_HOST` must not broaden the bind. The startup banner must name the chosen host and URL. Binding locally does not prove firewall, authentication or deployment security.

## Evidence

### Before and diagnosis

Before the source fix, the pure bootstrap capture failed **2/2**: the existing
`app.listen(PORT, callback)` supplied a callback where the required host
argument should be. The focused 320×568 browser witness also failed: a
`Shift+Tab` from Amount left the visual overlay.

The first native-dialog revision remained insufficient. Two post-fix runs of
the same boundary assertion failed, so work stopped for a measured diagnosis
rather than treating the `<dialog>` tag as proof. In one isolated diagnostic
run, immediately before `Shift+Tab` the active element was `INPUT#tx-edit-amount`,
`document.hasFocus()` was true, and the dialog was both `open` and `:modal`.
Immediately after, the active element was `BODY`, `document.hasFocus()` was
false, and `open`/`:modal` remained true. A programmatic attempt to focus the
background Add navigation did not activate it. This distinguished escape to
browser chrome from a demonstrated background-navigation activation.

### Local correction and observed behavior

The expense editor now uses a named native modal, with a small local
first/last enabled-visible-control Tab boundary handler. In the focused
post-correction browser evidence at **320×568 and 1280×800**, Shift+Tab from
Amount focused Cancel; Tab from Cancel returned to Amount. Browser focus
remained true and attempting to focus the background nav left Cancel focused.
A real pointer attempt on the background income control was refused, with the
Month screen unchanged. Escape, Cancel and backdrop click closed the editor and
restored its connected opener. An unchanged Save closed without PATCH; the
existing editing suite also checks no-op and no unintended category write.

At both viewports the action row was scroll-reachable and the dialog's
scroll width did not exceed the viewport width. The rendered editor and an
in-dialog validation-error state were each axe-scanned without confirmed
WCAG-tagged violations; full JSON and traces are in ignored local test
artifacts. The old page-level toast remains for existing behavior, while a
visible `role=alert` inside the top-layer dialog now carries validation and
server errors (including a bounded request reference when present). A held
PATCH kept the editor open and prevented Escape dismissal; a synthetic 503
then left the editor and local error visible with the original row unchanged.
A synthetic 401 closed the dialog and showed sign-in. Existing 404, refused
amount, save and no-change behaviors remained covered by the managed editing
suite. These synthetic refusals are controls, not observed production outages.

For the listener, missing/blank `WALLET_HOST` and generic `HOST` now choose
`127.0.0.1`; an explicit `WALLET_HOST` selects the recorded host, with IPv6
URL brackets where needed. The contract harness asserts the real production
three-argument signature and retains loopback. The managed E2E runner also
asserts that signature and discards inherited `WALLET_HOST`/`HOST`; it keeps
its owned database/teardown/no-network safeguards. An explicit broad bind is
an opt-in, **not** a firewall or deployment-security certification.

### Commands, counts and limits

All commands below used the installed Node 22.14.0 runtime, offline fixtures,
loopback-only child servers and disposable/ignored QA storage. No `.env`, real
account, real AI provider or external target was used.

| Check | Observed local result |
|---|---|
| `node --test qa/gates/server-bind.test.js` | 2/2 PASS after the initial 2/2 expected negative failures. |
| `node --test qa/e2e-controls/run.test.js` | 14 PASS, one environment-dependent symlink control SKIP, zero FAIL. |
| `node qa/e2e-runner/run.js qa/e2e/editing.spec.js` | 18/18 PASS over mobile and desktop; owned default database removed after child shutdown. |
| `playwright test -c playwright.a11y.config.js qa/a11y/baseline.spec.js -g 'Add, Month\|keyboard reaches'` | Four focused cases PASS: rendered editor/error scans and keyboard flow at both configured viewports. |
| `node --test qa/contract/contract.test.js` | 15/15 PASS; 340 validated loopback responses across 21 source operations, with off/demo provider seam. |
| Inventory/traceability/Login pure controls plus the new bind controls | 73/73 PASS; the accepted original 71 remain included. |
| CI-orchestration pure controls | 13/13 PASS. |
| Both inventory `--check`, F13, `scripts/check.js`, shared `--plan` | PASS; F13 280 IDs/78 definitions, static gates 8/8, all 22 planned tasks `NOT_RUN`. |

The source artifact now records **280 main catalogue IDs**, **138 reviewed
QA/script source files**, **six pinned execution configs** and **20 parameter
identities**. The new two-test bootstrap file is supporting control, not a
new catalogue case. These counts are source accounting, not 280 behavior
passes. Only focused browser states were rerun; this is not a full combined
suite, remote exact-SHA CI, owner UAT, assistive-technology audit, firewall
assessment or release approval. Open defects and other release gates remain
in the [QA status](../../docs/qa-status.md). At the time of this worker report,
the local repair awaited independent targeted review.

### Independent agent review — 2026-10-16

An independent agent's read-only code/evidence review, followed by local
coordination review, accepted the bounded F07 modal and F11 default-bind
repairs on this uncommitted tree. The focused browser, HTTP and test runs
listed above were performed by the Wallet worker; the reviewers examined
their evidence and performed read-only/pure checks, not another full runtime
suite. This is not a human accessibility audit, owner UAT, exact-SHA remote CI,
publication or release approval. Other defects and contrast limits remain in
the [QA status](../../docs/qa-status.md).
