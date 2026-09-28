'use strict';

const { test, expect, eur } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { MonthPage } = require('./pages/month.page');
const { contrastRatio, parseRgb } = require('./support/contrast');

// REQ-CL-11/12: real browser, isolated account for every test; no shared seed.
const categoryPatch = (request) =>
  request.method() === 'PATCH' && /\/api\/categories\/\d+$/.test(request.url());

test('category editor sets, prefills and clears without changing the month', testCase('TC-E2E-086'), async ({ signedIn, api }) => {
  const month = new MonthPage(signedIn);
  const [category] = await api.categories();
  await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 40000 });
  await api.addExpense({ amount_cents: 1250, category_id: category.id });
  await month.goToMonth();
  await month.categoryLimitEdit(category.id).click();
  await expect(month.categoryLimitTitle).toHaveText(`Category limit · ${category.name}`);
  await expect(month.categoryLimitInput).toHaveValue('');
  await month.categoryLimitInput.fill('60.00');
  await month.categoryLimitSave.click();
  await expect(month.categoryLimitDialog).toBeHidden();
  await expect(month.bar(category.id)).toContainText('€12.50 of €60.00');
  await expect(month.categoryLimitStatus(category.id)).toHaveText('Within limit · €47.50 left');
  expect((await api.categories()).find(c => c.id === category.id).monthly_limit_cents).toBe(6000);
  await month.categoryLimitEdit(category.id).click();
  await expect(month.categoryLimitInput).toHaveValue('60.00');
  await month.categoryLimitInput.fill('');
  await month.categoryLimitSave.click();
  await expect(month.categoryLimitStatus(category.id)).toHaveCount(0);
  await expect(month.bar(category.id)).toContainText('€12.50');
  const summary = await api.summary();
  expect(summary.total_cents).toBe(1250);
  expect(summary.income_cents).toBe(150000);
  expect(summary.limit_cents).toBe(40000);
  expect((await api.categories()).find(c => c.id === category.id).monthly_limit_cents).toBeNull();
});

test('category states have words, white outlines or contrasting red fills', testCase('TC-E2E-087'), async ({ signedIn, api }) => {
  const month = new MonthPage(signedIn);
  const categories = await api.categories();
  const amounts = [5000, 10000, 12500, 100];
  const sentences = ['Within limit · €50.00 left', 'Limit reached', 'Over limit by €25.00'];
  for (let i = 0; i < amounts.length; i++) {
    await api.addExpense({ amount_cents: amounts[i], category_id: categories[i].id });
    if (i < 3) await api.setCategoryLimit(categories[i].id, 10000);
  }
  await month.goToMonth();
  for (let i = 0; i < 3; i++) {
    const status = month.categoryLimitStatus(categories[i].id);
    await expect(status).toHaveText(sentences[i]);
    const colours = await status.evaluate(el => {
      const style = getComputedStyle(el);
      let ancestor = el.parentElement;
      while (ancestor && getComputedStyle(ancestor).backgroundColor === 'rgba(0, 0, 0, 0)') ancestor = ancestor.parentElement;
      return { text: style.color, fill: style.backgroundColor, border: style.borderTopColor,
        behind: getComputedStyle(ancestor).backgroundColor };
    });
    if (i === 0) {
      expect(parseRgb(colours.fill).a).toBe(0);
      expect(parseRgb(colours.border)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(contrastRatio(colours.text, colours.behind)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colours.border, colours.behind)).toBeGreaterThanOrEqual(3);
    } else {
      expect(parseRgb(colours.fill)).toEqual({ r: 192, g: 57, b: 43, a: 1 });
      expect(parseRgb(colours.text)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(contrastRatio(colours.text, colours.fill)).toBeGreaterThanOrEqual(4.5);
    }
  }
  await expect(month.categoryLimitStatus(categories[3].id)).toHaveCount(0);
  await expect(month.bar(categories[3].id)).toContainText(eur(100));
});

test('a zero-spend budget remains visible, zero is real, clearing hides it', testCase('TC-E2E-088'), async ({ signedIn, api }) => {
  const month = new MonthPage(signedIn);
  const [category, hidden] = await api.categories();
  await api.setCategoryLimit(category.id, 20000);
  await month.goToMonth();
  await expect(month.bar(category.id)).toContainText('€0.00 of €200.00');
  await expect(month.categoryLimitStatus(category.id)).toHaveText('Within limit · €200.00 left');
  await expect(month.bar(hidden.id)).toHaveCount(0);
  await expect(month.slices).toHaveCount(0);
  expect(await month.bar(category.id).evaluate(el => el.innerHTML)).not.toMatch(/NaN|Infinity/);
  await month.setCategoryLimit(category.id, '0');
  await expect(month.categoryLimitStatus(category.id)).toHaveText('Limit reached');
  expect((await api.summary()).by_category[0].limit_cents).toBe(0);
  await month.setCategoryLimit(category.id, '');
  await expect(month.bar(category.id)).toHaveCount(0);
  expect((await api.summary()).by_category).toEqual([]);
});

test('invalid limits and Cancel send no category PATCH and preserve the value', testCase('TC-E2E-089'), async ({ signedIn, api }) => {
  const month = new MonthPage(signedIn);
  const [category] = await api.categories();
  await api.setCategoryLimit(category.id, 6000);
  await month.goToMonth();
  const patches = [];
  signedIn.on('request', r => { if (categoryPatch(r)) patches.push(r); });
  await month.categoryLimitEdit(category.id).click();
  for (const invalid of ['abc', '-1', '1000000.01']) {
    await month.categoryLimitInput.fill(invalid);
    await month.categoryLimitSave.click();
    await expect(month.categoryLimitError).toBeVisible();
    await expect(month.categoryLimitDialog).toBeVisible();
  }
  await month.categoryLimitInput.fill('99.00');
  await month.categoryLimitCancel.click();
  await expect(month.categoryLimitDialog).toBeHidden();
  expect(patches).toHaveLength(0);
  expect((await api.categories()).find(c => c.id === category.id).monthly_limit_cents).toBe(6000);
});

test('Uncategorised counts toward the month but has no box or editor', testCase('TC-E2E-090'), async ({ signedIn, api }) => {
  const month = new MonthPage(signedIn);
  const [category] = await api.categories();
  await api.setCategoryLimit(category.id, 0);
  await api.addExpense({ amount_cents: 750, category_id: null });
  await month.goToMonth();
  await expect(month.bar('none')).toContainText('Uncategorised');
  await expect(month.bar('none').getByRole('button')).toHaveCount(0);
  await expect(month.categoryLimitEdit('none')).toHaveCount(0);
  await expect(month.categoryLimitStatus('none')).toHaveCount(0);
  await expect(month.total).toHaveText(eur(750));
});

test('320px rows and editor fit long names and ceiling amounts', testCase('TC-E2E-091'), async ({ signedIn, api }, testInfo) => {
  await signedIn.setViewportSize({ width: 320, height: 568 });
  const month = new MonthPage(signedIn);
  const long = await api.addCategory({ name: 'Restaurants and groceries for a very long household category', icon: 'R' });
  const [reached, over] = await api.categories();
  await api.setCategoryLimit(long.id, 100000000);
  await api.setCategoryLimit(reached.id, 10000);
  await api.setCategoryLimit(over.id, 10000);
  const longExpense = await api.addExpense({ amount_cents: 99999999, category_id: long.id });
  await api.addExpense({ amount_cents: 10000, category_id: reached.id });
  await api.addExpense({ amount_cents: 12500, category_id: over.id });
  // API created a category after browser boot; reload its normal category cache.
  await month.open();
  await month.goToMonth();
  await expect(month.txName(longExpense.id)).toHaveText(long.name);
  await expect(month.bar(long.id)).toContainText('€999,999.99 of €1,000,000.00');
  await expect(month.bar(long.id)).toContainText(long.name);
  for (const id of [long.id, reached.id, over.id]) {
    const box = await month.bar(id).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await month.bar(id).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const status = await month.categoryLimitStatus(id).boundingBox();
    expect(status.x + status.width).toBeLessThanOrEqual(320);
  }
  expect(await signedIn.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  if (testInfo.project.name === 'mobile-chromium') {
    // Taller review capture shows all three boxes; the fit checks above are 320x568.
    await signedIn.setViewportSize({ width: 320, height: 1000 });
    await signedIn.mouse.move(0, 0);
    await signedIn.screenshot({ path: 'output/playwright/category-limit-states-320.png', fullPage: true });
    await signedIn.setViewportSize({ width: 320, height: 568 });
  }
  await month.categoryLimitEdit(long.id).click();
  await expect(month.categoryLimitInput).toHaveValue('1000000.00');
  for (const control of [month.categoryLimitInput, month.categoryLimitSave, month.categoryLimitCancel]) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(568);
  }
});

test('category modal focuses input, contains keyboard focus and Escape restores it', testCase('TC-E2E-092'), async ({ signedIn, api }) => {
  const month = new MonthPage(signedIn);
  const [category] = await api.categories();
  await api.setCategoryLimit(category.id, 6000);
  await month.goToMonth();
  await month.categoryLimitEdit(category.id).click();
  await expect(month.categoryLimitInput).toBeFocused();
  for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab']) {
    await signedIn.keyboard.press(key);
    expect(await month.categoryLimitDialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await signedIn.keyboard.press('Escape');
  await expect(month.categoryLimitDialog).toBeHidden();
  await expect(month.categoryLimitEdit(category.id)).toBeFocused();
  expect((await api.summary()).by_category[0].limit_cents).toBe(6000);
});

test('a refused category save stays editable and never claims success', testCase('TC-E2E-093'), async ({ signedIn, api }) => {
  const month = new MonthPage(signedIn);
  const [category] = await api.categories();
  await api.setCategoryLimit(category.id, 6000);
  await month.goToMonth();
  // Controlled UI error only; the API suite checks real validation responses.
  await signedIn.route(`**/api/categories/${category.id}`, route => route.fulfill({
    status: 400, json: { error: { code: 'VALIDATION_FAILED', message: 'Category save refused' } },
  }));
  await month.setCategoryLimit(category.id, '90.00');
  await expect(month.categoryLimitError).toBeVisible();
  await expect(month.categoryLimitError).toHaveText('Please check what you entered.');
  await expect(month.categoryLimitDialog).toBeVisible();
  await expect(month.categoryLimitInput).toHaveValue('90.00');
  await expect(month.categoryLimitSave).toBeEnabled();
  await expect(month.toastSuccess).toBeHidden();
  expect((await api.categories()).find(c => c.id === category.id).monthly_limit_cents).toBe(6000);
});
