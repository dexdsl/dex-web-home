import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'entry-template', 'index.html');
const ENTRIES_DIR = path.join(PROJECT_ROOT, 'entries');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const PUBLIC_ORIGIN = 'https://dexdsl.github.io';

const ATTR_RX = /\b(?:src|href)\s*=\s*(["'])([^"']+)\1/gi;
const CORE_RUNTIME = ['/assets/dex-auth0-config.js', '/assets/dex-auth.js', '/assets/dex-sidebar.js'];

function extractRuntimePaths(html) {
  const paths = new Set();
  for (const match of String(html || '').matchAll(ATTR_RX)) {
    const value = String(match[2] || '').trim();
    if (/^\/(?:assets|scripts)\//.test(value)) paths.add(value);
  }
  return paths;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function pickGeneratedEntryHtml() {
  const dirents = await fs.readdir(ENTRIES_DIR, { withFileTypes: true }).catch(() => []);
  const slugs = dirents.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const slug of slugs) {
    const htmlPath = path.join(ENTRIES_DIR, slug, 'index.html');
    if (await fileExists(htmlPath)) return htmlPath;
  }
  return null;
}

async function main() {
  const templateHtml = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const runtimePaths = new Set(extractRuntimePaths(templateHtml));

  const generatedPath = await pickGeneratedEntryHtml();
  if (generatedPath) {
    const generatedHtml = await fs.readFile(generatedPath, 'utf8');
    for (const runtimePath of extractRuntimePaths(generatedHtml)) runtimePaths.add(runtimePath);
    console.log(`Scanned generated entry: ${path.relative(PROJECT_ROOT, generatedPath)}`);
  } else {
    console.log('No generated entries/*/index.html found; scanned template only.');
  }

  for (const runtimePath of CORE_RUNTIME) {
    if (!runtimePaths.has(runtimePath)) {
      throw new Error(`Runtime contract mismatch: missing expected runtime path in template/generated scan: ${runtimePath}`);
    }
  }

  const orderedPaths = [...runtimePaths].sort();
  if (!orderedPaths.length) throw new Error('No /assets/* or /scripts/* runtime links found in template/generated scan.');

  let missing = 0;
  console.log('Runtime asset surface:');
  for (const runtimePath of orderedPaths) {
    const docsPath = path.join(DOCS_DIR, runtimePath.slice(1));
    const publicUrl = `${PUBLIC_ORIGIN}${runtimePath}`;
    const exists = await fileExists(docsPath);
    if (!exists) {
      missing += 1;
      console.error(`  MISSING  docs/${runtimePath.slice(1)}  -> ${publicUrl}`);
      continue;
    }
    console.log(`  OK       docs/${runtimePath.slice(1)}  -> ${publicUrl}`);
  }

  if (missing > 0) {
    throw new Error(`Asset surface verification failed: ${missing} required runtime file(s) missing from docs/.`);
  }

  console.log('Asset surface verification passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
