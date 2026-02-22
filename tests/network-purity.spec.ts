import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

type SanitizeConfig = {
  forbiddenDomains?: string[];
};

const configPath = path.join(process.cwd(), 'sanitize.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SanitizeConfig;
const targetsPath = path.join(process.cwd(), 'artifacts', 'repo-targets.json');
if (!fs.existsSync(targetsPath)) {
  throw new Error('Missing artifacts/repo-targets.json. Run `npm run repo:discover` before `npm run test:net`.');
}
const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8')) as { routes?: string[] };
const forbiddenDomains = (config.forbiddenDomains ?? []).map((domain) => domain.toLowerCase());

function hostMatchesForbidden(host: string): boolean {
  const normalized = host.toLowerCase();
  return forbiddenDomains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function resolveRoutes(): string[] {
  const discovered = Array.isArray(targets.routes) ? targets.routes.map((route) => String(route).trim()).filter(Boolean) : ['/'];
  const unique = Array.from(new Set(discovered)).sort((a, b) => a.localeCompare(b));
  const pageFilter = process.env.PAGE_FILTER ? String(process.env.PAGE_FILTER) : '';
  let filtered = pageFilter ? unique.filter((route) => route.includes(pageFilter)) : unique;
  const pageLimit = process.env.PAGE_LIMIT ? Number(process.env.PAGE_LIMIT) : Number.NaN;
  if (Number.isFinite(pageLimit) && pageLimit > 0) {
    filtered = filtered.slice(0, Math.floor(pageLimit));
  }
  return filtered.length > 0 ? filtered : ['/'];
}

const pages = resolveRoutes();

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
