(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxSubmissionTimelineRuntimeLoaded) {
    if (typeof window.__dxSubmissionTimelineMount === 'function') {
      try {
        window.__dxSubmissionTimelineMount();
      } catch {}
    }
    return;
  }
  window.__dxSubmissionTimelineRuntimeLoaded = true;

  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const AUTH_TIMEOUT_MS = 6000;
  const FETCH_TIMEOUT_MS = 7000;
  const MIN_SHELL_MS = 120;
  const DEFAULT_API = 'https://dex-api.spring-fog-8edd.workers.dev';

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
      if (timer) window.clearTimeout(timer);
    });
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
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

  function toApiBase(root) {
    const configured = root?.dataset?.api || window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API;
    return String(configured || DEFAULT_API).trim().replace(/\/+$/, '');
  }

  function toSafeText(value, fallback = '') {
    const raw = String(value == null ? '' : value).trim();
    return raw || fallback;
  }

  function parseTimestamp(value) {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toDateTime(value) {
    const ts = parseTimestamp(value);
    if (ts === null) return 'Unknown time';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return new Date(ts).toISOString();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAuthRuntime() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  async function resolveAuthSnapshot(timeoutMs = AUTH_TIMEOUT_MS) {
    const auth = getAuthRuntime();
    if (!auth) {
      return { auth: null, authenticated: false, token: '', user: null, sub: '' };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(auth.resolve(timeoutMs), timeoutMs, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, timeoutMs, null);
      }
    } catch {}

    let authenticated = false;
    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = !!(await withTimeout(auth.isAuthenticated(), timeoutMs, false));
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        const readyPayload = await withTimeout(auth.ready, timeoutMs, null);
        authenticated = !!(isObject(readyPayload) && readyPayload.isAuthenticated);
      }
    } catch {
      authenticated = false;
    }

    let user = null;
    try {
      if (typeof auth.getUser === 'function') {
        user = await withTimeout(auth.getUser(), timeoutMs, null);
      }
    } catch {
      user = null;
    }

    const sub = toSafeText(user?.sub || window.auth0Sub || window.AUTH0_USER?.sub, '');

    let token = '';
    if (authenticated && typeof auth.getAccessToken === 'function') {
      try {
        token = toSafeText(await withTimeout(auth.getAccessToken(), timeoutMs, ''), '');
      } catch {
        token = '';
      }
    }

    return {
      auth,
      authenticated,
      token,
      user,
      sub,
    };
  }

  async function fetchJsonWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
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
        payload,
      };
    } finally {
      window.clearTimeout(timer);
    }
  }

  function parseSidFromLocation(routeUrl = '') {
    let sid = '';

    if (routeUrl) {
      try {
        const parsed = new URL(String(routeUrl), window.location.origin);
        const routeParams = new URLSearchParams(parsed.search || '');
        sid = toSafeText(routeParams.get('sid'), '');
      } catch {}
    }

    if (!sid) {
      const params = new URLSearchParams(window.location.search || '');
      sid = toSafeText(params.get('sid'), '');
    }

    return sid.replace(/[^a-zA-Z0-9._:-]/g, '');
  }

  function severityChipClass(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'critical') return 'dx-sub-chip--critical';
    if (normalized === 'warning') return 'dx-sub-chip--warning';
    return 'dx-sub-chip--info';
  }

  function stageSeverity(stage) {
    const normalized = String(stage || '').toLowerCase();
    if (normalized === 'rejected') return 'critical';
    if (normalized === 'revision_requested') return 'warning';
    return 'info';
  }

  function parseMetadata(value) {
    if (isObject(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (isObject(parsed)) return parsed;
      } catch {}
    }
    return {};
  }

  function pickFirstText(values, fallback = '') {
    for (const value of values) {
      const text = toSafeText(value, '');
      if (text) return text;
    }
    return fallback;
  }

  function normalizeTimeline(timeline) {
    const rows = Array.isArray(timeline) ? timeline : [];
    return rows
      .map((row, index) => {
        const value = isObject(row) ? row : {};
        const metadata = parseMetadata(value.metadata || value.metadata_json || value.metadataJson || value.meta);
        const eventType = toSafeText(value.eventType || value.event_type || value.stage, 'event');
        const publicNote = toSafeText(value.publicNote || value.public_note, '');
        const statusRaw = toSafeText(value.statusRaw || value.status_raw, '');
        const libraryHref = pickFirstText([
          value.libraryHref,
          value.library_href,
          metadata.libraryHref,
          metadata.library_href,
        ]);
        const sourceLink = pickFirstText([
          value.sourceLink,
          value.source_link,
          metadata.sourceLink,
          metadata.source_link,
          metadata.link,
        ]);
        const title = pickFirstText([value.title, metadata.title, metadata.submissionTitle, metadata.submission_title]);
        const creator = pickFirstText([value.creator, metadata.creator, metadata.artist]);
        const lookup = pickFirstText([value.lookup, metadata.lookup, metadata.lookupNumber, metadata.lookup_number]);
        const createdAt = toSafeText(value.eventAt || value.event_at || value.createdAt || value.created_at, '');
        const id = toSafeText(value.id, `timeline-${index + 1}`);
        return {
          id,
          eventType,
          publicNote,
          statusRaw,
          libraryHref,
          sourceLink,
          title,
          creator,
          lookup,
          createdAt,
          metadata,
        };
      })
      .sort((a, b) => {
        const tsA = parseTimestamp(a.createdAt) || 0;
        const tsB = parseTimestamp(b.createdAt) || 0;
        return tsA - tsB;
      });
  }

  function normalizeStageRail(payloadStageRail, timeline, thread) {
    const fallback = [
      { key: 'sent', label: 'Sent' },
      { key: 'received', label: 'Received' },
      { key: 'acknowledged', label: 'Acknowledged' },
      { key: 'reviewing', label: 'Reviewing' },
      { key: 'accepted', label: 'Accepted' },
      { key: 'rejected', label: 'Rejected' },
      { key: 'in_library', label: 'In library' },
    ];

    if (isObject(payloadStageRail) && Array.isArray(payloadStageRail.steps)) {
      return payloadStageRail.steps.map((step, index) => {
        const value = isObject(step) ? step : {};
        return {
          key: toSafeText(value.key, `stage-${index + 1}`),
          label: toSafeText(value.label, toSafeText(value.key, 'Stage')),
          state: toSafeText(value.state, 'todo'),
          at: toSafeText(value.at, ''),
        };
      });
    }

    const timelineSet = new Set();
    for (const event of timeline) {
      timelineSet.add(String(event.eventType || '').toLowerCase());
    }
    const current = String(thread.currentStage || '').toLowerCase();

    return fallback.map((step) => {
      const key = step.key;
      let state = 'todo';
      if (current === key) {
        state = 'active';
      } else if (timelineSet.has(key)) {
        state = 'done';
      } else if (key === 'accepted' && current === 'in_library') {
        state = 'done';
      }
      return {
        ...step,
        state,
        at: '',
      };
    });
  }

  function hydrateThreadFromFallbacks(thread, threadPayload, timeline) {
    const payloadMeta = parseMetadata(
      threadPayload.metadata || threadPayload.metadata_json || threadPayload.metadataJson || threadPayload.meta,
    );
    const eventMetas = [];
    const timelineEvents = Array.isArray(timeline) ? timeline : [];
    for (let index = timelineEvents.length - 1; index >= 0; index -= 1) {
      const item = timelineEvents[index];
      if (isObject(item?.metadata) && Object.keys(item.metadata).length > 0) {
        eventMetas.push(item.metadata);
      }
    }
    const mergedMeta = [payloadMeta, ...eventMetas];
    const latestEvent = timelineEvents.length > 0 ? timelineEvents[timelineEvents.length - 1] : null;

    thread.lookup = pickFirstText([
      thread.lookup,
      threadPayload.lookup,
      threadPayload.lookupNumber,
      threadPayload.lookup_number,
      ...mergedMeta.map((meta) => meta.lookup),
      ...mergedMeta.map((meta) => meta.lookupNumber),
      ...mergedMeta.map((meta) => meta.lookup_number),
      latestEvent?.lookup,
    ]);

    thread.title = pickFirstText([
      thread.title,
      threadPayload.title,
      threadPayload.submissionTitle,
      threadPayload.submission_title,
      ...mergedMeta.map((meta) => meta.title),
      ...mergedMeta.map((meta) => meta.submissionTitle),
      ...mergedMeta.map((meta) => meta.submission_title),
      latestEvent?.title,
    ]);

    thread.creator = pickFirstText([
      thread.creator,
      threadPayload.creator,
      threadPayload.artist,
      ...mergedMeta.map((meta) => meta.creator),
      ...mergedMeta.map((meta) => meta.artist),
      latestEvent?.creator,
    ]);

    thread.sourceLink = pickFirstText([
      thread.sourceLink,
      threadPayload.sourceLink,
      threadPayload.source_link,
      threadPayload.link,
      ...mergedMeta.map((meta) => meta.sourceLink),
      ...mergedMeta.map((meta) => meta.source_link),
      ...mergedMeta.map((meta) => meta.link),
      latestEvent?.sourceLink,
    ]);

    thread.libraryHref = pickFirstText([
      thread.libraryHref,
      threadPayload.libraryHref,
      threadPayload.library_href,
      ...mergedMeta.map((meta) => meta.libraryHref),
      ...mergedMeta.map((meta) => meta.library_href),
      latestEvent?.libraryHref,
    ]);

    thread.currentStatusRaw = pickFirstText([
      thread.currentStatusRaw,
      threadPayload.currentStatusRaw,
      threadPayload.current_status_raw,
      threadPayload.statusRaw,
      threadPayload.status_raw,
      threadPayload.status,
      latestEvent?.statusRaw,
    ]);

    thread.updatedAt = pickFirstText([
      thread.updatedAt,
      threadPayload.updatedAt,
      threadPayload.updated_at,
      threadPayload.receivedAt,
      threadPayload.received_at,
      latestEvent?.createdAt,
    ]);

    return thread;
  }

  function shouldHydrateFromThreadList(thread) {
    return !toSafeText(thread.title) || !toSafeText(thread.creator) || !toSafeText(thread.sourceLink);
  }

  async function hydrateThreadFromList(apiBase, authSnapshot, sid, thread) {
    if (!authSnapshot?.authenticated || !authSnapshot?.token) return thread;
    if (!shouldHydrateFromThreadList(thread)) return thread;

    const listResponse = await fetchJsonWithTimeout(
      `${apiBase}/me/submissions?limit=200&state=all`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${authSnapshot.token}`,
          'content-type': 'application/json',
        },
      },
      FETCH_TIMEOUT_MS,
    );
    if (!listResponse.ok) return thread;

    const listPayload = isObject(listResponse.payload) ? listResponse.payload : {};
    const rows = Array.isArray(listPayload.threads)
      ? listPayload.threads
      : (Array.isArray(listPayload.items) ? listPayload.items : []);
    if (!rows.length) return thread;

    const match = rows.find((row) => {
      const value = isObject(row) ? row : {};
      const rowSid = toSafeText(value.submissionId || value.submission_id, '');
      return rowSid && rowSid === sid;
    });
    if (!isObject(match)) return thread;

    thread.lookup = pickFirstText([thread.lookup, match.lookup, match.lookupNumber, match.lookup_number]);
    thread.title = pickFirstText([thread.title, match.title, match.submissionTitle, match.submission_title]);
    thread.creator = pickFirstText([thread.creator, match.creator, match.artist]);
    thread.currentStatusRaw = pickFirstText([
      thread.currentStatusRaw,
      match.currentStatusRaw,
      match.current_status_raw,
      match.statusRaw,
      match.status_raw,
      match.status,
    ]);
    thread.sourceLink = pickFirstText([thread.sourceLink, match.sourceLink, match.source_link, match.link]);
    thread.libraryHref = pickFirstText([thread.libraryHref, match.libraryHref, match.library_href]);
    thread.updatedAt = pickFirstText([
      thread.updatedAt,
      match.updatedAt,
      match.updated_at,
      match.receivedAt,
      match.received_at,
    ]);

    return thread;
  }

  function renderSignIn(root) {
    root.innerHTML = `
      <aside class="dx-sub-shell" data-dx-submission-shell>
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">Submission Timeline</h1>
          <p class="dx-sub-empty" id="dx-sub-signin">Please sign in to view submission details.</p>
        </section>
      </aside>
    `;
  }

  function renderError(root, title, message) {
    root.innerHTML = `
      <aside class="dx-sub-shell" data-dx-submission-shell>
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${escapeHtml(title || 'Submission Timeline')}</h1>
          <p class="dx-sub-empty">${escapeHtml(message || 'Unable to load this submission right now.')}</p>
        </section>
      </aside>
    `;
  }

  function renderReady(root, model) {
    const acknowledgedFromRail = model.stageRail.some(
      (step) => step.key === 'acknowledged' && (step.state === 'active' || step.state === 'done'),
    );
    const ackDisabled = Boolean(model.thread.acknowledgedAt) || acknowledgedFromRail;

    const timelineHtml = model.timeline.length
      ? model.timeline
          .map((item) => {
            const eventLabel = toSafeText(item.eventType, 'event').replace(/_/g, ' ');
            const note = item.publicNote ? `<p class="dx-sub-item-body">${escapeHtml(item.publicNote)}</p>` : '';
            const statusChip = item.statusRaw
              ? `<span class="dx-sub-chip ${severityChipClass(stageSeverity(item.eventType))}">${escapeHtml(item.statusRaw)}</span>`
              : '';
            const link = item.libraryHref
              ? `<a class="dx-sub-link" href="${escapeHtml(item.libraryHref)}">Library link</a>`
              : '';

            return `
              <article class="dx-sub-item" data-dx-sub-item data-event-id="${escapeHtml(item.id)}">
                <div class="dx-sub-item-head">
                  <p class="dx-sub-item-type">${escapeHtml(eventLabel)}</p>
                  <p class="dx-sub-item-time">${escapeHtml(toDateTime(item.createdAt))}</p>
                </div>
                ${note}
                <div class="dx-sub-links">${statusChip}${link}</div>
              </article>
            `;
          })
          .join('')
      : '<p class="dx-sub-empty">No timeline events yet.</p>';

    const stageRailHtml = model.stageRail
      .map(
        (step) => `
          <article class="dx-sub-stage" data-state="${escapeHtml(step.state)}" data-dx-sub-stage="${escapeHtml(step.key)}">
            <p class="dx-sub-stage-label">${escapeHtml(step.label)}</p>
            <p class="dx-sub-stage-time">${escapeHtml(step.at ? toDateTime(step.at) : '')}</p>
          </article>
        `,
      )
      .join('');

    const warningHtml = model.warning ? `<p class="dx-sub-warning">${escapeHtml(model.warning)}</p>` : '';
    const sourceLink = model.thread.sourceLink
      ? `<a class="dx-sub-link" href="${escapeHtml(model.thread.sourceLink)}">Source submission</a>`
      : '';
    const libraryLink = model.thread.libraryHref
      ? `<a class="dx-sub-link" href="${escapeHtml(model.thread.libraryHref)}">In library</a>`
      : '';

    const titleLine = model.thread.title
      ? `<p class="dx-sub-item-body">${escapeHtml(model.thread.title)}</p>`
      : '<p class="dx-sub-item-body">Untitled submission</p>';
    const creatorLine = model.thread.creator
      ? `<p class="dx-sub-item-body">${escapeHtml(model.thread.creator)}</p>`
      : '';
    const statusLine = model.thread.currentStatusRaw
      ? `<p class="dx-sub-item-body">${escapeHtml(model.thread.currentStatusRaw)}</p>`
      : '';

    root.innerHTML = `
      <aside class="dx-sub-shell" data-dx-submission-shell>
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${escapeHtml(model.thread.lookup || model.thread.title || 'Submission')}</h1>
          <div class="dx-sub-status">
            <span class="dx-sub-chip ${severityChipClass(stageSeverity(model.thread.currentStage))}">${escapeHtml(
              model.thread.currentStage.replace(/_/g, ' '),
            )}</span>
            <span class="dx-sub-chip">Updated ${escapeHtml(toDateTime(model.thread.updatedAt))}</span>
          </div>
        </section>

        <section class="dx-sub-stage-rail" id="dx-sub-stage-rail" data-dx-sub-stage-rail="true">${stageRailHtml}</section>

        <section class="dx-sub-grid">
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Submission</p>
            ${titleLine}
            ${creatorLine}
            ${statusLine}
          </article>
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Links</p>
            <div class="dx-sub-links">${sourceLink}${libraryLink}</div>
          </article>
        </section>

        ${warningHtml}

        <div class="dx-sub-actions">
          <button
            type="button"
            class="dx-sub-btn dx-button-element dx-button-size--sm dx-button-element--primary"
            data-dx-sub-action="ack"
            ${ackDisabled ? 'disabled' : ''}
          >Acknowledge</button>
          <a class="dx-sub-btn dx-button-element dx-button-size--sm dx-button-element--secondary" href="/entry/messages/">Back to inbox</a>
        </div>

        <section class="dx-sub-timeline" id="dx-sub-timeline">${timelineHtml}</section>
      </aside>
    `;
  }

  async function loadSubmissionDetail(apiBase, authSnapshot, sid) {
    const response = await fetchJsonWithTimeout(
      `${apiBase}/me/submissions/${encodeURIComponent(sid)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${authSnapshot.token}`,
          'content-type': 'application/json',
        },
      },
      FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload: response.payload,
      };
    }

    const payload = isObject(response.payload) ? response.payload : {};
    const threadPayload = isObject(payload.thread)
      ? payload.thread
      : (isObject(payload.submission) ? payload.submission : {});
    const timeline = normalizeTimeline(payload.timeline || payload.events);

    const thread = {
      submissionId: toSafeText(threadPayload.submissionId || threadPayload.submission_id, sid),
      lookup: toSafeText(threadPayload.lookup, ''),
      title: toSafeText(threadPayload.title, ''),
      creator: toSafeText(threadPayload.creator, ''),
      currentStage: toSafeText(threadPayload.currentStage || threadPayload.current_stage, 'reviewing'),
      currentStatusRaw: toSafeText(threadPayload.currentStatusRaw || threadPayload.current_status_raw, ''),
      updatedAt: toSafeText(threadPayload.updatedAt || threadPayload.updated_at, ''),
      acknowledgedAt: toSafeText(threadPayload.acknowledgedAt || threadPayload.acknowledged_at, ''),
      sourceLink: toSafeText(threadPayload.sourceLink || threadPayload.source_link, ''),
      libraryHref: toSafeText(threadPayload.libraryHref || threadPayload.library_href, ''),
    };

    hydrateThreadFromFallbacks(thread, threadPayload, timeline);
    await hydrateThreadFromList(apiBase, authSnapshot, sid, thread);

    return {
      ok: true,
      status: response.status,
      thread,
      timeline,
      stageRail: normalizeStageRail(payload.stageRail || payload.stage_rail || payload.rail, timeline, thread),
      warning: '',
    };
  }

  async function acknowledgeSubmission(apiBase, authSnapshot, sid) {
    return fetchJsonWithTimeout(
      `${apiBase}/me/submissions/${encodeURIComponent(sid)}/ack`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${authSnapshot.token}`,
          'content-type': 'application/json',
        },
      },
      FETCH_TIMEOUT_MS,
    );
  }

  function bindActions(root, context) {
    if (root.__dxSubmissionEventAbortController instanceof AbortController) {
      try {
        root.__dxSubmissionEventAbortController.abort();
      } catch {}
    }

    const controller = new AbortController();
    root.__dxSubmissionEventAbortController = controller;

    root.addEventListener(
      'click',
      async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.getAttribute('data-dx-sub-action') !== 'ack') return;

        target.setAttribute('disabled', 'disabled');
        const ackControls = Array.from(document.querySelectorAll('[data-dx-sub-action="ack"]'));
        for (const control of ackControls) {
          if (control instanceof HTMLElement) control.setAttribute('disabled', 'disabled');
        }

        const ack = await acknowledgeSubmission(context.apiBase, context.authSnapshot, context.sid);
        if (ack.ok) {
          const acknowledgedAt = new Date().toISOString();
          context.model.thread.acknowledgedAt = acknowledgedAt;
          const next = await loadSubmissionDetail(context.apiBase, context.authSnapshot, context.sid);
          if (next.ok) {
            if (!next.thread.acknowledgedAt) {
              next.thread.acknowledgedAt = acknowledgedAt;
            }
            context.model = next;
            renderReady(root, context.model);
            bindActions(root, context);
            return;
          }
        }

        context.model.warning = 'Unable to acknowledge this submission right now.';
        renderReady(root, context.model);
        bindActions(root, context);
      },
      { signal: controller.signal },
    );
  }

  async function boot(root, options = {}) {
    const startTs = performance.now();
    setFetchState(root, FETCH_STATE_LOADING);

    const sid = parseSidFromLocation(options.routeUrl || '');
    if (!sid) {
      renderError(root, 'Submission Timeline', 'Missing or invalid submission id.');
      const elapsed = performance.now() - startTs;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const authSnapshot = await resolveAuthSnapshot(AUTH_TIMEOUT_MS);
    if (!authSnapshot.authenticated || !authSnapshot.token) {
      renderSignIn(root);
      const elapsed = performance.now() - startTs;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const apiBase = toApiBase(root);
    const model = await loadSubmissionDetail(apiBase, authSnapshot, sid);

    if (!model.ok) {
      if (model.status === 403 || model.status === 404) {
        renderError(root, 'Submission Timeline', 'Submission not found for this account.');
        const elapsed = performance.now() - startTs;
        if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
        setFetchState(root, FETCH_STATE_READY);
        return;
      }

      renderError(root, 'Submission Timeline', 'Unable to load this submission right now.');
      const elapsed = performance.now() - startTs;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_ERROR);
      return;
    }

    renderReady(root, model);
    bindActions(root, {
      sid,
      apiBase,
      authSnapshot,
      model,
    });

    const elapsed = performance.now() - startTs;
    if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
    setFetchState(root, FETCH_STATE_READY);
  }

  async function mount(options = {}) {
    const root = document.getElementById('dex-submission');
    if (!(root instanceof HTMLElement)) return false;

    const force = !!options.force;
    const isBooting = root.getAttribute('data-dx-sub-booting') === 'true';
    const isMounted = root.getAttribute('data-dx-sub-mounted') === 'true';
    if (isBooting) return true;
    if (isMounted && !force) return true;

    root.setAttribute('data-dx-sub-booting', 'true');
    if (force) root.removeAttribute('data-dx-sub-mounted');

    try {
      await boot(root, options);
      root.setAttribute('data-dx-sub-mounted', 'true');
      return true;
    } catch {
      setFetchState(root, FETCH_STATE_ERROR);
      return false;
    } finally {
      root.removeAttribute('data-dx-sub-booting');
    }
  }

  window.__dxSubmissionTimelineMount = (options = {}) => {
    mount(options).catch(() => {});
  };

  window.addEventListener('dx:slotready', (event) => {
    const detail = (event && isObject(event.detail)) ? event.detail : {};
    const routeUrl = toSafeText(detail.url, '');
    mount({ force: true, routeUrl }).catch(() => {});
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mount().catch(() => {});
      },
      { once: true },
    );
  } else {
    mount().catch(() => {});
  }
})();
