import fs from 'node:fs/promises';
import path from 'node:path';
import { verifySanitizedHtml } from './lib/sanitize-generated-html.mjs';

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
  const files = await walkEntryHtml(ENTRIES_DIR);
  if (!files.length) {
    console.log('No entries/**/index.html files found.');
    return;
  }

  const failures = [];
  for (const file of files.sort()) {
    const html = await fs.readFile(file, 'utf8');
    const result = verifySanitizedHtml(html);
    if (!result.ok) {
      failures.push({
        file,
        token: result.issues[0]?.token || 'unknown',
      });
    }
  }

  if (failures.length) {
    console.error(`Sanitized entry HTML verification failed (${failures.length} file(s)):`);
    for (const failure of failures) {
      console.error(`- ${failure.file} :: ${failure.token}`);
    }
    process.exit(1);
  }

  console.log(`Sanitized entry HTML check passed for ${files.length} file(s).`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
