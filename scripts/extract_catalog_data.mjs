#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { buildCatalogModelFromHtml, buildSearchIndex } from './lib/catalog-model.mjs';

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'docs', 'catalog', 'index.html');
const OUT_DATA_PATH = path.join(ROOT, 'public', 'data', 'catalog.data.json');
const OUT_ENTRIES_PATH = path.join(ROOT, 'public', 'data', 'catalog.entries.json');
const OUT_GUIDE_PATH = path.join(ROOT, 'public', 'data', 'catalog.guide.json');
const OUT_SYMBOLS_PATH = path.join(ROOT, 'public', 'data', 'catalog.symbols.json');
const OUT_SEARCH_PATH = path.join(ROOT, 'public', 'data', 'catalog.search.json');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function tryReadExistingModel() {
  if (!fs.existsSync(OUT_DATA_PATH)) return null;
  try {
    const existing = JSON.parse(fs.readFileSync(OUT_DATA_PATH, 'utf8'));
    if (Array.isArray(existing.entries) && existing.entries.length > 0) return existing;
  } catch {
    // Ignore malformed existing outputs.
  }
  return null;
}

function tryExtractFromGitHead() {
  try {
    const legacyHtml = execSync('git show HEAD:docs/catalog/index.html', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const model = buildCatalogModelFromHtml(legacyHtml, 'git-head-catalog-html');
    if (Array.isArray(model.entries) && model.entries.length > 0) return model;
  } catch {
    // Ignore git lookup errors.
  }
  return null;
}

function countProtectedChars(value) {
  if (typeof value === 'string') {
    const match = value.match(/[\u00A0\u200B\u200C\u200D]/g);
    return match ? match.length : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countProtectedChars(item), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + countProtectedChars(item), 0);
  }
  return 0;
}

function buildEntriesPayload(model) {
  const entries = Array.isArray(model?.entries) ? model.entries : [];
  return {
    source: model?.source || 'unknown',
    generated_at: new Date().toISOString(),
    anchors: {
      performer: model?.anchors?.performer || '#dex-performer',
      instrument: model?.anchors?.instrument || '#dex-instrument',
      lookup: model?.anchors?.lookup || '#dex-lookup',
    },
    stats: {
      entries_count: Number(model?.stats?.entries_count || entries.length),
      lookup_count: Number(model?.stats?.lookup_count || 0),
      seasons: Array.isArray(model?.stats?.seasons) ? model.stats.seasons : [],
      instruments: Array.isArray(model?.stats?.instruments) ? model.stats.instruments : [],
      protected_char_count: countProtectedChars(entries),
    },
    spotlight: model?.spotlight || {},
    entries,
  };
}

function buildGuidePayload(model) {
  const guide = model?.guide || {};
  const payload = {
    source: model?.source || 'unknown',
    generated_at: new Date().toISOString(),
    route: '/catalog/how/',
    anchor: model?.anchors?.how || '#dex-how',
    heading_raw: 'How to Read Our Lookup Numbers',
    intro_raw: guide.intro_raw || '',
    parts: Array.isArray(guide.parts) ? guide.parts : [],
    examples: Array.isArray(guide.examples) ? guide.examples : [],
    anchors: Array.isArray(guide.anchors) ? guide.anchors : [],
  };
  payload.protected_char_count = countProtectedChars(payload);
  return payload;
}

function buildSymbolsPayload(model) {
  const symbols = model?.symbols || {};
  const payload = {
    source: model?.source || 'unknown',
    generated_at: new Date().toISOString(),
    route: '/catalog/symbols/',
    anchor: model?.anchors?.symbols || '#list-of-identifiers',
    heading_raw: symbols.heading_raw || 'List of Symbols',
    instrument: Array.isArray(symbols.instrument) ? symbols.instrument : [],
    collection: Array.isArray(symbols.collection) ? symbols.collection : [],
    quality: Array.isArray(symbols.quality) ? symbols.quality : [],
    qualifier: Array.isArray(symbols.qualifier) ? symbols.qualifier : [],
  };
  payload.protected_char_count = countProtectedChars(payload);
  return payload;
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Missing source catalog html: ${SOURCE_PATH}`);
  }

  const html = fs.readFileSync(SOURCE_PATH, 'utf8');
  let model = buildCatalogModelFromHtml(html, 'local-catalog-html');

  if (!Array.isArray(model.entries) || model.entries.length === 0) {
    const fromGitHead = tryExtractFromGitHead();
    if (fromGitHead) {
      model = fromGitHead;
    } else {
      const existing = tryReadExistingModel();
      if (existing) {
        model = existing;
      } else {
        throw new Error('No catalog entries found in local source, git HEAD snapshot, or existing canonical data.');
      }
    }
  }

  const search = buildSearchIndex(model);
  const entries = buildEntriesPayload(model);
  const guide = buildGuidePayload(model);
  const symbols = buildSymbolsPayload(model);

  writeJson(OUT_DATA_PATH, model);
  writeJson(OUT_ENTRIES_PATH, entries);
  writeJson(OUT_GUIDE_PATH, guide);
  writeJson(OUT_SYMBOLS_PATH, symbols);
  writeJson(OUT_SEARCH_PATH, search);

  console.log(`catalog:extract wrote ${path.relative(ROOT, OUT_DATA_PATH)} (${model.entries.length} entries)`);
  console.log(`catalog:extract wrote ${path.relative(ROOT, OUT_ENTRIES_PATH)} (${entries.entries.length} entries)`);
  console.log(`catalog:extract wrote ${path.relative(ROOT, OUT_GUIDE_PATH)} (${guide.parts.length} guide parts)`);
  console.log(
    `catalog:extract wrote ${path.relative(ROOT, OUT_SYMBOLS_PATH)} (${symbols.instrument.length + symbols.collection.length + symbols.quality.length + symbols.qualifier.length} symbol rows)`,
  );
  console.log(`catalog:extract wrote ${path.relative(ROOT, OUT_SEARCH_PATH)} (${search.entries.length} search rows)`);
}

try {
  main();
} catch (error) {
  console.error(`catalog:extract failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
