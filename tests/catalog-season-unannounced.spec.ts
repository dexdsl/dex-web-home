import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';

const DEFAULT_POOL = ['???', '!!!', '***', '@@@'];
const HOME_SIGNUP_CARD_IMAGE = '/assets/img/3b1476c230073f7589e3.jpg';

function hashString32(value: string): number {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

function expectedToken(seed: string, season: string, index: number, pool: string[]): string {
  const list = Array.isArray(pool) && pool.length ? pool : DEFAULT_POOL;
  const hash = hashString32(`${seed}:${String(season || '').toUpperCase()}:${index}`);
  return list[hash % list.length];
}

function readSeasonTokenPool(seasonId: string): string[] {
  const filePath = path.join(process.cwd(), 'data', 'catalog.seasons.json');
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const seasons = Array.isArray(payload?.seasons) ? payload.seasons : [];
  const season = seasons.find((row: any) => String(row?.id || '').toUpperCase() === String(seasonId || '').toUpperCase());
  const tokens = Array.isArray(season?.unannounced?.tokenPool)
    ? season.unannounced.tokenPool.map((value: unknown) => String(value || '').trim()).filter(Boolean)
    : [];
  return tokens.length ? tokens : DEFAULT_POOL;
}

async function blockExternalRequests(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const rawUrl = route.request().url();
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      await route.continue();
      return;
    }

    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
      await route.continue();
      return;
    }

    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      await route.continue();
      return;
    }

    await route.abort();
  });
}

async function setTeaserSeed(page: Page, seed: string): Promise<void> {
  await page.addInitScript(({ inputSeed }) => {
    (window as any).__DX_SEASON_TEASER_SEED = inputSeed;
  }, { inputSeed: seed });
}

async function loadCatalog(page: Page): Promise<void> {
  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-catalog-index-app]')).toBeVisible();
  await expect(page.locator('.dx-catalog-index-season-track')).toBeVisible();
}

async function selectSeasonTabIfPresent(page: Page, seasonId: string): Promise<void> {
  const tab = page.locator(`.dx-catalog-index-season-tab[data-dx-season-id="${seasonId}"]`).first();
  if (await tab.count()) {
    await tab.click();
  }
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test('season carousel renders a non-clickable unannounced teaser card with growlix token', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-teaser-a');
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S2');

  const teaserCard = page.locator('.dx-catalog-index-season-slide--unannounced').first();
  await expect(teaserCard).toBeVisible();
  await expect(teaserCard).toHaveAttribute('data-dx-season-card-kind', 'unannounced');

  const token = String(await teaserCard.getAttribute('data-dx-growlix-token') || '').trim();
  expect(token.length).toBeGreaterThan(0);
  expect(DEFAULT_POOL).toContain(token);

  await expect(teaserCard.locator('.dx-catalog-index-season-performer').first()).toHaveText(token);
  await expect(teaserCard).toContainText('this artist has not been announced yet');
  await expect(teaserCard.locator('img.dx-catalog-index-season-img').first()).toHaveAttribute('src', new RegExp(`${HOME_SIGNUP_CARD_IMAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(teaserCard.locator('.dx-catalog-index-season-growlix-token')).toHaveCount(0);
  const lockedCta = teaserCard.locator('button.dx-catalog-index-season-open').first();
  const lockedCtaText = ((await lockedCta.textContent()) || '').replace(/\u200c/g, '').trim();
  expect(lockedCtaText.toLowerCase()).toBe('view collection');
  await expect(lockedCta).toBeDisabled();
  await expect(teaserCard.locator('a')).toHaveCount(0);
});

test('teaser token is deterministic for a page-load seed and season/index pair', async ({ page, context }) => {
  const primarySeed = 'seed-catalog-primary';
  await setTeaserSeed(page, primarySeed);
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S2');

  const teaserCard = page.locator('.dx-catalog-index-season-slide--unannounced').first();
  await expect(teaserCard).toBeVisible();

  const seasonId = String(await teaserCard.getAttribute('data-dx-season-id') || 'S2').toUpperCase();
  const index = Number(await teaserCard.getAttribute('data-dx-unannounced-index') || 0);
  const tokenPool = readSeasonTokenPool(seasonId);

  const tokenOne = String(await teaserCard.getAttribute('data-dx-growlix-token') || '').trim();
  expect(tokenOne).toBe(expectedToken(primarySeed, seasonId, index, tokenPool));

  let secondarySeed = 'seed-catalog-secondary';
  let expectedSecondary = expectedToken(secondarySeed, seasonId, index, tokenPool);
  let shouldDiffer = expectedSecondary !== tokenOne;
  if (expectedSecondary === tokenOne) {
    for (let n = 3; n < 30; n += 1) {
      const candidateSeed = `seed-catalog-${n}`;
      const candidateToken = expectedToken(candidateSeed, seasonId, index, tokenPool);
      if (candidateToken !== tokenOne) {
        secondarySeed = candidateSeed;
        expectedSecondary = candidateToken;
        shouldDiffer = true;
        break;
      }
    }
  }

  const secondPage = await context.newPage();
  await blockExternalRequests(secondPage);
  await setTeaserSeed(secondPage, secondarySeed);
  await loadCatalog(secondPage);
  await selectSeasonTabIfPresent(secondPage, seasonId);

  const tokenTwo = String(await secondPage.locator('.dx-catalog-index-season-slide--unannounced').first().getAttribute('data-dx-growlix-token') || '').trim();
  expect(tokenTwo).toBe(expectedSecondary);
  if (shouldDiffer) expect(tokenTwo).not.toBe(tokenOne);

  await secondPage.close();
});

test('teaser card insertion index varies by page-load seed (not fixed to trail position)', async ({ page, context }) => {
  const firstSeed = 'seed-catalog-insert-a';
  await setTeaserSeed(page, firstSeed);
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S2');

  const firstSlides = page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide');
  const firstTotal = await firstSlides.count();
  expect(firstTotal).toBeGreaterThan(0);
  const firstTeaser = page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide--unannounced').first();
  await expect(firstTeaser).toBeVisible();
  const firstIndex = await firstTeaser.evaluate((node) => {
    const parent = node.parentElement;
    if (!parent) return -1;
    return Array.prototype.indexOf.call(parent.children, node);
  });
  expect(firstIndex).toBeGreaterThanOrEqual(0);

  let secondSeed = 'seed-catalog-insert-b';
  let secondIndex = firstIndex;
  for (let n = 0; n < 40 && secondIndex === firstIndex; n += 1) {
    secondSeed = `seed-catalog-insert-${n + 2}`;
    const probePage = await context.newPage();
    await blockExternalRequests(probePage);
    await setTeaserSeed(probePage, secondSeed);
    await loadCatalog(probePage);
    await selectSeasonTabIfPresent(probePage, 'S2');
    const probeTeaser = probePage.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide--unannounced').first();
    await expect(probeTeaser).toBeVisible();
    secondIndex = await probeTeaser.evaluate((node) => {
      const parent = node.parentElement;
      if (!parent) return -1;
      return Array.prototype.indexOf.call(parent.children, node);
    });
    await probePage.close();
  }

  expect(secondIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).not.toBe(firstIndex);
});
