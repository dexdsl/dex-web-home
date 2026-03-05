import { expect, test, type Page } from 'playwright/test';

const API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';

async function stubAuth(page: Page): Promise<void> {
  const script = `
    (() => {
      const user = {
        sub: 'auth0|settings-profile-v1-test',
        email: 'profile-v1@example.com',
        name: 'Profile V1',
        family_name: 'Tester',
      };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: true, user }),
        resolve: () => Promise.resolve({ authenticated: true, user }),
        requireAuth: () => Promise.resolve({ status: 'authenticated', user }),
        isAuthenticated: () => Promise.resolve(true),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve('token-settings-profile-v1'),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.AUTH0_USER = user;
      window.auth0Sub = user.sub;
      try {
        window.dispatchEvent(new CustomEvent('dex-auth:ready', {
          detail: { isAuthenticated: true, user }
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

test('settings profile v1 saves contribution payload with extended fields', async ({ page }) => {
  await stubAuth(page);

  const patchPayloads: Array<Record<string, unknown>> = [];

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;

    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (path === '/me/profile' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          sub: 'auth0|settings-profile-v1-test',
          name: 'Profile V1',
          email: 'profile-v1@example.com',
          email_verified: true,
          picture: '',
          credit_name: 'Profile V1',
          credit_aliases: ['PV1'],
          roles: ['Composer', 'Performer'],
          role_primary: 'Composer',
          instruments: ['Piano', 'Electronics'],
          instrument_primary: 'Piano',
          submit_defaults: {
            creator: 'Profile V1',
            category: 'K',
            instrument: 'Piano',
          },
          updated_at: 1760000000,
        }),
      });
      return;
    }

    if (path === '/me/profile' && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      patchPayloads.push(body);
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          sub: 'auth0|settings-profile-v1-test',
          name: 'Profile V1',
          email: 'profile-v1@example.com',
          email_verified: true,
          picture: '',
          updated_at: 1761000000,
          ...body,
        }),
      });
      return;
    }

    if (path === '/me/submissions' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          threads: [
            {
              title: 'Session A',
              currentStatusRaw: 'Pending Review',
              creator: 'Profile V1',
              category: 'K - Keyboards',
              instrument: 'Piano',
            },
            {
              title: 'Session B',
              currentStatusRaw: 'Accepted',
              creator: 'Alias One',
              category: 'E - Electronics',
              instrument: 'Electronics',
            },
          ],
        }),
      });
      return;
    }

    if (path === '/me/billing/summary' || path === '/me/billing/plans' || path === '/me/invoices') {
      await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({}) });
      return;
    }

    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/entry/settings/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-dx-profile-identity-card="true"]')).toBeVisible();
  await expect(page.locator('[data-dx-contrib-profile-card="true"]')).toBeVisible();

  await page.fill('#creditNameInput', 'Profile V1 Updated');
  await page.fill('#creditAliasInput', 'Profile Alias');
  await page.press('#creditAliasInput', 'Enter');
  await page.click('#roleChips .chip:has-text("Producer")');
  await page.fill('#instrInput', 'Modular synth');
  await page.press('#instrInput', 'Enter');
  await page.selectOption('#rolePrimarySelect', { label: 'Producer' });
  await page.selectOption('#submitDefaultCategory', 'E');

  await expect
    .poll(() => patchPayloads.length)
    .toBeGreaterThan(0);

  const payload = patchPayloads.at(-1) || {};
  expect(payload).toHaveProperty('credit_name');
  expect(payload).toHaveProperty('credit_aliases');
  expect(payload).toHaveProperty('roles');
  expect(payload).toHaveProperty('role_primary');
  expect(payload).toHaveProperty('instruments');
  expect(payload).toHaveProperty('instrument_primary');
  expect(payload).toHaveProperty('submit_defaults');
});

test('submit step auto-prefills creator/category/instrument from profile defaults', async ({ page }) => {
  await stubAuth(page);

  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;

    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (path === '/me/profile' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          sub: 'auth0|settings-profile-v1-test',
          name: 'Profile V1',
          email: 'profile-v1@example.com',
          credit_name: 'Profile V1',
          roles: ['Composer'],
          instruments: ['Electronics'],
          role_primary: 'Composer',
          instrument_primary: 'Electronics',
          credit_aliases: [],
          submit_defaults: {
            creator: 'Profile V1 Ensemble',
            category: 'E',
            instrument: 'Electronics',
          },
          updated_at: 1761000000,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('https://script.google.com/macros/**', async (route) => {
    const callback = new URL(route.request().url()).searchParams.get('callback') || 'cb';
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', rows: [] })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });

  await page.click('[data-dx-submit-begin="true"]');

  const creatorInput = page.locator('input[placeholder="Ex: Jane Doe, John Doe"]');
  const instrumentInput = page.locator('input[placeholder="Ex: Prepared Trombone"]');
  const categorySelect = page.locator('.dx-submit-field:has(.dx-submit-field-label:has-text("Instrument category")) select.dx-submit-input');

  await expect(creatorInput).toHaveValue('Profile V1 Ensemble');
  await expect(instrumentInput).toHaveValue('Electronics');
  await expect(categorySelect).toHaveValue('E - Electronics');

  const applyBtn = page.locator('button:has-text("Apply profile defaults")');
  await expect(applyBtn).toBeVisible();
  await expect(applyBtn).toBeEnabled();
});
