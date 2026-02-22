#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const DATA_PATH = path.join(ROOT, 'public', 'data', 'call.data.json');
const JS_PATH = path.join(ROOT, 'public', 'assets', 'js', 'call.editorial.js');
const CSS_PATH = path.join(ROOT, 'public', 'css', 'components', 'dx-call-editorial.css');
const PAGE_PATH = path.join(ROOT, 'docs', 'call', 'index.html');

const REQUIRED_MAIN_IDS = [
  'call-hero',
  'call-status',
  'call-lanes',
  'call-active',
  'call-mini',
  'call-requireements',
  'call-past',
  'call-newsletter',
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function getMainHtml(html) {
  const start = html.indexOf('<main id="page"');
  if (start < 0) return '';
  const end = html.indexOf('</main>', start);
  if (end < 0) return '';
  return html.slice(start, end + '</main>'.length);
}

function main() {
  const failures = [];

  if (!fs.existsSync(CSS_PATH)) failures.push(`missing stylesheet ${path.relative(ROOT, CSS_PATH)}`);
  if (!fs.existsSync(JS_PATH)) failures.push(`missing runtime bundle ${path.relative(ROOT, JS_PATH)}`);

  const model = readJson(DATA_PATH);

  if (!model?.hero?.heading_raw) failures.push('call data missing hero.heading_raw');
  if (!Array.isArray(model?.lanes) || model.lanes.length < 4) failures.push('call data lanes must contain at least four items');
  if (!model?.active_call?.cycle_raw) failures.push('call data missing active_call.cycle_raw');
  if (!Array.isArray(model?.active_call?.subcalls) || model.active_call.subcalls.length < 3) failures.push('call data missing active_call subcalls');
  if (!model?.mini_call?.cycle_raw) failures.push('call data missing mini_call.cycle_raw');
  if (!Array.isArray(model?.requirements?.items_raw) || model.requirements.items_raw.length < 4) failures.push('call data missing requirements items');
  if (!Array.isArray(model?.past_calls?.entries) || model.past_calls.entries.length < 2) failures.push('call data missing past call entries');
  if (!model?.newsletter?.prompt_raw) failures.push('call data missing newsletter prompt');

  const pageHtml = readText(PAGE_PATH);
  const mainHtml = getMainHtml(pageHtml);
  if (!mainHtml) {
    failures.push('call page missing <main id="page">');
  } else {
    if (!mainHtml.includes('data-call-editorial-app')) failures.push('call page missing data-call-editorial-app root');
    for (const id of REQUIRED_MAIN_IDS) {
      if (!mainHtml.includes(`id="${id}"`)) failures.push(`call page main missing section id="${id}"`);
    }
    if (mainHtml.includes("Y.use('legacysite-form-submit'")) {
      failures.push('call page main still contains legacy newsletter submit runtime');
    }
    if (mainHtml.includes('section.page-section')) {
      failures.push('call page main still contains snapshot page-section blocks');
    }
  }

  if (!pageHtml.includes('/css/components/dx-call-editorial.css')) {
    failures.push('call page must include /css/components/dx-call-editorial.css');
  }
  if (!pageHtml.includes('/assets/js/call.editorial.js')) {
    failures.push('call page must include /assets/js/call.editorial.js');
  }

  if (failures.length > 0) {
    console.error(`verify:call failed with ${failures.length} issue(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:call passed.');
}

try {
  main();
} catch (error) {
  console.error(`verify:call failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
