'use strict';

require('../ai/support/no-network');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { ROOT, readDocument, sourceInventory, inventoryFromSources, assertInventory, validateDocument } = require('../../scripts/lib/openapi');
const { createAjv, createResponseValidator, ContractError } = require('./response-validator');
const { startServer, capture, localToday, isolatedEnv } = require('./support');

let document, validated, validator, off, demo, owner, other;
const observed = new Map(), captures = new Map(), tokens = [];
let requests = 0;
const PASSWORD = 'synthetic-contract-password-1';
const contractBytes = fs.readFileSync(path.join(ROOT, 'spec/openapi.json'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const safeBody = value => JSON.stringify(value);

async function call(server, method, route, expected, options = {}) {
  const key = validator.operationKey(method, new URL(route, server.baseUrl).pathname);
  const result = await capture(server, method, route, options);
  validator.validate(key, result, { replay: options.replay });
  assert.equal(result.status, expected, key + ': unexpected status (response values withheld)');
  if (options.code) assert.equal(result.body.error.code, options.code);
  if (!observed.has(key)) observed.set(key, new Set());
  observed.get(key).add(result.status); requests++;
  return result;
}

async function expectValidationProbe(method, route, options, failures, label) {
  const key = validator.operationKey(method, new URL(route, off.baseUrl).pathname);
  const result = await capture(off, method, route, auth(options));
  if (!observed.has(key)) observed.set(key, new Set());
  observed.get(key).add(result.status); requests++;
  if (result.status === 400) {
    validator.validate(key, result);
    assert.equal(result.body.error.code, 'VALIDATION_FAILED', `${label}: wrong error code`);
  } else {
    failures.push(`${label}: HTTP ${result.status}, expected 400`);
  }
}

async function user(server, label) {
  const email = `${label}-${crypto.randomUUID()}@wallet.test`;
  const created = await call(server, 'POST', '/api/auth/register', 201, { body: { email, password: PASSWORD, ignored: true } });
  const token = created.body.token; tokens.push(token);
  const categories = (await call(server, 'GET', '/api/categories', 200, { token })).body;
  return { email, token, categories };
}

function auth(extra = {}) { return { token: owner.token, ...extra }; }
function assertObservedSuccess(operations, matrix) {
  for (const operation of operations) {
    assert.ok(matrix.has(operation.key), 'Uncovered operation: ' + operation.key);
    assert.ok([...matrix.get(operation.key)].some(status => status >= 200 && status < 300), 'Operation lacks an observed success: ' + operation.key);
  }
}
function mustReject(key, actual, change, kind, keyword) {
  // Control applies ONLY to a copy of a real HTTP capture. Baseline must pass.
  validator.validate(key, actual);
  const hash = sha(safeBody(actual));
  const changed = structuredClone(actual);
  change(changed);
  const before = structuredClone(changed);
  assert.throws(() => validator.validate(key, changed), error => {
    assert.ok(error instanceof ContractError); assert.equal(error.kind, kind);
    if (keyword) assert.ok(error.errors.some(item => item.keyword === keyword));
    return true;
  });
  assert.deepEqual(changed, before, 'Negative control must not clean/mutate invalid capture');
  assert.equal(sha(safeBody(actual)), hash, 'Original capture unchanged');
  validator.validate(key, actual);
}

test.before(async () => {
  document = readDocument(); validated = await validateDocument(document);
  validator = createResponseValidator(validated.api);
  off = await startServer('off'); demo = await startServer('demo');
  owner = await user(off, 'owner'); other = await user(off, 'foreign');
});

test.after(async () => {
  try {
    if (off) await off.stop();
  } finally { if (demo) await demo.stop(); }
  assert.equal(sha(fs.readFileSync(path.join(ROOT, 'spec/openapi.json'))), sha(contractBytes), 'Saved contract unchanged by tests');
});

test('TC-CONTRACT-001: strict Ajv annotation, formats and non-mutating options', () => {
  const ajv = createAjv();
  assert.equal(ajv.opts.strict, true);
  for (const option of ['coerceTypes', 'useDefaults', 'removeAdditional']) assert.equal(ajv.opts[option], false);
  const check = ajv.compile({ type: 'object', additionalProperties: false, required: ['n'], properties: { n: { type: 'integer', default: 7, example: 1 } } });
  for (const value of [{ n: '1' }, {}, { n: 1, extra: true }]) {
    const before = structuredClone(value); assert.equal(check(value), false); assert.deepEqual(value, before);
  }
  assert.equal(check({ n: 1 }), true);
  assert.equal(ajv.compile({ type: 'string', format: 'date' })('2026-02-30'), false);
  assert.throws(() => ajv.compile({ type: 'integer', inventedValidationKeyword: true }), /unknown keyword/);
  const env = isolatedEnv({ WALLET_AI_MODE: 'off' });
  assert.ok(!Object.keys(env).some(key => /^(OPENAI_|GEMINI_|GOOGLE_)/.test(key)));
  assert.ok(!('NODE_OPTIONS' in env) && !('NODE_PATH' in env));
});

test('TC-CONTRACT-002: source scanner and inventory negative controls', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8');
  const reader = module => fs.readFileSync(path.join(ROOT, 'src', module + '.js'), 'utf8');
  const baseline = sourceInventory(); assertInventory(document, baseline);
  for (const declaration of [
    'app.use("/api/new", rememberMount, requireAuth, require("./routes/categories"));',
    'app.use(`/api/new`, rememberMount, requireAuth, require("./routes/categories"));',
    'app.use(routeVariable, requireAuth, require("./routes/categories"));',
    'app.all("/api/new", handler);', 'app.route("/api/new").get(handler);',
    'app.get(routeVariable, handler);', 'app[method]("/api/new", handler);',
    'app . get("/api/new", handler);',
    'app . use("/api/new", rememberMount, requireAuth, require("./routes/categories"));',
  ]) assert.throws(() => inventoryFromSources(source + '\n' + declaration, reader), /Unsupported|Unexpected public operation/);
  for (const declaration of ['router.all("/new", handler);', 'router.route("/new").get(handler);', 'router.get(routeVariable, handler);']) {
    assert.throws(() => inventoryFromSources(source, module => reader(module) + '\n' + declaration), /Unsupported/);
  }
  const originalHash = sha(safeBody(document));
  const extraStatic = inventoryFromSources(source + "\napp . use('/api/new', rememberMount, requireAuth, require('./routes/categories'));", reader);
  assert.ok(extraStatic.length > baseline.length, 'Supported new mount must be inventoried');
  assert.throws(() => assertInventory(document, extraStatic), /Operation inventory mismatch/);
  const extraRouter = inventoryFromSources(source, module => reader(module) + '\nrouter . get("/new", handler);');
  assert.ok(extraRouter.length > baseline.length, 'Whitespace router.method must be inventoried');
  assert.throws(() => assertInventory(document, extraRouter), /Operation inventory mismatch/);
  const omitted = structuredClone(document); delete omitted.paths['/api/health'];
  assert.throws(() => assertInventory(omitted, baseline), /Operation inventory mismatch/);
  const wrongMethod = structuredClone(document);
  wrongMethod.paths['/api/schedules/{id}/pay'].post = wrongMethod.paths['/api/schedules/{id}/pay'].patch;
  delete wrongMethod.paths['/api/schedules/{id}/pay'].patch;
  assert.throws(() => assertInventory(wrongMethod, baseline), /Operation inventory mismatch/);
  assert.equal(sha(safeBody(document)), originalHash); assertInventory(document, sourceInventory());
});

test('TC-CONTRACT-003: health, registration, global JSON errors and missing auth', async () => {
  const requestId = crypto.randomUUID();
  const health = await call(off, 'GET', '/api/health', 200, { headers: { 'X-Request-Id': requestId } });
  assert.equal(health.headers['x-request-id'], requestId); assert.equal(health.body.db, 'ok');
  const replaced = await call(off, 'GET', '/api/health', 200, { headers: { 'X-Request-Id': 'not-a-uuid' } });
  assert.notEqual(replaced.headers['x-request-id'], 'not-a-uuid');
  await call(off, 'POST', '/api/auth/register', 400, { body: { email: 'bad', password: PASSWORD }, code: 'VALIDATION_FAILED' });
  await call(off, 'POST', '/api/auth/register', 400, { body: { email: 'unused@wallet.test', password: 'x'.repeat(73) } });
  await call(off, 'POST', '/api/auth/register', 409, { body: { email: owner.email.toUpperCase(), password: PASSWORD }, code: 'CONFLICT' });
  await call(off, 'POST', '/api/auth/register', 400, { raw: '{', code: 'VALIDATION_FAILED' });
  await call(off, 'POST', '/api/auth/register', 413, { raw: safeBody({ padding: 'x'.repeat(110 * 1024) }), code: 'PAYLOAD_TOO_LARGE' });
  for (const operation of validated.operations.filter(op => !op.operation.security)) {
    const route = operation.path.replace(/\{[^}]+\}/g, '2147483000');
    await call(off, operation.method.toUpperCase(), route, 401, { ...(operation.operation.requestBody ? { body: {} } : {}), code: 'UNAUTHORIZED' });
  }
});

test('TC-CONTRACT-004: categories, trim/coercion, null/zero/bounds and ownership', async () => {
  const create = await call(off, 'POST', '/api/categories', 201, auth({ body: { name: '  Contract category  ', icon: 42, monthly_limit_cents: 5 } }));
  assert.equal(create.body.name, 'Contract category'); assert.equal(create.body.icon, '42'); assert.equal(create.body.monthly_limit_cents, null);
  const id = create.body.id;
  await call(off, 'POST', '/api/categories', 409, auth({ body: { name: 'Contract category' }, code: 'CONFLICT' }));
  await call(off, 'POST', '/api/categories', 400, auth({ body: { name: 'x'.repeat(61) } }));
  await call(off, 'POST', '/api/categories', 201, auth({ body: { name: '  ' + 'x'.repeat(60) + '  ' } }));
  for (const limit of [null, 0, 100000000]) {
    const result = await call(off, 'PATCH', `/api/categories/${id}`, 200, auth({ body: { monthly_limit_cents: limit } }));
    assert.equal(result.body.monthly_limit_cents, limit);
  }
  for (const body of [{}, { monthly_limit_cents: 0, name: 'bad' }, { monthly_limit_cents: -1 }, { monthly_limit_cents: 100000001 }, { monthly_limit_cents: '1' }]) {
    await call(off, 'PATCH', `/api/categories/${id}`, 400, auth({ body }));
  }
  await call(off, 'PATCH', `/api/categories/${other.categories[0].id}`, 404, auth({ body: { monthly_limit_cents: 1 }, code: 'NOT_FOUND' }));
  await call(off, 'PATCH', '/api/categories/2147483000', 404, auth({ body: { monthly_limit_cents: 1 } }));
  await call(off, 'PATCH', '/api/categories/not-an-id', 400, auth({ body: { monthly_limit_cents: 1 } }));
  await call(off, 'GET', '/api/categories', 200, auth());
});

test('TC-CONTRACT-005: settings and overall/category summary state boundaries', async () => {
  await call(off, 'GET', '/api/settings', 200, auth());
  const route = '/api/settings';
  for (const limit of [null, 0, 100000000]) {
    const result = await call(off, 'PUT', route, 200, auth({ body: { monthly_income_cents: 100000000, monthly_limit_cents: limit, ignored: true } }));
    assert.equal(result.body.monthly_limit_cents, limit);
  }
  await call(off, 'PUT', route, 400, auth({ body: {} }));
  await call(off, 'PUT', route, 400, auth({ body: { monthly_income_cents: -1 } }));
  await call(off, 'PUT', route, 400, auth({ body: { monthly_income_cents: 0, monthly_limit_cents: 100000001 } }));
  const cat = owner.categories[0].id;
  await call(off, 'POST', '/api/transactions', 201, auth({ body: { amount_cents: 100, category_id: cat } }));
  for (const [limit, state] of [[null, 'not_set'], [200, 'within'], [100, 'reached'], [0, 'exceeded']]) {
    await call(off, 'PUT', route, 200, auth({ body: { monthly_income_cents: 0, monthly_limit_cents: limit } }));
    await call(off, 'PATCH', `/api/categories/${cat}`, 200, auth({ body: { monthly_limit_cents: limit } }));
    const summary = await call(off, 'GET', '/api/summary', 200, auth());
    assert.equal(summary.body.total_cents, 100); assert.equal(summary.body.limit_status, state);
    assert.equal(summary.body.remaining_cents, -100);
    assert.equal(summary.body.by_category.find(row => row.category_id === cat).limit_status, state);
    captures.set('summary', summary);
  }
  const kept = await call(off, 'PUT', route, 200, auth({ body: { monthly_income_cents: 1 } }));
  assert.equal(kept.body.monthly_limit_cents, 0);
  await call(off, 'GET', '/api/summary?month=2026-13', 400, auth());
});

test('TC-CONTRACT-006: expenses, filters, strict PATCH, keyed replay and empty204', async () => {
  const cat = owner.categories[0].id;
  const created = await call(off, 'POST', '/api/transactions', 201, auth({ body: { amount_cents: 1, category_id: String(cat), note: { synthetic: true }, ignored: true } }));
  assert.equal(created.body.category_id, cat); assert.equal(created.body.note, '[object Object]'); assert.equal(created.body.spent_on, localToday());
  captures.set('expense', created);
  const id = created.body.id;
  const edited = await call(off, 'PATCH', `/api/transactions/${id}`, 200, auth({ body: { amount_cents: 100000000, category_id: null, note: null } }));
  assert.equal(edited.body.amount_cents, 100000000); assert.equal(edited.body.category_id, null); assert.equal(edited.body.note, null);
  for (const body of [{}, { amount_cents: 0 }, { amount_cents: 100000001 }, { amount_cents: '1' }, { spent_on: null }, { user_id: 1 }]) {
    await call(off, 'PATCH', `/api/transactions/${id}`, 400, auth({ body }));
  }
  await call(off, 'POST', '/api/transactions', 400, auth({ body: { amount_cents: 0 } }));
  await call(off, 'POST', '/api/transactions', 400, auth({ body: { amount_cents: 1, spent_on: localToday(2) } }));
  await call(off, 'POST', '/api/transactions', 404, auth({ body: { amount_cents: 1, category_id: other.categories[0].id } }));
  const foreign = await call(off, 'POST', '/api/transactions', 201, { token: other.token, body: { amount_cents: 1 } });
  await call(off, 'PATCH', `/api/transactions/${foreign.body.id}`, 404, auth({ body: { note: 'synthetic' } }));
  await call(off, 'PATCH', '/api/transactions/2147483000', 404, auth({ body: { note: 'synthetic' } }));
  await call(off, 'DELETE', `/api/transactions/${foreign.body.id}`, 404, auth());
  await call(off, 'GET', '/api/transactions', 200, auth());
  const emptyPage = await call(off, 'GET', '/api/transactions?limit=0', 200, auth());
  assert.deepEqual(emptyPage.body.items, []); assert.ok(emptyPage.body.total > 0);
  for (const query of ['limit=201', 'from=2026-03-02&to=2026-03-01', 'offset=-1', 'from=2026-02-30']) {
    await call(off, 'GET', '/api/transactions?' + query, 400, auth());
  }
  await call(off, 'GET', `/api/transactions?category_id=${other.categories[0].id}`, 404, auth());
  const key = crypto.randomUUID(), body = { amount_cents: 123, category_id: cat, spent_on: localToday(), note: 'synthetic keyed save' };
  const headers = { 'Idempotency-Key': key };
  await call(off, 'POST', '/api/transactions', 400, auth({ body: { amount_cents: 1 }, headers }));
  await call(off, 'POST', '/api/transactions', 400, auth({ body, headers: { 'Idempotency-Key': 'short' } }));
  const keyed = await call(off, 'POST', '/api/transactions', 201, auth({ body, headers, replay: false }));
  const replayed = await call(off, 'POST', '/api/transactions', 201, auth({ body, headers, replay: true }));
  assert.deepEqual(replayed.body, keyed.body);
  await call(off, 'POST', '/api/transactions', 409, auth({ body: { ...body, amount_cents: 124 }, headers, code: 'IDEMPOTENCY_CONFLICT' }));
  await call(off, 'PATCH', `/api/transactions/${keyed.body.id}`, 200, auth({ body: { amount_cents: 125 } }));
  const snapshot = await call(off, 'POST', '/api/transactions', 201, auth({ body, headers, replay: true }));
  assert.deepEqual(snapshot.body, keyed.body, 'Replay is stored creation snapshot, not current edited row');
  const deleted = await call(off, 'DELETE', `/api/transactions/${keyed.body.id}`, 204, auth());
  captures.set('deleted', deleted);
  await call(off, 'POST', '/api/transactions', 409, auth({ body, headers, code: 'IDEMPOTENCY_REPLAY_UNAVAILABLE' }));
  await call(off, 'DELETE', `/api/transactions/${keyed.body.id}`, 404, auth());
  await call(off, 'DELETE', '/api/transactions/not-an-id', 400, auth());
  await call(off, 'DELETE', `/api/transactions/${id}`, 204, auth());
});

test('PAGING-CONTROL: legacy offset drift after insertion and deletion', async () => {
  const category = await call(off, 'POST', '/api/categories', 201,
    auth({ body: { name: `Offset witness ${crypto.randomUUID()}` } }));
  const categoryId = category.body.id;
  const created = [];
  for (let i = 0; i < 4; i++) {
    const row = await call(off, 'POST', '/api/transactions', 201,
      auth({ body: { amount_cents: 1, category_id: categoryId, spent_on: localToday() } }));
    created.push(row.body.id);
  }
  const route = `?limit=2&category_id=${categoryId}`;
  const first = (await call(off, 'GET', `/api/transactions${route}`, 200, auth())).body;
  assert.deepEqual(first.items.map(row => row.id), [created[3], created[2]]);
  const inserted = await call(off, 'POST', '/api/transactions', 201,
    auth({ body: { amount_cents: 1, category_id: categoryId, spent_on: localToday() } }));
  const afterInsert = (await call(off, 'GET', `/api/transactions${route}&offset=2`, 200, auth())).body;
  assert.deepEqual(afterInsert.items.map(row => row.id), [created[2], created[1]],
    'old offset duplicates the already seen boundary after insertion');

  const secondFirst = (await call(off, 'GET', `/api/transactions${route}`, 200, auth())).body;
  assert.deepEqual(secondFirst.items.map(row => row.id), [inserted.body.id, created[3]]);
  await call(off, 'DELETE', `/api/transactions/${inserted.body.id}`, 204, auth());
  const afterDelete = (await call(off, 'GET', `/api/transactions${route}&offset=2`, 200, auth())).body;
  assert.deepEqual(afterDelete.items.map(row => row.id), [created[1], created[0]],
    'old offset skips the surviving unseen boundary after deletion');
  assert.ok(!afterDelete.items.some(row => row.id === created[2]));
});

test('PAGING-CONTROL: cursor survives earlier mutations and rejects invalid contexts', async () => {
  const category = await call(off, 'POST', '/api/categories', 201,
    auth({ body: { name: `Cursor witness ${crypto.randomUUID()}` } }));
  const categoryId = category.body.id;
  const date = localToday();
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const row = await call(off, 'POST', '/api/transactions', 201,
      auth({ body: { amount_cents: 1, category_id: categoryId, spent_on: date } }));
    ids.push(row.body.id);
  }
  const base = `/api/transactions?paging=cursor&limit=2&from=${date}&to=${date}&category_id=${categoryId}`;
  const page = async token => (await call(off, 'GET', base + (token ? `&cursor=${encodeURIComponent(token)}` : ''), 200, auth())).body;
  const first = await page();
  assert.deepEqual(first.items.map(row => row.id), [ids[5], ids[4]], 'same-date tie breaks by descending ID');
  assert.equal(typeof first.next_cursor, 'string');
  const stableSecond = await page(first.next_cursor);
  const stableThird = await page(stableSecond.next_cursor);
  assert.deepEqual(stableSecond.items.map(row => row.id), [ids[3], ids[2]]);
  assert.deepEqual(stableThird.items.map(row => row.id), [ids[1], ids[0]]);
  assert.equal(stableThird.next_cursor, null, 'the last full page terminates');

  const inserted = await call(off, 'POST', '/api/transactions', 201,
    auth({ body: { amount_cents: 1, category_id: categoryId, spent_on: date } }));
  for (const id of [ids[5], ids[4], ids[3]]) {
    await call(off, 'DELETE', `/api/transactions/${id}`, 204, auth());
  }
  const after = await page(first.next_cursor); // boundary row was deleted
  assert.equal(after.total, 4);
  assert.deepEqual(after.items.map(row => row.id), [ids[2], ids[1]]);
  const final = await page(after.next_cursor);
  assert.deepEqual(final.items.map(row => row.id), [ids[0]]);
  assert.equal(final.next_cursor, null);
  assert.deepEqual([ids[5], ids[4], ...after.items.map(row => row.id), ...final.items.map(row => row.id)].slice(2),
    [ids[2], ids[1], ids[0]], 'surviving unseen IDs neither skip nor repeat');
  assert.ok(!after.items.some(row => row.id === inserted.body.id), 'new before-cursor row waits for refresh');
  const refreshed = await page();
  assert.deepEqual(refreshed.items.map(row => row.id), [inserted.body.id, ids[2]]);

  const empty = await call(off, 'POST', '/api/categories', 201,
    auth({ body: { name: `Empty cursor ${crypto.randomUUID()}` } }));
  const emptyPage = await call(off, 'GET', `${base.replace(`category_id=${categoryId}`, `category_id=${empty.body.id}`)}`, 200, auth());
  assert.deepEqual(emptyPage.body, { items: [], total: 0, next_cursor: null });
  const zero = await call(off, 'GET', base.replace('limit=2', 'limit=0'), 200, auth());
  assert.deepEqual(zero.body, { items: [], total: 4, next_cursor: null });

  const tokenBody = JSON.parse(Buffer.from(first.next_cursor, 'base64url').toString('utf8'));
  const forged = change => Buffer.from(JSON.stringify(change(structuredClone(tokenBody)))).toString('base64url');
  const invalid = [
    `${base}&cursor=%25%25%25`, `${base}&cursor=${'A'.repeat(513)}`,
    `${base}&cursor=${first.next_cursor}=`,
    `${base}&cursor=${forged(body => ({ i: body.i, ...body }))}`,
    `${base}&cursor=${forged(body => ({ ...body, d: '2026-02-30' }))}`,
    `${base}&cursor=${forged(body => ({ ...body, i: 9007199254740992 }))}`,
    `${base}&cursor=${forged(body => ({ ...body, v: 2 }))}`,
    `${base}&cursor=${encodeURIComponent(first.next_cursor)}&offset=0`,
    base.replace(`category_id=${categoryId}`, `category_id=${empty.body.id}`) + `&cursor=${encodeURIComponent(first.next_cursor)}`,
    base.replace(`from=${date}`, 'from=0000-01-01') + `&cursor=${encodeURIComponent(first.next_cursor)}`,
    `/api/transactions?cursor=${encodeURIComponent(first.next_cursor)}`,
    '/api/transactions?paging=unknown',
  ];
  const dbRead = new Database(off.databasePath, { readonly: true });
  const beforeRows = dbRead.prepare('SELECT id, amount_cents, spent_on FROM transactions WHERE category_id = ? ORDER BY id').all(categoryId);
  try {
    for (const route of invalid) await call(off, 'GET', route, 400, auth({ code: 'VALIDATION_FAILED' }));
    const unfilteredRoute = `/api/transactions?paging=cursor&limit=1&from=${date}&to=${date}`;
    const unfiltered = await call(off, 'GET', unfilteredRoute, 200, auth());
    const otherCreated = await call(off, 'POST', '/api/transactions', 201,
      { token: other.token, body: { amount_cents: 1, spent_on: date } });
    const otherFirst = await call(off, 'GET', unfilteredRoute, 200, { token: other.token });
    assert.deepEqual(otherFirst.body.items.map(row => row.id), [otherCreated.body.id],
      'other account lists its own newest row, never an owner row');
    await call(off, 'GET', `${unfilteredRoute}&cursor=${encodeURIComponent(unfiltered.body.next_cursor)}`, 400,
      { token: other.token, code: 'VALIDATION_FAILED' });
    const afterRows = dbRead.prepare('SELECT id, amount_cents, spent_on FROM transactions WHERE category_id = ? ORDER BY id').all(categoryId);
    assert.deepEqual(afterRows, beforeRows, 'rejected cursors do not change expense rows');
  } finally { dbRead.close(); }
  const legacy = await call(off, 'GET', `/api/transactions?limit=0&category_id=${categoryId}`, 200, auth());
  assert.deepEqual(Object.keys(legacy.body), ['items', 'total'], 'legacy response remains exact two fields');
});

test('TC-CONTRACT-007: schedules, subscriptions, loans, pay, reopen and ownership', async () => {
  const base = { name: 'Synthetic subscription', amount_cents: 10, day_of_month: 31, starts_on: localToday() };
  const sub = await call(off, 'POST', '/api/schedules', 201, auth({ body: base }));
  assert.equal(sub.body.total_count, null); assert.equal(sub.body.remaining_count, null); assert.equal(sub.body.active, 1);
  const first = await call(off, 'PATCH', `/api/schedules/${sub.body.id}/pay`, 200, auth({ body: { ignored: true } }));
  const second = await call(off, 'PATCH', `/api/schedules/${sub.body.id}/pay`, 200, auth());
  assert.equal(first.body.remaining_count, null); assert.equal(second.body.paid_count, 2);
  assert.notEqual(first.body.transaction_id, second.body.transaction_id, 'Pay is intentionally not idempotent');
  const loan = await call(off, 'POST', '/api/schedules', 201, auth({ body: { ...base, name: 'Synthetic loan', total_count: 2 } }));
  await call(off, 'PATCH', `/api/schedules/${loan.body.id}/pay`, 200, auth());
  const finished = await call(off, 'PATCH', `/api/schedules/${loan.body.id}/pay`, 200, auth());
  assert.equal(finished.body.finished, true); assert.equal(finished.body.remaining_count, 0);
  await call(off, 'PATCH', `/api/schedules/${loan.body.id}/pay`, 409, auth({ code: 'CONFLICT' }));
  await call(off, 'PATCH', `/api/schedules/${loan.body.id}`, 409, auth({ body: { total_count: 1 }, code: 'CONFLICT' }));
  const reopened = await call(off, 'PATCH', `/api/schedules/${loan.body.id}`, 200, auth({ body: { total_count: 3, name: 'Edited synthetic loan' } }));
  assert.equal(reopened.body.active, 1); assert.equal(reopened.body.remaining_count, 1);
  const closed = await call(off, 'PATCH', `/api/schedules/${loan.body.id}`, 200, auth({ body: { total_count: 2 } }));
  assert.equal(closed.body.active, 0);
  const list = await call(off, 'GET', '/api/schedules?active=1', 200, auth());
  assert.ok(!list.body.some(row => row.id === loan.body.id));
  const all = await call(off, 'GET', '/api/schedules?active=anything', 200, auth());
  assert.ok(all.body.some(row => row.id === loan.body.id));
  await call(off, 'POST', '/api/schedules', 201, auth({ body: { ...base, amount_cents: 100000000, total_count: 1200 } }));
  for (const body of [{ ...base, day_of_month: 0 }, { ...base, total_count: 1201 }, { ...base, amount_cents: '10' }]) {
    await call(off, 'POST', '/api/schedules', 400, auth({ body }));
  }
  for (const body of [{}, { active: 0 }, { total_count: 0 }, { starts_on: '2026-02-30' }]) {
    await call(off, 'PATCH', `/api/schedules/${sub.body.id}`, 400, auth({ body }));
  }
  const foreign = await call(off, 'POST', '/api/schedules', 201, { token: other.token, body: base });
  for (const id of [foreign.body.id, 2147483000]) {
    await call(off, 'PATCH', `/api/schedules/${id}`, 404, auth({ body: { name: 'synthetic' } }));
    await call(off, 'PATCH', `/api/schedules/${id}/pay`, 404, auth());
  }
  await call(off, 'PATCH', '/api/schedules/invalid/pay', 400, auth());
  await call(off, 'POST', '/api/schedules', 404, auth({ body: { ...base, category_id: other.categories[0].id } }));
});

test('support_control: keyed Pay replay, final closure, stale snapshot, ownership and tombstone', async () => {
  const base = { name: 'Keyed final loan', amount_cents: 3700, day_of_month: 15,
    starts_on: localToday(), total_count: 1 };
  const loan = (await call(off, 'POST', '/api/schedules', 201, auth({ body: base }))).body;
  const body = { expected_paid_count: 0, expected_amount_cents: 3700,
    expected_category_id: null, expected_name: base.name,
    expected_total_count: 1, spent_on: localToday() };
  const route = `/api/schedules/${loan.id}/pay`;
  const key = crypto.randomUUID();
  const headers = { 'Idempotency-Key': key };
  const first = await call(off, 'PATCH', route, 200, auth({ body, headers, replay: false }));
  const replay = await call(off, 'PATCH', route, 200, auth({ body, headers, replay: true }));
  assert.deepEqual(replay.body, first.body, 'final closed loan must replay its stored result');
  assert.equal(first.body.finished, true);
  await call(off, 'PATCH', route, 409, auth({ body: { ...body, expected_amount_cents: 3701 },
    headers, code: 'IDEMPOTENCY_CONFLICT' }));
  await call(off, 'POST', '/api/transactions', 409, auth({
    body: { amount_cents: 3700, spent_on: localToday(), note: 'cross-kind' },
    headers, code: 'IDEMPOTENCY_CONFLICT',
  }));
  await call(off, 'PATCH', route, 409, auth({ body, headers: { 'Idempotency-Key': crypto.randomUUID() },
    code: 'CONFLICT' }));
  await call(off, 'PATCH', route, 404, { token: other.token, body,
    headers: { 'Idempotency-Key': crypto.randomUUID() }, code: 'NOT_FOUND' });

  const db = new Database(off.databasePath);
  try {
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE schedule_id = ?')
      .get(loan.id).n;
    assert.equal(count(), 1);
    assert.equal(db.prepare('SELECT paid_count FROM schedules WHERE id = ?').get(loan.id).paid_count, 1);
  } finally { db.close(); }
  await call(off, 'DELETE', `/api/transactions/${first.body.transaction_id}`, 204, auth());
  await call(off, 'PATCH', route, 409, auth({ body, headers,
    code: 'IDEMPOTENCY_REPLAY_UNAVAILABLE' }));

  const subscription = (await call(off, 'POST', '/api/schedules', 201, auth({ body: {
    ...base, name: 'Keyed subscription', total_count: null,
  } }))).body;
  const subRoute = `/api/schedules/${subscription.id}/pay`;
  const subBody = { ...body, expected_name: 'Keyed subscription', expected_total_count: null };
  const shared = { 'Idempotency-Key': crypto.randomUUID() };
  const parallel = await Promise.all([
    call(off, 'PATCH', subRoute, 200, auth({ body: subBody, headers: shared })),
    call(off, 'PATCH', subRoute, 200, auth({ body: subBody, headers: shared })),
  ]);
  assert.deepEqual(parallel[0].body, parallel[1].body);
  assert.deepEqual(parallel.map(item => item.headers['idempotency-replayed']).sort(), [undefined, 'true'].sort());
  await call(off, 'PATCH', subRoute, 409, auth({ body: subBody,
    headers: { 'Idempotency-Key': crypto.randomUUID() }, code: 'CONFLICT' }));
  const next = await call(off, 'PATCH', subRoute, 200, auth({
    body: { ...subBody, expected_paid_count: 1 },
    headers: { 'Idempotency-Key': crypto.randomUUID() }, replay: false,
  }));
  assert.equal(next.body.paid_count, 2);
  assert.notEqual(next.body.transaction_id, parallel[0].body.transaction_id);
  await call(off, 'PATCH', subRoute, 400, auth({ body: {}, headers: {
    'Idempotency-Key': crypto.randomUUID(),
  }, code: 'VALIDATION_FAILED' }));
});

test('DATE-CONTROL: schedule boundary refuses overflow before writes and legacy rows fail explicitly', async () => {
  const db = new Database(off.databasePath);
  const failures = [];
  const userId = db.prepare('SELECT id FROM users WHERE email = ?').get(owner.email).id;
  const count = () => db.prepare('SELECT COUNT(*) AS n FROM schedules WHERE user_id = ?').get(userId).n;
  const probe = async (method, route, body, expected, label) => {
    const key = validator.operationKey(method, new URL(route, off.baseUrl).pathname);
    const result = await capture(off, method, route, auth(body === undefined ? {} : { body }));
    validator.validate(key, result);
    if (!observed.has(key)) observed.set(key, new Set());
    observed.get(key).add(result.status); requests++;
    if (result.status !== expected) failures.push(`${label}: HTTP ${result.status}, expected ${expected}`);
    if (expected === 400 && result.status === 400 && result.body.error.code !== 'VALIDATION_FAILED') {
      failures.push(`${label}: expected VALIDATION_FAILED`);
    }
    return result;
  };
  try {
    const invalid = { name: 'Date overflow probe', amount_cents: 10, day_of_month: 15, starts_on: '9999-12-31' };
    const beforeCreate = count();
    await probe('POST', '/api/schedules', invalid, 400, 'create overflow');
    if (count() !== beforeCreate) failures.push('create overflow changed stored schedule count');
    db.prepare('DELETE FROM schedules WHERE user_id = ? AND name = ?').run(userId, invalid.name);

    const valid = await probe('POST', '/api/schedules',
      { ...invalid, name: 'Date max valid', day_of_month: 31 }, 201, 'create max valid');
    if (valid.status === 201) {
      if (valid.body.next_due !== '9999-12-31') failures.push(`max valid next_due ${valid.body.next_due}`);
      const beforePatch = db.prepare('SELECT day_of_month, starts_on FROM schedules WHERE id = ?').get(valid.body.id);
      await probe('PATCH', `/api/schedules/${valid.body.id}`, { day_of_month: 15 }, 400, 'patch overflow');
      const afterPatch = db.prepare('SELECT day_of_month, starts_on FROM schedules WHERE id = ?').get(valid.body.id);
      if (JSON.stringify(afterPatch) !== JSON.stringify(beforePatch)) failures.push('patch overflow changed stored schedule');
      db.prepare('UPDATE schedules SET day_of_month = 31 WHERE id = ?').run(valid.body.id);
    }

    const early = await probe('POST', '/api/schedules',
      { ...invalid, name: 'Date year zero', day_of_month: 31, starts_on: '0000-02-29' }, 201, 'create year zero');
    if (early.status === 201 && early.body.starts_on !== '0000-02-29') failures.push('year zero changed on save');

    const legacy = db.prepare(`INSERT INTO schedules
      (user_id, name, amount_cents, category_id, day_of_month, starts_on, total_count)
      VALUES (?, ?, ?, NULL, ?, ?, NULL)`)
      .run(userId, 'Legacy date edge', 10, 15, '9999-12-31');
    try { await probe('GET', '/api/schedules', undefined, 400, 'legacy overflow list'); }
    finally { db.prepare('DELETE FROM schedules WHERE id = ?').run(Number(legacy.lastInsertRowid)); }

    assert.deepEqual(failures, []);
  } finally { db.close(); }
});

test('TC-CONTRACT-008: AI off/demo, normalized bounds, statuses, quotas and no expense writes', async () => {
  const body = { text: 'Yesterday I paid 18 euros for lunch', reference_date: localToday() };
  const disabled = await call(off, 'GET', '/api/ai/capabilities', 200, auth());
  assert.deepEqual(disabled.body, { enabled: false, mode: 'off', provider: null, max_input_chars: 500, languages: ['en', 'uk', 'sk'], requires_external_consent: false });
  await call(off, 'POST', '/api/ai/expense-draft', 503, auth({ body, code: 'AI_UNAVAILABLE' }));
  await call(off, 'POST', '/api/ai/expense-draft', 400, auth({ body: { ...body, reference_date: localToday(-2) }, code: 'REFERENCE_DATE_MISMATCH' }));
  for (const invalid of [{ ...body, text: '' }, { ...body, locale: null }, { ...body, consent_to_external_processing: null }, { ...body, extra: true }, { ...body, text: 'e\u0301'.repeat(501) }]) {
    await call(off, 'POST', '/api/ai/expense-draft', 400, auth({ body: invalid, code: 'VALIDATION_FAILED' }));
  }
  await call(off, 'POST', '/api/ai/expense-draft', 503, auth({ body: { ...body, text: 'e\u0301'.repeat(500) }, code: 'AI_UNAVAILABLE' }));
  await call(off, 'POST', '/api/ai/expense-draft', 400, auth({ raw: safeBody({ ...body, padding: 'x'.repeat(8192) }) }));
  const u = await user(demo, 'demo');
  const enabled = await call(demo, 'GET', '/api/ai/capabilities', 200, { token: u.token });
  assert.equal(enabled.body.mode, 'demo'); assert.equal(enabled.body.provider, 'demo'); assert.equal(enabled.body.requires_external_consent, false);
  const before = await call(demo, 'GET', '/api/transactions', 200, { token: u.token });
  for (const [text, status] of [[body.text, 'ready'], ['Lunch yesterday', 'needs_input'], ['Lunch 10 USD', 'unsupported']]) {
    const result = await call(demo, 'POST', '/api/ai/expense-draft', 200, { token: u.token, body: { ...body, text } });
    assert.equal(result.body.mode, 'demo'); assert.equal(result.body.status, status);
    if (status === 'unsupported') {
      assert.ok(Object.values(result.body.draft).every(value => value === null));
      assert.ok(Object.values(result.body.provenance).every(value => value === 'none'));
    }
  }
  await call(demo, 'POST', '/api/ai/expense-draft', 429, { token: u.token, body, code: 'AI_RATE_LIMITED' });
  const after = await call(demo, 'GET', '/api/transactions', 200, { token: u.token });
  assert.equal(after.body.total, before.body.total, 'Drafts and rate rejection do not create expenses');
  const context = await user(demo, 'context');
  for (let i = context.categories.length; i < 101; i++) {
    await call(demo, 'POST', '/api/categories', 201, { token: context.token, body: { name: `Synthetic context ${i}` } });
  }
  await call(demo, 'POST', '/api/ai/expense-draft', 422, { token: context.token, body, code: 'AI_CONTEXT_TOO_LARGE' });
});

test('TC-CONTRACT-009: login success, credential denial and429 Retry-After', async () => {
  const success = await call(off, 'POST', '/api/auth/login', 200, { body: { email: '  ' + owner.email.toUpperCase() + '  ', password: PASSWORD } });
  tokens.push(success.body.token);
  captures.set('unauthorized', await call(off, 'POST', '/api/auth/login', 401, { body: { email: owner.email, password: 'synthetic-wrong' }, code: 'UNAUTHORIZED' }));
  await call(off, 'POST', '/api/auth/login', 401, { body: {}, code: 'UNAUTHORIZED' });
  await call(off, 'POST', '/api/auth/login', 401, { body: { email: owner.email, password: 1 }, code: 'UNAUTHORIZED' });
  const limited = await call(off, 'POST', '/api/auth/login', 429, { body: { email: owner.email, password: PASSWORD }, code: 'RATE_LIMITED' });
  assert.ok(Number(limited.headers['retry-after']) > 0); captures.set('limited', limited);
});

test('TC-CONTRACT-010: corrupt REAL captures rejected, baselines unchanged', () => {
  mustReject('POST /api/transactions', captures.get('expense'), value => { delete value.body.amount_cents; value.text = safeBody(value.body); }, 'body', 'required');
  mustReject('POST /api/transactions', captures.get('expense'), value => { value.body.amount_cents = '1'; value.text = safeBody(value.body); }, 'body', 'type');
  mustReject('GET /api/summary', captures.get('summary'), value => { value.body.limit_status = 'invented'; value.text = safeBody(value.body); }, 'body', 'enum');
  mustReject('POST /api/auth/login', captures.get('unauthorized'), value => { value.body.error.code = 'CONFLICT'; value.text = safeBody(value.body); }, 'body', 'enum');
  mustReject('POST /api/auth/login', captures.get('limited'), value => { delete value.headers['retry-after']; }, 'header');
  mustReject('POST /api/auth/login', captures.get('limited'), value => { value.status = 418; }, 'status');
  mustReject('POST /api/transactions', captures.get('expense'), value => { value.headers['content-type'] = 'text/plain'; }, 'media');
  mustReject('DELETE /api/transactions/{id}', captures.get('deleted'), value => { value.text = '{}'; }, 'empty204');
});

test('TC-CONTRACT-IMPORT: real offline preview, confirm, replay and conflict', async () => {
  const record = { external_id: 'contract-synthetic-001', amount_cents: 3500,
    spent_on: localToday(-1), category_name: owner.categories[0].name, note: 'Synthetic example' };
  const body = { source: 'synthetic-demo-v1', records: [record] };
  const preview = await call(off, 'POST', '/api/imports/preview', 200, auth({ body }));
  assert.equal(preview.body.records[0].state, 'new');
  const saved = await call(off, 'POST', '/api/imports/confirm', 201, auth({ body }));
  const again = await call(off, 'POST', '/api/imports/confirm', 200, auth({ body }));
  assert.equal(again.body.records[0].transaction_id, saved.body.records[0].transaction_id);
  await call(off, 'POST', '/api/imports/confirm', 409, auth({ body: {
    ...body, records: [{ ...record, amount_cents: 3501 }],
  }, code: 'IDEMPOTENCY_CONFLICT' }));
});

test('VALIDATION-CONTROL: safe pagination and owned IDs reject unsafe magnitudes', async () => {
  const failures = [];
  const cat = owner.categories[0].id;
  const before = await call(off, 'GET', '/api/transactions?limit=0', 200, auth());
  const today = localToday();
  const safeMax = String(Number.MAX_SAFE_INTEGER);
  for (const query of ['offset=0', `offset=${safeMax}`, 'limit=0', 'limit=200']) {
    await call(off, 'GET', `/api/transactions?${query}`, 200, auth());
  }
  for (const query of [
    'offset=1e30', 'offset=9007199254740992', 'offset=-1', 'offset=1.5',
    'limit=1e30', 'limit=-1', 'limit=1.5',
  ]) await expectValidationProbe('GET', `/api/transactions?${query}`, {}, failures, query);

  await call(off, 'DELETE', `/api/transactions/${safeMax}`, 404, auth());
  await call(off, 'GET', `/api/transactions?category_id=${safeMax}`, 404, auth());
  const unsafe = '9007199254740992';
  await expectValidationProbe('DELETE', `/api/transactions/${unsafe}`, {}, failures, 'unsafe URL id');
  await expectValidationProbe('PATCH', `/api/transactions/${unsafe}`, { body: { note: 'unchanged' } }, failures, 'unsafe PATCH id');
  await expectValidationProbe('PATCH', `/api/categories/${unsafe}`, { body: { monthly_limit_cents: 0 } }, failures, 'unsafe category URL id');
  await expectValidationProbe('GET', `/api/transactions?category_id=${unsafe}`, {}, failures, 'unsafe category filter');
  await expectValidationProbe('POST', '/api/transactions', { body: { amount_cents: 1, category_id: Number(unsafe) } }, failures, 'unsafe owned category');
  await expectValidationProbe('POST', '/api/transactions', { body: { amount_cents: 1, category_id: { toString: null } } }, failures, 'non-convertible owned category');
  await expectValidationProbe('POST', '/api/transactions', {
    body: { amount_cents: 1, category_id: Number(unsafe), spent_on: today },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  }, failures, 'unsafe keyed category');
  await expectValidationProbe('POST', '/api/transactions', {
    body: { amount_cents: 1, category_id: { toString: null }, spent_on: today },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  }, failures, 'non-convertible keyed category');
  const after = await call(off, 'GET', '/api/transactions?limit=0', 200, auth());
  assert.equal(after.body.total, before.body.total, 'invalid numeric writes changed the ledger');
  const key = crypto.randomUUID();
  const payload = { amount_cents: 1, category_id: cat, spent_on: today, note: 'same canonical category' };
  const headers = { 'Idempotency-Key': key };
  const created = await call(off, 'POST', '/api/transactions', 201, auth({ body: payload, headers, replay: false }));
  for (const equivalent of [String(cat), [cat], [[cat]], ...(cat === 1 ? [true] : [])]) {
    const replay = await call(off, 'POST', '/api/transactions', 201, auth({
      body: { ...payload, category_id: equivalent }, headers, replay: true,
    }));
    assert.deepEqual(replay.body, created.body, 'safe category casts preserve canonical replay');
  }
  assert.deepEqual(failures, [], 'numeric validation failures (no response bodies printed)');
});

test('VALIDATION-CONTROL: nullable text coercion rejects only non-convertible JSON', async () => {
  const failures = [];
  const beforeTx = await call(off, 'GET', '/api/transactions?limit=0', 200, auth());
  const beforeCategories = await call(off, 'GET', '/api/categories', 200, auth());
  const target = await call(off, 'POST', '/api/transactions', 201, auth({ body: { amount_cents: 1, note: 'unchanged' } }));
  const today = localToday();
  let acceptedAfterInvalid = 0;
  for (const [label, value] of [['shadowed method', { toString: null }], ['nested array', [{ toString: null }]]]) {
    await expectValidationProbe('POST', '/api/transactions', { body: { amount_cents: 1, note: value } }, failures, `unkeyed note ${label}`);
    const key = crypto.randomUUID();
    await expectValidationProbe('POST', '/api/transactions', {
      body: { amount_cents: 1, spent_on: today, note: value }, headers: { 'Idempotency-Key': key },
    }, failures, `keyed note ${label}`);
    await expectValidationProbe('PATCH', `/api/transactions/${target.body.id}`, { body: { note: value } }, failures, `PATCH note ${label}`);
    await expectValidationProbe('POST', '/api/categories', {
      body: { name: `Invalid icon ${label}`, icon: value },
    }, failures, `category icon ${label}`);
    const afterInvalid = await call(off, 'GET', '/api/transactions?limit=200', 200, auth());
    const afterCategories = await call(off, 'GET', '/api/categories', 200, auth());
    assert.equal(afterInvalid.body.total, beforeTx.body.total + 1 + acceptedAfterInvalid, 'invalid note inserted an expense');
    assert.equal(afterCategories.body.length, beforeCategories.body.length, 'invalid icon inserted a category');
    assert.equal(afterInvalid.body.items.find(row => row.id === target.body.id).note, 'unchanged', 'invalid PATCH changed note');
    // The rejected keyed attempt must not reserve its key.
    await call(off, 'POST', '/api/transactions', 201, auth({
      body: { amount_cents: 1, spent_on: today, note: 'valid after rejected key' },
      headers: { 'Idempotency-Key': key }, replay: false,
    }));
    acceptedAfterInvalid++;
  }

  const compatible = [
    ['number', 123, '123'], ['boolean true', true, 'true'],
    ['boolean false', false, 'false'],
    ['object', { sample: true }, '[object Object]'], ['array', ['a', 1], 'a,1'],
    ['null', null, null], ['string', 'ordinary note', 'ordinary note'],
  ];
  for (const [label, value, expected] of compatible) {
    const unkeyed = await call(off, 'POST', '/api/transactions', 201, auth({ body: { amount_cents: 1, note: value } }));
    assert.equal(unkeyed.body.note, expected, `unkeyed ${label}`);
    const key = crypto.randomUUID();
    const keyedBody = { amount_cents: 1, spent_on: today, note: value };
    const headers = { 'Idempotency-Key': key };
    const keyed = await call(off, 'POST', '/api/transactions', 201, auth({ body: keyedBody, headers, replay: false }));
    assert.equal(keyed.body.note, expected, `keyed ${label}`);
    const replay = await call(off, 'POST', '/api/transactions', 201, auth({ body: keyedBody, headers, replay: true }));
    assert.deepEqual(replay.body, keyed.body, `keyed replay ${label}`);
    if (label === 'null') {
      const omittedReplay = await call(off, 'POST', '/api/transactions', 201, auth({
        body: { amount_cents: 1, spent_on: today }, headers, replay: true,
      }));
      assert.deepEqual(omittedReplay.body, keyed.body, 'null and omitted note share canonical payload');
    }
    const edited = await call(off, 'PATCH', `/api/transactions/${target.body.id}`, 200, auth({ body: { note: value } }));
    assert.equal(edited.body.note, expected, `PATCH ${label}`);
    const category = await call(off, 'POST', '/api/categories', 201, auth({ body: { name: `Icon ${label}`, icon: value } }));
    assert.equal(category.body.icon, expected, `icon ${label}`);
  }
  const omitted = await call(off, 'POST', '/api/transactions', 201, auth({ body: { amount_cents: 1 } }));
  assert.equal(omitted.body.note, null);
  const omittedIcon = await call(off, 'POST', '/api/categories', 201, auth({ body: { name: 'Icon omitted' } }));
  assert.equal(omittedIcon.body.icon, null);
  const clear = await call(off, 'PATCH', `/api/transactions/${target.body.id}`, 200, auth({ body: { note: null } }));
  assert.equal(clear.body.note, null);
  const unchanged = await call(off, 'PATCH', `/api/transactions/${target.body.id}`, 200, auth({ body: { amount_cents: 2 } }));
  assert.equal(unchanged.body.note, null);
  assert.deepEqual(failures, [], 'text validation failures (no response bodies printed)');
});

test('TC-CONTRACT-011: complete observed matrix, unexercised statuses and log privacy', () => {
  assertObservedSuccess(validated.operations, observed);
  // A pure copied-matrix control, not a fabricated HTTP observation. Auth
  // denial alone cannot masquerade as successful coverage of an operation.
  const before = safeBody([...observed].map(([key, values]) => [key, [...values]]));
  const deniedOnly = new Map([...observed].map(([key, values]) => [key, new Set(values)]));
  deniedOnly.set('GET /api/categories', new Set([401]));
  assert.throws(() => assertObservedSuccess(validated.operations, deniedOnly), /Operation lacks an observed success: GET \/api\/categories/);
  assert.equal(safeBody([...observed].map(([key, values]) => [key, [...values]])), before);
  assertObservedSuccess(validated.operations, observed);
  assert.equal(observed.size, sourceInventory().length);
  for (const token of tokens) {
    assert.ok(!off.output().includes(token) && !demo.output().includes(token), 'Server logs must not contain captured JWT');
  }
  console.log(`REAL HTTP OBSERVED: ${requests} validated responses; ${observed.size}/${validated.operations.length} source operations. Demo=fixture seam, not LLM quality or external execution.`);
  for (const { key, operation } of validated.operations) {
    const seen = observed.get(key);
    const unexercised = Object.keys(operation.responses).filter(status => !seen.has(Number(status)));
    console.log(`${key} | observed ${[...seen].sort((a,b) => a-b).join(',')} | documented NOT EXERCISED ${unexercised.join(',') || 'none'}`);
  }
  console.log('NEGATIVE CONTROLS PASS: real-capture missing amount/type/limit enum/error code/header/status/media/204; source omitted operation/wrong method; unsupported quote/all/chained/dynamic scanner fixtures. Originals unchanged.');
  console.log('No live AI403/502/504 or busy503 observation; no induced generic500; no GitHub CI claim.');
});
