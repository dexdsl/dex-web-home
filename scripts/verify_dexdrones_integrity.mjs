#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const PAGE_PATH = path.join(ROOT, 'docs', 'dexdrones', 'index.html');
const DATA_PATH = path.join(ROOT, 'public', 'data', 'dexdrones.data.json');
const CSS_PATH = path.join(ROOT, 'public', 'css', 'components', 'dx-dexdrones.css');
const RUNTIME_SOURCE_PATH = path.join(ROOT, 'scripts', 'src', 'dexdrones.entry.mjs');
const RUNTIME_BUNDLE_PATH = path.join(ROOT, 'public', 'assets', 'js', 'dx-dexdrones.js');

const REQUIRED_STEP_IDS = [
  'dexdrones-hero',
  'dexdrones-proof',
  'dexdrones-why',
  'dexdrones-publishes',
  'dexdrones-underway',
  'dexdrones-kolari',
  'dexdrones-partners',
  'dexdrones-participate',
  'dexdrones-quotes',
  'dexdrones-support',
  'dexdrones-press',
  'dexdrones-about',
];

const REQUIRED_SECTION_KEYS = [
  'hero',
  'proof',
  'whyExists',
  'publishes',
  'underway',
  'kolari',
  'whyPartners',
  'participate',
  'quotes',
  'support',
  'press',
  'aboutDex',
];

const REQUIRED_PRESS_LINKS = [
  '/assets/press/dex-factsheet-2025-08.pdf',
  '/assets/press/dex-factsheet-dexDRONES.pdf',
  '/assets/press/dex-press-release-dexDRONES-kolari-sponsor-2026-03-09.pdf',
];

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function getMainHtml(html) {
  const start = html.indexOf('<main id="page"');
  if (start < 0) return '';
  const end = html.indexOf('</main>', start);
  if (end < 0) return '';
  return html.slice(start, end + '</main>'.length);
}

function pushIf(failures, condition, message) {
  if (!condition) failures.push(message);
}

function verifyPageContract(pageHtml, failures) {
  pushIf(failures, countMatches(pageHtml, /data-dx-dexdrones-app/g) === 1, 'dexdrones page must include exactly one data-dx-dexdrones-app mount');
  pushIf(failures, countMatches(pageHtml, /href="\/css\/components\/dx-dexdrones\.css"/g) === 1, 'dexdrones page must include /css/components/dx-dexdrones.css exactly once');
  pushIf(failures, countMatches(pageHtml, /src="\/assets\/js\/dx-dexdrones\.js"/g) === 1, 'dexdrones page must include /assets/js/dx-dexdrones.js exactly once');
  pushIf(failures, pageHtml.includes('window.DEX_DRONES_CONFIG'), 'dexdrones page must include window.DEX_DRONES_CONFIG');

  const mainHtml = getMainHtml(pageHtml);
  pushIf(failures, Boolean(mainHtml), 'dexdrones page missing <main id="page"> block');
  if (mainHtml) {
    pushIf(failures, mainHtml.includes('class="container dx-dexdrones-page"'), 'dexdrones page main must use dx-dexdrones-page class');
    pushIf(failures, mainHtml.includes('dx-dexdrones-page-shell'), 'dexdrones page main must include dx-dexdrones-page-shell section');
    for (const id of REQUIRED_STEP_IDS) {
      pushIf(failures, mainHtml.includes(`id="${id}"`), `dexdrones page main missing section id="${id}"`);
    }
  }
}

function verifyRuntimeContract(source, bundle, failures) {
  const sourceMarkers = [
    'bindSidebarMotion',
    'revealStagger',
    'IntersectionObserver',
    'window.DEX_DRONES_CONFIG',
    'wireHashCompatibility',
    'data-dx-dexdrones-app',
    'dexdrones-hero',
    'dexdrones-press',
    'proofChips',
    'dateStamp',
    'launchTag',
    'dx-dexdrones-hero-proof',
  ];

  for (const marker of sourceMarkers) {
    pushIf(failures, source.includes(marker), `dexdrones runtime source missing marker: ${marker}`);
  }

  const bundleMarkers = [
    'dx-dexdrones-progress-link',
    'dexdrones-underway',
  ];

  for (const marker of bundleMarkers) {
    pushIf(failures, bundle.includes(marker), `dexdrones runtime bundle missing marker: ${marker}`);
  }
}

function verifyCssContract(css, failures) {
  const cssMarkers = [
    '--dx-dexdrones-vfr-base',
    '.dx-dexdrones-date-stamp',
    '.dx-dexdrones-hero-proof',
    '.dx-dexdrones-hero-chip',
    '.dx-dexdrones-page-shell::before',
    '.dx-dexdrones-page-shell::after',
    'repeating-linear-gradient(',
    'clamp(66px, 8vw, 92px)',
    'clamp(54px, 6.8vw, 80px)',
    'radial-gradient(130% 36% at 8% 20%',
  ];
  for (const marker of cssMarkers) {
    pushIf(failures, css.includes(marker), `dexdrones stylesheet missing marker: ${marker}`);
  }
}

function verifyDataContract(data, failures) {
  for (const key of REQUIRED_SECTION_KEYS) {
    pushIf(failures, Boolean(data?.[key]), `dexdrones data missing section key: ${key}`);
  }

  const stepIds = Array.isArray(data?.steps)
    ? data.steps.map((step) => String(step?.id || ''))
    : [];

  pushIf(
    failures,
    JSON.stringify(stepIds) === JSON.stringify(REQUIRED_STEP_IDS),
    `dexdrones data steps mismatch. expected=${JSON.stringify(REQUIRED_STEP_IDS)} actual=${JSON.stringify(stepIds)}`,
  );

  pushIf(
    failures,
    String(data?.hero?.markSrc || '') === '/assets/img/dexdrones.png',
    'dexdrones hero mark must use /assets/img/dexdrones.png',
  );

  pushIf(
    failures,
    String(data?.hero?.dateStamp || '') === '03.09.2026',
    'dexdrones hero dateStamp must be 03.09.2026',
  );

  const proofChips = Array.isArray(data?.hero?.proofChips) ? data.hero.proofChips : [];
  pushIf(failures, proofChips.length >= 3, 'dexdrones hero must include at least 3 proofChips');
  const proofValues = proofChips.map((chip) => String(chip?.value || ''));
  for (const value of ['30+ hours', '~12,000', '~500']) {
    pushIf(failures, proofValues.includes(value), `dexdrones hero proofChips missing value: ${value}`);
  }

  pushIf(
    failures,
    String(data?.hero?.ctas?.[0]?.href || '') === '/donate/',
    'dexdrones hero primary CTA must target /donate/',
  );

  pushIf(
    failures,
    String(data?.hero?.ctas?.[1]?.href || '') === '/dexnotes/dexdrones-launch-announcement-2026-03-09/',
    'dexdrones hero announcement CTA must target /dexnotes/dexdrones-launch-announcement-2026-03-09/',
  );

  pushIf(
    failures,
    String(data?.support?.ctas?.[1]?.href || '') === 'mailto:info@dexdsl.org',
    'dexdrones support inquiry CTA must target mailto:info@dexdsl.org',
  );

  const materials = Array.isArray(data?.press?.materials) ? data.press.materials : [];
  const materialHrefs = materials.map((item) => String(item?.href || ''));
  for (const href of REQUIRED_PRESS_LINKS) {
    pushIf(failures, materialHrefs.includes(href), `dexdrones press materials missing href: ${href}`);
  }
}

function verifyPublishedAssetMirrors(failures) {
  const requiredAssets = [
    'assets/img/dexdrones.png',
    'docs/assets/img/dexdrones.png',
    'assets/press/dex-factsheet-2025-08.pdf',
    'assets/press/dex-factsheet-dexDRONES.pdf',
    'assets/press/dex-press-release-dexDRONES-kolari-sponsor-2026-03-09.pdf',
    'docs/assets/press/dex-factsheet-2025-08.pdf',
    'docs/assets/press/dex-factsheet-dexDRONES.pdf',
    'docs/assets/press/dex-press-release-dexDRONES-kolari-sponsor-2026-03-09.pdf',
  ];

  for (const rel of requiredAssets) {
    pushIf(failures, fs.existsSync(path.join(ROOT, rel)), `missing published asset mirror: ${rel}`);
  }
}

function main() {
  const failures = [];

  pushIf(failures, fs.existsSync(CSS_PATH), `missing stylesheet ${path.relative(ROOT, CSS_PATH)}`);
  pushIf(failures, fs.existsSync(RUNTIME_BUNDLE_PATH), `missing runtime bundle ${path.relative(ROOT, RUNTIME_BUNDLE_PATH)}`);

  const pageHtml = readText(PAGE_PATH);
  const data = readJson(DATA_PATH);
  const css = readText(CSS_PATH);
  const runtimeSource = readText(RUNTIME_SOURCE_PATH);
  const runtimeBundle = readText(RUNTIME_BUNDLE_PATH);

  verifyPageContract(pageHtml, failures);
  verifyCssContract(css, failures);
  verifyRuntimeContract(runtimeSource, runtimeBundle, failures);
  verifyDataContract(data, failures);
  verifyPublishedAssetMirrors(failures);

  if (failures.length > 0) {
    console.error(`verify:dexdrones failed with ${failures.length} issue(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:dexdrones passed.');
}

try {
  main();
} catch (error) {
  console.error(`verify:dexdrones failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
