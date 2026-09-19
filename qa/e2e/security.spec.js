'use strict';

const { test, expect } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { MonthPage } = require('./pages/month.page');
const { SchedulesPage } = require('./pages/schedules.page');
const { UpcomingPage } = require('./pages/upcoming.page');

/**
 * Free text rendered as text, not as markup.
 *
 * Two fields take whatever a person types and put it back on the screen: an
 * expense's note and a schedule's name. Both are stored verbatim by design —
 * the server does not strip or escape them, and it should not, because escaping
 * at the wrong layer is how `&amp;` ends up in somebody's shopping list.
 *
 * That makes the browser the only place the guarantee can hold, and this file
 * is where the guarantee is checked rather than assumed.
 *
 * **The mechanism, since the test is worthless without knowing what it protects:
 * app.js builds every row with `textContent` and `document.createElement`, and
 * contains no `innerHTML` anywhere.** `textContent` cannot produce an element;
 * a `<script>` in it is five characters and an s. If a row is ever rewritten
 * with a template string and `innerHTML`, these tests are what notices.
 *
 * This is a single-user app with no sharing, so the attacker and the victim are
 * the same person, and that lowers the severity to almost nothing. It does not
 * lower the value of the check: the cost of getting it wrong is arbitrary script
 * execution with a valid token in localStorage, and the cost of checking is
 * this file.
 */

const PAYLOADS = [
  { id: 'TC-E2E-058', label: 'a script tag', value: '<script>window.__xss = 1;</script>' },
  { id: 'TC-E2E-059', label: 'an image with an error handler', value: '<img src=x onerror="window.__xss=1">' },
  { id: 'TC-E2E-060', label: 'a closing tag then a script', value: '"></div><script>window.__xss=1;</script>' },
];

test.describe('Free text is rendered as text', () => {
  for (const { id, label, value } of PAYLOADS) {
    test(`an expense note containing ${label} is shown, not run`, testCase(id), async ({ signedIn, api }) => {
      const month = new MonthPage(signedIn);
      const [groceries] = await api.categories();
      const tx = await api.addExpense({
        amount_cents: 1200,
        category_id: groceries.id,
        note: value,
      });

      await month.goToMonth();

      // The row shows the payload as characters. If it had been parsed as
      // markup, the text would be gone and only its side effect would remain.
      await expect(month.row(tx.id)).toContainText(value);

      const fired = await signedIn.evaluate(() => window.__xss === 1);
      expect(fired, 'the payload executed').toBe(false);

      // No element was created from it either — a payload that is inert today
      // because the handler did not fire is still a payload that was parsed.
      const injected = await signedIn.evaluate(
        () => document.querySelectorAll('script[data-injected], img[onerror]').length
      );
      expect(injected, 'the payload became elements in the DOM').toBe(0);
    });
  }

  test('a schedule name containing a script tag is shown, not run', testCase('TC-E2E-061'), async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const upcoming = new UpcomingPage(signedIn);
    const [groceries] = await api.categories();

    const payload = '<script>window.__xss = 1;</script>';
    const schedule = await api.addSchedule({
      name: payload,
      amount_cents: 2000,
      category_id: groceries.id,
      day_of_month: 10,
      starts_on: '2026-01-10',
    });

    await schedules.goToSchedules();
    await expect(schedules.row(schedule.id)).toContainText(payload);

    await upcoming.goToUpcoming();
    await expect(upcoming.row(schedule.id)).toContainText(payload);

    const fired = await signedIn.evaluate(() => window.__xss === 1);
    expect(fired, 'the payload executed').toBe(false);
  });

  test('a payload survives a round trip through the editor unchanged', testCase('TC-E2E-062'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const payload = '<b>not bold</b>';
    const tx = await api.addExpense({ amount_cents: 1200, category_id: groceries.id, note: 'plain' });

    await month.goToMonth();
    await month.editExpense(tx.id, { note: payload });

    // Stored verbatim and rendered verbatim. A screen that escaped on the way
    // in would show `&lt;b&gt;` here, and one that escaped on the way out would
    // double-escape it on the next edit — both are why this is checked after a
    // round trip rather than only on first render.
    await expect(month.row(tx.id)).toContainText(payload);

    await month.editButton(tx.id).click();
    await expect(month.editNote).toHaveValue(payload);
  });
});
