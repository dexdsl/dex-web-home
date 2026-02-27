import { expect, test, type Page, type Route } from 'playwright/test';

type GasStubOptions = {
  quotaPayload?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
  eventsByRequest?: Record<string, Array<Record<string, unknown>>>;
  appendPayload?: Record<string, unknown>;
  appendDelayMs?: number;
};

async function stubHeaderRuntimes(page: Page): Promise<void> {
  await page.route('**/assets/js/header-slot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxHeaderSlotStub = true;' });
  });

  await page.route('**/assets/js/dx-scroll-dot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxScrollDotStub = true;' });
  });
}

async function stubDexAuthRuntime(page: Page): Promise<void> {
  const script = `
    (() => {
      const user = { sub: 'auth0|pressroom-ui-e2e', name: 'Alex Tester', family_name: 'Tester', email: 'press@example.com' };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: true }),
        resolve: () => Promise.resolve({ authenticated: true }),
        requireAuth: () => Promise.resolve({ status: 'authenticated' }),
        isAuthenticated: () => Promise.resolve(true),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve('stub-access-token'),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0 = { getUser: () => Promise.resolve(user) };
      window.AUTH0_USER = user;
      window.auth0Sub = user.sub;
    })();
  `;

  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: script });
  });
}

async function fulfillJsonp(route: Route, payload: unknown): Promise<void> {
  const requestUrl = new URL(route.request().url());
  const callback = String(requestUrl.searchParams.get('callback') || '').trim();
  if (!callback) {
    await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `${callback}(${JSON.stringify(payload)});`,
  });
}

async function stubPressroomGas(page: Page, options: GasStubOptions = {}): Promise<{ getLastAppend: () => Record<string, string> | null }> {
  const rows = Array.isArray(options.rows) ? [...options.rows] : [];
  const eventsByRequest = options.eventsByRequest || {};
  let lastAppend: Record<string, string> | null = null;

  await page.route('https://script.google.com/macros/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const action = String(requestUrl.searchParams.get('action') || '').toLowerCase();

    if (action === 'quota') {
      await fulfillJsonp(route, {
        status: 'ok',
        monthlyLimit: 1,
        monthlyUsed: 0,
        monthlyRemaining: 1,
        monthStart: '2026-02-01T00:00:00.000Z',
        monthEnd: '2026-03-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        ...(options.quotaPayload || {}),
      });
      return;
    }

    if (action === 'list') {
      await fulfillJsonp(route, { status: 'ok', rows });
      return;
    }

    if (action === 'events_for_request') {
      const requestId = String(requestUrl.searchParams.get('requestId') || '').trim();
      await fulfillJsonp(route, {
        status: 'ok',
        events: eventsByRequest[requestId] || [],
      });
      return;
    }

    if (action === 'append') {
      if (options.appendDelayMs && options.appendDelayMs > 0) {
        await page.waitForTimeout(options.appendDelayMs);
      }
      lastAppend = Object.fromEntries(requestUrl.searchParams.entries());
      const payload = {
        status: 'ok',
        row: rows.length + 2,
        requestId: 'req-press-01',
        ...(options.appendPayload || {}),
      };
      rows.unshift({
        row: rows.length + 2,
        requestId: String(payload.requestId || ''),
        status: 'submitted',
        timestamp: new Date().toISOString(),
        project: String(lastAppend.project || 'Untitled request'),
        name: String(lastAppend.name || ''),
        email: String(lastAppend.email || ''),
        links: String(lastAppend.links || ''),
        budget: String(lastAppend.budget || ''),
        timeline: String(lastAppend.timeline || ''),
        timeframe: String(lastAppend.timeframe || ''),
      });
      await fulfillJsonp(route, payload);
      return;
    }

    await fulfillJsonp(route, { status: 'error', message: `Unhandled action: ${action || 'none'}` });
  });

  return {
    getLastAppend: () => lastAppend,
  };
}

async function waitReady(page: Page): Promise<void> {
  const root = page.locator('#dex-press');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

function stageHost(page: Page, step: string) {
  return page.locator(`.dx-press-stage-host[data-dx-press-step="${step}"]`);
}

async function completeWizardToReview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Begin request' }).click();
  await expect(stageHost(page, 'contact')).toBeVisible();

  await page.locator('.dx-press-field', { hasText: 'Contact name' }).locator('input').fill('Alex Tester');
  await page.locator('.dx-press-field', { hasText: 'Contact email' }).locator('input').fill('alex@example.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(stageHost(page, 'project')).toBeVisible();
  await page.locator('.dx-press-field', { hasText: 'Project title' }).locator('input').fill('Pressroom V2 Launch Story');
  await page.locator('.dx-press-field', { hasText: 'Project description' }).locator('textarea').fill('Coverage request for release and lifecycle improvements.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(stageHost(page, 'details')).toBeVisible();
  await page.locator('.dx-press-field', { hasText: 'Source links' }).locator('input').fill('https://example.com/media');
  await page.locator('.dx-press-field', { hasText: 'Budget (USD)' }).locator('input').fill('2500');
  await page.locator('.dx-press-field', { hasText: 'Timeline' }).locator('input').fill('Draft in two weeks');
  await page.locator('.dx-press-field', { hasText: 'Timeframe' }).locator('input').fill('March 2026');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(stageHost(page, 'review')).toBeVisible();
}

test('pressroom route mounts modern shell and removes legacy inline implementation', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubPressroomGas(page);

  await page.goto('/entry/pressroom/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('[data-dx-press-shell]')).toBeVisible();
  await expect(page.locator('[data-dx-press-history]')).toBeVisible();
  await expect(page.locator('[data-dx-press-timeline]')).toBeVisible();

  const html = await page.content();
  expect(html).not.toContain('window.pressCallback');
  expect(html).not.toContain('Press Room Submission (glassmorphic wizard)');
});

test('pressroom renders desktop 60/40 split with sticky command panel', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 1200, 'desktop-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubPressroomGas(page);

  await page.goto('/entry/pressroom/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const layout = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-press-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-press-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-press-command') as HTMLElement | null;
    if (!shell || !main || !command) return null;

    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    const commandStyle = window.getComputedStyle(command);

    return {
      mainWidth: Math.round(mainRect.width),
      commandWidth: Math.round(commandRect.width),
      commandLeft: Math.round(commandRect.left),
      mainRight: Math.round(mainRect.right),
      commandPosition: commandStyle.position,
    };
  });

  expect(layout).not.toBeNull();
  if (!layout) return;

  expect(layout.commandPosition).toBe('sticky');
  expect(layout.mainWidth).toBeGreaterThan(layout.commandWidth);
  expect(layout.commandLeft).toBeGreaterThan(layout.mainRight - 4);
});

test('pressroom collapses to mobile single-column with readable controls', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 500, 'mobile-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubPressroomGas(page);

  await page.goto('/entry/pressroom/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await page.getByRole('button', { name: 'Begin request' }).click();
  await expect(stageHost(page, 'contact')).toBeVisible();

  const mobile = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-press-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-press-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-press-command') as HTMLElement | null;
    const input = document.querySelector('.dx-press-input') as HTMLElement | null;
    if (!shell || !main || !command || !input) return null;

    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    const inputSize = Number.parseFloat(window.getComputedStyle(input).fontSize || '0');

    return {
      commandTop: Math.round(commandRect.top),
      mainBottom: Math.round(mainRect.bottom),
      inputSize,
    };
  });

  expect(mobile).not.toBeNull();
  if (!mobile) return;
  expect(mobile.commandTop).toBeGreaterThanOrEqual(mobile.mainBottom - 2);
  expect(mobile.inputSize).toBeGreaterThanOrEqual(16);
});

test('pressroom disables begin when monthly quota is exhausted', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubPressroomGas(page, {
    quotaPayload: {
      monthlyLimit: 1,
      monthlyUsed: 1,
      monthlyRemaining: 0,
    },
  });

  await page.goto('/entry/pressroom/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const begin = page.getByRole('button', { name: 'Begin request' });
  await expect(begin).toBeDisabled();
  await expect(page.locator('#dex-press')).toContainText('Monthly request limit reached');
});

test('pressroom enforces lock -> sheen -> done on successful submit', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  const gas = await stubPressroomGas(page, {
    appendDelayMs: 180,
    appendPayload: {
      requestId: 'req-press-99',
      row: 99,
    },
    eventsByRequest: {
      'req-press-99': [
        {
          eventId: 'evt-1',
          requestId: 'req-press-99',
          eventType: 'submitted',
          eventTimestamp: '2026-02-27T02:00:00.000Z',
          sourceEventKey: 'req-press-99:submitted',
        },
      ],
    },
  });

  await page.goto('/entry/pressroom/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await completeWizardToReview(page);

  const submit = page.getByRole('button', { name: 'Submit request' });
  await submit.click();

  await expect.poll(async () => page.locator('#dex-press').getAttribute('data-dx-press-submitting')).toBe('true');
  await expect(stageHost(page, 'done')).toBeVisible();
  await expect(stageHost(page, 'done')).toContainText('Request ID: req-press-99');
  await expect(page.getByRole('link', { name: 'Open inbox' })).toHaveAttribute('href', '/entry/messages/');
  await expect(page.getByRole('button', { name: 'Start another request' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open this timeline' })).toHaveAttribute(
    'href',
    /\/entry\/messages\/submission\/\?kind=pressroom&rid=req-press-99/,
  );
  await expect(page.getByRole('button', { name: 'View lifecycle' })).toHaveCount(0);

  const appended = gas.getLastAppend();
  expect(appended).not.toBeNull();
  expect(appended?.project).toBe('Pressroom V2 Launch Story');
  expect(appended?.timeframe).toBe('March 2026');
});

test('pressroom submission failure is loud and remains on review', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubPressroomGas(page, {
    appendPayload: {
      status: 'error',
      code: 'monthly_limit_reached',
      message: 'Monthly request limit reached',
    },
  });

  await page.goto('/entry/pressroom/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await completeWizardToReview(page);
  await page.getByRole('button', { name: 'Submit request' }).click();

  await expect(stageHost(page, 'review')).toBeVisible();
  await expect(stageHost(page, 'review')).toContainText('Monthly request limit reached');
  await expect(stageHost(page, 'review')).toContainText('Action required');
});

test('pressroom timeline dedupes duplicate events by sourceEventKey', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubPressroomGas(page, {
    rows: [
      {
        row: 4,
        requestId: 'req-dedupe-01',
        status: 'triage',
        timestamp: '2026-02-27T03:30:00.000Z',
        project: 'Dedupe Verification Story',
      },
    ],
    eventsByRequest: {
      'req-dedupe-01': [
        {
          eventId: 'evt-1',
          requestId: 'req-dedupe-01',
          eventType: 'submitted',
          eventTimestamp: '2026-02-27T03:00:00.000Z',
          sourceEventKey: 'req-dedupe-01:submitted',
        },
        {
          eventId: 'evt-2',
          requestId: 'req-dedupe-01',
          eventType: 'submitted',
          eventTimestamp: '2026-02-27T03:00:00.000Z',
          sourceEventKey: 'req-dedupe-01:submitted',
        },
        {
          eventId: 'evt-3',
          requestId: 'req-dedupe-01',
          eventType: 'triage',
          eventTimestamp: '2026-02-27T04:00:00.000Z',
          sourceEventKey: 'req-dedupe-01:triage',
        },
      ],
    },
  });

  await page.goto('/entry/pressroom/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('.dx-press-history-item', { hasText: 'Dedupe Verification Story' })).toBeVisible();
  await expect.poll(async () => page.locator('.dx-press-event-card').count()).toBe(2);
});
