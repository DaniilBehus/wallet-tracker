'use strict';

// One ordered task inventory for local verification and the six CI job groups.
// These are established offline runners. k6 and live-model evaluation are
// measured/authorized work outside the enforced CI plan.
const node = (id, ...args) => ({ id, executable: 'node', args });
const GROUPS = Object.freeze({
  secrets: [
    { id: 'history-secret-scan', executable: 'gitleaks',
      args: ['detect', '--source', '.', '--redact', '--verbose', '--exit-code', '1'] },
  ],
  api: [
    node('verify-controls', '--test', 'qa/verify/verify-ci.test.js', 'qa/e2e-controls/run.test.js', 'qa/runtime/runtime.test.js'),
    node('f13-traceability', 'scripts/traceability.js'),
    node('api-source-inventory', 'scripts/postman-api-inventory.js', '--check'),
    node('all-test-source-inventory', 'scripts/test-source-inventory.js', '--check'),
    node('source-inventory-controls', '--test',
      'qa/gates/traceability.test.js', 'qa/gates/postman-inventory.test.js',
      'qa/gates/postman-token-inventory.test.js',
      'qa/gates/postman-categories-inventory.test.js',
      'qa/gates/postman-transactions-inventory.test.js',
      'qa/gates/postman-api-inventory.test.js', 'qa/gates/login-oracle-controls.test.js',
      'qa/gates/test-source-inventory.test.js'),
    node('gates', '--test', 'qa/gates/validator-controls.test.js'),
    node('dates', '--test', 'qa/dates/date-boundaries.test.js'),
    node('check', 'scripts/check.js'),
    node('openapi', 'scripts/check-openapi.js'),
    node('contract', '--test', 'qa/contract/contract.test.js'),
    node('db', '--test', 'qa/db/migration.test.js'),
    node('import', '--require', './qa/ai/support/no-network.js', '--test',
      'qa/import/synthetic-import.test.js', 'qa/import/provider-adapter.test.js'),
    // Deliberately no npm test:api: that package command loads .env.
    { ...node('newman', 'qa/api/run.js'),
      artifacts: ['qa/reports/api-report.html', 'qa/reports/api-junit.xml'] },
    { ...node('race', 'qa/race/run.js'), artifacts: ['qa/reports/race-summary.json'] },
  ],
  python: [{ ...node('python-api', 'qa/python/run.js'),
    artifacts: ['qa/reports/python-junit.xml'] }],
  e2e: [
    node('playwright', 'qa/e2e-runner/run.js'),
    node('accessibility', 'node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.a11y.config.js'),
  ],
  selenium: [node('selenium', 'qa/selenium/run.js')],
  ai: [
    node('ai-offline', 'qa/ai/run.js'),
    node('ai-fixture', 'qa/ai/evaluate.js'),
    node('ai-browser', 'node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.ai.config.js'),
  ],
});

const ALL_GROUPS = Object.freeze(Object.keys(GROUPS));
module.exports = { GROUPS, ALL_GROUPS };
