'use strict';

/**
 * WCAG 2.1 contrast ratio, for the BUG-001 regression.
 *
 * BUG-001 was white text on a white background: the label was in the DOM, the
 * element was visible, and every assertion of the "is it there" kind passed
 * while the button was invisible to a human. The only thing that catches that
 * is reading the colours the browser actually resolved and doing the arithmetic
 * — which is why this file exists rather than a `toBeVisible()`.
 */

/** "rgb(61, 90, 254)" or "rgba(0, 0, 0, 0)" -> { r, g, b, a }. */
function parseRgb(value) {
  const parts = String(value).match(/[\d.]+/g);
  if (!parts || parts.length < 3) {
    throw new Error(`not a colour this can read: ${value}`);
  }
  return {
    r: Number(parts[0]),
    g: Number(parts[1]),
    b: Number(parts[2]),
    a: parts.length > 3 ? Number(parts[3]) : 1,
  };
}

/** One channel, 0-255, linearised per the sRGB transfer function. */
function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 1 (identical) to 21 (black on white). WCAG AA wants 4.5 for body text. */
function contrastRatio(foreground, background) {
  const a = relativeLuminance(parseRgb(foreground));
  const b = relativeLuminance(parseRgb(background));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

module.exports = { parseRgb, relativeLuminance, contrastRatio };
