'use strict';

const { test, expect } = require('./fixtures/wallet');
const { AddPage } = require('./pages/add.page');
const { MonthPage } = require('./pages/month.page');

test('synthetic import shows a read-only preview and saves only after Confirm', async ({ signedIn, request, user }) => {
  const add = new AddPage(signedIn);
  const month = new MonthPage(signedIn);
  const count = async () => {
    const response = await request.get('/api/transactions?from=1900-01-01&to=2100-01-01', {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).total;
  };

  expect(await count()).toBe(0);
  await add.importOpen.click();
  await expect(add.importDialog).toBeVisible();
  await expect(add.importConfirm).toBeDisabled();
  await add.importPreview.click();
  await expect(add.importReview).toContainText('€35.00');
  await expect(add.importReview).toContainText('Nothing saved by preview.');
  expect(await count()).toBe(0);
  await add.importConfirm.click();
  await expect(add.importDialog).not.toBeVisible();
  expect(await count()).toBe(1);
  await add.goToMonth();
  await expect(month.rows).toHaveCount(1);
  await expect(month.rows.first()).toContainText('Synthetic demo expense');
});

test('a lost confirm response reloads the same pending synthetic ID, without a duplicate', async ({ signedIn, request, user }) => {
  const add = new AddPage(signedIn);
  await add.importOpen.click();
  await add.importPreview.click();
  await expect(add.importConfirm).toBeEnabled();

  await signedIn.route('**/api/imports/confirm', async route => {
    await route.fetch(); // the server commits; only its response is withheld
    await route.abort('failed');
  }, { times: 1 });
  await add.importConfirm.click();
  await expect(add.importError).toContainText('not confirmed');

  await signedIn.reload();
  await add.importOpen.click();
  await add.importPreview.click();
  await expect(add.importReview).toContainText('already imported');
  await add.importConfirm.click();
  await expect(add.importDialog).not.toBeVisible();

  const response = await request.get('/api/transactions?from=1900-01-01&to=2100-01-01', {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).total).toBe(1);
});

test('a second account on the same browser does not inherit the first pending sample', async ({ signedIn, request, user }) => {
  const add = new AddPage(signedIn);
  await add.importOpen.click();
  await add.importCancel.click();
  const first = await signedIn.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('wallet_synthetic_import_pending_'))
    .map(key => JSON.parse(localStorage.getItem(key)).records[0].external_id));
  expect(first).toHaveLength(1);

  const secondAccount = await request.post('/api/auth/register', {
    data: { email: `synthetic-second-${Date.now()}@wallet.test`, password: 'synthetic-test-password' },
  });
  expect(secondAccount.status()).toBe(201);
  const { token: secondToken } = await secondAccount.json();
  // The signedIn fixture deliberately reinstalls A's token on every reload.
  // A second page in the same browser context shares storage without that
  // init script, so this really exercises a switch to account B.
  const otherPage = await signedIn.context().newPage();
  await otherPage.goto('/');
  await otherPage.evaluate(token => localStorage.setItem('wallet_token', token), secondToken);
  await otherPage.reload();
  const otherAdd = new AddPage(otherPage);
  await otherAdd.importOpen.click();
  const both = await otherPage.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('wallet_synthetic_import_pending_'))
    .map(key => JSON.parse(localStorage.getItem(key)).records[0].external_id));
  expect(both).toHaveLength(2);
  expect(new Set(both).size).toBe(2);
  await otherAdd.importCancel.click();

  await otherPage.evaluate(token => localStorage.setItem('wallet_token', token), user.token);
  await otherPage.reload();
  await otherAdd.importOpen.click();
  const original = await otherPage.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('wallet_synthetic_import_pending_'))
    .map(key => JSON.parse(localStorage.getItem(key)).records[0].external_id));
  expect(original).toContain(first[0]);
  await otherPage.close();
});
