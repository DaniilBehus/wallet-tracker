'use strict';

const { test, expect, eurPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { MonthPage } = require('./pages/month.page');

/**
 * Screen 6.2. State is arranged through the API: a test about the month view
 * should fail when the month view is broken, not when the keypad is.
 */

test.describe('This month', () => {
  test('the total, the bars and the list agree with what was spent', testCase('TC-E2E-012'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries, transport] = await api.categories();

    const first = await api.addExpense({ amount_cents: 2500, category_id: groceries.id });
    const second = await api.addExpense({ amount_cents: 750, category_id: transport.id });

    await month.goToMonth();

    await expect(month.total).toHaveText(eurPattern(3250));
    await expect(month.rows).toHaveCount(2);
    await expect(month.row(first.id)).toBeVisible();
    await expect(month.row(second.id)).toBeVisible();

    await expect(month.bar(groceries.id)).toBeVisible();
    await expect(month.bar(transport.id)).toBeVisible();
    await expect(month.bars).toHaveCount(2);
  });

  test('a category bar is labelled with its share of the month', testCase('TC-E2E-013'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries, transport] = await api.categories();

    await api.addExpense({ amount_cents: 7500, category_id: groceries.id });
    await api.addExpense({ amount_cents: 2500, category_id: transport.id });

    await month.goToMonth();

    // 75 % and 25 % of 100,00 €. The label is the accessible name of the bar,
    // so this checks the number a screen reader would announce.
    await expect(month.bar(groceries.id)).toHaveAttribute('aria-label', /75%/);
    await expect(month.bar(transport.id)).toHaveAttribute('aria-label', /25%/);
  });

  test('deleting an expense removes the row and lowers the total', testCase('TC-E2E-014'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();

    const kept = await api.addExpense({ amount_cents: 1000, category_id: groceries.id });
    const doomed = await api.addExpense({ amount_cents: 2500, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.total).toHaveText(eurPattern(3500));

    await month.deleteButton(doomed.id).click();

    await expect(month.toastSuccess).toHaveText('Expense deleted');
    await expect(month.row(doomed.id)).toHaveCount(0);
    await expect(month.row(kept.id)).toBeVisible();
    await expect(month.total).toHaveText(eurPattern(1000));
  });

  test('a month with nothing in it shows zero, not a broken screen', testCase('TC-E2E-015'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();

    await expect(month.total).toHaveText(eurPattern(0));
    await expect(month.rows).toHaveCount(0);
    await expect(month.bars).toHaveCount(0);
  });

  test('one user never sees another user\'s expenses', testCase('TC-E2E-016'), async ({ signedIn, api, request }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpense({ amount_cents: 1234, category_id: groceries.id });

    // A second, unrelated account created inline — this test owns both.
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    const other = await request.post('/api/auth/register', {
      data: { email: `other-${stamp}@wallet.test`, password: `other-passphrase-${stamp}` },
    });
    const { token } = await other.json();

    await month.page.addInitScript((t) => {
      window.localStorage.setItem('wallet_token', t);
    }, token);
    await month.page.reload();
    await month.goToMonth();

    await expect(month.total).toHaveText(eurPattern(0));
    await expect(month.rows).toHaveCount(0);
  });
});
