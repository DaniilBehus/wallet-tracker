#!/usr/bin/env node
'use strict';

// Documentation exporter for docs/analysis. No app server, database or provider calls.
//
//   npm install --prefix output/analysis-tools --no-save --package-lock=false --ignore-scripts bpmn-js@18.30.1 mermaid@12.0.0
//   node scripts/render-analysis.js output/analysis-tools [model ...]
//
// Checks every model and regenerates its preview. BPMN is parsed with
// bpmn-moddle, checked for structure, imported with bpmn-js, round-tripped and
// exported. Mermaid goes through Mermaid's own parse and render. The UML SVG is
// its own source, so it is checked, not regenerated. Every relative link and
// anchor in the pages must resolve and each page's Mermaid block must equal its
// .mmd file. A warning, a clipped label, a broken link or a mismatched block
// fails the run. Review PNGs and validation JSON go to output/analysis-review/
// and are not committed. Tools are installed separately; package.json and its
// lockfile stay unchanged.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs/analysis');
const tools = path.resolve(root, process.argv[2] || 'output/analysis-tools');
const review = path.join(root, 'output/analysis-review');

const MODELS = {
  'ai-expense-process': {
    kind: 'bpmn',
    title: 'AI-assisted expense entry — BPMN 2.0',
    desc: 'Draft guards, editable review, cancellation and an explicit keyed-save subprocess; extraction messages cross to a separate adapter participant.',
  },
  'monthly-limit-process': {
    kind: 'bpmn',
    title: 'Monthly spending limit — BPMN 2.0',
    desc: 'Set, clear or preserve a limit; record an expense; compute four states without blocking saving.',
  },
  'category-limit-process': {
    kind: 'bpmn',
    title: 'Category spending limits — BPMN 2.0',
    desc: 'Ownership-safe set or clear, non-blocking expense saves, four category states computed on read; owner acceptance is recorded separately in the linked UAT document.',
  },
  'draft-save-sequence': {
    kind: 'mermaid',
    title: 'Draft then explicit save — sequence',
    desc: 'An AI draft writes nothing; the keyed save commits, replays or rolls back inside one database transaction.',
  },
  database: {
    kind: 'mermaid',
    title: 'Database — schema and category limits',
    desc: 'Schema and declared foreign keys, including the nullable category-limit column with its enforced CHECK; owner acceptance is recorded separately in the linked UAT document.',
  },
  'use-cases': { kind: 'uml' },
};

const chosen = process.argv.slice(3);
for (const name of chosen) if (!MODELS[name]) throw new Error('Unknown model: ' + name);
const models = chosen.length ? chosen : Object.keys(MODELS);

// ------------------------------------------------------------------ pages

// GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens.
const slug = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

function checkLinks() {
  const broken = [];
  let checked = 0;
  for (const page of fs.readdirSync(docs).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(docs, page), 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(href)) continue;
      checked += 1;
      const [file, anchor] = href.split('#');
      const target = file ? path.resolve(docs, file) : path.join(docs, page);
      let ok = fs.existsSync(target);
      if (ok && anchor && target.endsWith('.md')) {
        ok = [...fs.readFileSync(target, 'utf8').matchAll(/^#+\s+(.*)$/gm)].some((m) => slug(m[1]) === anchor);
      }
      if (!ok) broken.push(page + ' -> ' + href);
    }
  }
  console.log(JSON.stringify({ step: 'LINKS', checked, broken }));
  if (broken.length) throw new Error('Broken links: ' + broken.join('; '));
}

function checkMermaidBlock(model) {
  const source = fs.readFileSync(path.join(docs, model + '.mmd'), 'utf8');
  const page = fs.readFileSync(path.join(docs, model + '.md'), 'utf8');
  const blocks = [...page.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (blocks.length !== 1 || blocks[0] !== source || !page.includes('<!-- diagram-source: ' + model + '.mmd -->')) {
    throw new Error(model + '.md must hold exactly one Mermaid block, equal to ' + model + '.mmd');
  }
  return source;
}

// ------------------------------------------------------------------ BPMN

async function checkBpmnStructure(model, xml) {
  const moddlePath = require.resolve('bpmn-moddle', { paths: [path.join(tools, 'node_modules')] });
  const { BpmnModdle } = await import(pathToFileURL(moddlePath).href);
  const moddle = new BpmnModdle();
  const parsed = await moddle.fromXML(xml);
  const xmlWarnings = parsed.warnings.map((w) => w.message);
  console.log(JSON.stringify({ model, step: 'XML_PARSE', warnings: xmlWarnings }));
  if (xmlWarnings.length) throw new Error('BPMN XML parse warnings');

  // Relationships as well as syntax, including the hidden save subprocess.
  const elements = Object.values(parsed.elementsById);
  const sequenceFlows = elements.filter((e) => e.$type === 'bpmn:SequenceFlow');
  for (const flow of sequenceFlows) {
    if (!flow.sourceRef || !flow.targetRef
      || flow.sourceRef.$parent !== flow.targetRef.$parent
      || flow.$parent !== flow.sourceRef.$parent) {
      throw new Error('Sequence flow crosses a process boundary: ' + flow.id);
    }
  }
  for (const gate of elements.filter((e) => e.$type === 'bpmn:ExclusiveGateway')) {
    const outgoing = sequenceFlows.filter((f) => f.sourceRef === gate);
    if (outgoing.length > 1 && (!gate.default
      || outgoing.some((f) => f !== gate.default && !f.conditionExpression))) {
      throw new Error('Exclusive branches need conditions and a default: ' + gate.id);
    }
  }
  const collaboration = parsed.rootElement.rootElements.find((e) => e.$type === 'bpmn:Collaboration');
  const participantOf = (element) => {
    if (element.$type === 'bpmn:Participant') return element;
    let parent = element;
    while (parent && parent.$type !== 'bpmn:Process') parent = parent.$parent;
    return collaboration.participants.find((p) => p.processRef === parent);
  };
  for (const message of collaboration.messageFlows) {
    const from = participantOf(message.sourceRef);
    const to = participantOf(message.targetRef);
    if (!from || !to || from === to) throw new Error('Invalid message boundary: ' + message.id);
  }
  console.log(JSON.stringify({ model, step: 'STRUCTURE', sequenceFlows: sequenceFlows.length,
    messageFlows: collaboration.messageFlows.length, result: 'PASS' }));
  return { moddle, xmlWarnings };
}

async function renderBpmn(page, model) {
  const xml = fs.readFileSync(path.join(docs, model + '.bpmn'), 'utf8');
  const { moddle, xmlWarnings } = await checkBpmnStructure(model, xml);

  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.setContent('<div id="canvas" style="width:1750px;height:950px"></div>');
  await page.addScriptTag({ path: path.join(tools, 'node_modules/bpmn-js/dist/bpmn-viewer.development.js') });
  const rendered = await page.evaluate(async (content) => {
    const viewer = new window.BpmnJS({ container: '#canvas' });
    const { warnings } = await viewer.importXML(content);
    const { xml: roundTrip } = await viewer.saveXML({ format: true });
    const { svg } = await viewer.saveSVG();
    viewer.destroy();
    return { warnings: warnings.map((w) => w.message), svg, roundTrip };
  }, xml);
  console.log(JSON.stringify({ model, step: 'BPMN_IMPORT', warnings: rendered.warnings }));
  if (rendered.warnings.length) throw new Error('BPMN viewer import warnings');
  const reparsed = await moddle.fromXML(rendered.roundTrip);
  if (reparsed.warnings.length) throw new Error('Round-trip XML warnings');
  console.log(JSON.stringify({ model, step: 'XML_ROUND_TRIP', warnings: [], result: 'PASS' }));

  // bpmn-js names its arrow markers at random on every export; numbering them
  // in order of definition lets a preview change only when its model does.
  // Only the ids of <marker> elements are renamed, whole, never the marker-end
  // property that points at them.
  const markers = [...rendered.svg.matchAll(/<marker id="([^"]+)"/g)].map((m) => m[1]);
  const svg = markers.reduce((out, id, i) =>
    out.replace(new RegExp(id + '(?![\\w-])', 'g'), `${model}-marker-${i + 1}`), rendered.svg);
  return { svg, warnings: { xmlWarnings, importWarnings: rendered.warnings } };
}

// ------------------------------------------------------------------ Mermaid

async function renderMermaid(page, model) {
  const source = checkMermaidBlock(model);
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.setContent('<div id="host"></div>');
  await page.addScriptTag({ path: path.join(tools, 'node_modules/mermaid/dist/mermaid.min.js') });
  const svg = await page.evaluate(async ({ id, text }) => {
    const { mermaid } = window;
    // SVG text labels rather than HTML inside foreignObject, so the preview
    // reads the same in any SVG viewer and the clipping check can measure it.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
      htmlLabels: false,
      // The ER renderer draws its lines through rough.js, which jitters
      // control points at random; a fixed seed keeps the preview byte-stable.
      handDrawnSeed: 1,
      er: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
    });
    await mermaid.parse(text);
    return (await mermaid.render(id, text)).svg;
  }, { id: model, text: source });
  console.log(JSON.stringify({ model, step: 'MERMAID_PARSE_AND_RENDER', result: 'PASS' }));
  return { svg, warnings: {} };
}

// ------------------------------------------------------------------ previews

async function exportPreview(page, model, { svg, warnings }) {
  const { title, desc } = MODELS[model];
  // An opaque background keeps black notation readable in either GitHub theme.
  const finished = svg.replace(/(<svg\b[^>]*>)/,
    '$1<title>' + title + '</title><desc>' + desc + '</desc><rect width="100%" height="100%" fill="#ffffff"/>');
  await page.setContent('<style>body{margin:0;background:white}svg{display:block}</style>' + finished);
  const layout = await measure(page);
  if (layout.clipped.length) throw new Error(model + ': clipped SVG labels: ' + layout.clipped.join('; '));
  fs.writeFileSync(path.join(docs, model + '.svg'), finished);
  await page.locator('svg').first().screenshot({ path: path.join(review, model + '.png') });
  fs.writeFileSync(path.join(review, model + '-validation.json'), JSON.stringify({ ...warnings, layout }, null, 2) + '\n');
  console.log(JSON.stringify({ model, step: 'SVG_EXPORT', output: 'docs/analysis/' + model + '.svg', ...layout }));
}

/**
 * Every text label must lie inside the drawing and inside the one box it is
 * drawn in — a note, an actor, a task — and every use-case ellipse must hold one.
 */
function measure(page) {
  return page.locator('svg').first().evaluate((element) => {
    const box = element.getBoundingClientRect();
    const texts = Array.from(element.querySelectorAll('text')).filter((t) => t.textContent.trim());
    const outside = (b, frame) => b.left < frame.left - 1 || b.right > frame.right + 1
      || b.top < frame.top - 1 || b.bottom > frame.bottom + 1;
    const clipped = texts.filter((text) => {
      const b = text.getBoundingClientRect();
      if (outside(b, box)) return true;
      const rects = Array.from(text.parentNode.children).filter((sibling) => sibling.tagName === 'rect');
      return rects.length === 1 && outside(b, rects[0].getBoundingClientRect());
    }).map((text) => text.textContent);
    const unlabelled = Array.from(element.querySelectorAll('ellipse')).filter((ellipse) => {
      const e = ellipse.getBoundingClientRect();
      return !texts.some((text) => {
        const b = text.getBoundingClientRect();
        const x = (b.left + b.right) / 2;
        const y = (b.top + b.bottom) / 2;
        return x > e.left && x < e.right && y > e.top && y < e.bottom;
      });
    }).length;
    return { width: Math.round(box.width), height: Math.round(box.height), labels: texts.length,
      ellipses: element.querySelectorAll('ellipse').length, unlabelled, clipped };
  });
}

async function checkStaticSvg(page, model) {
  const svg = fs.readFileSync(path.join(docs, model + '.svg'), 'utf8');
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.setContent('<style>body{margin:0}svg{display:block}</style>' + svg);
  const parses = await page.evaluate((content) =>
    !new DOMParser().parseFromString(content, 'image/svg+xml').querySelector('parsererror'), svg);
  if (!parses) throw new Error(model + ': SVG XML parse error');
  const layout = await measure(page);
  if (layout.clipped.length || layout.unlabelled) throw new Error(model + ': clipped or unlabelled use case');
  await page.locator('svg').first().screenshot({ path: path.join(review, model + '.png') });
  fs.writeFileSync(path.join(review, model + '-validation.json'), JSON.stringify(layout, null, 2) + '\n');
  console.log(JSON.stringify({ model, step: 'SVG_XML_AND_LAYOUT', result: 'PASS', ...layout }));
}

async function main() {
  fs.mkdirSync(review, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const model of models) {
      const { kind } = MODELS[model];
      if (kind === 'uml') await checkStaticSvg(page, model);
      else await exportPreview(page, model, kind === 'bpmn' ? await renderBpmn(page, model) : await renderMermaid(page, model));
    }
  } finally {
    await browser.close();
  }
  // Last, so a page may link to the preview this run has just made.
  checkLinks();
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
