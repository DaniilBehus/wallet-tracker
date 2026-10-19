'use strict';

// Capture the real production bootstrap call without importing its DB, routes,
// server or environment. No socket, account, provider or .env is opened here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');

function captureListen(env) {
  const calls = [], banners = [];
  const app = {
    use() {}, get() {}, post() {},
    listen(...args) {
      calls.push(args);
      if (typeof args.at(-1) === 'function') args.at(-1)();
      return {};
    },
  };
  const express = () => app;
  express.json = () => () => {};
  express.static = () => () => {};
  const fakeRequire = id => {
    if (id === 'path') return path;
    if (id === 'express') return express;
    if (id === './db') return { db: {} };
    if (id === './auth') return { register() {}, login() {}, requireAuth() {} };
    if (id === './validate') return { ApiError: class ApiError {}, badRequest() {}, notFound() {} };
    if (id === './ratelimit') return { check() {}, clear() {}, recordFailure() {} };
    if (id === './requestlog') return { requestContext() {}, rememberMount() {}, logUnhandled() {} };
    if (id.startsWith('./routes/')) return () => {};
    throw new Error(`unreviewed bootstrap import ${id}`);
  };
  vm.runInNewContext(source, {
    require: fakeRequire, module: { exports: {} }, __dirname: path.join(ROOT, 'src'),
    process: { env: { PORT: '4312', ...env } }, console: { log: message => banners.push(message) },
  }, { filename: 'src/server.js', timeout: 1000 });
  assert.equal(calls.length, 1);
  return { args: calls[0], banner: banners[0] };
}

test('default and empty WALLET_HOST bind IPv4 loopback, generic HOST is ignored', () => {
  for (const env of [{}, { HOST: '0.0.0.0' }, { WALLET_HOST: '' },
    { WALLET_HOST: '   ', HOST: '0.0.0.0' }]) {
    const { args, banner } = captureListen(env);
    assert.equal(args[0], 4312);
    assert.equal(args[1], '127.0.0.1');
    assert.equal(typeof args[2], 'function');
    assert.equal(banner, 'wallet 1.0.0 listening on http://127.0.0.1:4312');
  }
});

test('explicit WALLET_HOST selects the reported listener; IPv6 URL is bracketed', () => {
  for (const [host, url] of [['0.0.0.0', 'http://0.0.0.0:4312'],
    ['::1', 'http://[::1]:4312']]) {
    const { args, banner } = captureListen({ WALLET_HOST: host, HOST: '127.0.0.1' });
    assert.equal(args[1], host);
    assert.equal(banner, `wallet 1.0.0 listening on ${url}`);
  }
});
