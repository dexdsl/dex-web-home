import { expect, test, type Page } from 'playwright/test';

type AuthMode = 'signed-out' | 'token-ready';
type SummaryMode = 'success' | 'warning' | 'failure';

function summaryPayload(warnings: string[] = []) {
  return {
    ok: true,
    requestId: 'achv_test_req',
    catalogVersion: '2026.03.v1',
    totals: {
      unlocked: 3,
      total: 6,
      points: 120,
    },
    metrics: {
      submissionsTotal: 4,
      releasesTotal: 2,
      pollVotes: 12,
      favoritesCount: 7,
    },
    badges: [
      {
        id: 'first-submission',
        title: 'First Submission',
        description: 'Send your first Dex submission.',
        category: 'submissions',
        tier: 'bronze',
        glyph: 'submission',
        threshold: 1,
        progress: 1,
        points: 10,
        secret: false,
        unlocked: true,
      },
      {
        id: 'first-poll-vote',
        title: 'First Poll Vote',
        description: 'Vote in your first poll.',
        category: 'polls',
        tier: 'bronze',
        glyph: 'poll',
        threshold: 1,
        progress: 1,
        points: 10,
        secret: false,
        unlocked: true,
      },
      {
        id: 'poll-votes-10',
        title: 'Ten Poll Votes',
        description: 'Cast ten poll votes.',
        category: 'polls',
        tier: 'silver',
        glyph: 'poll',
        threshold: 10,
        progress: 10,
        points: 35,
        secret: false,
        unlocked: true,
      },
      {
        id: 'favorites-10',
        title: 'Favorites x10',
        description: 'Save ten favorites.',
        category: 'favorites',
        tier: 'silver',
        glyph: 'favorite',
        threshold: 10,
        progress: 7,
        points: 30,
        secret: false,
        unlocked: false,
      },
      {
        id: 'vault-easter-egg',
        title: 'Vault Visitor',
        description: 'Claim the vault easter egg.',
        category: 'secret',
        tier: 'silver',
        glyph: 'vault',
        threshold: 1,
        progress: 0,
        points: 50,
        secret: true,
        clueGrowlix: '@@@ find the hidden claim @@@',
        unlocked: false,
      },
      {
        id: 'releases-20-secret',
        title: 'Twenty Releases',
        description: 'Reach twenty releases.',
        category: 'secret',
        tier: 'legend',
        glyph: 'secret-release',
        threshold: 20,
        progress: 2,
        points: 220,
        secret: true,
        clueGrowlix: '!!! catalog architect !!!',
        unlocked: false,
      },
    ],
    newlyUnlocked: [{ id: 'poll-votes-10' }],
    warnings,
  };
}

async function stubDexAuthRuntime(page: Page, mode: AuthMode): Promise<void> {
  const script = `
    (() => {
      const mode = ${JSON.stringify(mode)};
      const user = mode === 'signed-out' ? null : { sub: 'auth0|achievements-e2e', name: 'Achievements E2E' };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: mode !== 'signed-out' }),
        resolve: () => Promise.resolve({ authenticated: mode !== 'signed-out' }),
        isAuthenticated: () => Promise.resolve(mode !== 'signed-out'),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve(mode === 'signed-out' ? '' : 'stub-access-token'),
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

async function stubAchievementsApi(page: Page, mode: SummaryMode): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/me/achievements/summary', async (route) => {
    const method = route.request().method().toUpperCase();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (mode === 'failure') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, code: 'TEMPORARY_UNAVAILABLE' }),
      });
      return;
    }

    const payload = mode === 'warning'
      ? summaryPayload(['Partial backend outage: vote streak service degraded.'])
      : summaryPayload();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(payload),
    });
  });

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/me/achievements/history**', async (route) => {
    const method = route.request().method().toUpperCase();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        requestId: 'achv_hist_req',
        events: [
          {
            id: 'evt_1',
            badgeId: 'poll-votes-10',
            badgeTitle: 'Ten Poll Votes',
            eventType: 'unlocked',
            createdAt: new Date('2026-03-05T10:00:00.000Z').toISOString(),
            detail: 'Unlocked via poll vote milestones.',
          },
        ],
        nextCursor: '',
      }),
    });
  });

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/me/achievements/seen', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, requestId: 'seen_req', seenCount: 1 }),
    });
  });

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/me/achievements/secret-claim', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, requestId: 'claim_req', state: 'not_eligible' }),
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

test('signed-in summary renders canonical v2 cards and secret vault', async ({ page }) => {
  await stubDexAuthRuntime(page, 'token-ready');
  await stubAchievementsApi(page, 'success');
  await softNavigateToAchievements(page);
  await waitForAchievementsReady(page);

  await expect(page.locator('#dex-achv [data-dx-achievements-app="v2"]')).toBeVisible();
  await expect(page.locator('#dex-achv [data-dx-achievement-id="first-poll-vote"]')).toBeVisible();
  await expect(page.locator('#dex-achv [data-dx-achievement-id="first-poll-vote"]')).toHaveAttribute('data-dx-achievement-state', /unlocked|new/);

  await page.locator('#dex-achv [data-dx-achievements-page="secret-vault"]').click();
  await expect(page.locator('#dex-achv [data-dx-achievement-id="vault-easter-egg"]')).toBeVisible();
  await expect(page.locator('#dex-achv [data-dx-achievement-id="vault-easter-egg"]')).toHaveAttribute('data-dx-achievement-secret', 'true');
});

test('summary warnings render without blocking cards', async ({ page }) => {
  await stubDexAuthRuntime(page, 'token-ready');
  await stubAchievementsApi(page, 'warning');
  await softNavigateToAchievements(page);
  await waitForAchievementsReady(page);

  await expect(page.locator('#dex-achv [data-dx-achievements-warning]')).toContainText('Partial backend outage');
  await expect(page.locator('#dex-achv [data-dx-achievement-id="first-submission"]')).toBeVisible();
});

test('signed-out users get deterministic sign-in-required state', async ({ page }) => {
  await stubDexAuthRuntime(page, 'signed-out');
  await stubAchievementsApi(page, 'success');
  await softNavigateToAchievements(page);
  await waitForAchievementsReady(page);

  await expect(page.locator('#dex-achv')).toContainText('SIGN IN REQUIRED');
  await expect(page.locator('#dex-achv [data-dx-achievements-app="v2"]')).toHaveAttribute('data-dx-achievements-state', 'signed-out');
});

test('summary failure exits loading and shows deterministic error state', async ({ page }) => {
  await stubDexAuthRuntime(page, 'token-ready');
  await stubAchievementsApi(page, 'failure');
  await softNavigateToAchievements(page);

  const root = page.locator('#dex-achv');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('error');
  await expect(root).toContainText('Unable to load achievements');
});
