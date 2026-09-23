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
    credentialsRequired: 'Enter both an e-mail and a password',

    // add
    saved: (amount) => `Saved · ${amount}`,
    amountRequired: 'Enter an amount',
    categoryRequired: 'Choose a category',
    amountTooBig: 'That amount is too large',
    noCategories: 'No categories',
    notePlaceholder: 'what was it for?',

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
    remaining: (left, total) => `${left} of ${total} left`,
    finished: 'Paid off 🎉',
    subscription: 'Subscription',
    loan: 'Loan',
    scheduleAdded: (name) => `${name} · added`,
    nameRequired: 'Enter a name',
    dayInvalid: 'Day of month must be between 1 and 31',
    dateRequired: 'Enter a start date',
    totalCountInvalid: 'Number of instalments must be at least 1',
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
   * renders, and readable against white at these widths.
   */
  const SLICE_COLOURS = [
    '#3d5afe', '#00b8a9', '#ff8a3d', '#8e5cf7',
    '#e0457b', '#2fb344', '#f2b705', '#4a7fd4',
  ];
  const DONUT_RADIUS = 52;
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

  const MAX_AMOUNT_CENTS = 100000000;   // 1 000 000 €, mirrors spec §4.3
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
    // The month list is paged (D-031). `loaded` is what is on screen, `total`
    // is what the server says exists, and the two together are the only thing
    // that can tell the reader a list is incomplete.
    month: { items: [], total: 0, editing: null },
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

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    let res;
    try {
      res = await fetch('/api' + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (networkError) {
      throw apiError(0, 'OFFLINE');
    }

    if (res.status === 204) return null;

    let data = null;
    try { data = await res.json(); } catch (_) { /* empty or non-JSON body */ }

    if (!res.ok) {
      const code = (data && data.error && data.error.code) || 'UNKNOWN';
      // An expired or revoked token: drop it and show the sign-in screen
      // rather than leaving the user on a screen that cannot load.
      if (res.status === 401 && state.token) {
        signOut(T.signedOut);
        throw apiError(res.status, code);
      }
      throw apiError(res.status, code, data && data.error && data.error.message);
    }
    return data;
  }

  function apiError(status, code, serverMessage) {
    const err = new Error(serverMessage || code);
    err.status = status;
    err.code = code;
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

  function showToast(node, text) {
    $('#toast-success').hidden = true;
    $('#toast-error').hidden = true;
    node.textContent = text;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  const toastOk = (text) => showToast($('#toast-success'), text);
  const toastErr = (text) => showToast($('#toast-error'), text);

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

    const path = state.authMode === 'register' ? '/auth/register' : '/auth/login';
    await withBusy($('#auth-submit'), async () => {
      try {
        const { token } = await api(path, { method: 'POST', body: { email, password } });
        localStorage.setItem(TOKEN_KEY, token);
        state.token = token;
        $('#auth-password').value = '';
        await startApp();
      } catch (err) {
        toastErr(messageFor(err, state.authMode));
      }
    });
  }

  function signOut(message) {
    state.sessionEpoch += 1;
    for (const feature of features) if (feature.onSessionEnd) feature.onSessionEnd();
    localStorage.removeItem(TOKEN_KEY);
    state.token = null;
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
    state.busy = true;
    const label = button ? button.textContent : null;
    if (button) {
      button.disabled = true;
      if (busyLabel) button.textContent = busyLabel;
    }
    try {
      await fn();
    } finally {
      state.busy = false;
      if (button) {
        button.disabled = false;
        if (label !== null) button.textContent = label;
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
  }

  async function saveExpense() {
    const cents = Number(state.amountDigits || '0');
    if (cents <= 0) return toastErr(T.amountRequired);
    if (!state.selectedCategoryId) return toastErr(T.categoryRequired);
    if (state.busy) return;

    await withBusy($('#expense-save-btn'), async () => {
      try {
        const note = $('#expense-note').value.trim();
        await api('/transactions', {
          method: 'POST',
          body: {
            amount_cents: cents,
            category_id: state.selectedCategoryId,
            // Empty means "no note" rather than an empty string, so the row
            // falls back to its category name instead of showing a blank title.
            note: note === '' ? null : note,
          },
        });
        toastOk(T.saved(formatMoney(cents)));
        clearAmount();
      } catch (err) {
        toastErr(messageFor(err));
      }
    });
  }

  // ====================================================== 6.2 · THIS MONTH

  async function loadMonth() {
    const bars = $('#category-bars');
    const list = $('#tx-list');

    let summary, transactions;
    try {
      [summary, transactions] = await Promise.all([
        api('/summary'),
        api(`/transactions?limit=${PAGE_SIZE}&offset=0`),
      ]);
    } catch (err) {
      toastErr(messageFor(err));
      return;
    }

    state.incomeCents = summary.income_cents;
    state.limitCents = summary.limit_cents;
    state.month.items = transactions.items;
    state.month.total = transactions.total;

    renderOverview(summary);
    renderCategoryBars(bars, summary);
    renderTransactions(list, state.month.items);
    renderLoadMore();
  }

  /**
   * The next page, appended.
   *
   * The offset is `state.month.items.length` rather than a page counter: a page
   * counter and a list can disagree after a delete, and then the app asks for
   * an offset that skips a row nobody has seen.
   */
  async function loadMoreTransactions() {
    if (state.busy) return;
    await withBusy($('#tx-load-more'), async () => {
      try {
        const next = await api(
          `/transactions?limit=${PAGE_SIZE}&offset=${state.month.items.length}`
        );
        state.month.items = state.month.items.concat(next.items);
        state.month.total = next.total;
        renderTransactions($('#tx-list'), state.month.items);
        renderLoadMore();
      } catch (err) {
        toastErr(messageFor(err));
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
    button.hidden = shown >= total;
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

    $('[data-testid="month-total"]').textContent = formatMoney(spent);
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
      status.classList.remove('figure--over');
      return;
    }

    status.hidden = false;
    if (summary.limit_status === 'within') status.textContent = T.limitWithin(formatMoney(left));
    else if (summary.limit_status === 'reached') status.textContent = T.limitReached;
    else status.textContent = T.limitOver(formatMoney(Math.abs(left)));
    // Text first; the class is for anyone styling it, never the only signal.
    status.classList.toggle('figure--over', summary.limit_status === 'exceeded');
  }

  function renderCategoryBars(container, summary) {
    container.textContent = '';
    if (summary.total_cents === 0) return;

    summary.by_category.forEach((row, index) => {
      // category_id is nullable: a transaction can be saved without one, and
      // the summary keeps it so the parts still sum to the whole. "none" is a
      // stable suffix, not a generated one, so the testid stays assertable.
      const key = row.category_id === null ? 'none' : row.category_id;
      const name = row.name || T.uncategorised;
      const percent = Math.round((row.total_cents * 100) / summary.total_cents);

      const fill = el('div', { className: 'bar__fill' });
      fill.style.width = `${percent}%`;
      // Same hue as this category's arc in the donut, by the same index. Two
      // views of one set of numbers should not be colour-coded differently.
      fill.style.background = SLICE_COLOURS[index % SLICE_COLOURS.length];

      const bar = el('div', { className: 'bar', role: 'listitem' }, [
        el('div', { className: 'bar__head' }, [
          el('span', { className: 'bar__name', textContent: name }),
          el('span', { className: 'bar__amount', textContent: formatMoney(row.total_cents) }),
        ]),
        el('div', { className: 'bar__track' }, [fill]),
      ]);
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
    const body = el('button', { type: 'button', className: 'tx__body' }, [
      el('div', { className: 'tx__name', textContent: title }),
      subtitle ? el('div', { className: 'tx__note', textContent: subtitle }) : null,
    ]);
    attrs(body, {
      'data-testid': `tx-edit-${tx.id}`,
      'aria-label': T.editExpense(`${title} ${formatMoney(tx.amount_cents)}`),
    });
    body.addEventListener('click', () => openTransactionEditor(tx));

    const row = el('div', { className: 'tx' }, [
      el('span', { className: 'tx__icon', textContent: category ? (category.icon || '•') : '•' }),
      body,
      el('span', { className: 'tx__amount', textContent: formatMoney(tx.amount_cents) }),
      del,
    ]);
    attrs(row, { 'data-testid': `tx-row-${tx.id}` });
    return row;
  }

  // ------------------------------------------------- editing an expense (D-029)

  function openTransactionEditor(tx) {
    state.month.editing = tx.id;

    const select = $('#tx-edit-category');
    select.textContent = '';
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

    $('#tx-edit-sheet').hidden = false;
    $('#tx-edit-amount').focus();
  }

  function closeTransactionEditor() {
    $('#tx-edit-sheet').hidden = true;
    state.month.editing = null;
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
    if (cents === null) return toastErr(T.amountRequired);
    if (cents > MAX_AMOUNT_CENTS) return toastErr(T.amountTooBig);

    const categoryId = Number($('#tx-edit-category').value);
    const spentOn = $('#tx-edit-date').value;
    const note = $('#tx-edit-note').value.trim();

    const patch = {};
    if (cents !== original.amount_cents) patch.amount_cents = cents;
    if (categoryId !== original.category_id) patch.category_id = categoryId;
    if (spentOn && spentOn !== original.spent_on) patch.spent_on = spentOn;
    if (note !== (original.note || '')) patch.note = note === '' ? null : note;

    if (Object.keys(patch).length === 0) return closeTransactionEditor();

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
          toastErr(T.expenseGone);
          closeTransactionEditor();
          await loadMonth();
          return;
        }
        toastErr(messageFor(err));
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
        toastErr(messageFor(err));
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
        toastErr(messageFor(err));
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
        toastErr(messageFor(err));
      }
    });
  }

  // ======================================================== 6.3 · UPCOMING

  async function loadUpcoming() {
    const container = $('#upcoming-list');
    let schedules;
    try {
      schedules = await api('/schedules?active=1');
    } catch (err) {
      toastErr(messageFor(err));
      return;
    }

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

    await withBusy(button, async () => {
      try {
        const result = await api(`/schedules/${schedule.id}/pay`, { method: 'PATCH' });
        toastOk(T.paid(schedule.name));

        if (result.finished) {
          // Show the finished state on this row rather than reloading it away:
          // the list is filtered to active schedules, so a refresh would make
          // the row vanish and the user would never see that it completed.
          const row = button.closest('.row');
          const meta = row.querySelector(`[data-testid="schedule-remaining-${schedule.id}"]`);
          // The counter must be brought up to date here too — this row is the
          // one the refresh below never reaches (BUG-002).
          meta.textContent = remainingText(schedule.total_count, result.remaining_count,
                                           schedule.amount_cents);
          markRowFinished(row, schedule.id);
          return;
        }
        await loadUpcoming();
      } catch (err) {
        toastErr(messageFor(err, 'pay'));
      }
    }, T.paying);
  }

  // ======================================================= 6.4 · SCHEDULES

  async function loadSchedules() {
    const container = $('#schedules-list');
    let schedules;
    try {
      schedules = await api('/schedules');
    } catch (err) {
      toastErr(messageFor(err));
      return;
    }

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
        toastErr(messageFor(err));
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
    state.screen = name;
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
    $('#screen-auth').hidden = true;
    $('#app').hidden = false;
    $('#nav').hidden = false;

    try {
      state.categories = await api('/categories');
    } catch (err) {
      // A 401 has already sent the user back to sign-in; anything else leaves
      // the app usable with an empty category grid rather than a blank screen.
      if (err.status !== 401) toastErr(messageFor(err));
      state.categories = [];
    }

    state.categoryById = new Map(state.categories.map((c) => [c.id, c]));
    renderCategories();
    renderScheduleCategoryOptions();
    clearAmount();
    showScreen('add');
    for (const feature of features) if (feature.onSessionStart) feature.onSessionStart();
  }

  /**
   * Re-reads the category list without touching what the person has typed or
   * selected on Add. Used when a save is refused because a category vanished.
   */
  async function reloadCategories() {
    state.categories = await api('/categories');
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

    $('#income-edit').addEventListener('click', openIncomeForm);
    $('#income-cancel').addEventListener('click', closeIncomeForm);
    $('#income-form').addEventListener('submit', submitIncome);
    $('#limit-edit').addEventListener('click', openLimitForm);
    $('#limit-cancel').addEventListener('click', closeLimitForm);
    $('#limit-form').addEventListener('submit', submitLimit);

    $('#tx-load-more').addEventListener('click', loadMoreTransactions);
    $('#tx-edit-cancel').addEventListener('click', closeTransactionEditor);
    $('#tx-edit-form').addEventListener('submit', submitTransactionEdit);
    // Clicking the dimmed area behind the panel closes it, the way a sheet is
    // expected to behave. The check keeps a click inside the panel from
    // bubbling out and closing what the user is filling in.
    $('#tx-edit-sheet').addEventListener('click', (event) => {
      if (event.target === $('#tx-edit-sheet')) closeTransactionEditor();
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
