#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'sanitize.config.json');

if (!fs.existsSync(configPath)) {
  console.error('sanitize:assets error: sanitize.config.json was not found.');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const verifyMode = args.has('--verify');
const processAllHtml = args.has('--all-html');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif', '.ico']);

const siteRoot = fs.existsSync(path.join(repoRoot, 'docs', 'index.html'))
  ? path.join(repoRoot, 'docs')
  : repoRoot;

const outputDir = path.join(siteRoot, config.assetOutDir || 'assets/img');
const manifestPath = path.join(repoRoot, 'assets', 'assets-manifest.json');
const localMirrorRoots = [
  path.join(siteRoot, 'content'),
  path.join(siteRoot, 'static'),
  path.join(siteRoot, 'universal'),
];

const htmlAttrRegex = /(\b(?:src|href|content)=["'])(https?:\/\/[^"']+)(["'])/g;
const htmlAttrProtocolRegex = /(\b(?:src|href|content)=["'])(\/\/[^"']+)(["'])/g;
const htmlExtraAttrRegex = /(\b(?:poster|data-src|data-image)=["'])(https?:\/\/[^"']+)(["'])/g;
const htmlExtraAttrProtocolRegex = /(\b(?:poster|data-src|data-image)=["'])(\/\/[^"']+)(["'])/g;
const srcsetRegex = /(\bsrcset=["'])([^"']+)(["'])/g;
const jsonLdImageRegex = /("image"\s*:\s*")(https?:\/\/[^"]+|\/\/[^"]+)(")/g;
const cssUrlRegex = /url\(\s*(["']?)(https?:\/\/[^\)"'\s]+)\1\s*\)/g;
const cssUrlProtocolRegex = /url\(\s*(["']?)(\/\/[^\)"'\s]+)\1\s*\)/g;

const remoteTokenRegex = /https?:\/\/[^\s,]+|\/\/[^\s,]+/g;

const contentTypeToExtension = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['image/avif', '.avif'],
  ['image/x-icon', '.ico'],
  ['image/vnd.microsoft.icon', '.ico'],
]);

const mapping = new Map();
const manifest = {};
let downloadedCount = 0;
let rewrittenRefsCount = 0;
let jsonLdFallbackPath = null;

const failures = [];
const verifyHits = new Map();
let localMirrorNameIndex = null;

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output.split('\0').filter(Boolean).map((entry) => toPosixPath(entry));
}

function isExcluded(relativePath) {
  return relativePath.startsWith('.git/')
    || relativePath.startsWith('node_modules/')
    || relativePath.startsWith('dist/');
}

function resolvePageFile(pagePath) {
  const normalized = pagePath === '/' ? '' : pagePath.replace(/^\/+|\/+$/g, '');
  const candidates = normalized
    ? [
        `${normalized}.html`,
        `${normalized}/index.html`,
        `docs/${normalized}.html`,
        `docs/${normalized}/index.html`,
      ]
    : ['index.html', 'docs/index.html'];

  for (const candidate of candidates) {
    const absolutePath = path.join(repoRoot, candidate);
    if (fs.existsSync(absolutePath)) {
      return candidate;
    }
  }

  return null;
}

function collectHtmlFiles(trackedFiles) {
  if (processAllHtml) {
    return trackedFiles
      .filter((relativePath) => !isExcluded(relativePath))
      .filter((relativePath) => relativePath.toLowerCase().endsWith('.html'))
      .sort();
  }

  const files = new Set();
  const pages = Array.isArray(config.pages) ? config.pages : ['/'];
  for (const pagePath of pages) {
    const resolved = resolvePageFile(String(pagePath));
    if (resolved) {
      files.add(resolved);
    }
  }

  if (fs.existsSync(path.join(repoRoot, 'entry-template', 'index.html'))) {
    files.add('entry-template/index.html');
  }

  return Array.from(files).sort();
}

function collectCssFiles(trackedFiles) {
  return trackedFiles
    .filter((relativePath) => !isExcluded(relativePath))
    .filter((relativePath) => relativePath.toLowerCase().endsWith('.css'))
    .filter((relativePath) => (
      relativePath.startsWith('assets/css/')
      || relativePath.startsWith('css/')
      || relativePath.startsWith('docs/css/')
    ))
    .sort();
}

function normalizeUrlForFetch(url) {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

function parseUrl(url) {
  try {
    return new URL(normalizeUrlForFetch(url));
  } catch {
    return null;
  }
}

function extractKnownImageExtension(urlObject) {
  const extension = path.extname(urlObject.pathname || '').toLowerCase();
  if (imageExtensions.has(extension)) {
    return extension;
  }
  return '';
}

function extensionFromContentType(contentType) {
  if (!contentType) {
    return '';
  }

  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return contentTypeToExtension.get(normalized) || '';
}

function isLikelyImageCandidate(url, context) {
  const parsed = parseUrl(url);
  if (!parsed || !/^https?:$/i.test(parsed.protocol)) {
    return false;
  }

  if (context === 'json-ld') {
    return true;
  }

  const rawExtension = path.extname(parsed.pathname || '').toLowerCase();
  const knownExtension = extractKnownImageExtension(parsed);
  if (knownExtension) {
    if (context === 'css-url' && (parsed.pathname || '').toLowerCase().includes('/fonts/')) {
      return false;
    }
    return true;
  }

  if (rawExtension && !imageExtensions.has(rawExtension)) {
    return false;
  }

  const pathname = (parsed.pathname || '').toLowerCase();
  const query = (parsed.search || '').toLowerCase();
  if (pathname.includes('/content/') || pathname.includes('/images/')) {
    return true;
  }
  if (query.includes('format=')) {
    return true;
  }
  if (context === 'srcset') {
    return true;
  }

  return false;
}

function decodePathname(pathnameValue) {
  try {
    return decodeURIComponent(pathnameValue);
  } catch {
    return pathnameValue;
  }
}

function walkFiles(rootDir, onFile) {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
      } else if (entry.isFile()) {
        onFile(nextPath);
      }
    }
  }
}

function getLocalMirrorNameIndex() {
  if (localMirrorNameIndex) {
    return localMirrorNameIndex;
  }

  const index = new Map();
  for (const root of localMirrorRoots) {
    walkFiles(root, (absolutePath) => {
      const base = path.basename(absolutePath).toLowerCase();
      if (!base) {
        return;
      }

      if (!index.has(base)) {
        index.set(base, absolutePath);
      }
    });
  }

  localMirrorNameIndex = index;
  return index;
}

function findLocalMirrorByBasename(pathnameValue) {
  const base = path.basename(pathnameValue || '').toLowerCase();
  if (!base) {
    return null;
  }

  const index = getLocalMirrorNameIndex();
  return index.get(base) || null;
}

function findLocalMirror(urlObject) {
  const host = urlObject.hostname.toLowerCase();
  const pathnameValue = decodePathname(urlObject.pathname || '');
  const querySuffix = urlObject.search || '';

  function resolveCandidate(rootDir) {
    const baseCandidate = path.join(rootDir, pathnameValue);
    if (fs.existsSync(baseCandidate) && fs.statSync(baseCandidate).isFile()) {
      return baseCandidate;
    }

    if (querySuffix) {
      const queryCandidate = path.join(rootDir, `${pathnameValue}${querySuffix}`);
      if (fs.existsSync(queryCandidate) && fs.statSync(queryCandidate).isFile()) {
        return queryCandidate;
      }
    }

    return null;
  }

  if (host === 'images.squarespace-cdn.com' && pathnameValue.startsWith('/content/')) {
    const candidate = resolveCandidate(siteRoot);
    if (candidate) {
      return candidate;
    }
  }

  if (host === 'static1.squarespace.com' && pathnameValue.startsWith('/static/')) {
    const candidate = resolveCandidate(siteRoot);
    if (candidate) {
      return candidate;
    }
  }

  if (host === 'assets.squarespace.com' && pathnameValue.startsWith('/universal/')) {
    const candidate = resolveCandidate(siteRoot);
    if (candidate) {
      return candidate;
    }
  }

  const byBasename = findLocalMirrorByBasename(pathnameValue);
  if (byBasename) {
    return byBasename;
  }

  return null;
}

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 20);
}

function localPathForAsset(fileName) {
  const outputPath = path.posix.join(config.assetOutDir || 'assets/img', fileName);
  return `/${outputPath}`;
}

function pickExistingAssetFallback() {
  if (!fs.existsSync(outputDir)) {
    return null;
  }

  const candidates = fs.readdirSync(outputDir)
    .filter((entry) => imageExtensions.has(path.extname(entry).toLowerCase()))
    .sort();

  if (candidates.length === 0) {
    return null;
  }

  return localPathForAsset(candidates[0]);
}

async function readRemoteImage(urlObject) {
  const response = await fetch(urlObject.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || '',
  };
}

function registerVerifyHit(url, relativePath) {
  if (!verifyHits.has(url)) {
    verifyHits.set(url, new Set());
  }
  verifyHits.get(url).add(relativePath);
}

async function ensureLocalAsset(originalUrl, context, relativePath) {
  if (mapping.has(originalUrl)) {
    if (context === 'json-ld' && !jsonLdFallbackPath) {
      jsonLdFallbackPath = mapping.get(originalUrl);
    }
    return mapping.get(originalUrl);
  }

  if (!isLikelyImageCandidate(originalUrl, context)) {
    return null;
  }

  const parsed = parseUrl(originalUrl);
  if (!parsed || !/^https?:$/i.test(parsed.protocol)) {
    return null;
  }

  if (verifyMode) {
    registerVerifyHit(originalUrl, relativePath);
    return null;
  }

  try {
    let extension = extractKnownImageExtension(parsed);
    let bytes = null;
    let contentType = '';

    const localMirrorPath = findLocalMirror(parsed);
    if (localMirrorPath) {
      bytes = fs.readFileSync(localMirrorPath);
      if (!extension) {
        extension = extractKnownImageExtension(new URL(`https://local${parsed.pathname}`));
      }
    } else {
      const remote = await readRemoteImage(parsed);
      bytes = remote.bytes;
      contentType = remote.contentType;
    }

    if (!extension) {
      extension = extensionFromContentType(contentType);
    }

    if (!extension || !imageExtensions.has(extension)) {
      return null;
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `${hashUrl(originalUrl)}${extension}`;
    const absolutePath = path.join(outputDir, fileName);
    if (!fs.existsSync(absolutePath)) {
      fs.writeFileSync(absolutePath, bytes);
      downloadedCount += 1;
    }

    const localPath = localPathForAsset(fileName);
    mapping.set(originalUrl, localPath);
    manifest[originalUrl] = localPath;
    if (context === 'json-ld' && !jsonLdFallbackPath) {
      jsonLdFallbackPath = localPath;
    }
    return localPath;
  } catch (error) {
    if (context === 'json-ld') {
      const fallbackPath = jsonLdFallbackPath || pickExistingAssetFallback();
      if (fallbackPath) {
        jsonLdFallbackPath = fallbackPath;
        mapping.set(originalUrl, fallbackPath);
        manifest[originalUrl] = fallbackPath;
        return fallbackPath;
      }
    }

    failures.push({
      file: relativePath,
      url: originalUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function replaceAsync(text, regex, replacer) {
  let output = '';
  let cursor = 0;
  regex.lastIndex = 0;

  while (true) {
    const match = regex.exec(text);
    if (!match) {
      break;
    }

    output += text.slice(cursor, match.index);
    output += await replacer(match);
    cursor = regex.lastIndex;

    if (match.index === regex.lastIndex) {
      regex.lastIndex += 1;
    }
  }

  output += text.slice(cursor);
  return output;
}

async function rewriteHtmlContent(content, relativePath) {
  let updated = content;
  let changed = false;

  updated = await replaceAsync(updated, htmlAttrRegex, async (match) => {
    const [, prefix, url, suffix] = match;
    const localPath = await ensureLocalAsset(url, 'attr', relativePath);
    if (!localPath) {
      return match[0];
    }
    changed = true;
    rewrittenRefsCount += 1;
    return `${prefix}${localPath}${suffix}`;
  });

  updated = await replaceAsync(updated, htmlAttrProtocolRegex, async (match) => {
    const [, prefix, url, suffix] = match;
    const localPath = await ensureLocalAsset(url, 'attr', relativePath);
    if (!localPath) {
      return match[0];
    }
    changed = true;
    rewrittenRefsCount += 1;
    return `${prefix}${localPath}${suffix}`;
  });

  updated = await replaceAsync(updated, htmlExtraAttrRegex, async (match) => {
    const [, prefix, url, suffix] = match;
    const localPath = await ensureLocalAsset(url, 'attr', relativePath);
    if (!localPath) {
      return match[0];
    }
    changed = true;
    rewrittenRefsCount += 1;
    return `${prefix}${localPath}${suffix}`;
  });

  updated = await replaceAsync(updated, htmlExtraAttrProtocolRegex, async (match) => {
    const [, prefix, url, suffix] = match;
    const localPath = await ensureLocalAsset(url, 'attr', relativePath);
    if (!localPath) {
      return match[0];
    }
    changed = true;
    rewrittenRefsCount += 1;
    return `${prefix}${localPath}${suffix}`;
  });

  updated = await replaceAsync(updated, srcsetRegex, async (match) => {
    const [, prefix, srcsetBody, suffix] = match;
    let bodyChanged = false;

    const rewrittenBody = await replaceAsync(srcsetBody, remoteTokenRegex, async (tokenMatch) => {
      const [urlToken] = tokenMatch;
      const localPath = await ensureLocalAsset(urlToken, 'srcset', relativePath);
      if (!localPath) {
        return urlToken;
      }
      bodyChanged = true;
      rewrittenRefsCount += 1;
      return localPath;
    });

    if (!bodyChanged) {
      return match[0];
    }

    changed = true;
    return `${prefix}${rewrittenBody}${suffix}`;
  });

  updated = await replaceAsync(updated, jsonLdImageRegex, async (match) => {
    const [, prefix, url, suffix] = match;
    const localPath = await ensureLocalAsset(url, 'json-ld', relativePath);
    if (!localPath) {
      return match[0];
    }
    changed = true;
    rewrittenRefsCount += 1;
    return `${prefix}${localPath}${suffix}`;
  });

  return { updated, changed };
}

async function rewriteCssContent(content, relativePath) {
  let updated = content;
  let changed = false;

  updated = await replaceAsync(updated, cssUrlRegex, async (match) => {
    const [, quote, url] = match;
    const localPath = await ensureLocalAsset(url, 'css-url', relativePath);
    if (!localPath) {
      return match[0];
    }
    changed = true;
    rewrittenRefsCount += 1;
    return `url(${quote}${localPath}${quote})`;
  });

  updated = await replaceAsync(updated, cssUrlProtocolRegex, async (match) => {
    const [, quote, url] = match;
    const localPath = await ensureLocalAsset(url, 'css-url', relativePath);
    if (!localPath) {
      return match[0];
    }
    changed = true;
    rewrittenRefsCount += 1;
    return `url(${quote}${localPath}${quote})`;
  });

  return { updated, changed };
}

async function rewriteFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const isHtml = relativePath.toLowerCase().endsWith('.html');
  const isCss = relativePath.toLowerCase().endsWith('.css');

  if (!isHtml && !isCss) {
    return;
  }

  const result = isHtml
    ? await rewriteHtmlContent(content, relativePath)
    : await rewriteCssContent(content, relativePath);

  if (result.changed && !verifyMode) {
    fs.writeFileSync(absolutePath, result.updated, 'utf8');
  }
}

async function main() {
  const trackedFiles = listTrackedFiles();
  const htmlFiles = collectHtmlFiles(trackedFiles);
  const cssFiles = collectCssFiles(trackedFiles);
  const filesToProcess = Array.from(new Set([...htmlFiles, ...cssFiles]));

  for (const relativePath of filesToProcess) {
    await rewriteFile(relativePath);
  }

  if (!verifyMode) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const sortedManifest = {};
    for (const key of Object.keys(manifest).sort()) {
      sortedManifest[key] = manifest[key];
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(sortedManifest, null, 2)}\n`, 'utf8');
  }

  console.log(`sanitize:assets report`);
  console.log(`- mode: ${verifyMode ? 'verify' : 'rewrite'}`);
  console.log(`- html files: ${htmlFiles.length}`);
  console.log(`- css files: ${cssFiles.length}`);
  console.log(`- downloaded count: ${downloadedCount}`);
  console.log(`- rewritten refs count: ${rewrittenRefsCount}`);
  console.log(`- failures: ${failures.length}`);

  for (const failure of failures) {
    console.log(`  - ${failure.file} :: ${failure.url} :: ${failure.reason}`);
  }

  if (verifyMode && verifyHits.size > 0) {
    console.error(`sanitize:assets verify failed. Remote image URLs remain (${verifyHits.size} unique URLs).`);
    for (const [url, fileSet] of Array.from(verifyHits.entries()).sort(([left], [right]) => left.localeCompare(right))) {
      console.error(`- ${url}`);
      for (const filePath of Array.from(fileSet).sort()) {
        console.error(`  - ${filePath}`);
      }
    }
    process.exit(1);
  }

  if (!verifyMode && failures.length > 0) {
    console.log('sanitize:assets completed with recoverable download failures.');
  }
}

main().catch((error) => {
  console.error(`sanitize:assets error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
