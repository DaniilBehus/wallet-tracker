#!/usr/bin/env node
'use strict';

// CI-equivalent task inventory, not a claim that an incomplete local run passed.
// Only the explicit CI groups in verification-plan.js may be selected by CLI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { GROUPS, ALL_GROUPS } = require('./verification-plan');

const ROOT = path.join(__dirname, '..');
const EVIDENCE = path.join(ROOT, 'qa', 'reports', 'verification');

function parseArgs(args) {
  let plan = false;
  const selected = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan') plan = true;
    else if (args[i] === '--group') {
      const value = args[++i];
      if (value === undefined || value === '') throw new Error('empty group selection');
      if (!ALL_GROUPS.includes(value)) throw new Error(`unknown group: ${value}`);
      if (selected.includes(value)) throw new Error(`duplicate group: ${value}`);
      selected.push(value);
    } else throw new Error(`unknown option: ${args[i]}`);
  }
  return { plan, groups: selected.length ? ALL_GROUPS.filter(g => selected.includes(g)) : ALL_GROUPS };
}

function safeChildEnv(source = process.env) {
  const allowed = new Set([
    'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME',
    'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PYTHON', 'PYTHONUTF8',
    'LANG', 'LC_ALL', 'XDG_CACHE_HOME',
  ]);
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key.toUpperCase()) && typeof value === 'string') out[key] = value;
  }
  // CI affects Playwright retry/forbidOnly; never inherit provider or DB env.
  if (source.GITHUB_ACTIONS === 'true') out.CI = 'true';
  out.WALLET_AI_MODE = 'off';
  out.WALLET_AI_EVAL_LIVE = 'false';
  return out;
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'buffer', windowsHide: true });
  if (result.error || result.status !== 0 || result.signal) throw new Error('Git source identity unavailable');
  return result.stdout;
}

function sourceIdentity(root = ROOT) {
  const head = git(root, ['rev-parse', 'HEAD']).toString('utf8').trim();
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error('Git HEAD identity unavailable');
  const dirty = git(root, ['status', '--porcelain=v1', '-uall']).length > 0;
  const files = git(root, ['ls-files', '-co', '--exclude-standard', '-z'])
    .toString('utf8').split('\0').filter(Boolean).sort();
  const hash = crypto.createHash('sha256');
  for (const rel of files) {
    const file = path.join(root, rel);
    const stat = fs.lstatSync(file);
    hash.update(rel).update('\0');
    if (stat.isSymbolicLink()) hash.update(fs.readlinkSync(file));
    else if (stat.isFile()) hash.update(fs.readFileSync(file));
    else throw new Error('Source identity includes unsupported file type');
    hash.update('\0');
  }
  return { head, dirty, fingerprint: hash.digest('hex'), fileCount: files.length };
}

function artifactState(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  if (!stat.isFile()) return null;
  return { size: stat.size, mtime: stat.mtimeMs,
    hash: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
}

function unsafeArtifact(body) {
  const text = body.toString('utf8');
  return /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(text) ||
    /\bBearer\s+[A-Za-z0-9._~-]{24,}/i.test(text) ||
    /\b(?:OPENAI_API_KEY|QASE_API_TOKEN|GITHUB_TOKEN|JWT_SECRET)\s*[:=]\s*\S+/i.test(text) ||
    /[A-Za-z]:\\Users\\/i.test(text) ||
    /\b[A-Z0-9._%+-]+@(?!example\.(?:test|com)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
}

function stageArtifacts(task, before, root, runDir, passed) {
  const staged = [];
  for (const rel of task.artifacts || []) {
    const current = artifactState(root, rel);
    const prior = before.get(rel);
    const name = path.basename(rel);
    if (!current || (prior && current.size === prior.size &&
      current.mtime === prior.mtime && current.hash === prior.hash)) {
      staged.push({ name, status: 'ABSENT' });
      continue;
    }
    const body = fs.readFileSync(path.join(root, rel));
    if (unsafeArtifact(body)) {
      staged.push({ name, status: 'WITHHELD_UNSAFE' });
      continue;
    }
    fs.writeFileSync(path.join(runDir, name), body, { flag: 'wx' });
    staged.push({ name, status: 'RETAINED' });
  }
  const evidenceFailure = staged.some(item => item.status === 'WITHHELD_UNSAFE' ||
    (passed && item.status === 'ABSENT'));
  return { staged, evidenceFailure };
}

function writeSummary(file, summary) {
  // This file starts at NOT_RUN. A failed later write cannot manufacture PASS.
  // Direct writes also work on restricted Windows temp volumes that deny rename.
  fs.writeFileSync(file, JSON.stringify(summary, null, 2) + '\n');
}

function runVerification({ groups, group, tasks, root = ROOT, evidenceRoot = EVIDENCE,
  identity, quiet = false, env = process.env } = {}) {
  const selected = tasks ? [{ group: group || 'fixture', tasks }] :
    (groups || ALL_GROUPS).map(name => ({ group: name, tasks: GROUPS[name] }));
  if (!selected.length || selected.some(item => !item.tasks || !item.tasks.length)) {
    throw new Error('empty or unknown verification group');
  }
  const source = identity || sourceIdentity(root);
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const runId = crypto.randomUUID();
  const runDir = path.join(evidenceRoot, runId);
  fs.mkdirSync(runDir);
  const summaryPath = path.join(runDir, 'summary.json');
  const summary = {
    schema: 1, runId, startedUtc: new Date().toISOString(),
    groups: selected.map(item => item.group),
    source,
    ci: /^\d+$/.test(env.GITHUB_RUN_ID || '') && /^\d+$/.test(env.GITHUB_RUN_ATTEMPT || '')
      ? { runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT } : null,
    verdict: 'NOT_RUN',
    tasks: selected.flatMap(item => item.tasks.map(task => ({
      group: item.group, id: task.id, status: 'NOT_RUN', exitCode: null, signal: null,
      artifacts: (task.artifacts || []).map(rel => ({ name: path.basename(rel), status: 'NOT_RUN' })),
    }))),
  };
  writeSummary(summaryPath, summary);
  let failed = false;
  let index = 0;
  const childEnv = safeChildEnv(env);
  for (const item of selected) {
    for (const task of item.tasks) {
      const record = summary.tasks[index++];
      if (failed) continue;
      const before = new Map((task.artifacts || []).map(rel => [rel, artifactState(root, rel)]));
      const executable = task.executable === 'node' ? process.execPath : task.executable;
      if (!quiet) console.log(`VERIFY ${item.group}/${task.id}`);
      const child = spawnSync(executable, task.args || [], {
        cwd: root, env: childEnv, stdio: quiet ? 'pipe' : 'inherit', windowsHide: true,
      });
      record.exitCode = Number.isInteger(child.status) ? child.status : null;
      record.signal = child.signal || null;
      record.status = child.error || child.signal || child.status !== 0 ? 'FAIL' : 'PASS';
      if (child.error) record.failure = 'SPAWN_ERROR';
      else if (child.signal) record.failure = 'SIGNALLED';
      else if (child.status !== 0) record.failure = 'NONZERO_EXIT';
      try {
        const evidence = stageArtifacts(task, before, root, runDir, record.status === 'PASS');
        record.artifacts = evidence.staged;
        if (evidence.evidenceFailure) {
          record.status = 'FAIL';
          record.failure = 'ARTIFACT_MISSING_OR_UNSAFE';
        }
      } catch {
        record.status = 'FAIL';
        record.failure = 'ARTIFACT_WRITE_FAILED';
      }
      if (record.status === 'FAIL') failed = true;
      summary.verdict = failed ? 'FAIL' : 'IN_PROGRESS';
      writeSummary(summaryPath, summary);
    }
  }
  summary.verdict = failed ? 'FAIL' : 'PASS';
  summary.finishedUtc = new Date().toISOString();
  writeSummary(summaryPath, summary);
  if (!quiet) {
    for (const record of summary.tasks) {
      for (const artifact of record.artifacts) {
        if (artifact.status === 'ABSENT' || artifact.status === 'NOT_RUN') {
          console.warn(`VERIFY WARNING ${record.group}/${record.id}: ${artifact.name} ${artifact.status}`);
        }
      }
    }
  }
  if (!quiet) console.log(`VERIFY ${summary.verdict}: ${path.relative(root, summaryPath)}`);
  return { exitCode: failed ? 1 : 0, summary, summaryPath };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.plan) {
      const plan = options.groups.flatMap(group => GROUPS[group].map(task =>
        ({ group, task: task.id, status: 'NOT_RUN' })));
      console.log(JSON.stringify({ mode: 'PLAN', verdict: 'NOT_RUN', tasks: plan }, null, 2));
      return;
    }
    process.exitCode = runVerification({ groups: options.groups }).exitCode;
  } catch {
    console.error('VERIFY FAIL: invalid selection, source identity or evidence write unavailable');
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { parseArgs, safeChildEnv, sourceIdentity, runVerification, unsafeArtifact };
