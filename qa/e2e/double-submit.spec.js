'use strict';

const { test, expect, eurPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { AddPage } = require('./pages/add.page');
const { MonthPage } = require('./pages/month.page');
const { SchedulesPage } = require('./pages/schedules.page');

/**
 * Double submission, from the only side a user can reach.
 *
 * `qa/race/` answers the API-level question and the answer is unambiguous: two
 * identical POSTs produce two rows, twenty times out of twenty. That is HTTP
 * behaving as specified — POST is not idempotent — which means the protection,
 * if there is one, has to be here.
 *
 * So these tests ask the question that decides whether the API's behaviour is a
 * hazard a person can meet or a property of the protocol: **can a user, with a
 * pointer and a keyboard, make this application save one expense twice?**
 */

test.describe('Saving an expense twice', () => {
  test('two fast taps on Save produce one expense, not two', testCase('TC-E2E-045'), async ({ signedIn, api }) => {
    const add = new AddPage(signedIn);
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();

    await add.enterAmount('1250');
    await add.tileById(groceries.id).click();

    // No wait between them. `withBusy` disables the button synchronously,
    // before the first request is awaited, so the second click should land on a
    // disabled control — but that is the claim, and this is the check. `force`
    // because a disabled button is not actionable, and the point is to try
    // anyway rather than to be politely refused by the test framework.
    await add.save.click();
    await add.save.click({ force: true }).catch(() => {});

    await month.goToMonth();

    await expect(month.rows).toHaveCount(1);
    await expect(month.total).toHaveText(eurPattern(1250));
  });

  test('Enter pressed twice on the schedule form produces one schedule', testCase('TC-E2E-046'), async ({
    signedIn,
    api,
  }) => {
    const schedules = new SchedulesPage(signedIn);
    const [groceries] = await api.categories();

    await schedules.goToSchedules();
    await schedules.name.fill('Phone');
    await schedules.amount.fill('15.00');
    await schedules.category.selectOption(String(groceries.id));
    await schedules.day.fill('12');
    await schedules.startsOn.fill('2026-01-12');

    await schedules.name.focus();
    await signedIn.keyboard.press('Enter');
    await signedIn.keyboard.press('Enter');

    await expect(schedules.rows).toHaveCount(1);
  });

  test('a second Save after the first has finished is a second expense, correctly', testCase('TC-E2E-047'), async ({
    signedIn,
    api,
  }) => {
    const add = new AddPage(signedIn);
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();

    // The other side of the same guard. Two identical coffees on one day is an
    // ordinary thing to buy, and a screen that deduplicated them would be
    // wrong in a way that is much harder to notice than a duplicate: the
    // expense that never appeared.
    await add.addExpense('200', 'Groceries');
    await expect(add.toastSuccess).toBeVisible();
    await add.addExpense('200', 'Groceries');

    await month.goToMonth();

    await expect(month.rows).toHaveCount(2);
    await expect(month.total).toHaveText(eurPattern(400));
  });
});
