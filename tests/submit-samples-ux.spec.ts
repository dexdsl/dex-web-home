import { expect, test, type Page } from 'playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

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
      const user = { sub: 'auth0|submit-ui-e2e', name: 'Submit E2E', email: 'submit@example.com' };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: true }),
        resolve: () => Promise.resolve({ authenticated: true }),
        requireAuth: () => Promise.resolve({ status: 'authenticated' }),
        isAuthenticated: () => Promise.resolve(true),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve('stub-access-token'),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
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

test('submit page uses desktop 60/40 shell with sticky command panel', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 1200, 'desktop-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const layout = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-submit-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-submit-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-submit-command') as HTMLElement | null;
    if (!shell || !main || !command) {
      return null;
    }

    const shellRect = shell.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    const commandStyle = window.getComputedStyle(command);

    return {
      shellWidth: Math.round(shellRect.width),
      mainWidth: Math.round(mainRect.width),
      commandWidth: Math.round(commandRect.width),
      topDelta: Math.abs(Math.round(mainRect.top - commandRect.top)),
      commandLeft: Math.round(commandRect.left),
      mainRight: Math.round(mainRect.right),
      commandPosition: commandStyle.position,
    };
  });

  expect(layout).not.toBeNull();
  if (!layout) return;

  expect(layout.commandPosition).toBe('sticky');
  expect(layout.topDelta).toBeLessThan(80);
  expect(layout.commandLeft).toBeGreaterThan(layout.mainRight - 4);
  expect(layout.mainWidth).toBeGreaterThan(layout.commandWidth);
});

test('submit page collapses to single-column on mobile with readable field text', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 500, 'mobile-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const stack = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-submit-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-submit-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-submit-command') as HTMLElement | null;
    if (!shell || !main || !command) return null;

    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    return {
      commandTop: Math.round(commandRect.top),
      mainBottom: Math.round(mainRect.bottom),
      verticalGap: Math.round(commandRect.top - mainRect.bottom),
    };
  });

  expect(stack).not.toBeNull();
  if (!stack) return;
  expect(stack.commandTop).toBeGreaterThanOrEqual(stack.mainBottom - 2);
  expect(stack.verticalGap).toBeGreaterThanOrEqual(-2);

  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();

  const fontSize = await page.evaluate(() => {
    const input = document.querySelector('[data-dx-submit-step="metadata"] .dx-submit-input') as HTMLElement | null;
    if (!input) return 0;
    return Number.parseFloat(window.getComputedStyle(input).fontSize || '0');
  });
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test('submit wizard enforces required fields and keeps payload key contract on submit', async ({ page }) => {
  let submitParams: Record<string, string> | null = null;

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    submitParams = Object.fromEntries(url.searchParams.entries());
    const callback = String(url.searchParams.get('callback') || '').trim();

    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', row: 42 })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();
  await expect(page.locator('.dx-submit-toast--error').last()).toContainText('Missing');

  const step = page.locator('[data-dx-submit-step="metadata"]');
  await step.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill('Submission Title E2E');
  await step.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill('Jane Doe');
  await step.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption('B - Brass');
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Trombone');
  await step.locator('.dx-submit-badge', { hasText: 'A - Audio' }).click();

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await expect(page.locator('[data-dx-submit-step="license"]')).toBeVisible();

  await page.getByRole('button', { name: 'Continue to upload' }).click();
  await expect(page.locator('[data-dx-submit-step="upload"]')).toBeVisible();

  const uploadStep = page.locator('[data-dx-submit-step="upload"]');
  await uploadStep.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input').fill('https://drive.google.com/mock-source');
  await uploadStep.locator('.dx-submit-field', { hasText: 'Notes for Dex team' }).locator('textarea').fill('submission note for review');

  await page.getByRole('button', { name: /Submit sample/i }).click();

  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();
  await expect(page.locator('#dex-submit')).toContainText('Submission received');

  expect(submitParams).not.toBeNull();
  if (!submitParams) return;

  const keys = Object.keys(submitParams);
  expect(keys).toEqual(
    expect.arrayContaining([
      'callback',
      'auth0Sub',
      'title',
      'creator',
      'category',
      'instrument',
      'bpm',
      'keyCenter',
      'scaleQuality',
      'tags',
      'collectionType',
      'outputTypes',
      'services',
      'license',
      'link',
      'notes',
      'status',
    ]),
  );

  expect(submitParams.status).toBe('pending');
  expect(submitParams.auth0Sub).toBe('auth0|submit-ui-e2e');
  expect(submitParams.collectionType).toBe('A');
  expect(submitParams.link).toBe('https://drive.google.com/mock-source');
});

test('submit hard-load uses standard footer geometry and icon sprite', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 980, 'desktop-only assertion');

  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('.header-announcement-bar-wrapper').first()).toBeVisible();
  await expect(page.locator('.dex-footer').first()).toBeVisible();
  await expect(page.locator('svg[data-usage="social-icons-svg"] symbol#youtube-unauth-icon')).toHaveCount(1);

  const footerMetrics = await page.evaluate(() => {
    const footer = document.querySelector('.dex-footer') as HTMLElement | null;
    if (!footer) return null;
    const rect = footer.getBoundingClientRect();
    const logoWidths = Array.from(footer.querySelectorAll('.footer-logo img'))
      .map((node) => (node as HTMLElement).getBoundingClientRect().width)
      .filter((value) => Number.isFinite(value));
    return {
      height: Math.round(rect.height),
      maxLogoWidth: Math.round(logoWidths.length ? Math.max(...logoWidths) : 0),
    };
  });

  expect(footerMetrics).not.toBeNull();
  if (!footerMetrics) return;
  expect(footerMetrics.height).toBeGreaterThan(72);
  expect(footerMetrics.height).toBeLessThan(320);
  expect(footerMetrics.maxLogoWidth).toBeLessThan(220);
});
