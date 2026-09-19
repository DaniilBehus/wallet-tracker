'use strict';

const { test, expect } = require('../fixtures/wallet');
const { AddPage } = require('../pages/add.page');

/**
 * BUG-014 · Categories collapse to an 18 px strip on a short phone.
 *
 * Written before the fix and run red first. It lives in the AI suite because
 * the defect it guards is the Add screen the AI entry point sits on.
 *
 * "Usable" is stated as numbers a person would notice: at least two category
 * rows readable at once, the Save key reachable, and no sideways scrolling.
 */

const SHORT_PHONES = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
];

/** True when two bounding boxes share any area. */
const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const viewport of [...SHORT_PHONES, { width: 393, height: 727 }, { width: 1280, height: 800 }]) {
  test.describe(`The AI entry point at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    // Found in the first S23 screenshots: the button sat on top of €0.00.
    test('does not cover the amount', async ({ signedIn }) => {
      const add = new AddPage(signedIn);
      const openButton = signedIn.getByTestId('ai-open');
      await expect(openButton).toBeVisible();
      const button = await openButton.boundingBox();
      const amount = await add.amount.boundingBox();
      expect(overlaps(button, amount), `button ${JSON.stringify(button)} overlaps amount ${JSON.stringify(amount)}`).toBe(false);
    });
  });
}

for (const viewport of SHORT_PHONES) {
  test.describe(`Add on a ${viewport.width}x${viewport.height} screen`, () => {
    test.use({ viewport });

    test('BUG-014 · categories stay readable and Save stays reachable', async ({ signedIn }) => {
      const add = new AddPage(signedIn);
      await expect(add.tile('Groceries')).toBeVisible();

      const box = await add.categories.evaluate((node) => ({
        clientHeight: node.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(box.clientHeight, 'the category list is a strip again — BUG-014').toBeGreaterThanOrEqual(120);
      expect(box.scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(viewport.width);

      await expect(add.tile('Groceries')).toBeInViewport({ ratio: 1 });
      await expect(add.tile('Transport')).toBeInViewport({ ratio: 1 });

      // The whole two-tap flow still works on this screen.
      await add.enterAmount('1250');
      await add.tile('Transport').click();
      await add.save.scrollIntoViewIfNeeded();
      await expect(add.save).toBeInViewport({ ratio: 1 });
      await add.save.click();
      await expect(add.toastSuccess).toHaveText('Saved · €12.50');
    });
  });
}
