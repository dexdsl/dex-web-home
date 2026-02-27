#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILURES = [];

function readText(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    FAILURES.push(`Missing required file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(absPath, 'utf8');
}

function assertIncludes(relPath, text, markers) {
  for (const marker of markers) {
    if (!text.includes(marker)) {
      FAILURES.push(`${relPath} missing marker: ${marker}`);
    }
  }
}

function verifySubmitRoute() {
  const routeRel = 'docs/entry/submit/index.html';
  const route = readText(routeRel);

  assertIncludes(routeRel, route, [
    'id="dex-submit"',
    'data-dx-fetch-state="loading"',
    '/css/components/dx-submit-samples.css',
    '/assets/js/submit.samples.js',
    'data-webapp-url="https://script.google.com/macros/s/AKfycbyh5TPML3_y5-j1QoOKfju_MayO1_0JErwvVkH3Eba195q_EmWGCEu3CdFFeohWes3Qzw/exec"',
  ]);

  const banned = [
    'DexDSL ▶ Submit Samples Tool',
    'window.submissionCallback',
    'buildMeta()',
    'gooey-mesh-wrapper',
  ];
  for (const marker of banned) {
    if (route.includes(marker)) {
      FAILURES.push(`${routeRel} still contains legacy inline submit marker: ${marker}`);
    }
  }
}

function verifySubmitRuntime() {
  const sourceRel = 'scripts/src/submit.samples.entry.mjs';
  const source = readText(sourceRel);

  assertIncludes(sourceRel, source, [
    'window.__dxSubmitSamplesRuntimeLoaded',
    'DX_MIN_SHEEN_MS = 120',
    'window.__DX_SUBMIT_SAMPLES_CONFIG',
    'pitchSystem',
    'pitchDescriptor',
    'serializePitchSelection',
    'Pitch system',
    'data-dx-submit-shell',
    'data-dx-submit-step',
    'data-dx-submit-progress',
    'status: \'pending\'',
  ]);

  for (const relPath of [
    'public/assets/js/submit.samples.js',
    'assets/js/submit.samples.js',
    'docs/assets/js/submit.samples.js',
  ]) {
    const text = readText(relPath);
    assertIncludes(relPath, text, [
      '__dxSubmitSamplesRuntimeLoaded',
      'pitchSystem',
      'pitchDescriptor',
      'data-dx-submit-shell',
      'status:"pending"',
    ]);
  }
}

function verifyCssContracts() {
  const cssRel = 'public/css/components/dx-submit-samples.css';
  const cssText = readText(cssRel);
  assertIncludes(cssRel, cssText, [
    '.dx-submit-shell',
    '.dx-submit-command',
    '.dx-submit-progress-fill',
    '.dx-submit-stage-card',
    '.dx-submit-grid',
  ]);

  for (const relPath of ['css/components/dx-submit-samples.css', 'docs/css/components/dx-submit-samples.css']) {
    const text = readText(relPath);
    assertIncludes(relPath, text, ['.dx-submit-shell', '.dx-submit-stage']);
  }

  const trackerCssRel = 'public/css/components/dx-submission-tracker.css';
  const trackerCss = readText(trackerCssRel);
  assertIncludes(trackerCssRel, trackerCss, [
    '.dx-sub-stage-rail',
    '.dx-sub-stage[data-state=\'active\']',
    '.dx-sub-actions',
    '.dx-sub-item',
  ]);

  for (const relPath of ['css/components/dx-submission-tracker.css', 'docs/css/components/dx-submission-tracker.css']) {
    const text = readText(relPath);
    assertIncludes(relPath, text, ['.dx-sub-stage-rail', '.dx-sub-item']);
  }
}

function main() {
  verifySubmitRoute();
  verifySubmitRuntime();
  verifyCssContracts();

  if (FAILURES.length > 0) {
    console.error(`verify:submit-ui failed with ${FAILURES.length} issue(s):`);
    for (const failure of FAILURES) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:submit-ui passed.');
}

main();
