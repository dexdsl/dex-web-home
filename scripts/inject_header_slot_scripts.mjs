#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs');
const SLOT_SCRIPT_TAG = '<script defer src="/assets/js/header-slot.js"></script>';
const DOT_SCRIPT_TAG = '<script defer src="/assets/js/dx-scroll-dot.js"></script>';
const AUTH0_VENDOR_TAG = '<script src="/assets/vendor/auth0-spa-js.umd.min.js"></script>';
const AUTH0_CONFIG_TAG = '<script src="/assets/dex-auth0-config.js"></script>';
const AUTH_RUNTIME_TAG = '<script src="/assets/dex-auth.js"></script>';

const PROTECTED_AUTH_PATHS = new Set([
  'entry/favorites/index.html',
  'entry/submit/index.html',
  'entry/messages/index.html',
  'entry/pressroom/index.html',
  'entry/settings/index.html',
  'entry/achievements/index.html',
  'press/index.html',
  'messages.html',
]);

const FORCE_INCLUDE_PATHS = new Set([
  '404.html',
  'catalog/lookup/index.html',
  'dexfest/2024/day1/index.html',
  'entry/submit/index.html',
  'entry/test-entry/index.html',
  'messages.html',
  'test-title/description.html',
]);

const CONTENT_HINTS = [
  '<main id="page"',
  'id="siteWrapper"',
  'data-page-sections=',
  'data-footer-sections',
  'header-announcement-bar-wrapper',
];

function listHtmlFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      listHtmlFiles(absolutePath, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.push(absolutePath);
    }
  }
  return out;
}

function shouldInject(relativePath, html) {
  const requiresRuntime = FORCE_INCLUDE_PATHS.has(relativePath) || CONTENT_HINTS.some((hint) => html.includes(hint));
  const requiresProtectedAuth = PROTECTED_AUTH_PATHS.has(relativePath);
  if (!requiresRuntime && !requiresProtectedAuth) return false;
  if (requiresProtectedAuth) {
    if (!html.includes(AUTH0_VENDOR_TAG) || !html.includes(AUTH0_CONFIG_TAG) || !html.includes(AUTH_RUNTIME_TAG)) {
      return true;
    }
  }
  if (!requiresRuntime) return false;
  return !html.includes(SLOT_SCRIPT_TAG) || !html.includes(DOT_SCRIPT_TAG);
}

function injectSingleTag(html, tag, anchors = []) {
  if (html.includes(tag)) return html;

  for (const anchor of anchors) {
    if (html.includes(anchor)) {
      return html.replace(anchor, `${anchor}\n${tag}`);
    }
  }

  const headCloseIndex = html.indexOf('</head>');
  if (headCloseIndex >= 0) {
    return `${html.slice(0, headCloseIndex)}${tag}\n${html.slice(headCloseIndex)}`;
  }

  const dropzoneMatch = html.match(/<div class="(?:dx|sqs)-announcement-bar-dropzone">/i);
  if (dropzoneMatch) {
    const dropzoneMarker = dropzoneMatch[0];
    return html.replace(dropzoneMarker, `${tag}\n${dropzoneMarker}`);
  }

  const firstScriptIndex = html.indexOf('<script');
  if (firstScriptIndex >= 0) {
    return `${html.slice(0, firstScriptIndex)}${tag}\n${html.slice(firstScriptIndex)}`;
  }

  const titleCloseIndex = html.indexOf('</title>');
  if (titleCloseIndex >= 0) {
    const insertAt = titleCloseIndex + '</title>'.length;
    return `${html.slice(0, insertAt)}\n${tag}${html.slice(insertAt)}`;
  }

  return `${html}\n${tag}\n`;
}

function injectSingleTagBefore(html, tag, anchors = []) {
  if (html.includes(tag)) return html;

  for (const anchor of anchors) {
    if (html.includes(anchor)) {
      return html.replace(anchor, `${tag}\n${anchor}`);
    }
  }
  return injectSingleTag(html, tag, anchors);
}

function injectTag(html, relativePath) {
  let next = html;
  if (PROTECTED_AUTH_PATHS.has(relativePath)) {
    next = injectSingleTagBefore(next, AUTH0_VENDOR_TAG, [SLOT_SCRIPT_TAG, DOT_SCRIPT_TAG, '</head>']);
    next = injectSingleTagBefore(next, AUTH0_CONFIG_TAG, [SLOT_SCRIPT_TAG, DOT_SCRIPT_TAG, '</head>']);
    next = injectSingleTagBefore(next, AUTH_RUNTIME_TAG, [SLOT_SCRIPT_TAG, DOT_SCRIPT_TAG, '</head>']);
  }
  const authAnchor = '<script defer src="/assets/dex-auth.js"></script>';
  const authConfigAnchor = '<script defer src="/assets/dex-auth0-config.js"></script>';

  next = injectSingleTag(next, SLOT_SCRIPT_TAG, [authAnchor, authConfigAnchor]);
  next = injectSingleTag(next, DOT_SCRIPT_TAG, [SLOT_SCRIPT_TAG, authAnchor, authConfigAnchor]);
  return next;
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    throw new Error(`Missing docs directory: ${path.relative(ROOT, DOCS_DIR)}`);
  }

  const htmlFiles = listHtmlFiles(DOCS_DIR);
  let updated = 0;

  for (const absolutePath of htmlFiles) {
    const relativePath = path.relative(DOCS_DIR, absolutePath);
    const html = fs.readFileSync(absolutePath, 'utf8');
    if (!shouldInject(relativePath, html)) continue;

    const next = injectTag(html, relativePath);
    if (next === html) continue;

    fs.writeFileSync(absolutePath, next, 'utf8');
    updated += 1;
    console.log(`header-slot: injected script into docs/${relativePath}`);
  }

  console.log(`header-slot: injection pass complete (${updated} files updated, ${htmlFiles.length} html files scanned).`);
}

try {
  main();
} catch (error) {
  console.error(`header-slot: injection failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
