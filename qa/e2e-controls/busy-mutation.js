'use strict';

const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..', '..', 'public', 'app.js');

function replaceExactlyOnce(source, oldText, newText) {
  const first = source.indexOf(oldText);
  if (first < 0 || source.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error('F22 busy mutation source did not match exactly once');
  }
  return source.replace(oldText, newText);
}

function mutateBusySource(source) {
  const busyStart = source.indexOf('async function withBusy(button, fn, busyLabel) {');
  const nextFunction = 'function renderAmount() {';
  const busyEnd = source.indexOf(nextFunction, busyStart + 1);
  if (busyStart < 0 || busyEnd < 0 ||
      source.indexOf(nextFunction, busyEnd + nextFunction.length) >= 0) {
    throw new Error('F22 withBusy boundary changed');
  }
  const disabled = source.slice(0, busyStart) +
    replaceExactlyOnce(source.slice(busyStart, busyEnd),
      'button.disabled = true;', 'button.disabled = false;') + source.slice(busyEnd);
  const saveStart = disabled.indexOf('async function saveExpense() {');
  const saveEnd = disabled.indexOf('async function ', saveStart + 1);
  if (saveStart < 0 || saveEnd < 0) throw new Error('F22 saveExpense boundary changed');
  const before = disabled.slice(0, saveStart);
  const body = disabled.slice(saveStart, saveEnd);
  const after = disabled.slice(saveEnd);
  return before + replaceExactlyOnce(body, 'if (state.busy) return;',
    '/* F22 negative witness: busy guard bypassed */') + after;
}

async function installBusyMutation(page) {
  const mutated = mutateBusySource(fs.readFileSync(APP, 'utf8'));
  await page.route('**/app.js', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: mutated,
  }));
}

module.exports = { mutateBusySource, installBusyMutation };
