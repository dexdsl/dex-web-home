import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

type RepoTargets = {
  routes?: string[];
};

const targetsPath = path.join(process.cwd(), 'artifacts', 'repo-targets.json');
const targets: RepoTargets = fs.existsSync(targetsPath)
  ? (JSON.parse(fs.readFileSync(targetsPath, 'utf8')) as RepoTargets)
  : { routes: [] };

const discoveredRoutes = new Set(
  Array.isArray(targets.routes)
    ? targets.routes.map((route) => String(route).trim()).filter(Boolean)
    : [],
);
const entryLikeRoute = discoveredRoutes.has('/entries/test-9/')
  ? '/entries/test-9/'
  : discoveredRoutes.has('/test-title/')
    ? '/test-title/'
    : '/';
const routes = entryLikeRoute === '/' ? ['/'] : ['/', entryLikeRoute];

for (const route of routes) {
  test(`auth0 spa sdk is available before dex auth runtime on ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    await expect
      .poll(async () => page.evaluate(() => typeof (window as unknown as { createAuth0Client?: unknown }).createAuth0Client), { timeout: 20_000 })
      .toBe('function');

    const scripts = await page.evaluate(() => {
      const toPath = (value: string) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
          const parsed = new URL(raw, window.location.origin);
          return parsed.pathname;
        } catch {
          return raw.split('?')[0].split('#')[0];
        }
      };
      return Array.from(document.querySelectorAll('script[src]'))
        .map((node) => String(node.getAttribute('src') || '').trim())
        .map((src) => ({ src, path: toPath(src) }));
    });

    const order = scripts.map((script) => script.path);
    const vendorIndex = order.indexOf('/assets/vendor/auth0-spa-js.umd.min.js');
    const configIndex = order.indexOf('/assets/dex-auth0-config.js') >= 0
      ? order.indexOf('/assets/dex-auth0-config.js')
      : order.indexOf('/assets/dex-auth-config.js');
    const authIndex = order.indexOf('/assets/dex-auth.js');

    expect(vendorIndex, `Missing vendor script on ${route}`).toBeGreaterThanOrEqual(0);
    expect(configIndex, `Missing auth config script on ${route}`).toBeGreaterThanOrEqual(0);
    expect(authIndex, `Missing dex-auth script on ${route}`).toBeGreaterThanOrEqual(0);
    expect(vendorIndex, `Script order invalid on ${route}: ${order.join(' -> ')}`).toBeLessThan(configIndex);
    expect(configIndex, `Script order invalid on ${route}: ${order.join(' -> ')}`).toBeLessThan(authIndex);
  });
}
