#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILURES = [];

const AUTHORED_ZWNJ_PATTERN = /&zwnj;|\u200c/i;
const SCAN_ROOTS = [
  'docs',
  'content',
  'components',
  'data',
  'scripts/fixtures/about-reference',
];
const SCAN_FILE_EXT = /\.(?:html|md|json|js|mjs|ts|tsx|css)$/i;

function readText(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    FAILURES.push(`Missing required file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(absPath, 'utf8');
}

function walkFiles(absPath, out) {
  const stat = fs.statSync(absPath);
  if (stat.isFile()) {
    if (SCAN_FILE_EXT.test(absPath)) out.push(absPath);
    return;
  }

  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextAbsPath = path.join(absPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walkFiles(nextAbsPath, out);
      continue;
    }
    if (entry.isFile() && SCAN_FILE_EXT.test(nextAbsPath)) {
      out.push(nextAbsPath);
    }
  }
}

function verifyNoAuthoredZwnj() {
  const files = [];
  for (const relRoot of SCAN_ROOTS) {
    const absRoot = path.join(ROOT, relRoot);
    if (!fs.existsSync(absRoot)) continue;
    walkFiles(absRoot, files);
  }

  for (const absPath of files) {
    const relPath = path.relative(ROOT, absPath);
    const text = fs.readFileSync(absPath, 'utf8');
    if (AUTHORED_ZWNJ_PATTERN.test(text)) {
      FAILURES.push(`authored ZWNJ token found in ${relPath}`);
    }
  }
}

function assertIncludes(relPath, text, markers) {
  for (const marker of markers) {
    if (!text.includes(marker)) {
      FAILURES.push(`${relPath} missing marker: ${marker}`);
    }
  }
}

function verifyHeadingRuntime() {
  const relPath = 'public/assets/js/header-slot.js';
  const text = readText(relPath);
  assertIncludes(relPath, text, [
    'HEADING_TYPOGRAPHY_SELECTOR',
    'insertCanonicalDoubleLetterSeparators',
    'pickProbabilisticDuplicateCount',
    'window.__DX_HEADING_RANDOM_SEED',
    'window.__dxHeadingFx',
    "data-dx-heading-canonical",
    "data-dx-heading-rendered",
    'applyHeadingTypographyAndSupportHooks',
  ]);
}

function verifySupportFooterPadding() {
  const relPath = 'docs/support/index.html';
  const text = readText(relPath);
  assertIncludes(relPath, text, [
    'padding-bottom: calc(0.8rem + var(--dx-fixed-header-top, 12px));',
    'padding-bottom: calc(0.62rem + var(--dx-fixed-header-top, 12px));',
    'class="dx-support-title"',
  ]);
}

function verifySupportErrorHeadingHooks() {
  const runtimeRel = 'scripts/src/support.status.entry.mjs';
  const runtimeText = readText(runtimeRel);
  assertIncludes(runtimeRel, runtimeText, [
    'decorateHeadingIfAvailable',
    "dispatchHeadingRenderEvent('dx:support-status:rendered')",
    "dispatchHeadingRenderEvent('dx:error-status:rendered')",
    "routeKey: 'support:title'",
    "routeKey: 'error:title'",
  ]);

  const errorRel = 'docs/error/index.html';
  const errorText = readText(errorRel);
  assertIncludes(errorRel, errorText, [
    'id="dx-error-title"',
  ]);
}

function main() {
  verifyNoAuthoredZwnj();
  verifyHeadingRuntime();
  verifySupportFooterPadding();
  verifySupportErrorHeadingHooks();

  if (FAILURES.length > 0) {
    console.error(`verify:heading-zwnj failed with ${FAILURES.length} issue(s):`);
    for (const failure of FAILURES) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:heading-zwnj passed.');
}

main();
