#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs');
const BASE_CSS_PATH = path.join(ROOT, 'public/css/base.css');

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

function verifyViewportMeta() {
  const htmlFiles = listHtmlFiles(DOCS_DIR);
  const failures = [];
  const requiredMetaPatterns = [
    { name: 'theme-color', test: /<meta\s+name=(['"])theme-color\1[^>]*content=(['"])#e8ebf1\2[^>]*>/i },
    { name: 'mobile-web-app-capable', test: /<meta\s+name=(['"])mobile-web-app-capable\1[^>]*content=(['"])yes\2[^>]*>/i },
    { name: 'apple-mobile-web-app-capable', test: /<meta\s+name=(['"])apple-mobile-web-app-capable\1[^>]*content=(['"])yes\2[^>]*>/i },
    { name: 'apple-mobile-web-app-status-bar-style', test: /<meta\s+name=(['"])apple-mobile-web-app-status-bar-style\1[^>]*content=(['"])black-translucent\2[^>]*>/i },
  ];

  for (const absolutePath of htmlFiles) {
    const relativePath = path.relative(ROOT, absolutePath);
    const html = fs.readFileSync(absolutePath, 'utf8');
    const viewportMatch = html.match(/<meta\s+name=(['"])viewport\1[^>]*>/i);
    if (!viewportMatch) {
      failures.push(`${relativePath}: missing viewport meta tag`);
      continue;
    }
    const viewportTag = viewportMatch[0];
    if (!/viewport-fit\s*=\s*cover/i.test(viewportTag)) {
      failures.push(`${relativePath}: viewport meta missing viewport-fit=cover`);
    }

    for (const requiredMeta of requiredMetaPatterns) {
      if (!requiredMeta.test.test(html)) {
        failures.push(`${relativePath}: missing required ${requiredMeta.name} meta tag`);
      }
    }
  }

  return failures;
}

function verifySafeAreaCss() {
  const css = fs.readFileSync(BASE_CSS_PATH, 'utf8');
  const failures = [];

  if (!/html\s*,\s*body\s*\{[\s\S]*min-height:\s*100%;/m.test(css)) {
    failures.push('public/css/base.css: html, body must include min-height: 100%');
  }
  if (!/html\s*\{[\s\S]*min-height:\s*100dvh;/m.test(css)) {
    failures.push('public/css/base.css: html must include min-height: 100dvh');
  }
  if (!/body\s*\{[\s\S]*min-height:\s*100dvh;/m.test(css)) {
    failures.push('public/css/base.css: body must include min-height: 100dvh');
  }
  if (!/@supports\s+not\s+\(height:\s*100dvh\)\s*\{[\s\S]*min-height:\s*100vh;/m.test(css)) {
    failures.push('public/css/base.css: missing 100vh fallback for non-dvh browsers');
  }

  return failures;
}

function main() {
  const failures = [...verifyViewportMeta(), ...verifySafeAreaCss()];
  if (failures.length) {
    console.error('mobile viewport contract failed:');
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }
  console.log('mobile viewport contract OK');
}

main();
