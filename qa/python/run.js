#!/usr/bin/env node
'use strict';

/*
 * Runs the independent Python API layer.
 *
 * The server lifecycle is deliberately owned by qa/python/conftest.py: its
 * fixture creates a temporary database, port and secret, proves health, and
 * stops the child. Keeping the lifecycle beside the HTTP client means the
 * fixture is also exercised when pytest is invoked directly.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const REPORT = path.join(ROOT, 'qa', 'reports', 'python-junit.xml');

function localPython() {
  const bin = process.platform === 'win32'
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python');
  return fs.existsSync(bin) ? bin : null;
}

const python = process.env.PYTHON || localPython() || 'python';
fs.mkdirSync(path.dirname(REPORT), { recursive: true });

const child = spawn(
  python,
  ['-m', 'pytest', 'qa/python', '--junitxml', REPORT, ...process.argv.slice(2)],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PYTHONUTF8: '1' },
  }
);

child.once('error', (err) => {
  console.error(`could not start Python (${python}): ${err.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) console.error(`pytest stopped by ${signal}`);
  process.exitCode = code === 0 ? 0 : 1;
});
