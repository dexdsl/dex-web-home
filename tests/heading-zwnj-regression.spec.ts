import { expect, test, type Page } from 'playwright/test';

const SEEDED_HEADING_KEY = 'dx-zwnj-seed-2';

const LIVE_STATUS_FIXTURE = {
  generatedAt: '2026-02-26T00:00:00.000Z',
  overall: {
    state: 'operational',
    message: 'No incidents reported yet.',
  },
  components: [
    {
      id: 'web',
      name: 'Web App',
      state: 'operational',
      uptime: { h24: 100, d7: null, d30: null },
      latencyMs: 144,
      updatedAt: '2026-02-26T00:00:00.000Z',
    },
  ],
  incidents: [],
};

function stripZwnj(value: string): string {
  return String(value || '').replace(/\u200c/g, '');
}

function countCanonicalDoubleLetters(value: string): number {
  const source = stripZwnj(value);
  const chars = Array.from(source);
  let count = 0;
  for (let index = 0; index < chars.length - 1; index += 1) {
    const current = chars[index];
    const next = chars[index + 1];
    if (!current || !next) continue;
    const currentIsLetter = current.toLowerCase() !== current.toUpperCase();
    const nextIsLetter = next.toLowerCase() !== next.toUpperCase();
    if (!currentIsLetter || !nextIsLetter) continue;
    if (current.toLowerCase() !== next.toLowerCase()) continue;
    count += 1;
  }
  return count;
}

function countZwnj(value: string): number {
  return (String(value || '').match(/\u200c/g) || []).length;
}

async function seedHeadingRuntime(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    (window as unknown as { __DX_HEADING_RANDOM_SEED?: string }).__DX_HEADING_RANDOM_SEED = seed;
  }, SEEDED_HEADING_KEY);
}

async function stubAuthRuntime(page: Page): Promise<void> {
  const authScript = `
    (() => {
      const auth = {
        ready: Promise.resolve({ isAuthenticated: false }),
        resolve: () => Promise.resolve({ authenticated: false }),
        isAuthenticated: () => Promise.resolve(false),
        getUser: () => Promise.resolve(null),
        signIn: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0Sub = '';
      window.AUTH0_USER = null;
    })();
  `;

  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: authScript,
    });
  });
}

async function stubStatusEndpoints(page: Page): Promise<void> {
  await page.route('**/data/status.live.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LIVE_STATUS_FIXTURE),
    });
  });
}

async function collectHeadingMetadata(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) => nodes
    .map((node) => {
      const element = node as HTMLElement;
      const canonical = element.getAttribute('data-dx-heading-canonical') || '';
      const rendered = element.getAttribute('data-dx-heading-rendered') || '';
      const text = element.textContent || '';
      return {
        tagName: element.tagName.toLowerCase(),
        text,
        canonical,
        rendered,
      };
    })
    .filter((row) => row.text.trim().length > 0));
}

test('support and error headings preserve canonical ZWNJ rules with seeded probabilistic duplicates', async ({ page }) => {
  await seedHeadingRuntime(page);
  await stubAuthRuntime(page);
  await stubStatusEndpoints(page);

  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dx-support').getAttribute('data-dx-fetch-state')).toBe('ready');

  const supportHeadings = await collectHeadingMetadata(page, '#dx-support h1, #dx-support h2');
  expect(supportHeadings.length).toBeGreaterThan(0);

  let changedCount = 0;
  let unchangedCount = 0;
  for (const heading of supportHeadings) {
    expect(heading.canonical.length).toBeGreaterThan(0);
    expect(heading.rendered.length).toBeGreaterThan(0);
    expect(heading.rendered).toBe(heading.text);
    expect(countZwnj(heading.rendered)).toBe(countCanonicalDoubleLetters(heading.canonical));

    if (stripZwnj(heading.rendered) === heading.canonical) unchangedCount += 1;
    else changedCount += 1;
  }

  expect(changedCount).toBeGreaterThan(0);
  expect(unchangedCount).toBeGreaterThan(0);

  const shellPadding = await page.evaluate(() => {
    const shell = document.querySelector('.dx-support-shell');
    if (!(shell instanceof HTMLElement)) return null;
    const styles = window.getComputedStyle(shell);
    return {
      top: Number.parseFloat(styles.paddingTop || '0'),
      bottom: Number.parseFloat(styles.paddingBottom || '0'),
    };
  });
  expect(shellPadding).not.toBeNull();
  expect(shellPadding!.bottom).toBeGreaterThan(shellPadding!.top);

  await page.goto('/error/?code=500', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dx-error').getAttribute('data-dx-fetch-state')).toBe('ready');

  const errorHeading = page.locator('#dx-error-title');
  await expect(errorHeading).toBeVisible();

  const errorCanonical = await errorHeading.getAttribute('data-dx-heading-canonical');
  const errorRendered = await errorHeading.getAttribute('data-dx-heading-rendered');
  const errorText = (await errorHeading.textContent()) || '';

  expect(errorCanonical).toBeTruthy();
  expect(errorRendered).toBeTruthy();
  expect(errorRendered).toBe(errorText);
  expect(countZwnj(errorRendered || '')).toBe(countCanonicalDoubleLetters(errorCanonical || ''));
});
