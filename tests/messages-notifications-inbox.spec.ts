import { expect, test, type Page } from 'playwright/test';

type AuthMode = 'signed-in' | 'signed-out';
type SystemMode = 'success' | 'failure';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

const SYSTEM_MESSAGES_FIXTURE = [
  {
    id: 'sys-001',
    sourceType: 'system',
    category: 'billing',
    severity: 'critical',
    title: 'Payment failed',
    body: 'Your latest payment attempt failed. Update your billing method.',
    href: '/entry/settings/#membership',
    createdAt: '2026-02-25T18:00:00.000Z',
    readAt: '',
    archivedAt: '',
  },
  {
    id: 'sys-002',
    sourceType: 'system',
    category: 'polls',
    severity: 'info',
    title: 'Poll closed',
    body: 'A poll you interacted with has closed and results are available.',
    href: '/polls/',
    createdAt: '2026-02-24T15:00:00.000Z',
    readAt: '2026-02-24T16:00:00.000Z',
    archivedAt: '',
  },
];

const SUBMISSION_ROWS = [
  {
    row: 12,
    timestamp: '2026-02-26T09:00:00.000Z',
    collectionType: 'A',
    license: 'Joint',
    status: 'Pending Review',
    note: 'Please share one dry alternate take.',
  },
  {
    row: 8,
    timestamp: '2026-02-24T10:30:00.000Z',
    collectionType: 'C',
    license: 'CC0',
    status: 'Accepted',
    note: 'Accepted for the next release set.',
  },
];

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
      const user = mode === 'signed-in'
        ? { sub: 'auth0|messages-e2e', name: 'Messages E2E', email: 'messages-e2e@example.com' }
        : null;
      const auth = {
        ready: Promise.resolve({ isAuthenticated: mode === 'signed-in' }),
        resolve: () => Promise.resolve({ authenticated: mode === 'signed-in' }),
        requireAuth: () => Promise.resolve({ status: mode === 'signed-in' ? 'authenticated' : 'blocked' }),
        isAuthenticated: () => Promise.resolve(mode === 'signed-in'),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve(mode === 'signed-in' ? 'stub-access-token' : ''),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.AUTH0_USER = user;
      window.auth0Sub = user ? user.sub : '';
      window.auth0 = { getUser: () => Promise.resolve(user) };
      try {
        window.dispatchEvent(new CustomEvent('dex-auth:ready', { detail: { isAuthenticated: mode === 'signed-in', user } }));
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

    let payload: unknown = { status: 'error' };
    if (action === 'list') {
      payload = { status: 'ok', rows: SUBMISSION_ROWS };
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

async function stubMessagesApi(
  page: Page,
  mode: SystemMode,
  notificationPatchBodies: unknown[] = [],
  actionHits: string[] = [],
  newsletterHits: string[] = [],
): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (pathname === '/me/notifications' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          announcements: true,
          releases: false,
          projects: true,
          digestWeekly: true,
          quietStart: '22:00',
          quietEnd: '06:00',
        }),
      });
      return;
    }

    if (pathname === '/me/notifications' && method === 'PATCH') {
      const body = request.postDataJSON();
      notificationPatchBodies.push(body);
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (pathname === '/me/messages' && method === 'GET') {
      if (mode === 'failure') {
        await route.fulfill({
          status: 503,
          headers: CORS_HEADERS,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'SERVICE_UNAVAILABLE' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ messages: SYSTEM_MESSAGES_FIXTURE }),
      });
      return;
    }

    if (pathname === '/me/messages/read-all' && method === 'POST') {
      actionHits.push('read-all');
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    const actionMatch = pathname.match(/^\/me\/messages\/([^/]+)\/(read|unread|archive)$/);
    if (actionMatch && method === 'POST') {
      actionHits.push(`${decodeURIComponent(actionMatch[1])}:${actionMatch[2]}`);
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (pathname === '/me/messages/unread-count' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ count: 2 }),
      });
      return;
    }

    if (pathname === '/newsletter/subscribe' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      newsletterHits.push(`subscribe:${String(body.email || '')}`);
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, state: 'pending_confirmation' }),
      });
      return;
    }

    if (pathname === '/newsletter/confirm' && method === 'POST') {
      newsletterHits.push('confirm');
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, state: 'active' }),
      });
      return;
    }

    if (pathname === '/newsletter/unsubscribe' && method === 'POST') {
      newsletterHits.push('unsubscribe');
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, state: 'unsubscribed' }),
      });
      return;
    }

    // Other settings dependencies, non-blocking defaults.
    if (pathname === '/me/profile' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'Messages E2E', email: 'messages-e2e@example.com' }),
      });
      return;
    }

    if (pathname === '/me/identity/refresh' && method === 'POST') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (pathname.startsWith('/me/billing/') || pathname.startsWith('/me/invoices') || pathname.startsWith('/prices') || pathname.startsWith('/me/subscription')) {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], plans: [], invoices: [] }),
      });
      return;
    }

    if (pathname === '/me/security/revoke-others' && method === 'POST') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'NOT_FOUND', path: pathname }),
    });
  });
}

async function waitForMessagesReady(page: Page): Promise<void> {
  const root = page.locator('#dex-msg');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

test('settings notifications migrate v1 payload into v2 contract on save', async ({ page }) => {
  const patchBodies: unknown[] = [];

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success', patchBodies);

  await page.goto('/entry/settings/#notifs', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-notifs').click();

  const toggleIds = [
    '#notifDexNotes',
    '#notifPolls',
    '#notifAchv',
    '#notifBill',
    '#notifSec',
    '#notifStatus',
    '#notifSubs',
    '#notifDigest',
  ];
  for (const selector of toggleIds) {
    const details = await page.locator(selector).evaluate((input) => {
      const label = input.closest('label');
      return {
        title: input.getAttribute('title'),
        tooltip: label ? label.getAttribute('data-dx-tooltip') : '',
      };
    });
    expect(details.title).toBeNull();
    expect(Boolean(details.tooltip && details.tooltip.trim().length > 12)).toBe(true);
  }
  await expect(page.locator('#notifDigest').locator('xpath=ancestor::label[1]')).toHaveAttribute(
    'data-dx-tooltip',
    /Monday at 9:00 AM local time/i,
  );

  await expect(page.locator('#notifDexNotes')).toBeChecked();
  await expect(page.locator('#notifPolls')).toBeChecked();
  await expect(page.locator('#notifAchv')).not.toBeChecked();

  await page.locator('#notifAchv').check();

  await expect.poll(() => patchBodies.length).toBeGreaterThan(0);
  const payload = patchBodies.at(-1) as Record<string, unknown>;

  expect(payload.version).toBe(2);
  expect((payload.channels as Record<string, unknown>).inbox).toBe(true);
  expect((payload.categories as Record<string, unknown>).achievements).toBe(true);
  expect((payload.categories as Record<string, unknown>).releaseNotes).toBe(true);
  expect((payload.categories as Record<string, unknown>).announcements).toBe(true);
  expect((payload.digest as Record<string, unknown>).cadence).toBe('weekly');
  expect((payload.digest as Record<string, unknown>).day).toBe('monday');
  expect((payload.digest as Record<string, unknown>).localHour).toBe(9);
  expect(payload.announcements).toBe(true);
  expect(payload.releases).toBe(true);
  expect(payload.projects).toBe(true);
});

test('settings notifications exposes newsletter controls, tooltips, and internal scrolling layout', async ({ page }) => {
  const newsletterHits: string[] = [];

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success', [], [], newsletterHits);

  await page.goto('/entry/settings/#notifs', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-notifs').click();

  await expect(page.locator('#notCard .dx-not-scroll')).toBeVisible();
  const scrollMeta = await page.locator('#notCard .dx-not-scroll').evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { overflowY: style.overflowY, maxHeight: style.maxHeight };
  });
  expect(['auto', 'scroll', 'overlay']).toContain(scrollMeta.overflowY);
  expect(scrollMeta.maxHeight).not.toBe('none');

  const gridColumnCount = await page.locator('#notCard .list').evaluate((node) => {
    const template = window.getComputedStyle(node).gridTemplateColumns;
    return template.split(' ').filter((part) => part.trim().length > 0).length;
  });
  expect(gridColumnCount).toBeGreaterThanOrEqual(2);

  await expect(page.locator('#pane-notifs .list label.item[data-dx-tooltip]')).toHaveCount(8);
  await expect(page.locator('a[href="/entry/pressroom/"]')).toHaveCount(1);

  await page.fill('#notifNewsletterEmail', 'notify@example.com');
  await page.click('#notifNewsletterSubscribe');
  await expect(page.locator('#notifNewsletterStatusLine')).toContainText(/check your email|subscription request sent/i);
  await expect.poll(() => newsletterHits.includes('subscribe:notify@example.com')).toBe(true);

  await page.fill('#notifNewsletterConfirmToken', 'confirm-test-token');
  await page.click('#notifNewsletterConfirm');
  await expect(page.locator('#notifNewsletterStatusLine')).toContainText(/confirmed/i);
  await expect.poll(() => newsletterHits.includes('confirm')).toBe(true);

  await page.fill('#notifNewsletterUnsubToken', 'unsub-test-token');
  await page.click('#notifNewsletterUnsubscribe');
  await expect(page.locator('#notifNewsletterStatusLine')).toContainText(/unsubscribed/i);
  await expect.poll(() => newsletterHits.includes('unsubscribe')).toBe(true);
});

test('messages inbox merges system + submissions and supports read/archive actions', async ({ page }) => {
  const actionHits: string[] = [];

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubSubmissionsJsonp(page);
  await stubMessagesApi(page, 'success', [], actionHits);

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitForMessagesReady(page);

  await expect(page.locator('[data-dx-msg-item]')).toHaveCount(4);
  await expect(page.locator('#dx-msg-unread-count')).toContainText('3');

  await page.locator('[data-dx-msg-filter="system"]').click();
  await expect(page.locator('[data-dx-msg-item][data-source-type="system"]')).toHaveCount(2);

  const systemReadButton = page.locator('[data-dx-msg-action="read"][data-record-id="sys-001"]');
  await expect(systemReadButton).toBeVisible();
  await systemReadButton.click();

  await expect.poll(() => actionHits.includes('sys-001:read')).toBe(true);

  const archiveButton = page.locator('[data-dx-msg-action="archive"][data-record-id="sys-001"]');
  await archiveButton.click();

  await expect.poll(() => actionHits.includes('sys-001:archive')).toBe(true);
  await expect(page.locator('[data-record-id="sys-001"]')).toHaveCount(0);

  await page.locator('[data-dx-msg-filter="all"]').click();
  await page.locator('[data-dx-msg-action="read-all"]').click();

  await expect(page.locator('[data-dx-msg-item][data-dx-msg-read="false"]')).toHaveCount(0);
});

test('messages inbox degrades gracefully when system endpoint fails', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubSubmissionsJsonp(page);
  await stubMessagesApi(page, 'failure');

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitForMessagesReady(page);

  await expect(page.locator('.dx-msg-warning')).toContainText('System notifications are temporarily unavailable.');
  await expect(page.locator('[data-dx-msg-item][data-source-type="submission"]')).toHaveCount(2);
});

test('messages inbox exits loading and shows sign-in prompt for signed-out users', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-out');
  await stubMessagesApi(page, 'success');

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitForMessagesReady(page);

  await expect(page.locator('#dx-msg-signin')).toContainText('Please sign in');
});
