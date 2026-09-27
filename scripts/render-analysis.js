#!/usr/bin/env node
'use strict';

// Documentation exporter. No app server, database or provider calls.
// Usage: node scripts/render-analysis.js output/analysis-tools [BPMN basename]
// Tools are installed separately; package.json and its lockfile stay unchanged.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const tools = path.resolve(root, process.argv[2] || 'output/analysis-tools');
const model = process.argv[3] || 'ai-expense-process';
if (!['ai-expense-process', 'monthly-limit-process', 'use-cases'].includes(model)) {
  throw new Error('Unknown BPMN model');
}
const source = path.join(root, 'docs/analysis', model + '.bpmn');
const target = path.join(root, 'docs/analysis', model + '.svg');
const review = path.join(root, 'output/analysis-review');

async function main() {
  if (model === 'use-cases') return inspectStaticSvg();
  const xml = fs.readFileSync(source, 'utf8');
  const moddlePath = require.resolve('bpmn-moddle', { paths: [path.join(tools, 'node_modules')] });
  const { BpmnModdle } = await import(pathToFileURL(moddlePath).href);
  const moddle = new BpmnModdle();
  const parsed = await moddle.fromXML(xml);
  const xmlWarnings = parsed.warnings.map((w) => w.message);
  console.log(JSON.stringify({ step: 'XML_PARSE', warnings: xmlWarnings }));
  if (xmlWarnings.length) throw new Error('BPMN XML parse warnings');

  // Check relationships as well as syntax, including the hidden save subprocess.
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
  console.log(JSON.stringify({ step: 'STRUCTURE', sequenceFlows: sequenceFlows.length,
    messageFlows: collaboration.messageFlows.length, result: 'PASS' }));

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
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
    console.log(JSON.stringify({ step: 'BPMN_IMPORT', warnings: rendered.warnings }));
    if (rendered.warnings.length) throw new Error('BPMN viewer import warnings');
    const reparsed = await moddle.fromXML(rendered.roundTrip);
    if (reparsed.warnings.length) throw new Error('Round-trip XML warnings');
    console.log(JSON.stringify({ step: 'XML_ROUND_TRIP', warnings: [], result: 'PASS' }));

    // Opaque background keeps standard black BPMN notation readable in either
    // GitHub theme. Preserve modeler-exported geometry, labels and symbols.
    const svg = rendered.svg.replace(/(<svg\b[^>]*>)/,
      '$1<title>' + (model === 'ai-expense-process'
        ? 'AI-assisted expense entry — BPMN 2.0' : 'Monthly spending limit — BPMN 2.0') + '</title>'
      + '<desc>' + (model === 'ai-expense-process'
        ? 'Draft guards, editable review, cancellation and an explicit keyed-save subprocess.'
        : 'Set, clear or preserve a limit; record an expense; compute four states without blocking saving.')
      + '</desc>'
      + '<rect width="100%" height="100%" fill="#ffffff"/>');
    await page.setContent('<style>body{margin:0;background:white}svg{display:block}</style>' + svg);
    const layout = await page.locator('svg').evaluate((element) => {
      const box = element.getBoundingClientRect();
      const clipped = Array.from(element.querySelectorAll('text')).filter((text) => {
        const b = text.getBoundingClientRect();
        return b.left < box.left - 1 || b.right > box.right + 1
          || b.top < box.top - 1 || b.bottom > box.bottom + 1;
      }).map((text) => text.textContent);
      return { width: box.width, height: box.height, clipped, labels: element.querySelectorAll('text').length };
    });
    if (layout.clipped.length) throw new Error('Clipped SVG labels: ' + layout.clipped.join('; '));
    fs.mkdirSync(review, { recursive: true });
    fs.writeFileSync(target, svg);
    await page.locator('svg').screenshot({ path: path.join(review, model + '.png') });
    fs.writeFileSync(path.join(review, model + '-validation.json'),
      JSON.stringify({ xmlWarnings, importWarnings: rendered.warnings, layout }, null, 2) + '\n');
    console.log(JSON.stringify({ step: 'SVG_EXPORT', output: 'docs/analysis/' + model + '.svg', ...layout }));
  } finally {
    if (browser) await browser.close();
  }
}
async function inspectStaticSvg() {
  const svg = fs.readFileSync(target, 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await page.setContent('<style>body{margin:0}svg{display:block}</style>' + svg);
    const layout = await page.locator('svg').evaluate((element, content) => {
      const document = new DOMParser().parseFromString(content, 'image/svg+xml');
      if (document.querySelector('parsererror')) throw new Error('SVG XML parse error');
      const box = element.getBoundingClientRect();
      const clipped = Array.from(element.querySelectorAll('text')).filter((text) => {
        const b = text.getBoundingClientRect();
        return b.left < box.left - 1 || b.right > box.right + 1
          || b.top < box.top - 1 || b.bottom > box.bottom + 1;
      }).map((text) => text.textContent);
      return { width: box.width, height: box.height, clipped,
        labels: element.querySelectorAll('text').length,
        useCases: element.querySelectorAll('ellipse').length };
    }, svg);
    if (layout.clipped.length || layout.useCases !== 8) throw new Error('UML layout/goal check failed');
    fs.mkdirSync(review, { recursive: true });
    await page.locator('svg').screenshot({ path: path.join(review, model + '.png') });
    fs.writeFileSync(path.join(review, model + '-validation.json'), JSON.stringify(layout, null, 2) + '\n');
    console.log(JSON.stringify({ step: 'SVG_XML_AND_LAYOUT', result: 'PASS', ...layout }));
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
