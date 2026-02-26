#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ABOUT_PATH = path.join(ROOT, 'docs', 'about', 'index.html');

const EXPECTED_TABS = [
  ['mission', 'About'],
  ['work', 'What We Do'],
  ['impact', 'Impact'],
  ['team', 'Team'],
  ['partners', 'Partners'],
  ['press', 'Press'],
  ['contact', 'Contact'],
  ['license', 'License'],
];

const REQUIRED_CTA_SIGNATURES = [
  /<a[^>]*href="\/dex\/"[^>]*>More About Dex<\/a>/i,
  /<a[^>]*href="#license"[^>]*data-goto="license"[^>]*>What CC BY 4\.0 Means<\/a>/i,
  /<a[^>]*href="\/programs\/"[^>]*>Current Programs<\/a>/i,
  /<a[^>]*href="#contact"[^>]*data-goto="contact"[^>]*>Propose a Project<\/a>/i,
  /<a[^>]*href="\/contact\/"[^>]*>Open Contact Page<\/a>/i,
  /<a[^>]*href="\/contact#form"[^>]*>Open Contact Form<\/a>/i,
  /<a[^>]*href="\/copyright\/"[^>]*>Copyright & Policies<\/a>/i,
];

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractAboutSection(html) {
  const start = html.indexOf('<section id="dex-about"');
  if (start < 0) {
    throw new Error('Missing <section id="dex-about">.');
  }

  const token = /<section\b[^>]*>|<\/section>/gi;
  token.lastIndex = start;
  const first = token.exec(html);
  if (!first || first.index !== start) {
    throw new Error('Unable to parse #dex-about section start.');
  }

  let depth = 1;
  let match;
  while ((match = token.exec(html))) {
    if (/^<\/section/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      return html.slice(start, token.lastIndex);
    }
  }

  throw new Error('Unable to find closing </section> for #dex-about.');
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function verifyTabs(fragment) {
  const tabs = [];
  const rx = /<button[^>]*class="pill"[^>]*data-pane="([^"]+)"[^>]*>([^<]*)<\/button>/gi;
  let match;
  while ((match = rx.exec(fragment))) {
    tabs.push([normalizeText(match[1]), normalizeText(match[2])]);
  }
  assert(
    JSON.stringify(tabs) === JSON.stringify(EXPECTED_TABS),
    `Tab order/labels mismatch.\nExpected: ${JSON.stringify(EXPECTED_TABS)}\nActual: ${JSON.stringify(tabs)}`,
  );
}

function verifyPaneContract(fragment) {
  for (const [paneKey] of EXPECTED_TABS) {
    const paneId = `pane-${paneKey}`;
    const rx = new RegExp(`<section[^>]*id="${paneId}"[^>]*class="pane"`, 'i');
    assert(rx.test(fragment), `Missing pane section contract for #${paneId}.`);
  }
}

function verifyCTAs(fragment) {
  for (const signature of REQUIRED_CTA_SIGNATURES) {
    assert(signature.test(fragment), `Missing CTA signature: ${signature}`);
  }
}

function verifyAssetInclusions(html) {
  assert(
    countMatches(html, /href="\/css\/components\/dx-about\.css"/g) === 1,
    'Expected exactly one /css/components/dx-about.css inclusion.',
  );
  assert(
    countMatches(html, /src="\/assets\/js\/dx-about\.js"/g) === 1,
    'Expected exactly one /assets/js/dx-about.js inclusion.',
  );
}

function verifyNoInlineModuleStyleOrScript(fragment) {
  assert(!/<style\b/i.test(fragment), 'Inline <style> found inside #dex-about module.');
  assert(!/<script\b/i.test(fragment), 'Inline <script> found inside #dex-about module.');
}

function main() {
  assert(fs.existsSync(ABOUT_PATH), `Missing file: ${path.relative(ROOT, ABOUT_PATH)}`);
  const html = fs.readFileSync(ABOUT_PATH, 'utf8');

  assert(countMatches(html, /id="dex-about"/g) === 1, 'Expected exactly one #dex-about element.');
  verifyAssetInclusions(html);

  const fragment = extractAboutSection(html);
  verifyTabs(fragment);
  verifyPaneContract(fragment);
  verifyCTAs(fragment);
  verifyNoInlineModuleStyleOrScript(fragment);

  console.log('verify_about_integrity passed.');
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
