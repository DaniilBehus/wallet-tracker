'use strict';

const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { documentInventory } = require('../../scripts/lib/openapi');

class ContractError extends Error {
  constructor(kind, context, errors = []) {
    // Never include response values (registration/login responses contain JWTs).
    super(`Contract ${kind} rejected: ${context}`);
    this.name = 'ContractError'; this.kind = kind;
    this.errors = errors.map(({ keyword, instancePath }) => ({ keyword, instancePath }));
  }
}

function createAjv() {
  const ajv = new Ajv({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
  addFormats(ajv);
  // The sole extra OAS annotation present in response schemas. It asserts
  // nothing and modifies nothing. Unknown validation keywords still fail.
  ajv.addKeyword({ keyword: 'example', valid: true });
  return ajv;
}

function createResponseValidator(api) {
  const ajv = createAjv();
  const operations = documentInventory(api);
  const compiled = new Map();
  for (const { key, operation } of operations) {
    const statuses = new Map();
    for (const [status, response] of Object.entries(operation.responses)) {
      const headers = Object.entries(response.headers || {}).map(([name, value]) => ({
        name: name.toLowerCase(), required: value['x-required'] === true, validate: ajv.compile(value.schema),
      }));
      const media = new Map(Object.entries(response.content || {}).map(([type, value]) => [type.toLowerCase(), ajv.compile(value.schema)]));
      statuses.set(Number(status), { headers, media });
    }
    compiled.set(key, statuses);
  }

  function operationKey(method, pathname) {
    const matches = operations.filter(op => {
      if (op.method.toUpperCase() !== method.toUpperCase()) return false;
      const want = op.path.split('/'), actual = pathname.split('/');
      return want.length === actual.length && want.every((part, i) => /^\{[^}]+\}$/.test(part) ? actual[i].length > 0 : part === actual[i]);
    });
    if (matches.length !== 1) throw new ContractError('operation', method + ' ' + pathname);
    return matches[0].key;
  }

  function validate(key, capture, { replay = undefined } = {}) {
    const before = structuredClone(capture);
    try {
      const response = compiled.get(key)?.get(capture.status);
      if (!response) throw new ContractError('status', key + ' ' + capture.status);
      const headers = Object.fromEntries(Object.entries(capture.headers).map(([name, value]) => [name.toLowerCase(), value]));
      for (const header of response.headers) {
        if (!(header.name in headers)) {
          if (header.required) throw new ContractError('header', key + ' missing ' + header.name);
        } else if (!header.validate(headers[header.name])) {
          throw new ContractError('header', key + ' invalid ' + header.name, header.validate.errors);
        }
      }
      if (replay !== undefined && (headers['idempotency-replayed'] === 'true') !== replay) {
        throw new ContractError('header', key + ' conditional idempotency-replayed');
      }
      if (capture.status === 204) {
        if (capture.text !== '' || capture.body !== null || headers['content-type']) throw new ContractError('empty204', key);
        return capture.body;
      }
      const type = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const check = response.media.get(type);
      if (!check) throw new ContractError('media', key + ' unsupported/missing media');
      let parsed;
      try { parsed = JSON.parse(capture.text); } catch { throw new ContractError('json', key); }
      assert.ok(isDeepStrictEqual(capture.body, parsed), 'Capture must retain actual parsed wire body (values withheld)');
      if (!check(capture.body)) throw new ContractError('body', key + ' ' + capture.status, check.errors);
      if (key === 'POST /api/ai/expense-draft' && capture.status === 200 && capture.body.request_id !== headers['x-request-id']) {
        throw new ContractError('correlation', key);
      }
      return capture.body;
    } finally {
      assert.ok(isDeepStrictEqual(capture, before), 'Response validation must not modify headers/body/text (values withheld)');
    }
  }

  return { validate, operationKey, operations };
}

module.exports = { ContractError, createAjv, createResponseValidator };
