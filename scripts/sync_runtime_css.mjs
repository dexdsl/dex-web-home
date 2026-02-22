#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SYNC_MAP = [
  {
    source: 'public/data/catalog.data.json',
    targets: ['data/catalog.data.json', 'docs/data/catalog.data.json'],
  },
  {
    source: 'public/data/catalog.entries.json',
    targets: ['data/catalog.entries.json', 'docs/data/catalog.entries.json'],
  },
  {
    source: 'public/data/catalog.guide.json',
    targets: ['data/catalog.guide.json', 'docs/data/catalog.guide.json'],
  },
  {
    source: 'public/data/catalog.symbols.json',
    targets: ['data/catalog.symbols.json', 'docs/data/catalog.symbols.json'],
  },
  {
    source: 'public/data/catalog.search.json',
    targets: ['data/catalog.search.json', 'docs/data/catalog.search.json'],
  },
  {
    source: 'public/css/base.css',
    targets: ['css/base.css', 'docs/css/base.css'],
  },
  {
    source: 'public/css/components/dx-catalog-index.css',
    targets: ['css/components/dx-catalog-index.css', 'docs/css/components/dx-catalog-index.css'],
  },
  {
    source: 'public/css/components/dx-catalog-how.css',
    targets: ['css/components/dx-catalog-how.css', 'docs/css/components/dx-catalog-how.css'],
  },
  {
    source: 'public/css/components/dx-catalog-symbols.css',
    targets: ['css/components/dx-catalog-symbols.css', 'docs/css/components/dx-catalog-symbols.css'],
  },
  {
    source: 'public/css/components/dx-controls.css',
    targets: ['css/components/dx-controls.css', 'docs/css/components/dx-controls.css'],
  },
  {
    source: 'public/assets/js/catalog.index.js',
    targets: ['assets/js/catalog.index.js', 'docs/assets/js/catalog.index.js'],
  },
  {
    source: 'public/assets/js/catalog.how.js',
    targets: ['assets/js/catalog.how.js', 'docs/assets/js/catalog.how.js'],
  },
  {
    source: 'public/assets/js/catalog.symbols.js',
    targets: ['assets/js/catalog.symbols.js', 'docs/assets/js/catalog.symbols.js'],
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
