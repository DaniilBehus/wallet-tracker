'use strict';

// Focused source/VM control for the six known Login nodes only. This is not a
// general Postman interpreter or a substitute for the real Newman run.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const collection = JSON.parse(fs.readFileSync(path.join(__dirname,
  '../api/wallet.postman_collection.json'), 'utf8'));
const login = collection.item.find(folder => folder.name === '09 · Login rate limiting');
const item = name => login.item.find(request => request.name === name);
const seed = item('Wait out the window, then fail once → 401');
const blocked = item('The correct password while blocked → still 429');
const afterExpiry = item('After the window expires, the block lifts by itself');
const reset = item('A successful login clears the counter');
const script = request => request.event.find(event => event.listen === 'test').script.exec.join('\n');

function probe({ clearOnSuccess = true, mainEmail = 'registered@wallet.test',
  elapsed = 100, windowMs = 12000 } = {}) {
  const failures = [];
  const sent = [];
  const values = new Map([
    ['emailA', 'registered@wallet.test'], ['rlEmail', 'registered@wallet.test'],
    ['password', 'fixture-password'],
    ['rlResetSeedStart', '100000'],
  ]);
  const counters = new Map([['registered@wallet.test', 1], ['ip', 1]]);
  if (clearOnSuccess) {
    counters.delete(mainEmail);
    counters.delete('ip');
  }
  const clock = 100000 + elapsed;
  const fakeDate = class extends Date { static now() { return clock; } };
  const pm = {
    collectionVariables: { get: key => values.get(key), set: (key, value) => values.set(key, value) },
    variables: {
      get: key => ({ loginMaxFailures: 5, loginWindowMs: windowMs, baseUrl: 'http://localhost:unused' })[key],
      replaceIn: raw => raw.replace(/{{(.*?)}}/g, (_, key) => values.get(key)),
    },
    request: { body: { raw: JSON.stringify({ email: mainEmail, password: '{{password}}' }) } },
    response: { code: 200 },
    expect: actual => ({ to: { eql: expected => assert.equal(actual, expected),
      be: { below: expected => assert.ok(actual < expected),
        above: expected => assert.ok(actual > expected) } } }),
    test: (name, fn) => { try { fn(); } catch (error) { failures.push(`${name}: ${error.message}`); } },
    sendRequest: (request, callback) => {
      const body = JSON.parse(request.body.raw);
      sent.push(body.email);
      const previous = Math.max(counters.get(body.email) || 0, counters.get('ip') || 0);
      let code;
      if (previous >= 5) code = 429;
      else {
        code = 401;
        counters.set(body.email, (counters.get(body.email) || 0) + 1);
        counters.set('ip', (counters.get('ip') || 0) + 1);
      }
      callback(null, { code, json: () => ({ error: { code: code === 429 ? 'RATE_LIMITED' : 'UNAUTHORIZED' } }) });
    },
  };
  values.set('helpers', "function expectOk(code){pm.test('initial success',()=>pm.expect(pm.response.code).to.eql(code));}");
  vm.runInNewContext(script(reset), { pm, Date: fakeDate, JSON, Number, String }, { timeout: 1000 });
  return { failures, sent };
}

test('blocked correct-password request uses the already registered identity', () => {
  const setup = seed.event.find(event => event.listen === 'prerequest').script.exec.join('\n');
  assert.match(setup, /set\('rlEmail',\s*pm\.collectionVariables\.get\('emailA'\)\)/);
  assert.doesNotMatch(setup, /'rl-'\s*\+/);
  assert.match(blocked.request.body.raw, /"email": "{{rlEmail}}"/);
  assert.match(blocked.request.body.raw, /"password": "{{password}}"/);
  assert.match(afterExpiry.request.body.raw, /"email": "{{rlEmail}}"/);
});

test('reset source observes same-account failures after the successful login', () => {
  assert.match(reset.request.body.raw, /"email": "{{rlEmail}}"/);
  assert.match(script(reset), /pm\.sendRequest/);
  assert.match(script(reset), /loginMaxFailures/);
  assert.match(script(reset), /rlResetSeedStart/);
  assert.match(script(reset), /401/);
  assert.match(script(reset), /429/);
});

test('deterministic reset model passes, but the no-clear model fails', () => {
  const cleared = probe();
  assert.deepEqual(cleared.failures, []);
  assert.deepEqual(cleared.sent, Array(6).fill('registered@wallet.test'));
  const notCleared = probe({ clearOnSuccess: false });
  assert.ok(notCleared.failures.length > 0, 'old failure must be observable');
});

test('wrong-account success and expired observation window cannot prove reset', () => {
  assert.ok(probe({ mainEmail: 'other@wallet.test' }).failures.length > 0);
  assert.ok(probe({ elapsed: 12100 }).failures.length > 0);
});
