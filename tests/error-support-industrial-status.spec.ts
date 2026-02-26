import { expect, test, type Page } from 'playwright/test';

type AuthMode = 'signed-out' | 'signed-in' | 'hang';
type StatusMode = 'live-success' | 'live-fail-fallback';

const LIVE_STATUS_FIXTURE = {
  generatedAt: '2026-02-26T00:00:00.000Z',
  overall: {
    state: 'operational',
    message: 'No incidents reported yet. Historical uptime windows are initializing.',
  },
  components: [
    {
      id: 'web',
      name: 'Web App',
      state: 'operational',
      uptime: { h24: 100, d7: null, d30: null },
      latencyMs: 144,
      updatedAt: '2026-02-26T00:00:00.000Z',
    },
    {
      id: 'api',
      name: 'API',
      state: 'operational',
      uptime: { h24: 100, d7: null, d30: null },
      latencyMs: 199,
      updatedAt: '2026-02-26T00:00:00.000Z',
    },
  ],
  incidents: [],
};

const FALLBACK_STATUS_FIXTURE = {
  generatedAt: '2026-02-26T00:00:00.000Z',
  overall: {
    state: 'degraded',
    message: 'Live status feed is unavailable. Showing fallback launch snapshot.',
  },
  components: [
    {
      id: 'auth',
      name: 'Auth Runtime',
      state: 'degraded',
      uptime: { h24: 99.8, d7: null, d30: null },
      latencyMs: 322,
      updatedAt: '2026-02-26T00:00:00.000Z',
    },
  ],
  incidents: [],
};

async function stubHeaderRuntimes(page: Page): Promise<void> {
  await page.route('**/assets/js/header-slot.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.__dxHeaderSlotStub = true;',
    });
  });

  await page.route('**/assets/js/dx-scroll-dot.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.__dxScrollDotStub = true;',
    });
  });
}

async function stubDexAuthRuntime(page: Page, mode: AuthMode): Promise<void> {
  const script = `
    (() => {
      const mode = ${JSON.stringify(mode)};
      const never = () => new Promise(() => {});
      const signedInUser = mode === 'signed-in'
        ? { sub: 'auth0|support-e2e', name: 'Support E2E User', email: 'support-e2e@example.com' }
        : null;
      const auth = {
        ready: Promise.resolve({ isAuthenticated: mode === 'signed-in' }),
        resolve: () => mode === 'hang'
          ? never()
          : Promise.resolve({ authenticated: mode === 'signed-in' }),
        isAuthenticated: () => mode === 'hang'
          ? never()
          : Promise.resolve(mode === 'signed-in'),
        getUser: () => Promise.resolve(signedInUser),
        signIn: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0Sub = signedInUser ? signedInUser.sub : '';
      window.AUTH0_USER = signedInUser;
      try {
        window.dispatchEvent(new CustomEvent('dex-auth:ready', {
          detail: { isAuthenticated: mode === 'signed-in', user: signedInUser }
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

async function stubStatusEndpoints(page: Page, mode: StatusMode): Promise<void> {
  await page.route('**/data/status.live.json', async (route) => {
    if (mode === 'live-fail-fallback') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'SERVICE_UNAVAILABLE' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LIVE_STATUS_FIXTURE),
    });
  });

  await page.route('**/data/status.fallback.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FALLBACK_STATUS_FIXTURE),
    });
  });
}

async function waitForSupportReady(page: Page): Promise<void> {
  const root = page.locator('#dx-support');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

test('canonical stubs redirect to folder routes', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-out');

  await page.goto('/error.html?code=500', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/error\/?\?code=500$/);

  await page.goto('/support.html', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/support\/?$/);
});

test('error route renders mapped copy, diagnostics report, and recovery actions', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-out');

  await page.goto('/error/?code=500&from=/catalog/&source=polls&rid=req-1234', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#dx-error-title')).toContainText('500');
  await expect(page.locator('#dx-error-message')).toContainText('server-side failure');
  await expect(page.locator('[data-dx-error-action="retry"]')).toBeVisible();
  await expect(page.locator('[data-dx-error-action="home"]')).toBeVisible();
  await expect(page.locator('[data-dx-error-action="support"]')).toBeVisible();

  await page.locator('#dx-error-diagnostics > summary').click();
  await expect(page.locator('#dx-error-report')).toContainText('status_code: 500');
  await expect(page.locator('#dx-error-report')).toContainText('source: polls');
  await expect(page.locator('#dx-error-report')).toContainText('request_id: req-1234');

  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots?.toLowerCase()).toContain('noindex');
  expect(robots?.toLowerCase()).toContain('nofollow');
});

test('support route renders live status and baseline support sections', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-out');
  await stubStatusEndpoints(page, 'live-success');

  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForSupportReady(page);

  await expect(page.locator('h2', { hasText: 'Get unstuck fast' })).toBeVisible();
  await expect(page.locator('#dx-support-status-meta')).toContainText('Live source');
  await expect(page.locator('#dx-support-status .dx-support-component-list')).toBeVisible();
  await expect(page.locator('#dx-support-status .dx-support-sparkline-block')).toHaveCount(60);
  await expect(page.locator('#dx-support-status')).toContainText('No incidents reported yet');
  await expect(page.locator('#dx-support-account')).toContainText('Sign in to access account-specific support shortcuts.');

  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots?.toLowerCase()).toContain('index');
  expect(robots?.toLowerCase()).toContain('follow');
});

test('support route shows signed-in adaptive shortcuts', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubStatusEndpoints(page, 'live-success');

  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForSupportReady(page);

  await expect(page.locator('#dx-support-account')).toContainText('Signed in as Support E2E User.');
  await expect(page.locator('#dx-support-account a[href="/entry/settings/"]')).toBeVisible();
  await expect(page.locator('#dx-support-account a[href="/entry/favorites/"]')).toBeVisible();
  await expect(page.locator('#dx-support-account a[href="/entry/achievements/"]')).toBeVisible();
});

test('support route falls back to fallback status source when live endpoint fails', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-out');
  await stubStatusEndpoints(page, 'live-fail-fallback');

  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForSupportReady(page);

  await expect(page.locator('#dx-support-status-meta')).toContainText('Fallback source');
  await expect(page.locator('#dx-support-status-meta')).toContainText('Live status endpoint unavailable');
  await expect(page.locator('#dx-support-status')).toContainText(/Auth\s*Runtime/i);
  await expect(page.locator('#dx-support-status')).toContainText('No incidents reported yet');
});

test('support route exits loading even when auth resolve hangs', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'hang');
  await stubStatusEndpoints(page, 'live-success');

  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForSupportReady(page);

  await expect(page.locator('#dx-support-account')).toContainText('Sign in to access account-specific support shortcuts.');
  await expect(page.locator('#dx-support-status')).toContainText(/Web\s*App/i);
});
