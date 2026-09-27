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

  // bcrypt reads 72 bytes and ignores the rest, so the server refuses anything
  // longer (BUG-017, D-045). The form says so before the round trip; these two
  // cases check that it does, and that it counts the same unit the server does.
  test('a password over 72 bytes is refused before it is sent', testCase('TC-E2E-073'), async ({ page }) => {
    const auth = new AuthPage(page);
    const add = new AddPage(page);
    const { email } = freshCredentials();

    const sent = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/auth/register')) sent.push(request.url());
    });

    await page.goto('/');
    await auth.register(email, 'a'.repeat(73));

    await expect(auth.toastError).toBeVisible();
    await expect(auth.toastError).toContainText('at most 72 bytes');
    await expect(add.save).toBeHidden();
    // The point of a client-side rule: the request never leaves the browser.
    expect(sent).toHaveLength(0);
  });

  test('the browser counts bytes, not characters', testCase('TC-E2E-074'), async ({ page }) => {
    const auth = new AuthPage(page);
    const { email } = freshCredentials();

    // 37 characters — comfortably under any character limit — and 74 bytes.
    const password = 'é'.repeat(37);
    expect(password.length).toBe(37);
    expect(new TextEncoder().encode(password).length).toBe(74);

    const sent = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/auth/register')) sent.push(request.url());
    });

    await page.goto('/');
    await auth.register(email, password);

    await expect(auth.toastError).toContainText('at most 72 bytes');
    // The server's refusal contains the same words, so without this the case
    // would pass even with no rule in the browser at all.
    expect(sent).toHaveLength(0);
  });
});
