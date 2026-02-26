import { test, expect } from 'playwright/test';

test('call newsletter form uses subscribe API and shows pending confirmation state', async ({ page }) => {
  let subscribeRequests = 0;
  await page.route('**/newsletter/subscribe', async (route) => {
    subscribeRequests += 1;
    const payload = route.request().postDataJSON();
    expect(payload.email).toBe('member@example.com');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, state: 'pending_confirmation' }),
    });
  });

  await page.goto('/call/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.dx-call-newsletter-input')).toBeVisible();
  await page.fill('.dx-call-newsletter-input', 'member@example.com');
  await page.click('.dx-call-newsletter-submit');

  await expect(page.locator('.dx-call-newsletter-feedback')).toContainText(/check your email|pending confirmation/i);
  expect(subscribeRequests).toBeGreaterThan(0);
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
