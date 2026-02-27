import { expect, test, type Page } from 'playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

const GENERATED_LOOKUP_REGEX = /^SUB\d{2}-[A-Z]\.[A-Za-z]{3}\s+[A-Za-z][A-Za-z\-']*\s+(?:A|V|AV|O)\d{4}$/;

async function stubHeaderRuntimes(page: Page): Promise<void> {
  await page.route('**/assets/js/header-slot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxHeaderSlotStub = true;' });
  });

  await page.route('**/assets/js/dx-scroll-dot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxScrollDotStub = true;' });
  });
}

async function stubDexAuthRuntime(page: Page): Promise<void> {
  const script = `
    (() => {
      const user = { sub: 'auth0|submit-ui-e2e', name: 'Seb Solis', family_name: 'Solis', email: 'submit@example.com' };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: true }),
        resolve: () => Promise.resolve({ authenticated: true }),
        requireAuth: () => Promise.resolve({ status: 'authenticated' }),
        isAuthenticated: () => Promise.resolve(true),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve('stub-access-token'),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0 = { getUser: () => Promise.resolve(user) };
      window.AUTH0_USER = user;
      window.auth0Sub = user.sub;
    })();
  `;

  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: script });
  });
}

async function stubApiBaseline(page: Page): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    if (route.request().method().toUpperCase() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function waitReady(page: Page): Promise<void> {
  const root = page.locator('#dex-submit');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

async function waitBeginReady(page: Page) {
  const begin = page.getByRole('button', { name: 'Begin' });
  await expect(begin).toBeVisible();
  await expect.poll(async () => begin.isDisabled()).toBe(false);
  return begin;
}

type PitchSystemValue = '12-tet' | '24-tet' | 'ji' | 'atonal' | 'non-pitched';

type PitchSubmitScenario = {
  pitchSystem: PitchSystemValue;
  descriptor?: string;
  expectedKeyCenter: string;
};

async function submitSampleWithPitch(page: Page, scenario: PitchSubmitScenario): Promise<Record<string, string>> {
  let submitParams: Record<string, string> | null = null;

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    const callback = String(url.searchParams.get('callback') || '').trim();
    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }
    if (action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `${callback}(${JSON.stringify({
          status: 'ok',
          rows: [
            { timestamp: new Date().toISOString(), row: 2 },
            { timestamp: '2025-01-01T00:00:00.000Z', row: 3 },
          ],
        })});`,
      });
      return;
    }
    submitParams = Object.fromEntries(url.searchParams.entries());
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', row: 77 })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const begin = await waitBeginReady(page);
  await begin.click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();

  const step = page.locator('[data-dx-submit-step="metadata"]');
  await step.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill('Pitch Scenario Sample');
  await step.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill('Pitch Scenario Artist');
  await step.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption('B - Brass');
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Trombone');
  await step.locator('.dx-submit-badge', { hasText: 'A - Audio' }).click();

  await step.locator('.dx-submit-field', { hasText: 'Pitch system' }).locator('select').selectOption(scenario.pitchSystem);

  if (scenario.pitchSystem === '12-tet' || scenario.pitchSystem === '24-tet') {
    await step.locator('.dx-submit-field', { hasText: 'Pitch root' }).locator('select').selectOption(scenario.descriptor || 'C');
  } else if (scenario.pitchSystem === 'ji') {
    await step.locator('.dx-submit-field', { hasText: 'JI pitch descriptor' }).locator('input').fill(scenario.descriptor || '');
  }

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await expect(page.locator('[data-dx-submit-step="license"]')).toBeVisible();

  await page.getByRole('button', { name: 'Continue to upload' }).click();
  await expect(page.locator('[data-dx-submit-step="upload"]')).toBeVisible();
  const uploadStep = page.locator('[data-dx-submit-step="upload"]');
  await uploadStep.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input').fill('https://drive.google.com/mock-source');
  await uploadStep.locator('.dx-submit-field', { hasText: 'Notes for Dex team' }).locator('textarea').fill('pitch serialization regression');
  await page.getByRole('button', { name: /Submit sample/i }).click();
  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();

  expect(submitParams).not.toBeNull();
  if (!submitParams) {
    return {};
  }
  return submitParams;
}

test('submit page uses desktop 60/40 shell with sticky command panel', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 1200, 'desktop-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await expect(page.locator('#dex-submit')).toContainText('Weekly uploads available');
  await expect(page.locator('#dex-submit')).not.toContainText('Daily uploads available');

  const layout = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-submit-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-submit-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-submit-command') as HTMLElement | null;
    if (!shell || !main || !command) {
      return null;
    }

    const shellRect = shell.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    const commandStyle = window.getComputedStyle(command);

    return {
      shellWidth: Math.round(shellRect.width),
      mainWidth: Math.round(mainRect.width),
      commandWidth: Math.round(commandRect.width),
      topDelta: Math.abs(Math.round(mainRect.top - commandRect.top)),
      commandLeft: Math.round(commandRect.left),
      mainRight: Math.round(mainRect.right),
      commandPosition: commandStyle.position,
    };
  });

  expect(layout).not.toBeNull();
  if (!layout) return;

  expect(layout.commandPosition).toBe('sticky');
  expect(layout.topDelta).toBeLessThan(80);
  expect(layout.commandLeft).toBeGreaterThan(layout.mainRight - 4);
  expect(layout.mainWidth).toBeGreaterThan(layout.commandWidth);
});

test('submit page collapses to single-column on mobile with readable field text', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 500, 'mobile-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const stack = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-submit-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-submit-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-submit-command') as HTMLElement | null;
    if (!shell || !main || !command) return null;

    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    return {
      commandTop: Math.round(commandRect.top),
      mainBottom: Math.round(mainRect.bottom),
      verticalGap: Math.round(commandRect.top - mainRect.bottom),
    };
  });

  expect(stack).not.toBeNull();
  if (!stack) return;
  expect(stack.commandTop).toBeGreaterThanOrEqual(stack.mainBottom - 2);
  expect(stack.verticalGap).toBeGreaterThanOrEqual(-2);

  const begin = await waitBeginReady(page);
  await begin.click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();

  const fontSize = await page.evaluate(() => {
    const input = document.querySelector('[data-dx-submit-step="metadata"] .dx-submit-input') as HTMLElement | null;
    if (!input) return 0;
    return Number.parseFloat(window.getComputedStyle(input).fontSize || '0');
  });
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test('submit wizard enforces required fields and keeps payload key contract on submit', async ({ page }) => {
  let submitParams: Record<string, string> | null = null;

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    const callback = String(url.searchParams.get('callback') || '').trim();

    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }
    if (action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `${callback}(${JSON.stringify({
          status: 'ok',
          rows: [{ timestamp: new Date().toISOString(), row: 11 }],
        })});`,
      });
      return;
    }
    submitParams = Object.fromEntries(url.searchParams.entries());

    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', row: 42 })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const begin = await waitBeginReady(page);
  await begin.click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();
  await expect(page.locator('.dx-submit-toast--error').last()).toContainText('Missing');

  const step = page.locator('[data-dx-submit-step="metadata"]');
  await step.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill('Submission Title E2E');
  await step.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill('Jane Doe');
  await step.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption('B - Brass');
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Trombone');
  await step.locator('.dx-submit-field', { hasText: 'Pitch system' }).locator('select').selectOption('12-tet');
  await step.locator('.dx-submit-field', { hasText: 'Pitch root' }).locator('select').selectOption('C♯/D♭');
  await step.locator('.dx-submit-badge', { hasText: 'A - Audio' }).click();

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await expect(page.locator('[data-dx-submit-step="license"]')).toBeVisible();

  await page.getByRole('button', { name: 'Continue to upload' }).click();
  await expect(page.locator('[data-dx-submit-step="upload"]')).toBeVisible();

  const uploadStep = page.locator('[data-dx-submit-step="upload"]');
  await uploadStep.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input').fill('https://drive.google.com/mock-source');
  await uploadStep.locator('.dx-submit-field', { hasText: 'Notes for Dex team' }).locator('textarea').fill('submission note for review');

  await page.getByRole('button', { name: /Submit sample/i }).click();

  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();
  await expect(page.locator('#dex-submit')).toContainText('Submission received');

  expect(submitParams).not.toBeNull();
  if (!submitParams) return;

  const keys = Object.keys(submitParams);
  expect(keys).toEqual(
    expect.arrayContaining([
      'callback',
      'auth0Sub',
      'title',
      'creator',
      'category',
      'instrument',
      'bpm',
      'pitchSystem',
      'pitchDescriptor',
      'keyCenter',
      'scaleQuality',
      'tags',
      'collectionType',
      'outputTypes',
      'services',
      'license',
      'link',
      'notes',
      'submissionYear',
      'performerToken',
      'submissionLookupNumber',
      'finalLookupNumber',
      'status',
    ]),
  );

  expect(submitParams.status).toBe('pending');
  expect(submitParams.auth0Sub).toBe('auth0|submit-ui-e2e');
  expect(submitParams.performerToken).toBe('So');
  expect(submitParams.submissionLookupNumber).toMatch(GENERATED_LOOKUP_REGEX);
  expect(submitParams.finalLookupNumber).toBe('');
  expect(submitParams.pitchSystem).toBe('12-tet');
  expect(submitParams.pitchDescriptor).toBe('C♯/D♭');
  expect(submitParams.keyCenter).toBe('12-TET: C♯/D♭');
  expect(submitParams.collectionType).toBe('A');
  expect(submitParams.link).toBe('https://drive.google.com/mock-source');

  const lookupText = String(await page.locator('[data-dx-submit-step="done"] .dx-submit-pill--accent').first().textContent() || '').trim();
  expect(lookupText).toMatch(GENERATED_LOOKUP_REGEX);
});

test('submit services chips use custom tooltip contract and sidebar guidance follows focused field', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);
  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    const callback = String(url.searchParams.get('callback') || '').trim();
    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }
    if (action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `${callback}(${JSON.stringify({ status: 'ok', rows: [] })});`,
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', row: 99 })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const begin = await waitBeginReady(page);
  await begin.click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();
  const step = page.locator('[data-dx-submit-step="metadata"]');
  await step.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill('Tooltip focus sample');
  await step.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill('Creator Placeholder');
  await step.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption('B - Brass');
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Trombone');
  await step.locator('.dx-submit-badge', { hasText: 'A - Audio' }).click();
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').focus();
  await expect(page.locator('.dx-submit-command')).toContainText('Instrument guidance');

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await page.getByRole('button', { name: 'Continue to upload' }).click();
  await expect(page.locator('[data-dx-submit-step="upload"]')).toBeVisible();

  const serviceChip = page.locator('[data-dx-submit-step="upload"] .dx-submit-badge', { hasText: 'Color grading' }).first();
  await expect(serviceChip).toHaveAttribute('data-dx-tooltip', /color/i);
  await expect(serviceChip).not.toHaveAttribute('title', /.+/);
  await serviceChip.hover();

  const tooltip = page.locator('#dx-submit-tooltip-layer');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Shot-to-shot color balancing');

  const tooltipMeta = await page.evaluate(() => {
    const layer = document.getElementById('dx-submit-tooltip-layer');
    if (!(layer instanceof HTMLElement)) return null;
    const style = window.getComputedStyle(layer);
    return {
      parentTag: layer.parentElement?.tagName || '',
      position: style.position,
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });
  expect(tooltipMeta).not.toBeNull();
  if (!tooltipMeta) return;
  expect(tooltipMeta.parentTag).toBe('BODY');
  expect(tooltipMeta.position).toBe('fixed');
  expect(tooltipMeta.backgroundColor).not.toBe('rgba(9, 14, 27, 0.95)');

  const hasZwnj = await page.evaluate(() => {
    const command = document.querySelector('.dx-submit-command');
    return !!command && command.textContent.includes('\u200C');
  });
  expect(hasZwnj).toBeTruthy();
});

test('submit quota JSONP timeout never throws late callback reference errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.message || error));
  });

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);
  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    const callback = String(url.searchParams.get('callback') || '').trim();
    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }

    if (action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `setTimeout(function(){ if (typeof ${callback} === 'function') { ${callback}(${JSON.stringify({ status: 'ok', rows: [] })}); } }, 12000);`,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', row: 100 })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  const begin = await waitBeginReady(page);
  await begin.click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();
  const step = page.locator('[data-dx-submit-step="metadata"]');
  await step.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill('Late JSONP callback');
  await step.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill('No Reference Error');
  await step.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption('B - Brass');
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Trombone');
  await step.locator('.dx-submit-badge', { hasText: 'A - Audio' }).click();

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await page.getByRole('button', { name: 'Continue to upload' }).click();
  const uploadStep = page.locator('[data-dx-submit-step="upload"]');
  await uploadStep.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input').fill('https://drive.google.com/mock-source');
  await page.getByRole('button', { name: /Submit sample/i }).click();

  await expect(page.locator('.dx-submit-toast--error').last()).toContainText('Could not verify weekly quota');
  await page.waitForTimeout(12300);

  const refErrors = pageErrors.filter(
    (message) => message.includes('dxSubmitJsonp_') && message.includes('is not defined'),
  );
  expect(refErrors).toHaveLength(0);
});

const PITCH_SERIALIZATION_SCENARIOS: Array<PitchSubmitScenario & { name: string }> = [
  {
    name: '24-TET root',
    pitchSystem: '24-tet',
    descriptor: 'C quarter-sharp',
    expectedKeyCenter: '24-TET: C quarter-sharp',
  },
  {
    name: 'JI descriptor',
    pitchSystem: 'ji',
    descriptor: '5/4 on C',
    expectedKeyCenter: 'JI: 5/4 on C',
  },
  {
    name: 'Atonal quick path',
    pitchSystem: 'atonal',
    expectedKeyCenter: 'Atonal',
  },
  {
    name: 'Non-pitched quick path',
    pitchSystem: 'non-pitched',
    expectedKeyCenter: 'Non-pitched',
  },
];

for (const scenario of PITCH_SERIALIZATION_SCENARIOS) {
  test(`submit serializes ${scenario.name} into canonical keyCenter`, async ({ page }) => {
    const params = await submitSampleWithPitch(page, scenario);
    expect(params.pitchSystem).toBe(scenario.pitchSystem);
    expect(params.pitchDescriptor || '').toBe(scenario.descriptor || '');
    expect(params.keyCenter).toBe(scenario.expectedKeyCenter);
  });
}

test('submit intro locks Begin when weekly quota is exhausted for the signed-in user', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    const callback = String(url.searchParams.get('callback') || '').trim();
    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }
    if (action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `${callback}(${JSON.stringify({
          status: 'ok',
          rows: [],
          weeklyLimit: 4,
          weeklyUsed: 4,
          weeklyRemaining: 0,
        })});`,
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok', row: 101 })});`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#dex-submit')).toContainText('Weekly uploads available: 0 / 4');
  const begin = page.getByRole('button', { name: 'Begin' });
  await expect(begin).toBeDisabled();
  await expect(page.locator('[data-dx-submit-step="intro"]')).toBeVisible();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toHaveCount(0);
});

test('submit flow locks controls, shows fetching sheen, then proceeds to done', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    const callback = String(url.searchParams.get('callback') || '').trim();
    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }
    if (action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `${callback}(${JSON.stringify({
          status: 'ok',
          rows: [],
          weeklyLimit: 4,
          weeklyUsed: 0,
          weeklyRemaining: 4,
        })});`,
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `setTimeout(function(){ if (typeof ${callback} === 'function') { ${callback}(${JSON.stringify({ status: 'ok', row: 122 })}); } }, 700);`,
    });
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const begin = await waitBeginReady(page);
  await begin.click();

  const metaStep = page.locator('[data-dx-submit-step="metadata"]');
  await expect(metaStep).toBeVisible();
  await metaStep.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill('Submit lock sequence');
  await metaStep.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill('Queue Lock');
  await metaStep.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption('B - Brass');
  await metaStep.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Trombone');
  await metaStep.locator('.dx-submit-badge', { hasText: 'A - Audio' }).click();

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await page.getByRole('button', { name: 'Continue to upload' }).click();
  const uploadStep = page.locator('[data-dx-submit-step="upload"]');
  await expect(uploadStep).toBeVisible();
  await uploadStep.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input').fill('https://drive.google.com/sequence-source');

  await uploadStep.getByRole('button', { name: /Submit sample/i }).click();

  const root = page.locator('#dex-submit');
  await expect(root).toHaveAttribute('data-dx-submit-submitting', 'true');
  await expect(uploadStep.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input')).toBeDisabled();
  await expect(uploadStep.getByRole('button', { name: 'Back' })).toBeDisabled();
  await expect(uploadStep.getByRole('button', { name: /Submitting/i })).toBeDisabled();

  const sheenState = await page.evaluate(() => {
    const root = document.getElementById('dex-submit');
    const main = root?.querySelector('.dx-submit-main');
    if (!(root instanceof HTMLElement) || !(main instanceof HTMLElement)) return null;
    const pseudo = window.getComputedStyle(main, '::after');
    return {
      submitting: root.getAttribute('data-dx-submit-submitting') || '',
      pseudoContent: pseudo.content,
      animationName: pseudo.animationName || '',
    };
  });
  expect(sheenState).not.toBeNull();
  if (!sheenState) return;
  expect(sheenState.submitting).toBe('true');
  expect(sheenState.pseudoContent).not.toBe('none');
  expect(sheenState.animationName).toContain('dx-submit-fetch-sheen');

  await page.waitForTimeout(150);
  await expect(page.locator('[data-dx-submit-step="done"]')).toHaveCount(0);
  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();
  await expect(root).not.toHaveAttribute('data-dx-submit-submitting', 'true');
});

test('submit hard-load uses standard footer geometry and icon sprite', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 980, 'desktop-only assertion');

  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('.header-announcement-bar-wrapper').first()).toBeVisible();
  await expect(page.locator('.dex-footer').first()).toBeVisible();
  await expect(page.locator('svg[data-usage="social-icons-svg"] symbol#youtube-unauth-icon')).toHaveCount(1);

  const footerMetrics = await page.evaluate(() => {
    const footer = document.querySelector('.dex-footer') as HTMLElement | null;
    if (!footer) return null;
    const rect = footer.getBoundingClientRect();
    const logoWidths = Array.from(footer.querySelectorAll('.footer-logo img'))
      .map((node) => (node as HTMLElement).getBoundingClientRect().width)
      .filter((value) => Number.isFinite(value));
    return {
      height: Math.round(rect.height),
      maxLogoWidth: Math.round(logoWidths.length ? Math.max(...logoWidths) : 0),
    };
  });

  expect(footerMetrics).not.toBeNull();
  if (!footerMetrics) return;
  expect(footerMetrics.height).toBeGreaterThan(72);
  expect(footerMetrics.height).toBeLessThan(320);
  expect(footerMetrics.maxLogoWidth).toBeLessThan(220);
});
