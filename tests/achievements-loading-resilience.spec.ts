import { expect, test, type Page } from 'playwright/test';

type AuthMode = 'signed-out' | 'hang-token' | 'token-ready';
type VoteApiMode = 'success' | 'failure';

const SUBMISSION_ROWS = [
  { status: 'Released', license: 'CC0' },
  { status: 'Released', license: 'Joint' },
  { status: 'Rejected', license: 'CC0' },
];

async function stubDexAuthRuntime(page: Page, mode: AuthMode): Promise<void> {
  const script = `
    (() => {
      const mode = ${JSON.stringify(mode)};
      const user = mode === 'signed-out' ? null : { sub: 'auth0|achievements-e2e', name: 'Achievements E2E' };
      const never = () => new Promise(() => {});
      const auth = {
        ready: Promise.resolve({ isAuthenticated: mode !== 'signed-out' }),
        resolve: () => Promise.resolve({ authenticated: mode !== 'signed-out' }),
        isAuthenticated: () => Promise.resolve(mode !== 'signed-out'),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => {
          if (mode === 'hang-token') return never();
          if (mode === 'signed-out') return Promise.resolve('');
          return Promise.resolve('stub-access-token');
        },
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
        guard: () => Promise.resolve({ status: mode === 'signed-out' ? 'blocked' : 'authenticated' }),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0 = { getUser: () => Promise.resolve(user) };
      window.AUTH0_USER = user;
      window.auth0Sub = user ? user.sub : '';
      try {
        window.dispatchEvent(new CustomEvent('dex-auth:ready', {
          detail: { isAuthenticated: !!user, user }
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

async function stubSubmissionsJsonp(page: Page): Promise<void> {
  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const callback = String(url.searchParams.get('callback') || '').trim();
    const action = String(url.searchParams.get('action') || '').trim();

    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }

    let payload: unknown = { status: 'error', rows: [] };
    if (action === 'list') {
      payload = {
        status: 'ok',
        rows: SUBMISSION_ROWS,
      };
    } else if (action === 'ack') {
      payload = { status: 'ok' };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify(payload)});`,
    });
  });
}

async function stubVotesSummary(page: Page, mode: VoteApiMode, payload?: { voteCount: number; currentStreak: number }): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/me/polls/votes/summary', async (route) => {
    const method = route.request().method().toUpperCase();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
      });
      return;
    }

    if (mode === 'failure') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ error: 'SERVICE_UNAVAILABLE' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(payload || { voteCount: 12, currentStreak: 4 }),
    });
  });
}

async function softNavigateToAchievements(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    const nav = (window as typeof window & {
      dxNavigate?: (target: string, options?: { pushHistory?: boolean; allowHardNavigate?: boolean }) => Promise<boolean> | boolean;
    }).dxNavigate;
    if (typeof nav === 'function') {
      await nav('/entry/achievements/', { pushHistory: true, allowHardNavigate: true });
      return;
    }
    window.location.assign('/entry/achievements/');
  });
  await expect(page).toHaveURL(/\/entry\/achievements\/?$/);
}

async function waitForAchievementsReady(page: Page): Promise<void> {
  const root = page.locator('#dex-achv');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

test('soft navigation recovers when token lookup hangs and avoids stuck loading state', async ({ page }) => {
  await stubDexAuthRuntime(page, 'hang-token');
  await stubSubmissionsJsonp(page);
  await softNavigateToAchievements(page);
  await waitForAchievementsReady(page);

  await expect(page.locator('#dex-achv h1', { hasText: 'Your Achievements' })).toBeVisible();
  await expect(page.locator('#achv-warning')).toContainText('Poll vote metrics are temporarily unavailable.');
  expect(await page.locator('#dex-achv .badge-card').count()).toBeGreaterThan(0);
});

test('renders partial achievements and warning when vote summary endpoint fails', async ({ page }) => {
  await stubDexAuthRuntime(page, 'token-ready');
  await stubSubmissionsJsonp(page);
  await stubVotesSummary(page, 'failure');
  await softNavigateToAchievements(page);
  await waitForAchievementsReady(page);

  await expect(page.locator('#achv-warning')).toContainText('Poll vote metrics are temporarily unavailable.');
  expect(await page.locator('#dex-achv .badge-card').count()).toBeGreaterThan(0);
});

test('renders full achievements without warning when summary endpoint succeeds', async ({ page }) => {
  await stubDexAuthRuntime(page, 'token-ready');
  await stubSubmissionsJsonp(page);
  await stubVotesSummary(page, 'success', { voteCount: 12, currentStreak: 4 });
  await softNavigateToAchievements(page);
  await waitForAchievementsReady(page);

  await expect(page.locator('#achv-warning')).toBeHidden();
  const voteCard = page.locator('#dex-achv .badge-card', { hasText: 'First Poll Vote' }).first();
  await expect(voteCard).toBeVisible();
  await expect(voteCard).not.toHaveClass(/locked/);
});

test('signed-out users see sign-in prompt and fetch-state exits loading', async ({ page }) => {
  await stubDexAuthRuntime(page, 'signed-out');
  await stubSubmissionsJsonp(page);
  await softNavigateToAchievements(page);
  await waitForAchievementsReady(page);

  await expect(page.locator('#dex-achv')).toContainText('Please sign');
  await expect(page.locator('#achv-warning')).toBeHidden();
});
