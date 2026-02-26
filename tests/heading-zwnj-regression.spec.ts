import { expect, test, type Page } from 'playwright/test';

const SEEDED_HEADING_KEY = 'dx-zwnj-seed-2';
const LIGATURE_DUPLICATE_SUPPORTED = new Set(Array.from('ABCDEFGHJKLMNOPQRSTUWZ'));

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

function findInsertedCharacters(canonical: string, renderedWithoutZwnj: string): string[] {
  const base = Array.from(canonical);
  const rendered = Array.from(renderedWithoutZwnj);
  const inserted: string[] = [];

  let baseIndex = 0;
  let renderedIndex = 0;
  while (baseIndex < base.length && renderedIndex < rendered.length) {
    if (base[baseIndex] === rendered[renderedIndex]) {
      baseIndex += 1;
      renderedIndex += 1;
      continue;
    }
    inserted.push(rendered[renderedIndex]);
    renderedIndex += 1;
  }

  while (renderedIndex < rendered.length) {
    inserted.push(rendered[renderedIndex]);
    renderedIndex += 1;
  }

  return inserted;
}

function hasSingleLetterDuplicateInWord(rendered: string, word: string): boolean {
  const upperRendered = String(rendered || '').toUpperCase();
  const upperWord = String(word || '').toUpperCase();
  if (!upperWord.length) return false;

  const chars = Array.from(upperWord);
  for (let index = 0; index < chars.length; index += 1) {
    const variant = `${chars.slice(0, index + 1).join('')}${chars[index]}${chars.slice(index + 1).join('')}`;
    if (upperRendered.includes(variant)) return true;
  }
  return false;
}

function hasTripleRepeatedLetter(value: string): boolean {
  const source = stripZwnj(value);
  const chars = Array.from(source);
  for (let index = 0; index < chars.length - 2; index += 1) {
    const a = chars[index];
    const b = chars[index + 1];
    const c = chars[index + 2];
    if (!a || !b || !c) continue;
    const aAlpha = a.toLowerCase() !== a.toUpperCase();
    const bAlpha = b.toLowerCase() !== b.toUpperCase();
    const cAlpha = c.toLowerCase() !== c.toUpperCase();
    if (!aAlpha || !bAlpha || !cAlpha) continue;
    if (a.toLowerCase() === b.toLowerCase() && b.toLowerCase() === c.toLowerCase()) return true;
  }
  return false;
}

function assertHeadingTypographyInvariants(heading: { canonical: string; rendered: string; text: string }): void {
  expect(heading.canonical.length).toBeGreaterThan(0);
  expect(heading.rendered.length).toBeGreaterThan(0);
  expect(heading.rendered).toBe(heading.text);

  const renderedWithoutZwnj = stripZwnj(heading.rendered);
  const inserted = findInsertedCharacters(heading.canonical, renderedWithoutZwnj);
  const expectedZwnjCount = countCanonicalDoubleLetters(heading.canonical) + inserted.length;
  expect(countZwnj(heading.rendered)).toBe(expectedZwnjCount);
  expect(inserted.length).toBeLessThanOrEqual(1);
  if (inserted.length > 0) {
    const firstUpper = inserted[0]!.toUpperCase();
    expect(inserted.every((char) => char.toUpperCase() === firstUpper)).toBeTruthy();
    expect(LIGATURE_DUPLICATE_SUPPORTED.has(firstUpper)).toBeTruthy();
    expect(new RegExp(`${firstUpper}\\u200c${firstUpper}`, 'i').test(heading.rendered)).toBeTruthy();
  }
}

async function readHeadingBySelector(page: Page, selector: string) {
  return page.locator(selector).evaluate((node) => {
    const element = node as HTMLElement;
    return {
      text: element.textContent || '',
      canonical: element.getAttribute('data-dx-heading-canonical') || '',
      rendered: element.getAttribute('data-dx-heading-rendered') || '',
    };
  });
}

async function collectDonateLabels(page: Page) {
  return page.locator('a[data-dx-donate-normalized="true"]').evaluateAll((nodes) => nodes.map((node) => {
    const anchor = node as HTMLAnchorElement;
    return {
      href: anchor.getAttribute('href') || '',
      text: anchor.textContent || '',
      canonical: anchor.getAttribute('data-dx-donate-canonical') || '',
      rendered: anchor.getAttribute('data-dx-donate-rendered') || '',
    };
  }));
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
    assertHeadingTypographyInvariants(heading);

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
  const errorRenderedText = errorRendered || '';
  const errorInserted = findInsertedCharacters(errorCanonical || '', stripZwnj(errorRenderedText));
  expect(countZwnj(errorRenderedText)).toBe(countCanonicalDoubleLetters(errorCanonical || '') + errorInserted.length);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#featuredTitle').getAttribute('data-dx-heading-canonical')).toBeTruthy();

  const duplicateLigatureLetters = await page.evaluate(
    () => (window as unknown as { __dxHeadingFx?: { duplicateLigatureLetters?: string } }).__dxHeadingFx?.duplicateLigatureLetters || '',
  );
  expect(duplicateLigatureLetters).toBe('ABCDEFGHJKLMNOPQRSTUWZ');

  const featuredTitle = await readHeadingBySelector(page, '#featuredTitle');
  assertHeadingTypographyInvariants(featuredTitle);
  expect(featuredTitle.canonical.toUpperCase()).toBe('FEATURED ENTRIES');

  const heroTitle = await readHeadingBySelector(page, '#dexHeroCard h1');
  expect(heroTitle.canonical.length).toBeGreaterThan(0);
  expect(heroTitle.rendered.length).toBeGreaterThan(0);
  const heroInserted = findInsertedCharacters(heroTitle.canonical, stripZwnj(heroTitle.rendered));
  expect(countZwnj(heroTitle.rendered)).toBe(countCanonicalDoubleLetters(heroTitle.canonical) + heroInserted.length);
  expect(heroTitle.canonical.toUpperCase()).toContain('RECORDING');
  expect(hasSingleLetterDuplicateInWord(stripZwnj(heroTitle.rendered), 'RECORDING')).toBeFalsy();

  const donateLabels = await collectDonateLabels(page);
  expect(donateLabels.length).toBeGreaterThan(0);
  for (const donate of donateLabels) {
    expect(String(donate.href || '')).toContain('/donate');
    expect(donate.canonical).toBe('DONATE');
    expect(donate.rendered).toBe(donate.text);
    const renderedWithoutZwnj = stripZwnj(donate.rendered);
    const inserted = findInsertedCharacters(donate.canonical, renderedWithoutZwnj);
    expect(countZwnj(donate.rendered)).toBe(countCanonicalDoubleLetters(donate.canonical) + inserted.length);
    expect(inserted.length).toBeLessThanOrEqual(1);
    if (inserted.length > 0) {
      const firstUpper = inserted[0]!.toUpperCase();
      expect(inserted.every((char) => char.toUpperCase() === firstUpper)).toBeTruthy();
      expect(LIGATURE_DUPLICATE_SUPPORTED.has(firstUpper)).toBeTruthy();
      expect(new RegExp(`${firstUpper}\\u200c${firstUpper}`, 'i').test(donate.rendered)).toBeTruthy();
    }
  }

  const signupTitle = await readHeadingBySelector(page, '#dex-signup .signup-heading');
  assertHeadingTypographyInvariants(signupTitle);
  expect(signupTitle.canonical.toUpperCase()).toBe('SIGN-UP FOR FREE ACCESS');

  const faqTitle = await readHeadingBySelector(page, '#dex-faq-head');
  assertHeadingTypographyInvariants(faqTitle);
  expect(faqTitle.canonical.toUpperCase()).toBe('FREQUENTLY ASKED QUESTIONS');

  await page.goto('/board/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dexb-title').getAttribute('data-dx-heading-canonical')).toBeTruthy();

  const boardTitle = await readHeadingBySelector(page, '#dexb-title');
  assertHeadingTypographyInvariants(boardTitle);
  expect(boardTitle.canonical.toUpperCase()).toBe('FOUNDING EXPANSION BOARD');

  const boardOverview = await readHeadingBySelector(page, '#p1-overview');
  assertHeadingTypographyInvariants(boardOverview);
  expect(boardOverview.canonical.toUpperCase()).toBe('OVERVIEW');

  await page.goto('/entry/settings/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dexs-title').getAttribute('data-dx-heading-canonical')).toBeTruthy();

  const settingsTitle = await readHeadingBySelector(page, '#dexs-title');
  assertHeadingTypographyInvariants(settingsTitle);
  expect(settingsTitle.canonical.toUpperCase()).toBe('SETTINGS');
  expect(stripZwnj(settingsTitle.rendered)).toBe(settingsTitle.canonical);
  expect(hasTripleRepeatedLetter(settingsTitle.rendered)).toBeFalsy();
});
