#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { auditEntryRuntime } from './lib/entry-runtime-audit.mjs';

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-entry-audit-'));
  const entriesDir = path.join(tempRoot, 'entries');
  const dataDir = path.join(tempRoot, 'data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(entriesDir, 'valid'), { recursive: true });
  await fs.mkdir(path.join(entriesDir, 'invalid'), { recursive: true });

  const validHtml = `<!doctype html><html><head>
  <script defer src="/assets/vendor/auth0-spa-js.umd.min.js"></script>
  <script defer src="/assets/dex-auth0-config.js"></script>
  <script defer src="/assets/dex-auth.js"></script>
  </head><body>
  <div id="scroll-gradient-bg"></div>
  <div id="gooey-mesh-wrapper"></div>
  <div class="dex-breadcrumb"></div>
  <script id="dex-sidebar-config" type="application/json">{ "downloads": {} }</script>
  <script id="dex-sidebar-page-config" type="application/json">{}</script>
  <script id="dex-manifest" type="application/json">{ "audio": { "A": { "wav": "lookup:A.01" } }, "video": {} }</script>
  </body></html>`;

  const invalidHtml = `<!doctype html><html><head>
  <script defer src="/assets/vendor/auth0-spa-js.umd.min.js"></script>
  </head><body>
  <script id="dex-manifest" type="application/json">{ "audio": { "A": { "wav": "1AbcDEfGhIJkLmNopqR" } } }</script>
  <script id="dex-sidebar-config" type="application/json">{ "downloads": { "driveBase": "https://drive.google.com/drive/u/0/folders" } }</script>
  </body></html>`;

  await fs.writeFile(path.join(entriesDir, 'valid', 'index.html'), validHtml, 'utf8');
  await fs.writeFile(path.join(entriesDir, 'invalid', 'index.html'), invalidHtml, 'utf8');

  await fs.writeFile(path.join(dataDir, 'catalog.entries.json'), JSON.stringify({
    entries: [
      {
        id: 'valid',
        entry_href: '/entry/valid/',
        lookup_raw: 'SUB01-P.Dru Un AV2026',
        season: 'S2',
        performer_raw: 'Test Artist',
        instrument_labels: ['Drumkit'],
      },
      {
        id: 'catalog-only',
        entry_href: '/entry/catalog-only/',
        lookup_raw: 'SUB02-P.Dru Un AV2026',
        season: 'S2',
        performer_raw: 'Catalog Only',
        instrument_labels: ['Drumkit'],
      },
    ],
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(dataDir, 'catalog.editorial.json'), JSON.stringify({
    version: 'catalog-editorial-v1',
    updatedAt: new Date().toISOString(),
    manifest: [],
    spotlight: {},
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(dataDir, 'protected.assets.json'), JSON.stringify({
    version: 'protected-assets-v1',
    updatedAt: new Date().toISOString(),
    settings: {
      storageBucket: 'dex-protected-assets',
      allowedBuckets: ['A', 'B', 'C', 'D', 'E', 'X'],
      syncStrategy: 'manifest-publish',
    },
    lookups: [
      {
        lookupNumber: 'SUB01-P.Dru Un AV2026',
        status: 'pending',
        season: 'S2',
        files: [
          {
            bucketNumber: 'A.1',
            fileId: 'A.1',
            bucket: 'A',
            r2Key: 'sub01/a1.wav',
            driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
            position: 1,
          },
        ],
        entitlements: [{ type: 'public', value: 'true' }],
      },
    ],
    exemptions: [],
  }, null, 2), 'utf8');

  const result = await auditEntryRuntime({
    entriesDir,
    all: true,
    includeLegacy: true,
    catalogEntriesFile: path.join(dataDir, 'catalog.entries.json'),
    catalogEditorialFile: path.join(dataDir, 'catalog.editorial.json'),
    protectedAssetsFile: path.join(dataDir, 'protected.assets.json'),
  });

  const valid = result.reports.find((row) => row.slug === 'valid');
  const invalid = result.reports.find((row) => row.slug === 'invalid');
  assert(valid && valid.ok, 'valid entry should pass audit');
  assert(invalid && !invalid.ok, 'invalid entry should fail audit');
  assert(invalid.issues.some((issue) => issue.includes('unsupported token')), 'invalid entry should report unsupported token');
  assert(invalid.issues.some((issue) => issue.includes('driveBase')), 'invalid entry should report driveBase');
  const inventoryRows = result.inventory.rows;
  const validInventory = inventoryRows.find((row) => row.entryId === 'valid');
  const catalogOnlyInventory = inventoryRows.find((row) => row.entryId === 'catalog-only');
  assert(validInventory, 'valid inventory row should exist');
  assert(catalogOnlyInventory, 'catalog-only inventory row should exist');
  assert.equal(validInventory.state, 'linked', 'valid should be linked because entry page and catalog row exist');
  assert.equal(catalogOnlyInventory.state, 'catalog-only', 'catalog-only row should be catalog-only');
  assert.deepEqual(validInventory.assets.buckets, ['A.1'], 'valid row should include mapped bucket');
  assert.equal(validInventory.assets.fileIds[0], 'A.1', 'valid row should include mapped file id');
  console.log('test-entry-runtime-audit passed');
}

main().catch((error) => {
  console.error(`test-entry-runtime-audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
