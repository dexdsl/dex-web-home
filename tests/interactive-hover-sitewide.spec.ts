import { expect, test, type Locator, type Page } from 'playwright/test';

function parseMotionTokens(value: string | null): string[] {
  return String(value || '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

async function readMotionTokens(locator: Locator): Promise<string[]> {
  const raw = await locator.evaluate((node) => node.getAttribute('data-dx-motion-bound'));
  return parseMotionTokens(raw);
}

async function waitForHoverRuntime(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => typeof window.__dxInteractiveHover?.apply === 'function'))
    .toBeTruthy();
}

async function installCoarsePointerShim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);

    function makeResult(media: string, matches: boolean): MediaQueryList {
      return {
        media,
        matches,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      } as MediaQueryList;
    }

    window.matchMedia = (query: string): MediaQueryList => {
      const normalized = String(query || '').trim().toLowerCase();
      if (normalized === '(hover: hover)' || normalized === '(pointer: fine)' || normalized === '(hover: hover) and (pointer: fine)') {
        return makeResult(query, false);
      }
      if (normalized === '(hover: none)' || normalized === '(pointer: coarse)') {
        return makeResult(query, true);
      }
      return original(query);
    };
  });
}

test('desktop: magnetic hover binds buttons + semantic links and survives soft routes', async ({ page }) => {
  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForHoverRuntime(page);

  const refreshButton = page.locator('[data-dx-support-refresh]');
  const supportCardLink = page.locator('.dx-support-card-link').first();
  await expect(refreshButton).toBeVisible();
  await expect(supportCardLink).toBeVisible();

  await expect.poll(async () => readMotionTokens(refreshButton)).toContain('magnetic-button');
  await expect.poll(async () => readMotionTokens(supportCardLink)).toContain('semantic-link');

  await refreshButton.hover();
  const buttonBox = await refreshButton.boundingBox();
  if (buttonBox) {
    await page.mouse.move(buttonBox.x + buttonBox.width * 0.82, buttonBox.y + buttonBox.height * 0.24);
  }
  await expect
    .poll(() => refreshButton.evaluate((node) => window.getComputedStyle(node as HTMLElement).transform))
    .not.toBe('none');

  await supportCardLink.click();
  await expect(page).toHaveURL(/\/catalog\/?$/);
  const catalogFiltersToggle = page.locator('.dx-catalog-index-filters-toggle');
  await expect(catalogFiltersToggle).toBeVisible();
  await expect.poll(async () => readMotionTokens(catalogFiltersToggle)).toContain('magnetic-button');

  const catalogTokens = await readMotionTokens(catalogFiltersToggle);
  expect(catalogTokens.length).toBe(new Set(catalogTokens).size);
});

test('coarse pointer: runtime applies press-only bindings', async ({ page }) => {
  await installCoarsePointerShim(page);
  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForHoverRuntime(page);

  const refreshButton = page.locator('[data-dx-support-refresh]');
  const supportCardLink = page.locator('.dx-support-card-link').first();
  await expect(refreshButton).toBeVisible();
  await expect(supportCardLink).toBeVisible();

  const buttonTokens = await readMotionTokens(refreshButton);
  const linkTokens = await readMotionTokens(supportCardLink);

  expect(buttonTokens).toContain('press-only');
  expect(buttonTokens).not.toContain('magnetic-button');
  expect(linkTokens).toContain('press-only');
  expect(linkTokens).not.toContain('semantic-link');
});

test('reduced-motion: hover choreography is disabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForHoverRuntime(page);

  const refreshButton = page.locator('[data-dx-support-refresh]');
  await expect(refreshButton).toBeVisible();

  const tokens = await readMotionTokens(refreshButton);
  expect(tokens).not.toContain('magnetic-button');
  expect(tokens).not.toContain('press-only');
  expect(tokens).not.toContain('semantic-link');

  await refreshButton.hover();
  const transform = await refreshButton.evaluate((node) => window.getComputedStyle(node as HTMLElement).transform);
  expect(transform).toBe('none');
});

test('exclusion/include rules: footer tiny links excluded by default but opt-in works', async ({ page }) => {
  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await waitForHoverRuntime(page);

  const footerLink = page.locator('.footer-nav a').first();
  await expect(footerLink).toBeVisible();

  const beforeTokens = await readMotionTokens(footerLink);
  expect(beforeTokens).not.toContain('semantic-link');

  await page.evaluate(() => {
    const link = document.querySelector('.footer-nav a');
    if (!link) return;
    link.setAttribute('data-dx-motion-include', 'true');
    window.__dxInteractiveHover?.apply?.();
  });

  await expect.poll(async () => readMotionTokens(footerLink)).toContain('semantic-link');

  await page.evaluate(() => {
    const host = document.querySelector('#dx-support .dx-support-grid') || document.body;
    const link = document.createElement('a');
    link.href = '/support/';
    link.textContent = 'Excluded semantic link';
    link.className = 'dx-support-card-link';
    link.setAttribute('data-dx-motion-exclude', 'true');
    host.appendChild(link);
    window.__dxInteractiveHover?.apply?.();
  });

  const excludedLink = page.locator('a.dx-support-card-link[data-dx-motion-exclude="true"]').last();
  await expect(excludedLink).toBeVisible();
  const excludedTokens = await readMotionTokens(excludedLink);
  expect(excludedTokens).not.toContain('semantic-link');
});
