import { expect, test, type Page } from 'playwright/test';

type AuthMode = 'signed-in' | 'signed-out';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

const SUBMISSION_THREAD = {
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
};

const SUBMISSION_DETAIL = {
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
      id: 'evt-1',
      eventType: 'sent',
      stage: 'sent',
      statusRaw: 'Submitted',
      publicNote: '',
      eventAt: '2026-02-26T08:59:00.000Z',
    },
    {
      id: 'evt-2',
      eventType: 'received',
      stage: 'received',
      statusRaw: 'Pending Review',
      publicNote: 'Received and queued.',
      internalNote: 'staff only note',
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
        ? { sub: 'auth0|submission-e2e', name: 'Submission E2E', email: 'submission-e2e@example.com' }
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

async function stubMessagesApis(
  page: Page,
  options: {
    detailStatus?: 200 | 404 | 403;
    actionHits?: string[];
    listThreads?: unknown[];
    detailPayload?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const detailStatus = options.detailStatus ?? 200;
  const actionHits = options.actionHits || [];
  const listThreads = Array.isArray(options.listThreads) ? options.listThreads : [SUBMISSION_THREAD];
  const detailPayload = options.detailPayload || SUBMISSION_DETAIL;

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (pathname === '/me/submissions' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ threads: listThreads }),
      });
      return;
    }

    if (pathname === '/me/messages' && method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
      return;
    }

    if (pathname === '/me/messages/read-all' && method === 'POST') {
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    const messageAction = pathname.match(/^\/me\/messages\/([^/]+)\/(read|unread|archive)$/);
    if (messageAction && method === 'POST') {
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
        body: JSON.stringify({ count: 1 }),
      });
      return;
    }

    const detailMatch = pathname.match(/^\/me\/submissions\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      await route.fulfill({
        status: detailStatus,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: detailStatus === 200
          ? JSON.stringify(detailPayload)
          : JSON.stringify({ error: detailStatus === 403 ? 'Forbidden' : 'Not found' }),
      });
      return;
    }

    const ackMatch = pathname.match(/^\/me\/submissions\/([^/]+)\/ack$/);
    if (ackMatch && method === 'POST') {
      const sid = decodeURIComponent(ackMatch[1]);
      actionHits.push(`ack:${sid}`);
      const ackPayload = JSON.parse(JSON.stringify(SUBMISSION_DETAIL));
      ackPayload.thread.acknowledgedAt = '2026-02-26T09:20:00.000Z';
      ackPayload.timeline.push({
        id: 'evt-ack',
        eventType: 'user_acknowledged',
        stage: 'acknowledged',
        statusRaw: 'acknowledged',
        publicNote: '',
        eventAt: '2026-02-26T09:20:00.000Z',
      });
      ackPayload.stageRail.steps = ackPayload.stageRail.steps.map((step: Record<string, unknown>) =>
        step.key === 'acknowledged'
          ? { ...step, state: 'done', at: '2026-02-26T09:20:00.000Z' }
          : step,
      );
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify(ackPayload),
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

async function waitReady(page: Page, selector: string): Promise<void> {
  const root = page.locator(selector);
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

test('submission inbox open navigates to timeline detail route', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApis(page);

  await page.goto('/entry/messages/', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-msg');

  const openLink = page.locator('[data-source-type="submission"] .dx-msg-link').first();
  await expect(openLink).toHaveAttribute('href', /\/entry\/messages\/submission\/\?sid=sub-001/);

  await Promise.all([
    page.waitForURL('**/entry/messages/submission/**'),
    openLink.click(),
  ]);

  await waitReady(page, '#dex-submission');
  await expect(page.locator('[data-dx-sub-stage-rail]')).toBeVisible();
  await expect(page.locator('#dx-sub-stage-rail')).toContainText('Sent');
  await expect(page.locator('#dx-sub-stage-rail')).toContainText('Received');
});

test('submission detail hard load restores header/footer chrome and can route back to inbox', async ({ page }) => {
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApis(page);

  await page.goto('/entry/messages/submission/?sid=sub-001', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-submission');

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

  const backToInbox = page.locator('#dex-submission a[href="/entry/messages/"]').first();
  await Promise.all([
    page.waitForURL('**/entry/messages/**'),
    backToInbox.click(),
  ]);

  await waitReady(page, '#dex-msg');
});

test('submission detail renders timeline and excludes internal note text', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApis(page);

  await page.goto('/entry/messages/submission/?sid=sub-001', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-submission');

  await expect(page.locator('#dex-submission')).toContainText('Received and queued.');
  await expect(page.locator('#dex-submission')).not.toContainText('staff only note');
});

test('submission detail hydrates sparse payload fields from metadata and list fallbacks', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApis(page, {
    listThreads: [
      {
        submissionId: 'sub-001',
        lookup: 'SUB12-B.Pre Do A2026',
        title: 'Brass Session',
        creator: 'John Doe',
        sourceLink: '/entry/submit/',
        currentStatusRaw: 'Pending Review',
        updatedAt: '2026-02-26T09:00:00.000Z',
      },
    ],
    detailPayload: {
      thread: {
        submission_id: 'sub-001',
        lookup: '',
        title: '',
        creator: '',
        current_status_raw: '',
        source_link: '',
        library_href: '',
        updated_at: '2026-02-26T09:00:00.000Z',
      },
      timeline: [
        {
          id: 'evt-2',
          event_type: 'received',
          status_raw: 'Pending Review',
          event_at: '2026-02-26T09:00:00.000Z',
          metadata_json: JSON.stringify({
            title: 'Brass Session',
            creator: 'John Doe',
            source_link: '/entry/submit/',
            lookup: 'SUB12-B.Pre Do A2026',
          }),
        },
      ],
    },
  });

  await page.goto('/entry/messages/submission/?sid=sub-001', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-submission');

  await expect(page.locator('#dex-submission')).toContainText('Brass Session');
  await expect(page.locator('#dex-submission')).toContainText('John Doe');
  await expect(page.locator('#dex-submission')).toContainText('Pending Review');
  await expect(page.locator('#dex-submission')).toContainText('Source submission');
});

test('submission detail prefers effective/final lookup fields over legacy lookup', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApis(page, {
    listThreads: [
      {
        submissionId: 'sub-001',
        lookup: 'Sub. Legacy 12',
        submissionLookupGenerated: 'SUB12-B.Pre Do A2026',
        finalLookupBase: 'B.Pre Do A2026',
        finalLookupNumber: 'B.Pre Do A2026 C.23',
        effectiveLookupNumber: 'B.Pre Do A2026 C.23',
        title: 'Brass Session',
        creator: 'John Doe',
        currentStatusRaw: 'Pending Review',
        updatedAt: '2026-02-26T09:00:00.000Z',
      },
    ],
    detailPayload: {
      thread: {
        submission_id: 'sub-001',
        lookup: 'Sub. Legacy 12',
        submissionLookupGenerated: 'SUB12-B.Pre Do A2026',
        finalLookupBase: 'B.Pre Do A2026',
        finalLookupNumber: 'B.Pre Do A2026 C.23',
        effectiveLookupNumber: 'B.Pre Do A2026 C.23',
        title: 'Brass Session',
        creator: 'John Doe',
        current_status_raw: 'Pending Review',
        source_link: '/entry/submit/',
        updated_at: '2026-02-26T09:00:00.000Z',
      },
      timeline: [
        {
          id: 'evt-lookup',
          event_type: 'lookup_finalized',
          stage: 'reviewing',
          status_raw: 'Pending Review',
          event_at: '2026-02-26T09:00:00.000Z',
          metadata_json: JSON.stringify({
            effectiveLookupNumber: 'B.Pre Do A2026 C.23',
          }),
        },
      ],
    },
  });

  await page.goto('/entry/messages/submission/?sid=sub-001', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-submission');

  await expect(page.locator('.dx-sub-title')).toHaveText('B.Pre Do A2026 C.23');
});

test('submission detail acknowledge posts ack endpoint and updates stage rail', async ({ page }) => {
  const actionHits: string[] = [];

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApis(page, { actionHits });

  await page.goto('/entry/messages/submission/?sid=sub-001', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-submission');

  await page.click('[data-dx-sub-action="ack"]');

  await expect.poll(() => actionHits.includes('ack:sub-001')).toBe(true);
  await expect(page.locator('#dx-sub-stage-rail')).toContainText('Acknowledged');
  await expect(page.locator('[data-dx-sub-action="ack"]')).toBeDisabled();
});

test('submission detail signed-out state exits loading and shows sign-in prompt', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-out');
  await stubMessagesApis(page);

  await page.goto('/entry/messages/submission/?sid=sub-001', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-submission');

  await expect(page.locator('#dx-sub-signin')).toContainText('Please sign in');
});

test('submission detail returns safe error state for non-owner or missing sid', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page, 'signed-in');
  await stubMessagesApis(page, { detailStatus: 404 });

  await page.goto('/entry/messages/submission/?sid=sub-missing', { waitUntil: 'domcontentloaded' });
  await waitReady(page, '#dex-submission');

  await expect(page.locator('#dex-submission')).toContainText('Submission not found for this account');
});
