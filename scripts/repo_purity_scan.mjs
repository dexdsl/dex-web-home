#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'sanitize.config.json');

if (!fs.existsSync(configPath)) {
  console.error('sanitize:scan error: sanitize.config.json was not found.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const forbiddenNeedles = Array.isArray(config.forbiddenNeedles)
  ? config.forbiddenNeedles.map((value) => String(value).toLowerCase())
  : [];

if (forbiddenNeedles.length === 0) {
  console.error('sanitize:scan error: forbiddenNeedles is empty in sanitize.config.json.');
  process.exit(1);
}

const ACTIVE_SURFACE_PATTERNS = [
  /^assets\/css\//,
  /^css\//,
  /^docs\/css\//,
  /^docs\/index\.html$/,
  /^docs\/favorites\/index\.html$/,
  /^entry-template\//,
  /^tests\//,
  /^\.github\/workflows\/sanitize\.yml$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^sanitize\.config\.json$/,
  /^playwright\.config\.ts$/,
];

const EXCLUDED_PATH_PATTERNS = [
  /^\.git\//,
  /^node_modules\//,
  /^dist\//,
  /^assets\/assets-manifest\.json$/,
];

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yml',
  '.yaml',
]);

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function isActiveSurface(relativePath) {
  if (EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath))) {
    return false;
  }

  if (ACTIVE_SURFACE_PATTERNS.some((pattern) => pattern.test(relativePath))) {
    return true;
  }

  return false;
}

function isLikelyText(buffer, extension) {
  if (TEXT_EXTENSIONS.has(extension.toLowerCase())) {
    return !buffer.includes(0);
  }

  if (buffer.length === 0) {
    return true;
  }

  const sampleSize = Math.min(buffer.length, 4096);
  let binaryBytes = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const value = buffer[index];
    if (value === 0) {
      return false;
    }
    if (value < 7 || (value > 14 && value < 32)) {
      binaryBytes += 1;
    }
  }
  return binaryBytes / sampleSize < 0.03;
}

function collectTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split('\0')
    .filter(Boolean)
    .map(toPosix)
    .filter((relativePath) => isActiveSurface(relativePath));
}

function collectUrlSurfaces(content) {
  const values = new Set();

  const rawUrlPattern = /https?:\/\/[^\s"'`<>\)]+/gi;
  let match = rawUrlPattern.exec(content);
  while (match) {
    values.add(match[0]);
    match = rawUrlPattern.exec(content);
  }

  const protocolRelativePattern = /(?:src|href|content)\s*=\s*["'](\/\/[^"']+)["']/gi;
  match = protocolRelativePattern.exec(content);
  while (match) {
    values.add(match[1]);
    match = protocolRelativePattern.exec(content);
  }

  const attrPattern = /(?:src|href|content)\s*=\s*["']([^"']+)["']/gi;
  match = attrPattern.exec(content);
  while (match) {
    values.add(match[1]);
    match = attrPattern.exec(content);
  }

  const cssUrlPattern = /url\(\s*["']?([^\)"'\s]+)["']?\s*\)/gi;
  match = cssUrlPattern.exec(content);
  while (match) {
    values.add(match[1]);
    match = cssUrlPattern.exec(content);
  }

  const srcsetPattern = /srcset\s*=\s*["']([^"']+)["']/gi;
  match = srcsetPattern.exec(content);
  while (match) {
    const srcsetBody = match[1];
    const urlTokenPattern = /https?:\/\/[^\s,]+|\/\/[^\s,]+/gi;
    let token = urlTokenPattern.exec(srcsetBody);
    while (token) {
      values.add(token[0]);
      token = urlTokenPattern.exec(srcsetBody);
    }
    match = srcsetPattern.exec(content);
  }

  return Array.from(values);
}

const trackedFiles = collectTrackedFiles();
const offenders = [];

for (const relativePath of trackedFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const extension = path.extname(relativePath);
  const buffer = fs.readFileSync(absolutePath);
  if (!isLikelyText(buffer, extension)) {
    continue;
  }

  const content = buffer.toString('utf8');
  const urlSurfaces = collectUrlSurfaces(content);

  for (const surface of urlSurfaces) {
    const lowerSurface = surface.toLowerCase();
    for (const needle of forbiddenNeedles) {
      if (!needle) {
        continue;
      }

      if (lowerSurface.includes(needle)) {
        offenders.push({
          file: relativePath,
          needle,
          sample: surface,
        });
      }
    }
  }
}

if (offenders.length > 0) {
  const deduped = new Map();
  for (const offender of offenders) {
    const key = `${offender.file}\u0000${offender.needle}\u0000${offender.sample}`;
    if (!deduped.has(key)) {
      deduped.set(key, offender);
    }
  }

  const sorted = Array.from(deduped.values()).sort((left, right) => {
    const fileCompare = left.file.localeCompare(right.file);
    if (fileCompare !== 0) return fileCompare;
    const needleCompare = left.needle.localeCompare(right.needle);
    if (needleCompare !== 0) return needleCompare;
    return left.sample.localeCompare(right.sample);
  });

  console.error('sanitize:scan failed. Forbidden references were found:');
  for (const offender of sorted) {
    console.error(`- ${offender.file} :: ${offender.needle} :: ${offender.sample}`);
  }
  process.exit(1);
}

console.log(`sanitize:scan passed (${trackedFiles.length} files scanned).`);
