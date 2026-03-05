import { expect, test, type Page } from 'playwright/test';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function stubDexAuth(
  page: Page,
  { authenticated, token = 'test-access-token' }: { authenticated: boolean; token?: string },
) {
  await page.route('**/assets/dex-auth.js', async (route) => {
    const script = `
      (() => {
        const state = {
          isAuthenticated: ${authenticated ? 'true' : 'false'},
          user: ${authenticated ? "{ sub: 'auth0|donor', email: 'donor@example.com' }" : 'null'},
        };
        const calls = { signIn: [], signUp: [] };
        window.__dxAuthCalls = calls;
        window.DEX_AUTH = {
          ready: Promise.resolve(state),
          resolve: async () => state,
          isAuthenticated: async () => state.isAuthenticated,
          getAccessToken: async () => state.isAuthenticated ? ${JSON.stringify(token)} : '',
          getUser: async () => state.user,
          signIn: (returnTo) => { calls.signIn.push(String(returnTo || '')); },
          signUp: (returnTo) => { calls.signUp.push(String(returnTo || '')); },
        };
        window.dexAuth = window.DEX_AUTH;
      })();
    `;

    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: script,
    });
  });
}

async function seedTurnstile(
  page: Page,
  {
    token = 'turnstile-token',
    fail = false,
  }: {
    token?: string;
    fail?: boolean;
  } = {},
) {
  await page.addInitScript(({ injectedToken, shouldFail }) => {
    const globalAny = window as any;
    globalAny.DEX_NEWSLETTER_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    globalAny.DEX_DONATE_CONFIG = Object.assign({}, globalAny.DEX_DONATE_CONFIG || {}, {
      source: 'donate-page',
      turnstileAction: 'donation_checkout',
      turnstileSiteKey: '1x00000000000000000000AA',
      requireChallengeForUnauth: true,
      minDwellMs: 1200,
    });

    let options: Record<string, unknown> | null = null;
    globalAny.turnstile = {
      render: (_container: Element, nextOptions: Record<string, unknown>) => {
        options = nextOptions || {};
        return 'dx-donate-widget';
      },
      execute: () => {
        if (!options) return;
        if (shouldFail) {
          const onError = options['error-callback'];
          if (typeof onError === 'function') onError('forced-failure');
          return;
        }
        const callback = options.callback;
        if (typeof callback === 'function') callback(injectedToken);
      },
      reset: () => {},
    };
  }, { injectedToken: token, shouldFail: fail });
}

test('one-time happy path (signed out) sends secure payload + idempotency header', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await seedTurnstile(page);

  let requestCount = 0;
  let payload: Record<string, unknown> | null = null;
  let idem = '';

  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    payload = route.request().postDataJSON() as Record<string, unknown>;
    idem = String(route.request().headers()['x-dx-idempotency-key'] || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        state: 'checkout_created',
        requestId: 'don_req_1',
        checkoutUrl: '/donate/?donation=thanks',
      }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page).toHaveURL(/donation=thanks/i);
  expect(requestCount).toBe(1);
  expect(payload).toBeTruthy();
  expect(payload?.source).toBe('donate-page');
  expect(payload?.currency).toBe('USD');
  expect(payload?.amountCents).toBe(1000);
  expect(payload?.challengeToken).toBe('turnstile-token');
  expect(payload?.honey).toBe('');
  expect(typeof payload?.submittedAt).toBe('number');
  expect(String(payload?.clientRequestId || '')).toMatch(UUID_RE);
  expect(idem).toMatch(UUID_RE);
});

test('one-time happy path (signed in) skips challenge and sends auth header', async ({ page }) => {
  await stubDexAuth(page, { authenticated: true, token: 'signed-in-token' });

  let requestCount = 0;
  let payload: Record<string, unknown> | null = null;
  let authHeader = '';

  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    payload = route.request().postDataJSON() as Record<string, unknown>;
    authHeader = String(route.request().headers().authorization || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        state: 'checkout_created',
        requestId: 'don_req_2',
        checkoutUrl: '/donate/?donation=thanks',
      }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page).toHaveURL(/donation=thanks/i);
  expect(requestCount).toBe(1);
  expect(authHeader).toBe('Bearer signed-in-token');
  expect(String(payload?.challengeToken || '')).toBe('');
});

test('challenge failures are deterministic and block submission', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await seedTurnstile(page, { fail: true });

  let requestCount = 0;
  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page.locator('[data-dx-donate-feedback]')).toContainText(/challenge check failed/i);
  expect(requestCount).toBe(0);
});

test('rate-limit responses show retry messaging and local cooldown', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await seedTurnstile(page);

  let requestCount = 0;
  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        code: 'RATE_LIMIT',
        requestId: 'don_limit_1',
        retryAfterSeconds: 37,
      }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page.locator('[data-dx-donate-feedback]')).toContainText(/37 seconds/i);
  expect(requestCount).toBe(1);

  await page.click('[data-dx-donate-submit]');
  await expect(page.locator('[data-dx-donate-feedback]')).toContainText(/please wait|too many attempts/i);
  expect(requestCount).toBe(1);
});

test('monthly CTA routes authenticated users and prompts signed-out users to auth', async ({ page }) => {
  await stubDexAuth(page, { authenticated: true });
  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });

  const authedLink = page.locator('[data-dx-donate-monthly-auth="true"]');
  await expect(authedLink).toBeVisible();
  await expect(authedLink).toHaveAttribute('href', '/entry/settings?via=donate#membership');

  const unauthPage = await page.context().newPage();
  await stubDexAuth(unauthPage, { authenticated: false });
  await unauthPage.goto('/donate/', { waitUntil: 'domcontentloaded' });

  await expect(unauthPage.locator('[data-dx-donate-monthly-signup="true"]')).toBeVisible();
  await expect(unauthPage.locator('[data-dx-donate-monthly-signin="true"]')).toBeVisible();

  await unauthPage.click('[data-dx-donate-monthly-signin="true"]');
  const signInTarget = await unauthPage.evaluate(() => (window as any).__dxAuthCalls?.signIn?.[0] || '');
  expect(signInTarget).toBe('/entry/settings?via=donate#membership');

  await unauthPage.click('[data-dx-donate-monthly-signup="true"]');
  const signUpTarget = await unauthPage.evaluate(() => (window as any).__dxAuthCalls?.signUp?.[0] || '');
  expect(signUpTarget).toBe('/entry/settings?via=donate#membership');
});
