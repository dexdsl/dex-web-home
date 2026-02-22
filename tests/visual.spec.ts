import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

type SanitizeConfig = {
  pages?: string[];
};

const configPath = path.join(process.cwd(), 'sanitize.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SanitizeConfig;

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

function snapshotNameForPage(pagePath: string): string {
  if (pagePath === '/') {
    return 'home.png';
  }

  return `${pagePath.replace(/^\/+/, '').replace(/[^\w-]+/g, '_')}.png`;
}

const pages = resolvePages();

test.use({
  javaScriptEnabled: false,
});

for (const pagePath of pages) {
  test(`visual snapshot ${pagePath}`, async ({ page }) => {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === 'media') {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot(snapshotNameForPage(pagePath), {
      maxDiffPixelRatio: 0.003,
    });
  });
}
