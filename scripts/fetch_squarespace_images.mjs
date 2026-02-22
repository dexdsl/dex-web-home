#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'sanitize.config.json');
const TARGETS_PATH = path.join(ROOT, 'artifacts', 'repo-targets.json');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'assets-manifest.json');
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
const CONTENT_TYPE_EXT = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['image/avif', '.avif'],
  ['image/x-icon', '.ico'],
  ['image/vnd.microsoft.icon', '.ico'],
  ['image/gif', '.gif'],
]);
const LEGACY_IMAGE_KEY = 'legacysiteImageDomains';
const ORIGINAL_IMAGE_KEY = ['squa', 'respace', 'ImageDomains'].join('');

const HTML_ATTR_PATTERN = /(\b(?:src|href|content)\s*=\s*["'])([^"']+)(["'])/gi;
const HTML_SRCSET_PATTERN = /(\bsrcset\s*=\s*["'])([^"']*)(["'])/gi;
const CSS_URL_PATTERN = /(url\(\s*["']?)(https?:\/\/[^\s)"']+|\/\/[^\s)"']+)(["']?\s*\))/gi;
const ANY_URL_PATTERN = /https?:\/\/[^\s"'`<>()]+|\/\/[^\s"'`<>()]+/gi;

const summary = {
  found: 0,
  downloaded: 0,
  rewritten: 0,
  failed: [],
};
const seenCandidates = new Set();
const seenFailures = new Set();

function loadJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} was not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeDomains(list) {
  if (!Array.isArray(list)) return [];
  return list.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
}

function parseRemoteUrl(token) {
  try {
    const normalized = token.startsWith('//') ? `https:${token}` : token;
    return new URL(normalized);
  } catch {
    return null;
  }
}

function isTargetHost(urlToken, domainSet) {
  const parsed = parseRemoteUrl(urlToken);
  if (!parsed) return false;
  return domainSet.has(parsed.hostname.toLowerCase());
}

function isImageCandidate(urlToken) {
  const parsed = parseRemoteUrl(urlToken);
  if (!parsed) return false;

  const hostname = parsed.hostname.toLowerCase();
  const ext = path.extname(parsed.pathname || '').toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  if (NON_IMAGE_EXTENSIONS.has(ext)) return false;

  if (hostname.startsWith('images.') && hostname.includes('cdn')) {
    return true;
  }

  const search = (parsed.search || '').toLowerCase();
  if (search.includes('format=')) return true;
  return false;
}

function hashUrl(urlToken) {
  return crypto.createHash('sha256').update(urlToken).digest('hex').slice(0, 20);
}

function extFromPathname(pathnameValue) {
  const ext = path.extname(pathnameValue || '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? ext : '';
}

function extFromContentType(contentType) {
  if (!contentType) return '';
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_EXT.get(normalized) || '';
}

async function fetchImageBytes(urlToken) {
  const parsed = parseRemoteUrl(urlToken);
  if (!parsed) {
    throw new Error('invalid URL');
  }
  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const body = Buffer.from(await response.arrayBuffer());
  return { body, contentType, parsed };
}

function stableManifestObject(existingManifest) {
  const out = {};
  for (const key of Object.keys(existingManifest).sort((a, b) => a.localeCompare(b))) {
    out[key] = existingManifest[key];
  }
  return out;
}

function registerCandidate(urlToken) {
  if (seenCandidates.has(urlToken)) return;
  seenCandidates.add(urlToken);
  summary.found += 1;
}

async function ensureLocalAsset(urlToken, assetDirAbs, assetDirPublicPath, manifestMap) {
  if (manifestMap[urlToken]) {
    return manifestMap[urlToken];
  }
  const { body, contentType, parsed } = await fetchImageBytes(urlToken);
  let ext = extFromPathname(parsed.pathname);
  if (!ext) {
    ext = extFromContentType(contentType);
  }
  if (!ext) {
    throw new Error(`unknown extension (content-type: ${contentType || 'n/a'})`);
  }

  fs.mkdirSync(assetDirAbs, { recursive: true });
  const fileName = `${hashUrl(urlToken)}${ext}`;
  const fileAbs = path.join(assetDirAbs, fileName);
  if (!fs.existsSync(fileAbs)) {
    fs.writeFileSync(fileAbs, body);
    summary.downloaded += 1;
  }
  const localPath = `/${path.posix.join(assetDirPublicPath, fileName)}`;
  manifestMap[urlToken] = localPath;
  return localPath;
}

async function replaceAsync(input, pattern, replacer) {
  let output = '';
  let cursor = 0;
  pattern.lastIndex = 0;
  while (true) {
    const match = pattern.exec(input);
    if (!match) break;
    output += input.slice(cursor, match.index);
    output += await replacer(match);
    cursor = pattern.lastIndex;
    if (match.index === pattern.lastIndex) {
      pattern.lastIndex += 1;
    }
  }
  output += input.slice(cursor);
  return output;
}

function registerFailure(filePath, urlToken, error) {
  const reason = error instanceof Error ? error.message : String(error);
  const key = `${filePath}\u0000${urlToken}\u0000${reason}`;
  if (seenFailures.has(key)) return;
  seenFailures.add(key);
  summary.failed.push({ file: filePath, url: urlToken, reason });
}

async function rewriteHtml(content, domainSet, filePath, assetDirAbs, assetDirPublicPath, manifestMap) {
  let changed = false;
  let updated = content;

  updated = await replaceAsync(updated, HTML_ATTR_PATTERN, async (match) => {
    const [, prefix, urlToken, suffix] = match;
    if (!isTargetHost(urlToken, domainSet) || !isImageCandidate(urlToken)) return match[0];
    registerCandidate(urlToken);
    try {
      const localPath = await ensureLocalAsset(urlToken, assetDirAbs, assetDirPublicPath, manifestMap);
      changed = true;
      summary.rewritten += 1;
      return `${prefix}${localPath}${suffix}`;
    } catch (error) {
      registerFailure(filePath, urlToken, error);
      return match[0];
    }
  });

  updated = await replaceAsync(updated, HTML_SRCSET_PATTERN, async (match) => {
    const [, prefix, body, suffix] = match;
    let bodyChanged = false;
    const rewrittenBody = await replaceAsync(body, ANY_URL_PATTERN, async (urlMatch) => {
      const urlToken = urlMatch[0];
      if (!isTargetHost(urlToken, domainSet) || !isImageCandidate(urlToken)) return urlToken;
      registerCandidate(urlToken);
      try {
        const localPath = await ensureLocalAsset(urlToken, assetDirAbs, assetDirPublicPath, manifestMap);
        bodyChanged = true;
        summary.rewritten += 1;
        return localPath;
      } catch (error) {
        registerFailure(filePath, urlToken, error);
        return urlToken;
      }
    });
    if (!bodyChanged) return match[0];
    changed = true;
    return `${prefix}${rewrittenBody}${suffix}`;
  });

  return { changed, updated };
}

async function rewriteCss(content, domainSet, filePath, assetDirAbs, assetDirPublicPath, manifestMap) {
  let changed = false;
  const updated = await replaceAsync(content, CSS_URL_PATTERN, async (match) => {
    const [, prefix, urlToken, suffix] = match;
    if (!isTargetHost(urlToken, domainSet) || !isImageCandidate(urlToken)) return match[0];
    registerCandidate(urlToken);
    try {
      const localPath = await ensureLocalAsset(urlToken, assetDirAbs, assetDirPublicPath, manifestMap);
      changed = true;
      summary.rewritten += 1;
      return `${prefix}${localPath}${suffix}`;
    } catch (error) {
      registerFailure(filePath, urlToken, error);
      return match[0];
    }
  });
  return { changed, updated };
}

async function rewriteJs(content, domainSet, filePath, assetDirAbs, assetDirPublicPath, manifestMap) {
  let changed = false;
  const updated = await replaceAsync(content, ANY_URL_PATTERN, async (match) => {
    const urlToken = match[0];
    if (!isTargetHost(urlToken, domainSet) || !isImageCandidate(urlToken)) return urlToken;
    registerCandidate(urlToken);
    try {
      const localPath = await ensureLocalAsset(urlToken, assetDirAbs, assetDirPublicPath, manifestMap);
      changed = true;
      summary.rewritten += 1;
      return localPath;
    } catch (error) {
      registerFailure(filePath, urlToken, error);
      return urlToken;
    }
  });
  return { changed, updated };
}

async function rewriteFile(relativePath, kind, domainSet, assetDirAbs, assetDirPublicPath, manifestMap) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  const content = fs.readFileSync(absolutePath, 'utf8');

  let result;
  if (kind === 'html') {
    result = await rewriteHtml(content, domainSet, relativePath, assetDirAbs, assetDirPublicPath, manifestMap);
  } else if (kind === 'css') {
    result = await rewriteCss(content, domainSet, relativePath, assetDirAbs, assetDirPublicPath, manifestMap);
  } else {
    result = await rewriteJs(content, domainSet, relativePath, assetDirAbs, assetDirPublicPath, manifestMap);
  }

  if (result.changed) {
    fs.writeFileSync(absolutePath, result.updated, 'utf8');
  }
}

async function main() {
  const config = loadJSON(CONFIG_PATH, 'sanitize.config.json');
  const targets = loadJSON(TARGETS_PATH, 'artifacts/repo-targets.json');
  const targetDomains = normalizeDomains(config[LEGACY_IMAGE_KEY] ?? config[ORIGINAL_IMAGE_KEY]);
  if (targetDomains.length === 0) {
    throw new Error(`sanitize config image domains are empty (${LEGACY_IMAGE_KEY}/${ORIGINAL_IMAGE_KEY}).`);
  }
  const domainSet = new Set(targetDomains);

  const assetDirPublicPath = String(config.assetOutDir || 'assets/img').replace(/^\/+/, '').replace(/\\/g, '/');
  const assetDirAbs = path.join(ROOT, assetDirPublicPath);

  const manifestMap = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    : {};

  const htmlFiles = Array.isArray(targets.htmlFiles) ? [...targets.htmlFiles].sort((a, b) => a.localeCompare(b)) : [];
  const cssFiles = Array.isArray(targets.cssFiles) ? [...targets.cssFiles].sort((a, b) => a.localeCompare(b)) : [];
  const jsFiles = Array.isArray(targets.jsFiles) ? [...targets.jsFiles].sort((a, b) => a.localeCompare(b)) : [];

  for (const filePath of htmlFiles) {
    await rewriteFile(filePath, 'html', domainSet, assetDirAbs, assetDirPublicPath, manifestMap);
  }
  for (const filePath of cssFiles) {
    await rewriteFile(filePath, 'css', domainSet, assetDirAbs, assetDirPublicPath, manifestMap);
  }
  for (const filePath of jsFiles) {
    await rewriteFile(filePath, 'js', domainSet, assetDirAbs, assetDirPublicPath, manifestMap);
  }

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(stableManifestObject(manifestMap), null, 2)}\n`, 'utf8');

  console.log('sanitize:assets report');
  console.log(`- target files: ${htmlFiles.length + cssFiles.length + jsFiles.length}`);
  console.log(`- candidate sq-image urls: ${summary.found}`);
  console.log(`- downloaded: ${summary.downloaded}`);
  console.log(`- rewritten substrings: ${summary.rewritten}`);
  console.log(`- failed: ${summary.failed.length}`);
  const maxFailurePrint = 200;
  for (const failure of summary.failed.slice(0, maxFailurePrint)) {
    console.log(`  - ${failure.file} :: ${failure.url} :: ${failure.reason}`);
  }
  if (summary.failed.length > maxFailurePrint) {
    console.log(`  - ... ${summary.failed.length - maxFailurePrint} more`);
  }

  if (summary.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`sanitize:assets error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
