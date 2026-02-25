import { test, expect } from 'playwright/test';

test('protected route hard refresh shows auth guard fallback when redirect is loop-blocked', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('dex.auth.guard.redirect', JSON.stringify({
      path: '/entry/settings',
      ts: Date.now(),
    }));
    (window as unknown as { __dxAuthGuardEvents?: Array<Record<string, unknown>> }).__dxAuthGuardEvents = [];
    window.addEventListener('dex-auth:guard', (event: Event) => {
      const custom = event as CustomEvent;
      const list = (window as unknown as { __dxAuthGuardEvents?: Array<Record<string, unknown>> }).__dxAuthGuardEvents;
      if (Array.isArray(list)) {
        list.push((custom.detail || {}) as Record<string, unknown>);
      }
    });
  });

  await page.goto('/entry/settings/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect
    .poll(async () => page.evaluate(() => !!document.getElementById('dx-settings-auth-fallback')), { timeout: 10_000 })
    .toBe(true);

  const guardStatuses = await page.evaluate(() => {
    const events = (window as unknown as { __dxAuthGuardEvents?: Array<{ status?: string }> }).__dxAuthGuardEvents || [];
    return events.map((item) => String(item?.status || ''));
  });

  expect(guardStatuses.includes('blocked') || guardStatuses.includes('redirecting')).toBeTruthy();
});

test('non-protected route does not force auth guard redirect on load', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __dxAuthGuardEvents?: Array<Record<string, unknown>> }).__dxAuthGuardEvents = [];
    window.addEventListener('dex-auth:guard', (event: Event) => {
      const custom = event as CustomEvent;
      const list = (window as unknown as { __dxAuthGuardEvents?: Array<Record<string, unknown>> }).__dxAuthGuardEvents;
      if (Array.isArray(list)) {
        list.push((custom.detail || {}) as Record<string, unknown>);
      }
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  const guardCount = await page.evaluate(() => {
    const events = (window as unknown as { __dxAuthGuardEvents?: unknown[] }).__dxAuthGuardEvents || [];
    return events.length;
  });
  expect(guardCount).toBe(0);
});
