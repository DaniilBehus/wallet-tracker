'use strict';

const { test, expect, eurPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { AddPage } = require('./pages/add.page');
const { MonthPage } = require('./pages/month.page');

/** Screen 6.1, and the definition of done for the whole frontend (spec §8). */

test.describe('Adding an expense', () => {
  test('two taps and a save, and it appears in This month', testCase('TC-E2E-006'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);
    const month = new MonthPage(signedIn);

    await expect(add.amount).toHaveText(eurPattern(0));

    await add.enterAmount('1250');
    await expect(add.amount).toHaveText(eurPattern(1250));

    // Tap one: the category. Tap two: save.
    await add.tile('Groceries').click();
    await expect(add.tile('Groceries')).toHaveAttribute('aria-pressed', 'true');
    await add.save.click();

    await expect(add.toastSuccess).toBeVisible();
    await expect(add.amount).toHaveText(eurPattern(0));
    await expect(add.tile('Groceries')).toHaveAttribute('aria-pressed', 'false');

    await add.goToMonth();
    await expect(month.total).toHaveText(eurPattern(1250));
    await expect(month.rows).toHaveCount(1);
  });

  test('the keypad builds the amount digit by digit and the clear key resets it', testCase('TC-E2E-007'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);

    await add.key('9').click();
    await expect(add.amount).toHaveText(eurPattern(9));

    await add.key('9').click();
    await expect(add.amount).toHaveText(eurPattern(99));

    await add.key('9').click();
    await expect(add.amount).toHaveText(eurPattern(999));

    await add.clear.click();
    await expect(add.amount).toHaveText(eurPattern(0));
  });

  test('saving without an amount is refused', testCase('TC-E2E-008'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);

    await add.tile('Transport').click();
    await add.save.click();

    await expect(add.toastError).toHaveText('Enter an amount');
  });

  test('saving without a category is refused', testCase('TC-E2E-009'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);

    await add.enterAmount('500');
    await add.save.click();

    await expect(add.toastError).toHaveText('Choose a category');
  });

  test('two expenses in different categories both count towards the month', testCase('TC-E2E-010'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);
    const month = new MonthPage(signedIn);

    await add.addExpense('1250', 'Groceries');
    await expect(add.toastSuccess).toBeVisible();

    await add.addExpense('420', 'Transport');
    await expect(add.toastSuccess).toBeVisible();

    await add.goToMonth();
    await expect(month.total).toHaveText(eurPattern(1670));
    await expect(month.rows).toHaveCount(2);
    await expect(month.bars).toHaveCount(2);
  });

  test('a note becomes the title of the row in This month', testCase('TC-E2E-039'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);
    const month = new MonthPage(signedIn);

    await add.addExpense('4000', 'Other', 'new tyre');
    await expect(add.toastSuccess).toBeVisible();

    await add.goToMonth();

    // The point of D-020: "Other · €40.00" says nothing three weeks later.
    await expect(month.rows.first()).toContainText('new tyre');
    await expect(month.rows.first()).toContainText('Other');
  });

  test('the note is cleared after saving, so it cannot attach to the next expense', testCase('TC-E2E-040'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);

    await add.addExpense('500', 'Groceries', 'coffee');
    await expect(add.toastSuccess).toBeVisible();

    await expect(add.note).toHaveValue('');
  });

  test('an expense without a note still shows its category', testCase('TC-E2E-041'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);
    const month = new MonthPage(signedIn);

    await add.addExpense('750', 'Transport');
    await expect(add.toastSuccess).toBeVisible();

    await add.goToMonth();
    await expect(month.rows.first()).toContainText('Transport');
  });

  test('every category tile has a name a person can read', testCase('TC-E2E-011'), async ({ signedIn, api }) => {
    const add = new AddPage(signedIn);
    const categories = await api.categories();

    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      // Found by role and accessible name — a tile carrying only an emoji
      // would fail this, which is the point (D-012).
      await expect(add.tile(category.name)).toBeVisible();
      await expect(add.tileById(category.id)).toBeVisible();
    }
  });
});
