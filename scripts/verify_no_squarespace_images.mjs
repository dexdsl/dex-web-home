#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'sanitize.config.json');
const TARGETS_PATH = path.join(ROOT, 'artifacts', 'repo-targets.json');
const URL_PATTERN = /https?:\/\/[^\s"'`<>()]+|\/\/[^\s"'`<>()]+/gi;
const MAX_SAMPLES = 200;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif', '.ico', '.gif']);
const NON_IMAGE_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.map',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp4',
  '.webm',
  '.m3u8',
  '.mp3',
  '.wav',
]);

function loadJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} was not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeDomains(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
}

function parseUrl(rawUrl) {
  try {
    const normalized = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
    return new URL(normalized);
  } catch {
    return null;
  }
}

function isSquarespaceImageUrl(parsed) {
  const hostname = parsed.hostname.toLowerCase();
  const ext = path.extname(parsed.pathname || '').toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  if (NON_IMAGE_EXTENSIONS.has(ext)) return false;
  if (hostname === 'images.squarespace-cdn.com') return true;
  return (parsed.search || '').toLowerCase().includes('format=');
}

function collectMatches(content, domainSet) {
  const matches = [];
  URL_PATTERN.lastIndex = 0;
  let match = URL_PATTERN.exec(content);
  while (match) {
    const rawUrl = match[0];
    const parsed = parseUrl(rawUrl);
    if (parsed && domainSet.has(parsed.hostname.toLowerCase()) && isSquarespaceImageUrl(parsed)) {
      matches.push(rawUrl);
      if (matches.length >= MAX_SAMPLES) break;
    }
    match = URL_PATTERN.exec(content);
  }
  return matches;
}

function main() {
  const config = loadJSON(CONFIG_PATH, 'sanitize.config.json');
  const targets = loadJSON(TARGETS_PATH, 'artifacts/repo-targets.json');
  const domains = normalizeDomains(config.squarespaceImageDomains);
  if (domains.length === 0) {
    throw new Error('sanitize.config.json squarespaceImageDomains is empty.');
  }
  const domainSet = new Set(domains);

  const files = Array.from(
    new Set([
      ...(Array.isArray(targets.htmlFiles) ? targets.htmlFiles : []),
      ...(Array.isArray(targets.cssFiles) ? targets.cssFiles : []),
      ...(Array.isArray(targets.jsFiles) ? targets.jsFiles : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const findings = [];
  for (const relativePath of files) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const content = fs.readFileSync(absolutePath, 'utf8');
    const matches = collectMatches(content, domainSet);
    for (const matched of matches) {
      findings.push({ file: relativePath, url: matched });
      if (findings.length >= MAX_SAMPLES) break;
    }
    if (findings.length >= MAX_SAMPLES) break;
  }

  if (findings.length > 0) {
    console.error(`verify:no-sq-images failed. Found ${findings.length} offending URLs.`);
    for (const finding of findings) {
      console.error(`- ${finding.file} :: ${finding.url}`);
    }
    process.exit(1);
  }

  console.log(`verify:no-sq-images passed (${files.length} files scanned).`);
}

try {
  main();
} catch (error) {
  console.error(`verify:no-sq-images error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
