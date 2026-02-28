import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTECTED_ASSETS_VERSION,
  normalizeProtectedAssetsFile,
} from './protected-assets-schema.mjs';
import { readCatalogEditorialFile } from './catalog-editorial-store.mjs';

const DEFAULT_API_BY_ENV = {
  prod: 'https://dex-api.spring-fog-8edd.workers.dev',
  test: 'https://dex-api.spring-fog-8edd.workers.dev',
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_PROTECTED_ASSETS_PATH = path.join(ROOT, 'data', 'protected.assets.json');

function toText(value) {
  return String(value ?? '').trim();
}

function normalizeEnv(value) {
  const raw = toText(value).toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'test' || raw === 'staging' || raw === 'sandbox') return 'test';
  throw new Error(`Unsupported assets env: ${value}`);
}

function normalizeApiBase(value) {
  const parsed = new URL(toText(value));
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported assets API protocol: ${parsed.protocol}`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

function resolveAssetsApiBase(env = 'test') {
  const normalized = normalizeEnv(env);
  const fromEnv = normalized === 'prod'
    ? process.env.DEX_ASSETS_API_BASE_PROD
      || process.env.DEX_API_BASE_PROD
      || process.env.DEX_API_BASE_URL
    : process.env.DEX_ASSETS_API_BASE_TEST
      || process.env.DEX_API_BASE_TEST
      || process.env.DEX_API_BASE_URL;
  return normalizeApiBase(fromEnv || DEFAULT_API_BY_ENV[normalized]);
}

function resolveAssetsAdminToken(env = 'test', { required = true } = {}) {
  const normalized = normalizeEnv(env);
  const direct = normalized === 'prod'
    ? process.env.DEX_ASSETS_ADMIN_TOKEN_PROD || process.env.ASSETS_ADMIN_TOKEN_PROD
    : process.env.DEX_ASSETS_ADMIN_TOKEN_TEST || process.env.ASSETS_ADMIN_TOKEN_TEST;
  const shared = process.env.DEX_ASSETS_ADMIN_TOKEN
    || process.env.ASSETS_ADMIN_TOKEN
    || process.env.DEX_MAINTENANCE_TOKEN;
  const token = toText(direct || shared);
  if (required && !token) {
    throw new Error(
      `Missing assets admin token for ${normalized}. Set DEX_ASSETS_ADMIN_TOKEN_${normalized.toUpperCase()} or DEX_ASSETS_ADMIN_TOKEN.`,
    );
  }
  return token;
}

function stableSortBy(values, keyFn) {
  return [...values].sort((a, b) => keyFn(a).localeCompare(keyFn(b)));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function keyLookup(row) {
  return String(row.lookup_number || '');
}

function keyFile(row) {
  return String(row.bucket_number || '');
}

function keyEntitlement(row) {
  return `${row.lookup_number || ''}|${row.entitlement_type || ''}|${row.entitlement_value || ''}`;
}

export function getProtectedAssetsFilePath(customPath) {
  return customPath ? path.resolve(customPath) : DEFAULT_PROTECTED_ASSETS_PATH;
}

export function defaultProtectedAssetsData() {
  return {
    version: PROTECTED_ASSETS_VERSION,
    updatedAt: new Date().toISOString(),
    settings: {
      storageBucket: 'dex-protected-assets',
      allowedBuckets: ['A', 'B', 'C', 'D', 'E', 'X'],
      syncStrategy: 'manifest-publish',
    },
    lookups: [],
    exemptions: [],
  };
}

export async function readProtectedAssetsFile(customPath) {
  const filePath = getProtectedAssetsFilePath(customPath);
  const text = await fs.readFile(filePath, 'utf8');
  const raw = JSON.parse(text);
  const data = normalizeProtectedAssetsFile(raw);
  return { filePath, data };
}

export async function writeProtectedAssetsFile(data, customPath) {
  const filePath = getProtectedAssetsFilePath(customPath);
  const normalized = normalizeProtectedAssetsFile({
    ...(data || defaultProtectedAssetsData()),
    version: PROTECTED_ASSETS_VERSION,
    updatedAt: new Date().toISOString(),
  });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return { filePath, data: normalized };
}

export function buildProtectedAssetsPayload(input) {
  const normalized = normalizeProtectedAssetsFile(input || defaultProtectedAssetsData());
  const updatedAt = new Date().toISOString();

  const lookups = stableSortBy(
    normalized.lookups.map((lookup) => ({
      lookup_number: lookup.lookupNumber,
      title: lookup.title,
      status: lookup.status,
      season: lookup.season,
      updated_at: updatedAt,
    })),
    keyLookup,
  );

  const files = stableSortBy(
    normalized.lookups.flatMap((lookup) => lookup.files.map((file) => ({
      lookup_number: lookup.lookupNumber,
      file_id: file.fileId,
      bucket_number: file.bucketNumber,
      bucket: file.bucket,
      r2_key: file.r2Key,
      drive_file_id: file.driveFileId,
      size_bytes: Number(file.sizeBytes || 0),
      mime: file.mime,
      position: Number(file.position || 0),
      storage_bucket: normalized.settings.storageBucket,
    }))),
    keyFile,
  );

  const entitlements = stableSortBy(
    normalized.lookups.flatMap((lookup) => lookup.entitlements.map((entitlement) => ({
      lookup_number: lookup.lookupNumber,
      entitlement_type: entitlement.type,
      entitlement_value: entitlement.value,
    }))),
    keyEntitlement,
  );

  const payload = {
    version: PROTECTED_ASSETS_VERSION,
    updatedAt: normalized.updatedAt,
    settings: {
      storage_bucket: normalized.settings.storageBucket,
      allowed_buckets: normalized.settings.allowedBuckets,
      sync_strategy: normalized.settings.syncStrategy,
    },
    lookups,
    files,
    entitlements,
    exemptions: Array.isArray(normalized.exemptions)
      ? normalized.exemptions.map((entry) => ({
        lookup_number: entry.lookupNumber,
        downloads_mode: entry.downloadsMode,
        reason: entry.reason,
      }))
      : [],
  };

  return {
    payload,
    manifestHash: digest(payload),
    counts: {
      lookups: lookups.length,
      files: files.length,
      entitlements: entitlements.length,
    },
  };
}

export async function validateCatalogLookupCoverage({
  assetsData,
  catalogFilePath,
} = {}) {
  const normalized = normalizeProtectedAssetsFile(assetsData || defaultProtectedAssetsData());
  const { data: catalog } = await readCatalogEditorialFile(catalogFilePath);
  const activeRows = (Array.isArray(catalog?.manifest) ? catalog.manifest : [])
    .filter((row) => String(row?.status || 'active').trim().toLowerCase() === 'active');

  const lookupSet = new Set((normalized.lookups || []).map((entry) => String(entry.lookupNumber || '').trim().toLowerCase()).filter(Boolean));
  const exemptionSet = new Set((normalized.exemptions || []).map((entry) => String(entry.lookupNumber || '').trim().toLowerCase()).filter(Boolean));
  const missing = [];
  let skippedLegacyLookupCount = 0;
  for (const row of activeRows) {
    const lookupNumber = String(row?.lookup_number || '').trim();
    if (!lookupNumber) continue;
    if (!/^SUB\d+/i.test(lookupNumber)) {
      skippedLegacyLookupCount += 1;
      continue;
    }
    const key = lookupNumber.toLowerCase();
    if (lookupSet.has(key) || exemptionSet.has(key)) continue;
    missing.push(lookupNumber);
  }
  return {
    ok: missing.length === 0,
    missing,
    activeCount: activeRows.length,
    mappedCount: lookupSet.size,
    exemptCount: exemptionSet.size,
    skippedLegacyLookupCount,
  };
}

async function requestJson(pathname, {
  method = 'GET',
  env = 'test',
  body,
  apiBase,
  adminToken,
  requiredToken = true,
} = {}) {
  const normalizedEnv = normalizeEnv(env);
  const resolvedApiBase = apiBase ? normalizeApiBase(apiBase) : resolveAssetsApiBase(normalizedEnv);
  const token = toText(adminToken || resolveAssetsAdminToken(normalizedEnv, { required: requiredToken }));

  const headers = {
    accept: 'application/json',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${resolvedApiBase}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    const detail = parsed?.error || parsed?.detail || response.statusText;
    const err = new Error(`${method} ${pathname} failed (${response.status}): ${detail}`);
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }

  return {
    env: normalizedEnv,
    apiBase: resolvedApiBase,
    payload: parsed,
    status: response.status,
  };
}

export async function publishProtectedAssets({
  env = 'test',
  filePath,
  dryRun = false,
  apiBase,
  adminToken,
  sourceData,
} = {}) {
  const localData = sourceData
    ? normalizeProtectedAssetsFile(sourceData)
    : (await readProtectedAssetsFile(filePath)).data;
  const coverage = await validateCatalogLookupCoverage({
    assetsData: localData,
    catalogFilePath: process.env.DEX_CATALOG_EDITORIAL_PATH,
  });
  if (!coverage.ok) {
    throw new Error(`Missing protected asset coverage for active catalog lookups: ${coverage.missing.join(', ')}`);
  }
  const built = buildProtectedAssetsPayload(localData);

  const response = await requestJson('/admin/assets/publish', {
    method: 'POST',
    env,
    apiBase,
    adminToken,
    body: {
      ...built.payload,
      manifestHash: built.manifestHash,
      dryRun: Boolean(dryRun),
    },
  });

  return {
    env: response.env,
    apiBase: response.apiBase,
    manifestHash: built.manifestHash,
    counts: built.counts,
    dryRun: Boolean(dryRun),
    remote: response.payload,
  };
}

function parseRemoteState(payload) {
  const state = payload?.state || payload?.data || payload || {};
  const lookups = Array.isArray(state.lookups) ? state.lookups : [];
  const files = Array.isArray(state.files) ? state.files : [];
  const entitlements = Array.isArray(state.entitlements) ? state.entitlements : [];
  return {
    lookups: stableSortBy(lookups, keyLookup),
    files: stableSortBy(files, keyFile),
    entitlements: stableSortBy(entitlements, keyEntitlement),
    manifestHash: toText(state.manifestHash || payload?.manifestHash),
  };
}

function setDiff(localRows, remoteRows, keyFn) {
  const localMap = new Map(localRows.map((row) => [keyFn(row), row]));
  const remoteMap = new Map(remoteRows.map((row) => [keyFn(row), row]));

  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const [key, value] of localMap.entries()) {
    if (!remoteMap.has(key)) {
      added += 1;
      continue;
    }
    if (digest(value) !== digest(remoteMap.get(key))) {
      changed += 1;
    }
  }

  for (const key of remoteMap.keys()) {
    if (!localMap.has(key)) removed += 1;
  }

  return { added, removed, changed };
}

export async function diffProtectedAssets({
  env = 'test',
  filePath,
  apiBase,
  adminToken,
  sourceData,
} = {}) {
  const localData = sourceData
    ? normalizeProtectedAssetsFile(sourceData)
    : (await readProtectedAssetsFile(filePath)).data;
  const coverage = await validateCatalogLookupCoverage({
    assetsData: localData,
    catalogFilePath: process.env.DEX_CATALOG_EDITORIAL_PATH,
  });
  if (!coverage.ok) {
    throw new Error(`Missing protected asset coverage for active catalog lookups: ${coverage.missing.join(', ')}`);
  }
  const localBuilt = buildProtectedAssetsPayload(localData);

  const response = await requestJson('/admin/assets/state', {
    method: 'GET',
    env,
    apiBase,
    adminToken,
  });

  const remote = parseRemoteState(response.payload);
  const local = {
    lookups: localBuilt.payload.lookups,
    files: localBuilt.payload.files,
    entitlements: localBuilt.payload.entitlements,
    manifestHash: localBuilt.manifestHash,
  };

  return {
    env: response.env,
    apiBase: response.apiBase,
    localHash: local.manifestHash,
    remoteHash: remote.manifestHash,
    lookups: setDiff(local.lookups, remote.lookups, keyLookup),
    files: setDiff(local.files, remote.files, keyFile),
    entitlements: setDiff(local.entitlements, remote.entitlements, keyEntitlement),
    counts: {
      local: {
        lookups: local.lookups.length,
        files: local.files.length,
        entitlements: local.entitlements.length,
      },
      remote: {
        lookups: remote.lookups.length,
        files: remote.files.length,
        entitlements: remote.entitlements.length,
      },
    },
  };
}

export async function ensureProtectedAssetsBucket({
  env = 'test',
  bucketName,
  filePath,
  apiBase,
  adminToken,
  dryRun = false,
  sourceData,
} = {}) {
  const localData = sourceData
    ? normalizeProtectedAssetsFile(sourceData)
    : (await readProtectedAssetsFile(filePath)).data;
  const storageBucket = toText(bucketName || localData.settings?.storageBucket);
  if (!storageBucket) {
    throw new Error('Missing bucket name. Pass --name or define settings.storageBucket in data/protected.assets.json.');
  }

  const response = await requestJson('/admin/assets/bucket/ensure', {
    method: 'POST',
    env,
    apiBase,
    adminToken,
    body: {
      bucket: storageBucket,
      dryRun: Boolean(dryRun),
    },
  });

  return {
    env: response.env,
    apiBase: response.apiBase,
    bucket: storageBucket,
    dryRun: Boolean(dryRun),
    remote: response.payload,
  };
}

export {
  normalizeEnv as normalizeAssetsEnv,
  resolveAssetsApiBase,
  resolveAssetsAdminToken,
};
