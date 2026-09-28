'use strict';

// QA-only boot seam; no .env load and no live-provider seam. The parent gives
// an allow-listed environment and a disposable DB. The real server/router/
// authentication/database code runs unchanged, with canned demo answers only.
require('../ai/support/no-network');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');

const mode = process.env.WALLET_AI_MODE;
assert.ok(mode === 'off' || mode === 'demo');
const database = path.resolve(process.env.DB_PATH);
const parent = path.dirname(database);
assert.equal(path.dirname(parent), path.resolve(os.tmpdir()), 'Only a direct disposable temp directory allowed');
assert.ok(path.basename(parent).startsWith('wallet-contract-'));

if (mode === 'demo') {
  const { createDemoProvider } = require('../ai/demo');
  const { installProvider } = require('../../src/ai/provider');
  installProvider(createDemoProvider());
}

// Production app.listen(PORT) has no host argument. Bind this test process to
// loopback only, without changing production source or choosing a real DB.
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function contractListen(port, callback) {
  assert.equal(port, Number(process.env.PORT));
  return listen.call(this, port, '127.0.0.1', callback);
};
require('../../src/server');
