#!/usr/bin/env node
'use strict';

/*
 * Local demo of AI expense drafts without any AI service.
 *
 *   npm run ai:demo            http://localhost:3100 (or the next free port)
 *   AI_DEMO_PORT=4000 npm run ai:demo
 *
 * The real Wallet server, in demo mode, with a provider that answers only the
 * sentences in qa/ai/fixtures/demo-examples.json. Everything else is
 * DEMO_UNSUPPORTED. The database is qa/reports/ai-demo/demo.db — never
 * data/wallet.db — and the network guard is loaded, so nothing leaves the
 * machine. The page shows "Demo — sample responses, no AI service contacted".
 *
 * Environment is rebuilt here: OPENAI_* and WALLET_AI_* from the shell or .env
 * are ignored, so a configured key cannot turn the demo into a live run.
 */

require('./support/no-network');

const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
// AI_DEMO_DIR exists for the demo's own test, which must not share this folder.
const DEMO_DIR = process.env.AI_DEMO_DIR ? path.resolve(process.env.AI_DEMO_DIR) : path.join(ROOT, 'qa', 'reports', 'ai-demo');
const EXAMPLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'demo-examples.json'), 'utf8')).examples;

// Case matters: the answers quote the text, and the normaliser checks every
// quoted span against what was actually typed.
const key = (text) => String(text).normalize('NFC').trim();

/** The demo provider. `userJson` is what the service built for this user. */
function createDemoProvider(examples = EXAMPLES) {
  const byText = new Map(examples.map((e) => [key(e.text), e.answer]));
  return {
    name: 'demo',
    mode: 'demo',
    async extract({ text, userJson }) {
      const answer = byText.get(key(text));
      if (!answer) return { kind: 'demo_unsupported' };
      const { categories } = JSON.parse(userJson);
      const match = answer.category_name === null ? null : categories.find((c) => c.name === answer.category_name);
      const { category_name: _unused, ...rest } = answer;
      return { kind: 'output', output: { ...rest, category_ref: match ? match.ref : null } };
    },
  };
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

async function choosePort(preferred) {
  for (let port = preferred; port < preferred + 20; port++) {
    if (await portIsFree(port)) return port;
  }
  throw new Error(`no free port in ${preferred}-${preferred + 19}`);
}

async function main() {
  for (const name of Object.keys(process.env)) {
    if (/^(OPENAI_|WALLET_AI_)/i.test(name)) delete process.env[name];
  }
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  process.env.WALLET_AI_MODE = 'demo';
  // The pilot limits exist to cap spending on a paid service. The demo calls
  // none, so a person trying the examples is not stopped after three tries.
  // The limiter still runs; only its numbers are wider.
  process.env.WALLET_AI_GLOBAL_DAILY_CALLS = '10000';
  process.env.WALLET_AI_USER_DAILY_CALLS = '1000';
  process.env.WALLET_AI_USER_MINUTE_CALLS = '60';
  process.env.DB_PATH = path.join(DEMO_DIR, 'demo.db');
  if (!process.env.JWT_SECRET) {
    // A stable secret per demo folder, so a browser session survives a restart.
    const secretFile = path.join(DEMO_DIR, 'jwt-secret');
    if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'));
    process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
  }
  process.env.PORT = String(await choosePort(Number(process.env.AI_DEMO_PORT) || 3100));

  const { installProvider } = require(path.join(ROOT, 'src', 'ai', 'provider'));
  installProvider(createDemoProvider());

  console.log('');
  console.log('  Wallet AI DEMO — sample responses, no AI service contacted');
  console.log(`  Database: ${path.relative(ROOT, process.env.DB_PATH)} (synthetic; not data/wallet.db)`);
  console.log('  Type one of these exactly; anything else answers "not in the demo":');
  for (const e of EXAMPLES) console.log(`    [${e.language}] ${e.text}`);
  console.log('');
  require(path.join(ROOT, 'src', 'server.js'));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`ai:demo failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { createDemoProvider, EXAMPLES };
