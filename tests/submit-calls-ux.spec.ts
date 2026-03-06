import { expect, test, type Page } from 'playwright/test';

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
      const user = { sub: 'auth0|submit-call-e2e', name: 'Call Submitter', family_name: 'Submitter', email: 'submit-call@example.com' };
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

async function waitReady(page: Page): Promise<void> {
  const root = page.locator('#dex-submit');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

async function stubCallsRegistry(page: Page): Promise<void> {
  await page.route('**/data/calls.registry.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 'calls-registry-v1',
        updatedAt: '2026-03-05T00:00:00.000Z',
        sequenceGroup: 'inDex',
        activeCallId: 'in-dex-a-2026-9',
        calls: [
          {
            id: 'in-dex-a-2026-9',
            status: 'active',
            lane: 'in-dex-a',
            year: 2026,
            sequence: 9,
            cycleCode: 'A2026.9',
            cycleLabel: 'IN DEX A2026.9',
            title: 'Test Active A lane',
          },
        ],
      }),
    });
  });
}

async function completeLicenseStep(page: Page, signature = 'Call Submitter'): Promise<void> {
  const step = page.locator('[data-dx-submit-step="license"]');
  await expect(step).toBeVisible();
  await step.locator('[data-dx-submit-license-signature]').fill(signature);

  const licenseAccept = step.locator('[data-dx-submit-license-accept]');
  if (!(await licenseAccept.isChecked())) {
    await licenseAccept.check();
  }

  const rightsAck = step.locator('[data-dx-submit-rights-ack]');
  if (!(await rightsAck.isChecked())) {
    await rightsAck.check();
  }
}

test('call deep link boots call flow and submits via quota_call + submit_call actions', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubCallsRegistry(page);

  const seenActions: string[] = [];
  let submitParams: Record<string, string> | null = null;

  await page.route('https://script.google.com/macros/**', async (route) => {
    const url = new URL(route.request().url());
    const action = String(url.searchParams.get('action') || '').toLowerCase();
    const callback = String(url.searchParams.get('callback') || '').trim();
    seenActions.push(action);

    if (!callback) {
      await route.fulfill({ status: 400, contentType: 'text/plain', body: 'Missing callback' });
      return;
    }

    if (action === 'quota_call') {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `${callback}(${JSON.stringify({ status: 'ok', weeklyLimit: 2, weeklyUsed: 0, weeklyRemaining: 2 })});`,
      });
      return;
    }

    if (action === 'submit_call') {
      submitParams = Object.fromEntries(url.searchParams.entries());
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `${callback}(${JSON.stringify({ status: 'ok', row: 88, submissionId: 'sub_call_88', weeklyLimit: 2, weeklyUsed: 1, weeklyRemaining: 1, submissionKind: 'call' })});`,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}(${JSON.stringify({ status: 'ok' })});`,
    });
  });

  await page.goto('/entry/submit/?flow=call&lane=in-dex-a&subcall=b&cycle=IN%20DEX%20A2026.9&via=call', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#dex-submit')).toHaveAttribute('data-dx-submit-flow', 'call');
  await expect(page.locator('#dex-submit')).toHaveAttribute('data-dx-submit-lane', 'in-dex-a');
  await expect(page.locator('#dex-submit')).toContainText('Begin call submission');

  await page.getByRole('button', { name: 'Begin call submission' }).click();
  await expect(page.locator('[data-dx-submit-step="metadata"]')).toBeVisible();

  const meta = page.locator('[data-dx-submit-step="metadata"]');
  await meta.locator('.dx-submit-field', { hasText: 'Proposal title' }).locator('input').fill('IN DEX A call proposal');
  await meta.locator('.dx-submit-field', { hasText: 'Proposer / creator' }).locator('input').fill('Call Submitter');
  await meta.locator('.dx-submit-field', { hasText: 'Subcall' }).locator('select').selectOption('b');
  await meta.locator('.dx-submit-field', { hasText: 'Proposal format' }).locator('select').selectOption('act');

  await page.getByRole('button', { name: 'Continue to license' }).click();
  await completeLicenseStep(page, 'Call Submitter');
  await page.getByRole('button', { name: 'Continue to upload' }).click();

  const upload = page.locator('[data-dx-submit-step="upload"]');
  await upload.locator('.dx-submit-field', { hasText: 'Public materials link' }).locator('input').fill('https://drive.google.com/mock-call-source');
  await upload.locator('.dx-submit-field', { hasText: 'Notes for Dex team' }).locator('textarea').fill('call note');
  await page.getByRole('button', { name: 'Submit call' }).click();

  await expect(page.locator('[data-dx-submit-step="done"]')).toContainText('Call submission received');

  expect(seenActions).toContain('quota_call');
  expect(seenActions).toContain('submit_call');
  expect(seenActions).not.toContain('quota');
  expect(seenActions).not.toContain('submit');

  expect(submitParams).not.toBeNull();
  if (!submitParams) return;
  expect(submitParams.action).toBe('submit_call');
  expect(submitParams.callLane).toBe('in-dex-a');
  expect(submitParams.callSubcall).toBe('b');
  expect(submitParams.callCycle).toBe('IN DEX A2026.9');
  expect(submitParams.sourceType).toBe('call');
  expect(submitParams.submissionKind).toBe('call');
  expect(submitParams.licenseAccepted).toBe('yes');
  expect(submitParams.rightsAcknowledged).toBe('yes');
});
