import { expect, test } from 'playwright/test';

async function getScrollOffsets(page) {
  return page.evaluate(() => {
    const slot = document.getElementById('dx-slot-scroll-root');
    return {
      windowY: window.scrollY,
      slotY: slot instanceof HTMLElement ? slot.scrollTop : null,
    };
  });
}

function didScroll(before, after) {
  if (after.windowY > before.windowY + 1) return true;
  if (before.slotY !== null && after.slotY !== null && after.slotY > before.slotY + 1) return true;
  return false;
}

test('dexdrones renders canonical long-scroll shell and launch sections', async ({ page }) => {
  await page.goto('/dexdrones', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect(page.locator('[data-dx-dexdrones-app] .dx-dexdrones-editorial')).toBeVisible();
  await expect(page.locator('#dexdrones-hero')).toBeVisible();
  await expect(page.locator('#dexdrones-hero .dx-dexdrones-home-title')).toBeVisible();
  await expect(page.locator('#dexdrones-hero .dx-dexdrones-cta[href="/donate/"]')).toHaveText(/SUPPORT dexDRONES/i);
  await expect(page.locator('#dexdrones-hero .dx-dexdrones-cta[href="/dexnotes/dexdrones-launch-announcement-2026-03-09/"]')).toHaveText(/READ THE ANNOUNCEMENT/i);
  await expect.poll(async () => page.evaluate(() => {
    const hero = document.getElementById('dexdrones-hero');
    return hero instanceof HTMLElement && !hero.closest('.dx-dexdrones-shell');
  })).toBeTruthy();
  await expect(page.locator('#dexdrones-press .dx-dexdrones-press-link')).toHaveCount(3);
  await expect(page.locator('#footer-sections')).toBeVisible();

  const legacyState = await page.evaluate(() => ({
    hasLegacyPane: Boolean(document.querySelector('[id^="pane-"]')),
    hasLegacyPill: Boolean(document.querySelector('.pill[data-pane]')),
    hasCallMount: Boolean(document.querySelector('[data-call-editorial-app]')),
    hasAboutMount: Boolean(document.querySelector('[data-dx-about-app]')),
  }));

  expect(legacyState.hasLegacyPane).toBeFalsy();
  expect(legacyState.hasLegacyPill).toBeFalsy();
  expect(legacyState.hasCallMount).toBeFalsy();
  expect(legacyState.hasAboutMount).toBeFalsy();
});

test('dexdrones desktop section rail is sticky and active state changes while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto('/dexdrones', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect(page.locator('.dx-dexdrones-progress-wrap')).toBeVisible();

  const activeHref = async () => page.evaluate(() =>
    document.querySelector('.dx-dexdrones-progress-link.is-active')?.getAttribute('href') || null);

  await expect.poll(activeHref).toBe('#dexdrones-hero');

  await page.evaluate(() => {
    const target = document.getElementById('dexdrones-partners');
    if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
  await page.waitForTimeout(250);

  await expect.poll(async () => {
    const href = await activeHref();
    return href === '#dexdrones-partners' || href === '#dexdrones-participate';
  }).toBeTruthy();

  await page.locator('.dx-dexdrones-progress-link[href="#dexdrones-support"]').click();
  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#dexdrones-support');
});

test('dexdrones route scrolls and footer remains reachable', async ({ page }) => {
  await page.goto('/dexdrones', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.waitForTimeout(120);

  const before = await getScrollOffsets(page);
  await page.evaluate(() => {
    const slot = document.getElementById('dx-slot-scroll-root');
    if (slot instanceof HTMLElement && slot.scrollHeight > slot.clientHeight) {
      slot.scrollTop += 1400;
      return;
    }
    window.scrollBy({ top: 1400, left: 0, behavior: 'auto' });
  });
  await page.waitForTimeout(120);
  const after = await getScrollOffsets(page);
  expect(didScroll(before, after)).toBeTruthy();

  await page.evaluate(() => {
    const slot = document.getElementById('dx-slot-scroll-root');
    if (slot instanceof HTMLElement && slot.scrollHeight > slot.clientHeight) {
      slot.scrollTop = slot.scrollHeight;
      return;
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  });
  await page.waitForTimeout(220);

  const footerVisible = await page.evaluate(() => {
    const footer = document.getElementById('footer-sections');
    if (!(footer instanceof HTMLElement)) return false;
    const rect = footer.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });

  expect(footerVisible).toBeTruthy();
});

test('dexdrones deep links and legacy hash aliases resolve to canonical sections', async ({ page }) => {
  await page.goto('/dexdrones#dexdrones-kolari', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#dexdrones-kolari');

  await expect.poll(
    async () =>
      page.evaluate(() => {
        const section = document.getElementById('dexdrones-kolari');
        if (!(section instanceof HTMLElement)) return false;
        const rect = section.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      }),
    { timeout: 4000 },
  ).toBeTruthy();

  await page.goto('/dexdrones#partners', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#dexdrones-partners');

  await page.goto('/dexdrones#support', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#dexdrones-support');
});

test('dexdrones section rail degrades on tablet/mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto('/dexdrones', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect(page.locator('[data-dx-dexdrones-app] .dx-dexdrones-shell')).toBeVisible();

  const railDisplay = await page.evaluate(() => {
    const rail = document.querySelector('.dx-dexdrones-progress-wrap');
    if (!(rail instanceof HTMLElement)) return null;
    return getComputedStyle(rail).display;
  });

  expect(railDisplay).toBe('none');
});
