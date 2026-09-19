'use strict';

// State-machine tests of public/ai-expense.js outside a browser.
//
// The real file runs in a vm context with a minimal fake DOM, a fetch the test
// answers (or never answers), and timers the test fires by hand. That makes
// three things observable that the Playwright suite cannot reach:
//
//   * a save whose response never arrives (not dropped — just silent);
//   * a 201 whose body is not an expense;
//   * a stale response that is delivered even though its request was aborted,
//     i.e. the request-generation check on its own (control M1 in S23 stayed
//     green in the browser because abort() hid it).
//
// Findings R6–R9 of the independent review of 2026-09-15. This is a component
// test of the state machine; layout and focus stay in qa/e2e/ai.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'public', 'ai-expense.js'), 'utf8');

const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };

class FakeNode {
  constructor(id) {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.checked = false;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.classList = { toggle() {} };
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  async fire(type) {
    for (const fn of this.listeners[type] || []) await fn({ preventDefault() {}, target: this });
  }
  append(child) { this.children.push(child); }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
}

const readyDraft = (cents) => ({
  request_id: crypto.randomUUID(),
  mode: 'demo',
  status: 'ready',
  draft: { amount_cents: cents, category_id: 1, spent_on: '2026-09-15', note: 'Lunch' },
  provenance: { amount: 'source', category: 'suggested', date: 'source', currency: 'source', note: 'source' },
  issues: [],
  versions: { schema: '1', prompt: '1', normalizer: '2' },
});

/**
 * @param source         the module text (a test may pass a mutated copy)
 * @param honourAbort    false = a response already on its way arrives anyway
 */
function harness({ source = SOURCE, honourAbort = true } = {}) {
  const nodes = new Map();
  const node = (id) => { if (!nodes.has(id)) nodes.set(id, new FakeNode(id)); return nodes.get(id); };
  const requests = [];
  const timers = [];
  const toasts = [];

  const fetch = (url, init = {}) => {
    if (url.endsWith('/ai/capabilities')) {
      return Promise.resolve({ status: 200, headers: new Headers(), json: async () => ({ enabled: true, mode: 'demo', requires_external_consent: false }) });
    }
    return new Promise((resolve, reject) => {
      const req = { url, init, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined };
      req.answer = (status, data) => resolve({ status, headers: new Headers(), json: async () => { if (data === undefined) throw new Error('no body'); return data; } });
      req.drop = () => reject(new TypeError('network'));
      if (honourAbort && init.signal) {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }
      requests.push(req);
    });
  };

  const context = {
    window: { crypto },
    document: { getElementById: node, querySelectorAll: () => [], createElement: () => new FakeNode() },
    fetch,
    Headers,
    AbortController,
    Uint8Array,
    console,
    setTimeout: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
  };
  vm.runInNewContext(source, context, { filename: 'public/ai-expense.js' });

  let epoch = 1;
  let categories = [{ id: 1, name: 'Restaurants', icon: '•' }];
  let serverCategories = categories;
  const calls = { signOut: 0, reloadCategories: 0 };
  const host = {
    epoch: () => epoch,
    token: () => `synthetic-token-${epoch}`,
    categories: () => categories,
    reloadCategories: async () => { calls.reloadCategories += 1; categories = serverCategories; return categories; },
    signOut: () => { calls.signOut += 1; epoch += 1; },
    formatMoney: (cents) => `€${cents}`,
    centsToInput: (cents) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`,
    parseAmountToCents: (raw) => {
      const m = String(raw).trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/);
      return m ? Number(m[1] + (m[2] || '').padEnd(2, '0')) : null;
    },
    todayIso: () => '2026-09-15',
    maxAmountCents: 100000000,
    monthName: (m) => `month-${m}`,
    toastOk: (t) => toasts.push(['ok', t]),
    toastErr: (t) => toasts.push(['err', t]),
    refreshMonth: () => {},
  };
  const feature = context.window.WalletFeatures[0](host);

  const drafts = () => requests.filter((r) => r.url.endsWith('/ai/expense-draft'));
  const saves = () => requests.filter((r) => r.url.endsWith('/transactions'));
  const activeTimers = () => timers.filter((t) => !t.cleared);

  async function openWith(text) {
    await feature.onSessionStart();
    await node('ai-open').fire('click');
    node('ai-text').value = text;
    await node('ai-text').fire('input');
  }

  /** Open, suggest, answer with a ready draft: the panel is in review. */
  async function review(cents = 1000) {
    await openWith('Lunch 10 EUR');
    const pending = node('ai-edit').fire('submit');
    await flush();
    drafts().at(-1).answer(200, readyDraft(cents));
    await pending;
    assert.equal(node('ai-review').hidden, false, 'harness: review is shown');
  }

  /** What app.js does on sign-out and the next sign-in, without the host.signOut counter. */
  async function switchAccount() {
    epoch += 1;
    feature.onSessionEnd();
    epoch += 1;
    await feature.onSessionStart();
  }
  const setServerCategories = (list) => { serverCategories = list; };

  return { node, requests, drafts, saves, timers, activeTimers, toasts, feature, host, calls, openWith, review, switchAccount, setServerCategories };
}

// ------------------------------------------------------------------- R6

test('R6 · a save that never answers ends in "not confirmed", not in Saving forever', async () => {
  const h = harness();
  await h.review(1800);
  const saving = h.node('ai-review').fire('submit');
  await flush();
  assert.equal(h.saves().length, 1);
  assert.equal(h.node('ai-save').textContent, 'Saving…');

  const armed = h.activeTimers();
  assert.equal(armed.length, 1, 'a save deadline is armed');
  assert.ok(armed[0].ms >= 5000 && armed[0].ms <= 60000, `deadline ${armed[0].ms} ms is sane`);

  armed[0].fn();                      // the deadline passes
  await saving;
  await flush();

  assert.equal(h.node('ai-retry-save').hidden, false, 'retry offered');
  assert.equal(h.node('ai-abandon').hidden, false, 'abandon offered');
  assert.match(h.node('ai-save-error').textContent, /could not confirm/);
  assert.notEqual(h.node('ai-save').textContent, 'Saving…');
  assert.equal(h.node('ai-dialog').open, true, 'the uncertainty stays on screen');
});

test('R6 · a save that answers in time clears its deadline', async () => {
  const h = harness();
  await h.review(1800);
  const saving = h.node('ai-review').fire('submit');
  await flush();
  const body = h.saves()[0].body;
  h.saves()[0].answer(201, { id: 7, schedule_id: null, created_at: '2026-09-15 10:00:00', ...body });
  await saving;
  assert.equal(h.activeTimers().length, 0);
  assert.equal(h.node('ai-dialog').open, false);
});

// ------------------------------------------------------------------- R7

test('R7 · a 201 without an expense body keeps the frozen key and asks to check', async () => {
  for (const bad of [undefined, null, {}, { id: 7 }, { id: 7, amount_cents: '1800', spent_on: '2026-09-15' }]) {
    const h = harness();
    await h.review(1800);
    const saving = h.node('ai-review').fire('submit');
    await flush();
    const key = h.saves()[0].headers['Idempotency-Key'];
    h.saves()[0].answer(201, bad);
    await assert.doesNotReject(saving, `body ${JSON.stringify(bad)}`);
    await flush();

    assert.equal(h.node('ai-dialog').open, true, `body ${JSON.stringify(bad)}: dialog stays`);
    assert.equal(h.node('ai-retry-save').hidden, false, `body ${JSON.stringify(bad)}: retry offered`);
    assert.equal(h.toasts.filter(([k]) => k === 'ok').length, 0, 'no "Saved" toast for an unverified save');

    const retry = h.node('ai-retry-save').fire('click');
    await flush();
    assert.equal(h.saves().length, 2);
    assert.equal(h.saves()[1].headers['Idempotency-Key'], key, 'the retry reuses the frozen key');
    h.saves()[1].answer(201, { id: 7, category_id: 1, note: 'Lunch', schedule_id: null, created_at: 'x', amount_cents: 1800, spent_on: '2026-09-15' });
    await retry;
    assert.equal(h.node('ai-dialog').open, false);
  }
});

// ------------------------------------------------------------------- R8

test('R8 · after abandoning an uncertain save, the next suggestion has working controls', async () => {
  const h = harness();
  await h.review(1800);
  const saving = h.node('ai-review').fire('submit');
  await flush();
  h.saves()[0].drop();
  await saving;
  assert.equal(h.node('ai-edit-description').disabled, true, 'harness: uncertain state reached');

  await h.node('ai-abandon').fire('click');
  assert.equal(h.node('ai-dialog').open, false);

  await h.review(2500);
  assert.equal(h.node('ai-edit-description').disabled, false, 'Edit description works again');
  assert.equal(h.node('ai-save').hidden, false);
  assert.equal(h.node('ai-save').textContent, 'Save expense');
  assert.equal(h.node('ai-retry-save').hidden, true);
  assert.equal(h.node('ai-abandon').hidden, true);
  assert.equal(h.node('ai-amount').disabled, false);
  assert.equal(h.node('ai-save-error').hidden, true);
});

// ------------------------------------------------------------------- R9

async function staleScenario(source) {
  // The first response is delivered even though its request was aborted.
  const h = harness({ source, honourAbort: false });
  await h.openWith('Lunch 10 EUR');
  const first = h.node('ai-edit').fire('submit');
  await flush();
  const old = h.drafts().at(-1);

  h.node('ai-text').value = 'Lunch 20 EUR';
  await h.node('ai-text').fire('input');
  const second = h.node('ai-edit').fire('submit');
  await flush();
  const current = h.drafts().at(-1);

  old.answer(200, readyDraft(1000));
  await first;
  const staleShown = h.node('ai-review').hidden === false;

  current.answer(200, readyDraft(2000));
  await second;
  return { h, staleShown, abortSignalled: old.init.signal.aborted };
}

test('R9 · a stale response that arrives despite abort is not applied', async () => {
  const { h, staleShown, abortSignalled } = await staleScenario(SOURCE);
  assert.equal(abortSignalled, true, 'the old request was aborted');
  assert.equal(staleShown, false, 'the old answer did not open the review');
  assert.equal(h.node('ai-amount').value, '20.00', 'only the newer answer is shown');
});

test('R9 · control: without the generation check the same scenario shows the stale draft', async () => {
  const mutated = SOURCE.replace("if (generation !== ui.generation || epoch !== host.epoch() || ui.phase !== 'requesting') return;", 'if (epoch !== host.epoch()) return;');
  assert.notEqual(mutated, SOURCE, 'the mutation applied');
  const { staleShown } = await staleScenario(mutated);
  assert.equal(staleShown, true, 'this test can see the generation check on its own');
});

// ----------------------------------------------------------------- U1 U2
// Gaps recorded in the S23 report §2 as untested in the browser: the UI has no
// sign-out control and the API cannot delete a category. The state machine can
// still meet both, so they are tested here.

async function oldSessionScenario(source, { status, body }) {
  const h = harness({ source, honourAbort: false });
  await h.openWith('Lunch 10 EUR');
  const pending = h.node('ai-edit').fire('submit');
  await flush();
  const old = h.drafts().at(-1);

  await h.switchAccount();                       // another person signs in
  await h.node('ai-open').fire('click');
  h.node('ai-text').value = 'Coffee 3 EUR';
  await h.node('ai-text').fire('input');

  old.answer(status, body);                      // the first person's answer lands now
  await pending;
  await flush();
  return h;
}

test("U1 · an old session's 401 does not sign out the person now signed in", async () => {
  const h = await oldSessionScenario(SOURCE, { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'x' } } });
  assert.equal(h.calls.signOut, 0);
  assert.equal(h.node('ai-dialog').open, true, "the new person’s panel stays open");
  assert.equal(h.node('ai-text').value, 'Coffee 3 EUR');
});

test("U1 · an old session's draft is not shown to the person now signed in", async () => {
  const h = await oldSessionScenario(SOURCE, { status: 200, body: readyDraft(1000) });
  assert.equal(h.node('ai-review').hidden, true);
  assert.equal(h.node('ai-amount').value, '');
});

test("U1 · control: without the session and generation checks, the old 401 signs the new person out", async () => {
  const mutated = SOURCE.replace("if (generation !== ui.generation || epoch !== host.epoch() || ui.phase !== 'requesting') return;", '');
  assert.notEqual(mutated, SOURCE);
  const h = await oldSessionScenario(mutated, { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'x' } } });
  assert.equal(h.calls.signOut, 1, 'this test can see the check');
});

test("U1 · an old session's save answer does not sign out the new person", async () => {
  const h = harness({ honourAbort: false });
  await h.review(1800);
  const saving = h.node('ai-review').fire('submit');
  await flush();
  await h.switchAccount();
  h.saves()[0].answer(401, { error: { code: 'UNAUTHORIZED', message: 'x' } });
  await saving;
  assert.equal(h.calls.signOut, 0);
});

test('U2 · a category deleted before Save: refused, list reloaded, a new choice is a new operation', async () => {
  const h = harness();
  await h.review(1800);
  h.setServerCategories([{ id: 2, name: 'Eating out', icon: '•' }]);

  const first = h.node('ai-review').fire('submit');
  await flush();
  const firstKey = h.saves()[0].headers['Idempotency-Key'];
  h.saves()[0].answer(404, { error: { code: 'NOT_FOUND', message: 'No category with id 1' } });
  await first;

  assert.equal(h.calls.reloadCategories, 1, 'categories were reloaded');
  assert.equal(h.node('ai-dialog').open, true);
  assert.equal(h.node('ai-save-error').textContent, 'That category no longer exists. Choose another one.');
  assert.equal(h.node('ai-category').value, '', 'no stale category stays selected');
  assert.equal(h.node('ai-save').disabled, true, 'Save waits for a new choice');
  assert.equal(h.node('ai-amount').value, '18.00', 'the reviewed amount is kept');

  h.node('ai-category').value = '2';
  await h.node('ai-category').fire('change');
  assert.equal(h.node('ai-save').disabled, false);
  const second = h.node('ai-review').fire('submit');
  await flush();
  assert.equal(h.saves().length, 2);
  assert.notEqual(h.saves()[1].headers['Idempotency-Key'], firstKey, 'a different payload gets a different key');
  assert.equal(h.saves()[1].body.category_id, 2);
  h.saves()[1].answer(201, { id: 9, category_id: 2, note: 'Lunch', schedule_id: null, created_at: 'x', amount_cents: 1800, spent_on: '2026-09-15' });
  await second;
  assert.equal(h.node('ai-dialog').open, false);
});
