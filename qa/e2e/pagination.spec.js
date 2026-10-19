'use strict';

const { test, expect, eurPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { MonthPage } = require('./pages/month.page');

/**
 * Paging the month list (D-031).
 *
 * The risk this closes was written down before it was fixed, in
 * `qa/docs/test-plan.md`: "the month screen requests 200 rows, so the list
 * would silently truncate while the total stays whole". Silently is the word
 * that matters — the total came from `/summary` and was always right, so the
 * screen showed a correct total above an incomplete list and said nothing.
 *
 * The boundaries are therefore of two kinds and both are covered:
 *   · the page size, 50, where the control appears at all;
 *   · 199 / 200 / 201, the old cap, where the list used to stop.
 *
 * These tests create real rows through the API rather than stubbing the
 * response. A stub would prove the component pages a list; only real rows prove
 * the app and the server agree about what "total" means.
 */

test.describe('Paging the month list', () => {
  test('a month that fits on one page shows no paging controls', testCase('TC-E2E-054'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpenses(50, { amount_cents: 100, category_id: groceries.id });

    await month.goToMonth();

    await expect(month.rows).toHaveCount(50);
    await expect(month.loadMore).toBeHidden();
    await expect(month.count).toBeHidden();
    // 50 × €1.00
    await expect(month.total).toHaveText(eurPattern(5000));
  });

  test('one row past the page size brings the control out', testCase('TC-E2E-055'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const made = await api.addExpenses(51, { amount_cents: 100, category_id: groceries.id });

    await month.goToMonth();

    await expect(month.rows).toHaveCount(50);
    await expect(month.count).toHaveText('Showing 50 of 51');
    await expect(month.loadMore).toBeVisible();

    // A second client inserts ahead of the cursor while this screen is open.
    const inserted = await api.addExpense({ amount_cents: 100, category_id: groceries.id });
    await month.loadMore.click();
    await expect(month.count).toHaveText('Showing 50 of 52');
    await month.loadMore.click();

    await expect(month.rows).toHaveCount(52);
    await expect(month.count).toHaveText('Showing 52 of 52');
    await expect(month.loadMore).toBeHidden();
    expect((await month.visibleIds()).sort((a, b) => a - b)).toEqual(
      [...made.map(row => row.id), inserted.id].sort((a, b) => a - b)
    );
    await expect(month.total).toHaveText(eurPattern(5200));
  });

  test('201 expenses — the old cap — all reachable, and the total agrees', testCase('TC-E2E-056'), async ({
    signedIn,
    api,
  }) => {
    test.slow();

    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpenses(201, { amount_cents: 100, category_id: groceries.id });

    await month.goToMonth();

    // The number that used to be wrong. The list stopped at 200 and nothing
    // said so; now the count says what is missing before anyone clicks.
    await expect(month.count).toHaveText('Showing 50 of 201');
    await expect(month.total).toHaveText(eurPattern(20100));

    // 50 → 100 → 150 → 200 → 201. The fourth click is the one that crosses the
    // old cap, and the fifth row of this sequence is the row that never used to
    // load at all.
    for (const expected of [100, 150, 200, 201]) {
      await month.loadMore.click();
      await expect(month.count).toHaveText(`Showing ${expected} of 201`);
    }

    await expect(month.rows).toHaveCount(201);
    await expect(month.loadMore).toBeHidden();
    // Still 201 × €1.00: paging must not change what a month adds up to.
    await expect(month.total).toHaveText(eurPattern(20100));
  });

  test('the count stays honest after a row is deleted', testCase('TC-E2E-057'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const made = await api.addExpenses(52, { amount_cents: 100, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.count).toHaveText('Showing 50 of 52');

    // The LAST row created, not the first. The list is newest first
    // (`spent_on DESC, id DESC`), so the first row created is the one at the
    // bottom — on page two, not rendered, and not clickable. The first draft of
    // this test used `made[0]` and failed for that reason rather than for a
    // reason about paging.
    const onScreen = made[made.length - 1];

    // The app's own deletion reloads the first page. Then a second client
    // deletes another seen row before continuation; the remaining unseen row
    // must not disappear behind the shifted offset.
    await month.deleteButton(onScreen.id).click();

    await expect(month.rows).toHaveCount(50);
    await expect(month.count).toHaveText('Showing 50 of 51');
    await api.deleteExpense(made[made.length - 2].id);
    await month.loadMore.click();
    await expect(month.count).toBeHidden();
    expect((await month.visibleIds()).sort((a, b) => a - b)).toEqual(
      made.slice(0, -2).map(row => row.id).sort((a, b) => a - b)
    );
    await expect(month.total).toHaveText(eurPattern(5000));
  });
});
