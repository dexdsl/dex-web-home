#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SYNC_MAP = [
  {
    source: 'public/css/base.css',
    targets: ['css/base.css', 'docs/css/base.css'],
  },
  {
    source: 'public/css/components/dx-controls.css',
    targets: ['css/components/dx-controls.css', 'docs/css/components/dx-controls.css'],
  },
  {
    source: 'public/assets/css/dex.css',
    targets: ['assets/css/dex.css', 'docs/assets/css/dex.css'],
  },
  {
    source: 'public/assets/dex-auth.js',
    targets: ['assets/dex-auth.js', 'docs/assets/dex-auth.js'],
  },
];

function ensureSourceExists(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing source file: ${relativePath}`);
  }
  return absolutePath;
}

function syncOne(sourceAbsolutePath, sourceRelativePath, targetRelativePath) {
  const targetAbsolutePath = path.join(ROOT, targetRelativePath);
  fs.mkdirSync(path.dirname(targetAbsolutePath), { recursive: true });
  fs.copyFileSync(sourceAbsolutePath, targetAbsolutePath);
  console.log(`synced ${sourceRelativePath} -> ${targetRelativePath}`);
}

function main() {
  for (const entry of SYNC_MAP) {
    const sourceAbsolutePath = ensureSourceExists(entry.source);
    for (const target of entry.targets) {
      syncOne(sourceAbsolutePath, entry.source, target);
    }
  }
}

main();
