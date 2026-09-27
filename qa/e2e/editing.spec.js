'use strict';

const { test, expect, eurPattern, eurWithin } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { MonthPage } = require('./pages/month.page');

/**
 * Editing an expense from the month screen (spec §6.2, D-029).
 *
 * The interesting cases are not "the amount changed". They are the ones where
 * the screen has to survive something it did not initiate: the row being gone,
 * a value being refused, and a change to one field leaving the others alone.
 */

test.describe('Editing an expense', () => {
  test('changing the amount updates the row, the total and the donut', testCase('TC-E2E-048'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const tx = await api.addExpense({ amount_cents: 1500, category_id: groceries.id, note: 'coffee' });

    await month.goToMonth();
    await expect(month.total).toHaveText(eurPattern(1500));

    await month.editExpense(tx.id, { amount: '25.00' });

    await expect(month.row(tx.id)).toContainText(eurWithin(2500));
    await expect(month.total).toHaveText(eurPattern(2500));
  });

  test('editing one field leaves the others alone', testCase('TC-E2E-049'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const tx = await api.addExpense({ amount_cents: 1500, category_id: groceries.id, note: 'coffee' });

    await month.goToMonth();
    await month.editExpense(tx.id, { note: 'coffee and a bun' });

    // The note changed and the amount did not. This is the PATCH-not-PUT
    // property (D-029) as a user can observe it: a screen that sent the whole
    // row would pass this too, so the API case is the one that pins the
    // mechanism — this one pins that the mechanism reaches the user.
    await expect(month.row(tx.id)).toContainText('coffee and a bun');
    await expect(month.row(tx.id)).toContainText(eurWithin(1500));
    await expect(month.total).toHaveText(eurPattern(1500));
  });

  test('cancel changes nothing', testCase('TC-E2E-050'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const tx = await api.addExpense({ amount_cents: 1500, category_id: groceries.id, note: 'coffee' });

    await month.goToMonth();
    await month.editButton(tx.id).click();
    await month.editAmount.fill('99.99');
    await month.editCancel.click();

    await expect(month.editAmount).toBeHidden();
    await expect(month.row(tx.id)).toContainText(eurWithin(1500));
    await expect(month.total).toHaveText(eurPattern(1500));
  });

  test('saving a row that another tab already deleted says so and refreshes', testCase('TC-E2E-051'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const tx = await api.addExpense({ amount_cents: 1500, category_id: groceries.id, note: 'coffee' });

    await month.goToMonth();
    await month.editButton(tx.id).click();
    await month.editAmount.fill('25.00');

    // The other tab, standing in for a second device: the row is deleted while
    // this screen has it open. Exactly scenario B from qa/race/, arriving here
    // from the user's side rather than the server's.
    await api.deleteExpense(tx.id);

    await month.editSave.click();

    await expect(month.toastError).toBeVisible();
    await expect(month.editAmount).toBeHidden();
    await expect(month.row(tx.id)).toHaveCount(0);
  });

  test('an amount the API refuses leaves the editor open with the row unchanged', testCase('TC-E2E-052'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const tx = await api.addExpense({ amount_cents: 1500, category_id: groceries.id });

    await month.goToMonth();
    await month.editButton(tx.id).click();
    await month.editAmount.fill('0');
    await month.editSave.click();

    // Refused in the browser before it is sent, so the editor stays open and
    // the row is untouched. The user has somewhere to correct the mistake,
    // which is the whole difference between a validation message and a wall.
    await expect(month.toastError).toBeVisible();
    await expect(month.editAmount).toBeVisible();
    await expect(month.row(tx.id)).toContainText(eurWithin(1500));
  });

  test('the row opens its editor by keyboard, not only by tap', testCase('TC-E2E-053'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const tx = await api.addExpense({ amount_cents: 1500, category_id: groceries.id, note: 'coffee' });

    await month.goToMonth();

    // The control is a button, so it takes focus and answers Enter. It was a
    // div with a click handler in the first draft, and that version passed
    // every test above while being unreachable without a pointer.
    await month.editButton(tx.id).focus();
    await signedIn.keyboard.press('Enter');

    await expect(month.editAmount).toBeVisible();
    await expect(month.editAmount).toHaveValue('15.00');
  });

  /**
   * BUG-015. An expense may have no category, and the editor has to be able to
   * say so. It could not: the select had no option for "none", the browser
   * reported an empty value, and saving turned that into category 0 — a
   * category that cannot exist — so a note-only edit was refused with 400.
   *
   * These three cases watch the request rather than the screen. A screen test
   * would pass as soon as the toast said "saved"; the defect was in what the
   * request carried, so that is what is asserted.
   */
  function patchesOf(page) {
    const sent = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && /\/api\/transactions\/\d+$/.test(request.url())) {
        sent.push(request.postDataJSON());
      }
    });
    return sent;
  }

  test('a note-only edit of an uncategorised expense never sends a category', testCase('TC-E2E-070'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const tx = await api.addExpense({ amount_cents: 1500, note: 'coffee' });
    const patches = patchesOf(signedIn);

    await month.goToMonth();
    await expect(month.row(tx.id)).toContainText('Uncategorised');

    await month.editExpense(tx.id, { note: 'coffee and a bun' });

    await expect(month.editNote).toBeHidden();
    await expect(month.row(tx.id)).toContainText('coffee and a bun');
    await expect(month.row(tx.id)).toContainText('Uncategorised');
    await expect(month.row(tx.id)).toContainText(eurWithin(1500));

    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({ note: 'coffee and a bun' });
    expect(patches[0]).not.toHaveProperty('category_id');
  });

  test('saving an uncategorised expense unchanged sends nothing at all', testCase('TC-E2E-071'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const tx = await api.addExpense({ amount_cents: 1500, note: 'coffee' });
    const patches = patchesOf(signedIn);

    await month.goToMonth();
    await month.editButton(tx.id).click();

    // The editor must show what the expense is, including that it has no
    // category; selecting nothing is a state, not a missing answer.
    await expect(month.editCategory).toHaveValue('');
    await month.editSave.click();

    await expect(month.editAmount).toBeHidden();
    await expect(month.row(tx.id)).toContainText('Uncategorised');
    expect(patches, 'an unchanged save is not a request').toHaveLength(0);
  });

  test('a payment from an uncategorised schedule edits the same way', testCase('TC-E2E-072'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const schedule = await api.addSchedule({
      name: 'Locker', amount_cents: 900, day_of_month: 5, starts_on: '2026-01-01',
    });
    const paid = await api.paySchedule(schedule.id);
    const patches = patchesOf(signedIn);

    await month.goToMonth();
    await expect(month.row(paid.transaction_id)).toContainText('Uncategorised');

    await month.editExpense(paid.transaction_id, { note: 'storage' });

    await expect(month.row(paid.transaction_id)).toContainText('storage');
    await expect(month.row(paid.transaction_id)).toContainText(eurWithin(900));
    expect(patches).toHaveLength(1);
    expect(patches[0]).not.toHaveProperty('category_id');
  });
});
