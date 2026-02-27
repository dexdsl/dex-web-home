import { expect, test, type Page } from 'playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

const GENERATED_LOOKUP_REGEX = /^SUB\d{2}-[A-Z]\.[A-Za-z]{3}\s+[A-Za-z][A-Za-z\-']*\s+(?:A|V|AV|O)\d{4}$/;

async function stubHeaderRuntimes(page: Page): Promise<void> {
  await page.route('**/assets/js/header-slot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxHeaderSlotStub = true;' });
  });
  await page.route('**/assets/js/dx-scroll-dot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxScrollDotStub = true;' });
  });
}

async function stubDexAuthRuntime(page: Page): Promise<void> {
  const script = `
    (() => {
      const user = { sub: 'auth0|lookup-e2e', name: 'Marina Suarez-Solis', family_name: 'Suarez-Solis', email: 'lookup@example.com' };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: true }),
        resolve: () => Promise.resolve({ authenticated: true }),
        requireAuth: () => Promise.resolve({ status: 'authenticated' }),
        isAuthenticated: () => Promise.resolve(true),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve('stub-access-token'),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0 = { getUser: () => Promise.resolve(user) };
      window.AUTH0_USER = user;
      window.auth0Sub = user.sub;
    })();
  `;
  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: script });
  });
}

async function stubApiBaseline(page: Page): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    if (route.request().method().toUpperCase() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function waitReady(page: Page): Promise<void> {
  const root = page.locator('#dex-submit');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

test('submit flow generates schema-strict submission lookup (dynamic, non-literal)', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const callback = String(url.searchParams.get('callback') || '').trim();
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', row: 12 })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.getByRole('button', { name: 'Begin' }).click();
  const metadata = page.locator('[data-dx-submit-step="metadata"]');
  await metadata.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill('Lookup Lifecycle');
  await metadata.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill('Marina Suarez-Solis');
  await metadata.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption('K - Keyboards');
  await metadata.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Harpsichord');
  await metadata.locator('.dx-submit-badge', { hasText: 'AV - Audio-visual' }).click();

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await page.getByRole('button', { name: 'Continue to upload' }).click();
  const upload = page.locator('[data-dx-submit-step="upload"]');
  await upload.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input').fill('https://drive.google.com/mock-source');
  await page.getByRole('button', { name: /Submit sample/i }).click();

  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();
  const lookupText = String(await page.locator('[data-dx-submit-step="done"] .dx-submit-pill--accent').first().textContent() || '').trim();
  expect(lookupText).toMatch(GENERATED_LOOKUP_REGEX);
  expect(lookupText).not.toBe('SUB01-K.Pre Su AV2026');
});

