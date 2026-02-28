import fs from 'node:fs/promises';
import path from 'node:path';
import { verifySanitizedHtml } from './lib/sanitize-generated-html.mjs';
import { isAssetReferenceToken } from './lib/asset-ref.mjs';

const ENTRIES_DIR = path.resolve('entries');

async function walkEntryHtml(dir, out = []) {
  const dirents = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      await walkEntryHtml(fullPath, out);
      continue;
    }
    if (dirent.isFile() && dirent.name === 'index.html') out.push(fullPath);
  }
  return out;
}

async function main() {
  const files = (await walkEntryHtml(ENTRIES_DIR)).sort();
  if (!files.length) {
    console.log('No entries/**/index.html files found.');
    return;
  }

  let failures = 0;
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const result = verifySanitizedHtml(html);
    const short = path.relative(process.cwd(), file) || file;
    const runtimeIssues = [];
    if (/https?:\/\/drive\.google\.com\//i.test(html)) runtimeIssues.push('raw drive.google.com URL');
    const manifestMatch = html.match(/<script[^>]*id=["']dex-manifest["'][^>]*>([\s\S]*?)<\/script>/i);
    if (manifestMatch) {
      try {
        const manifest = JSON.parse(manifestMatch[1]);
        const queue = [manifest];
        let foundInvalidToken = '';
        while (queue.length) {
          const value = queue.shift();
          if (Array.isArray(value)) {
            queue.push(...value);
            continue;
          }
          if (value && typeof value === 'object') {
            queue.push(...Object.values(value));
            continue;
          }
          if (typeof value !== 'string') continue;
          const raw = value.trim();
          if (!raw) continue;
          if (isAssetReferenceToken(raw)) continue;
          foundInvalidToken = raw;
          break;
        }
        if (foundInvalidToken) runtimeIssues.push(`unsupported dex-manifest token "${foundInvalidToken}"`);
      } catch {
        runtimeIssues.push('invalid dex-manifest JSON');
      }
    }
    if (result.ok) {
      if (runtimeIssues.length === 0) {
        console.log(`PASS ${short}`);
      } else {
        failures += 1;
        console.log(`FAIL ${short}`);
        for (const issue of runtimeIssues) console.log(`  - runtime: ${issue}`);
      }
      continue;
    }

    failures += 1;
    console.log(`FAIL ${short}`);
    for (const issue of result.issues) {
      console.log(`  - ${issue.type}: ${issue.token}`);
    }
    for (const issue of runtimeIssues) {
      console.log(`  - runtime: ${issue}`);
    }
  }

  if (failures) {
    console.error(`\nVerification failed for ${failures}/${files.length} file(s).`);
    process.exit(1);
  }

  console.log(`\nVerification passed for ${files.length} file(s).`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
