'use strict';

/* WALLET — the whole frontend. Plain ES2020, no framework, no build step
   (spec §2). Loaded as a classic script, so everything lives inside one IIFE
   and nothing leaks onto `window`.

   Two rules this file exists to honour:

   1. Money arrives and leaves as integer cents and is only ever turned into a
      string for display, here, at the edge (spec §3). `formatMoney` is the one
      place a division by 100 is allowed to appear in this project.
   2. Every interactive element carries a stable `data-testid` from §6.5 and an
      accessible name — a visible label or an aria-label — so tests can select
      by role and name instead of by CSS. See D-012. */

(function () {
  // ======================================================== STRINGS (D-018)
  // Every string this file renders. Note "this file": the static markup in
  // index.html, the seeded category names in src/db.js and manifest.json carry
  // their own text too. D-018 records that honestly — D-008 used to claim one
  // object held all of it, and it never did.
  const T = {
    appName: 'Wallet',

    // auth
    signInTitle: 'Sign in',
    signUpTitle: 'Create an account',
    signIn: 'Sign in',
    signUp: 'Sign up',
    toSignUp: 'No account? Sign up',
    toSignIn: 'Already have an account? Sign in',
    signedOut: 'You have been signed out',
    signOut: 'Sign out',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordTooLong: 'Password must be at most 72 bytes — accented and non-Latin letters count as more than one',
    credentialsRequired: 'Enter both an e-mail and a password',

    // add
    saved: (amount) => `Saved · ${amount}`,
    amountRequired: 'Enter an amount',
    categoryRequired: 'Choose a category',
    amountTooBig: 'That amount is too large',
    noCategories: 'No categories',
    notePlaceholder: 'what was it for?',
    importOpen: 'Preview synthetic import',
    importBefore: 'Preview before saving.',
    importReview: (name, amount, date, state) =>
      `${name} · ${amount} · ${date} · ${state === 'new' ? 'new' : 'already imported'}. Nothing saved by preview.`,
    importUncertain: 'Import not confirmed. Check or retry this same record.',
    importSaved: 'Synthetic expense imported',
    importReplayed: 'Already imported · no duplicate',
    importNeedsCategory: 'The synthetic demo needs a Groceries category.',
    importStorageFailed: 'This browser cannot keep a safe retry. Synthetic import is unavailable.',

    // income (D-021)
    income: 'Income',
    left: 'Left',
    over: 'Over',
    incomeNotSet: 'Set income',
    incomeSaved: 'Income saved',

    // monthly spending limit (qa/docs/analysis-monthly-limit.md)
    limitNotSet: 'Set limit',
    limitSaved: 'Limit saved',
    limitCleared: 'Limit removed',
    limitInvalid: 'Limit must be a number, for example 600.00',
    limitWithin: (left) => `Within limit · ${left} left`,
    limitReached: 'Limit reached',
    limitOver: (amount) => `Over limit by ${amount}`,

    // editing (D-029) and pagination (D-031)
    editExpense: (what) => `Edit ${what}`,
    expenseSaved: 'Expense updated',
    expenseGone: 'That expense no longer exists',
    showMore: 'Show more',
    shownOf: (shown, total) => `Showing ${shown} of ${total}`,
    incomeInvalid: 'Income must be a number, for example 1500.00',
    spent: 'spent',

    // month
    thisMonth: 'This month',
    noExpenses: 'No expenses this month yet',
    uncategorised: 'Uncategorised',
    deleted: 'Expense deleted',
    deleteExpense: (what) => `Delete expense ${what}`,
    today: 'Today',
    yesterday: 'Yesterday',

    // upcoming + schedules
    upcoming: 'Upcoming',
    schedules: 'Schedules',
    noSchedules: 'No schedules yet',
    pay: 'Pay',
    payAria: (name) => `Pay ${name}`,
    paying: 'Paying…',
    paid: (name) => `${name} · paid`,
    writeUncertain: 'The result is unknown. Check or retry this same action; do not start another payment.',
    writeStorage: 'This browser cannot safely keep the operation. Nothing was sent.',
    writeBlocked: 'Resolve or explicitly abandon the pending action before saving or paying again.',
    writeRefused: 'The request was refused. Review the change before starting a new action.',
    writeScheduleChanged: 'This schedule changed. Review the latest details before another payment.',
    writeKeyConflict: 'This recovery key belongs to a different action. Do not resend with a new key automatically.',
    writeReplayUnavailable: 'The original expense was deleted. This payment cannot be replayed; check the ledger before acting.',
    writeAbandon: 'The original may already have been saved or paid. Abandon recovery anyway?',
    remaining: (left, total) => `${left} of ${total} left`,
    finished: 'Paid off 🎉',
    subscription: 'Subscription',
    loan: 'Loan',
    scheduleAdded: (name) => `${name} · added`,
    scheduleUpdated: (name) => `${name} · updated`,
    editSchedule: (name) => `Edit ${name}`,
    editScheduleGone: 'That schedule is no longer available. Review the list before editing again.',
    editScheduleConflict: 'This schedule changed. Review its current payments and try again.',
    editScheduleUncertain: 'The edit result is unknown. Refresh the schedule before trying again.',
    editSchedulePending: 'Wait for the edit result before closing this form.',
    nameRequired: 'Enter a name',
    dayInvalid: 'Day of month must be between 1 and 31',
    dateRequired: 'Enter a start date',
    totalCountInvalid: 'Number of instalments must be at least 1',
    totalCountTooMany: 'A loan can run to at most 1200 instalments — a hundred years of monthly payments',
    amountInvalid: 'Amount must be a number, for example 15.00',
    // G5 / D-011 — shown only for a day past the 28th.
    clampHint: (day) =>
      `In months with no ${ordinal(day)}, the payment is taken on the last day of the month.`,

    // errors, keyed by the API's error code (spec §5). The server's own
    // messages are written for an API consumer, so none is shown raw.
    errors: {
      VALIDATION_FAILED: 'Please check what you entered.',
      UNAUTHORIZED: 'E-mail or password is incorrect.',
      FORBIDDEN: 'You are not allowed to do that.',
      NOT_FOUND: 'That item no longer exists.',
      CONFLICT: 'That action is no longer possible.',
      OFFLINE: 'The server is not responding. Check your connection.',
      UNKNOWN: 'Something went wrong. Please try again.',
    },
    duplicateEmail: 'That e-mail is already registered.',
    duplicateCategory: 'A category with that name already exists.',
    scheduleClosed: 'This schedule is already closed.',
  };

  /**
   * 29 -> "29th", 30 -> "30th", 31 -> "31st".
   *
   * Only ever called with 29, 30 or 31, but written for the general case
   * because "31th" is exactly the kind of thing that ships and then sits there.
   */
  function ordinal(n) {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  }

  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

  /**
   * Eight fixed hues for the donut (D-022), assigned by position in the
   * summary's by_category list — which the API returns largest first. Fixed
   * rather than generated so the same category keeps its colour between
   * renders. The cool hues remain visible on the dark chart surface; the
   * adjacent text labels and values carry meaning without colour.
   */
  const SLICE_COLOURS = [
    '#48D6C4', '#78AEE8', '#A392E5', '#7CD4AF',
    '#D49AC7', '#69B9C8', '#A6C5E7', '#8CCAA8',
  ];
  const DONUT_RADIUS = 52;
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

  const MAX_AMOUNT_CENTS = 100000000;   // 1 000 000 €, mirrors spec §4.3
  const MAX_TOTAL_COUNT = 1200;         // mirrors D-046 in src/validate.js
  const NBSP = ' ';                // keeps "15,00 €" from breaking in two
  const TOKEN_KEY = 'wallet_token';

  // ============================================================== FORMATTING

  /**
   * Integer cents -> "€1,234.50" (D-019).
   *
   * The only division by 100 in the project. `Math.floor` on a value below
   * Number.MAX_SAFE_INTEGER is exact, and the remainder is taken with `%` on
   * the integer, so no float ever holds a monetary value — the string is built
   * from two integers.
   *
   * Deliberately not Intl.NumberFormat: that would render the same amount
   * differently depending on the viewer's browser locale, and every money
   * assertion in the test suite would then depend on the machine running it.
   */
  function formatMoney(cents) {
    const negative = cents < 0;
    const abs = Math.abs(cents);
    const whole = Math.floor(abs / 100);
    const frac = abs % 100;
    return (negative ? '-' : '') + '€' + groupThousands(whole) + '.' +
           String(frac).padStart(2, '0');
  }

  function groupThousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** "2026-09-12" -> "12 Sep" */
  function formatDayMonth(iso) {
    const [, m, d] = iso.split('-');
    return `${Number(d)}${NBSP}${MONTHS_SHORT[Number(m) - 1]}`;
  }

  /** Day heading for the month list: today and yesterday get words. */
  function formatDayHeading(iso) {
    const t = todayIso();
    if (iso === t) return T.today;
    if (iso === dayBefore(t)) return T.yesterday;
    return formatDayMonth(iso);
  }

  /**
   * Today, as a local 'YYYY-MM-DD'. The only place this file reads the clock,
   * exactly as `today()` is for src/dates.js.
   */
  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function daysInMonth(year, month) {
    if (month === 2) {
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return leap ? 29 : 28;
    }
    return MONTH_LENGTHS[month - 1];
  }

  /**
   * The calendar day before `iso`. The mirror of `dayAfter` in src/dates.js,
   * and written the same way: no `Date` arithmetic, just numbers.
   *
   * This replaced a general `shiftDays(iso, delta)` built on
   * `new Date(y, m - 1, d + delta)`. **That function was not wrong.** It was
   * audited across every day from 2020 to 2032 — 4749 dates, delta −1 — against
   * a pure implementation, and the two never disagreed. Date's normalisation of
   * a day underflow is exactly right: 1 March minus one day is 28 or 29
   * February, and it gets the leap years right too.
   *
   * It was replaced anyway, for one reason: the general `delta` was an
   * invitation. The identical construction applied to the MONTH field —
   * `new Date(y, m - 1 + delta, d)` — silently answers 3 March for "31 March,
   * one month earlier", because 31 does not exist in February and Date rolls
   * forward instead of clamping. src/dates.js has a whole comment about
   * refusing to construct Dates from a day number for that reason, and the
   * frontend held the one place where the same shape could grow a second use.
   *
   * A function that can only do the safe thing cannot be extended into the
   * unsafe one by somebody in a hurry. That is the whole of the change.
   */
  function dayBefore(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    if (d > 1) return `${y}-${pad2(m)}-${pad2(d - 1)}`;
    const year = m === 1 ? y - 1 : y;
    const month = m === 1 ? 12 : m - 1;
    return `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /**
   * "15,00" or "15.5" or "15" -> integer cents. Returns null if unparseable.
   * Parsed by splitting the string, not with parseFloat: the whole point of
   * integer cents is that a decimal string never becomes a float.
   */
  function parseAmountToCents(raw) {
    let s = String(raw).trim().replace(/\s| /g, '');
    // Both conventions are accepted on input even though only one is displayed
    // (D-019): "1,234.50" uses commas as thousands separators, "15,00" uses a
    // comma for the decimal. Being forgiving about what is typed costs nothing,
    // and the pattern below still rejects anything ambiguous.
    s = s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.');
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
    const [whole, frac = ''] = s.split('.');
    const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
    return Number.isSafeInteger(cents) ? cents : null;
  }

  // ===================================================================== DOM

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    for (const child of [].concat(children)) {
      if (child != null) node.append(child);
    }
    return node;
  };
  /** Attributes that Object.assign cannot set (data-*, aria-*). */
  const attrs = (node, map) => {
    for (const [k, v] of Object.entries(map)) {
      if (v != null) node.setAttribute(k, String(v));
    }
    return node;
  };

  // =================================================================== STATE

  const state = {
    token: null,
    screen: 'add',
    authMode: 'login',
    categories: [],
    categoryById: new Map(),
    amountDigits: '',      // raw cents as typed, e.g. "1250" -> 12,50 €
    selectedCategoryId: null,
    incomeCents: 0,
    limitCents: null,
    busy: false,
    busyOwner: null,
    readGeneration: { month: 0, upcoming: 0, schedules: 0, categories: 0 },
    // Cursor continuation keeps unseen surviving rows stable across earlier
    // insertions/deletions; a changed total triggers one bounded restart.
    month: { items: [], total: 0, cursor: null, editing: null },
    // Incremented whenever a session starts or ends. A response that belongs
    // to an older epoch belongs to somebody who is no longer signed in here,
    // and must not be applied — or sign out whoever is (spec/ai-expense-entry.md).
    sessionEpoch: 0,
  };

  // Optional features registered by scripts loaded before this one (D-036).
  // Each receives the narrow `host` below and nothing else from this closure.
  let features = [];

  // One page of the month list. The API caps `limit` at 200 (spec §5); asking
  // for 200 was what made the list silently truncate at 201 expenses, because
  // nothing compared what arrived against the `total` that came with it.
  const PAGE_SIZE = 50;

  // ===================================================================== API

  async function api(path, { method = 'GET', body, signal, headers: extraHeaders = {} } = {}) {
    const token = state.token;
    const epoch = state.sessionEpoch;
    const currentSession = () => token === state.token && epoch === state.sessionEpoch;
    const headers = { ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    let timedOut = false;
    let rejectDeadline;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      rejectDeadline(apiError(0, 'TIMEOUT'));
    }, 10000);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const res = await Promise.race([fetch('/api' + path, {
        method, headers, signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      }), deadline]);
      let data = null;
      if (res.status !== 204) {
        if (res.ok && !/json/i.test(res.headers.get('Content-Type') || '')) {
          throw apiError(res.status, 'INVALID_RESPONSE');
        }
        try {
          data = await Promise.race([res.json(), deadline]);
        } catch (error) {
          if (timedOut) throw apiError(0, 'TIMEOUT');
          if (res.ok) throw apiError(res.status, 'INVALID_RESPONSE');
        }
      }
      if (!currentSession()) {
        const stale = apiError(0, 'STALE');
        stale.stale = true;
        throw stale;
      }
      if (!res.ok) {
        const code = (data && data.error && data.error.code) || 'UNKNOWN';
        const requestId = res.headers.get('X-Request-Id');
        if (res.status === 401 && token) signOut(T.signedOut);
        throw apiError(res.status, code, data && data.error && data.error.message, requestId);
      }
      return data;
    } catch (error) {
      // A rejected fetch or JSON body belongs to its original session too.
      // Never surface an old account's error after a newer sign-in.
      if (!currentSession()) {
        const stale = apiError(0, 'STALE');
        stale.stale = true;
        throw stale;
      }
      if (error && error.status !== undefined) throw error;
      throw apiError(0, timedOut ? 'TIMEOUT' : 'OFFLINE');
    } finally {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  // requestId is the server's X-Request-Id for the failed request; an error
  // that never reached the server (OFFLINE) has none.
  function apiError(status, code, serverMessage, requestId = null) {
    const err = new Error(serverMessage || code);
    err.status = status;
    err.code = code;
    err.requestId = requestId;
    return err;
  }

  /**
   * The Slovak sentence for an error. The server's own message is English and
   * written for an API consumer, so it is never shown; `context` lets a caller
   * turn a generic code into the specific sentence for that screen.
   */
  function messageFor(err, context) {
    if (context) {
      if (err.status === 409 && context === 'register') return T.duplicateEmail;
      if (err.status === 409 && context === 'category') return T.duplicateCategory;
      if (err.status === 409 && context === 'pay') return T.scheduleClosed;
      if (err.status === 401 && context === 'login') return T.errors.UNAUTHORIZED;
    }
    return T.errors[err.code] || T.errors.UNKNOWN;
  }

  // ================================================================== TOASTS

  let toastTimer = null;

  function showToast(node, text, reference = null) {
    const errorBox = $('#toast-error-box');
    $('#toast-success').hidden = true;
    errorBox.hidden = true;
    node.textContent = text;

    const box = node === $('#toast-error') ? errorBox : node;
    if (box === errorBox) {
      // Eight characters of the request id: enough to find the request in the
      // log, short enough to read out or paste into a message.
      $('#toast-ref').hidden = !reference;
      $('#toast-ref-code').textContent = reference ? reference.slice(0, 8) : '';
    }
    box.hidden = false;
    clearTimeout(toastTimer);
    // A reference is there to be copied, which takes longer than reading.
    toastTimer = setTimeout(() => { box.hidden = true; }, reference ? 8000 : 2600);
  }

  const toastOk = (text) => showToast($('#toast-success'), text);
  // `err`, when given, is what api() threw: its request id becomes the
  // reference shown under the message. Messages about input never have one.
  const toastErr = (text, err) => {
    if (err && err.stale) return;
    showToast($('#toast-error'), text, err ? err.requestId : null);
  };

  // ==================================================================== AUTH

  function setAuthMode(mode) {
    state.authMode = mode;
    const registering = mode === 'register';
    $('#auth-sub').textContent = registering ? T.signUpTitle : T.signInTitle;
    $('#auth-submit').textContent = registering ? T.signUp : T.signIn;
    $('#auth-toggle').textContent = registering ? T.toSignIn : T.toSignUp;
    $('#auth-password').autocomplete = registering ? 'new-password' : 'current-password';
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (state.busy) return;

    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    if (!email || !password) return toastErr(T.credentialsRequired);
    // Checked here as well as on the server so the common mistake gets an
    // instant Slovak sentence instead of a round trip and a generic one.
    if (state.authMode === 'register' && password.length < 8) {
      return toastErr(T.passwordTooShort);
    }
    // The upper bound is bcrypt's: it reads 72 bytes and ignores the rest, so
    // a longer password would have a tail that does nothing (BUG-017, D-045).
    // Counted in UTF-8 bytes, like the server does — TextEncoder, because
    // password.length counts characters and an emoji is four bytes.
    if (state.authMode === 'register' && new TextEncoder().encode(password).length > 72) {
      return toastErr(T.passwordTooLong);
    }

    const path = state.authMode === 'register' ? '/auth/register' : '/auth/login';
    await withBusy($('#auth-submit'), async () => {
      try {
        const { token } = await api(path, { method: 'POST', body: { email, password } });
        localStorage.setItem(TOKEN_KEY, token);
        state.token = token;
        $('#auth-password').value = '';
        await startApp();
      } catch (err) {
        toastErr(messageFor(err, state.authMode), err);
      }
    });
  }

  function signOut(message) {
    state.sessionEpoch += 1;
    state.busy = false;
    state.busyOwner = null;
    for (const name of Object.keys(state.readGeneration)) state.readGeneration[name] += 1;
    closeTransactionEditor();
    if ($('#import-dialog').open) $('#import-dialog').close();
    closeScheduleEditor(false);
    importBatch = null;
    for (const feature of features) if (feature.onSessionEnd) feature.onSessionEnd();
    localStorage.removeItem(TOKEN_KEY);
    state.token = null;
    $('#expense-save-btn').disabled = false;
    $('#expense-save-btn').textContent = 'Save';
    $('#auth-submit').disabled = false;
    renderWriteRecovery();
    state.categories = [];
    state.categoryById = new Map();
    clearAmount();
    $('#app').hidden = true;
    $('#nav').hidden = true;
    $('#screen-auth').hidden = false;
    setAuthMode('login');
    if (message) toastErr(message);
  }

  /**
   * Disables a button for the duration of an async action — no double submits.
   *
   * `busyLabel` is applied here rather than by the caller, and that is the whole
   * point: the original label is captured first, so whatever this function puts
   * on the button it can also take back off. BUG-003 was a caller setting the
   * busy text itself, one line before this ran — the snapshot then captured the
   * temporary label and "restoring" it made the change permanent.
   */
  async function withBusy(button, fn, busyLabel) {
    const owner = Symbol('busy action');
    state.busy = true;
    state.busyOwner = owner;
    const label = button ? button.textContent : null;
    if (button) {
      button.disabled = true;
      if (busyLabel) button.textContent = busyLabel;
    }
    try {
      await fn();
    } finally {
      // A successful login legitimately advances the session epoch inside
      // startApp(). Ownership, not epoch equality, decides who may release
      // this button. signOut clears the owner before a new action can start.
      if (state.busyOwner === owner) {
        state.busy = false;
        state.busyOwner = null;
        if (button) {
          button.disabled = false;
          if (label !== null) button.textContent = label;
        }
      }
    }
  }

  // ============================================================= 6.1 · ADD

  function renderAmount() {
    const node = $('#amount-display');
    const cents = Number(state.amountDigits || '0');
    node.textContent = formatMoney(cents);
    node.classList.toggle('amount--empty', state.amountDigits === '');
  }

  function pressDigit(digit) {
    // Leading zeros carry no value and would let the string grow past the cap.
    const next = (state.amountDigits + digit).replace(/^0+(?=\d)/, '');
    if (Number(next) > MAX_AMOUNT_CENTS) return toastErr(T.amountTooBig);
    state.amountDigits = next;
    renderAmount();
  }

  function clearAmount() {
    state.amountDigits = '';
    state.selectedCategoryId = null;
    const note = $('#expense-note');
    if (note) note.value = '';
    renderAmount();
    for (const tile of document.querySelectorAll('.tile')) {
      tile.setAttribute('aria-pressed', 'false');
    }
  }

  function selectCategory(id) {
    state.selectedCategoryId = id;
    for (const tile of document.querySelectorAll('.tile')) {
      tile.setAttribute('aria-pressed', String(Number(tile.dataset.id) === id));
    }
  }

  function renderCategories() {
    const grid = $('#category-grid');
    grid.textContent = '';

    if (state.categories.length === 0) {
      grid.append(el('p', { className: 'empty', textContent: T.noCategories }));
      return;
    }

    for (const category of state.categories) {
      const tile = el('button', { type: 'button', className: 'tile' }, [
        el('span', { className: 'tile__icon', textContent: category.icon || '•' }),
        el('span', { className: 'tile__name', textContent: category.name }),
      ]);
      attrs(tile, {
        'data-testid': `category-tile-${category.id}`,
        'data-id': category.id,
        'aria-pressed': 'false',
        // The emoji is decorative; the accessible name must be the category.
        'aria-label': category.name,
      });
      tile.addEventListener('click', () => selectCategory(category.id));
      grid.append(tile);
    }
    const importButton = el('button', {
      type: 'button', className: 'import-open', textContent: T.importOpen,
    });
    attrs(importButton, { 'data-testid': 'import-open' });
    importButton.addEventListener('click', openImport);
    grid.append(importButton);
  }

  let importBatch = null;
  let importSaving = false;

  function accountSub() {
    try {
      const payload = JSON.parse(atob(state.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (/^[1-9]\d*$/.test(String(payload.sub))) return String(payload.sub);
    } catch (_) { /* invalid local token; auth still belongs to the server */ }
    return null;
  }

  function importPendingKey() {
    // JWT sub is used only to separate local draft keys. Server auth still
    // verifies the token on every request; this is not a security decision.
    const sub = accountSub();
    return sub ? `wallet_synthetic_import_pending_${sub}` : null;
  }

  function pendingImport(key) {
    if (!key) return null;
    try {
      const batch = JSON.parse(localStorage.getItem(key));
      const record = batch && batch.records && batch.records[0];
      if (batch.source === 'synthetic-demo-v1' && batch.records.length === 1 &&
          typeof record.external_id === 'string' && /^demo-[0-9a-f-]{36}$/.test(record.external_id) &&
          record.amount_cents === 3500 && record.note === 'Synthetic demo expense' &&
          typeof record.spent_on === 'string' && record.category_name === 'Groceries') return batch;
    } catch (_) { /* malformed local draft is not sent to the API */ }
    return null;
  }

  function openImport() {
    const category = state.categories.find(item => item.name === 'Groceries');
    if (!category) { toastErr(T.importNeedsCategory); return; }
    const pendingKey = importPendingKey();
    importBatch = pendingImport(pendingKey);
    if (!importBatch) {
      importBatch = { source: 'synthetic-demo-v1', records: [{
        external_id: `demo-${crypto.randomUUID()}`,
        amount_cents: 3500, spent_on: todayIso(),
        category_name: 'Groceries', note: 'Synthetic demo expense',
      }] };
      try {
        if (!pendingKey) throw new Error('No account-scoped draft key');
        localStorage.setItem(pendingKey, JSON.stringify(importBatch));
      } catch (_) {
        importBatch = null;
        toastErr(T.importStorageFailed);
        return;
      }
    }
    $('#import-review').textContent = T.importBefore;
    $('#import-error').hidden = true;
    $('#import-confirm').disabled = true;
    $('#import-preview').disabled = false;
    $('#import-dialog').showModal();
  }

  async function previewImport() {
    if (!importBatch) return;
    const epoch = state.sessionEpoch;
    const button = $('#import-preview');
    button.disabled = true;
    $('#import-error').hidden = true;
    try {
      const result = await api('/imports/preview', { method: 'POST', body: importBatch,
        signal: AbortSignal.timeout(10000) });
      if (epoch !== state.sessionEpoch || !$('#import-dialog').open) return;
      const record = result.records[0];
      $('#import-review').textContent = T.importReview(record.category_name,
        formatMoney(record.amount_cents), record.spent_on, record.state);
      $('#import-confirm').disabled = false;
    } catch (err) {
      if (epoch !== state.sessionEpoch || !$('#import-dialog').open) return;
      $('#import-error').textContent = messageFor(err);
      $('#import-error').hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  async function confirmImport() {
    if (!importBatch || $('#import-confirm').disabled) return;
    const epoch = state.sessionEpoch;
    importSaving = true;
    $('#import-confirm').disabled = true;
    $('#import-preview').disabled = true;
    $('#import-cancel').disabled = true;
    $('#import-error').hidden = true;
    try {
      const result = await api('/imports/confirm', { method: 'POST', body: importBatch,
        signal: AbortSignal.timeout(10000) });
      if (epoch !== state.sessionEpoch) return;
      $('#import-dialog').close();
      const pendingKey = importPendingKey();
      try { if (pendingKey) localStorage.removeItem(pendingKey); }
      catch (_) { /* keeping a completed ID only causes a safe replay */ }
      importBatch = null;
      toastOk(result.records[0].replayed ? T.importReplayed : T.importSaved);
    } catch (err) {
      if (epoch !== state.sessionEpoch) return;
      $('#import-error').textContent = T.importUncertain;
      $('#import-error').hidden = false;
      $('#import-confirm').disabled = false;
    } finally {
      importSaving = false;
      $('#import-preview').disabled = false;
      $('#import-cancel').disabled = false;
    }
  }

  // An operation has its own storage key so two tabs cannot overwrite a
  // single account-wide slot. This is not an atomic cross-tab intent lock.
  const WRITE_PREFIX = 'wallet_write_pending_';
  const writeStorageKey = (sub, key) => `${WRITE_PREFIX}${sub}_${key}`;

  function pendingWrites() {
    const sub = accountSub();
    if (!sub) return [{ bad: true, storageKey: null }];
    const prefix = `${WRITE_PREFIX}${sub}_`;
    const records = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const storageKey = localStorage.key(i);
        if (!storageKey || !storageKey.startsWith(prefix)) continue;
        try {
          const record = JSON.parse(localStorage.getItem(storageKey));
          const routeOK = record.kind === 'save' ? record.route === '/transactions' :
            record.kind === 'pay' && /^\/schedules\/[1-9]\d*\/pay$/.test(record.route);
          if (record.accountSub !== sub ||
              !/^[A-Za-z0-9-]{8,64}$/.test(record.key) ||
              storageKey !== writeStorageKey(sub, record.key) || !routeOK ||
              !record.body || typeof record.body !== 'object' || Array.isArray(record.body) ||
              !['prepared', 'sending', 'uncertain', 'refused'].includes(record.status)) {
            throw new Error('invalid pending record');
          }
          records.push({ ...record, storageKey,
            status: record.status === 'sending' || record.status === 'prepared' ? 'uncertain' : record.status });
        } catch (_) {
          // Do not delete damaged recovery data or allow an unkeyed fallback.
          records.push({ bad: true, storageKey });
        }
      }
    } catch (_) { return [{ bad: true, storageKey: null }]; }
    return records.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  function storeWrite(record) {
    const storageKey = writeStorageKey(record.accountSub, record.key);
    try {
      localStorage.setItem(storageKey, JSON.stringify(record));
      if (localStorage.getItem(storageKey) !== JSON.stringify(record)) throw new Error('storage mismatch');
      return true;
    } catch (_) { return false; }
  }

  function renderWriteRecovery() {
    const box = $('#write-recovery');
    const list = $('#write-recovery-list');
    list.textContent = '';
    if (!state.token) { box.hidden = true; return; }
    const records = pendingWrites();
    box.hidden = records.length === 0;
    for (const record of records) {
      const item = el('div', { className: 'write-recovery__item' });
      const label = record.bad ? 'Recovery data cannot be read. Do not save or pay until you inspect and explicitly discard it.' :
        `${record.kind === 'save' ? 'Expense save' : 'Schedule payment'}: ${record.status === 'refused' ? refusalText(record) : T.writeUncertain}`;
      item.append(el('p', { textContent: label }));
      const actions = el('div', { className: 'write-recovery__actions' });
      if (!record.bad && record.status !== 'refused') {
        const retry = el('button', { type: 'button', className: 'btn btn--primary', textContent: 'Check / retry this action' });
        attrs(retry, { 'data-testid': 'write-retry' });
        retry.addEventListener('click', () => { if (!state.busy) sendWrite(record, retry); });
        actions.append(retry);
      }
      if (record.storageKey) {
        const abandon = el('button', { type: 'button', className: 'btn', textContent: 'Abandon recovery' });
        attrs(abandon, { 'data-testid': 'write-abandon' });
        abandon.addEventListener('click', () => {
          if (state.busy || !window.confirm(T.writeAbandon)) return;
          try { localStorage.removeItem(record.storageKey); }
          catch (_) { toastErr(T.writeStorage); }
          renderWriteRecovery();
        });
        actions.append(abandon);
      }
      item.append(actions);
      list.append(item);
    }
  }

  function validWriteResult(record, result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
    if (record.kind === 'save') {
      return Number.isSafeInteger(result.id) && result.id > 0 &&
        result.amount_cents === record.body.amount_cents &&
        result.category_id === record.body.category_id &&
        result.spent_on === record.body.spent_on && result.note === record.body.note;
    }
    const total = record.body.expected_total_count;
    return Number.isSafeInteger(result.transaction_id) && result.transaction_id > 0 &&
      result.paid_count === record.body.expected_paid_count + 1 &&
      result.remaining_count === (total === null ? null : total - result.paid_count) &&
      result.finished === (total !== null && result.paid_count >= total);
  }

  function refusalText(record) {
    if (record.refusalCode === 'IDEMPOTENCY_CONFLICT') return T.writeKeyConflict;
    if (record.refusalCode === 'IDEMPOTENCY_REPLAY_UNAVAILABLE') return T.writeReplayUnavailable;
    if (record.refusalCode === 'SCHEDULE_CLOSED') return T.scheduleClosed;
    if (record.refusalCode === 'SCHEDULE_CHANGED') return T.writeScheduleChanged;
    return T.writeRefused;
  }

  async function sendWrite(record, button) {
    const epoch = state.sessionEpoch;
    const token = state.token;
    await withBusy(button, async () => {
      try {
        const result = await api(record.route, {
          method: record.kind === 'save' ? 'POST' : 'PATCH', body: record.body,
          headers: { 'Idempotency-Key': record.key },
        });
        if (epoch !== state.sessionEpoch || token !== state.token) return;
        if (!validWriteResult(record, result)) throw apiError(0, 'INVALID_RESPONSE');
        try { localStorage.removeItem(record.storageKey); }
        catch (_) { throw apiError(0, 'STORAGE'); }
        renderWriteRecovery();
        if (record.kind === 'save') {
          toastOk(T.saved(formatMoney(record.body.amount_cents)));
          if (state.screen === 'add') clearAmount();
        } else {
          toastOk(T.paid(record.body.expected_name));
          if (state.screen === 'upcoming') {
            const row = document.querySelector(`[data-testid="schedule-row-${record.targetId}"]`);
            if (result.finished && row) {
              const meta = row.querySelector(`[data-testid="schedule-remaining-${record.targetId}"]`);
              if (meta) meta.textContent = remainingText(record.body.expected_total_count,
                result.remaining_count, record.body.expected_amount_cents);
              markRowFinished(row, record.targetId);
            } else loadUpcoming();
          }
        }
      } catch (err) {
        if (epoch !== state.sessionEpoch || token !== state.token) return;
        record.status = err.status >= 400 && err.status < 500 && err.status !== 401 ? 'refused' : 'uncertain';
        record.refusalCode = err.code === 'CONFLICT' && record.kind === 'pay' ?
          (/no longer active/i.test(err.message) ? 'SCHEDULE_CLOSED' : 'SCHEDULE_CHANGED') : err.code;
        storeWrite(record); // An old persisted identity still makes a reload safe if this fails.
        renderWriteRecovery();
        toastErr(record.status === 'refused' ? refusalText(record) : T.writeUncertain, err);
      }
    }, record.kind === 'pay' ? T.paying : 'Saving…');
  }

  function prepareWrite(kind, route, body, targetId) {
    if (pendingWrites().length) { toastErr(T.writeBlocked); return null; }
    const sub = accountSub();
    if (!sub) { toastErr(T.writeStorage); return null; }
    const key = crypto.randomUUID();
    const record = { kind, accountSub: sub, key, route, body, targetId,
      createdAt: Date.now(), status: 'sending' };
    if (!storeWrite(record)) { toastErr(T.writeStorage); return null; }
    renderWriteRecovery();
    return { ...record, storageKey: writeStorageKey(sub, key) };
  }

  async function saveExpense() {
    const cents = Number(state.amountDigits || '0');
    if (cents <= 0) return toastErr(T.amountRequired);
    if (!state.selectedCategoryId) return toastErr(T.categoryRequired);
    if (state.busy) return;

    const note = $('#expense-note').value.trim();
    const record = prepareWrite('save', '/transactions', {
      amount_cents: cents, category_id: state.selectedCategoryId,
      spent_on: todayIso(), note: note === '' ? null : note,
    });
    if (record) await sendWrite(record, $('#expense-save-btn'));
  }

  // ====================================================== 6.2 · THIS MONTH

  async function loadMonth() {
    const bars = $('#category-bars');
    const list = $('#tx-list');
    const generation = ++state.readGeneration.month;
    const epoch = state.sessionEpoch;
    const token = state.token;
    const current = () => state.readGeneration.month === generation &&
      state.sessionEpoch === epoch && state.token === token && state.screen === 'month';

    let summary, transactions;
    try {
      [summary, transactions] = await Promise.all([
        api('/summary'),
        api(`/transactions?paging=cursor&limit=${PAGE_SIZE}`),
      ]);
    } catch (err) {
      if (current()) toastErr(messageFor(err), err);
      return;
    }
    if (!current()) return;

    state.incomeCents = summary.income_cents;
    state.limitCents = summary.limit_cents;
    state.month.items = transactions.items;
    state.month.total = transactions.total;
    state.month.cursor = transactions.next_cursor;

    renderOverview(summary);
    renderCategoryBars(bars, summary);
    renderTransactions(list, state.month.items);
    renderLoadMore();
  }

  /** Append a stable keyset page, or restart once when the live total changed. */
  async function loadMoreTransactions() {
    if (state.busy || !state.month.cursor) return;
    const generation = state.readGeneration.month;
    const epoch = state.sessionEpoch;
    const token = state.token;
    const current = () => state.readGeneration.month === generation &&
      state.sessionEpoch === epoch && state.token === token && state.screen === 'month';
    await withBusy($('#tx-load-more'), async () => {
      try {
        const next = await api(
          `/transactions?paging=cursor&limit=${PAGE_SIZE}&cursor=${encodeURIComponent(state.month.cursor)}`
        );
        if (!current()) return;
        if (next.total !== state.month.total) {
          // A second tab changed the set. Never append a stale page or report
          // 51 of 50; this user action makes at most one first-page request.
          await loadMonth();
          return;
        }
        state.month.items = state.month.items.concat(next.items);
        state.month.total = next.total;
        state.month.cursor = next.next_cursor;
        renderTransactions($('#tx-list'), state.month.items);
        renderLoadMore();
      } catch (err) {
        if (current()) toastErr(messageFor(err), err);
      }
    });
  }

  /**
   * The count line, and whether there is more to fetch.
   *
   * Shown whenever the month has more than one page — including when everything
   * has been loaded, where it reads "Showing 213 of 213" and the button is
   * gone. A list that stops without saying so is the defect this closes; a list
   * that says how much of itself it is showing cannot have it.
   */
  function renderLoadMore() {
    const wrap = $('#tx-more-wrap');
    const button = $('#tx-load-more');
    const count = $('#tx-count');
    const shown = state.month.items.length;
    const total = state.month.total;

    wrap.hidden = total <= PAGE_SIZE;
    button.hidden = state.month.cursor === null;
    count.textContent = T.shownOf(shown, total);
  }

  /**
   * The donut, the income and what is left (D-021, D-022).
   *
   * The whole ring represents whichever is larger — the income, or what has
   * been spent. Using the income alone would leave nothing to draw once
   * somebody overspends; using the spend alone would hide the income entirely.
   * Taking the larger of the two means the ring is always full and the grey
   * remainder shrinks to nothing exactly when the money runs out.
   */
  function renderOverview(summary) {
    const spent = summary.total_cents;
    const income = summary.income_cents;
    const whole = Math.max(income, spent);

    const total = $('[data-testid="month-total"]');
    total.textContent = formatMoney(spent);
    total.classList.toggle('donut__value--compact', total.textContent.length > 10);
    renderDonut(summary, whole);
    renderFigures(income, spent);
    renderLimit(summary);
  }

  function renderDonut(summary, whole) {
    const slices = $('#donut-slices');
    slices.textContent = '';
    if (whole <= 0) return;                  // nothing earned, nothing spent

    // stroke-dasharray draws one arc per circle: the dash is the slice, the gap
    // is everything else, and the offset rotates it to where it belongs. One
    // circle per category is far less code than computing arc paths by hand.
    let consumed = 0;
    summary.by_category.forEach((row, index) => {
      if (row.total_cents === 0) return; // A zero-spend budget has no donut arc.
      const length = (row.total_cents / whole) * DONUT_CIRCUMFERENCE;
      const arc = svg('circle', {
        cx: 60, cy: 60, r: DONUT_RADIUS,
        class: 'donut__slice',
        stroke: SLICE_COLOURS[index % SLICE_COLOURS.length],
        'stroke-dasharray': `${length} ${DONUT_CIRCUMFERENCE - length}`,
        'stroke-dashoffset': -consumed,
        'data-testid': `donut-slice-${row.category_id === null ? 'none' : row.category_id}`,
      });
      arc.append(svg('title', {}, `${row.name || T.uncategorised}: ${formatMoney(row.total_cents)}`));
      slices.append(arc);
      consumed += length;
    });
  }

  function renderFigures(income, spent) {
    const remaining = income - spent;

    $('#income-value').textContent = income > 0 ? formatMoney(income) : T.incomeNotSet;

    // Overspending is shown as "Over €40.00", not as a minus sign tucked into a
    // number somebody might read past.
    const label = $('#remaining-label');
    const value = $('#month-remaining');
    if (income <= 0) {
      label.textContent = T.left;
      value.textContent = '—';
      value.classList.remove('figure--over');
      return;
    }
    label.textContent = remaining < 0 ? T.over : T.left;
    value.textContent = formatMoney(Math.abs(remaining));
    value.classList.toggle('figure--over', remaining < 0);
  }

  /** SVG elements need createElementNS; the HTML helper cannot make them. */
  function svg(tag, attributes, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, val] of Object.entries(attributes)) {
      node.setAttribute(key, String(val));
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /**
   * The limit and the state the server computed from it.
   *
   * The browser renders, it does not judge: `limit_status` arrives decided, so
   * the screen and the API can never disagree about whether a month is over
   * budget (qa/docs/analysis-monthly-limit.md, RISK-ML-3).
   */
  function renderLimit(summary) {
    const value = $('#limit-value');
    const status = $('#limit-status');
    const left = summary.limit_remaining_cents;

    value.textContent = summary.limit_cents === null
      ? T.limitNotSet
      : formatMoney(summary.limit_cents);

    if (summary.limit_status === 'not_set') {
      status.hidden = true;
      status.textContent = '';
      // No limit, nothing to judge, no box (UAT-OBS-01).
      status.classList.remove('figure--over', 'limit-status--left', 'limit-status--used-up');
      return;
    }

    status.hidden = false;
    if (summary.limit_status === 'within') status.textContent = T.limitWithin(formatMoney(left));
    else if (summary.limit_status === 'reached') status.textContent = T.limitReached;
    else status.textContent = T.limitOver(formatMoney(Math.abs(left)));
    // Text first; the class is for anyone styling it, never the only signal.
    status.classList.toggle('figure--over', summary.limit_status === 'exceeded');

    // The box asks a coarser question than the sentence does: is there
    // budget left, yes or no. Spending exactly the limit is 'reached' in
    // words — not over — and still leaves nothing, so it gets the red box
    // (UAT-OBS-01). The words keep the distinction the box drops, which is
    // why colour is never the only carrier (REQ-ML-09 AC-09.3).
    const budgetLeft = left > 0;
    status.classList.toggle('limit-status--left', budgetLeft);
    status.classList.toggle('limit-status--used-up', !budgetLeft);
  }

  function renderCategoryBars(container, summary) {
    container.textContent = '';

    summary.by_category.forEach((row, index) => {
      // category_id is nullable: a transaction can be saved without one, and
      // the summary keeps it so the parts still sum to the whole. "none" is a
      // stable suffix, not a generated one, so the testid stays assertable.
      const key = row.category_id === null ? 'none' : row.category_id;
      const name = row.name || T.uncategorised;
      const percent = summary.total_cents === 0 ? 0 : Math.round((row.total_cents * 100) / summary.total_cents);

      const fill = el('div', { className: 'bar__fill' });
      fill.style.width = `${percent}%`;
      // Same hue as this category's arc in the donut, by the same index. Two
      // views of one set of numbers should not be colour-coded differently.
      fill.style.background = SLICE_COLOURS[index % SLICE_COLOURS.length];

      const content = [
        el('div', { className: 'bar__head' }, [
          el('span', { className: 'bar__name', textContent: name }),
          el('span', { className: 'bar__amount', textContent: row.limit_cents === null
            ? formatMoney(row.total_cents)
            : `${formatMoney(row.total_cents)} of ${formatMoney(row.limit_cents)}` }),
        ]),
        el('div', { className: 'bar__track' }, [fill]),
      ];
      if (row.limit_status !== 'not_set') {
        const text = row.limit_status === 'within'
          ? T.limitWithin(formatMoney(row.limit_remaining_cents))
          : row.limit_status === 'reached' ? T.limitReached
            : T.limitOver(formatMoney(Math.abs(row.limit_remaining_cents)));
        content.push(attrs(el('span', {
          className: `limit-status ${row.limit_status === 'within' ? 'limit-status--left' : 'limit-status--used-up'}`,
          textContent: text,
        }), { 'data-testid': `category-limit-status-${key}` }));
      }
      const bar = el('div', { className: 'bar', role: 'listitem' });
      if (row.category_id !== null) {
        const control = el('button', {
          type: 'button', className: 'bar__control',
        }, content);
        attrs(control, { 'data-testid': `category-limit-edit-${key}`, 'aria-label': `Edit category limit: ${name}` });
        control.addEventListener('click', () => openCategoryLimitEditor(row));
        bar.append(control);
      } else {
        // Uncategorised is not a category, so it is never an editor control.
        for (const child of content) bar.append(child);
      }
      attrs(bar, {
        'data-testid': `category-bar-${key}`,
        'aria-label': `${name}: ${formatMoney(row.total_cents)}, ${percent}%`,
      });
      container.append(bar);
    });
  }

  function renderTransactions(container, items) {
    container.textContent = '';

    if (items.length === 0) {
      container.append(el('p', { className: 'empty', textContent: T.noExpenses }));
      return;
    }

    // Grouped by day, newest first. The server already returns them in
    // spent_on DESC order, so a single pass preserves it.
    let currentDay = null;
    let group = null;

    for (const tx of items) {
      if (tx.spent_on !== currentDay) {
        currentDay = tx.spent_on;
        group = el('section', { className: 'daygroup' }, [
          el('h2', { className: 'daygroup__label', textContent: formatDayHeading(tx.spent_on) }),
        ]);
        container.append(group);
      }
      group.append(transactionRow(tx));
    }
  }

  function transactionRow(tx) {
    const category = state.categoryById.get(tx.category_id);
    const categoryName = category ? category.name : T.uncategorised;

    // A payment generated by a schedule carries the schedule's name as its
    // note, and that name is what identifies the row to a reader — so the note
    // takes the main line when there is one, and the category drops below it.
    const title = tx.note || categoryName;
    const subtitle = tx.note ? categoryName : null;

    const del = el('button', {
      type: 'button',
      className: 'tx__del',
      textContent: '✕',
    });
    attrs(del, {
      'data-testid': `tx-delete-${tx.id}`,
      'aria-label': T.deleteExpense(`${title} ${formatMoney(tx.amount_cents)}`),
    });
    del.addEventListener('click', () => deleteTransaction(tx.id, del));

    // The body is a button, not a div with a click handler: it is the control
    // that opens the editor (spec §6.2, D-029), and a control that cannot be
    // reached by keyboard or announced by a screen reader is not a control.
    const nameLine = el('div', { className: 'tx__name', textContent: title });
    attrs(nameLine, { 'data-testid': `tx-name-${tx.id}` });
    const body = el('button', { type: 'button', className: 'tx__body' }, [
      nameLine,
      subtitle ? el('div', { className: 'tx__note', textContent: subtitle }) : null,
    ]);
    attrs(body, {
      'data-testid': `tx-edit-${tx.id}`,
      'aria-label': T.editExpense(`${title} ${formatMoney(tx.amount_cents)}`),
    });
    body.addEventListener('click', () => openTransactionEditor(tx));

    const amount = el('span', { className: 'tx__amount', textContent: formatMoney(tx.amount_cents) });
    attrs(amount, { 'data-testid': `tx-amount-${tx.id}` });

    const row = el('div', { className: 'tx' }, [
      el('span', { className: 'tx__icon', textContent: category ? (category.icon || '•') : '•' }),
      body,
      amount,
      del,
    ]);
    attrs(row, { 'data-testid': `tx-row-${tx.id}` });
    return row;
  }

  // ------------------------------------------------- editing an expense (D-029)

  let transactionEditOpener = null;

  function transactionEditError(text, err) {
    toastErr(text, err);
    if (!$('#tx-edit-sheet').open) return;
    $('#tx-edit-error').textContent = text;
    $('#tx-edit-error-ref').hidden = !err?.requestId;
    $('#tx-edit-error-ref-code').textContent = err?.requestId ? err.requestId.slice(0, 8) : '';
    $('#tx-edit-error-box').hidden = false;
  }

  function openTransactionEditor(tx) {
    transactionEditOpener = document.activeElement;
    state.month.editing = tx.id;

    const select = $('#tx-edit-category');
    select.textContent = '';
    // An expense may legitimately have no category (D-029), so the list needs a
    // way to say that. Without this option "no category" had no value to select,
    // the select fell back to an empty string, and saving turned it into 0
    // (BUG-015). The same option exists in the AI review form.
    select.append(el('option', { value: '', textContent: T.uncategorised }));
    for (const category of state.categories) {
      const option = el('option', {
        value: String(category.id),
        textContent: `${category.icon || '•'} ${category.name}`,
      });
      select.append(option);
    }
    select.value = tx.category_id === null ? '' : String(tx.category_id);

    $('#tx-edit-amount').value = centsToInput(tx.amount_cents);
    $('#tx-edit-date').value = tx.spent_on;
    $('#tx-edit-note').value = tx.note || '';
    $('#tx-edit-error-box').hidden = true;

    $('#tx-edit-sheet').showModal();
    $('#tx-edit-amount').focus();
  }

  function closeTransactionEditor() {
    if ($('#tx-edit-sheet').open) $('#tx-edit-sheet').close();
    $('#tx-edit-error-box').hidden = true;
    state.month.editing = null;
    transactionEditOpener = null;
  }

  function dismissTransactionEditor() {
    if (state.busy) return; // A pending PATCH has an uncertain outcome.
    const opener = transactionEditOpener;
    closeTransactionEditor();
    if (opener?.isConnected) opener.focus();
  }

  /**
   * Sends only what changed.
   *
   * Not an economy — it is the point of PATCH here (D-029). Sending the whole
   * row would mean sending the fields this screen last read, which in a second
   * tab are already old, and reinstating them is how one tab silently undoes
   * another. An empty patch is not sent at all, because the API answers 400 to
   * one and being told off for changing nothing is not useful to a person who
   * pressed Save by reflex.
   */
  async function submitTransactionEdit(event) {
    event.preventDefault();
    if (state.busy) return;

    const id = state.month.editing;
    const original = state.month.items.find((t) => t.id === id);
    if (!original) return closeTransactionEditor();

    const cents = parseAmountToCents($('#tx-edit-amount').value);
    if (cents === null) return transactionEditError(T.amountRequired);
    if (cents > MAX_AMOUNT_CENTS) return transactionEditError(T.amountTooBig);

    // Empty means Uncategorised, which is null — not 0. Number('') is 0, and 0
    // is neither a category nor the null it replaced, so the patch below saw a
    // change that had not happened and the server refused it (BUG-015).
    const rawCategory = $('#tx-edit-category').value;
    const categoryId = rawCategory === '' ? null : Number(rawCategory);
    const spentOn = $('#tx-edit-date').value;
    const note = $('#tx-edit-note').value.trim();

    const patch = {};
    if (cents !== original.amount_cents) patch.amount_cents = cents;
    if (categoryId !== original.category_id) patch.category_id = categoryId;
    if (spentOn && spentOn !== original.spent_on) patch.spent_on = spentOn;
    if (note !== (original.note || '')) patch.note = note === '' ? null : note;

    if (Object.keys(patch).length === 0) return dismissTransactionEditor();

    $('#tx-edit-error-box').hidden = true;

    await withBusy($('[data-testid="tx-edit-save"]'), async () => {
      try {
        await api(`/transactions/${id}`, { method: 'PATCH', body: patch });
        toastOk(T.expenseSaved);
        closeTransactionEditor();
        await loadMonth();
      } catch (err) {
        // A 404 here is the other tab having deleted it. Saying so and
        // refreshing is more use than the generic message, and the screen must
        // not keep showing a row the server no longer has.
        if (err.status === 404) {
          transactionEditError(T.expenseGone, err);
          closeTransactionEditor();
          await loadMonth();
          return;
        }
        transactionEditError(messageFor(err), err);
      }
    });
  }

  async function deleteTransaction(id, button) {
    if (state.busy) return;
    await withBusy(button, async () => {
      try {
        await api(`/transactions/${id}`, { method: 'DELETE' });
        toastOk(T.deleted);
        await loadMonth();
      } catch (err) {
        toastErr(messageFor(err), err);
      }
    });
  }

  // ------------------------------------------------------- income (D-021)

  function openIncomeForm() {
    const form = $('#income-form');
    const input = $('#income-input');
    // Pre-filled with the current figure so changing it is an edit rather than
    // a re-entry, and empty when nothing is set so the placeholder shows.
    input.value = state.incomeCents > 0 ? centsToInput(state.incomeCents) : '';
    form.hidden = false;
    $('.overview').hidden = true;
    input.focus();
  }

  function closeIncomeForm() {
    $('#income-form').hidden = true;
    $('.overview').hidden = false;
  }

  /** 150000 -> "1500.00". Integer arithmetic; see formatMoney. */
  function centsToInput(cents) {
    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
  }

  async function submitIncome(event) {
    event.preventDefault();
    if (state.busy) return;

    const cents = parseAmountToCents($('#income-input').value);
    if (cents === null) return toastErr(T.incomeInvalid);
    if (cents > MAX_AMOUNT_CENTS) return toastErr(T.amountTooBig);

    await withBusy($('[data-testid="income-save"]'), async () => {
      try {
        await api('/settings', {
          method: 'PUT',
          body: { monthly_income_cents: cents },
        });
        toastOk(T.incomeSaved);
        closeIncomeForm();
        await loadMonth();
      } catch (err) {
        toastErr(messageFor(err), err);
      }
    });
  }

  // ------------------------------- monthly spending limit (analysis doc §2)

  function openLimitForm() {
    const form = $('#limit-form');
    const input = $('#limit-input');
    // Empty when nothing is set, so the placeholder shows and saving an empty
    // field is the same gesture as "I do not want a limit".
    input.value = state.limitCents === null ? '' : centsToInput(state.limitCents);
    form.hidden = false;
    $('.overview').hidden = true;
    input.focus();
  }

  function closeLimitForm() {
    $('#limit-form').hidden = true;
    $('.overview').hidden = false;
  }

  async function submitLimit(event) {
    event.preventDefault();
    if (state.busy) return;

    const raw = $('#limit-input').value.trim();
    // An empty field clears the limit. null is "no limit", which is a
    // different state from a limit of zero (assumption A3).
    const cents = raw === '' ? null : parseAmountToCents(raw);
    if (raw !== '' && cents === null) return toastErr(T.limitInvalid);
    if (cents !== null && cents > MAX_AMOUNT_CENTS) return toastErr(T.amountTooBig);

    await withBusy($('[data-testid="limit-save"]'), async () => {
      try {
        await api('/settings', {
          method: 'PUT',
          body: { monthly_income_cents: state.incomeCents, monthly_limit_cents: cents },
        });
        toastOk(cents === null ? T.limitCleared : T.limitSaved);
        closeLimitForm();
        await loadMonth();
      } catch (err) {
        toastErr(messageFor(err), err);
      }
    });
  }

  // Category budgets use the server's judgement; the browser never recomputes it.
  let editingCategoryLimit = null;

  function openCategoryLimitEditor(row) {
    editingCategoryLimit = row.category_id;
    $('#category-limit-error').hidden = true;
    $('#category-limit-title').textContent = `Category limit · ${row.name}`;
    $('#category-limit-input').value = row.limit_cents === null ? '' : centsToInput(row.limit_cents);
    $('#category-limit-dialog').showModal();
    $('#category-limit-input').focus();
  }

  async function submitCategoryLimit(event) {
    event.preventDefault();
    if (state.busy || editingCategoryLimit === null) return;
    const raw = $('#category-limit-input').value.trim();
    const cents = raw === '' ? null : parseAmountToCents(raw);
    const showError = (message) => {
      $('#category-limit-error').textContent = message;
      $('#category-limit-error').hidden = false;
    };
    $('#category-limit-error').hidden = true;
    if (raw !== '' && cents === null) return showError(T.limitInvalid);
    if (cents !== null && cents > MAX_AMOUNT_CENTS) return showError(T.amountTooBig);
    const id = editingCategoryLimit;
    await withBusy($('[data-testid="category-limit-save"]'), async () => {
      try {
        const category = await api(`/categories/${id}`, {
          method: 'PATCH', body: { monthly_limit_cents: cents },
        });
        state.categories = state.categories.map(c => c.id === id ? category : c);
        state.categoryById.set(id, category);
        $('#category-limit-dialog').close();
        editingCategoryLimit = null;
        toastOk(cents === null ? T.limitCleared : T.limitSaved);
        await loadMonth();
        // The refresh replaces the opener; restore focus to its new instance.
        $(`[data-testid="category-limit-edit-${id}"]`)?.focus();
      } catch (err) {
        // The native modal is above page toasts: keep the error in its top layer.
        showError(messageFor(err));
      }
    });
  }

  // ======================================================== 6.3 · UPCOMING
  async function loadUpcoming() {
    const container = $('#upcoming-list');
    const generation = ++state.readGeneration.upcoming;
    const epoch = state.sessionEpoch;
    const token = state.token;
    const current = () => state.readGeneration.upcoming === generation &&
      state.sessionEpoch === epoch && state.token === token && state.screen === 'upcoming';
    let schedules;
    try {
      schedules = await api('/schedules?active=1');
    } catch (err) {
      if (current()) toastErr(messageFor(err), err);
      return;
    }
    if (!current()) return;

    container.textContent = '';
    if (schedules.length === 0) {
      container.append(el('p', { className: 'empty', textContent: T.noSchedules }));
      return;
    }
    for (const schedule of schedules) {
      container.append(scheduleRow(schedule, { withPayButton: true }));
    }
  }

  /**
   * One schedule row. `withPayButton` is what keeps the Upcoming and Schedules
   * screens from both rendering a `schedule-pay-{id}` for the same schedule —
   * duplicate testids would make a by-testid selector ambiguous. The screens
   * also clear each other's lists on navigation, for the same reason.
   */
  function scheduleRow(schedule, { withPayButton }) {
    const isLoan = schedule.total_count !== null;

    const dueDate = el('span', {
      className: 'row__date',
      textContent: formatDayMonth(schedule.next_due),
    });
    attrs(dueDate, { 'data-testid': `schedule-next-due-${schedule.id}` });

    const top = el('div', { className: 'row__top' }, [
      dueDate,
      el('span', { className: 'row__name', textContent: schedule.name }),
      el('span', { className: 'row__amount', textContent: formatMoney(schedule.amount_cents) }),
    ]);

    const meta = el('span', { className: 'row__meta' });
    attrs(meta, { 'data-testid': `schedule-remaining-${schedule.id}` });
    meta.textContent = remainingText(schedule.total_count, schedule.remaining_count,
                                     schedule.amount_cents);

    const bottom = el('div', { className: 'row__bottom' }, [meta]);

    if (withPayButton) {
      const pay = el('button', {
        type: 'button',
        className: 'btn btn--primary row__pay',
        textContent: T.pay,
      });
      attrs(pay, {
        'data-testid': `schedule-pay-${schedule.id}`,
        'aria-label': T.payAria(schedule.name),
      });
      pay.addEventListener('click', () => paySchedule(schedule, pay));
      bottom.append(pay);
    } else {
      const edit = el('button', {
        type: 'button', className: 'btn', textContent: 'Edit',
      });
      attrs(edit, {
        'data-testid': `schedule-edit-${schedule.id}`,
        'aria-label': T.editSchedule(schedule.name),
      });
      edit.addEventListener('click', () => openScheduleEditor(schedule, edit));
      bottom.append(edit);
    }

    const row = el('div', { className: 'row' }, [top, bottom]);
    attrs(row, { 'data-testid': `schedule-row-${schedule.id}` });
    if (!schedule.active) markRowFinished(row, schedule.id);
    return row;
  }

  /**
   * The countdown line for a schedule. One function so the two places that
   * write it — the initial render and the final payment — cannot disagree.
   * BUG-002 was exactly that disagreement: only the render updated it, so a
   * loan closed by its last payment kept saying one instalment was left.
   */
  function remainingText(totalCount, remainingCount, amountCents) {
    if (totalCount === null) return T.subscription;
    return T.remaining(remainingCount, totalCount) +
           `${NBSP}·${NBSP}` + formatMoney(remainingCount * amountCents);
  }

  /** The finished state required by spec §6.3, applied in place. */
  function markRowFinished(row, scheduleId) {
    row.classList.add('row--done');
    const bottom = row.querySelector('.row__bottom');
    const pay = bottom.querySelector('.row__pay');
    if (pay) pay.remove();
    if (!bottom.querySelector('.row__done')) {
      const done = el('span', { className: 'row__done', textContent: T.finished });
      // Asserted by the end-to-end tests, so it gets a testid like everything
      // else they look at (spec §6.5 covers asserted elements, not only
      // interactive ones).
      attrs(done, { 'data-testid': `schedule-finished-${scheduleId}` });
      bottom.append(done);
    }
  }

  async function paySchedule(schedule, button) {
    if (state.busy) return;
    const record = prepareWrite('pay', `/schedules/${schedule.id}/pay`, {
      expected_paid_count: schedule.paid_count,
      expected_amount_cents: schedule.amount_cents,
      expected_category_id: schedule.category_id,
      expected_name: schedule.name,
      expected_total_count: schedule.total_count,
      spent_on: todayIso(),
    }, schedule.id);
    if (record) await sendWrite(record, button);
  }

  // ======================================================= 6.4 · SCHEDULES

  let scheduleEdit = null;
  let scheduleEditSerial = 0;

  function scheduleEditError(text) {
    if (!$('#schedule-edit-dialog').open) return;
    $('#schedule-edit-error').textContent = text;
    $('#schedule-edit-error').hidden = false;
  }

  function openScheduleEditor(schedule, opener) {
    if (state.busy || state.screen !== 'schedules') return;
    const select = $('#schedule-edit-category');
    select.textContent = '';
    select.append(el('option', { value: '', textContent: T.uncategorised }));
    for (const category of state.categories) {
      select.append(el('option', { value: String(category.id),
        textContent: `${category.icon || '•'} ${category.name}` }));
    }
    select.value = schedule.category_id !== null && state.categoryById.has(schedule.category_id)
      ? String(schedule.category_id) : '';
    $('#schedule-edit-name').value = schedule.name;
    $('#schedule-edit-amount').value = centsToInput(schedule.amount_cents);
    $('#schedule-edit-day').value = String(schedule.day_of_month);
    $('#schedule-edit-starts-on').value = schedule.starts_on;
    $('#schedule-edit-is-loan').checked = schedule.total_count !== null;
    $('#schedule-edit-total-count').value = schedule.total_count === null ? '' : String(schedule.total_count);
    $('#schedule-edit-count-field').hidden = schedule.total_count === null;
    $('#schedule-edit-error').hidden = true;
    scheduleEdit = { schedule, opener, epoch: state.sessionEpoch, token: state.token,
      serial: ++scheduleEditSerial, saving: false };
    $('#schedule-edit-dialog').showModal();
    $('#schedule-edit-name').focus();
  }

  function closeScheduleEditor(restoreFocus = true) {
    const edit = scheduleEdit;
    if (!edit && !$('#schedule-edit-dialog').open) return;
    scheduleEditSerial += 1; // Invalidates any still-running PATCH callback.
    scheduleEdit = null;
    if (edit?.saving) {
      state.busyOwner = null;
      state.busy = false;
    }
    const save = $('#schedule-edit-save');
    save.disabled = false;
    save.textContent = 'Save changes';
    if ($('#schedule-edit-dialog').open) $('#schedule-edit-dialog').close();
    $('#schedule-edit-error').hidden = true;
    if (restoreFocus && edit?.opener?.isConnected) edit.opener.focus();
  }

  function dismissScheduleEditor() {
    if (scheduleEdit?.saving) return scheduleEditError(T.editSchedulePending);
    closeScheduleEditor();
  }

  async function submitScheduleEdit(event) {
    event.preventDefault();
    const edit = scheduleEdit;
    if (!edit || state.busy || state.screen !== 'schedules') return;
    const original = edit.schedule;
    const name = $('#schedule-edit-name').value.trim();
    const cents = parseAmountToCents($('#schedule-edit-amount').value);
    const dayRaw = $('#schedule-edit-day').value;
    const day = Number(dayRaw);
    const startsOn = $('#schedule-edit-starts-on').value;
    const categoryRaw = $('#schedule-edit-category').value;
    const categoryId = categoryRaw === '' ? null : Number(categoryRaw);
    const isLoan = $('#schedule-edit-is-loan').checked;
    const countRaw = $('#schedule-edit-total-count').value;
    const totalCount = isLoan ? Number(countRaw) : null;

    if (!name || name.length > 60) return scheduleEditError(T.nameRequired);
    if (cents === null || cents <= 0) return scheduleEditError(T.amountInvalid);
    if (cents > MAX_AMOUNT_CENTS) return scheduleEditError(T.amountTooBig);
    if (!dayRaw || !Number.isInteger(day) || day < 1 || day > 31) return scheduleEditError(T.dayInvalid);
    if (!startsOn) return scheduleEditError(T.dateRequired);
    if (categoryId !== null && !state.categoryById.has(categoryId)) return scheduleEditError(T.categoryRequired);
    if (isLoan && (!countRaw || !Number.isInteger(totalCount) || totalCount < 1)) {
      return scheduleEditError(T.totalCountInvalid);
    }
    if (isLoan && totalCount > MAX_TOTAL_COUNT) return scheduleEditError(T.totalCountTooMany);

    const patch = {};
    if (name !== original.name) patch.name = name;
    if (cents !== original.amount_cents) patch.amount_cents = cents;
    if (categoryId !== original.category_id) patch.category_id = categoryId;
    if (day !== original.day_of_month) patch.day_of_month = day;
    if (startsOn !== original.starts_on) patch.starts_on = startsOn;
    if (totalCount !== original.total_count) patch.total_count = totalCount;
    if (!Object.keys(patch).length) return dismissScheduleEditor();

    $('#schedule-edit-error').hidden = true;
    edit.saving = true;
    const current = () => scheduleEdit === edit && scheduleEditSerial === edit.serial &&
      state.sessionEpoch === edit.epoch && state.token === edit.token && state.screen === 'schedules';
    await withBusy($('#schedule-edit-save'), async () => {
      try {
        const updated = await api(`/schedules/${original.id}`, { method: 'PATCH', body: patch });
        if (!current()) return;
        if (!updated || updated.id !== original.id ||
            Object.entries(patch).some(([field, value]) => updated[field] !== value)) {
          return scheduleEditError(T.editScheduleUncertain);
        }
        closeScheduleEditor(false);
        toastOk(T.scheduleUpdated(updated.name));
        await loadSchedules();
        if (state.screen === 'schedules' && state.sessionEpoch === edit.epoch && state.token === edit.token) {
          $(`[data-testid="schedule-edit-${original.id}"]`)?.focus();
        }
      } catch (err) {
        if (!current()) return;
        scheduleEditError(err.status === 404 ? T.editScheduleGone :
          err.status === 409 ? (err.message || T.editScheduleConflict) :
          err.status === 0 || err.status >= 500 ? T.editScheduleUncertain : messageFor(err));
      }
    }, 'Saving…');
    if (current()) edit.saving = false;
  }

  async function loadSchedules() {
    const container = $('#schedules-list');
    const generation = ++state.readGeneration.schedules;
    const epoch = state.sessionEpoch;
    const token = state.token;
    const current = () => state.readGeneration.schedules === generation &&
      state.sessionEpoch === epoch && state.token === token && state.screen === 'schedules';
    let schedules;
    try {
      schedules = await api('/schedules');
    } catch (err) {
      if (current()) toastErr(messageFor(err), err);
      return;
    }
    if (!current()) return;

    container.textContent = '';
    if (schedules.length === 0) {
      container.append(el('p', { className: 'empty', textContent: T.noSchedules }));
      return;
    }
    for (const schedule of schedules) {
      container.append(scheduleRow(schedule, { withPayButton: false }));
    }
  }

  function renderScheduleCategoryOptions() {
    const select = $('#schedule-category');
    select.textContent = '';
    select.append(el('option', { value: '', textContent: T.uncategorised }));
    for (const category of state.categories) {
      select.append(el('option', {
        value: String(category.id),
        textContent: `${category.icon || '•'} ${category.name}`,
      }));
    }
  }

  async function submitSchedule(event) {
    event.preventDefault();
    if (state.busy) return;

    const form = event.target;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const cents = parseAmountToCents(data.get('amount') || '');
    const day = Number(data.get('day_of_month'));
    const startsOn = String(data.get('starts_on') || '');
    const isLoan = data.get('is_loan') === 'on';
    const totalCount = isLoan ? Number(data.get('total_count')) : null;

    if (!name) return toastErr(T.nameRequired);
    if (cents === null || cents <= 0) return toastErr(T.amountInvalid);
    if (cents > MAX_AMOUNT_CENTS) return toastErr(T.amountTooBig);
    if (!Number.isInteger(day) || day < 1 || day > 31) return toastErr(T.dayInvalid);
    if (!startsOn) return toastErr(T.dateRequired);
    if (isLoan && (!Number.isInteger(totalCount) || totalCount < 1)) {
      return toastErr(T.totalCountInvalid);
    }
    // The server's ceiling, said here instead of after a round trip. Past it
    // the instalments no longer multiply out to an exact number of cents
    // (BUG-018, D-046).
    if (isLoan && totalCount > MAX_TOTAL_COUNT) {
      return toastErr(T.totalCountTooMany);
    }

    const categoryRaw = String(data.get('category_id') || '');
    const body = {
      name,
      amount_cents: cents,
      category_id: categoryRaw === '' ? null : Number(categoryRaw),
      day_of_month: day,
      starts_on: startsOn,
    };
    if (isLoan) body.total_count = totalCount;

    await withBusy(form.querySelector('[data-testid="schedule-save-btn"]'), async () => {
      try {
        const created = await api('/schedules', { method: 'POST', body });
        toastOk(T.scheduleAdded(created.name));
        form.reset();
        $('#total-count-field').hidden = true;
        $('#schedule-day-hint').textContent = '';
        await loadSchedules();
      } catch (err) {
        toastErr(messageFor(err), err);
      }
    });
  }

  // ============================================================== NAVIGATION

  const SCREENS = {
    add:       { section: '#screen-add',       nav: '[data-testid="nav-add"]',       load: null },
    month:     { section: '#screen-month',     nav: '[data-testid="nav-month"]',     load: loadMonth },
    upcoming:  { section: '#screen-upcoming',  nav: '[data-testid="nav-upcoming"]',  load: loadUpcoming },
    schedules: { section: '#screen-schedules', nav: '[data-testid="nav-schedules"]', load: loadSchedules },
  };

  // Lists cleared when their screen is left. Two screens can render a row for
  // the same schedule, and a testid that appears twice in the document is not
  // a usable selector — so only the visible screen's rows exist at all.
  const CLEAR_ON_LEAVE = {
    month: ['#tx-list', '#category-bars'],
    upcoming: ['#upcoming-list'],
    schedules: ['#schedules-list'],
  };

  function showScreen(name) {
    for (const id of CLEAR_ON_LEAVE[state.screen] || []) {
      $(id).textContent = '';
    }
    // Otherwise the form is still open when Month is opened again, showing an
    // edit nobody started.
    if (state.screen === 'month' && name !== 'month') {
      closeIncomeForm();
      // The editor is a sibling of the nav now, not a child of the month
      // screen, so hiding the screen no longer hides it.
      closeTransactionEditor();
    }
    if (state.screen === 'schedules' && name !== 'schedules') closeScheduleEditor(false);
    state.screen = name;
    renderWriteRecovery();
    for (const feature of features) if (feature.onScreen) feature.onScreen(name);

    for (const [key, screen] of Object.entries(SCREENS)) {
      const active = key === name;
      $(screen.section).hidden = !active;
      const navButton = $(screen.nav);
      if (active) navButton.setAttribute('aria-current', 'page');
      else navButton.removeAttribute('aria-current');
    }

    if (SCREENS[name].load) SCREENS[name].load();
  }

  // ==================================================================== BOOT

  async function startApp() {
    state.sessionEpoch += 1;
    const epoch = state.sessionEpoch;
    const token = state.token;
    const generation = ++state.readGeneration.categories;
    $('#screen-auth').hidden = true;
    $('#app').hidden = false;
    // Nav must not accept a screen switch that the pending bootstrap would
    // later undo with showScreen('add'). It becomes usable after categories.
    $('#nav').hidden = true;

    try {
      const categories = await api('/categories');
      if (state.sessionEpoch !== epoch || state.token !== token ||
          state.readGeneration.categories !== generation) return;
      state.categories = categories;
    } catch (err) {
      if (state.sessionEpoch !== epoch || state.token !== token ||
          state.readGeneration.categories !== generation) return;
      // A 401 has already sent the user back to sign-in; anything else leaves
      // the app usable with an empty category grid rather than a blank screen.
      if (err.status !== 401) toastErr(messageFor(err), err);
      state.categories = [];
    }

    state.categoryById = new Map(state.categories.map((c) => [c.id, c]));
    renderCategories();
    renderScheduleCategoryOptions();
    clearAmount();
    renderWriteRecovery();
    showScreen('add');
    $('#nav').hidden = false;
    for (const feature of features) if (feature.onSessionStart) feature.onSessionStart();
  }

  /**
   * Re-reads the category list without touching what the person has typed or
   * selected on Add. Used when a save is refused because a category vanished.
   */
  async function reloadCategories() {
    const epoch = state.sessionEpoch;
    const token = state.token;
    const generation = ++state.readGeneration.categories;
    const categories = await api('/categories');
    if (state.sessionEpoch !== epoch || state.token !== token ||
        state.readGeneration.categories !== generation) return;
    state.categories = categories;
    state.categoryById = new Map(state.categories.map((c) => [c.id, c]));
    const selected = state.selectedCategoryId;
    renderCategories();
    renderScheduleCategoryOptions();
    if (selected !== null && state.categoryById.has(selected)) selectCategory(selected);
    return state.categories;
  }

  // What a feature module may use. Deliberately small: no state object, no
  // DOM helpers, no way to reach the manual Add form.
  const host = {
    token: () => state.token,
    epoch: () => state.sessionEpoch,
    categories: () => state.categories,
    reloadCategories,
    signOut: () => signOut(T.signedOut),
    formatMoney,
    centsToInput,
    parseAmountToCents,
    todayIso,
    maxAmountCents: MAX_AMOUNT_CENTS,
    monthName: (month) => MONTHS_LONG[month - 1],
    toastOk,
    toastErr,
    refreshMonth: () => { if (state.screen === 'month') loadMonth(); },
  };

  function bindEvents() {
    window.addEventListener('storage', event => {
      if (event.key && event.key.startsWith(WRITE_PREFIX)) renderWriteRecovery();
    });
    $('#auth-form').addEventListener('submit', submitAuth);
    $('#auth-toggle').addEventListener('click', () => {
      setAuthMode(state.authMode === 'login' ? 'register' : 'login');
    });

    // One listener for the keypad instead of twelve: the digit is on the
    // button, so the handler never has to parse the label.
    document.querySelector('.keypad').addEventListener('click', (event) => {
      const key = event.target.closest('.key');
      if (!key || !key.dataset.digit) return;
      pressDigit(key.dataset.digit);
    });
    $('#keypad-clear').addEventListener('click', clearAmount);
    $('#expense-save-btn').addEventListener('click', saveExpense);
    $('#import-preview').addEventListener('click', previewImport);
    $('#import-confirm').addEventListener('click', confirmImport);
    $('#import-cancel').addEventListener('click', () => $('#import-dialog').close());
    $('#import-dialog').addEventListener('cancel', event => { if (importSaving) event.preventDefault(); });
    $('#import-dialog').addEventListener('close', () => { if (!importSaving) importBatch = null; });

    $('#nav').addEventListener('click', (event) => {
      const button = event.target.closest('.nav__btn');
      if (button) showScreen(button.dataset.screen);
    });

    $('#schedule-is-loan').addEventListener('change', (event) => {
      $('#total-count-field').hidden = !event.target.checked;
    });

    // G5 / D-011: clamping is correct but invisible, so the one surprising
    // case explains itself in the field that causes it.
    $('[data-testid="schedule-day"]').addEventListener('input', (event) => {
      const day = Number(event.target.value);
      $('#schedule-day-hint').textContent =
        Number.isInteger(day) && day > 28 && day <= 31 ? T.clampHint(day) : '';
    });

    $('#schedule-form').addEventListener('submit', submitSchedule);
    $('#schedule-edit-form').addEventListener('submit', submitScheduleEdit);
    $('#schedule-edit-cancel').addEventListener('click', dismissScheduleEditor);
    $('#schedule-edit-is-loan').addEventListener('change', event => {
      $('#schedule-edit-count-field').hidden = !event.target.checked;
    });
    $('#schedule-edit-dialog').addEventListener('cancel', event => {
      event.preventDefault();
      dismissScheduleEditor();
    });
    $('#schedule-edit-dialog').addEventListener('click', event => {
      if (event.target === $('#schedule-edit-dialog')) dismissScheduleEditor();
    });
    $('#schedule-edit-dialog').addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from($('#schedule-edit-form').elements).filter(control =>
        !control.disabled && !control.hidden && control.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first || !last) return;
      if ((event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });

    $('#income-edit').addEventListener('click', openIncomeForm);
    $('#income-cancel').addEventListener('click', closeIncomeForm);
    $('#income-form').addEventListener('submit', submitIncome);
    $('#limit-edit').addEventListener('click', openLimitForm);
    $('#limit-cancel').addEventListener('click', closeLimitForm);
    $('#limit-form').addEventListener('submit', submitLimit);
    $('#category-limit-form').addEventListener('submit', submitCategoryLimit);
    $('#category-limit-cancel').addEventListener('click', () => $('#category-limit-dialog').close());
    $('#category-limit-dialog').addEventListener('close', () => { editingCategoryLimit = null; });
    $('#category-limit-dialog').addEventListener('keydown', (event) => {
      // Keep Tab in the editor rather than letting the last control move to browser chrome.
      if (event.key !== 'Tab') return;
      const controls = Array.from($('#category-limit-form').elements).filter(control => !control.disabled);
      const first = controls[0], last = controls[controls.length - 1];
      if ((event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });

    $('#tx-load-more').addEventListener('click', loadMoreTransactions);
    $('#tx-edit-cancel').addEventListener('click', dismissTransactionEditor);
    $('#tx-edit-form').addEventListener('submit', submitTransactionEdit);
    $('#tx-edit-sheet').addEventListener('cancel', (event) => {
      event.preventDefault();
      dismissTransactionEditor();
    });
    $('#tx-edit-sheet').addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from($('#tx-edit-form').elements).filter(control =>
        !control.disabled && !control.hidden && control.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first || !last) return;
      if ((event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });
    // Clicking the dimmed area behind the panel closes it, the way a sheet is
    // expected to behave. The check keeps a click inside the panel from
    // bubbling out and closing what the user is filling in.
    $('#tx-edit-sheet').addEventListener('click', (event) => {
      if (event.target === $('#tx-edit-sheet')) dismissTransactionEditor();
    });
  }

  function init() {
    features = (window.WalletFeatures || []).map((install) => install(host));
    bindEvents();
    setAuthMode('login');
    renderAmount();

    state.token = localStorage.getItem(TOKEN_KEY);
    if (state.token) startApp();
    else $('#screen-auth').hidden = false;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
