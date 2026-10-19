'use strict';

// C6-C8 compare static source declarations. They do not prove that a request,
// locator, or status assertion executed; runtime suites provide that evidence.
//
// Exceptions live in scripts/check-exceptions.json and need a written reason.
// An exception records a current unaddressed static item and its limitation.
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
  const empty = { C6: [], C7: [], C8: [] };
  if (!fs.existsSync(file)) return {
    data: empty,
    problems: ['required scripts/check-exceptions.json is missing'],
  };
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { return { data: empty, problems: [`invalid exception JSON: ${error.message}`] }; }
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { data: empty, problems: ['exception file must be an object'] };
  }
  for (const gate of ['C6', 'C7', 'C8']) {
    if (!Array.isArray(data[gate])) {
      problems.push(`${gate}: exceptions must be an array`);
      data[gate] = [];
      continue;
    }
    const seen = new Set();
    const validEntries = [];
    for (const entry of data[gate]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        typeof entry.item !== 'string' || !entry.item.trim() || entry.item !== entry.item.trim()) {
        problems.push(`${gate}: exception has an invalid item`);
        continue;
      }
      validEntries.push(entry);
      if (seen.has(entry.item)) problems.push(`${gate}: duplicate exception "${entry.item}"`);
      seen.add(entry.item);
      if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) {
        problems.push(`${gate}: exception "${entry.item}" has no usable reason`);
      }
    }
    data[gate] = validEntries;
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

function inventoryC6() {
  if (!has('src/server.js')) return { error: 'required src/server.js is missing' };
  const requests = collectionRequests();
  if (!requests || requests.length === 0) return { error: 'required collection has no requests or is missing' };
  const server = fs.readFileSync(at('src/server.js'), 'utf8');
  const routes = [];
  const missingFiles = [];
  for (const m of server.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
    routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  for (const m of server.matchAll(/app\.use\(\s*'([^']+)'[^)]*require\('\.\/(routes\/[\w-]+)'\)/g)) {
    const routeFile = at('src', m[2] + '.js');
    if (!fs.existsSync(routeFile)) { missingFiles.push(path.relative(ROOT, routeFile)); continue; }
    for (const r of fs.readFileSync(routeFile, 'utf8').matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      routes.push({ method: r[1].toUpperCase(), path: m[1] + (r[2] === '/' ? '' : r[2]) });
    }
  }
  if (missingFiles.length) return { error: missingFiles.map(file => `mounted route file missing: ${file}`).join('; ') };
  if (!routes.length) return { error: 'server and mounted routers expose no routes' };
  const covered = new Set(requests.map(r =>
    (r.request.method || 'GET').toUpperCase() + ' ' + normalisePath(r.request.url.path || [])));
  return { items: new Set(routes.map(route => route.method + ' ' + route.path)),
    covered: new Set(routes.filter(route => covered.has(route.method + ' ' +
      normalisePath(route.path.replace(/^\//, '').split('/'))))
      .map(route => route.method + ' ' + route.path)) };
}

function inventoryC7() {
  if (!has('public') || !has('qa/e2e/pages')) return { error: 'required public/ or qa/e2e/pages/ is missing' };
  const publicFiles = [...walk(at('public'), '.html'), ...walk(at('public'), '.js')];
  const pageFiles = walk(at('qa/e2e/pages'), '.js');
  if (!publicFiles.length || !pageFiles.length) return { error: 'public/ or qa/e2e/pages/ has no JavaScript/HTML inventory' };
  const items = new Set();
  for (const file of publicFiles) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/data-testid="([^"$]+)"/g)) items.add(m[1]);
    for (const m of body.matchAll(/'data-testid':\s*`([^`]+)`/g)) {
      items.add(m[1].replace(/\$\{[^}]*\}/g, '').replace(/-+$/, '-'));
    }
  }
  if (!items.size) return { error: 'no rendered data-testid values were found' };
  const pages = pageFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const prefixes = [...pages.matchAll(/getByTestId\(`([^`$]*)\$\{/g)].map(m => m[1]);
  const covered = new Set([...items].filter(testid =>
    pages.includes("'" + testid + "'") || pages.includes('"' + testid + '"') ||
    pages.includes('`' + testid) || pages.includes('/^' + testid) ||
    prefixes.some(prefix => prefix !== '' && testid.startsWith(prefix))));
  return { items, covered };
}

function inventoryC8() {
  if (!has('src')) return { error: 'required src/ is missing' };
  const requests = collectionRequests();
  if (!requests || !requests.length) return { error: 'required collection has no requests or is missing' };
  const files = walk(at('src'), '.js');
  if (!files.length) return { error: 'src/ has no JavaScript source files' };
  const items = new Set();
  for (const file of files) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/res\.status\((\d{3})\)/g)) items.add(m[1]);
    for (const m of body.matchAll(/ApiError\((\d{3})/g)) items.add(m[1]);
  }
  if (!items.size) return { error: 'source files expose no status codes to check' };
  const scripts = requests.flatMap(r => (r.event || []).filter(e => e.listen === 'test'))
    .flatMap(e => e.script.exec).join('\n');
  const asserted = new Set();
  for (const m of scripts.matchAll(/expect(?:Status|Ok|Error)\((\d{3})/g)) asserted.add(m[1]);
  if (has('qa/ai/tests')) {
    for (const file of walk(at('qa/ai/tests'), '.test.js')) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/expectApiError\(.*?,\s*(\d{3})\s*,\s*'[A-Z_]+'\s*\)/g)) asserted.add(m[1]);
    }
  }
  if (!asserted.size) return { error: 'no status assertions were found' };
  return { items, covered: asserted, assertedCount: asserted.size };
}

/**
 * "{{txA}}", "41" and ":id" are all just "an id" for this static comparison: one
 * is how the collection writes a variable, one is a literal in a URL, one is
 * how Express writes a parameter.
 *
 * Missing the third produced this gate's first false positive. This mapping
 * compares declarations; it is not proof that a request executed.
 */
const normalisePath = (segments) =>
  '/' + segments
    .map((s) =>
      /^\{\{.+\}\}$/.test(s) || /^\d+$/.test(s) || s.startsWith(':') ? ':param' : s)
    .join('/');

// ---------------------------------------------------------------------- C6
function c6RoutesCovered({ pass, fail }, exceptions, inventory = inventoryC6()) {
  const id = 'C6', name = 'static route/request declarations';
  if (inventory.error) return fail(id, name, [inventory.error]);
  const missing = [...inventory.items].filter(item => !inventory.covered.has(item) && !excepted(exceptions, id, item));
  if (!missing.length) return pass(id, name, inventory.items.size + ' route declarations');
  fail(id, name, missing.map(item => '  no matching request declaration for  ' + item));
}

// ---------------------------------------------------------------------- C7
function c7TestidsInPageObjects({ pass, fail }, exceptions, inventory = inventoryC7()) {
  const id = 'C7', name = 'static testid/page-object addressability';
  if (inventory.error) return fail(id, name, [inventory.error]);
  const missing = [...inventory.items].filter(item => !inventory.covered.has(item) && !excepted(exceptions, id, item));
  if (!missing.length) return pass(id, name, inventory.items.size + ' testid declarations');
  fail(id, name, missing.sort().map(item => '  no page-object address for  ' + item));
}

// ---------------------------------------------------------------------- C8
function c8StatusesAsserted({ pass, fail }, exceptions, inventory = inventoryC8()) {
  const id = 'C8', name = 'static global status-assertion declarations';
  if (inventory.error) return fail(id, name, [inventory.error]);
  const missing = [...inventory.items].filter(item => !inventory.covered.has(item) && !excepted(exceptions, id, item));
  if (!missing.length) return pass(id, name, `${inventory.items.size} source statuses, ${inventory.assertedCount} asserted literals`);
  fail(id, name, missing.sort().map(item => '  no matching status assertion declaration for  ' + item));
}

// ---------------------------------------------------------------------- C9
/** An exception nobody needs any more is a lie waiting to be believed. */
function c9ExceptionsExplained({ pass, fail }, problems, exceptions, inventories) {
  const id = 'C9', name = 'static exception identity and reason validation';
  for (const gate of ['C6', 'C7', 'C8']) {
    const inventory = inventories[gate];
    if (inventory.error) { problems.push(`${gate}: inventory unavailable; exception identity cannot be checked`); continue; }
    for (const entry of exceptions[gate]) {
      if (!entry || typeof entry.item !== 'string' || !entry.item.trim()) continue;
      if (!inventory.items.has(entry.item)) problems.push(`${gate}: stale exception "${entry.item}" is not in current inventory`);
      else if (inventory.covered.has(entry.item)) problems.push(`${gate}: redundant exception "${entry.item}" is already addressed`);
    }
  }
  if (problems.length === 0) return pass(id, name);
  fail(id, name, problems);
}


module.exports = {
  loadExceptions,
  inventoryC6,
  inventoryC7,
  inventoryC8,
  c6RoutesCovered,
  c7TestidsInPageObjects,
  c8StatusesAsserted,
  c9ExceptionsExplained,
};
