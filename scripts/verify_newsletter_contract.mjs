#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const FAILURES = [];

async function readText(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8');
}

function assertIncludes(label, source, markers) {
  markers.forEach((marker) => {
    if (!source.includes(marker)) {
      FAILURES.push(`${label} missing marker: ${marker}`);
    }
  });
}

function assertExcludes(label, source, markers) {
  markers.forEach((marker) => {
    if (source.includes(marker)) {
      FAILURES.push(`${label} contains forbidden marker: ${marker}`);
    }
  });
}

async function verifyCallRuntime() {
  const rel = 'scripts/src/call.editorial.entry.mjs';
  const source = await readText(rel);
  assertIncludes(rel, source, [
    '/newsletter/subscribe',
    'CHECK YOUR EMAIL TO CONFIRM SUBSCRIPTION.',
    'REQUEST TIMED OUT',
  ]);
}

async function verifyRoutePages() {
  const confirmRel = 'docs/newsletter/confirm/index.html';
  const confirmHtml = await readText(confirmRel);
  assertIncludes(confirmRel, confirmHtml, [
    'id="dx-newsletter-confirm"',
    '/newsletter/confirm',
    'data-dx-newsletter-state',
  ]);

  const unsubRel = 'docs/newsletter/unsubscribe/index.html';
  const unsubHtml = await readText(unsubRel);
  assertIncludes(unsubRel, unsubHtml, [
    'id="dx-newsletter-unsubscribe"',
    '/newsletter/unsubscribe',
    'data-dx-newsletter-state',
  ]);
}

async function verifyLegacyRemoval() {
  const indexRel = 'docs/index.html';
  const indexHtml = await readText(indexRel);
  assertExcludes(indexRel, indexHtml, ['chimpstatic.com', 'id="mcjs"']);

  const favoritesRel = 'docs/favorites/index.html';
  const favoritesHtml = await readText(favoritesRel);
  assertExcludes(favoritesRel, favoritesHtml, ['chimpstatic.com', 'id="mcjs"']);
}

async function verifyCliWiring() {
  const dexRel = 'scripts/dex.mjs';
  const dexSource = await readText(dexRel);
  assertIncludes(dexRel, dexSource, [
    'runNewsletterCommand',
    "topLevel.command === 'newsletter'",
    'newsletter:import',
  ]);

  const dashboardRel = 'scripts/ui/dashboard.mjs';
  const dashboardSource = await readText(dashboardRel);
  assertIncludes(dashboardRel, dashboardSource, [
    'NewsletterManager',
    "id: 'newsletter'",
  ]);
}

async function main() {
  await verifyCallRuntime();
  await verifyRoutePages();
  await verifyLegacyRemoval();
  await verifyCliWiring();

  if (FAILURES.length) {
    console.error(`verify:newsletter failed with ${FAILURES.length} issue(s):`);
    FAILURES.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('verify:newsletter passed.');
}

main().catch((error) => {
  console.error(`verify:newsletter error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
