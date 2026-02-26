(() => {
  if (typeof window === 'undefined' || window.__dxSupportStatusRuntimeLoaded) return;
  window.__dxSupportStatusRuntimeLoaded = true;

  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const AUTH_READY_TIMEOUT_MS = 2500;
  const STATUS_TIMEOUT_MS = 5000;
  const DEFAULT_STATUS_LIVE_PATH = '/data/status.live.json';
  const DEFAULT_STATUS_FALLBACK_PATH = '/data/status.fallback.json';
  const DEFAULT_POLL_MS = 60000;
  const MAX_BACKOFF_MS = 300000;

  const ERROR_COPY_BY_CODE = {
    400: {
      title: '400: Bad request',
      message: 'The request was invalid or incomplete. Retry from a clean route.',
    },
    401: {
      title: '401: Unauthorized',
      message: 'You need to sign in before continuing with this action.',
    },
    403: {
      title: '403: Forbidden',
      message: 'Your account is not permitted to access this resource.',
    },
    404: {
      title: '404: Not found',
      message: 'The requested route or resource could not be found.',
    },
    429: {
      title: '429: Too many requests',
      message: 'Too many requests were submitted in a short period. Wait and retry.',
    },
    500: {
      title: '500: Internal server error',
      message: 'A server-side failure occurred while processing your request.',
    },
    502: {
      title: '502: Bad gateway',
      message: 'A gateway dependency returned an invalid response.',
    },
    503: {
      title: '503: Service unavailable',
      message: 'The service is temporarily unavailable. Retry shortly.',
    },
  };

  function isObject(value) {
    return typeof value === 'object' && value !== null;
  }

  function withTimeout(promise, timeoutMs, fallbackValue) {
    let timer = 0;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => {
        timer = window.setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]).finally(() => {
      if (timer) {
        window.clearTimeout(timer);
      }
    });
  }

  function setFetchState(root, state) {
    if (!root) return;
    root.setAttribute('data-dx-fetch-state', state);
    if (state === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  }

  function sanitizeToken(value, maxLength = 80, fallback = 'unknown') {
    const cleaned = String(value || '')
      .replace(/[^a-zA-Z0-9 ._:/@-]/g, '')
      .replace(/\\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
    return cleaned || fallback;
  }

  function sanitizePath(value) {
    const raw = String(value || '').trim();
    if (!raw) return '/';

    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return '/';
      const path = `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`;
      if (!path.startsWith('/')) return '/';
      return path;
    } catch {
      return '/';
    }
  }

  function parseErrorContext() {
    const params = new URLSearchParams(window.location.search || '');
    const codeRaw = String(params.get('code') || '').trim();
    const codeInt = Number.parseInt(codeRaw, 10);
    const code = Number.isFinite(codeInt) ? codeInt : null;
    const from = sanitizePath(params.get('from'));
    const source = sanitizeToken(params.get('source'), 64, 'route');
    const requestId = sanitizeToken(params.get('rid'), 128, 'none');

    let referrerHost = 'none';
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        referrerHost = sanitizeToken(ref.host, 128, 'none');
      }
    } catch {
      referrerHost = 'none';
    }

    return {
      code,
      from,
      source,
      requestId,
      referrerHost,
      route: `${window.location.pathname || '/'}${window.location.search || ''}`,
      timestamp: new Date().toISOString(),
    };
  }

  function getErrorCopy(code) {
    if (code && Object.prototype.hasOwnProperty.call(ERROR_COPY_BY_CODE, code)) {
      return ERROR_COPY_BY_CODE[code];
    }
    return {
      title: 'Unexpected error',
      message: 'The request did not complete successfully. Retry or continue to support.',
    };
  }

  function buildErrorReport(context) {
    const codeLabel = context.code ? String(context.code) : 'unknown';
    return [
      'DEX ERROR REPORT',
      `timestamp: ${context.timestamp}`,
      `route: ${context.route}`,
      `status_code: ${codeLabel}`,
      `source: ${context.source}`,
      `request_id: ${context.requestId}`,
      `from: ${context.from}`,
      `referrer_host: ${context.referrerHost}`,
    ].join('\n');
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  }

  async function renderErrorPage(root) {
    setFetchState(root, FETCH_STATE_LOADING);
    const context = parseErrorContext();
    const copy = getErrorCopy(context.code);
    const reportText = buildErrorReport(context);

    const titleNode = document.getElementById('dx-error-title');
    if (titleNode) titleNode.textContent = copy.title;

    const messageNode = document.getElementById('dx-error-message');
    if (messageNode) messageNode.textContent = copy.message;

    const codeNode = document.getElementById('dx-error-code');
    if (codeNode) codeNode.textContent = context.code ? String(context.code) : 'unknown';

    const sourceNode = document.getElementById('dx-error-source');
    if (sourceNode) sourceNode.textContent = context.source;

    const ridNode = document.getElementById('dx-error-rid');
    if (ridNode) ridNode.textContent = context.requestId;

    const fromNode = document.getElementById('dx-error-from');
    if (fromNode) fromNode.textContent = context.from;

    const referrerNode = document.getElementById('dx-error-referrer');
    if (referrerNode) referrerNode.textContent = context.referrerHost;

    const reportNode = document.getElementById('dx-error-report');
    if (reportNode) reportNode.textContent = reportText;

    const retryAction = root.querySelector('[data-dx-error-action="retry"]');
    if (retryAction) {
      retryAction.setAttribute('href', context.from || '/');
      retryAction.addEventListener('click', (event) => {
        event.preventDefault();
        const currentRoute = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
        if (context.from && context.from !== currentRoute) {
          window.location.assign(context.from);
          return;
        }
        window.location.reload();
      });
    }

    const homeAction = root.querySelector('[data-dx-error-action="home"]');
    if (homeAction) {
      homeAction.setAttribute('href', '/');
      homeAction.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.assign('/');
      });
    }

    const supportAction = root.querySelector('[data-dx-error-action="support"]');
    if (supportAction) {
      const supportUrl = new URL('/support/', window.location.origin);
      supportUrl.searchParams.set('from', context.from || '/');
      if (context.code) supportUrl.searchParams.set('code', String(context.code));
      supportUrl.searchParams.set('source', context.source);
      if (context.requestId !== 'none') supportUrl.searchParams.set('rid', context.requestId);
      supportAction.setAttribute('href', `${supportUrl.pathname}${supportUrl.search}`);
      supportAction.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.assign(`${supportUrl.pathname}${supportUrl.search}`);
      });
    }

    const copyAction = root.querySelector('[data-dx-error-action="copy-report"]');
    const copyFeedback = document.getElementById('dx-error-copy-feedback');
    if (copyAction) {
      copyAction.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          await copyTextToClipboard(reportText);
          if (copyFeedback) copyFeedback.textContent = 'Copied report.';
        } catch {
          if (copyFeedback) copyFeedback.textContent = 'Unable to copy report automatically.';
        }
      });
    }

    setFetchState(root, FETCH_STATE_READY);
  }

  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeStatusState(value) {
    const state = String(value || '').trim().toLowerCase();
    if (state === 'operational' || state === 'degraded' || state === 'outage' || state === 'maintenance') {
      return state;
    }
    return 'degraded';
  }

  function normalizeStatusPayload(payload, fallbackMessage) {
    const root = isObject(payload) ? payload : {};
    const overallRaw = isObject(root.overall) ? root.overall : {};
    const componentsRaw = Array.isArray(root.components) ? root.components : [];
    const incidentsRaw = Array.isArray(root.incidents) ? root.incidents : [];

    const components = componentsRaw.map((component, index) => {
      const value = isObject(component) ? component : {};
      const uptimeRaw = isObject(value.uptime) ? value.uptime : {};
      return {
        id: sanitizeToken(value.id || `component-${index + 1}`, 64, `component-${index + 1}`),
        name: sanitizeToken(value.name || `Component ${index + 1}`, 120, `Component ${index + 1}`),
        state: normalizeStatusState(value.state),
        uptime: {
          h24: toFiniteNumber(uptimeRaw.h24),
          d7: toFiniteNumber(uptimeRaw.d7),
          d30: toFiniteNumber(uptimeRaw.d30),
        },
        latencyMs: toFiniteNumber(value.latencyMs),
        updatedAt: sanitizeToken(value.updatedAt || root.generatedAt || '', 64, 'unknown'),
      };
    });

    const incidents = incidentsRaw.map((incident, index) => {
      const value = isObject(incident) ? incident : {};
      const componentsList = Array.isArray(value.components)
        ? value.components.map((entry) => sanitizeToken(entry, 64, '')).filter(Boolean)
        : [];

      return {
        id: sanitizeToken(value.id || `incident-${index + 1}`, 80, `incident-${index + 1}`),
        title: sanitizeToken(value.title || `Incident ${index + 1}`, 180, `Incident ${index + 1}`),
        state: sanitizeToken(value.state || 'active', 40, 'active'),
        impact: sanitizeToken(value.impact || 'minor', 40, 'minor'),
        startedAt: sanitizeToken(value.startedAt || 'unknown', 64, 'unknown'),
        updatedAt: sanitizeToken(value.updatedAt || 'unknown', 64, 'unknown'),
        resolvedAt: sanitizeToken(value.resolvedAt || '', 64, ''),
        components: componentsList,
        summary: sanitizeToken(value.summary || 'No summary provided.', 600, 'No summary provided.'),
        link: sanitizePath(value.link || '/support/'),
      };
    });

    return {
      generatedAt: sanitizeToken(root.generatedAt || new Date().toISOString(), 64, new Date().toISOString()),
      overall: {
        state: normalizeStatusState(overallRaw.state),
        message: sanitizeToken(overallRaw.message || fallbackMessage, 280, fallbackMessage),
      },
      components,
      incidents,
    };
  }

  async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return '--';
    const normalized = Math.max(0, Math.min(100, Number(value)));
    return `${normalized.toFixed(2)}%`;
  }

  function formatStateLabel(state) {
    const normalized = normalizeStatusState(state);
    if (normalized === 'operational') return 'Operational';
    if (normalized === 'degraded') return 'Degraded';
    if (normalized === 'outage') return 'Outage';
    return 'Maintenance';
  }

  function formatDateLabel(value) {
    const parsed = Date.parse(String(value || ''));
    if (!Number.isFinite(parsed)) return 'Unknown';
    try {
      return new Date(parsed).toLocaleString();
    } catch {
      return String(value || 'Unknown');
    }
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function getStatusLivePath() {
    const configured = String(window.DX_STATUS_ENDPOINT || '').trim();
    if (!configured) return DEFAULT_STATUS_LIVE_PATH;

    try {
      const resolved = new URL(configured, window.location.origin);
      if (resolved.origin !== window.location.origin) return DEFAULT_STATUS_LIVE_PATH;
      return `${resolved.pathname || '/'}${resolved.search || ''}`;
    } catch {
      return DEFAULT_STATUS_LIVE_PATH;
    }
  }

  async function loadSupportStatus() {
    const livePath = getStatusLivePath();

    try {
      const liveJson = await fetchJsonWithTimeout(livePath, STATUS_TIMEOUT_MS);
      return {
        status: normalizeStatusPayload(liveJson, 'All systems are operational.'),
        source: 'live',
        warning: '',
      };
    } catch {
      try {
        const fallbackJson = await fetchJsonWithTimeout(DEFAULT_STATUS_FALLBACK_PATH, STATUS_TIMEOUT_MS);
        return {
          status: normalizeStatusPayload(fallbackJson, 'Fallback status snapshot loaded.'),
          source: 'fallback',
          warning: 'Live status endpoint unavailable; displaying fallback status data.',
        };
      } catch {
        return {
          status: normalizeStatusPayload(
            {
              generatedAt: new Date().toISOString(),
              overall: {
                state: 'degraded',
                message: 'Status is temporarily unavailable.',
              },
              components: [],
              incidents: [],
            },
            'Status is temporarily unavailable.',
          ),
          source: 'unavailable',
          warning: 'Both live and fallback status sources are unavailable.',
        };
      }
    }
  }

  function renderSupportStatus(statusRoot, metaRoot, statusBundle) {
    if (!statusRoot || !metaRoot) return;

    const status = statusBundle.status;
    clearNode(statusRoot);

    const sourceLabel = statusBundle.source === 'live'
      ? 'Live'
      : statusBundle.source === 'fallback'
        ? 'Fallback'
        : 'Unavailable';

    const statusMeta = [
      `${sourceLabel} source`,
      `Updated ${formatDateLabel(status.generatedAt)}`,
    ];
    if (statusBundle.warning) {
      statusMeta.push(statusBundle.warning);
    }
    metaRoot.textContent = statusMeta.join(' · ');

    const overallBlock = document.createElement('div');
    overallBlock.className = 'dx-support-overall';
    const overallBadge = document.createElement('span');
    overallBadge.className = 'dx-support-status-badge';
    overallBadge.setAttribute('data-state', normalizeStatusState(status.overall.state));
    overallBadge.textContent = formatStateLabel(status.overall.state);
    const overallMessage = document.createElement('span');
    overallMessage.style.marginLeft = '0.65rem';
    overallMessage.textContent = status.overall.message;
    overallBlock.append(overallBadge, overallMessage);
    statusRoot.appendChild(overallBlock);

    if (status.components.length > 0) {
      const table = document.createElement('table');
      table.className = 'dx-support-status-table';
      const header = document.createElement('thead');
      header.innerHTML = '<tr><th>Component</th><th>State</th><th>24h</th><th>7d</th><th>30d</th><th>Latency</th></tr>';
      table.appendChild(header);

      const body = document.createElement('tbody');
      status.components.forEach((component) => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.textContent = component.name;

        const stateCell = document.createElement('td');
        const stateBadge = document.createElement('span');
        stateBadge.className = 'dx-support-status-badge';
        stateBadge.setAttribute('data-state', component.state);
        stateBadge.textContent = formatStateLabel(component.state);
        stateCell.appendChild(stateBadge);

        const h24Cell = document.createElement('td');
        h24Cell.textContent = formatPercent(component.uptime.h24);

        const d7Cell = document.createElement('td');
        d7Cell.textContent = formatPercent(component.uptime.d7);

        const d30Cell = document.createElement('td');
        d30Cell.textContent = formatPercent(component.uptime.d30);

        const latencyCell = document.createElement('td');
        latencyCell.textContent = Number.isFinite(component.latencyMs)
          ? `${Math.round(component.latencyMs)} ms`
          : '--';

        row.append(nameCell, stateCell, h24Cell, d7Cell, d30Cell, latencyCell);
        body.appendChild(row);
      });

      table.appendChild(body);
      statusRoot.appendChild(table);
    }

    const incidentsTitle = document.createElement('h3');
    incidentsTitle.textContent = 'Recent incidents';
    incidentsTitle.style.marginTop = '0.95rem';
    statusRoot.appendChild(incidentsTitle);

    if (status.incidents.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No recent incidents.';
      statusRoot.appendChild(empty);
      return;
    }

    const incidentList = document.createElement('ul');
    incidentList.className = 'dx-support-incident-list';
    status.incidents.forEach((incident) => {
      const item = document.createElement('li');
      item.className = 'dx-support-incident-item';

      const head = document.createElement('div');
      const incidentBadge = document.createElement('span');
      incidentBadge.className = 'dx-support-status-badge';
      incidentBadge.setAttribute('data-state', normalizeStatusState(incident.state));
      incidentBadge.textContent = sanitizeToken(incident.state, 24, 'active');

      const title = document.createElement('strong');
      title.style.marginLeft = '0.55rem';
      title.textContent = incident.title;
      head.append(incidentBadge, title);

      const summary = document.createElement('p');
      summary.textContent = incident.summary;

      const meta = document.createElement('p');
      meta.className = 'dx-support-incident-meta';
      const components = incident.components.length ? incident.components.join(', ') : 'unspecified';
      meta.textContent = `Impact: ${incident.impact} · Components: ${components} · Started ${formatDateLabel(incident.startedAt)} · Updated ${formatDateLabel(incident.updatedAt)}`;

      const link = document.createElement('a');
      link.href = incident.link || '/support/';
      link.textContent = 'Incident details';
      link.className = 'dx-button-element dx-button-element--secondary dx-button-size--sm';
      link.style.textDecoration = 'none';

      item.append(head, summary, meta, link);
      incidentList.appendChild(item);
    });

    statusRoot.appendChild(incidentList);
  }

  function getAuthRuntime() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  async function getAuthSnapshot() {
    const auth = getAuthRuntime();
    if (!auth) {
      return {
        auth,
        authenticated: false,
        user: null,
      };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(auth.resolve(AUTH_READY_TIMEOUT_MS), AUTH_READY_TIMEOUT_MS, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, AUTH_READY_TIMEOUT_MS, null);
      }
    } catch {
      // Keep going in degraded auth mode.
    }

    let authenticated = false;
    let user = null;

    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await withTimeout(auth.isAuthenticated(), AUTH_READY_TIMEOUT_MS, false));
      }
    } catch {
      authenticated = false;
    }

    if (authenticated && typeof auth.getUser === 'function') {
      try {
        user = await withTimeout(auth.getUser(), AUTH_READY_TIMEOUT_MS, null);
      } catch {
        user = null;
      }
    }

    return {
      auth,
      authenticated,
      user,
    };
  }

  function renderSignedOutSupport(target, auth) {
    clearNode(target);

    const copy = document.createElement('p');
    copy.textContent = 'Sign in to access account-specific support shortcuts.';

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'dx-button-element dx-button-element--secondary dx-button-size--sm';
    action.textContent = 'Sign in';
    action.addEventListener('click', async () => {
      try {
        if (auth && typeof auth.signIn === 'function') {
          await auth.signIn({
            returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
          });
        }
      } catch {
        // No-op: support page must stay stable.
      }
    });

    target.append(copy, action);
  }

  function renderSignedInSupport(target, user) {
    clearNode(target);

    const greeting = document.createElement('p');
    const displayName = sanitizeToken((user && (user.name || user.nickname || user.email)) || 'Member', 140, 'Member');
    greeting.textContent = `Signed in as ${displayName}.`;

    const shortcuts = document.createElement('div');
    shortcuts.className = 'dx-support-shortcuts';

    const links = [
      { label: 'Settings', href: '/entry/settings/' },
      { label: 'Favorites', href: '/entry/favorites/' },
      { label: 'Achievements', href: '/entry/achievements/' },
    ];

    links.forEach((entry) => {
      const link = document.createElement('a');
      link.href = entry.href;
      link.className = 'dx-button-element dx-button-element--secondary dx-button-size--sm';
      link.textContent = entry.label;
      shortcuts.appendChild(link);
    });

    target.append(greeting, shortcuts);
  }

  async function renderSupportAuthShortcuts(target) {
    if (!target) return;

    const snapshot = await getAuthSnapshot();
    if (snapshot.authenticated) {
      renderSignedInSupport(target, snapshot.user);
      return;
    }

    renderSignedOutSupport(target, snapshot.auth);
  }

  async function renderSupportPage(root) {
    setFetchState(root, FETCH_STATE_LOADING);

    const statusRoot = document.getElementById('dx-support-status');
    const statusMetaRoot = document.getElementById('dx-support-status-meta');
    const accountRoot = document.getElementById('dx-support-account');
    const refreshButton = root.querySelector('[data-dx-support-refresh]');

    let pollTimer = 0;
    let failedCycles = 0;

    const clearPollTimer = () => {
      if (!pollTimer) return;
      window.clearTimeout(pollTimer);
      pollTimer = 0;
    };

    const scheduleNext = () => {
      clearPollTimer();
      const configured = Number(window.__DX_STATUS_POLL_MS);
      const baseMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_POLL_MS;
      const delay = failedCycles > 0
        ? Math.min(baseMs * (2 ** failedCycles), MAX_BACKOFF_MS)
        : baseMs;

      pollTimer = window.setTimeout(() => {
        void runCycle();
      }, delay);
    };

    const runCycle = async () => {
      const bundle = await loadSupportStatus();
      renderSupportStatus(statusRoot, statusMetaRoot, bundle);
      failedCycles = bundle.source === 'live' ? 0 : Math.min(failedCycles + 1, 4);
      scheduleNext();
    };

    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        clearPollTimer();
        await runCycle();
      });
    }

    window.addEventListener('beforeunload', clearPollTimer, { once: true });

    const authRenderPromise = renderSupportAuthShortcuts(accountRoot).catch(() => {
      if (accountRoot) {
        accountRoot.textContent = 'Account shortcuts are unavailable right now.';
      }
    });

    await runCycle();
    await authRenderPromise;
    setFetchState(root, FETCH_STATE_READY);
  }

  async function boot() {
    const errorRoot = document.getElementById('dx-error');
    if (errorRoot) {
      try {
        await renderErrorPage(errorRoot);
      } catch {
        setFetchState(errorRoot, FETCH_STATE_ERROR);
      }
    }

    const supportRoot = document.getElementById('dx-support');
    if (supportRoot) {
      try {
        await renderSupportPage(supportRoot);
      } catch {
        setFetchState(supportRoot, FETCH_STATE_ERROR);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void boot();
    }, { once: true });
  } else {
    void boot();
  }
})();
