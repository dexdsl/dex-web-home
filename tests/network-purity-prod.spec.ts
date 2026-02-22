import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

type SanitizeConfig = {
  forbiddenDomains?: string[];
};

type RepoTargets = {
  routes?: string[];
};

type Violation = {
  requestUrl: string;
  resourceType: string;
  frameUrl: string;
  referer: string;
};

const baseUrlInput = String(process.env.BASE_URL || '').trim();
if (!baseUrlInput) {
  throw new Error('BASE_URL is required. Example: BASE_URL="https://dexdsl.github.io" npm run test:net:prod');
}

let baseUrl: URL;
try {
  baseUrl = new URL(baseUrlInput);
} catch {
  throw new Error(`BASE_URL is not a valid URL: ${baseUrlInput}`);
}

const configPath = path.join(process.cwd(), 'sanitize.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SanitizeConfig;

const targetsPath = path.join(process.cwd(), 'artifacts', 'repo-targets.json');
if (!fs.existsSync(targetsPath)) {
  throw new Error('Missing artifacts/repo-targets.json. Run `npm run repo:discover` before `npm run test:net:prod`.');
}
const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8')) as RepoTargets;

const forbiddenDomains = (config.forbiddenDomains ?? []).map((domain) => domain.toLowerCase());

function hostMatchesForbidden(host: string): boolean {
  const normalized = host.toLowerCase();
  return forbiddenDomains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function resolveRoutes(): string[] {
  const discovered = Array.isArray(targets.routes)
    ? targets.routes.map((route) => String(route).trim()).filter(Boolean)
    : ['/'];
  const unique = Array.from(new Set(discovered)).sort((a, b) => a.localeCompare(b));

  const pageFilter = process.env.PAGE_FILTER ? String(process.env.PAGE_FILTER) : '';
  let filtered = pageFilter ? unique.filter((route) => route.includes(pageFilter)) : unique;

  const pageLimit = process.env.PAGE_LIMIT ? Number(process.env.PAGE_LIMIT) : Number.NaN;
  if (Number.isFinite(pageLimit) && pageLimit > 0) {
    filtered = filtered.slice(0, Math.floor(pageLimit));
  }

  return filtered.length > 0 ? filtered : ['/'];
}

function routeUrl(route: string): string {
  return new URL(route, baseUrl).toString();
}

function formatViolation(v: Violation): string {
  return `${v.requestUrl} | type=${v.resourceType} | frame=${v.frameUrl || 'n/a'} | referer=${v.referer || 'n/a'}`;
}

const routes = resolveRoutes();

for (const route of routes) {
  test(`network purity prod ${route}`, async ({ page }) => {
    const violations: Violation[] = [];

    page.on('request', (request) => {
      try {
        const requestUrl = request.url();
        const parsed = new URL(requestUrl);
        if (!hostMatchesForbidden(parsed.hostname)) return;

        const headers = request.headers();
        const referer = String(headers.referer || headers.referrer || '');

        let frameUrl = '';
        try {
          frameUrl = request.frame()?.url?.() || '';
        } catch {
          frameUrl = '';
        }

        violations.push({
          requestUrl,
          resourceType: request.resourceType(),
          frameUrl,
          referer,
        });
      } catch {
        // Ignore non-standard URLs.
      }
    });

    await page.goto(routeUrl(route), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    const lines = Array.from(new Set(violations.map(formatViolation))).sort((a, b) => a.localeCompare(b));

    expect(
      lines,
      `Forbidden network requests found on ${route} (BASE_URL=${baseUrl.toString()}): ${lines.join(' || ')}`,
    ).toEqual([]);
  });
}
