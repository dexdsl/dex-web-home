#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function fail(message) {
  throw new Error(message);
}

async function read(relativePath) {
  const absolute = path.resolve(relativePath);
  return fs.readFile(absolute, 'utf8');
}

function ensureOrderedSections(html) {
  const overviewIdx = html.indexOf('<section class="dex-overview"></section>');
  const collectionsIdx = html.indexOf('<section class="dex-collections"></section>');
  const licenseIdx = html.indexOf('<section class="dex-license"></section>');
  if (overviewIdx < 0) fail('entry-template missing .dex-overview section');
  if (collectionsIdx < 0) fail('entry-template missing .dex-collections section');
  if (licenseIdx < 0) fail('entry-template missing .dex-license section');
  if (!(overviewIdx < collectionsIdx && collectionsIdx < licenseIdx)) {
    fail('entry-template sidebar sections must be ordered overview -> collections -> license');
  }
}

function ensureRecordingIndexSecondary(templateCss) {
  const primaryBlockRx = /\.dex-sidebar\s+\.dex-license-controls\s+\.copy-btn,[\s\S]*?\.dex-sidebar\s+#downloads\s+\.btn-video\s*\{[\s\S]*?\}/i;
  const match = templateCss.match(primaryBlockRx);
  if (!match) fail('template CSS missing primary CTA block for license/download buttons');
  if (/btn-recording-index/i.test(match[0])) {
    fail('template primary CTA selector must not include .btn-recording-index');
  }
  if (!/\.dex-sidebar\s+#downloads\s+\.btn-recording-index\s*\{/i.test(templateCss)) {
    fail('template CSS missing explicit secondary style block for .btn-recording-index');
  }
}

function ensureRuntimeMarkers(runtimeJs) {
  const required = [
    'buildDownloadRows',
    'getDownloadModalConfig',
    'Download selected',
    'No links available.',
    '.dex-collections',
    'data-dx-download-kind="recording-index-pdf"',
  ];
  for (const marker of required) {
    if (!runtimeJs.includes(marker)) {
      fail(`runtime missing marker: ${marker}`);
    }
  }
}

function ensureCompilerMarkers(entryHtmlSource) {
  const required = [
    'linksByPerson',
    'instrumentLinksEnabled',
    'normalizeLinksByPerson',
  ];
  for (const marker of required) {
    if (!entryHtmlSource.includes(marker)) {
      fail(`entry HTML compiler missing marker: ${marker}`);
    }
  }
}

async function main() {
  const [templateHtml, runtimeJs, entryHtmlSource] = await Promise.all([
    read('entry-template/index.html'),
    read('assets/dex-sidebar.js'),
    read('scripts/lib/entry-html.mjs'),
  ]);

  ensureOrderedSections(templateHtml);
  ensureRecordingIndexSecondary(templateHtml);
  ensureRuntimeMarkers(runtimeJs);
  ensureCompilerMarkers(entryHtmlSource);
  console.log('verify:entry-sidebar-contract passed');
}

main().catch((error) => {
  console.error(`verify:entry-sidebar-contract failed: ${error.message || String(error)}`);
  process.exit(1);
});
