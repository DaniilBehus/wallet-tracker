'use strict';

/* WALLET — describe an expense in words, review a draft, save it yourself.
   spec/ai-expense-entry.md; decisions D-033…D-036.

   Loaded before app.js as a classic script. It registers one installer on
   window.WalletFeatures and app.js calls it with a small `host`; nothing else
   of either file is shared (D-036).

   The rules this file is built around:

   1. Nothing is saved until the person presses "Save expense". A suggestion is
      a form filled in for them, not an expense (AI-R01).
   2. A response is applied only if it is the newest request, from the same
      sign-in session, while the panel is still waiting for it. Aborting the
      fetch is not enough on its own: an answer can arrive just before the
      abort does.
   3. A save whose answer was lost is not guessed about. The payload and its
      Idempotency-Key are frozen and "Check / retry this save" resends exactly
      that, so a retry can never create a second expense (AI-R16).

   States:  closed → editing → requesting → review → saving → closed
                         ↑         │            │        └→ uncertain → saving
                         └─────────┘ (error)    └→ editing (Edit description)   */

(function () {
  const MAX_INPUT = 500;          // code points, the same count the server uses
  const MAX_NOTE = 60;            // code points, AI-entry note limit
  // R6: a save that never answers must end somewhere. After this the outcome
  // is "not confirmed" and the same key can be retried; the server may still
  // have committed, which is exactly what the uncertain state says.
  const SAVE_TIMEOUT_MS = 20000;

  const T = {
    count: (n) => `${n} / ${MAX_INPUT}`,
    tooLong: (n) => `${n} / ${MAX_INPUT} — too long, shorten the description`,
    empty: 'Write a short description first.',
    consent: 'Tick the box to send the description to OpenAI, or enter the expense manually.',
    offline: 'The server is not responding. Check your connection.',
    errors: {
      VALIDATION_FAILED: 'Please check the description.',
      PAYLOAD_TOO_LARGE: 'That description is too long.',
      REFERENCE_DATE_MISMATCH: 'The date on this device differs from the server. Check it, or enter the expense manually.',
      AI_CONSENT_REQUIRED: 'Tick the box to send the description to OpenAI, or enter the expense manually.',
      AI_CONTEXT_TOO_LARGE: 'You have too many categories for suggestions. Enter the expense manually.',
      AI_RATE_LIMITED: 'Suggestions are limited for now. Try again later or enter the expense manually.',
      AI_INVALID_RESPONSE: 'The suggestion did not pass the checks, so it was discarded. Try again or enter the expense manually.',
      AI_PROVIDER_FAILED: 'The AI service did not answer. Try again or enter the expense manually.',
      AI_PROVIDER_BUSY: 'The AI service is busy. Try again later or enter the expense manually.',
      AI_TIMEOUT: 'The AI service took too long. Try again or enter the expense manually.',
      AI_UNAVAILABLE: 'Suggestions are not available. Enter the expense manually.',
      UNKNOWN: 'Something went wrong. Please try again.',
    },
    retryIn: (seconds) => ` Wait about ${seconds} s.`,

    ready: 'Check the suggestion, then save it.',
    needsInput: 'Complete the highlighted fields, then save.',
    unsupported: {
      MULTIPLE_EXPENSES: 'Only one expense at a time. Describe one purchase, or enter them manually.',
      UNSUPPORTED_CURRENCY: 'Only expenses in euro can be added.',
      UNSUPPORTED_INTENT: 'That does not look like money you have already spent.',
      MODEL_REFUSED: 'The AI service declined this description. Enter the expense manually.',
      DEMO_UNSUPPORTED: 'This sentence is not one of the demo examples. Try an example button.',
    },
    unsupportedFallback: 'This cannot be added from a description. Enter the expense manually.',

    found: 'Found in your description',
    suggestedCategory: 'Suggested category',
    dateDefault: 'Today — date was not provided',
    currencyDefault: 'EUR — currency was not provided',
    currencyFound: 'EUR — found in your description',
    changed: 'Changed by you',
    noteTruncated: `Shortened to ${MAX_NOTE} characters`,
    need: {
      amount: 'Please enter an amount',
      category: 'Please choose a category',
      date: 'Please enter a date',
    },
    issue: {
      AMOUNT_OUT_OF_RANGE: 'Please enter an amount — the one written is out of range',
      AMBIGUOUS_AMOUNT: 'Please enter an amount — the description has more than one',
      APPROXIMATE_AMOUNT: 'Please enter the exact amount',
      NUMERIC_AMOUNT_REQUIRED: 'Please enter the amount in digits',
      INVALID_AMOUNT: 'Please enter an amount — the one written is not valid',
      AMBIGUOUS_DATE: 'Please enter a date — the one written is unclear',
      UNSUPPORTED_DATE_FORMAT: 'Please enter a date — that date form is not supported',
      INVALID_DATE: 'Please enter a date — the one written does not exist',
      DATE_OUT_OF_RANGE: 'Please enter a date — the one written is out of range',
      AMBIGUOUS_CURRENCY: 'Check the currency — only euro is supported',
    },
    chooseCategory: 'Choose a category',

    invalidAmount: 'Enter an amount, for example 18.00',
    invalidDate: 'Enter a date no later than tomorrow',
    invalidCategory: 'Choose a category',
    noteTooLong: `Keep the note to ${MAX_NOTE} characters`,
    saving: 'Saving…',
    saved: (amount) => `Saved · ${amount}`,
    savedFor: (day, month, amount) => `Saved for ${day} ${month} · ${amount}`,
    uncertain: 'We could not confirm the save. It may already be saved. Check or retry — the same save is sent again, never a second one.',
    replayGone: 'This expense was saved and then deleted. Nothing was added again.',
    saveRefused: 'The server did not accept these values. Check the fields and try again.',
    categoryGone: 'That category no longer exists. Choose another one.',
    abandoned: 'Not confirmed. Check This month before adding it again.',
  };

  const codePoints = (text) => Array.from(String(text).normalize('NFC')).length;

  function newKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function install(host) {
    const $ = (id) => document.getElementById(id);
    const dialog = $('ai-dialog');
    const openButton = $('ai-open');
    const text = $('ai-text');
    const fields = {
      amount: $('ai-amount'), category: $('ai-category'), date: $('ai-date'), note: $('ai-note'),
    };

    const ui = {
      phase: 'closed',          // closed | editing | requesting | review | saving | uncertain
      capabilities: null,
      generation: 0,            // bumped by every request start and every invalidation
      controller: null,
      draft: null,              // the last applied application response
      touched: new Set(),
      pendingSave: null,        // { key, payloadJson } of the last save sent
    };

    // ---------------------------------------------------------------- network

    async function call(path, { method = 'GET', body, headers = {}, signal } = {}) {
      const res = await fetch(`/api${path}`, {
        method,
        signal,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(host.token() ? { Authorization: `Bearer ${host.token()}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = null;
      try { data = await res.json(); } catch (_) { /* empty body */ }
      return { status: res.status, data, headers: res.headers };
    }

    const codeOf = (res) => (res.data && res.data.error && res.data.error.code) || 'UNKNOWN';

    // ----------------------------------------------------------- capabilities

    async function loadCapabilities() {
      const epoch = host.epoch();
      openButton.hidden = true;
      ui.capabilities = null;
      try {
        const res = await call('/ai/capabilities');
        if (epoch !== host.epoch() || res.status !== 200 || !res.data) return;
        ui.capabilities = res.data;
        openButton.hidden = !res.data.enabled;
      } catch (_) {
        // No entry point is the safe answer; manual entry is unaffected.
      }
    }

    const isLive = () => Boolean(ui.capabilities && ui.capabilities.requires_external_consent);

    // ------------------------------------------------------------ describing

    function renderCount() {
      const n = codePoints(text.value);
      const counter = $('ai-count');
      counter.textContent = n > MAX_INPUT ? T.tooLong(n) : T.count(n);
      counter.classList.toggle('ai__count--over', n > MAX_INPUT);
      renderSuggestEnabled();
    }

    function renderSuggestEnabled() {
      const n = codePoints(text.value);
      const hasText = text.value.trim() !== '';
      const consentOk = !isLive() || $('ai-consent').checked;
      $('ai-suggest').disabled = ui.phase === 'requesting' || !hasText || n > MAX_INPUT || !consentOk;
    }

    function showError(id, message) {
      const node = $(id);
      node.textContent = message || '';
      node.hidden = !message;
    }

    function setPhase(phase) {
      ui.phase = phase;
      $('ai-edit').hidden = !['editing', 'requesting'].includes(phase);
      $('ai-review').hidden = !['review', 'saving', 'uncertain'].includes(phase);
      $('ai-progress').hidden = phase !== 'requesting';
      $('ai-suggest').textContent = 'Suggest expense';
      renderSuggestEnabled();
    }

    /** Makes every in-flight request stale. Safe to call at any time. */
    function invalidateRequest() {
      ui.generation += 1;
      if (ui.controller) ui.controller.abort();
      ui.controller = null;
    }

    function open() {
      if (!ui.capabilities || !ui.capabilities.enabled) return;
      resetPanel();
      $('ai-demo-banner').hidden = ui.capabilities.mode !== 'demo';
      $('ai-live-notice').hidden = !isLive();
      $('ai-consent').checked = false;
      setPhase('editing');
      dialog.showModal();
      text.focus();
    }

    function resetPanel() {
      invalidateRequest();
      text.value = '';
      ui.draft = null;
      ui.touched.clear();
      ui.pendingSave = null;
      showError('ai-error', '');
      showError('ai-save-error', '');
      // R8: an abandoned uncertain save left these disabled or hidden, and the
      // next suggestion inherited them.
      setFieldsDisabled(false);
      $('ai-save').hidden = false;
      $('ai-save').disabled = false;
      $('ai-save').textContent = 'Save expense';
      $('ai-retry-save').hidden = true;
      $('ai-retry-save').disabled = false;
      $('ai-abandon').hidden = true;
      $('ai-edit-description').disabled = false;
      renderCount();
    }

    /** Close from any state. Only an uncertain save refuses to vanish silently. */
    function close({ force = false } = {}) {
      if (ui.phase === 'closed') return;
      if (!force && (ui.phase === 'saving' || ui.phase === 'uncertain')) return;
      invalidateRequest();
      ui.phase = 'closed';
      if (dialog.open) dialog.close();
      resetPanel();
    }

    async function suggest(event) {
      if (event) event.preventDefault();
      if (ui.phase !== 'editing') return;
      const description = text.value;
      if (description.trim() === '') return showError('ai-error', T.empty);
      if (codePoints(description) > MAX_INPUT) return showError('ai-error', T.tooLong(codePoints(description)));
      if (isLive() && !$('ai-consent').checked) return showError('ai-error', T.consent);

      invalidateRequest();
      const generation = ui.generation;
      const epoch = host.epoch();
      const controller = new AbortController();
      ui.controller = controller;
      showError('ai-error', '');
      setPhase('requesting');

      const body = { text: description, reference_date: host.todayIso(), locale: 'auto' };
      if (isLive()) body.consent_to_external_processing = true;

      let res;
      try {
        res = await call('/ai/expense-draft', { method: 'POST', body, signal: controller.signal });
      } catch (err) {
        if (generation !== ui.generation || epoch !== host.epoch()) return;
        setPhase('editing');
        return showError('ai-error', T.offline);
      }

      // Rule 2: stale in any way — newer request, other session, closed panel.
      if (generation !== ui.generation || epoch !== host.epoch() || ui.phase !== 'requesting') return;
      ui.controller = null;

      if (res.status === 401) {
        close({ force: true });
        return host.signOut();
      }
      if (res.status !== 200) {
        setPhase('editing');
        let message = T.errors[codeOf(res)] || T.errors.UNKNOWN;
        const retryAfter = Number(res.headers.get('Retry-After'));
        if (res.status === 429 && retryAfter > 0) message += T.retryIn(retryAfter);
        return showError('ai-error', message);
      }
      applyDraft(description, res.data);
    }

    // ---------------------------------------------------------------- review

    function applyDraft(description, draft) {
      ui.draft = draft;
      ui.touched.clear();
      ui.pendingSave = null;
      $('ai-source').textContent = description;
      showError('ai-save-error', '');

      const unsupported = draft.status === 'unsupported';
      $('ai-fields').hidden = unsupported;
      $('ai-save').hidden = unsupported;
      $('ai-retry-save').hidden = true;
      $('ai-abandon').hidden = true;

      if (unsupported) {
        const code = draft.issues.length > 0 ? draft.issues[0].code : null;
        $('ai-status').textContent = T.unsupported[code] || T.unsupportedFallback;
        setPhase('review');
        $('ai-edit-description').focus();
        return;
      }

      fillCategories(draft.draft.category_id);
      fields.amount.value = draft.draft.amount_cents === null ? '' : host.centsToInput(draft.draft.amount_cents);
      fields.date.value = draft.draft.spent_on || '';
      fields.date.max = dayAfter(host.todayIso());
      fields.note.value = draft.draft.note || '';
      $('ai-status').textContent = draft.status === 'ready' ? T.ready : T.needsInput;
      renderHints();
      setPhase('review');
      setFieldsDisabled(false);
      renderSaveEnabled();
      (firstNeedingInput() || $('ai-save')).focus();
    }

    function fillCategories(selectedId) {
      const select = fields.category;
      select.textContent = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = T.chooseCategory;
      select.append(placeholder);
      for (const category of host.categories()) {
        const option = document.createElement('option');
        option.value = String(category.id);
        option.textContent = `${category.icon || '•'} ${category.name}`;
        select.append(option);
      }
      const known = host.categories().some((c) => c.id === selectedId);
      select.value = selectedId !== null && known ? String(selectedId) : '';
    }

    function issuesFor(field) {
      return ui.draft ? ui.draft.issues.filter((i) => i.field === field) : [];
    }

    function hint(field) {
      if (ui.touched.has(field)) return T.changed;
      const p = ui.draft.provenance;
      const blocking = issuesFor(field).find((i) => i.severity === 'needs_input');
      if (field === 'amount') {
        if (blocking) return T.issue[blocking.code] || T.need.amount;
        return p.amount === 'source' ? T.found : T.need.amount;
      }
      if (field === 'category') {
        if (fields.category.value === '') return T.need.category;
        return p.category === 'suggested' ? T.suggestedCategory : '';
      }
      if (field === 'date') {
        if (blocking) return T.issue[blocking.code] || T.need.date;
        if (p.date === 'default') return T.dateDefault;
        return p.date === 'source' ? T.found : T.need.date;
      }
      if (field === 'note') {
        if (issuesFor('note').some((i) => i.code === 'NOTE_TRUNCATED')) return T.noteTruncated;
        return p.note === 'source' ? T.found : '';
      }
      return '';
    }

    function renderHints() {
      for (const field of ['amount', 'category', 'date', 'note']) {
        const node = $(`ai-${field}-hint`);
        node.textContent = hint(field);
        const needs = node.textContent.startsWith('Please');
        node.classList.toggle('field__hint--need', needs);
        fields[field].setAttribute('aria-invalid', String(needs));
      }
      const currency = ui.draft.provenance.currency;
      const blockingCurrency = issuesFor('currency').find((i) => i.severity === 'needs_input');
      $('ai-currency-hint').textContent = blockingCurrency
        ? (T.issue[blockingCurrency.code] || '')
        : currency === 'default' ? T.currencyDefault : currency === 'source' ? T.currencyFound : '';
    }

    function firstNeedingInput() {
      return ['amount', 'category', 'date'].map((f) => fields[f]).find((node) => node.getAttribute('aria-invalid') === 'true');
    }

    /** The values as they would be saved, or the first reason they cannot be. */
    function readPayload() {
      const cents = host.parseAmountToCents(fields.amount.value);
      if (cents === null || cents < 1 || cents > host.maxAmountCents) return { error: T.invalidAmount, field: fields.amount };
      const categoryId = Number(fields.category.value);
      if (!fields.category.value || !host.categories().some((c) => c.id === categoryId)) {
        return { error: T.invalidCategory, field: fields.category };
      }
      const date = fields.date.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dayAfter(host.todayIso())) return { error: T.invalidDate, field: fields.date };
      const note = fields.note.value.trim();
      if (codePoints(note) > MAX_NOTE) return { error: T.noteTooLong, field: fields.note };
      return { payload: { amount_cents: cents, category_id: categoryId, spent_on: date, note: note === '' ? null : note } };
    }

    function renderSaveEnabled() {
      // A draft that still has an unresolved blocking issue on a field the
      // person has not touched is not reviewed yet, even if a value is there.
      const unresolved = ['amount', 'date', 'currency'].some((field) =>
        issuesFor(field).some((i) => i.severity === 'needs_input') && !ui.touched.has(field === 'currency' ? 'amount' : field));
      $('ai-save').disabled = ui.phase !== 'review' || unresolved || Boolean(readPayload().error);
    }

    function onFieldInput(field) {
      if (ui.phase !== 'review') return;
      ui.touched.add(field);
      renderHints();
      showError('ai-save-error', '');
      renderSaveEnabled();
    }

    function setFieldsDisabled(disabled) {
      for (const node of Object.values(fields)) node.disabled = disabled;
    }

    function editDescription() {
      if (!['review'].includes(ui.phase)) return;
      // The old proposal is discarded; nothing from it carries into the next.
      ui.draft = null;
      ui.touched.clear();
      ui.pendingSave = null;
      for (const node of Object.values(fields)) node.value = '';
      setPhase('editing');
      text.focus();
    }

    // ------------------------------------------------------------------ save

    async function save(event) {
      if (event) event.preventDefault();
      if (ui.phase !== 'review') return;
      const { payload, error, field } = readPayload();
      if (error) {
        showError('ai-save-error', error);
        return field.focus();
      }
      const payloadJson = JSON.stringify(payload);
      // Same values as the last attempt: same operation, same key. Different
      // values after a definitive refusal: a new operation, a new key.
      if (!ui.pendingSave || ui.pendingSave.payloadJson !== payloadJson) {
        ui.pendingSave = { key: newKey(), payloadJson, payload };
      }
      await send();
    }

    async function send() {
      const pending = ui.pendingSave;
      const epoch = host.epoch();
      ui.phase = 'saving';
      setFieldsDisabled(true);
      $('ai-save').disabled = true;
      $('ai-save').textContent = T.saving;
      $('ai-retry-save').disabled = true;
      $('ai-edit-description').disabled = true;
      showError('ai-save-error', '');

      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
      let res;
      try {
        res = await call('/transactions', {
          method: 'POST',
          body: pending.payload,
          headers: { 'Idempotency-Key': pending.key },
          signal: controller.signal,
        });
      } catch (_) {
        // Dropped, refused or past the deadline: in every case the server may
        // or may not have the expense.
        res = null;
      } finally {
        clearTimeout(deadline);
        $('ai-save').textContent = 'Save expense';
        $('ai-retry-save').disabled = false;
        $('ai-edit-description').disabled = false;
      }
      if (epoch !== host.epoch()) return;

      if (res === null || res.status >= 500) return enterUncertain();

      if (res.status === 201) {
        const saved = res.data;
        // R7: a 201 whose body is not the expense we sent is not a
        // confirmation. Closing here threw away the frozen key.
        const confirmed = saved !== null && typeof saved === 'object'
          && Number.isInteger(saved.id)
          && saved.amount_cents === pending.payload.amount_cents
          && saved.spent_on === pending.payload.spent_on;
        if (!confirmed) return enterUncertain();
        close({ force: true });
        const amount = host.formatMoney(saved.amount_cents);
        const today = host.todayIso();
        if (saved.spent_on.slice(0, 7) !== today.slice(0, 7)) {
          const [, month, day] = saved.spent_on.split('-').map(Number);
          host.toastOk(T.savedFor(day, host.monthName(month), amount));
        } else {
          host.toastOk(T.saved(amount));
        }
        host.refreshMonth();
        return;
      }
      if (res.status === 401) {
        close({ force: true });
        return host.signOut();
      }

      // A definitive refusal: the operation did not happen. Back to review,
      // editable, with the reason.
      $('ai-retry-save').hidden = true;
      $('ai-abandon').hidden = true;
      $('ai-save').hidden = false;
      ui.phase = 'review';
      setFieldsDisabled(false);
      const code = codeOf(res);
      if (code === 'IDEMPOTENCY_REPLAY_UNAVAILABLE') {
        ui.pendingSave = null;
        showError('ai-save-error', T.replayGone);
      } else if (res.status === 404 || /category/i.test((res.data && res.data.error && res.data.error.message) || '')) {
        try { await host.reloadCategories(); } catch (_) { /* keep the old list */ }
        if (epoch !== host.epoch()) return;
        fillCategories(null);
        ui.touched.add('category');
        renderHints();
        showError('ai-save-error', T.categoryGone);
      } else {
        showError('ai-save-error', T.saveRefused);
      }
      renderSaveEnabled();
    }

    function enterUncertain() {
      ui.phase = 'uncertain';
      setFieldsDisabled(true);
      $('ai-save').hidden = true;
      $('ai-retry-save').hidden = false;
      $('ai-abandon').hidden = false;
      $('ai-edit-description').disabled = true;
      showError('ai-save-error', T.uncertain);
      $('ai-retry-save').focus();
    }

    async function retrySave() {
      if (ui.phase !== 'uncertain' || !ui.pendingSave) return;
      await send();
    }

    function abandon() {
      if (ui.phase !== 'uncertain') return;
      close({ force: true });
      host.toastErr(T.abandoned);
    }

    // ----------------------------------------------------------------- dates

    function dayAfter(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const pad = (n, w = 2) => String(n).padStart(w, '0');
      if (d < lengths[m - 1]) return `${pad(y, 4)}-${pad(m)}-${pad(d + 1)}`;
      if (m < 12) return `${pad(y, 4)}-${pad(m + 1)}-01`;
      return `${pad(y + 1, 4)}-01-01`;
    }

    // ---------------------------------------------------------------- events

    openButton.addEventListener('click', open);
    $('ai-close').addEventListener('click', () => close());
    $('ai-cancel').addEventListener('click', () => close());
    $('ai-edit').addEventListener('submit', suggest);
    $('ai-review').addEventListener('submit', save);
    $('ai-edit-description').addEventListener('click', editDescription);
    $('ai-retry-save').addEventListener('click', retrySave);
    $('ai-abandon').addEventListener('click', abandon);
    $('ai-consent').addEventListener('change', renderSuggestEnabled);

    text.addEventListener('input', () => {
      // Changing the words while a suggestion is on its way makes that
      // suggestion about different words: it is dropped, not applied.
      if (ui.phase === 'requesting') {
        invalidateRequest();
        setPhase('editing');
      }
      showError('ai-error', '');
      renderCount();
    });

    for (const button of document.querySelectorAll('#ai-edit [data-example]')) {
      button.addEventListener('click', () => {
        if (ui.phase === 'requesting') invalidateRequest();
        text.value = button.dataset.example;
        setPhase('editing');
        showError('ai-error', '');
        renderCount();
        text.focus();
      });
    }

    for (const [field, node] of Object.entries(fields)) {
      node.addEventListener('input', () => onFieldInput(field));
      node.addEventListener('change', () => onFieldInput(field));
    }

    // Escape and the browser's own close: the same rules as Cancel.
    dialog.addEventListener('cancel', (event) => {
      if (ui.phase === 'saving' || ui.phase === 'uncertain') {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      close();
    });

    return {
      onSessionStart: loadCapabilities,
      onSessionEnd: () => {
        close({ force: true });
        openButton.hidden = true;
        ui.capabilities = null;
      },
      onScreen: (name) => {
        if (name !== 'add') close();
      },
    };
  }

  window.WalletFeatures = window.WalletFeatures || [];
  window.WalletFeatures.push(install);
})();
