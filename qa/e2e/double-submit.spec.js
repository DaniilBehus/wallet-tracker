'use strict';

const { test, expect, eurPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { AddPage } = require('./pages/add.page');
const { MonthPage } = require('./pages/month.page');
const { SchedulesPage } = require('./pages/schedules.page');
const { UpcomingPage } = require('./pages/upcoming.page');
const { AuthPage } = require('./pages/auth.page');
const { installBusyMutation } = require('../e2e-controls/busy-mutation');

/**
 * Double submission, from the only side a user can reach.
 *
 * Historical unkeyed POST probes in `qa/race/` produced two rows for two
 * requests. This UI test checks whether one user action can accidentally
 * become two requests; it does not redefine keyed replay or API guarantees.
 *
 * So these tests ask the question that decides whether the API's behaviour is a
 * hazard a person can meet or a property of the protocol: **can a user, with a
 * pointer and a keyboard, make this application save one expense twice?**
 */

test.describe('Saving an expense twice', () => {
  test('two fast taps on Save produce one expense, not two', testCase('TC-E2E-045'), async ({ signedIn, api, request, user }, testInfo) => {
    const add = new AddPage(signedIn);
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();

    // The negative diagnostic serves a mutated response to this one browser;
    // it never edits public/app.js or stubs the real transaction API.
    if (testInfo.project.name === 'f22-busy-mutation') {
      await installBusyMutation(signedIn);
      await signedIn.reload();
    }

    await add.enterAmount('1250');
    await add.tileById(groceries.id).click();

    let releaseFirst;
    const firstHeld = new Promise(resolve => { releaseFirst = resolve; });
    let observeFirst, rejectFirst;
    const firstObserved = new Promise((resolve, reject) => {
      observeFirst = resolve;
      rejectFirst = reject;
    });
    let postCount = 0;
    await signedIn.route('**/api/transactions', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      postCount += 1;
      if (postCount !== 1) return route.continue();
      try {
        // Persist through the actual API, but hold its response from the UI.
        // The second tap occurs while Save still awaits this response.
        const response = await route.fetch();
        observeFirst();
        await firstHeld;
        await route.fulfill({ response });
      } catch (error) {
        rejectFirst(error);
        throw error;
      }
    });

    try {
      await add.save.click();
      await firstObserved;
      // The first real POST has completed at the server, but its response is
      // still held from the browser. A native pointer
      // click is attempted even if Playwright's locator actionability would
      // refuse a disabled button; the browser decides whether to dispatch it.
      await expect(add.save).toBeDisabled();
      const box = await add.save.boundingBox();
      expect(box, 'Save must remain visible while POST is pending').not.toBeNull();
      await signedIn.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await signedIn.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(postCount, 'a second native tap must not start another POST').toBe(1);
    } finally {
      releaseFirst();
    }

    await expect(add.save).toBeEnabled();
    const response = await request.get('/api/transactions?limit=20', {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status()).toBe(200);
    const persisted = await response.json();
    expect(persisted.total).toBe(1);
    expect(persisted.items).toHaveLength(1);
    expect(persisted.items[0].amount_cents).toBe(1250);

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

test('support_control: committed Save with lost answer remains one expense after explicit retry', async ({ signedIn, api, request, user }) => {
  const add = new AddPage(signedIn);
  const [category] = await api.categories();
  await add.enterAmount('1250');
  await add.tileById(category.id).click();
  const attempts = [];
  let committedId;
  await signedIn.route('**/api/transactions', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (attempts.length === 1) {
      const response = await route.fetch(); // Real disposable DB commit, then reply lost to browser.
      expect(response.status()).toBe(201);
      committedId = (await response.json()).id;
      return route.abort('failed');
    }
    return route.continue();
  });
  await add.save.click();
  await expect(signedIn.getByTestId('write-retry')).toBeVisible();
  const headers = { Authorization: `Bearer ${user.token}` };
  const before = await (await request.get('/api/transactions?limit=20', { headers })).json();
  expect(before.items).toHaveLength(1);
  const originalId = before.items[0].id;
  expect(originalId).toBe(committedId);
  await signedIn.getByTestId('write-retry').click();
  await expect(signedIn.getByTestId('write-retry')).toBeHidden();
  const after = await (await request.get('/api/transactions?limit=20', { headers })).json();
  expect(after.items.map(item => item.id)).toEqual([originalId]);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toMatch(/^[0-9a-f-]{8,64}$/);
  expect(attempts[1]).toEqual(attempts[0]);
  await add.addExpense('1250', category.name);
  const distinct = await (await request.get('/api/transactions?limit=20', { headers })).json();
  expect(distinct.items).toHaveLength(2);
  expect(new Set(distinct.items.map(item => item.id)).size).toBe(2);
  expect(attempts[2].key).not.toBe(attempts[0].key);
});

test('support_control: committed final Pay with lost answer replays without another instalment', async ({ signedIn, api, request, user }) => {
  const upcoming = new UpcomingPage(signedIn);
  const loan = await api.addSchedule({
    name: 'One instalment', amount_cents: 3500, day_of_month: 15,
    starts_on: '2026-01-01', total_count: 1,
  });
  await upcoming.goToUpcoming();
  const attempts = [];
  let committedId;
  await signedIn.route(`**/api/schedules/${loan.id}/pay`, async route => {
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (attempts.length === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committedId = (await response.json()).transaction_id;
      return route.abort('failed');
    }
    return route.continue();
  });
  await upcoming.pay(loan.id);
  await expect(signedIn.getByTestId('write-retry')).toBeVisible();
  const [paid] = (await api.schedules()).filter(item => item.id === loan.id);
  expect(paid.paid_count).toBe(1);
  expect(paid.active).toBe(0);
  const headers = { Authorization: `Bearer ${user.token}` };
  const before = await (await request.get('/api/transactions?limit=20', { headers })).json();
  expect(before.items.filter(item => item.schedule_id === loan.id)).toHaveLength(1);
  const originalId = before.items.find(item => item.schedule_id === loan.id).id;
  expect(originalId).toBe(committedId);
  await signedIn.getByTestId('write-retry').click();
  await expect(signedIn.getByTestId('write-retry')).toBeHidden();
  const [replayed] = (await api.schedules()).filter(item => item.id === loan.id);
  expect(replayed.paid_count).toBe(1);
  const after = await (await request.get('/api/transactions?limit=20', { headers })).json();
  expect(after.items.filter(item => item.schedule_id === loan.id).map(item => item.id)).toEqual([originalId]);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toMatch(/^[0-9a-f-]{8,64}$/);
  expect(attempts[1]).toEqual(attempts[0]);
});

test('support_control: uncertain Save survives reload and stays hidden from another account', async ({ signedIn, api, request, user, context }) => {
  const add = new AddPage(signedIn);
  const [category] = await api.categories();
  await add.enterAmount('4200');
  await add.tileById(category.id).click();
  await signedIn.route('**/api/transactions', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch();
    return route.abort('failed');
  });
  await add.save.click();
  await expect(signedIn.getByTestId('write-retry')).toBeVisible();
  await signedIn.reload();
  await expect(signedIn.getByTestId('write-retry')).toBeVisible();
  const other = await request.post('/api/auth/register', { data: {
    email: `recovery-other-${Date.now()}@wallet.test`, password: 'synthetic-other-password-123',
  } });
  expect(other.status()).toBe(201);
  const { token: otherToken } = await other.json();
  const otherPage = await context.newPage();
  await otherPage.addInitScript(token => localStorage.setItem('wallet_token', token), otherToken);
  await otherPage.goto('/');
  await expect(otherPage.getByRole('region', { name: 'Unresolved financial action' })).toBeHidden();
  await otherPage.close();
  await signedIn.reload();
  await expect(signedIn.getByTestId('write-retry')).toBeVisible();
  await signedIn.unroute('**/api/transactions');
  await signedIn.getByTestId('write-retry').click();
  await expect(signedIn.getByRole('region', { name: 'Unresolved financial action' })).toBeHidden();
});

test('support_control: two deliberate subscription payments have distinct keys and expenses', async ({ signedIn, api, request, user }) => {
  const upcoming = new UpcomingPage(signedIn);
  const schedule = await api.addSchedule({ name: 'Two monthly payments', amount_cents: 900,
    day_of_month: 12, starts_on: '2026-01-01' });
  const keys = [];
  await signedIn.route(`**/api/schedules/${schedule.id}/pay`, async route => {
    keys.push(route.request().headers()['idempotency-key']);
    return route.continue();
  });
  await upcoming.goToUpcoming();
  await upcoming.pay(schedule.id);
  await expect.poll(async () => (await api.schedules()).find(row => row.id === schedule.id).paid_count).toBe(1);
  await upcoming.pay(schedule.id);
  await expect.poll(async () => (await api.schedules()).find(row => row.id === schedule.id).paid_count).toBe(2);
  const rows = await (await request.get('/api/transactions?limit=20', {
    headers: { Authorization: `Bearer ${user.token}` },
  })).json();
  expect(rows.items.filter(item => item.schedule_id === schedule.id)).toHaveLength(2);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[0-9a-f-]{8,64}$/);
  expect(keys[1]).not.toBe(keys[0]);
});

test('support_control: storage failure and malformed success never become an unkeyed write', async ({ signedIn, api }) => {
  const add = new AddPage(signedIn);
  const [category] = await api.categories();
  await add.enterAmount('500');
  await add.tileById(category.id).click();
  let posts = 0;
  await signedIn.route('**/api/transactions', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    posts += 1;
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
  await signedIn.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('wallet_write_pending_')) throw new Error('synthetic quota refusal');
      return original.call(this, key, value);
    };
  });
  await add.save.click();
  expect(posts).toBe(0);
  await expect(add.toastError).toContainText('cannot safely keep');
  await signedIn.reload();
  await add.enterAmount('500');
  await add.tileById(category.id).click();
  await add.save.click();
  await expect(signedIn.getByTestId('write-retry')).toBeVisible();
  expect(posts).toBe(1);
  await expect(add.toastSuccess).toBeHidden();
});

test('support_control: old busy cleanup cannot enable a newer account save', async ({ signedIn, request, api }) => {
  const add = new AddPage(signedIn);
  const auth = new AuthPage(signedIn);
  const [oldCategory] = await api.categories();
  const email = `busy-next-${Date.now()}@wallet.test`;
  const password = 'synthetic-busy-next-password';
  const created = await request.post('/api/auth/register', { data: { email, password } });
  expect(created.status()).toBe(201);
  const { token } = await created.json();
  const newCategories = await (await request.get('/api/categories', {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  await signedIn.evaluate(() => {
    window.__oldBusyConsumed = false;
    const nativeFetch = window.fetch.bind(window);
    let firstPost = true;
    window.fetch = async (...args) => {
      const old = firstPost && String(args[0]).includes('/api/transactions') && args[1]?.method === 'POST';
      if (old) firstPost = false;
      const response = await nativeFetch(...args);
      if (old) {
        const originalJson = response.json.bind(response);
        response.json = async () => {
          const value = await originalJson();
          requestAnimationFrame(() => { window.__oldBusyConsumed = true; });
          return value;
        };
      }
      return response;
    };
  });
  let releaseOld, releaseNew, seenOld, seenNew;
  const oldHeld = new Promise(resolve => { releaseOld = resolve; });
  const newHeld = new Promise(resolve => { releaseNew = resolve; });
  const oldObserved = new Promise(resolve => { seenOld = resolve; });
  const newObserved = new Promise(resolve => { seenNew = resolve; });
  let posts = 0;
  await signedIn.route('**/api/transactions', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    posts += 1;
    if (posts === 1) {
      const response = await route.fetch();
      seenOld();
      await oldHeld;
      return route.fulfill({ response });
    }
    seenNew();
    await newHeld;
    return route.continue();
  });
  await signedIn.route(/\/api\/schedules\?active=1$/, route => route.fulfill({ status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Synthetic session end' } }),
  }));
  try {
    await add.enterAmount('1100');
    await add.tileById(oldCategory.id).click();
    await add.save.click();
    await oldObserved;
    await add.goToUpcoming();
    await expect(auth.submit).toBeVisible();
    await auth.signIn(email, password);
    await add.enterAmount('2200');
    await add.tileById(newCategories[0].id).click();
    await add.save.click();
    await expect.poll(() => posts, { timeout: 3000,
      message: 'new account Save must issue its own POST before old response is released' }).toBe(2);
    await newObserved;
    await expect(add.save).toBeDisabled();
    releaseOld();
    await signedIn.waitForFunction(() => window.__oldBusyConsumed === true);
    await expect(add.save).toBeDisabled();
  } finally { releaseOld(); releaseNew(); }
  await expect(add.save).toBeEnabled();
});

test('support_control: committed Save with a stalled JSON body becomes uncertain at the finite deadline', async ({ signedIn, api, request, user }) => {
  const add = new AddPage(signedIn);
  const [category] = await api.categories();
  await signedIn.evaluate(() => {
    window.__writeBodyHeld = false;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      if (String(args[0]).includes('/api/transactions') && args[1]?.method === 'POST') {
        response.json = () => {
          window.__writeBodyHeld = true;
          return new Promise(() => {}); // Headers arrived; body never settles.
        };
      }
      return response;
    };
  });
  await add.enterAmount('730');
  await add.tileById(category.id).click();
  await add.save.click();
  await signedIn.waitForFunction(() => window.__writeBodyHeld === true);
  const bodyHeldAt = Date.now();
  await expect(add.toastError).toContainText('result is unknown', { timeout: 13000 });
  expect(Date.now() - bodyHeldAt, 'the body deadline must not be treated as an immediate parse failure')
    .toBeGreaterThanOrEqual(9000);
  await expect(signedIn.getByTestId('write-retry')).toBeEnabled();
  const rows = await (await request.get('/api/transactions?limit=20', {
    headers: { Authorization: `Bearer ${user.token}` },
  })).json();
  expect(rows.items).toHaveLength(1);
  await expect(add.toastSuccess).toBeHidden();
});

test('support_control: malformed stored recovery blocks a new financial write without deleting evidence', async ({ signedIn, api }) => {
  const add = new AddPage(signedIn);
  const [category] = await api.categories();
  const key = await signedIn.evaluate(() => {
    const payload = JSON.parse(atob(localStorage.getItem('wallet_token').split('.')[1]));
    const storageKey = `wallet_write_pending_${payload.sub}_malformed-record`;
    localStorage.setItem(storageKey, '{not JSON');
    return storageKey;
  });
  await signedIn.reload();
  await expect(signedIn.getByRole('region', { name: 'Unresolved financial action' })).toContainText('cannot be read');
  let posts = 0;
  await signedIn.route('**/api/transactions', async route => {
    if (route.request().method() === 'POST') posts += 1;
    return route.continue();
  });
  await add.enterAmount('800');
  await add.tileById(category.id).click();
  await add.save.click();
  expect(posts).toBe(0);
  expect(await signedIn.evaluate(k => localStorage.getItem(k), key)).toBe('{not JSON');
});
