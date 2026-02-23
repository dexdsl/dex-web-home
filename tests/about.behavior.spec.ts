import { expect, test } from 'playwright/test';

test('about route locks page/slot scrolling', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.waitForTimeout(200);

  const before = await page.evaluate(() => {
    const slot = document.getElementById('dx-slot-scroll-root');
    const footer = document.getElementById('footer-sections');
    return {
      windowY: window.scrollY,
      slotY: slot instanceof HTMLElement ? slot.scrollTop : null,
      htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      slotOverflowY: slot instanceof HTMLElement ? getComputedStyle(slot).overflowY : null,
      footerDisplay: footer instanceof HTMLElement ? getComputedStyle(footer).display : null,
      routeHtml: document.documentElement.getAttribute('data-dx-route'),
      routeBody: document.body.getAttribute('data-dx-route'),
      noScrollDot: document.documentElement.hasAttribute('data-no-dex-scroll'),
    };
  });

  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => {
    const slot = document.getElementById('dx-slot-scroll-root');
    return {
      windowY: window.scrollY,
      slotY: slot instanceof HTMLElement ? slot.scrollTop : null,
      htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      slotOverflowY: slot instanceof HTMLElement ? getComputedStyle(slot).overflowY : null,
    };
  });

  expect(before.routeHtml).toBe('about');
  expect(before.routeBody).toBe('about');
  expect(before.noScrollDot).toBeTruthy();
  expect(['hidden', 'clip']).toContain(before.htmlOverflowY);
  expect(['hidden', 'clip']).toContain(before.bodyOverflowY);
  if (before.slotOverflowY !== null) expect(['hidden', 'clip']).toContain(before.slotOverflowY);
  expect(before.footerDisplay).toBe('none');

  expect(after.windowY).toBe(before.windowY);
  if (before.slotY !== null && after.slotY !== null) expect(after.slotY).toBe(before.slotY);
  expect(['hidden', 'clip']).toContain(after.htmlOverflowY);
  expect(['hidden', 'clip']).toContain(after.bodyOverflowY);
  if (after.slotOverflowY !== null) expect(['hidden', 'clip']).toContain(after.slotOverflowY);
});

test('about pane switching works via tabs and arrows', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  const activePane = async () => page.evaluate(
    () => document.querySelector('#dex-about .pane[aria-hidden="false"]')?.id || null,
  );

  await expect(page.getByRole('tab', { name: 'Team' })).toBeVisible();
  await page.getByRole('tab', { name: 'Team' }).click();
  await expect.poll(activePane).toBe('pane-team');
  await expect(page.getByRole('tab', { name: 'Team' })).toHaveAttribute('aria-selected', 'true');

  await page.locator('#aboutNext').click();
  await expect.poll(activePane).toBe('pane-partners');
  await expect(page.getByRole('tab', { name: 'Partners' })).toHaveAttribute('aria-selected', 'true');

  await page.locator('#aboutPrev').click();
  await expect.poll(activePane).toBe('pane-team');
});

test('about hash routing activates the expected pane', async ({ page }) => {
  await page.goto('/about#license', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect.poll(async () => page.evaluate(
    () => document.querySelector('#dex-about .pane[aria-hidden="false"]')?.id || null,
  )).toBe('pane-license');
  await expect(page.getByRole('tab', { name: 'License' })).toHaveAttribute('aria-selected', 'true');
});

test('team modal opens and closes', async ({ page }) => {
  await page.goto('/about#team', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect.poll(async () => page.evaluate(
    () => document.querySelector('#dex-about .pane[aria-hidden="false"]')?.id || null,
  )).toBe('pane-team');

  await page.locator('#pane-team .bio-btn').first().click();
  await expect(page.locator('#teamModal')).toBeVisible();
  await expect(page.locator('#teamModalTitle')).not.toHaveText('—');

  await page.keyboard.press('Escape');
  await expect(page.locator('#teamModal')).toBeHidden();
});
