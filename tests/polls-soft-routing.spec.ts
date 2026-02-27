import { expect, test } from 'playwright/test';

type PollFixture = {
  id: string;
  question: string;
  options: string[];
  closeAt: string;
  status: 'open' | 'closed';
  total: number;
  counts: number[];
};

const openPoll: PollFixture = {
  id: 'poll-2026-season-focus',
  question: 'Which catalog focus should Dex prioritize for Spring 2026?',
  options: ['Prepared strings', 'Extended winds', 'Hybrid electroacoustic', 'Percussion systems'],
  closeAt: '2026-03-20T17:00:00.000Z',
  status: 'open',
  total: 3,
  counts: [1, 2, 0, 0],
};

const closedPoll: PollFixture = {
  id: 'poll-2025-archive-priority',
  question: 'Which archive family should be expanded first?',
  options: ['Live multitracks', 'Contact mic studies', 'No-input mixer sessions', 'Prepared keyboard sessions'],
  closeAt: '2026-01-05T17:00:00.000Z',
  status: 'closed',
  total: 4,
  counts: [0, 1, 2, 1],
};

test('polls soft routing keeps URL and rendered route synchronized', async ({ page }) => {
  await page.addInitScript((fixture: { open: PollFixture; closed: PollFixture }) => {
    const apiFallbackBase = 'https://dex-api.spring-fog-8edd.workers.dev';
    const pollsById: Record<string, PollFixture> = {
      [fixture.open.id]: fixture.open,
      [fixture.closed.id]: fixture.closed,
    };
    const openPolls = [fixture.open];
    const closedPolls = [fixture.closed];

    const originalFetch = window.fetch.bind(window);

    function buildJsonResponse(payload: unknown, status = 200): Response {
      return new Response(JSON.stringify(payload), {
        status,
        headers: {
          'content-type': 'application/json',
        },
      });
    }

    function resolveApiBaseUrl(): URL {
      const rawBase = String(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || apiFallbackBase).trim();
      return new URL(rawBase, window.location.href);
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = input instanceof Request ? input : new Request(input, init);
      const requestUrl = new URL(request.url, window.location.href);
      const method = String(request.method || init?.method || 'GET').toUpperCase();

      const apiBase = resolveApiBaseUrl();
      const apiBasePath = apiBase.pathname.replace(/\/$/, '');
      const pollsPrefix = `${apiBasePath}/polls`;

      const isPollApiRequest = requestUrl.origin === apiBase.origin && requestUrl.pathname.startsWith(pollsPrefix);
      if (!isPollApiRequest) {
        return originalFetch(input, init);
      }

      if (method !== 'GET') {
        return buildJsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
      }

      const endpoint = requestUrl.pathname.slice(pollsPrefix.length);

      if (!endpoint) {
        const state = String(requestUrl.searchParams.get('state') || '').toLowerCase();
        if (state === 'closed') {
          return buildJsonResponse({
            polls: closedPolls,
            page: 1,
            pages: 1,
            total: closedPolls.length,
          });
        }
        return buildJsonResponse({
          polls: openPolls,
          page: 1,
          pages: 1,
          total: openPolls.length,
        });
      }

      const detailMatch = endpoint.match(/^\/([^/]+)$/);
      if (detailMatch) {
        const pollId = decodeURIComponent(detailMatch[1]);
        const poll = pollsById[pollId];
        if (!poll) return buildJsonResponse({ error: 'NOT_FOUND' }, 404);
        return buildJsonResponse({ poll });
      }

      const resultsMatch = endpoint.match(/^\/([^/]+)\/results$/);
      if (resultsMatch) {
        const pollId = decodeURIComponent(resultsMatch[1]);
        const poll = pollsById[pollId];
        if (!poll) return buildJsonResponse({ error: 'NOT_FOUND' }, 404);
        return buildJsonResponse({
          results: {
            total: poll.total,
            counts: poll.counts,
            viewerVote: null,
            closed: poll.status === 'closed',
          },
        });
      }

      return buildJsonResponse({ error: 'NOT_FOUND' }, 404);
    };
  }, { open: openPoll, closed: closedPoll });

  const pollsRoot = page.locator('[data-dx-polls-app]');
  const expectPollsReady = async () => {
    await expect.poll(async () => pollsRoot.getAttribute('data-dx-fetch-state')).toBe('ready');
  };

  await page.goto('/polls/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await expectPollsReady();
  await expect(page).toHaveURL(/\/polls\/?$/);
  await expect(pollsRoot.getByRole('heading', { level: 1, name: 'Dex Polls' })).toBeVisible();

  await pollsRoot
    .locator('article.dx-poll-card', { hasText: openPoll.question })
    .getByRole('link', { name: 'View Poll' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/polls/${openPoll.id}/?$`));
  await expectPollsReady();
  await expect(pollsRoot.getByRole('heading', { level: 1, name: openPoll.question })).toBeVisible();

  await pollsRoot.getByRole('link', { name: 'Back to polls' }).click();
  await expect(page).toHaveURL(/\/polls\/?$/);
  await expectPollsReady();
  await expect(pollsRoot.getByRole('heading', { level: 1, name: 'Dex Polls' })).toBeVisible();

  await pollsRoot
    .locator('article.dx-poll-card', { hasText: closedPoll.question })
    .getByRole('link', { name: 'View Poll' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/polls/${closedPoll.id}/?$`));
  await expectPollsReady();
  await expect(pollsRoot.getByRole('heading', { level: 1, name: closedPoll.question })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/polls\/?$/);
  await expectPollsReady();
  await expect(pollsRoot.getByRole('heading', { level: 1, name: 'Dex Polls' })).toBeVisible();
});

test('polls list renders before slow auth snapshot resolves', async ({ page }) => {
  await page.addInitScript((fixture: { open: PollFixture; closed: PollFixture }) => {
    const apiFallbackBase = 'https://dex-api.spring-fog-8edd.workers.dev';
    const pollsById: Record<string, PollFixture> = {
      [fixture.open.id]: fixture.open,
      [fixture.closed.id]: fixture.closed,
    };
    const openPolls = [fixture.open];
    const closedPolls = [fixture.closed];
    const originalFetch = window.fetch.bind(window);
    let slowAuthResolved = false;
    const slowReady = new Promise<{ isAuthenticated: true }>((resolve) => {
      setTimeout(() => {
        slowAuthResolved = true;
        resolve({ isAuthenticated: true });
      }, 3200);
    });
    const user = { sub: 'auth0|polls-slow-auth', family_name: 'Solis', name: 'Slow Polls User' };
    const auth = {
      ready: slowReady,
      resolve: () => slowReady,
      isAuthenticated: () => Promise.resolve(true),
      getAccessToken: () => Promise.resolve('slow-polls-token'),
      getUser: () => Promise.resolve(user),
      signIn: () => Promise.resolve(),
    };
    (window as any).DEX_AUTH = auth;
    (window as any).dexAuth = auth;
    (window as any).__dxSlowAuthResolved = () => slowAuthResolved;

    function buildJsonResponse(payload: unknown, status = 200): Response {
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }

    function resolveApiBaseUrl(): URL {
      const rawBase = String((window as any).DEX_API_BASE_URL || (window as any).DEX_API_ORIGIN || apiFallbackBase).trim();
      return new URL(rawBase, window.location.href);
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = input instanceof Request ? input : new Request(input, init);
      const requestUrl = new URL(request.url, window.location.href);
      const method = String(request.method || init?.method || 'GET').toUpperCase();
      const apiBase = resolveApiBaseUrl();
      const apiBasePath = apiBase.pathname.replace(/\/$/, '');
      const pollsPrefix = `${apiBasePath}/polls`;
      const isPollApiRequest = requestUrl.origin === apiBase.origin && requestUrl.pathname.startsWith(pollsPrefix);
      if (!isPollApiRequest) return originalFetch(input, init);
      if (method !== 'GET') return buildJsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

      const endpoint = requestUrl.pathname.slice(pollsPrefix.length);
      if (!endpoint) {
        const state = String(requestUrl.searchParams.get('state') || '').toLowerCase();
        if (state === 'closed') {
          return buildJsonResponse({ polls: closedPolls, page: 1, pages: 1, total: closedPolls.length });
        }
        return buildJsonResponse({ polls: openPolls, page: 1, pages: 1, total: openPolls.length });
      }
      const detailMatch = endpoint.match(/^\/([^/]+)$/);
      if (detailMatch) {
        const pollId = decodeURIComponent(detailMatch[1]);
        const poll = pollsById[pollId];
        if (!poll) return buildJsonResponse({ error: 'NOT_FOUND' }, 404);
        return buildJsonResponse({ poll });
      }
      const resultsMatch = endpoint.match(/^\/([^/]+)\/results$/);
      if (resultsMatch) {
        const pollId = decodeURIComponent(resultsMatch[1]);
        const poll = pollsById[pollId];
        if (!poll) return buildJsonResponse({ error: 'NOT_FOUND' }, 404);
        return buildJsonResponse({
          results: { total: poll.total, counts: poll.counts, viewerVote: null, closed: poll.status === 'closed' },
        });
      }
      return buildJsonResponse({ error: 'NOT_FOUND' }, 404);
    };
  }, { open: openPoll, closed: closedPoll });

  const start = Date.now();
  await page.goto('/polls/', { waitUntil: 'domcontentloaded' });
  const pollsRoot = page.locator('[data-dx-polls-app]');
  await expect.poll(async () => pollsRoot.getAttribute('data-dx-fetch-state')).toBe('ready');
  await expect(pollsRoot.getByRole('heading', { level: 1, name: 'Dex Polls' })).toBeVisible();
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(2800);
  const slowResolved = await page.evaluate(() => (window as any).__dxSlowAuthResolved && (window as any).__dxSlowAuthResolved());
  expect(Boolean(slowResolved)).toBe(false);
});
