(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxPollsAppLoaded && typeof window.__dxPollsQueueBoot === 'function') {
    try {
      window.__dxPollsQueueBoot();
    } catch {}
    return;
  }
  window.__dxPollsAppLoaded = true;

  const DX_MIN_SHEEN_MS = 120;
  const STYLE_ID = 'dx-polls-app-style';
  const PAGE_SIZE_OPEN = 12;
  const PAGE_SIZE_CLOSED = 8;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dx-polls-shell{
        --dx-polls-gap: clamp(14px,1.8vw,22px);
        width:var(--dx-header-frame-width);
        max-width:var(--dx-header-frame-width);
        margin:0 auto;
        padding:var(--dx-polls-gap) 0;
        box-sizing:border-box
      }
      .dx-polls-layout{display:grid;gap:var(--dx-polls-gap);grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}
      .dx-polls-panel{padding:clamp(16px,1.8vw,22px);border-radius:var(--dx-header-glass-radius,var(--dx-radius-md,10px));background:var(--dx-header-glass-bg);border:1px solid var(--dx-header-glass-rim);box-shadow:var(--dx-header-glass-shadow)}
      @supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))){.dx-polls-panel{-webkit-backdrop-filter:var(--dx-header-glass-backdrop);backdrop-filter:var(--dx-header-glass-backdrop)}}
      .dx-polls-title{margin:0;font-family:var(--font-heading);font-size:clamp(1.6rem,3.3vw,2.35rem);letter-spacing:.02em;text-transform:uppercase}
      .dx-polls-subtitle{margin:8px 0 0 0;font-family:var(--font-body);font-size:clamp(.9rem,1.2vw,1rem);color:var(--dx-color-text-muted,#5e6270)}
      .dx-polls-stack{display:grid;gap:12px;margin-top:16px}
      .dx-poll-card{display:grid;gap:10px;padding:14px;border-radius:var(--dx-radius-sm,8px);background:rgba(255,255,255,.32);border:1px solid rgba(255,255,255,.55)}
      .dx-poll-card.is-locked{opacity:.92}
      .dx-poll-card-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .dx-poll-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;border:1px solid rgba(38,42,52,.25);font-family:var(--font-body);font-size:.74rem;letter-spacing:.02em;text-transform:uppercase}
      .dx-poll-chip.is-accent{background:linear-gradient(90deg,#ff2d13 0%,#ff7a1a 100%);color:#fff;border-color:rgba(0,0,0,.18)}
      .dx-poll-chip.is-members{
        background:rgba(22,26,34,.9);
        color:#fff;
        border-color:rgba(255,255,255,.24);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 14px rgba(16,20,30,.22)
      }
      .dx-poll-question{margin:0;font-family:var(--font-heading);font-size:clamp(1rem,1.2vw,1.25rem);line-height:1.15;letter-spacing:.01em}
      .dx-poll-meta{margin:0;font-family:var(--font-body);font-size:.86rem;color:var(--dx-color-text-muted,#5e6270)}
      .dx-poll-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      .dx-poll-link,.dx-poll-action{appearance:none;border:1px solid rgba(38,42,52,.26);background:rgba(255,255,255,.55);border-radius:var(--dx-radius-sm,8px);padding:8px 12px;font-family:var(--font-heading);font-size:.82rem;letter-spacing:.02em;text-transform:uppercase;color:var(--dx-color-text,#1e2129);text-decoration:none;cursor:pointer}
      .dx-poll-link:hover,.dx-poll-action:hover{background:rgba(255,255,255,.72)}
      .dx-poll-action.is-danger{background:#af1d17;color:#fff;border-color:#7f110f}
      .dx-polls-pager{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:10px}
      .dx-polls-pager .dx-poll-action[disabled]{opacity:.42;cursor:default}
      .dx-poll-detail{display:grid;gap:16px}
      .dx-poll-back{width:max-content}
      .dx-poll-options{display:grid;gap:10px}
      .dx-poll-option{display:grid;gap:8px;padding:10px;border-radius:var(--dx-radius-sm,8px);border:1px solid rgba(38,42,52,.2);background:rgba(255,255,255,.46);text-align:left;cursor:pointer}
      .dx-poll-option[disabled]{cursor:default;opacity:.78}
      .dx-poll-option.is-selected{border-color:#ff4d1a;box-shadow:inset 0 0 0 1px rgba(255,77,26,.35)}
      .dx-poll-option-title{font-family:var(--font-heading);font-size:.98rem;line-height:1.1;text-transform:uppercase;letter-spacing:.01em}
      .dx-poll-bar{position:relative;height:8px;border-radius:999px;overflow:hidden;background:rgba(24,30,44,.12)}
      .dx-poll-bar-fill{height:100%;width:0;background:linear-gradient(90deg,#ff2d13 0%,#ff7a1a 100%);transition:width 220ms var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1))}
      .dx-poll-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--font-body);font-size:.82rem;color:var(--dx-color-text-muted,#5e6270)}
      .dx-polls-empty{margin:0;padding:14px;border-radius:var(--dx-radius-sm,8px);border:1px solid rgba(38,42,52,.16);background:rgba(255,255,255,.4);font-family:var(--font-body);color:var(--dx-color-text-muted,#5e6270)}
      .dx-polls-error{margin:0;padding:14px;border-radius:var(--dx-radius-sm,8px);border:1px solid rgba(175,29,23,.25);background:rgba(175,29,23,.08);font-family:var(--font-body);color:#611313}
      @media (max-width: 980px){
        .dx-polls-shell{width:var(--dx-header-frame-width);max-width:var(--dx-header-frame-width)}
        .dx-polls-layout{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePath(pathname) {
    const clean = String(pathname || '/').replace(/\/+/g, '/');
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean.slice(0, -1) : clean;
  }

  function getApiBase() {
    const fromConfig = window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || '';
    const fallback = 'https://dex-api.spring-fog-8edd.workers.dev';
    const raw = String(fromConfig || fallback).trim();
    return raw.replace(/\/$/, '');
  }

  function parseDate(value) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : null;
  }

  function formatDate(value) {
    const ms = parseDate(value);
    if (!ms) return 'TBD';
    try {
      return new Date(ms).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function relativeCloseText(value) {
    const ms = parseDate(value);
    if (!ms) return 'Closing date TBD';
    const now = Date.now();
    const delta = ms - now;
    if (delta <= 0) return 'Closed';

    const totalHours = Math.floor(delta / 36e5);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    const mins = Math.max(1, Math.floor(delta / 6e4));
    return `${mins}m left`;
  }

  function normalizeOptions(raw) {
    if (Array.isArray(raw)) {
      return raw.map((option) => String(option || '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw
        .split('|')
        .map((option) => option.trim())
        .filter(Boolean);
    }
    return [];
  }

  function normalizePoll(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    return {
      id: String(item.id || '').trim(),
      slug: String(item.slug || '').trim() || null,
      status: String(item.status || '').trim() || 'draft',
      question: String(item.question || '').trim() || 'Untitled poll',
      options: normalizeOptions(item.options),
      createdAt: String(item.createdAt || item.created_at || '').trim(),
      closeAt: String(item.closeAt || item.close_at || '').trim(),
      manualClose: Boolean(item.manualClose || item.manual_close),
      visibility: String(item.visibility || 'public').trim() === 'members' ? 'members' : 'public',
      closed: Boolean(item.closed),
      locked: Boolean(item.locked),
    };
  }

  function normalizeCountMap(raw) {
    const map = {};
    if (!raw || typeof raw !== 'object') return map;
    for (const [key, value] of Object.entries(raw)) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) continue;
      map[String(key)] = Math.floor(number);
    }
    return map;
  }

  function normalizeResults(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const counts = Array.isArray(item.counts)
      ? item.counts.map((count) => Math.max(0, Number(count) || 0))
      : normalizeCountMap(item.counts);

    return {
      total: Math.max(0, Number(item.total) || 0),
      counts,
      viewerVote: Number.isInteger(Number(item.viewerVote)) ? Number(item.viewerVote) : null,
      closed: Boolean(item.closed),
    };
  }

  function pollPath(id) {
    return `/polls/${encodeURIComponent(id)}/`;
  }

  function parseRoute() {
    const normalized = normalizePath(window.location.pathname || '/');
    if (normalized === '/polls' || normalized === '/polls/index.html') {
      return { type: 'list', pollId: null };
    }
    if (normalized.startsWith('/polls/')) {
      const segment = normalized.slice('/polls/'.length);
      const id = segment.replace(/\/index\.html$/i, '').replace(/\/$/, '');
      if (!id) return { type: 'list', pollId: null };
      return { type: 'detail', pollId: decodeURIComponent(id) };
    }
    return { type: 'list', pollId: null };
  }

  function getRootElement() {
    return document.querySelector('[data-dx-polls-app]')
      || document.getElementById('dx-polls-app');
  }

  function navigateTo(targetHref, options = {}) {
    const href = String(targetHref || '').trim();
    if (!href) return;

    const useReplace = Boolean(options.replace);
    if (typeof window.dxNavigate === 'function') {
      try {
        const maybePromise = window.dxNavigate(href, {
          pushHistory: !useReplace,
          allowHardNavigate: true,
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then((handled) => {
              if (handled === false) window.location.assign(href);
            })
            .catch(() => {
              window.location.assign(href);
            });
          return;
        }
        return;
      } catch {}
    }

    if (useReplace) {
      window.location.replace(href);
      return;
    }
    window.location.assign(href);
  }

  function bindSoftPollLinks(root) {
    const links = root.querySelectorAll('a.dx-poll-link[href]');
    links.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.getAttribute('data-dx-poll-link-bound') === 'true') return;
      link.setAttribute('data-dx-poll-link-bound', 'true');
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigateTo(link.getAttribute('href') || '');
      });
    });
  }

  function getAuthApi() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  async function resolveAuthSnapshot() {
    const auth = getAuthApi();
    if (!auth) {
      return { auth: null, authenticated: false, token: null, user: null };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await auth.resolve(2500);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await auth.ready;
      }
    } catch {}

    let authenticated = false;
    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await auth.isAuthenticated());
      }
    } catch {}

    let token = null;
    if (authenticated && typeof auth.getAccessToken === 'function') {
      try {
        token = await auth.getAccessToken();
      } catch {
        token = null;
      }
    }

    let user = null;
    try {
      if (typeof auth.getUser === 'function') {
        user = await auth.getUser();
      }
    } catch {}

    return { auth, authenticated, token, user };
  }

  async function fetchJson(path, options = {}) {
    const apiBase = getApiBase();
    const authMode = options.auth || 'optional';
    const authSnapshot = options.authSnapshot || await resolveAuthSnapshot();
    const headers = { 'content-type': 'application/json' };

    if (authSnapshot.token) {
      headers.authorization = `Bearer ${authSnapshot.token}`;
    }

    if (authMode === 'required' && !headers.authorization) {
      return { ok: false, status: 401, data: { error: 'AUTH_REQUIRED' } };
    }

    const response = await fetch(`${apiBase}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data: payload,
    };
  }

  function normalizeListPayload(raw, fallbackPage = 1) {
    if (Array.isArray(raw)) {
      return {
        polls: raw.map(normalizePoll),
        page: fallbackPage,
        pages: 1,
        total: raw.length,
      };
    }
    const item = raw && typeof raw === 'object' ? raw : {};
    const candidates = [item.polls, item.items, item.data, item.rows];
    const list = candidates.find((value) => Array.isArray(value)) || [];
    return {
      polls: list.map(normalizePoll),
      page: Math.max(1, Number(item.page) || fallbackPage),
      pages: Math.max(1, Number(item.pages || item.totalPages) || 1),
      total: Math.max(0, Number(item.total || item.count || list.length) || 0),
    };
  }

  async function waitMinSheen(startAt) {
    const elapsed = performance.now() - startAt;
    if (elapsed >= DX_MIN_SHEEN_MS) return;
    await new Promise((resolve) => setTimeout(resolve, DX_MIN_SHEEN_MS - elapsed));
  }

  function setFetchState(root, state) {
    root.setAttribute('data-dx-fetch-state', state);
    if (state === 'loading') {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  }

  function renderRouteError(root, message) {
    root.innerHTML = `
      <section class="dx-polls-shell">
        <article class="dx-polls-panel">
          <h1 class="dx-polls-title">Dex Polls</h1>
          <p class="dx-polls-error">${htmlEscape(message || 'Unable to load polls right now.')}</p>
        </article>
      </section>
    `;
  }

  function isPollClosed(poll) {
    if (!poll) return true;
    if (poll.status === 'closed' || poll.manualClose || poll.closed) return true;
    const closeAt = parseDate(poll.closeAt);
    return closeAt ? closeAt <= Date.now() : false;
  }

  function buildPollCard(poll, authSnapshot) {
    const closed = isPollClosed(poll);
    const locked = poll.visibility === 'members' && !authSnapshot.authenticated;
    const statusLabel = closed ? 'Closed' : poll.status === 'draft' ? 'Draft' : 'Open';
    const closeLabel = closed ? `Closed ${formatDate(poll.closeAt)}` : `Closes ${formatDate(poll.closeAt)} (${relativeCloseText(poll.closeAt)})`;

    const lockChip = poll.visibility === 'members'
      ? '<span class="dx-poll-chip is-members">Members only</span>'
      : '';

    const cta = locked
      ? `<button class="dx-poll-action" type="button" data-dx-poll-action="signin" data-dx-poll-id="${htmlEscape(poll.id)}">Sign in to unlock</button>`
      : `<a class="dx-poll-link" href="${htmlEscape(pollPath(poll.id))}">View Poll</a>`;

    return `
      <article class="dx-poll-card${locked ? ' is-locked' : ''}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${closed ? '' : 'is-accent'}">${statusLabel}</span>
          ${lockChip}
        </div>
        <h3 class="dx-poll-question">${htmlEscape(poll.question)}</h3>
        <p class="dx-poll-meta">${htmlEscape(closeLabel)}</p>
        <div class="dx-poll-actions">${cta}</div>
      </article>
    `;
  }

  function renderList(root, model) {
    const openCards = model.open.polls.length
      ? model.open.polls.map((poll) => buildPollCard(poll, model.auth)).join('')
      : '<p class="dx-polls-empty">No open polls right now.</p>';

    const closedCards = model.closed.polls.length
      ? model.closed.polls.map((poll) => buildPollCard(poll, model.auth)).join('')
      : '<p class="dx-polls-empty">No closed polls yet.</p>';

    root.innerHTML = `
      <section class="dx-polls-shell">
        <article class="dx-polls-panel">
          <h1 class="dx-polls-title">Dex Polls</h1>
          <p class="dx-polls-subtitle">Community signal desk. Members-only polls require sign-in.</p>
        </article>
        <section class="dx-polls-layout">
          <article class="dx-polls-panel" data-dx-motion="pagination">
            <h2 class="dx-poll-question">Open polls</h2>
            <div class="dx-polls-stack">${openCards}</div>
          </article>
          <article class="dx-polls-panel" data-dx-motion="pagination">
            <h2 class="dx-poll-question">Closed polls</h2>
            <div class="dx-polls-stack">${closedCards}</div>
            <div class="dx-polls-pager">
              <button type="button" class="dx-poll-action" data-dx-poll-action="closed-prev" ${model.closed.page <= 1 ? 'disabled' : ''}>Previous</button>
              <span class="dx-poll-meta">Page ${model.closed.page} of ${model.closed.pages}</span>
              <button type="button" class="dx-poll-action" data-dx-poll-action="closed-next" ${model.closed.page >= model.closed.pages ? 'disabled' : ''}>Next</button>
            </div>
          </article>
        </section>
      </section>
    `;
    bindSoftPollLinks(root);
  }

  function renderDetail(root, poll, results, authSnapshot, saveState = 'idle') {
    const closed = isPollClosed(poll) || Boolean(results.closed);
    const countsByIndex = Array.isArray(results.counts)
      ? results.counts
      : poll.options.map((_, idx) => Number(results.counts?.[String(idx)] || 0));

    const optionsHtml = poll.options.map((label, index) => {
      const votes = Math.max(0, Number(countsByIndex[index]) || 0);
      const pct = results.total > 0 ? Math.round((votes / results.total) * 100) : 0;
      const selected = results.viewerVote === index;
      const disabled = closed ? 'disabled' : '';
      return `
        <button type="button" class="dx-poll-option${selected ? ' is-selected' : ''}" data-dx-poll-action="vote" data-dx-poll-option="${index}" ${disabled}>
          <span class="dx-poll-option-title">${htmlEscape(label)}</span>
          <div class="dx-poll-bar"><div class="dx-poll-bar-fill" style="width:${pct}%"></div></div>
          <div class="dx-poll-row-foot"><span>${votes} votes</span><span>${pct}%</span></div>
        </button>
      `;
    }).join('');

    const memberChip = poll.visibility === 'members'
      ? '<span class="dx-poll-chip is-members">Members only</span>'
      : '';

    const saveLabel = saveState === 'saving'
      ? 'Submitting vote…'
      : saveState === 'saved'
        ? 'Vote saved'
        : saveState === 'error'
          ? 'Vote failed'
          : '';

    root.innerHTML = `
      <section class="dx-polls-shell">
        <article class="dx-polls-panel dx-poll-detail" data-dx-motion="pagination">
          <a class="dx-poll-link dx-poll-back" href="/polls/">Back to polls</a>
          <div class="dx-poll-card-head">
            <span class="dx-poll-chip ${closed ? '' : 'is-accent'}">${closed ? 'Closed' : 'Open'}</span>
            ${memberChip}
          </div>
          <h1 class="dx-polls-title">${htmlEscape(poll.question)}</h1>
          <p class="dx-polls-subtitle">${closed ? `Closed ${formatDate(poll.closeAt)}` : `Closes ${formatDate(poll.closeAt)} (${relativeCloseText(poll.closeAt)})`}</p>
          ${!authSnapshot.authenticated ? '<p class="dx-polls-empty">Sign in to vote. Live results remain visible.</p>' : ''}
          <div class="dx-poll-options">${optionsHtml}</div>
          <div class="dx-polls-pager">
            <span class="dx-poll-meta">${results.total} total votes</span>
            <span class="dx-poll-meta">${htmlEscape(saveLabel)}</span>
          </div>
        </article>
      </section>
    `;
    bindSoftPollLinks(root);
  }

  function renderLockedDetail(root, pollId) {
    root.innerHTML = `
      <section class="dx-polls-shell">
        <article class="dx-polls-panel">
          <h1 class="dx-polls-title">Members poll</h1>
          <p class="dx-polls-subtitle">This poll is available to signed-in members.</p>
          <div class="dx-polls-stack">
            <p class="dx-polls-empty">Poll id: ${htmlEscape(pollId)}</p>
            <button type="button" class="dx-poll-action" data-dx-poll-action="signin">Sign in to continue</button>
            <a class="dx-poll-link" href="/polls/">Back to polls</a>
          </div>
        </article>
      </section>
    `;
    bindSoftPollLinks(root);
  }

  async function promptSignIn(authSnapshot) {
    const auth = authSnapshot && authSnapshot.auth;
    if (!auth || typeof auth.signIn !== 'function') return;
    try {
      await auth.signIn({ returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}` });
    } catch {}
  }

  async function mountList(root, initialAuthSnapshot) {
    let authSnapshot = initialAuthSnapshot;
    let closedPage = 1;

    async function fetchAndRender() {
      const openRes = await fetchJson(`/polls?state=open&page=1&pageSize=${PAGE_SIZE_OPEN}`, {
        auth: 'optional',
        authSnapshot,
      });
      const closedRes = await fetchJson(`/polls?state=closed&page=${closedPage}&pageSize=${PAGE_SIZE_CLOSED}`, {
        auth: 'optional',
        authSnapshot,
      });

      if (!openRes.ok || !closedRes.ok) {
        throw new Error('Failed to load poll lists');
      }

      const open = normalizeListPayload(openRes.data, 1);
      const closed = normalizeListPayload(closedRes.data, closedPage);
      closedPage = closed.page;

      renderList(root, { auth: authSnapshot, open, closed });

      root.querySelectorAll('[data-dx-poll-action="signin"]').forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          await promptSignIn(authSnapshot);
        });
      });

      const prev = root.querySelector('[data-dx-poll-action="closed-prev"]');
      if (prev) {
        prev.addEventListener('click', async () => {
          if (closedPage <= 1) return;
          closedPage -= 1;
          await fetchAndRender();
        });
      }

      const next = root.querySelector('[data-dx-poll-action="closed-next"]');
      if (next) {
        next.addEventListener('click', async () => {
          closedPage += 1;
          await fetchAndRender();
        });
      }
    }

    await fetchAndRender();
  }

  async function mountDetail(root, pollId, initialAuthSnapshot) {
    let authSnapshot = initialAuthSnapshot;
    let saveState = 'idle';

    const detailRes = await fetchJson(`/polls/${encodeURIComponent(pollId)}`, {
      auth: 'optional',
      authSnapshot,
    });

    if (detailRes.status === 403 || detailRes.status === 401) {
      renderLockedDetail(root, pollId);
      const signIn = root.querySelector('[data-dx-poll-action="signin"]');
      if (signIn) {
        signIn.addEventListener('click', async () => {
          await promptSignIn(authSnapshot);
        });
      }
      return;
    }

    if (!detailRes.ok) {
      throw new Error(`Unable to load poll ${pollId}`);
    }

    const poll = normalizePoll(detailRes.data?.poll || detailRes.data);
    if (!poll.id) {
      throw new Error('Poll payload is missing id');
    }

    async function fetchResults() {
      const resultsRes = await fetchJson(`/polls/${encodeURIComponent(poll.id)}/results`, {
        auth: 'optional',
        authSnapshot,
      });
      if (!resultsRes.ok) {
        throw new Error('Unable to load poll results');
      }
      return normalizeResults(resultsRes.data?.results || resultsRes.data);
    }

    async function renderWithResults() {
      const results = await fetchResults();
      renderDetail(root, poll, results, authSnapshot, saveState);

      root.querySelectorAll('[data-dx-poll-action="vote"]').forEach((button) => {
        button.addEventListener('click', async () => {
          const optionIndex = Number(button.getAttribute('data-dx-poll-option'));
          if (!Number.isInteger(optionIndex) || optionIndex < 0) return;

          authSnapshot = await resolveAuthSnapshot();
          if (!authSnapshot.authenticated) {
            await promptSignIn(authSnapshot);
            return;
          }

          saveState = 'saving';
          try {
            const voteRes = await fetchJson(`/polls/${encodeURIComponent(poll.id)}/vote`, {
              method: 'POST',
              auth: 'required',
              authSnapshot,
              body: { optionIndex },
            });

            if (!voteRes.ok) {
              if (voteRes.status === 409) {
                saveState = 'error';
                await renderWithResults();
                return;
              }
              throw new Error('Vote failed');
            }

            saveState = 'saved';
            await renderWithResults();
            window.setTimeout(() => {
              saveState = 'idle';
              renderWithResults().catch(() => {});
            }, 900);
          } catch {
            saveState = 'error';
            await renderWithResults();
          }
        });
      });
    }

    await renderWithResults();
  }

  async function boot() {
    const root = getRootElement();
    if (!root) return;

    injectStyles();

    const startAt = performance.now();
    setFetchState(root, 'loading');

    try {
      const authSnapshot = await resolveAuthSnapshot();
      const route = parseRoute();
      if (route.type === 'detail' && route.pollId) {
        await mountDetail(root, route.pollId, authSnapshot);
      } else {
        await mountList(root, authSnapshot);
      }

      await waitMinSheen(startAt);
      setFetchState(root, 'ready');
    } catch (error) {
      console.error('[dx-polls] boot error', error);
      renderRouteError(root, 'Unable to load polls right now. Please try again.');
      await waitMinSheen(startAt);
      setFetchState(root, 'error');
    }
  }

  let bootPromise = null;
  let bootQueued = false;

  async function runBootLoop() {
    do {
      bootQueued = false;
      // eslint-disable-next-line no-await-in-loop
      await boot();
    } while (bootQueued);
  }

  function queueBoot() {
    if (bootPromise) {
      bootQueued = true;
      return bootPromise;
    }
    bootPromise = runBootLoop()
      .catch((error) => {
        console.error('[dx-polls] queue boot error', error);
      })
      .finally(() => {
        bootPromise = null;
      });
    return bootPromise;
  }

  window.__dxPollsQueueBoot = queueBoot;

  window.addEventListener('dx:slotready', () => {
    queueBoot().catch(() => {});
  });

  window.addEventListener('popstate', () => {
    queueBoot().catch(() => {});
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      queueBoot().catch(() => {});
    }, { once: true });
  } else {
    queueBoot().catch(() => {});
  }
})();
