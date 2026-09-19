'use strict';

// A local stand-in for the Gemini API, used by the Gemini adapter, evaluator and
// model-list tests. It never contacts anything; the test decides every answer.
//
// Generation (S31, D-044): POST /v1beta/models/{model}:generateContent — the
// documented generateContent method (read 2026-09-17). Success shape from the
// official GenerateContentResponse reference: `candidates[]` with
// `content.parts[]` of `{ text }` and `finishReason`, optional `promptFeedback`,
// and `usageMetadata` with `promptTokenCount`, `candidatesTokenCount`,
// `thoughtsTokenCount` and `totalTokenCount`. It is a fixture of the documented
// shape, not evidence that a real account answers this way.
//
//   plan(step)  { output } | { raw } | { status, body, headers } | { redirect }
//               | { hugeBytes } | { finishReason, usage, candidates, promptFeedback }
//               with optional { delayMs, gate }
//   requests    { model, apiKeyHeader, authorization, url, body } per request
//
// Model list (S31, D-044): GET /v1beta/models, shape from the official models
// reference (read 2026-09-17): { models: [{ name: "models/…",
// supportedGenerationMethods: [...] }], nextPageToken }.
//   planModels(step)  { models, nextPageToken } | { raw } | { status, body, headers } | { redirect }
//   modelRequests     { method, url, apiKeyHeader, authorization, bodyBytes } per request
//
//   stray       { method, url } of every request to any other route — the
//               Interactions route included, which the adapter no longer uses

const http = require('http');

const GENERATE_ROUTE = /^\/v1beta\/models\/([^/]+):generateContent$/;

function generateContentEnvelope(output, { usage, finishReason = 'STOP', candidates, promptFeedback } = {}) {
  const body = {
    candidates: candidates || [{ content: { role: 'model', parts: [{ text: JSON.stringify(output) }] }, finishReason, index: 0 }],
    usageMetadata: usage === undefined ? { promptTokenCount: 120, candidatesTokenCount: 40, totalTokenCount: 160 } : usage,
    modelVersion: 'fake-gemini-model',
    responseId: 'fake-response-id',
  };
  if (usage === null) delete body.usageMetadata;
  if (promptFeedback) body.promptFeedback = promptFeedback;
  return body;
}

function createFakeGemini() {
  const queue = [];
  const requests = [];
  const unplanned = [];
  const modelQueue = [];
  const modelRequests = [];
  const stray = [];
  const gates = new Map();
  let server = null;

  const plan = (step) => queue.push(step);
  const planModels = (step) => modelQueue.push(step);

  async function readBody(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    return Buffer.concat(chunks).toString('utf8');
  }

  async function respond(res, step) {
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
    if (step.gate) {
      await new Promise((resolve) => {
        if (gates.get(step.gate) === 'open') return resolve();
        gates.set(step.gate, resolve);
      });
    }
    if (res.destroyed) return;
    if (step.redirect) {
      res.writeHead(302, { Location: 'http://127.0.0.1:1/steal' });
      return res.end();
    }
    if (step.status) {
      res.writeHead(step.status, { 'Content-Type': 'application/json', ...(step.headers || {}) });
      return res.end(JSON.stringify(step.body || { error: { code: step.status, message: 'fake upstream error' } }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (step.hugeBytes) {
      const chunk = 'x'.repeat(8192);
      let sent = 0;
      while (sent < step.hugeBytes && !res.destroyed) {
        res.write(chunk);
        sent += chunk.length;
      }
      return res.end();
    }
    if (step.raw !== undefined) return res.end(typeof step.raw === 'string' ? step.raw : JSON.stringify(step.raw));
    return res.end(JSON.stringify(generateContentEnvelope(step.output, step)));
  }

  async function handler(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    const generate = GENERATE_ROUTE.exec(url.pathname);
    if (generate && req.method === 'POST') {
      const body = await readBody(req);
      let parsed = null;
      try { parsed = JSON.parse(body); } catch { parsed = null; }
      const record = { model: decodeURIComponent(generate[1]), apiKeyHeader: req.headers['x-goog-api-key'] || null, authorization: req.headers.authorization || null, url: req.url, body: parsed };
      requests.push(record);
      const step = queue.shift();
      if (!step) {
        unplanned.push(record);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end('{"error":{"message":"unplanned request"}}');
      }
      return respond(res, step);
    }
    if (url.pathname === '/v1beta/models') {
      const body = await readBody(req);
      modelRequests.push({ method: req.method, url: req.url, apiKeyHeader: req.headers['x-goog-api-key'] || null, authorization: req.headers.authorization || null, bodyBytes: Buffer.byteLength(body) });
      const step = modelQueue.shift();
      if (!step || req.method !== 'GET') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end('{"error":{"message":"unplanned model list request"}}');
      }
      if (step.redirect) {
        res.writeHead(302, { Location: 'http://127.0.0.1:1/steal' });
        return res.end();
      }
      if (step.status) {
        res.writeHead(step.status, { 'Content-Type': 'application/json', ...(step.headers || {}) });
        return res.end(JSON.stringify(step.body || { error: { code: 'not_found', message: 'fake upstream error' } }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (step.raw !== undefined) return res.end(typeof step.raw === 'string' ? step.raw : JSON.stringify(step.raw));
      return res.end(JSON.stringify({ models: step.models, ...(step.nextPageToken ? { nextPageToken: step.nextPageToken } : {}) }));
    }
    await readBody(req);
    stray.push({ method: req.method, url: req.url });
    res.writeHead(404);
    return res.end();
  }

  function listen(port = 0) {
    return new Promise((resolve) => {
      server = http.createServer((req, res) => {
        handler(req, res).catch(() => {
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
      });
      server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
    });
  }

  function openGate(name) {
    const waiting = gates.get(name);
    gates.set(name, 'open');
    if (typeof waiting === 'function') waiting();
  }

  function close() {
    for (const waiting of gates.values()) if (typeof waiting === 'function') waiting();
    if (!server) return Promise.resolve();
    return new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  function reset() {
    for (const waiting of gates.values()) if (typeof waiting === 'function') waiting();
    queue.length = 0;
    requests.length = 0;
    unplanned.length = 0;
    modelQueue.length = 0;
    modelRequests.length = 0;
    stray.length = 0;
    gates.clear();
  }

  return { plan, planModels, listen, close, reset, openGate, requests, unplanned, queue, modelRequests, stray };
}

module.exports = { createFakeGemini, generateContentEnvelope };
