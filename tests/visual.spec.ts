import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

type SanitizeConfig = {
  pages?: string[];
};

const configPath = path.join(process.cwd(), 'sanitize.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SanitizeConfig;
const targetsPath = path.join(process.cwd(), 'artifacts', 'repo-targets.json');
const targets = fs.existsSync(targetsPath)
  ? (JSON.parse(fs.readFileSync(targetsPath, 'utf8')) as { routes?: string[] })
  : { routes: [] };

type VisualPage = {
  logicalPath: string;
  routePath: string;
};

function normalizePath(value: string): string {
  if (!value.startsWith('/')) return `/${value}`;
  return value;
}

function resolveRouteForLogical(logicalPath: string, discoveredRoutes: Set<string>): string | null {
  const normalized = normalizePath(logicalPath);
  const candidates = [normalized];

  if (normalized !== '/' && !normalized.endsWith('/')) {
    candidates.push(`${normalized}/`);
  }

  const docsPrefixed = normalized === '/' ? '/docs/' : `/docs${normalized}`;
  candidates.push(docsPrefixed);
  if (docsPrefixed !== '/' && !docsPrefixed.endsWith('/')) {
    candidates.push(`${docsPrefixed}/`);
  }

  for (const candidate of candidates) {
    if (discoveredRoutes.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolvePages(): VisualPage[] {
  const configuredPages = Array.isArray(config.pages) && config.pages.length > 0 ? config.pages : ['/'];
  const discoveredRoutes = new Set(
    Array.isArray(targets.routes)
      ? targets.routes.map((route) => normalizePath(String(route).trim())).filter(Boolean)
      : [],
  );
  const resolved: VisualPage[] = [];

  for (const configured of configuredPages) {
    const logicalPath = normalizePath(String(configured).trim());
    const routePath = resolveRouteForLogical(logicalPath, discoveredRoutes);
    if (!routePath) continue;
    resolved.push({ logicalPath, routePath });
  }

  const unique = new Map();
  for (const page of resolved) {
    unique.set(`${page.logicalPath}\u0000${page.routePath}`, page);
  }
  return Array.from(unique.values());
}

function snapshotNameForPage(logicalPath: string): string {
  if (logicalPath === '/') {
    return 'home.png';
  }

  return `${logicalPath.replace(/^\/+/, '').replace(/[^\w-]+/g, '_')}.png`;
}

const pages = resolvePages();

test.use({
  javaScriptEnabled: false,
});

for (const pageInfo of pages) {
  test(`visual snapshot ${pageInfo.logicalPath} -> ${pageInfo.routePath}`, async ({ page }) => {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === 'media') {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(pageInfo.routePath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot(snapshotNameForPage(pageInfo.logicalPath), {
      maxDiffPixelRatio: 0.003,
    });
  });
}
