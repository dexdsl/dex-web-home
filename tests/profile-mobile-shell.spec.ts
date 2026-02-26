import { expect, test, type Page } from 'playwright/test';

const PROFILE_ROUTES = [
  '/entry/submit/',
  '/entry/favorites/',
  '/entry/messages/',
  '/entry/pressroom/',
  '/entry/achievements/',
];

test.use({ viewport: { width: 390, height: 844 } });

async function stubDexAuthRuntime(page: Page): Promise<void> {
  const script = `
    (() => {
      const auth = {
        ready: Promise.resolve({ isAuthenticated: false }),
        resolve: () => Promise.resolve({ authenticated: false }),
        requireAuth: () => Promise.resolve({ status: 'blocked' }),
        isAuthenticated: () => Promise.resolve(false),
        getUser: () => Promise.resolve(null),
        getAccessToken: () => Promise.resolve(''),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
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
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', rows: [] })});`,
    });
  });
}

test('mobile profile routes keep gooey behind content and footer compact', async ({ page }) => {
  await stubDexAuthRuntime(page);
  await stubExternalApis(page);

  for (const routePath of PROFILE_ROUTES) {
    await page.goto(routePath, { waitUntil: 'domcontentloaded' });

    await expect
      .poll(() => page.evaluate(() => document.body.classList.contains('dx-route-profile-protected')))
      .toBeTruthy();

    const metrics = await page.evaluate(() => {
      const routeRoot = document.querySelector(
        '#dex-favorites,#dex-msg,#dex-submit,#dex-press,#dex-achv,#dex-console,#dex-settings',
      ) as HTMLElement | null;
      const mesh = document.getElementById('gooey-mesh-wrapper');
      const scrollRoot = document.getElementById('dx-slot-scroll-root');
      const footer = document.querySelector('.dex-footer') as HTMLElement | null;
      const footerGrid = footer?.querySelector('.footer-grid') as HTMLElement | null;
      const footerLinksColumn = footer?.querySelector('.footer-links-column') as HTMLElement | null;
      const footerSocial = footer?.querySelector('.footer-social') as HTMLElement | null;
      const footerNav = footer?.querySelector('.footer-nav') as HTMLElement | null;
      const sealImage = footer?.querySelector('.candid-seal img') as HTMLElement | null;

      const toZ = (value: string | null | undefined) => {
        const parsed = Number.parseInt(String(value || '0'), 10);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const routeStyle = routeRoot ? window.getComputedStyle(routeRoot) : null;
      const routeRect = routeRoot ? routeRoot.getBoundingClientRect() : null;
      const meshStyle = mesh ? window.getComputedStyle(mesh) : null;
      const scrollStyle = scrollRoot ? window.getComputedStyle(scrollRoot) : null;
      const footerStyle = footer ? window.getComputedStyle(footer) : null;
      const footerGridStyle = footerGrid ? window.getComputedStyle(footerGrid) : null;
      const footerLinksStyle = footerLinksColumn ? window.getComputedStyle(footerLinksColumn) : null;
      const footerSocialRect = footerSocial ? footerSocial.getBoundingClientRect() : null;
      const footerNavRect = footerNav ? footerNav.getBoundingClientRect() : null;
      const sealRect = sealImage ? sealImage.getBoundingClientRect() : null;
      const footerRect = footer ? footer.getBoundingClientRect() : null;

      return {
        routeRootPosition: routeStyle ? routeStyle.position : '',
        routeRootZ: toZ(routeStyle ? routeStyle.zIndex : ''),
        meshZ: toZ(meshStyle ? meshStyle.zIndex : ''),
        scrollOverflowY: scrollStyle ? scrollStyle.overflowY : '',
        scrollInsetBottom: scrollStyle ? scrollStyle.bottom : '',
        footerPosition: footerStyle ? footerStyle.position : '',
        footerGridDisplay: footerGridStyle ? footerGridStyle.display : '',
        footerLinksDirection: footerLinksStyle ? footerLinksStyle.flexDirection : '',
        footerHeightPx: footerRect ? Math.round(footerRect.height) : 0,
        routeBottomPx: routeRect ? Math.round(routeRect.bottom) : 0,
        footerTopPx: footerRect ? Math.round(footerRect.top) : 0,
        sealHeightPx: sealRect ? Math.round(sealRect.height) : 0,
        sealTopPx: sealRect ? Math.round(sealRect.top) : 0,
        socialTopPx: footerSocialRect ? Math.round(footerSocialRect.top) : 0,
        navTopPx: footerNavRect ? Math.round(footerNavRect.top) : 0,
      };
    });

    expect(['auto', 'scroll']).toContain(metrics.scrollOverflowY);
    expect(metrics.scrollInsetBottom).toBe('0px');
    expect(metrics.routeRootPosition).toBe('relative');
    expect(metrics.routeRootZ).toBeGreaterThan(metrics.meshZ);

    expect(metrics.footerPosition).toBe('relative');
    expect(metrics.footerGridDisplay).toBe('grid');
    expect(metrics.footerLinksDirection).toBe('column');
    expect(metrics.footerHeightPx).toBeGreaterThan(0);
    expect(metrics.footerHeightPx).toBeLessThan(240);
    expect(Math.abs(metrics.footerTopPx - metrics.routeBottomPx)).toBeLessThan(28);
    expect(metrics.sealHeightPx).toBeGreaterThan(0);
    expect(metrics.sealHeightPx).toBeLessThan(60);
    expect(Math.abs(metrics.sealTopPx - metrics.socialTopPx)).toBeLessThan(60);
    expect(Math.abs(metrics.sealTopPx - metrics.navTopPx)).toBeLessThan(70);
  }
});
