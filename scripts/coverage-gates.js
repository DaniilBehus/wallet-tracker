'use strict';

// Coverage gates C6-C9, kept in their own file: check.js asserts invariants
// about how things are *written*, these assert that what exists is actually
// *covered*. That is the failure mode a test suite has and a codebase does not
// — a route added without a case, a testid nobody selects, a status nobody
// provokes. Each is invisible, and each makes the suite quietly less true than
// it looks.
//
// Exceptions live in scripts/check-exceptions.json and need a written reason.
// Something that cannot be tested is a sentence somebody had to write; something
// that merely has not been tested yet is a finding, and is closed with a test.
//
// No dependencies (spec §2). Node built-ins only.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const at = (...s) => path.join(ROOT, ...s);
const has = (f) => fs.existsSync(at(f));

function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, ext, out);
    else if (e.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function loadExceptions() {
  const file = at('scripts/check-exceptions.json');
  if (!fs.existsSync(file)) return { data: { C6: [], C7: [], C8: [] }, problems: [] };

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = [];
  for (const gate of ['C6', 'C7', 'C8']) {
    for (const entry of data[gate] || []) {
      if (!entry.reason || entry.reason.trim().length < 20) {
        problems.push(`${gate}: exception "${entry.item}" has no usable reason`);
      }
    }
  }
  return { data, problems };
}

const excepted = (exceptions, gate, item) =>
  (exceptions[gate] || []).some((e) => e.item === item);

/** Every request in the collection, flattened out of its folders. */
function collectionRequests() {
  const file = at('qa/api/wallet.postman_collection.json');
  if (!fs.existsSync(file)) return null;

  const collection = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  const walkItems = (items) => {
    for (const item of items || []) {
      if (item.item) walkItems(item.item);
      else if (item.request) out.push(item);
    }
  };
  walkItems(collection.item);
  return out;
}

/**
 * "{{txA}}", "41" and ":id" are all just "an id" as far as coverage goes: one
 * is how the collection writes a variable, one is a literal in a URL, one is
 * how Express writes a parameter.
 *
 * Missing the third produced this gate's first false positive — it reported
 * DELETE /api/transactions/:id as uncovered while three cases were exercising
 * it. Worth the comment: a coverage gate that cries wolf gets an exception
 * written for it, and then it is excusing a gap that was never there.
 */
const normalisePath = (segments) =>
  '/' + segments
    .map((s) =>
      /^\{\{.+\}\}$/.test(s) || /^\d+$/.test(s) || s.startsWith(':') ? ':param' : s)
    .join('/');

// ---------------------------------------------------------------------- C6
function c6RoutesCovered({ pass, skip, fail }, exceptions) {
  const id = 'C6', name = 'every route in src/ has a request in the collection';
  if (!has('src/server.js')) return skip(id, name, 'src/server.js does not exist yet');

  const requests = collectionRequests();
  if (!requests) return skip(id, name, 'the collection does not exist yet');

  const server = fs.readFileSync(at('src/server.js'), 'utf8');
  const routes = [];

  // Endpoints declared straight on the app.
  for (const m of server.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
    routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }

  // Mounted routers: app.use('/api/x', requireAuth, require('./routes/y'))
  for (const m of server.matchAll(/app\.use\(\s*'([^']+)'[^)]*require\('\.\/(routes\/[\w-]+)'\)/g)) {
    const base = m[1];
    const routeFile = at('src', m[2] + '.js');
    if (!fs.existsSync(routeFile)) continue;
    const body = fs.readFileSync(routeFile, 'utf8');
    for (const r of body.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      routes.push({ method: r[1].toUpperCase(), path: base + (r[2] === '/' ? '' : r[2]) });
    }
  }

  const covered = new Set(requests.map((r) =>
    (r.request.method || 'GET').toUpperCase() + ' ' + normalisePath(r.request.url.path || [])));

  const missing = [];
  for (const route of routes) {
    const wanted = route.method + ' ' + normalisePath(route.path.replace(/^\//, '').split('/'));
    const key = route.method + ' ' + route.path;
    if (!covered.has(wanted) && !excepted(exceptions, 'C6', key)) missing.push(key);
  }

  if (missing.length === 0) return pass(id, name, routes.length + ' routes');
  fail(id, name, [
    ...missing.map((m) => '  no request for  ' + m), '',
    'A route with no case is code nobody has run. Add a request, or add an entry',
    'to scripts/check-exceptions.json saying why it cannot have one.',
  ]);
}

// ---------------------------------------------------------------------- C7
function c7TestidsInPageObjects({ pass, skip, fail }, exceptions) {
  const id = 'C7', name = 'every data-testid in public/ is addressed from a page object';
  if (!has('public') || !has('qa/e2e/pages')) {
    return skip(id, name, 'public/ or qa/e2e/pages/ does not exist yet');
  }

  const rendered = new Set();
  for (const file of [...walk(at('public'), '.html'), ...walk(at('public'), '.js')]) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/data-testid="([^"$]+)"/g)) rendered.add(m[1]);
    // A generated id such as tx-row-${tx.id} is only addressable by its prefix.
    for (const m of body.matchAll(/'data-testid':\s*`([^`]+)`/g)) {
      rendered.add(m[1].replace(/\$\{[^}]*\}/g, '').replace(/-+$/, '-'));
    }
  }

  const pages = walk(at('qa/e2e/pages'), '.js')
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

  // getByTestId(`keypad-${digit}`) covers keypad-0 .. keypad-9.
  const templatePrefixes = [...pages.matchAll(/getByTestId\(`([^`$]*)\$\{/g)].map((m) => m[1]);

  const missing = [];
  for (const testid of rendered) {
    const covered =
      pages.includes("'" + testid + "'") ||
      pages.includes('"' + testid + '"') ||
      pages.includes('`' + testid) ||
      pages.includes('/^' + testid) ||
      templatePrefixes.some((prefix) => prefix !== '' && testid.startsWith(prefix));
    if (!covered && !excepted(exceptions, 'C7', testid)) missing.push(testid);
  }

  if (missing.length === 0) return pass(id, name, rendered.size + ' testids');
  fail(id, name, [
    ...missing.sort().map((m) => '  no page object addresses  ' + m), '',
    'Locators live in page objects and nowhere else (D-012). A testid reached for',
    'from a spec is a locator that escaped.',
  ]);
}

// ---------------------------------------------------------------------- C8
function c8StatusesAsserted({ pass, skip, fail }, exceptions) {
  const id = 'C8', name = 'every status code src/ can return is asserted in the collection or qa/ai';
  if (!has('src')) return skip(id, name, 'src/ does not exist yet');

  const requests = collectionRequests();
  if (!requests) return skip(id, name, 'the collection does not exist yet');

  const produced = new Set();
  for (const file of walk(at('src'), '.js')) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/res\.status\((\d{3})\)/g)) produced.add(m[1]);
    for (const m of body.matchAll(/ApiError\((\d{3})/g)) produced.add(m[1]);
  }

  const scripts = requests
    .flatMap((r) => (r.event || []).filter((e) => e.listen === 'test'))
    .flatMap((e) => e.script.exec)
    .join('\n');

  const asserted = new Set();
  for (const m of scripts.matchAll(/expect(?:Status|Ok|Error)\((\d{3})/g)) asserted.add(m[1]);

  // D-036: the collection runs against a server with the AI feature off, so
  // statuses that need a provider (403 consent, 422 context, 502 invalid
  // answer) cannot be provoked there. qa/ai provokes them against a live-mode
  // server and a local fake, always through one helper whose call carries the
  // status AND the error code: expectApiError(response, 422, 'AI_...').
  // Counting only that shape keeps a bare number elsewhere from passing.
  if (has('qa/ai/tests')) {
    for (const file of walk(at('qa/ai/tests'), '.test.js')) {
      const body = fs.readFileSync(file, 'utf8');
      for (const m of body.matchAll(/expectApiError\(.*?,\s*(\d{3})\s*,\s*'[A-Z_]+'\s*\)/g)) asserted.add(m[1]);
    }
  }

  const missing = [...produced]
    .filter((code) => !asserted.has(code) && !excepted(exceptions, 'C8', code))
    .sort();

  if (missing.length === 0) {
    return pass(id, name, produced.size + ' produced, ' + asserted.size + ' asserted');
  }
  fail(id, name, [
    ...missing.map((m) => '  nothing provokes  ' + m), '',
    'A status nobody provokes is a branch nobody has executed. Add a case, or',
    'record in scripts/check-exceptions.json why it cannot be provoked.',
  ]);
}

// ---------------------------------------------------------------------- C9
/** An exception nobody needs any more is a lie waiting to be believed. */
function c9ExceptionsExplained({ pass, fail }, problems) {
  const id = 'C9', name = 'every exception carries a usable reason';
  if (problems.length === 0) return pass(id, name);
  fail(id, name, [...problems, '',
    'Fix the reason or drop the entry. An exception with nothing behind it',
    'excuses nothing and reads as though it does.']);
}


module.exports = {
  loadExceptions,
  c6RoutesCovered,
  c7TestidsInPageObjects,
  c8StatusesAsserted,
  c9ExceptionsExplained,
};
