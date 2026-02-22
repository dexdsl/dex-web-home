import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

type ViewportConfig = {
  name: string;
  w: number;
  h: number;
};

type ReferenceConfig = {
  pages?: string[];
  viewports?: ViewportConfig[];
};

type VisualPage = {
  logicalPath: string;
  routePath: string;
};

const referenceConfigPath = path.join(process.cwd(), 'reference.config.json');
const referenceConfig = JSON.parse(fs.readFileSync(referenceConfigPath, 'utf8')) as ReferenceConfig;
const targetsPath = path.join(process.cwd(), 'artifacts', 'repo-targets.json');
const targets = fs.existsSync(targetsPath)
  ? (JSON.parse(fs.readFileSync(targetsPath, 'utf8')) as { routes?: string[] })
  : { routes: [] };

function normalizePath(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '/';
  if (trimmed === '/') return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
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
  const configuredPages = Array.isArray(referenceConfig.pages) && referenceConfig.pages.length > 0
    ? referenceConfig.pages
    : ['/'];
  const discoveredRoutes = new Set(
    Array.isArray(targets.routes)
      ? targets.routes.map((route) => normalizePath(String(route || '').trim())).filter(Boolean)
      : [],
  );
  const resolved: VisualPage[] = [];

  for (const configured of configuredPages) {
    const logicalPath = normalizePath(configured);
    const routePath = resolveRouteForLogical(logicalPath, discoveredRoutes);
    if (!routePath) continue;
    resolved.push({ logicalPath, routePath });
  }

  const unique = new Map<string, VisualPage>();
  for (const page of resolved) {
    unique.set(`${page.logicalPath}\u0000${page.routePath}`, page);
  }
  return Array.from(unique.values());
}

function routeArtifactDir(route: string): string {
  const normalized = normalizePath(route);
  if (normalized === '/') return 'home';
  const parts = normalized
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => part.replace(/[^\w.-]+/g, '_'))
    .filter(Boolean);
  return parts.length ? path.join(...parts) : 'home';
}

function snapshotStemForPage(logicalPath: string): string {
  if (logicalPath === '/') return 'home';
  return logicalPath.replace(/^\/+/, '').replace(/[^\w-]+/g, '_');
}

const pages = resolvePages();
const localBaseURL = process.env.LOCAL_BASE_URL || 'http://127.0.0.1:4173';

test.describe('reference visual parity', () => {
  test.skip(pages.length === 0, 'No matching routes for configured reference pages.');

  for (const pageInfo of pages) {
    test(`reference visual ${pageInfo.logicalPath} -> ${pageInfo.routePath}`, async ({ page }, testInfo) => {
      const viewportName = testInfo.project.name;
      const baselinePath = path.join(
        process.cwd(),
        'artifacts',
        'reference',
        'screenshots',
        routeArtifactDir(pageInfo.logicalPath),
        `${viewportName}.png`,
      );
      test.skip(!fs.existsSync(baselinePath), `Missing reference screenshot: ${baselinePath}`);

      const snapshotName = `reference-${snapshotStemForPage(pageInfo.logicalPath)}.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      fs.copyFileSync(baselinePath, snapshotPath);

      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (resourceType === 'media') return route.abort();
        return route.continue();
      });

      const url = new URL(pageInfo.routePath, localBaseURL).toString();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');
      await page.evaluate(async () => {
        const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        await Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 10_000))]);
      });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: auto !important;
            scroll-behavior: auto !important;
          }
        `,
      });
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot(snapshotName, {
        fullPage: true,
        maxDiffPixelRatio: 0.003,
      });
    });
  }
});
