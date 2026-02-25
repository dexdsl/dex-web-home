import { expect, test, type Page } from 'playwright/test';

const FAVORITES_PREFIX = 'dex:favorites:';
const FAVORITES_ANON_KEY = 'dex:favorites:v2:anon';
const TEST_ENTRY_LOOKUP = 'K.Hps. Su AV2023';

async function blockExternalRequests(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const rawUrl = route.request().url();
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      await route.continue();
      return;
    }

    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
      await route.continue();
      return;
    }

    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      await route.continue();
      return;
    }

    await route.abort();
  });
}

async function initCleanFavoritesScope(page: Page): Promise<void> {
  await page.addInitScript(({ prefix }) => {
    const initKey = '__dx_favorites_test_scope_reset_done__';
    if (window.sessionStorage.getItem(initKey) === '1') return;
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
    window.auth0Sub = '';
    window.AUTH0_USER = null;
    window.sessionStorage.setItem(initKey, '1');
  }, { prefix: FAVORITES_PREFIX });
}

async function stubDexAuthRuntime(page: Page): Promise<void> {
  const script = `
    (() => {
      const auth = {
        ready: Promise.resolve({ isAuthenticated: false }),
        resolve: () => Promise.resolve({ authenticated: false }),
        isAuthenticated: () => Promise.resolve(false),
        getUser: () => Promise.resolve(null),
        getAccessToken: () => Promise.resolve(''),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
        guard: () => Promise.resolve({ status: 'blocked' }),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0 = { getUser: () => Promise.resolve(null) };
      window.AUTH0_USER = null;
      window.auth0Sub = '';
      try {
        window.dispatchEvent(new CustomEvent('dex-auth:ready', {
          detail: { isAuthenticated: false, user: null }
        }));
      } catch {}
    })();
  `;

  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: script,
    });
  });
}

async function waitForSidebar(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.dexSidebarRendered || '')).toBe('1');
}

async function waitForFavoritesPageReady(page: Page): Promise<void> {
  const root = page.locator('#dex-favorites');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

async function readAnonFavorites(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(({ storageKey }) => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, { storageKey: FAVORITES_ANON_KEY });
}

test.beforeEach(async ({ page }) => {
  await initCleanFavoritesScope(page);
  await blockExternalRequests(page);
  await stubDexAuthRuntime(page);
});

test('catalog entry favorite persists, writes anon scope, and still navigates correctly', async ({ page }) => {
  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-catalog-index-app]')).toBeVisible();

  const favoriteButton = page.locator('.dx-catalog-index-row-favorite').first();
  await expect(favoriteButton).toBeVisible();
  const favoriteKey = String(await favoriteButton.getAttribute('data-dx-fav-key') || '').trim();
  const lookupNumber = String(await favoriteButton.getAttribute('data-dx-fav-lookup') || '').trim();
  expect(favoriteKey.length).toBeGreaterThan(0);
  expect(lookupNumber.length).toBeGreaterThan(0);

  await favoriteButton.click();
  await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');

  let favorites = await readAnonFavorites(page);
  expect(favorites.some((row) => row.key === favoriteKey && row.kind === 'entry')).toBeTruthy();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-catalog-index-app]')).toBeVisible();
  const sameFavoriteButton = page.locator(`.dx-catalog-index-row-favorite[data-dx-fav-key="${favoriteKey.replace(/"/g, '\\"')}"]`).first();
  await expect(sameFavoriteButton).toBeVisible();
  await expect(sameFavoriteButton).toHaveAttribute('aria-pressed', 'true');

  const row = sameFavoriteButton.locator('xpath=ancestor::article[1]');
  await row.getByRole('link', { name: 'Open entry' }).click();
  await expect(page).toHaveURL(/\/entry\/[^/?#]+\/?$/);
  await expect.poll(async () => page.locator('[data-catalog-index-app]').count()).toBe(0);
  await expect(page.locator('main')).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => {
      return (document.querySelector('main')?.textContent || '').trim().length;
    });
  }).toBeGreaterThan(20);
});

test('test-9 supports entry, bucket, and file favorites and favorites page lookup tabs', async ({ page }) => {
  await page.goto('/entries/test-9/', { waitUntil: 'domcontentloaded' });
  await waitForSidebar(page);

  const entryToggle = page.locator('.dx-fav-entry-toggle');
  const bucketToggle = page.locator('.dx-fav-bucket-toggle[data-bucket="C"]');
  await expect(entryToggle).toBeVisible();
  await expect(bucketToggle).toBeVisible();
  await expect(page.locator('.overview-lookup')).toContainText(`#${TEST_ENTRY_LOOKUP}`);

  await entryToggle.click();
  await bucketToggle.click();

  const downloadsButton = page.locator('#downloads .btn-audio');
  await expect(downloadsButton).toBeVisible();
  await downloadsButton.click();

  const fileToggle = page.locator('.dex-download-modal .dx-fav-file-toggle').first();
  await expect(fileToggle).toBeVisible();
  const fileLookup = String(await fileToggle.getAttribute('data-dx-fav-lookup') || '').trim();
  expect(fileLookup).toContain(`${TEST_ENTRY_LOOKUP} `);
  expect(fileLookup).toContain('[');
  await fileToggle.click();
  await page.locator('.dex-download-modal .close').click();

  await page.goto('/entry/favorites/', { waitUntil: 'domcontentloaded' });
  await waitForFavoritesPageReady(page);

  await expect(page.locator('th', { hasText: 'Lookup #' })).toBeVisible();
  await expect(page.locator('code', { hasText: TEST_ENTRY_LOOKUP })).toBeVisible();

  await page.getByRole('button', { name: /Buckets/i }).click();
  await expect(page.locator('code', { hasText: `${TEST_ENTRY_LOOKUP} C` })).toBeVisible();

  await page.getByRole('button', { name: /Files/i }).click();
  await expect(page.locator(`code:has-text("${fileLookup}")`)).toBeVisible();
});

test('favorites page live-syncs when toggled from test-9 route', async ({ page }) => {
  const context = page.context();
  const watchPage = await context.newPage();
  await initCleanFavoritesScope(watchPage);
  await blockExternalRequests(watchPage);
  await stubDexAuthRuntime(watchPage);

  await page.goto('/entries/test-9/', { waitUntil: 'domcontentloaded' });
  await waitForSidebar(page);

  await watchPage.goto('/entry/favorites/', { waitUntil: 'domcontentloaded' });
  await waitForFavoritesPageReady(watchPage);
  await expect(watchPage.locator('.empty')).toContainText('No favorites yet.');

  const entryToggle = page.locator('.dx-fav-entry-toggle');
  await entryToggle.click();
  await expect(watchPage.locator('code', { hasText: TEST_ENTRY_LOOKUP })).toBeVisible();

  await entryToggle.click();
  await expect(watchPage.locator('.empty')).toContainText('No favorites yet.');

  await watchPage.close();
});

test('legacy entry route without manifest still renders entry favorite fallback', async ({ page }) => {
  await page.goto('/entry/test-entry/', { waitUntil: 'domcontentloaded' });
  await waitForSidebar(page);

  const entryToggle = page.locator('.dx-fav-entry-toggle');
  await expect(entryToggle).toBeVisible();
  await entryToggle.click();
  await expect(entryToggle).toHaveAttribute('aria-pressed', 'true');

  const favorites = await readAnonFavorites(page);
  expect(favorites.some((row) => row.kind === 'entry')).toBeTruthy();
});
