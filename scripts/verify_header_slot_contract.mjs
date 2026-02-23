#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs');
const BASE_CSS_PATH = path.join(ROOT, 'public', 'css', 'base.css');
const SLOT_RUNTIME_PATH = path.join(ROOT, 'public', 'assets', 'js', 'header-slot.js');
const REQUIRED_SCRIPT_TAG_NEEDLE = '/assets/js/header-slot.js';

const REQUIRED_MARKERS = [
  '--dx-slot-top',
  '--dx-slot-content-offset',
  '--dx-layer-gooey',
  '--dx-layer-foreground',
  '--dx-layer-header',
  'body.dx-slot-enabled',
  '#dx-slot-scroll-root',
  '#dx-slot-foreground-root',
];

const REQUIRED_DOC_PATHS = [
  'docs/404.html',
  'docs/catalog/lookup/index.html',
  'docs/dexfest/2024/day1/index.html',
  'docs/entry/submit/index.html',
  'docs/entry/test-entry/index.html',
  'docs/messages.html',
  'docs/test-title/description.html',
];

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function listHtmlFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      listHtmlFiles(absolutePath, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.push(absolutePath);
    }
  }
  return out;
}

function needsHeaderSlotRuntime(html) {
  return html.includes('<main id="page"') || html.includes('id="siteWrapper"') || html.includes('data-page-sections=') || html.includes('data-footer-sections');
}

function verifyCssContract(failures) {
  const css = readText(BASE_CSS_PATH);
  for (const marker of REQUIRED_MARKERS) {
    if (!css.includes(marker)) {
      failures.push(`base.css missing marker: ${marker}`);
    }
  }
}

function verifyHtmlCoverage(failures) {
  if (!fs.existsSync(DOCS_DIR)) {
    failures.push('docs directory is missing');
    return;
  }

  const htmlFiles = listHtmlFiles(DOCS_DIR);
  let requiredCount = 0;

  for (const absolutePath of htmlFiles) {
    const rel = path.relative(ROOT, absolutePath);
    const html = readText(absolutePath);
    const required = needsHeaderSlotRuntime(html);

    if (required) {
      requiredCount += 1;
      if (!html.includes(REQUIRED_SCRIPT_TAG_NEEDLE)) {
        failures.push(`missing header-slot runtime include in ${rel}`);
      }
    }

    const slotOverrideRegex = /#dx-slot-(?:scroll-root|foreground-root)[\s\S]{0,280}?z-index\s*:\s*([0-9]+)/gi;
    let match;
    while ((match = slotOverrideRegex.exec(html)) !== null) {
      const z = Number(match[1]);
      if (Number.isFinite(z) && z >= 1300) {
        failures.push(`slot z-index override too high in ${rel} (z-index: ${z})`);
      }
    }
  }

  for (const relPath of REQUIRED_DOC_PATHS) {
    const absolutePath = path.join(ROOT, relPath);
    const html = readText(absolutePath);
    if (!html.includes(REQUIRED_SCRIPT_TAG_NEEDLE)) {
      failures.push(`required legacy route missing header-slot include: ${relPath}`);
    }
  }

  if (requiredCount === 0) {
    failures.push('no html routes were classified as requiring header-slot runtime');
  }
}

function main() {
  const failures = [];

  readText(SLOT_RUNTIME_PATH);
  verifyCssContract(failures);
  verifyHtmlCoverage(failures);

  if (failures.length > 0) {
    console.error(`verify:header-slot failed with ${failures.length} issue(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:header-slot passed.');
}

try {
  main();
} catch (error) {
  console.error(`verify:header-slot error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
