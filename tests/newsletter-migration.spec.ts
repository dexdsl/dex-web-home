import { test, expect, type Page } from 'playwright/test';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function seedTurnstile(
  page: Page,
  { token = 'challenge-token', fail = false }: { token?: string; fail?: boolean } = {},
) {
  await page.addInitScript(({ token: initToken, fail: shouldFail }) => {
    const globalAny = window as any;
    globalAny.DEX_NEWSLETTER_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    globalAny.DEX_MARKETING_NEWSLETTER = Object.assign({}, globalAny.DEX_MARKETING_NEWSLETTER || {}, {
      source: 'call-page',
      turnstileAction: 'newsletter_subscribe',
      turnstileSiteKey: '1x00000000000000000000AA',
      requireChallenge: true,
    });

    let options: Record<string, unknown> | null = null;
    globalAny.turnstile = {
      render: (_container: Element, nextOptions: Record<string, unknown>) => {
        options = nextOptions || {};
        return 'dx-test-widget';
      },
      execute: () => {
        if (!options) return;
        if (shouldFail) {
          const errorCallback = options['error-callback'];
          if (typeof errorCallback === 'function') errorCallback('forced-failure');
          return;
        }
        const callback = options.callback;
        if (typeof callback === 'function') callback(initToken);
      },
      reset: () => {},
    };
  }, { token, fail });
}

test('call newsletter form submits secure payload with idempotency header', async ({ page }) => {
  await seedTurnstile(page);

  let subscribeRequests = 0;
  let capturedPayload: Record<string, unknown> | null = null;
  let capturedIdempotency = '';

  await page.route('**/newsletter/subscribe', async (route) => {
    subscribeRequests += 1;
    capturedPayload = route.request().postDataJSON() as Record<string, unknown>;
    capturedIdempotency = String(route.request().headers()['x-dx-idempotency-key'] || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, state: 'pending_confirmation', requestId: 'req_test_1' }),
    });
  });

  await page.goto('/call/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.dx-call-newsletter-input')).toBeVisible();
  await page.waitForTimeout(1300);
  await page.fill('.dx-call-newsletter-input', 'member@example.com');
  await page.click('.dx-call-newsletter-submit');

  await expect(page.locator('.dx-call-newsletter-feedback')).toContainText(/request received/i);
  expect(subscribeRequests).toBeGreaterThan(0);
  expect(capturedPayload).toBeTruthy();
  expect(capturedPayload?.email).toBe('member@example.com');
  expect(capturedPayload?.source).toBe('call-page');
  expect(capturedPayload?.challengeToken).toBe('challenge-token');
  expect(capturedPayload?.honey).toBe('');
  expect(typeof capturedPayload?.submittedAt).toBe('number');
  expect(Number(capturedPayload?.submittedAt || 0)).toBeGreaterThan(0);
  expect(String(capturedPayload?.clientRequestId || '')).toMatch(UUID_RE);
  expect(capturedPayload?.context).toBeTruthy();
  expect(String((capturedPayload?.context as any)?.pagePath || '')).toContain('/call');
  expect(capturedIdempotency).toMatch(UUID_RE);
});

test('existing subscriber response stays neutral and does not enumerate', async ({ page }) => {
  await seedTurnstile(page);

  await page.route('**/newsletter/subscribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, state: 'active', requestId: 'req_test_2' }),
    });
  });

  await page.goto('/call/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.fill('.dx-call-newsletter-input', 'member@example.com');
  await page.click('.dx-call-newsletter-submit');

  const feedback = page.locator('.dx-call-newsletter-feedback');
  await expect(feedback).toContainText(/request received/i);
  await expect(feedback).not.toContainText(/already subscribed/i);
});

test('challenge failures are deterministic and block submission', async ({ page }) => {
  await seedTurnstile(page, { fail: true });

  let subscribeRequests = 0;
  await page.route('**/newsletter/subscribe', async (route) => {
    subscribeRequests += 1;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    });
  });

  await page.goto('/call/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.fill('.dx-call-newsletter-input', 'member@example.com');
  await page.click('.dx-call-newsletter-submit');

  await expect(page.locator('.dx-call-newsletter-feedback')).toContainText(/challenge check failed/i);
  expect(subscribeRequests).toBe(0);
});

test('rate-limit responses show retry messaging and local cooldown', async ({ page }) => {
  await seedTurnstile(page);

  let subscribeRequests = 0;
  await page.route('**/newsletter/subscribe', async (route) => {
    subscribeRequests += 1;
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        code: 'RATE_LIMIT',
        requestId: 'req_limit_1',
        retryAfterSeconds: 37,
      }),
    });
  });

  await page.goto('/call/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.fill('.dx-call-newsletter-input', 'member@example.com');
  await page.click('.dx-call-newsletter-submit');

  await expect(page.locator('.dx-call-newsletter-feedback')).toContainText(/try again in 37 seconds/i);
  expect(subscribeRequests).toBe(1);

  await page.click('.dx-call-newsletter-submit');
  await expect(page.locator('.dx-call-newsletter-feedback')).toContainText(/too many attempts/i);
  expect(subscribeRequests).toBe(1);
});

test('newsletter confirm route handles success and failure deterministically', async ({ page }) => {
  await page.route('**/newsletter/confirm', async (route) => {
    const payload = route.request().postDataJSON();
    if (payload.token === 'ok-token') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, state: 'active' }),
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Invalid or expired token' }),
    });
  });

  await page.goto('/newsletter/confirm/?token=ok-token', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#dx-newsletter-confirm')).toContainText(/subscription confirmed|active/i);

  await page.goto('/newsletter/confirm/?token=bad-token', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#dx-newsletter-confirm')).toContainText(/invalid|expired|failed/i);
});

test('newsletter unsubscribe route handles success and failure deterministically', async ({ page }) => {
  await page.route('**/newsletter/unsubscribe', async (route) => {
    const payload = route.request().postDataJSON();
    if (payload.token === 'ok-token') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, state: 'unsubscribed' }),
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Invalid or expired token' }),
    });
  });

  await page.goto('/newsletter/unsubscribe/?token=ok-token', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#dx-newsletter-unsubscribe')).toContainText(/unsubscribed|removed/i);

  await page.goto('/newsletter/unsubscribe/?token=bad-token', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#dx-newsletter-unsubscribe')).toContainText(/invalid|expired|failed/i);
});

test('legacy chimpstatic embeds are removed from public routes', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('script[src*="chimpstatic.com"]')).toHaveCount(0);

  await page.goto('/favorites/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('script[src*="chimpstatic.com"]')).toHaveCount(0);
});
