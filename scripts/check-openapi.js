#!/usr/bin/env node
'use strict';

const { readDocument, sourceInventory, validateDocument } = require('./lib/openapi');

async function main() {
  const source = sourceInventory();
  const { operations, refs } = await validateDocument(readDocument(), source);
  console.log(`OpenAPI PASS: ${operations.length}/${source.length} source operations, ${refs} local refs.`);
  console.log('Parser schema/local-ref validation + inventory/auth/unique IDs/path parameters/typed responses/headers/empty204.');
  console.log('Focused literal-route scanner; not an AST or dynamic Express router interpreter. HTTP execution is a separate test:contract gate.');
  for (const op of operations) console.log(op.key);
}

if (require.main === module) main().catch(err => { console.error('OpenAPI FAIL: ' + err.message); process.exitCode = 1; });
module.exports = { main };
