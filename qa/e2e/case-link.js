'use strict';

// Links a Playwright test to its local test case in qa/docs/test-cases.md.
// The id becomes native Playwright metadata (an annotation), shown in the HTML
// report. An id the catalogue does not list fails at load time, so a typo can
// never produce a test that looks traced but is not.
const fs = require('fs');
const path = require('path');

const CATALOGUE = path.join(__dirname, '..', 'docs', 'test-cases.md');
const ids = new Set(fs.readFileSync(CATALOGUE, 'utf8').match(/\bTC-[A-Z0-9]+-\d{3}\b/g) || []);

function testCase(localId) {
  if (!ids.has(localId)) {
    throw new Error(`${localId} is not listed in qa/docs/test-cases.md`);
  }
  return { annotation: { type: 'TestCase', description: localId } };
}

module.exports = { testCase };
