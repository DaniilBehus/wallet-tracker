'use strict';

const base = require('@playwright/test');

/**
 * Fixtures shared by every spec.
 *
 * The rule they exist to enforce: **no spec depends on another spec, or on the
 * order they run in.** Each one registers its own user through the API, gets a
 * token, and starts from a session that belongs to nobody else. That is what
 * makes `fullyParallel: true` safe and what stops a failure in one file from
 * cascading into six.
 *
 * Setting up state through the API rather than by clicking through the UI is
 * deliberate too: a test about paying a loan should fail when paying a loan is
 * broken, not when the registration form is.
 */

/** A euro amount as the interface renders it (D-019): 1250 -> "€12.50". */
function eur(cents) {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${cents < 0 ? '-' : ''}€${grouped}.${frac}`;
}

/**
 * The same amount as an escaped regular-expression source.
 *
 * Whitespace is matched loosely even though this format contains none: the row
 * an amount sits in is built by joining parts, and pinning exact invisible
 * characters is how a money assertion ends up testing typography rather than
 * the number.
 */
function eurSource(cents) {
  return eur(cents)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s/g, '\\s');
}

/**
 * Anchored — for a locator that wraps the amount and nothing else.
 * Use with toHaveText.
 */
function eurPattern(cents) {
  return new RegExp(`^${eurSource(cents)}$`);
}

/**
 * Unanchored — for a locator that contains the amount among other text.
 * Use with toContainText.
 *
 * The two exist separately because mixing them up produces a test that fails
 * against correct application output, which costs more time to diagnose than a
 * real defect does (R4).
 */
function eurWithin(cents) {
  return new RegExp(eurSource(cents));
}

/**
 * The countdown line on a loan row: "7 of 10 left · €700.00".
 * One helper because three specs assert it, and a loan that reports the wrong
 * number of instalments left is the defect this project cares most about.
 */
function remainingPattern(left, total, amountCents) {
  return new RegExp(
    `^${left} of ${total} left\\s·\\s${eurSource(left * amountCents)}$`
  );
}

const test = base.test.extend({
  /** A brand-new account, unique to this test. */
  user: async ({ request }, use) => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    const email = `e2e-${stamp}@wallet.test`;
    const password = `e2e-passphrase-${stamp}`;

    const response = await request.post('/api/auth/register', {
      data: { email, password },
    });
    base.expect(response.status(), 'could not create a user for this test').toBe(201);
    const { token } = await response.json();

    await use({ email, password, token });
  },

  /** Authenticated API access for arranging state before the browser opens. */
  api: async ({ request, user }, use) => {
    const headers = { Authorization: `Bearer ${user.token}` };

    const json = async (response, expected) => {
      base.expect(response.status(), await response.text()).toBe(expected);
      return response.status() === 204 ? null : response.json();
    };

    await use({
      categories: async () => json(await request.get('/api/categories', { headers }), 200),
      addExpense: async (data) =>
        json(await request.post('/api/transactions', { headers, data }), 201),
      editExpense: async (id, data, expected = 200) =>
        json(await request.patch(`/api/transactions/${id}`, { headers, data }), expected),
      deleteExpense: async (id) =>
        json(await request.delete(`/api/transactions/${id}`, { headers }), 204),
      /**
       * Many expenses at once, for the paging boundaries (D-031).
       *
       * Sent in batches rather than all at once: 201 simultaneous writes is a
       * load test, and a paging test that fails because the server was
       * saturated has told nobody anything about paging.
       */
      addExpenses: async (count, data) => {
        const made = [];
        for (let start = 0; start < count; start += 20) {
          const batch = [];
          for (let i = start; i < Math.min(start + 20, count); i++) {
            batch.push(json(await request.post('/api/transactions', {
              headers,
              data: { ...data, note: `bulk ${i + 1}` },
            }), 201));
          }
          made.push(...await Promise.all(batch));
        }
        return made;
      },
      addSchedule: async (data) =>
        json(await request.post('/api/schedules', { headers, data }), 201),
      editSchedule: async (id, data, expected = 200) =>
        json(await request.patch(`/api/schedules/${id}`, { headers, data }), expected),
      schedules: async () => json(await request.get('/api/schedules', { headers }), 200),
      paySchedule: async (id) =>
        json(await request.patch(`/api/schedules/${id}/pay`, { headers }), 200),
      summary: async () => json(await request.get('/api/summary', { headers }), 200),
    });
  },

  /**
   * The app, already signed in as `user`.
   *
   * The token is written by an init script so it is in place before the first
   * line of app.js runs — injecting it after navigation would race the boot.
   */
  signedIn: async ({ page, user }, use) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem('wallet_token', token);
    }, user.token);
    await page.goto('/');
    await use(page);
  },
});

module.exports = { test, expect: base.expect, eur, eurPattern, eurWithin, remainingPattern };
