import { expect, test, type Page } from 'playwright/test';

const BREAKPOINTS = [
  { label: 'lt-900', width: 840, height: 900 },
  { label: '900-1100', width: 1000, height: 900 },
  { label: '1100-1200', width: 1160, height: 900 },
  { label: 'gt-1200', width: 1320, height: 900 },
];

const PROFILE_ROUTES = [
  '/entry/submit/',
  '/entry/favorites/',
  '/entry/messages/',
  '/entry/pressroom/',
  '/entry/settings/',
  '/entry/achievements/',
] as const;

const CARD_SELECTORS: Record<string, string[]> = {
  '/entry/submit/': ['#dex-submit .dx-submit-main'],
  '/entry/favorites/': ['#dex-favorites .panel', '#dex-favorites .dex-sidebar'],
  '/entry/messages/': ['#dex-msg .dx-msg-shell'],
  '/entry/pressroom/': ['#dex-press .dx-press-main'],
  '/entry/settings/': ['#dex-settings .card', '#dex-settings .hdr', '#dxMembershipV3Root .dx-memv3-card'],
  '/entry/achievements/': ['#dex-achv .dex-sidebar', '#dex-achv .slide', '#dex-achv .panel'],
};

async function stubDexAuthRuntime(page: Page): Promise<void> {
  const script = `
    (() => {
      const user = {
        sub: 'auth0|profile-canonical-test',
        email: 'test@example.com',
        name: 'Profile Canonical',
      };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: true, user }),
        resolve: () => Promise.resolve({ authenticated: true, user }),
        requireAuth: () => Promise.resolve({ status: 'ok', user }),
        isAuthenticated: () => Promise.resolve(true),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve('token-profile-canonical'),
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

async function stubExternalApis(page: Page): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (pathname === '/me/messages/unread-count') {
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0 }),
      });
      return;
    }

    if (pathname === '/me/messages') {
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
      return;
    }

    if (pathname === '/me/polls/votes/summary') {
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ voteCount: 0, pollStreak: 0 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const callback = String(url.searchParams.get('callback') || '').trim();
    if (!callback) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', rows: [] })});`,
    });
  });
}

function parseAlpha(value: string): number {
  const normalized = String(value || '').trim().toLowerCase();
  const rgbaMatch = normalized.match(/rgba\\(([^)]+)\\)/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    return Number.isFinite(parts[3]) ? parts[3] : 1;
  }
  if (normalized.startsWith('rgb(')) return 1;
  return Number.NaN;
}

function hasCanonicalBackdrop(value: string): boolean {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('blur(24px)')
    && (normalized.includes('saturate(170%)') || normalized.includes('saturate(1.7)'));
}

async function captureMetrics(page: Page, routePath: string, selectors: string[]) {
  await page.goto(routePath, { waitUntil: 'domcontentloaded' });

  await expect
    .poll(() => page.evaluate(() => document.body.classList.contains('dx-route-profile-protected')))
    .toBeTruthy();

  await expect
    .poll(async () => page.evaluate((innerSelectors) => {
      const root = document.querySelector(
        '#dex-favorites,#dex-msg,#dex-submit,#dex-press,#dex-achv,#dex-console,#dex-settings',
      );
      const header = document.querySelector('.header-announcement-bar-wrapper');
      const footer = document.querySelector('.dex-footer');
      const card = innerSelectors
        .map((selector) => document.querySelector(selector))
        .find((node) => node instanceof HTMLElement);
      return !!(root && header && footer && card);
    }, selectors))
    .toBeTruthy();

  return page.evaluate((cardSelectors) => {
    const root = document.querySelector(
      '#dex-favorites,#dex-msg,#dex-submit,#dex-press,#dex-achv,#dex-console,#dex-settings',
    ) as HTMLElement | null;
    const rootChild = root?.firstElementChild as HTMLElement | null;
    const header = document.querySelector('.header-announcement-bar-wrapper') as HTMLElement | null;
    const footer = document.querySelector('.dex-footer') as HTMLElement | null;
    const card = cardSelectors
      .map((selector) => document.querySelector(selector))
      .find((node): node is HTMLElement => node instanceof HTMLElement) || null;

    const rootRect = root?.getBoundingClientRect() || null;
    const headerRect = header?.getBoundingClientRect() || null;
    const footerRect = footer?.getBoundingClientRect() || null;
    const cardStyle = card ? window.getComputedStyle(card) : null;

    return {
      rootWidthPx: rootRect ? Math.round(rootRect.width) : 0,
      headerWidthPx: headerRect ? Math.round(headerRect.width) : 0,
      footerWidthPx: footerRect ? Math.round(footerRect.width) : 0,
      rootTopGapPx: rootRect && headerRect ? Math.round(rootRect.top - headerRect.bottom) : 0,
      rootOverflow: root ? window.getComputedStyle(root).overflow : '',
      rootChildOverflow: rootChild ? window.getComputedStyle(rootChild).overflow : '',
      cardRadiusPx: cardStyle ? Number.parseFloat(cardStyle.borderTopLeftRadius || '0') : 0,
      cardBorderColor: cardStyle ? String(cardStyle.borderTopColor || '') : '',
      cardBackground: cardStyle ? String(cardStyle.backgroundColor || '') : '',
      cardBackdrop: cardStyle ? String(cardStyle.backdropFilter || cardStyle.webkitBackdropFilter || '') : '',
    };
  }, selectors);
}

test('profile routes inherit /submit canonical shell geometry and glass', async ({ page }) => {
  await stubDexAuthRuntime(page);
  await stubExternalApis(page);

  for (const breakpoint of BREAKPOINTS) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });

    const baseline = await captureMetrics(page, '/entry/submit/', CARD_SELECTORS['/entry/submit/']);

    expect(baseline.headerWidthPx).toBeGreaterThan(0);
    expect(baseline.rootWidthPx).toBeGreaterThan(0);
    expect(Math.abs(baseline.rootWidthPx - baseline.headerWidthPx)).toBeLessThanOrEqual(14);
    expect(Math.abs(baseline.footerWidthPx - baseline.headerWidthPx)).toBeLessThanOrEqual(14);
    expect(baseline.cardRadiusPx).toBeGreaterThan(0);
    expect(
      hasCanonicalBackdrop(baseline.cardBackdrop),
      `baseline backdrop not canonical at ${breakpoint.label}: ${baseline.cardBackdrop}`,
    ).toBeTruthy();

    for (const routePath of PROFILE_ROUTES) {
      if (routePath === '/entry/submit/') continue;
      const routeMetrics = await captureMetrics(page, routePath, CARD_SELECTORS[routePath]);

      expect(routeMetrics.rootWidthPx).toBeGreaterThan(0);
      expect(routeMetrics.footerWidthPx).toBeGreaterThan(0);
      expect(Math.abs(routeMetrics.rootWidthPx - baseline.rootWidthPx)).toBeLessThanOrEqual(14);
      expect(Math.abs(routeMetrics.footerWidthPx - baseline.footerWidthPx)).toBeLessThanOrEqual(14);
      expect(Math.abs(routeMetrics.rootTopGapPx - baseline.rootTopGapPx)).toBeLessThanOrEqual(48);
      expect(routeMetrics.rootOverflow).toBe(baseline.rootOverflow);
      expect(routeMetrics.rootChildOverflow).toBe(baseline.rootChildOverflow);
      expect(Math.abs(routeMetrics.cardRadiusPx - baseline.cardRadiusPx)).toBeLessThanOrEqual(2);
      expect(
        hasCanonicalBackdrop(routeMetrics.cardBackdrop),
        `non-canonical backdrop at ${breakpoint.label} ${routePath}: ${routeMetrics.cardBackdrop}`,
      ).toBeTruthy();

      const baselineBgAlpha = parseAlpha(baseline.cardBackground);
      const routeBgAlpha = parseAlpha(routeMetrics.cardBackground);
      if (Number.isFinite(baselineBgAlpha) && Number.isFinite(routeBgAlpha)) {
        expect(Math.abs(routeBgAlpha - baselineBgAlpha)).toBeLessThanOrEqual(0.08);
      }

      const baselineBorderAlpha = parseAlpha(baseline.cardBorderColor);
      const routeBorderAlpha = parseAlpha(routeMetrics.cardBorderColor);
      if (Number.isFinite(baselineBorderAlpha) && Number.isFinite(routeBorderAlpha)) {
        expect(Math.abs(routeBorderAlpha - baselineBorderAlpha)).toBeLessThanOrEqual(0.1);
      }
    }
  }
});
