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

test('about renders canonical long-scroll shell and newsletter mount', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect(page.locator('[data-dx-about-app] .dx-about-editorial')).toBeVisible();
  await expect(page.locator('#about-contact [data-dx-marketing-newsletter-mount]')).toHaveAttribute(
    'data-dx-marketing-newsletter-mount',
    'about-support-page',
  );
  await expect(page.locator('#footer-sections')).toBeVisible();

  const legacyState = await page.evaluate(() => ({
    hasPrev: Boolean(document.getElementById('aboutPrev')),
    hasNext: Boolean(document.getElementById('aboutNext')),
    hasLegacyPane: Boolean(document.querySelector('[id^="pane-"]')),
    hasLegacyPill: Boolean(document.querySelector('.pill[data-pane]')),
    hasTeamModal: Boolean(document.getElementById('teamModal')),
  }));

  expect(legacyState.hasPrev).toBeFalsy();
  expect(legacyState.hasNext).toBeFalsy();
  expect(legacyState.hasLegacyPane).toBeFalsy();
  expect(legacyState.hasLegacyPill).toBeFalsy();
  expect(legacyState.hasTeamModal).toBeFalsy();
});

test('about desktop section rail is sticky and active state changes while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect(page.locator('.dx-about-progress-wrap')).toBeVisible();

  const activeHref = async () => page.evaluate(() =>
    document.querySelector('.dx-about-progress-link.is-active')?.getAttribute('href') || null);

  await expect.poll(activeHref).toBe('#about-hero');

  await page.evaluate(() => {
    const target = document.getElementById('about-partners');
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  });
  await page.waitForTimeout(240);

  await expect.poll(activeHref).not.toBe('#about-hero');

  await page.locator('.dx-about-progress-link[href="#about-team"]').click();
  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#about-team');
});

test('about route scrolls and footer remains reachable', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
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

test('about deep links and legacy hash aliases resolve to canonical sections', async ({ page }) => {
  await page.goto('/about#about-team', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#about-team');

  await expect.poll(
    async () =>
      page.evaluate(() => {
        const section = document.getElementById('about-team');
        if (!(section instanceof HTMLElement)) return false;
        const rect = section.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      }),
    { timeout: 4000 },
  ).toBeTruthy();

  await page.goto('/about#team', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#about-team');

  await page.goto('/about#license', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe('#about-contact');
});

test('about section rail degrades on tablet/mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  const railDisplay = await page.evaluate(() => {
    const rail = document.querySelector('.dx-about-progress-wrap');
    if (!(rail instanceof HTMLElement)) return null;
    return getComputedStyle(rail).display;
  });

  expect(railDisplay).toBe('none');
});
