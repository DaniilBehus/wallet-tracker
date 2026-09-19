'use strict';

const { test, expect, eurPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { MonthPage } = require('./pages/month.page');

/**
 * Monthly income, what remains, and the donut (D-021, D-022).
 *
 * The arithmetic is asserted rather than the picture: a donut is hard to assert
 * on and easy to get subtly wrong, so what these check is that the numbers
 * beside it are right and that there is one arc per category. The shape of the
 * arcs is a rendering detail; the money is not.
 */

test.describe('Income and the month balance', () => {
  test('a fresh account asks for an income instead of showing a wrong one', testCase('TC-E2E-031'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();

    await expect(month.income).toHaveText('Set income');
    // Not "€0.00 left" — that would be a number the app invented.
    await expect(month.remaining).toHaveText('—');
  });

  test('setting an income shows what is left of it', testCase('TC-E2E-032'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpense({ amount_cents: 12550, category_id: groceries.id });

    await month.goToMonth();
    await month.setIncome('1500.00');

    await expect(month.toastSuccess).toHaveText('Income saved');
    await expect(month.income).toHaveText(eurPattern(150000));
    await expect(month.total).toHaveText(eurPattern(12550));
    await expect(month.remaining).toHaveText(eurPattern(137450));
  });

  test('the income survives a reload — it is stored, not remembered', testCase('TC-E2E-033'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();
    await month.setIncome('980.00');
    await expect(month.income).toHaveText(eurPattern(98000));

    await month.page.reload();
    await month.goToMonth();

    await expect(month.income).toHaveText(eurPattern(98000));
  });

  test('spending more than the income says Over, not a minus sign', testCase('TC-E2E-034'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpense({ amount_cents: 60000, category_id: groceries.id });

    await month.goToMonth();
    await month.setIncome('500.00');

    // €600 spent against €500 earned. A "-€100.00" under a label reading
    // "Left" is a number somebody reads past; the label changes instead.
    await expect(month.remainingLabel).toHaveText('Over');
    await expect(month.remaining).toHaveText(eurPattern(10000));
  });

  test('cancelling leaves the income alone', testCase('TC-E2E-035'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();
    await month.setIncome('1200.00');
    await expect(month.income).toHaveText(eurPattern(120000));

    await month.incomeEdit.click();
    await month.incomeInput.fill('9999.00');
    await month.incomeCancel.click();

    await expect(month.income).toHaveText(eurPattern(120000));
  });

  test('a malformed income is refused before anything is sent', testCase('TC-E2E-036'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();
    await month.incomeEdit.click();
    await month.incomeInput.fill('a lot');
    await month.incomeSave.click();

    await expect(month.toastError).toHaveText('Income must be a number, for example 1500.00');
    await expect(month.income).toHaveText('Set income');
  });

  // The three rows of the decision table in qa/docs/test-design.md §6 that the
  // original eight cases never reached. Found by running the finished feature
  // back through the procedure, not by a failure.

  test('spending with no income set still draws, and still asks', testCase('TC-E2E-042'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpense({ amount_cents: 4500, category_id: groceries.id });

    await month.goToMonth();

    // Row 2: one condition present, the other absent. The donut has no income
    // to divide, so the spend becomes the whole ring rather than nothing.
    await expect(month.income).toHaveText('Set income');
    await expect(month.remaining).toHaveText('—');
    await expect(month.total).toHaveText(eurPattern(4500));
    await expect(month.slices).toHaveCount(1);
  });

  test('an income with nothing spent leaves all of it', testCase('TC-E2E-043'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();
    await month.setIncome('1500.00');

    // Row 3: the mirror of the case above.
    await expect(month.total).toHaveText(eurPattern(0));
    await expect(month.remainingLabel).toHaveText('Left');
    await expect(month.remaining).toHaveText(eurPattern(150000));
    await expect(month.slices).toHaveCount(0);
  });

  test('spending exactly the income leaves zero, and does not say Over', testCase('TC-E2E-044'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpense({ amount_cents: 50000, category_id: groceries.id });

    await month.goToMonth();
    await month.setIncome('500.00');

    // Row 5: the boundary between "Left" and "Over". It feels like row 4 and
    // sits against the edge of row 6, which is why intuition skips it.
    await expect(month.remainingLabel).toHaveText('Left');
    await expect(month.remaining).toHaveText(eurPattern(0));
  });

  test('the donut draws one arc per category', testCase('TC-E2E-037'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries, transport] = await api.categories();
    await api.addExpense({ amount_cents: 7500, category_id: groceries.id });
    await api.addExpense({ amount_cents: 2500, category_id: transport.id });

    await month.goToMonth();

    await expect(month.donut).toBeVisible();
    await expect(month.slices).toHaveCount(2);
    await expect(month.slice(groceries.id)).toBeVisible();
    await expect(month.slice(transport.id)).toBeVisible();
  });

  test('nothing spent draws no arcs and does not fall over', testCase('TC-E2E-038'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();

    await expect(month.donut).toBeVisible();
    await expect(month.slices).toHaveCount(0);
    await expect(month.total).toHaveText(eurPattern(0));
  });
});
