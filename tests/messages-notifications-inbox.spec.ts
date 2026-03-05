import { expect, test, type Page } from 'playwright/test';

type AuthMode = 'signed-in' | 'signed-out';
type SystemMode = 'success' | 'failure';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

const GENERATED_LOOKUP_REGEX = /^SUB\d{2}-[A-Z]\.[A-Za-z]{3}\s+[A-Za-z][A-Za-z\-']*\s+(?:A|V|AV|O)\d{4}$/;

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

const PRESSROOM_ROWS = [
  {
    row: 4,
    requestId: 'req-press-01',
    project: 'Pressroom Launch Story',
    status: 'in_review',
    name: 'Alex Tester',
    email: 'alex@example.com',
    links: 'https://example.com/pressroom-launch',
    timeframe: 'Q2 2026',
    timestamp: '2026-02-25T10:00:00.000Z',
    updatedAt: '2026-02-26T12:00:00.000Z',
  },
];

const SUBMISSION_THREADS_FIXTURE = [
  {
    submissionId: 'sub-001',
    lookup: 'SUB12-B.Pre Do A2026',
    title: 'Brass Session',
    creator: 'John Doe',
    currentStage: 'reviewing',
    currentStatusRaw: 'Pending Review',
    latestPublicNote: 'Please share one dry alternate take.',
    sourceRow: 12,
    collectionType: 'A',
    license: 'Joint',
    updatedAt: '2026-02-26T09:00:00.000Z',
    acknowledgedAt: '',
    archivedAt: '',
  },
  {
    submissionId: 'sub-002',
    lookup: 'SUB08-K.Org Do AV2026',
    title: 'Organ Session',
    creator: 'Jane Doe',
    currentStage: 'accepted',
    currentStatusRaw: 'Accepted',
    latestPublicNote: 'Accepted for the next release set.',
    sourceRow: 8,
    collectionType: 'C',
    license: 'CC0',
    updatedAt: '2026-02-24T10:30:00.000Z',
    acknowledgedAt: '2026-02-24T11:00:00.000Z',
    archivedAt: '',
  },
];

const SUBMISSION_DETAIL_FIXTURE: Record<string, unknown> = {
  thread: {
    submissionId: 'sub-001',
    lookup: 'SUB12-B.Pre Do A2026',
    title: 'Brass Session',
    creator: 'John Doe',
    currentStage: 'reviewing',
    currentStatusRaw: 'Pending Review',
    sourceLink: '/entry/submit/',
    libraryHref: '',
    updatedAt: '2026-02-26T09:00:00.000Z',
    acknowledgedAt: '',
  },
  timeline: [
    {
      id: 'sub-evt-1',
      eventType: 'sent',
      stage: 'sent',
      statusRaw: 'Submitted',
      publicNote: '',
      eventAt: '2026-02-26T08:59:00.000Z',
    },
    {
      id: 'sub-evt-2',
      eventType: 'received',
      stage: 'received',
      statusRaw: 'Pending Review',
      publicNote: 'Received and queued.',
      eventAt: '2026-02-26T09:00:00.000Z',
    },
  ],
  stageRail: {
    currentStage: 'reviewing',
    steps: [
      { key: 'sent', label: 'Sent', state: 'done', at: '2026-02-26T08:59:00.000Z' },
      { key: 'received', label: 'Received', state: 'done', at: '2026-02-26T09:00:00.000Z' },
      { key: 'acknowledged', label: 'Acknowledged', state: 'todo', at: '' },
      { key: 'reviewing', label: 'Reviewing', state: 'active', at: '' },
      { key: 'accepted', label: 'Accepted', state: 'todo', at: '' },
      { key: 'rejected', label: 'Rejected', state: 'todo', at: '' },
      { key: 'in_library', label: 'In library', state: 'todo', at: '' },
    ],
  },
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
    const isPressroomScript = url.pathname.includes('AKfycbwb2lOkJDN7rOJVmGHPzY3IBRByjrfMI0GH_TzUsXYDEXIjdIlqr-ZR0VKDWvoPmFjw');

    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }

    let payload: unknown = { status: 'error' };
    if (action === 'list') {
      payload = { status: 'ok', rows: isPressroomScript ? PRESSROOM_ROWS : SUBMISSION_ROWS };
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
  let newsletterState = 'active';
  let newsletterLastActionSentAt = '2026-02-26T09:40:00.000Z';
  let newsletterUpdatedAt = '2026-02-26T09:40:00.000Z';

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

    if (pathname === '/me/submissions' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ threads: SUBMISSION_THREADS_FIXTURE }),
      });
      return;
    }

    const submissionDetailMatch = pathname.match(/^\/me\/submissions\/([^/]+)$/);
    if (submissionDetailMatch && method === 'GET') {
      const sid = decodeURIComponent(submissionDetailMatch[1]);
      await route.fulfill({
        status: sid === 'sub-001' ? 200 : 404,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: sid === 'sub-001'
          ? JSON.stringify(SUBMISSION_DETAIL_FIXTURE)
          : JSON.stringify({ error: 'Not found' }),
      });
      return;
    }

    const submissionAckMatch = pathname.match(/^\/me\/submissions\/([^/]+)\/ack$/);
    if (submissionAckMatch && method === 'POST') {
      const sid = decodeURIComponent(submissionAckMatch[1]);
      actionHits.push(`submission:${sid}:ack`);
      const payload = JSON.parse(JSON.stringify(SUBMISSION_DETAIL_FIXTURE));
      if (payload && typeof payload === 'object' && payload.thread && typeof payload.thread === 'object') {
        payload.thread.acknowledgedAt = '2026-02-26T09:20:00.000Z';
      }
      if (Array.isArray(payload.timeline)) {
        payload.timeline.push({
          id: 'sub-evt-ack',
          eventType: 'user_acknowledged',
          stage: 'acknowledged',
          statusRaw: 'acknowledged',
          publicNote: '',
          eventAt: '2026-02-26T09:20:00.000Z',
        });
      }
      if (payload && typeof payload === 'object' && payload.stageRail && typeof payload.stageRail === 'object' && Array.isArray(payload.stageRail.steps)) {
        payload.stageRail.steps = payload.stageRail.steps.map((step: Record<string, unknown>) =>
          step.key === 'acknowledged'
            ? { ...step, state: 'done', at: '2026-02-26T09:20:00.000Z' }
            : step,
        );
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify(payload),
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

    if (pathname === '/newsletter/subscription' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          email: 'messages-e2e@example.com',
          state: newsletterState,
          lastActionSentAt: newsletterLastActionSentAt,
          updatedAt: newsletterUpdatedAt,
          cooldownUntil: 0,
          requestId: 'newsletter-status-req',
        }),
      });
      return;
    }

    if (pathname === '/newsletter/subscription/action' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const action = String(body.action || '').trim().toLowerCase();
      const email = String(body.email || '');
      newsletterHits.push(`action:${action}:${email}`);
      if (action === 'subscribe' || action === 'resend-confirmation') newsletterState = 'pending_confirmation';
      if (action === 'pause') newsletterState = 'paused';
      if (action === 'resume') newsletterState = 'active';
      if (action === 'unsubscribe') newsletterState = 'suppressed';
      newsletterLastActionSentAt = '2026-02-26T10:00:00.000Z';
      newsletterUpdatedAt = '2026-02-26T10:00:00.000Z';
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          email,
          state: newsletterState,
          requestId: `newsletter-action-${action || 'unknown'}`,
          lastActionSentAt: newsletterLastActionSentAt,
          updatedAt: newsletterUpdatedAt,
        }),
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

async function stubMembershipSummary(page: Page, summary: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify(summary);
  const matcher = /\/me\/billing\/summary(?:\?.*)?$|\/me\/subscription(?:\?.*)?$/;
  await page.route(matcher, async (route) => {
    if (route.request().method().toUpperCase() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body,
    });
  });
}

async function waitForMessagesReady(page: Page): Promise<void> {
  const root = page.locator('#dex-msg');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

async function expectSettingsInkAligned(page: Page, tabSelector: string): Promise<void> {
  await expect.poll(async () => {
    return page.evaluate((selector) => {
      const tab = document.querySelector(selector);
      const pills = document.querySelector('#dex-settings .pills');
      const ink = document.querySelector('#dex-settings .pills .ink');
      if (!(tab instanceof HTMLElement) || !(pills instanceof HTMLElement) || !(ink instanceof HTMLElement)) {
        return false;
      }
      const selected = tab.getAttribute('aria-selected') === 'true';
      const tabRect = tab.getBoundingClientRect();
      const pillsRect = pills.getBoundingClientRect();
      const inkRect = ink.getBoundingClientRect();
      const tabX = tabRect.left - pillsRect.left;
      const inkX = inkRect.left - pillsRect.left;
      const xDiff = Math.abs(tabX - inkX);
      const widthDiff = Math.abs(tabRect.width - inkRect.width);
      return selected && xDiff <= 4 && widthDiff <= 4;
    }, tabSelector);
  }, { timeout: 8_000 }).toBe(true);
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
  await page.setViewportSize({ width: 1200, height: 900 });

  await page.goto('/entry/settings/#notifs', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-notifs').click();
  await expect(page.locator('#dex-settings')).toHaveAttribute('data-dx-settings-pane', 'notifs');

  const desktopSettingsWidth = await page.evaluate(() => window.innerWidth || document.documentElement.clientWidth || 0);
  if (desktopSettingsWidth >= 980) {
    const sidebarMeta = await page.locator('#dex-settings .grid > aside').evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { overflowY: style.overflowY };
    });
    expect(['auto', 'scroll', 'overlay']).not.toContain(sidebarMeta.overflowY);
    await expect(page.locator('#settingsMembershipAsideRail')).toBeVisible();
    const railMeta = await page.locator('#settingsMembershipAsideRail').evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { overflowY: style.overflowY };
    });
    expect(['auto', 'scroll', 'overlay']).toContain(railMeta.overflowY);
  }

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
  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 720) {
    expect(gridColumnCount).toBeGreaterThanOrEqual(1);
  } else {
    expect(gridColumnCount).toBeGreaterThanOrEqual(2);
  }

  await expect(page.locator('#pane-notifs .list label.item[data-dx-tooltip]')).toHaveCount(8);
  await expect(page.locator('a[href="/entry/pressroom/"]')).toHaveCount(0);
  await expect(page.locator('#notifNewsletterCooldownValue')).toHaveCount(0);
  await expect(page.locator('#notifNewsletterEmail')).toHaveCount(0);
  await expect(page.locator('#notifNewsletterConfirmToken')).toHaveCount(0);
  await expect(page.locator('#notifNewsletterUnsubToken')).toHaveCount(0);
  await expect(page.locator('#notifNewsletterEmailValue')).toContainText('messages-e2e@example.com');
  await expect(page.locator('#notifNewsletterStateBadge')).toContainText(/active/i);
  await expect(page.locator('#notifNewsletterActions [data-dx-newsletter-action="manage"]')).toBeVisible();
  await expect(page.locator('#notifNewsletterActions [data-dx-newsletter-action="pause"]')).toBeVisible();
  await expect(page.locator('#notifNewsletterActions [data-dx-newsletter-action="unsubscribe"]')).toBeVisible();
  await expect(page.locator('#notifNewsletterRefresh')).toBeVisible();

  await page.click('#notifNewsletterActions [data-dx-newsletter-action="manage"]');
  await expect(page.locator('#notifNewsletterStatusLine')).toContainText(/manage-subscription link sent|check your inbox/i);
  await expect.poll(() => newsletterHits.includes('action:manage:messages-e2e@example.com')).toBe(true);
  await page.click('#notifNewsletterActions [data-dx-newsletter-action="manage"]');
  await expect(page.locator('#notifNewsletterBlock .dx-newsletter-toast')).toContainText(/please wait .* before requesting another newsletter email/i);

  await page.click('#notifNewsletterActions [data-dx-newsletter-action="pause"]');
  await expect(page.locator('#notifNewsletterStatusLine')).toContainText(/pause link sent|check your inbox/i);
  await expect(page.locator('#notifNewsletterStateBadge')).toContainText(/paused/i);
  await expect(page.locator('#notifNewsletterActions [data-dx-newsletter-action="resume"]')).toBeVisible();

  await page.click('#notifNewsletterActions [data-dx-newsletter-action="resume"]');
  await expect(page.locator('#notifNewsletterStatusLine')).toContainText(/resume link sent|check your inbox/i);
  await expect(page.locator('#notifNewsletterStateBadge')).toContainText(/active/i);

  await page.click('#notifNewsletterActions [data-dx-newsletter-action="unsubscribe"]');
  await expect(page.locator('#notifNewsletterStatusLine')).toContainText(/unsubscribe link sent|check your inbox/i);
  await expect(page.locator('#notifNewsletterStateBadge')).toContainText(/suppressed/i);

  await expect.poll(() => page.locator('#notifNewsletterRefresh').isDisabled()).toBe(false);
  await page.click('#notifNewsletterRefresh');
  await expect(page.locator('#notifNewsletterBlock .dx-newsletter-toast')).toContainText(
    /please wait .* before refreshing newsletter status/i,
  );
});

test('settings tab underline stays aligned through hash restore, tab switches, and resize', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success');

  await page.goto('/entry/settings/#notifs', { waitUntil: 'domcontentloaded' });
  await expectSettingsInkAligned(page, '#tab-notifs');

  await page.locator('#tab-membership').click();
  await expectSettingsInkAligned(page, '#tab-membership');

  await page.locator('#tab-profile').click({ force: true });
  await expectSettingsInkAligned(page, '#tab-profile');

  await page.setViewportSize({ width: 1120, height: 820 });
  await expectSettingsInkAligned(page, '#tab-profile');

  await page.locator('#tab-notifs').click();
  await expectSettingsInkAligned(page, '#tab-notifs');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectSettingsInkAligned(page, '#tab-notifs');
});

test('settings membership impact uses reordered artist names and instrument-aware patronage copy', async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'dex:favorites:v2:auth0|messages-e2e';
    const rows = [
      {
        kind: 'entry',
        lookupNumber: 'K.Org. At AV2023 S1',
        entryLookupNumber: 'K.Org. At AV2023',
        entryHref: '/entries/test-9/',
        performer: 'ataka, midori',
        title: 'Test Entry',
        addedAt: '2026-02-26T06:00:00.000Z',
        source: 'test',
      },
    ];
    window.localStorage.setItem(key, JSON.stringify(rows));
  });

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success');

  await page.goto('/entry/settings/#membership', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-membership').click();

  await expect
    .poll(() =>
      page.locator('#dxWhyFavoriteMain').evaluate((node) =>
        String(node.textContent || '').replace(/\u200C/g, ''),
      ),
    )
    .toContain('Support artists like Midori Ataka.');
  const subCopy = await page.locator('#dxWhyFavoriteSub').evaluate((node) =>
    String(node.textContent || '').replace(/\u200C/g, ''),
  );
  expect(subCopy).toContain('Your patronage is part of what helps us record more organ sessions season after season.');

  const zwnjState = await page.evaluate(() => {
    const main = document.getElementById('dxWhyFavoriteMain')?.textContent || '';
    const sub = document.getElementById('dxWhyFavoriteSub')?.textContent || '';
    const rowTitles = Array.from(document.querySelectorAll('#asideWhy .dx-why-copy strong'))
      .map((node) => node.textContent || '');
    const hasMainZwnj = main.includes('\u200C');
    const hasSubZwnj = sub.includes('\u200C');
    const hasRowZwnj = rowTitles.some((value) => value.includes('\u200C'));
    return { hasMainZwnj, hasSubZwnj, hasRowZwnj };
  });
  expect(zwnjState.hasMainZwnj || zwnjState.hasSubZwnj || zwnjState.hasRowZwnj).toBe(true);
});

test('settings membership v3 renders trust-first status and production billing ledger', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success');
  await stubMembershipSummary(page, {
    status: 'none',
    customer_portal_enabled: true,
    has_default_payment_method: false,
  });
  await page.setViewportSize({ width: 1200, height: 900 });

  await page.goto('/entry/settings/#membership', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-membership').click();
  await expect(page.locator('#dex-settings')).toHaveAttribute('data-dx-settings-pane', 'membership');

  const desktopMembershipWidth = await page.evaluate(() => window.innerWidth || document.documentElement.clientWidth || 0);
  if (desktopMembershipWidth >= 980) {
    const membershipSidebarMeta = await page.locator('#dex-settings .grid > aside').evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { overflowY: style.overflowY };
    });
    expect(['auto', 'scroll', 'overlay']).not.toContain(membershipSidebarMeta.overflowY);
    const membershipAsideRailMeta = await page.locator('#settingsMembershipAsideRail').evaluate((node) => {
      const style = window.getComputedStyle(node);
      return { overflowY: style.overflowY };
    });
    expect(['auto', 'scroll', 'overlay']).toContain(membershipAsideRailMeta.overflowY);
  }

  await expect(page.locator('#settingsMembershipAsideRail')).toHaveAttribute('data-dx-settings-aside-rail', 'membership');
  const membershipRoot = page.locator('#dxMembershipV3Root');
  await expect(membershipRoot).toBeVisible();
  await expect(membershipRoot).toHaveAttribute('data-dx-membership-state', /none|active|trialing|past_due|unpaid|canceled_at_period_end|canceled/);
  await expect(membershipRoot).toHaveAttribute('data-dx-membership-cta-mode', 'view-membership');
  await expect(membershipRoot).toHaveAttribute('data-dx-membership-rail', 'true');
  await expect(membershipRoot).toHaveAttribute('data-dx-membership-rail-scrollable', /true|false/);
  await expect(page.locator('#dxMembershipV3Root #dxMemV3SupportHeading')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3SupportHeading')).toContainText('Want to support?');
  await expect(page.locator('#dxMembershipV3Root [data-dx-billing-cta-primary]')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root [data-dx-billing-cta-primary]')).toContainText('View membership');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Secondary')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root [data-dx-tier-panel]')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3TierComposer')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-tier-panel-open', 'false');
  await page.locator('#dxMembershipV3Root [data-dx-billing-cta-primary]').click();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-membership-cta-mode', 'cancel-composer');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3SummaryView')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3ComposerView')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Back')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Back')).toContainText('Back');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3TierComposer')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-tier-panel-open', 'true');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3ComposerCheckout')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3ComposerCheckout')).toContainText('Start membership');
  await expect(page.locator('#dxMembershipV3Root .dx-memv3-interval-thumb')).toBeVisible();
  await page.locator('#dxMembershipV3Root #dxMemV3Back').click();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-membership-cta-mode', 'view-membership');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3SummaryView')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3ComposerView')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Primary')).toContainText('View membership');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3TierComposer')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root .dx-memv3-impact')).toHaveCount(0);
  await expect(page.locator('#asideWhy')).toBeVisible();

  const railOverflowStateMatches = await membershipRoot.evaluate((node) => {
    const attr = String(node.getAttribute('data-dx-membership-rail-scrollable') || '').toLowerCase();
    if (window.innerWidth < 980) return attr === 'false';
    const shouldScroll = node.scrollHeight > node.clientHeight + 1;
    return shouldScroll ? attr === 'true' : attr === 'false';
  });
  expect(railOverflowStateMatches).toBe(true);

  await expect(page.locator('#dxBillingHistoryV3Card h2')).toContainText('Billing history');
  await expect(page.locator('#dxBillingHistoryV3Card')).not.toContainText('preview');
  await expect(page.locator('#dxBillingHistoryV3Card [data-dx-billing-ledger]')).toBeVisible();

  const headers = await page.locator('#dxBillingHistoryV3Card thead th').allTextContents();
  expect(headers.map((value) => value.trim())).toEqual(['Date', 'Invoice', 'Status', 'Amount', 'Receipt']);
});

test('settings membership v3 shows view membership + manage billing for no-membership portal-dirty state', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success');
  await stubMembershipSummary(page, {
    status: 'none',
    customer_portal_enabled: true,
    has_default_payment_method: true,
    default_payment_method_last4: '4242',
  });

  await page.goto('/entry/settings/#membership', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-membership').click();

  await expect(page.locator('#dxMembershipV3Root #dxMemV3SupportHeading')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Primary')).toContainText('View membership');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Secondary')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Secondary')).toContainText('Manage billing');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3PauseResume')).toBeHidden();
});

test('settings membership v3 shows current-membership actions for active and payment-required states', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success');
  await stubMembershipSummary(page, {
    status: 'active',
    tier: 'M',
    interval: 'month',
    customer_portal_enabled: true,
    current_period_end: 1773014400,
  });

  await page.goto('/entry/settings/#membership', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-membership').click();

  await expect(page.locator('#dxMembershipV3Root #dxMemV3SupportHeading')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Primary')).toContainText('Change plan');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Secondary')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Secondary')).toContainText('Manage billing');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3PauseResume')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Archivist');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Monthly');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('$14.99');

  await page.locator('#dxMembershipV3Root #dxMemV3Primary').click();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-membership-cta-mode', 'cancel-composer');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Back')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3TierComposer')).toBeVisible();
  await page.locator('#dxMembershipV3Root [data-interval="year"]').click();
  await page.locator('#dxMembershipV3Root [data-tier="S"]').click();
  await page.locator('#dxMembershipV3Root #dxMemV3Cover').check();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Steward');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Annual');
  await page.locator('#dxMembershipV3Root #dxMemV3Back').click();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-membership-cta-mode', 'view-membership');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Primary')).toContainText('Change plan');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3TierComposer')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Archivist');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Monthly');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('$14.99');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Cover')).not.toBeChecked();

  await page.unroute(/\/me\/billing\/summary(?:\?.*)?$|\/me\/subscription(?:\?.*)?$/);
  await stubMembershipSummary(page, {
    status: 'past_due',
    customer_portal_enabled: true,
    has_default_payment_method: true,
    default_payment_method_last4: '1111',
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#tab-membership').click();

  await expect(page.locator('#dxMembershipV3Root #dxMemV3SupportHeading')).toBeHidden();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Primary')).toContainText('Fix payment method');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Secondary')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Secondary')).toContainText('Manage billing');
});

test('settings membership v3 blocks same-plan checkout and shows inline guidance', async ({ page }) => {
  let checkoutHits = 0;

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApi(page, 'success');
  await stubMembershipSummary(page, {
    status: 'active',
    tier: 'M',
    interval: 'month',
    customer_portal_enabled: true,
  });

  await page.route(/\/me\/billing\/checkout-session(?:\?.*)?$/, async (route) => {
    if (route.request().method().toUpperCase() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    checkoutHits += 1;
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://example.test/checkout' }),
    });
  });

  await page.goto('/entry/settings/#membership', { waitUntil: 'domcontentloaded' });
  await page.locator('#tab-membership').click();

  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Archivist');
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Selection')).toContainText('Monthly');
  await page.locator('#dxMembershipV3Root #dxMemV3Primary').click();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-membership-cta-mode', 'cancel-composer');
  await page.locator('#dxMembershipV3Root #dxMemV3ComposerCheckout').click();

  await expect.poll(() => checkoutHits).toBe(0);
  await expect(page.locator('#dxMembershipV3Root #dxMemV3Error')).toContainText(
    'Select a different tier or billing interval to change your plan.',
  );
});

test('messages inbox merges system + submissions and supports read/archive actions', async ({ page }) => {
  const actionHits: string[] = [];

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubSubmissionsJsonp(page);
  await stubMessagesApi(page, 'success', [], actionHits);

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitForMessagesReady(page);

  await expect(page.locator('[data-dx-msg-item]')).toHaveCount(5);
  await expect(page.locator('#dx-msg-unread-count')).toContainText('3');
  await expect(page.locator('[data-source-type="submission"] .dx-msg-link').first()).toHaveAttribute(
    'href',
    /\/entry\/messages\/submission\/\?sid=sub-001/,
  );
  const submissionTitle = String(await page.locator('[data-source-type="submission"] .dx-msg-heading').first().textContent() || '').trim();
  expect(submissionTitle).toContain('Brass Session');
  const lookupMatch = submissionTitle.match(/\((SUB\d{2}-[A-Z]\.[A-Za-z]{3}\s+[A-Za-z][A-Za-z\-']*\s+(?:A|V|AV|O)\d{4})\)$/);
  expect(lookupMatch?.[1] || '').toMatch(GENERATED_LOOKUP_REGEX);
  await expect(page.locator('[data-source-type="pressroom"] .dx-msg-link').first()).toHaveAttribute(
    'href',
    /\/entry\/messages\/submission\/\?kind=pressroom&rid=req-press-01/,
  );
  await expect(page.locator('[data-source-type="pressroom"] .dx-msg-heading').first()).toContainText(
    'Pressroom Launch Story (req-press-01)',
  );

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
  await expect(page.locator('[data-dx-msg-item][data-source-type="pressroom"]')).toHaveCount(1);
});

test('messages inbox keeps rendering system records when submissions fetch and sheet fallback both fail', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubSubmissionsJsonp(page);
  await stubMessagesApi(page, 'success');

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/me/submissions**', async (route) => {
    await route.abort();
  });

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    if (action === 'list') {
      await route.abort();
      return;
    }
    await route.fallback();
  });

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitForMessagesReady(page);

  await expect(page.locator('.dx-msg-sub')).not.toContainText('Unable to load inbox right now.');
  await expect(page.locator('.dx-msg-shell')).toContainText('Submissions are temporarily unavailable.');
  await expect(page.locator('.dx-msg-shell')).toContainText('Pressroom requests are temporarily unavailable.');
  await expect(page.locator('[data-dx-msg-item][data-source-type="system"]')).toHaveCount(2);
  await expect(page.locator('[data-dx-msg-item][data-source-type="pressroom"]')).toHaveCount(0);
});

test('messages inbox remounts on slot-ready events after route shell swaps', async ({ page }) => {
  await stubDexAuthRuntime(page, 'signed-in');
  await stubSubmissionsJsonp(page);
  await stubMessagesApi(page, 'success');

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitForMessagesReady(page);
  await expect(page.locator('[data-dx-msg-item]')).toHaveCount(5);

  await page.evaluate(() => {
    const root = document.getElementById('dex-msg');
    if (!(root instanceof HTMLElement)) return;
    root.removeAttribute('data-dx-msg-mounted');
    root.removeAttribute('data-dx-msg-booting');
    root.setAttribute('data-dx-fetch-state', 'loading');
    root.innerHTML = '<aside class="dx-msg-shell"><p class="dx-msg-empty">Loading inbox…</p></aside>';
    try {
      window.dispatchEvent(new CustomEvent('dx:slotready', { detail: {} }));
    } catch {}
  });

  await waitForMessagesReady(page);
  await expect(page.locator('[data-dx-msg-item]')).toHaveCount(5);
});

test('messages inbox exits loading and shows sign-in prompt for signed-out users', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-out');
  await stubMessagesApi(page, 'success');

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitForMessagesReady(page);

  await expect(page.locator('#dx-msg-signin')).toContainText('Please sign in');
});
