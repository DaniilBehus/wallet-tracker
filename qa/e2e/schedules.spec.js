'use strict';

const { test, expect, eurWithin, remainingPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { SchedulesPage } = require('./pages/schedules.page');
const { AuthPage } = require('./pages/auth.page');

/** Screen 6.4 — the form, and the one branch in it. */

/** The next February still ahead of us, so the expected date never drifts (R1). */
function nextFebruary() {
  const year = new Date().getFullYear() + 1;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return { startsOn: `${year}-02-01`, lastDay: leap ? 29 : 28 };
}

test.describe('Schedules', () => {
  test('support_control: an owned schedule exposes an Edit control', async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const created = await api.addSchedule({ name: 'Editable plan', amount_cents: 1900,
      day_of_month: 12, starts_on: '2026-01-01' });
    await schedules.goToSchedules();
    await expect(schedules.editButton(created.id)).toBeVisible();
  });

  test('support_control: prefilled edit PATCH persists exact fields on the same schedule without POST', async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const [category] = await api.categories();
    const original = await api.addSchedule({ name: 'Existing plan', amount_cents: 1234,
      category_id: category.id, day_of_month: 31, starts_on: '2026-01-01' });
    const requests = [];
    signedIn.on('request', request => {
      if (request.url().includes('/api/schedules') && ['PATCH', 'POST'].includes(request.method())) {
        requests.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
      }
    });
    await schedules.goToSchedules();
    await schedules.openEdit(original.id);
    await expect(schedules.editName).toHaveValue('Existing plan');
    await expect(schedules.editAmount).toHaveValue('12.34');
    await expect(schedules.editCategory).toHaveValue(String(category.id));
    await expect(schedules.editDay).toHaveValue('31');
    await expect(schedules.editStartsOn).toHaveValue('2026-01-01');
    await expect(schedules.editIsLoan).not.toBeChecked();
    await schedules.editName.fill('Updated plan');
    await schedules.editAmount.fill('45.67');
    await schedules.editCategory.selectOption('');
    await schedules.editDay.fill('12');
    await schedules.editStartsOn.fill('2026-03-04');
    await schedules.editIsLoan.check();
    await schedules.editTotalCount.fill('8');
    await schedules.editSave.click();
    await expect(schedules.editDialog).toBeHidden();
    await expect(schedules.row(original.id)).toContainText('Updated plan');
    const [stored] = await api.schedules();
    expect(stored).toMatchObject({ id: original.id, name: 'Updated plan', amount_cents: 4567,
      category_id: null, day_of_month: 12, starts_on: '2026-03-04', total_count: 8,
      paid_count: 0, active: 1 });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].url).toMatch(new RegExp(`/api/schedules/${original.id}$`));
    expect(requests[0].body).toEqual({ name: 'Updated plan', amount_cents: 4567,
      category_id: null, day_of_month: 12, starts_on: '2026-03-04', total_count: 8 });
  });

  test('support_control: Cancel and Escape send no PATCH and restore focus', async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const original = await api.addSchedule({ name: 'Leave unchanged', amount_cents: 2200,
      day_of_month: 7, starts_on: '2026-01-01' });
    let patches = 0;
    signedIn.on('request', request => { if (request.method() === 'PATCH' &&
      request.url().endsWith(`/api/schedules/${original.id}`)) patches += 1; });
    await schedules.goToSchedules();
    await schedules.openEdit(original.id);
    await schedules.editName.fill('Not saved');
    await schedules.editCancel.click();
    await expect(schedules.editDialog).toBeHidden();
    await expect(schedules.editButton(original.id)).toBeFocused();
    await schedules.openEdit(original.id);
    await schedules.editAmount.fill('99.00');
    await signedIn.keyboard.press('Escape');
    await expect(schedules.editDialog).toBeHidden();
    await expect(schedules.editButton(original.id)).toBeFocused();
    expect(patches).toBe(0);
    expect((await api.schedules()).find(row => row.id === original.id)).toMatchObject(original);
  });

  test('support_control: paid-count conflict, equality closure, reopen and subscription conversion persist', async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const loan = await api.addSchedule({ name: 'Adjustable loan', amount_cents: 500,
      day_of_month: 10, starts_on: '2026-01-01', total_count: 4 });
    await api.paySchedule(loan.id);
    await api.paySchedule(loan.id);
    await schedules.goToSchedules();
    await schedules.openEdit(loan.id);
    await expect(schedules.editIsLoan).toBeChecked();
    await expect(schedules.editTotalCount).toHaveValue('4');
    await schedules.editTotalCount.fill('1');
    await schedules.editSave.click();
    await expect(schedules.editDialog).toBeVisible();
    await expect(schedules.editError).toContainText('2 instalments have already been paid');
    await expect(schedules.editSave).toHaveText('Save changes');
    await expect(schedules.editSave).toBeEnabled();
    expect((await api.schedules()).find(row => row.id === loan.id)).toMatchObject({ total_count: 4, paid_count: 2 });
    await schedules.editTotalCount.fill('2');
    await schedules.editSave.click();
    await expect(schedules.editDialog).toBeHidden();
    expect((await api.schedules()).find(row => row.id === loan.id)).toMatchObject({ total_count: 2, paid_count: 2, active: 0 });
    await schedules.openEdit(loan.id);
    await schedules.editTotalCount.fill('3');
    await schedules.editSave.click();
    await expect(schedules.editDialog).toBeHidden();
    expect((await api.schedules()).find(row => row.id === loan.id)).toMatchObject({ total_count: 3, paid_count: 2, active: 1 });
    await schedules.openEdit(loan.id);
    await schedules.editIsLoan.uncheck();
    await schedules.editSave.click();
    await expect(schedules.editDialog).toBeHidden();
    expect((await api.schedules()).find(row => row.id === loan.id)).toMatchObject({ total_count: null, paid_count: 2, active: 1 });
  });

  test('support_control: invalid edit and a missing-row refusal keep entered values without false success', async ({ signedIn, api, request, user }) => {
    const schedules = new SchedulesPage(signedIn);
    const original = await api.addSchedule({ name: 'Existing only', amount_cents: 900,
      day_of_month: 6, starts_on: '2026-01-01' });
    const other = await request.post('/api/auth/register', { data: {
      email: `foreign-edit-${Date.now()}@wallet.test`, password: 'foreign-edit-passphrase',
    } });
    expect(other.status()).toBe(201);
    const { token: foreignToken } = await other.json();
    const foreign = await request.post('/api/schedules', { headers: { Authorization: `Bearer ${foreignToken}` },
      data: { name: 'Foreign', amount_cents: 700, day_of_month: 5, starts_on: '2026-01-01' } });
    expect(foreign.status()).toBe(201);
    const foreignId = (await foreign.json()).id;
    const denied = await request.patch(`/api/schedules/${foreignId}`, {
      headers: { Authorization: `Bearer ${user.token}` }, data: { name: 'No access' },
    });
    expect(denied.status()).toBe(404);
    let attempted = 0;
    await signedIn.route(new RegExp(`/api/schedules/${original.id}$`), route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      attempted += 1;
      // UI refusal seam: a deleted/foreign row is never inserted into this account's list.
      return route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No schedule' } }) });
    });
    await schedules.goToSchedules();
    await schedules.openEdit(original.id);
    await schedules.editAmount.fill('not money');
    await schedules.editSave.click();
    await expect(schedules.editError).toContainText('Amount must be a number');
    await schedules.editAmount.fill('12.00');
    await schedules.editDay.fill('32');
    await schedules.editSave.click();
    await expect(schedules.editError).toContainText('between 1 and 31');
    expect(attempted).toBe(0);
    await schedules.editDay.fill('6');
    await schedules.editSave.click();
    await expect(schedules.editError).toContainText('no longer available');
    await expect(schedules.editDialog).toBeVisible();
    await expect(schedules.editAmount).toHaveValue('12.00');
    await expect(schedules.editSave).toHaveText('Save changes');
    await expect(schedules.editSave).toBeEnabled();
    expect(attempted).toBe(1);
    expect((await api.schedules()).find(row => row.id === original.id)).toMatchObject(original);
  });

  test('support_control: narrow-phone edit form remains scrollable and traps keyboard focus', async ({ signedIn, api }) => {
    await signedIn.setViewportSize({ width: 320, height: 568 });
    const schedules = new SchedulesPage(signedIn);
    const original = await api.addSchedule({ name: 'Narrow-screen schedule', amount_cents: 1000,
      day_of_month: 31, starts_on: '2026-01-01', total_count: 12 });
    await schedules.goToSchedules();
    await schedules.openEdit(original.id);
    await expect(schedules.editName).toBeFocused();
    await schedules.editCancel.focus();
    await signedIn.keyboard.press('Tab');
    await expect(schedules.editName).toBeFocused();
    await signedIn.keyboard.press('Shift+Tab');
    await expect(schedules.editCancel).toBeFocused();
    await schedules.editSave.scrollIntoViewIfNeeded();
    await expect(schedules.editSave).toBeInViewport();
    await expect.poll(() => signedIn.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await schedules.editCancel.click();
    expect((await api.schedules()).find(row => row.id === original.id)).toMatchObject(original);
  });

  test('support_control: committed edit with lost reply stays open and states uncertainty', async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const original = await api.addSchedule({ name: 'Reply may vanish', amount_cents: 1100,
      day_of_month: 9, starts_on: '2026-01-01' });
    let committed = 0;
    await signedIn.route(new RegExp(`/api/schedules/${original.id}$`), async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed += 1;
      return route.abort('failed');
    });
    await schedules.goToSchedules();
    await schedules.openEdit(original.id);
    await schedules.editName.fill('Actually committed');
    await schedules.editSave.click();
    await expect(schedules.editError).toContainText('result is unknown');
    await expect(schedules.editDialog).toBeVisible();
    await expect(schedules.editName).toHaveValue('Actually committed');
    await expect(schedules.toastSuccess).toBeHidden();
    expect(committed).toBe(1);
    expect((await api.schedules()).find(row => row.id === original.id)).toMatchObject({
      id: original.id, name: 'Actually committed', paid_count: 0,
    });
  });

  test('support_control: a late committed PATCH cannot toast or reopen an editor after navigation', async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const original = await api.addSchedule({ name: 'Late edit', amount_cents: 800,
      day_of_month: 8, starts_on: '2026-01-01' });
    await signedIn.evaluate(() => {
      window.__lateScheduleEditBody = false;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await nativeFetch(...args);
        if (String(args[0]).includes(`/api/schedules/${window.__editedScheduleId}`) &&
            args[1]?.method === 'PATCH') {
          const originalJson = response.json.bind(response);
          response.json = async () => {
            const value = await originalJson();
            requestAnimationFrame(() => { window.__lateScheduleEditBody = true; });
            return value;
          };
        }
        return response;
      };
    });
    await signedIn.evaluate(id => { window.__editedScheduleId = id; }, original.id);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let observed = 0;
    await signedIn.route(new RegExp(`/api/schedules/${original.id}$`), async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      observed += 1;
      await held;
      return route.fulfill({ response });
    });
    try {
      await schedules.goToSchedules();
      await schedules.openEdit(original.id);
      await schedules.editName.fill('Committed after exit');
      await schedules.editSave.click();
      await expect.poll(() => observed).toBe(1);
      // Test-only navigation seam: native modal intentionally blocks pointer navigation.
      await signedIn.getByTestId('nav-month').evaluate(button => button.click());
      await expect(schedules.editDialog).toBeHidden();
      await expect(signedIn.getByTestId('nav-month')).toHaveAttribute('aria-current', 'page');
    } finally { release(); }
    await signedIn.waitForFunction(() => window.__lateScheduleEditBody === true);
    await expect(schedules.toastSuccess).toBeHidden();
    await expect(schedules.editDialog).toBeHidden();
    expect((await api.schedules()).find(row => row.id === original.id)).toMatchObject({
      id: original.id, name: 'Committed after exit', paid_count: 0,
    });
  });

  test('support_control: old edit reply cannot affect a newly signed-in account', async ({ signedIn, api, request }) => {
    const schedules = new SchedulesPage(signedIn);
    const auth = new AuthPage(signedIn);
    const original = await api.addSchedule({ name: 'Old account plan', amount_cents: 1400,
      day_of_month: 14, starts_on: '2026-01-01' });
    await signedIn.evaluate(id => {
      window.__oldScheduleEditBody = false;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await nativeFetch(...args);
        if (String(args[0]).endsWith(`/api/schedules/${id}`) && args[1]?.method === 'PATCH') {
          const originalJson = response.json.bind(response);
          response.json = async () => {
            const value = await originalJson();
            requestAnimationFrame(() => { window.__oldScheduleEditBody = true; });
            return value;
          };
        }
        return response;
      };
    }, original.id);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let observed = 0;
    await signedIn.route(new RegExp(`/api/schedules/${original.id}$`), async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      observed += 1;
      await held;
      return route.fulfill({ response });
    });
    await signedIn.route(/\/api\/schedules\?active=1$/, route => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Synthetic current-session denial' } }),
    }));
    try {
      await schedules.goToSchedules();
      await schedules.openEdit(original.id);
      await schedules.editName.fill('Old account changed');
      await schedules.editSave.click();
      await expect.poll(() => observed).toBe(1);
      // Native modal blocks pointer navigation; this is a session-switch seam.
      await signedIn.getByTestId('nav-upcoming').evaluate(button => button.click());
      await expect(auth.submit).toBeVisible();
      const email = `fresh-schedule-edit-${Date.now()}@wallet.test`;
      const password = 'synthetic-new-session-password';
      const registered = await request.post('/api/auth/register', { data: { email, password } });
      expect(registered.status()).toBe(201);
      await auth.signIn(email, password);
      await schedules.goToSchedules();
      await expect(schedules.rows).toHaveCount(0);
    } finally { release(); }
    await signedIn.waitForFunction(() => window.__oldScheduleEditBody === true);
    await expect(schedules.rows).toHaveCount(0);
    await expect(schedules.editDialog).toBeHidden();
    await expect(schedules.toastSuccess).toBeHidden();
    expect((await api.schedules()).find(row => row.id === original.id)).toMatchObject({
      id: original.id, name: 'Old account changed',
    });
  });

  test('a subscription is created and listed', testCase('TC-E2E-017'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Telekom',
      amount: '15.00',
      day: 12,
      startsOn: '2026-01-01',
    });

    await expect(schedules.toastSuccess).toHaveText('Telekom · added');
    await expect(schedules.rows).toHaveCount(1);
    await expect(schedules.rows.first()).toContainText('Telekom');
  });

  test('the loan checkbox is the only branch in the form', testCase('TC-E2E-018'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await expect(schedules.totalCount).toBeHidden();

    await schedules.isLoan.check();
    await expect(schedules.totalCount).toBeVisible();

    await schedules.isLoan.uncheck();
    await expect(schedules.totalCount).toBeHidden();
  });

  test('a loan shows its countdown from the moment it is created', testCase('TC-E2E-019'), async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Laptop loan',
      amount: '100.00',
      day: 15,
      startsOn: '2026-01-01',
      totalCount: 10,
    });

    await expect(schedules.toastSuccess).toBeVisible();
    await expect(schedules.rows).toHaveCount(1);

    // The id comes from the API, so the assertion addresses one specific row
    // rather than "whichever happens to be first".
    const [created] = await api.schedules();
    await expect(schedules.row(created.id)).toContainText('Laptop loan');
    // 10 instalments of €100.00 outstanding: the countdown line, exactly.
    await expect(schedules.remaining(created.id)).toHaveText(remainingPattern(10, 10, 10000));
  });

  test('the 31st is accepted and explains itself', testCase('TC-E2E-020'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);
    const { startsOn, lastDay } = nextFebruary();

    await schedules.goToSchedules();

    await schedules.day.fill('12');
    await expect(schedules.dayHint).toHaveText('');

    await schedules.day.fill('31');
    await expect(schedules.dayHint).toHaveText(
      'In months with no 31st, the payment is taken on the last day of the month.'
    );

    await schedules.name.fill('Rent');
    await schedules.amount.fill('500.00');
    await schedules.startsOn.fill(startsOn);
    await schedules.save.click();

    await expect(schedules.toastSuccess).toBeVisible();
    // Clamped to the last day of February — not skipped (spec §4.1).
    await expect(schedules.rows.first()).toContainText(`${lastDay} Feb`);
  });

  test('a malformed amount is refused before anything is sent', testCase('TC-E2E-021'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Nonsense',
      amount: 'not a number',
      day: 5,
      startsOn: '2026-01-01',
    });

    await expect(schedules.toastError).toHaveText('Amount must be a number, for example 15.00');
    await expect(schedules.rows).toHaveCount(0);
  });

  test('a day outside 1–31 is refused', testCase('TC-E2E-022'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Day 32',
      amount: '10.00',
      day: 32,
      startsOn: '2026-01-01',
    });

    await expect(schedules.toastError).toHaveText('Day of month must be between 1 and 31');
    await expect(schedules.rows).toHaveCount(0);
  });

  test('a loan of more instalments than the app supports is refused', testCase('TC-E2E-075'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    const sent = [];
    signedIn.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/schedules')) sent.push(request.url());
    });

    await schedules.goToSchedules();
    await schedules.create({
      name: 'A thousand years',
      amount: '10.00',
      day: 5,
      startsOn: '2026-01-01',
      totalCount: 1201,
    });

    await expect(schedules.toastError).toContainText('at most 1200 instalments');
    await expect(schedules.rows).toHaveCount(0);
    // The server refuses it too, in the same words as far as the number goes,
    // so the case has to show the request was never made (BUG-018, D-046).
    expect(sent).toHaveLength(0);
  });

  test('a schedule created through the API is shown with its amount', testCase('TC-E2E-023'), async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const created = await api.addSchedule({
      name: 'Netflix',
      amount_cents: 1399,
      day_of_month: 8,
      starts_on: '2026-01-01',
    });

    await schedules.goToSchedules();

    await expect(schedules.row(created.id)).toBeVisible();
    await expect(schedules.row(created.id)).toContainText('Netflix');
    await expect(schedules.remaining(created.id)).toHaveText('Subscription');
    await expect(schedules.row(created.id)).toContainText(eurWithin(1399));
  });
});
