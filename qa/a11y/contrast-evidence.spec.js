'use strict';

const { test, expect } = require('../e2e/fixtures/wallet');
const { AddPage } = require('../e2e/pages/add.page');
const { MonthPage } = require('../e2e/pages/month.page');
const { AiExpensePage } = require('../e2e/pages/ai-expense.page');

// WCAG 2.2 definitions: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
// and https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio .
function opaqueRgb(value) {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value);
  if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) {
    throw new Error(`not an opaque sRGB colour: ${value}`);
  }
  return match.slice(1, 4).map(Number);
}

function luminance(value) {
  const [r, g, b] = opaqueRgb(value).map(channel => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function solidPair(locator, backgroundSource, label) {
  const style = await locator.evaluate((element, source) => {
    const text = getComputedStyle(element);
    const surface = getComputedStyle(source === 'parent' ? element.parentElement : element);
    return {
      foreground: text.color,
      foregroundOpacity: text.opacity,
      background: surface.backgroundColor,
      backgroundImage: surface.backgroundImage,
      backgroundOpacity: surface.opacity,
    };
  }, backgroundSource);
  expect(style.backgroundImage, `${label}: no background image on measured surface`).toBe('none');
  expect(style.foregroundOpacity, `${label}: opaque foreground`).toBe('1');
  expect(style.backgroundOpacity, `${label}: opaque surface`).toBe('1');
  const measured = ratio(style.foreground, style.background);
  expect(measured, `${label}: computed solid rendered pair`).toBeGreaterThanOrEqual(4.5);
  return { target: label, ...style, ratio: Number(measured.toFixed(2)), minimum: 4.5 };
}

async function picture(page, testInfo, state) {
  const path = testInfo.outputPath(`${state}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`${state}-rendered.png`, { path, contentType: 'image/png' });
}

test('bounded rendered contrast evidence on known surfaces and unresolved art', async ({ page, user, api }, testInfo) => {
  expect(ratio('rgb(0, 0, 0)', 'rgb(255, 255, 255)')).toBeCloseTo(21, 5);
  expect(ratio('rgb(12, 36, 35)', 'rgb(12, 36, 35)')).toBeCloseTo(1, 5);

  await page.goto('/');
  await expect(page.getByTestId('auth-submit')).toBeVisible();
  await page.getByTestId('auth-email').fill('sample@wallet.test');
  await page.getByTestId('auth-password').fill('synthetic-only');
  const known = [
    await solidPair(page.getByTestId('auth-email'), 'self', 'auth-email text/input surface'),
    await solidPair(page.getByTestId('auth-password'), 'self', 'auth-password text/input surface'),
  ];
  const authBackdrop = await page.getByRole('heading', { name: 'Wallet' }).evaluate(element => {
    const pseudo = getComputedStyle(element.closest('.auth'), '::before');
    return { pseudoBackground: pseudo.backgroundColor, pseudoImage: pseudo.backgroundImage };
  });
  await picture(page, testInfo, 'auth');

  await page.addInitScript(token => window.localStorage.setItem('wallet_token', token), user.token);
  await page.reload();
  const add = new AddPage(page);
  const month = new MonthPage(page);
  const ai = new AiExpensePage(page);
  await expect(add.tile('Groceries')).toBeVisible();
  const addSurface = await add.amount.evaluate(element => {
    const header = getComputedStyle(element.parentElement);
    return { backgroundColor: header.backgroundColor, backgroundImage: header.backgroundImage };
  });
  await picture(page, testInfo, 'add');

  const [category] = await api.categories();
  await api.setCategoryLimit(category.id, 2000);
  const transaction = await api.addExpense({ amount_cents: 1250, category_id: category.id });
  await month.goToMonth();
  await expect(month.row(transaction.id)).toBeVisible();
  const monthSurface = await month.head.evaluate(element => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage };
  });
  const navSurface = await month.navMonth.evaluate(element => {
    const style = getComputedStyle(element.parentElement);
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage };
  });
  await picture(page, testInfo, 'month');

  await month.goToAdd();
  await ai.openButton.click();
  await expect(ai.demoBanner).toBeVisible();
  known.push(await solidPair(ai.close, 'parent', 'ai-close glyph/solid header'));
  known.push(await solidPair(ai.demoBanner, 'self', 'ai-demo banner text/surface'));
  await ai.exampleEn.click();
  await ai.suggest.click();
  await expect(ai.reviewForm).toBeVisible();
  await picture(page, testInfo, 'ai-review');

  const unresolved = [
    { target: 'auth text over pseudo-element', observed: authBackdrop, reason: 'pseudo-element composition requires pixel-level verification' },
    { target: 'Add amount over hero', observed: addSurface, reason: 'gradient varies under the text' },
    { target: 'Month figures and donut', observed: monthSurface, reason: 'gradient/overlap varies behind SVG text' },
    { target: 'bottom navigation labels', observed: navSurface, reason: 'translucent surface over variable content' },
  ];
  await testInfo.attach('rendered-contrast-evidence.json', {
    body: JSON.stringify({ project: testInfo.project.name, viewport: page.viewportSize(), known, unresolved }, null, 2),
    contentType: 'application/json',
  });
  console.log(`CONTRAST ${testInfo.project.name} known=${known.map(item => `${item.target}:${item.ratio}`).join(',')} unresolved=${unresolved.length}`);
});
