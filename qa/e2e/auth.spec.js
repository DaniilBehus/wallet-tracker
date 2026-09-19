'use strict';

const { test, expect } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { AuthPage } = require('./pages/auth.page');
const { AddPage } = require('./pages/add.page');

/**
 * Registration and sign-in through the interface.
 *
 * This is the one file that does not use the `user` fixture: the thing under
 * test is the registration form itself, so creating the account through the API
 * first would test nothing.
 */

function freshCredentials() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return { email: `ui-${stamp}@wallet.test`, password: `ui-passphrase-${stamp}` };
}

test.describe('Authentication', () => {
  test('a new account can be created and lands on the Add screen', testCase('TC-E2E-001'), async ({ page }) => {
    const auth = new AuthPage(page);
    const add = new AddPage(page);
    const { email, password } = freshCredentials();

    await page.goto('/');
    await expect(auth.submit).toBeVisible();

    await auth.register(email, password);

    // The categories seeded at registration are what proves the account is
    // really set up, not merely that a screen swapped.
    await expect(add.save).toBeVisible();
    await expect(add.tile('Groceries')).toBeVisible();
    await expect(add.navMonth).toBeVisible();
  });

  test('an existing account can sign in again after signing out', testCase('TC-E2E-002'), async ({ page, context }) => {
    const auth = new AuthPage(page);
    const add = new AddPage(page);
    const { email, password } = freshCredentials();

    await page.goto('/');
    await auth.register(email, password);
    await expect(add.save).toBeVisible();

    // Signing out is dropping the stored session; the app has no button for it.
    await context.clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(auth.submit).toBeVisible();

    await auth.signIn(email, password);
    await expect(add.save).toBeVisible();
  });

  test('a wrong password is refused with a message and no session', testCase('TC-E2E-003'), async ({ page }) => {
    const auth = new AuthPage(page);
    const add = new AddPage(page);
    const { email, password } = freshCredentials();

    await page.goto('/');
    await auth.register(email, password);
    await expect(add.save).toBeVisible();

    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await auth.signIn(email, 'definitely-not-the-password');

    await expect(auth.toastError).toBeVisible();
    await expect(auth.toastError).toHaveText('E-mail or password is incorrect.');
    await expect(auth.submit).toBeVisible();          // still on the sign-in screen
    await expect(add.save).toBeHidden();
  });

  test('an empty form does not reach the server', testCase('TC-E2E-004'), async ({ page }) => {
    const auth = new AuthPage(page);

    await page.goto('/');
    await auth.submit.click();

    await expect(auth.toastError).toHaveText('Enter both an e-mail and a password');
  });

  test('a session in local storage opens the app directly', testCase('TC-E2E-005'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);

    await expect(add.save).toBeVisible();
    await expect(add.amount).toBeVisible();
  });
});
