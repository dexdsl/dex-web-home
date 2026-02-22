import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

type SanitizeConfig = {
  forbiddenDomains?: string[];
  pages?: string[];
};

const configPath = path.join(process.cwd(), 'sanitize.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SanitizeConfig;
const forbiddenDomains = (config.forbiddenDomains ?? []).map((domain) => domain.toLowerCase());

function hostMatchesForbidden(host: string): boolean {
  const normalized = host.toLowerCase();
  return forbiddenDomains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function resolvePages(): string[] {
  const docsRoot = path.join(process.cwd(), 'docs');
  const configuredPages = Array.isArray(config.pages) && config.pages.length > 0 ? config.pages : ['/'];
  const resolved: string[] = [];

  for (const pagePath of configuredPages) {
    if (pagePath === '/') {
      resolved.push('/');
      continue;
    }

    const normalized = pagePath.replace(/^\/+/, '').replace(/\/+$/, '');
    const candidate = path.join(docsRoot, normalized, 'index.html');
    if (fs.existsSync(candidate)) {
      resolved.push(`/${normalized}`);
    }
  }

  if (resolved.length === 0) {
    return ['/'];
  }

  return Array.from(new Set(resolved));
}

const pages = resolvePages();

for (const pagePath of pages) {
  test(`network purity ${pagePath}`, async ({ page }) => {
    const violations: string[] = [];

    page.on('request', (request) => {
      try {
        const url = new URL(request.url());
        if (hostMatchesForbidden(url.hostname)) {
          violations.push(request.url());
        }
      } catch {
        // Ignore non-standard URLs (data:, blob:, etc.)
      }
    });

    await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    expect(
      violations,
      `Forbidden network requests found on ${pagePath}: ${violations.join(', ')}`,
    ).toEqual([]);
  });
}
