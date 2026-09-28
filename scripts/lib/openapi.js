'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Parser = require('@apidevtools/swagger-parser');

const ROOT = path.resolve(__dirname, '../..');
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const PUBLIC = new Set(['GET /api/health', 'POST /api/auth/register', 'POST /api/auth/login']);

// Focused scanner, NOT a JavaScript AST/Express router interpreter. Accepts the
// current literal app.method(...) and requireAuth + inline require mount form.
// Refuses unsupported declarations instead of silently claiming full coverage.
// Conditional/dynamic router registration needs a reviewed scanner update.
function withoutComments(source) {
  let out = '', quote = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') out += source[++i] || '';
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c; out += c;
    } else if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' '; i++;
      }
      i++; out += ' ';
    } else out += c;
  }
  return out;
}

function literalRoutes(source, owner, prefix, protectedMount) {
  assert.ok(!new RegExp('\\b' + owner + '\\s*(?:\\[|\\.\\s*(?:all|route)\\s*\\()').test(source), 'Unsupported computed/all/chained route declaration: ' + owner);
  const declarations = [...source.matchAll(new RegExp('\\b' + owner + '\\s*\\.\\s*(?:' + METHODS.join('|') + ')\\s*\\(', 'g'))];
  const matches = [...source.matchAll(new RegExp('\\b' + owner + '\\s*\\.\\s*(' + METHODS.join('|') + ')\\s*\\(\\s*([\\\'\"])\\s*([^\\\'\"]*)\\2\\s*,', 'g'))];
  assert.equal(matches.length, declarations.length, 'Unsupported dynamic route declaration: ' + owner);
  return matches.map(m => {
    let route = m[3];
    assert.ok(route.startsWith('/'), 'Route must be an absolute literal path');
    if (prefix && route === '/') route = '';
    route = (prefix + route).replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    assert.ok(!/[?*()+]/.test(route), 'Unsupported route pattern');
    const key = m[1].toUpperCase() + ' ' + route;
    assert.ok(protectedMount || PUBLIC.has(key), 'Unexpected public operation; review auth: ' + key);
    return { method: m[1], path: route, key, protected: protectedMount };
  });
}

function inventoryFromSources(serverSource, readRouter) {
  const source = withoutComments(serverSource);
  const operations = literalRoutes(source, 'app', '', false);
  const mounts = [...source.matchAll(/\bapp\s*\.\s*use\s*\(\s*'([^']+)'\s*,\s*rememberMount\s*,\s*requireAuth\s*,\s*require\('([^']+)'\)\s*\)/g)];
  const candidates = [...source.matchAll(/\bapp\s*\.\s*use\s*\(\s*(['"`])([^'"`]*)\1/g)].filter(m => m[2].startsWith('/api/'));
  assert.equal(mounts.length, candidates.length, 'Unsupported API mount form; update focused inventory scanner');
  // The current nonliteral middleware forms are deliberately allow-listed.
  // Other/dynamic mounts cannot disappear from an apparently complete scan.
  for (const call of source.matchAll(/\bapp\s*\.\s*use\s*\(\s*/g)) {
    const tail = source.slice(call.index + call[0].length);
    if (/^['"`]/.test(tail)) continue;
    assert.ok(/^(?:requestContext\s*\)|express\.(?:json|static)\s*\(|\(err,\s*req,\s*res,\s*next\)\s*=>)/.test(tail), 'Unsupported dynamic app.use declaration');
  }
  for (const mount of mounts) {
    assert.ok(/^\.\/routes\/[a-z-]+$/.test(mount[2]), 'Only local literal router modules allowed');
    const router = withoutComments(readRouter(mount[2]));
    assert.ok(!/\brouter\s*\.\s*(?:use|route)\s*\(/.test(router), 'Unsupported nested/chained routers require scanner review');
    operations.push(...literalRoutes(router, 'router', mount[1], true));
  }
  const keys = operations.map(op => op.key);
  assert.equal(new Set(keys).size, keys.length, 'Duplicate source operation');
  return operations.sort((a, b) => a.key.localeCompare(b.key));
}

function sourceInventory(root = ROOT) {
  return inventoryFromSources(fs.readFileSync(path.join(root, 'src/server.js'), 'utf8'),
    module => fs.readFileSync(path.join(root, 'src', module + '.js'), 'utf8'));
}

function documentInventory(doc) {
  return Object.entries(doc.paths).flatMap(([route, item]) =>
    METHODS.filter(method => item[method]).map(method => ({
      method, path: route, key: method.toUpperCase() + ' ' + route, operation: item[method], item,
    }))).sort((a, b) => a.key.localeCompare(b.key));
}

function assertInventory(doc, source) {
  assert.deepEqual(documentInventory(doc).map(op => op.key), source.map(op => op.key).sort(), 'Operation inventory mismatch');
}

function assertLocalRefs(doc) {
  let count = 0;
  const stack = [doc];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if ('$ref' in value) {
      assert.equal(typeof value.$ref, 'string');
      assert.ok(value.$ref.startsWith('#/'), 'Nonlocal reference refused'); count++;
    }
    stack.push(...Object.values(value));
  }
  return count;
}

function assertTypedResponse(schema) {
  assert.ok(schema && ['object', 'array', 'string', 'integer', 'number', 'boolean'].includes(schema.type), 'Untyped response schema');
  if (schema.type === 'array') assertTypedResponse(schema.items);
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, 'Response object must reject unknown fields');
    assert.deepEqual([...(schema.required || [])].sort(), Object.keys(schema.properties || {}).sort(), 'Response fields must be explicit and required');
    Object.values(schema.properties).forEach(assertTypedResponse);
  }
}

async function validateDocument(doc, source = sourceInventory()) {
  assert.equal(doc.openapi, '3.0.3');
  const refs = assertLocalRefs(doc);
  // validate.spec is ignored for OpenAPI3 by Parser12: semantic gates below
  // are intentional. Never use external refs or a permissive schema fallback.
  const api = await Parser.validate(structuredClone(doc), {
    resolve: { external: false, file: false, http: false },
    dereference: { circular: false }, validate: { schema: true, spec: true },
  });
  assertInventory(api, source);
  const ids = new Set();
  for (const { key, path: route, operation: op, item } of documentInventory(api)) {
    assert.ok(op.operationId && !ids.has(op.operationId), 'Missing/duplicate operationId'); ids.add(op.operationId);
    const own = source.find(actual => actual.key === key);
    assert.deepEqual(op.security || api.security, own.protected ? [{ bearerAuth: [] }] : [], 'Auth mismatch: ' + key);
    const params = [...(item.parameters || []), ...(op.parameters || [])];
    const pairs = params.map(p => p.in + ':' + p.name);
    assert.equal(new Set(pairs).size, pairs.length, 'Duplicate parameter');
    const expectedParams = [...route.matchAll(/\{([^}]+)\}/g)].map(m => m[1]).sort();
    const pathParams = params.filter(p => p.in === 'path');
    assert.deepEqual(pathParams.map(p => p.name).sort(), expectedParams, 'Path parameter mismatch');
    assert.ok(pathParams.every(p => p.required && p.schema), 'Path params must be required and typed');
    assert.ok(Object.keys(op.responses).length > 0, 'Missing responses');
    for (const [status, response] of Object.entries(op.responses)) {
      assert.ok(/^[1-5][0-9]{2}$/.test(status), 'Explicit statuses required; no default fallback');
      const id = response.headers?.['X-Request-Id'];
      assert.equal(id?.['x-required'], true, 'Request-ID header must be required');
      assert.equal(id.schema.type, 'string');
      if (status === '204') { assert.equal(response.content, undefined, '204 must have no content'); continue; }
      const media = response.content?.['application/json'];
      assert.ok(media?.schema, 'Missing typed JSON response');
      assertTypedResponse(media.schema);
      if (Number(status) >= 400) {
        assert.deepEqual(media.schema.required, ['error'], 'Nested error required');
        assert.ok(media.schema.properties.error.properties.code.enum?.length, 'Selected error-code enum required');
      }
      if (status === '429') assert.equal(response.headers?.['Retry-After']?.['x-required'], true);
    }
  }
  return { api, operations: documentInventory(api), refs };
}

function readDocument() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'spec/openapi.json'), 'utf8'));
}

module.exports = { ROOT, METHODS, PUBLIC, withoutComments, inventoryFromSources, sourceInventory, documentInventory, assertInventory, assertLocalRefs, assertTypedResponse, validateDocument, readDocument };
