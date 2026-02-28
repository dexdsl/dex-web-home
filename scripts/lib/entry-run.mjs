import fs from 'node:fs/promises';
import path from 'node:path';
import { writeEntryFromData as writeEntryFromDataCore } from './init-core.mjs';
import {
  defaultCatalogEditorialData,
  findCatalogManifestEntry,
  readCatalogEditorialFile,
  upsertCatalogManifestEntry,
  writeCatalogEditorialFile,
} from './catalog-editorial-store.mjs';
import {
  resolveCatalogManifestPatchFromInitData,
  resolveEntryLinkageFromInitData,
  assertCatalogManifestRowLinkage,
} from './entry-catalog-linkage.mjs';
import { assertAssetReferenceToken } from './asset-ref.mjs';

function toText(value) {
  return String(value || '').trim();
}

function normalizeCatalogLinkMode(value) {
  const raw = toText(value || 'create-linked').toLowerCase();
  if (raw === 'create-linked' || raw === 'attach-existing') return raw;
  throw new Error(`Unsupported catalog link mode: ${value}`);
}

function resolveCatalogLinkConfig(data = {}, opts = {}) {
  const fromOpts = opts.catalogLink && typeof opts.catalogLink === 'object' ? opts.catalogLink : {};
  const mode = normalizeCatalogLinkMode(fromOpts.mode || opts.catalogLinkMode || 'create-linked');
  const enabled = fromOpts.enabled !== false && opts.catalogLink !== false;
  const catalogFilePath = toText(fromOpts.filePath || opts.catalogFilePath || path.resolve(process.cwd(), 'data', 'catalog.editorial.json'));
  const createProtectedAssetsStub = Boolean(fromOpts.createProtectedAssetsStub);
  const protectedAssetsStub = fromOpts.protectedAssetsStub && typeof fromOpts.protectedAssetsStub === 'object'
    ? fromOpts.protectedAssetsStub
    : null;
  const linkage = resolveEntryLinkageFromInitData(data, fromOpts);
  return {
    enabled,
    mode,
    filePath: catalogFilePath || undefined,
    linkage,
    createProtectedAssetsStub,
    protectedAssetsStub,
  };
}

function collectManifestStringValues(manifest, out = []) {
  if (Array.isArray(manifest)) {
    manifest.forEach((item) => collectManifestStringValues(item, out));
    return out;
  }
  if (manifest && typeof manifest === 'object') {
    Object.values(manifest).forEach((item) => collectManifestStringValues(item, out));
    return out;
  }
  if (typeof manifest === 'string') out.push(manifest);
  return out;
}

function assertLookupOnlyManifest(manifest) {
  const values = collectManifestStringValues(manifest, []);
  for (const value of values) {
    const raw = toText(value);
    if (!raw) continue;
    assertAssetReferenceToken(raw, 'Lookup-only mode');
  }
}

async function readCatalogEditorialSafe(filePath) {
  try {
    return await readCatalogEditorialFile(filePath);
  } catch (error) {
    if (String(error?.message || '').includes('ENOENT') || error?.code === 'ENOENT') {
      const fallback = defaultCatalogEditorialData();
      return {
        filePath: filePath ? path.resolve(filePath) : path.resolve(process.cwd(), 'data', 'catalog.editorial.json'),
        data: fallback,
      };
    }
    throw error;
  }
}

async function maybeCreateProtectedAssetsStub(catalogLinkConfig) {
  if (!catalogLinkConfig.createProtectedAssetsStub) return [];
  const stub = catalogLinkConfig.protectedAssetsStub || {};
  const lines = [];
  if (!toText(stub.bucketNumber) || !toText(stub.r2Key) || !toText(stub.entitlementType) || !toText(stub.entitlementValue)) {
    throw new Error(
      'Protected assets stub requested but incomplete. Provide bucketNumber, r2Key, entitlementType, entitlementValue.',
    );
  }
  lines.push(`✓ Protected assets stub requested for ${catalogLinkConfig.linkage.lookupNumber} (${stub.bucketNumber})`);
  return lines;
}

async function syncCatalogLinkageAfterWrite(data, opts) {
  const config = resolveCatalogLinkConfig(data, opts);
  if (!config.enabled) return { linked: false, lines: [] };

  if (!toText(config.linkage.entryId) || !toText(config.linkage.entryHref)) {
    throw new Error('Catalog linkage requires entry_id and entry_href.');
  }
  if (!toText(config.linkage.lookupNumber)) throw new Error('Catalog linkage requires lookup_number.');
  if (!toText(config.linkage.season)) throw new Error('Catalog linkage requires season.');
  if (!toText(config.linkage.performer)) throw new Error('Catalog linkage requires performer.');
  if (!toText(config.linkage.instrument)) throw new Error('Catalog linkage requires instrument.');
  if (!toText(config.linkage.status)) throw new Error('Catalog linkage requires status.');

  const { filePath, data: editorial } = await readCatalogEditorialSafe(config.filePath);
  const existing = findCatalogManifestEntry(editorial, config.linkage.entryId)
    || findCatalogManifestEntry(editorial, config.linkage.entryHref);

  if (config.mode === 'attach-existing') {
    if (!existing) {
      throw new Error(`attach-existing requires an existing catalog row for ${config.linkage.entryId}`);
    }
    const mismatches = [];
    if (toText(existing.lookup_number) && toText(existing.lookup_number).toLowerCase() !== config.linkage.lookupNumber.toLowerCase()) {
      mismatches.push(`lookup_number mismatch (${existing.lookup_number} != ${config.linkage.lookupNumber})`);
    }
    if (toText(existing.season) && toText(existing.season).toLowerCase() !== config.linkage.season.toLowerCase()) {
      mismatches.push(`season mismatch (${existing.season} != ${config.linkage.season})`);
    }
    if (toText(existing.performer) && toText(existing.performer).toLowerCase() !== config.linkage.performer.toLowerCase()) {
      mismatches.push(`performer mismatch (${existing.performer} != ${config.linkage.performer})`);
    }
    if (toText(existing.instrument) && toText(existing.instrument).toLowerCase() !== config.linkage.instrument.toLowerCase()) {
      mismatches.push(`instrument mismatch (${existing.instrument} != ${config.linkage.instrument})`);
    }
    if (mismatches.length) throw new Error(`attach-existing failed: ${mismatches.join('; ')}`);
  }

  const patch = resolveCatalogManifestPatchFromInitData(data, config.linkage);
  const next = upsertCatalogManifestEntry(editorial, patch);
  const writtenRow = (next.manifest || []).find((row) => toText(row.entry_id).toLowerCase() === patch.entry_id.toLowerCase())
    || patch;
  await assertCatalogManifestRowLinkage(writtenRow, {
    rootDir: process.cwd(),
    requireEntryExistsForStatuses: opts.dryRun ? new Set() : new Set(['active']),
  });
  await writeCatalogEditorialFile(next, filePath);

  const stubLines = await maybeCreateProtectedAssetsStub(config);
  return {
    linked: true,
    lines: [
      `✓ Linked entry ${patch.entry_id} to catalog (${config.mode})`,
      `Catalog file: ${path.resolve(filePath)}`,
      ...stubLines,
    ],
  };
}

export async function writeEntryFromData({ templatePath, templateHtml, data, opts = {}, log = () => {} }) {
  const folder = opts.flat
    ? path.join(path.resolve('.'), data.slug)
    : path.join(path.resolve(data.outDir || './entries'), data.slug);
  let folderExistsBefore = false;
  try {
    await fs.access(folder);
    folderExistsBefore = true;
  } catch {
    folderExistsBefore = false;
  }

  let result;
  try {
    assertLookupOnlyManifest(data.manifest);
    result = await writeEntryFromDataCore({
      templatePath,
      templateHtml,
      data,
      opts,
    });
    const linkage = await syncCatalogLinkageAfterWrite(data, opts);
    if (Array.isArray(linkage.lines) && linkage.lines.length) {
      result.lines.push(...linkage.lines);
    }
  } catch (error) {
    if (!opts.dryRun && !folderExistsBefore) {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  }

  result.lines.forEach((line) => log(line));
  return result;
}
