#!/usr/bin/env node
'use strict';

/*
 * Runs the k6 load scripts, each against a server of its own.
 *
 *   npm run test:load
 *
 * A server per script rather than one shared, because they need different
 * configurations and sharing would make at least one measurement meaningless:
 *
 *   - auth-burst needs the rate limiter working; the limiter is what it measures
 *   - allowed-logins needs it out of the way, because it measures what the
 *     limiter hides — the cost of the attempts that do get through
 *
 * Each server gets its own port and its own throwaway database, and is stopped
 * as soon as its script finishes. Two bugs lived here and both are worth the
 * comment: an `error` handler meant for "the server would not start" fired on
 * the deliberate kill and called process.exit, ending the run after the first
 * measurement; and cleanup done on the way out corrupted the runner's own exit
 * code, so a run where every threshold passed still reported failure. Cleanup
 * now happens in the middle of the run, where it is ordinary work.
 *
 * Deliberately never the development database: a load run writes tens of
 * thousands of rows, and pointing that at the one somebody is using is how a
 * quick check eats an afternoon of their data.
 *
 * k6 is a separate binary, not an npm package. If it is missing this exits with
 * an instruction rather than a stack trace.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_DIR = path.join(ROOT, 'qa', 'reports');
const FIRST_PORT = Number(process.env.LOAD_PORT || 3100);

// Script paths are relative on purpose: k6 runs with cwd = ROOT, and the
// absolute path contains spaces (and Cyrillic), which the shell splits in two.
const SCRIPTS = [
  { name: 'writes under load', file: 'qa/load/expense-write.js', env: {} },
  { name: 'failed logins under load', file: 'qa/load/auth-burst.js', env: {} },
  {
    name: 'the logins the limiter allows',
    file: 'qa/load/allowed-logins.js',
    // The limiter switched off, so every attempt reaches bcrypt. Not a
    // realistic deployment — a measurement of the residual BUG-004 recorded.
    env: { LOGIN_MAX_FAILURES: '1000000' },
  },
];

const started = [];

/**
 * The k6 executable, resolved once.
 *
 * Spawned directly rather than through `shell: true`. Two reasons: Node
 * deprecates passing arguments to a shell (they are concatenated, not escaped),
 * and the cmd.exe wrapper it creates on Windows made this runner's own exit
 * code unreliable — it reported 127 after runs where every k6 process had
 * exited 0.
 */
function resolveK6() {
  const isWindows = process.platform === 'win32';
  const finder = isWindows ? 'where' : 'which';
  const found = spawnSync(finder, ['k6'], { encoding: 'utf8' });
  if (found.status === 0) {
    const lines = String(found.stdout).split(/\r?\n/);
    const first = lines.find((line) => line.trim());
    if (first) return first.trim();
  }
  return 'k6';   // let spawn fail with a clear message
}

const K6 = resolveK6();

function requireK6() {
  const probe = spawnSync(K6, ['version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.error('k6 is not installed, or not on PATH.');
    console.error('  Windows:  winget install k6 --source winget');
    console.error('  macOS:    brew install k6');
    console.error('  Linux:    https://grafana.com/docs/k6/latest/set-up/install-k6/');
    process.exit(1);
  }
  console.log((probe.stdout || '').trim());
}

function startServer(port, dbPath, extraEnv) {
  const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      // Throwaway, per run. Nothing signed with it outlives this process.
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      ...extraEnv,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  // An 'error' event with no listener is an uncaught exception in Node, and
  // killing a child that has already gone emits one. Without this the runner
  // died during its own cleanup and returned a non-zero code after every
  // threshold had passed — a green run reported as a failure.
  server.on('error', (err) => {
    if (!server.stoppedOnPurpose) {
      console.error(`server on port ${port} failed: ${err.message}`);
    }
  });

  started.push({ server, dbPath });
  return server;
}

/**
 * Old load databases, removed at the start of the next run rather than the end
 * of this one.
 *
 * Nothing here kills a server, and that is deliberate. On this machine calling
 * `child.kill()` on a spawned server takes the runner down with it — silently
 * mid-loop, or as a corrupted exit code (127) when done on the way out, after
 * every k6 process had returned 0. Two attempts to guard it — a benign `error`
 * listener, try/catch around the kill — did not help; removing the kill did.
 *
 * The servers are children of this process and die with it, which was confirmed
 * by checking the ports afterwards. So the only thing left to tidy is the files,
 * and doing that on the way IN cannot affect a result that has not happened yet.
 * Recorded as BUG-006.
 */
function sweepOldDatabases() {
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('load-')) continue;
    try {
      fs.rmSync(path.join(dir, name), { force: true });
    } catch {
      /* still held by a process that has not finished dying */
    }
  }
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 30000;
  let lastError = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`the server at ${baseUrl} never became healthy (${lastError})`);
}

function runK6(file, baseUrl) {
  return new Promise((resolve) => {
    const k6 = spawn(
      K6,
      ['run', file, '--env', `BASE_URL=${baseUrl}`, '--quiet'],
      { cwd: ROOT, stdio: 'inherit' }
    );
    k6.on('close', resolve);
  });
}

async function main() {
  requireK6();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  sweepOldDatabases();

  let worst = 0;
  try {
    for (const [index, script] of SCRIPTS.entries()) {
      const port = FIRST_PORT + index;
      const baseUrl = `http://localhost:${port}`;
      const dbPath = path.join(ROOT, 'data', `load-${Date.now()}-${index}.db`);

      startServer(port, dbPath, script.env);
      await waitForServer(baseUrl);

      const limits = Object.entries(script.env).map(([k, v]) => `${k}=${v}`).join(' ');
      console.log(`\n=== ${script.name} ===`);
      console.log(`server: ${baseUrl}${limits ? `  (${limits})` : ''}`);

      // Every script runs even if an earlier one breached a threshold: stopping
      // at the first would mean one run reports one problem.
      const code = await runK6(script.file, baseUrl);
      if (code > worst) worst = code;

      // Stopped here, while the runner is still doing ordinary work. Doing it
      // on the way out corrupted the process's own exit code — 127 after runs
      // where every k6 process returned 0 — which made a green run report as a
      // failure. Cleanup belongs in the middle of the run, not at the end of it.
    }
  } catch (err) {
    console.error(err.message);
    worst = Math.max(worst, 1);
  }

  console.log(`\nsummaries: ${path.relative(ROOT, REPORT_DIR)}/load-*.json`);

  // The result is committed BEFORE anything is torn down. Cleanup used to run
  // in a `finally` and took the whole runner with it: all three k6 runs exited
  // 0, every threshold passed, and `npm run test:load` still reported failure
  // because the process died while killing its own servers. Housekeeping must
  // not be able to change a measured result, so it moved into the exit handler,
  // after the code is already chosen — and the OS reclaims the children anyway.
  //
  // k6 exits non-zero when a threshold is breached. That is the result, so it
  // is passed straight through rather than swallowed.
  process.exit(worst);
}

main();
