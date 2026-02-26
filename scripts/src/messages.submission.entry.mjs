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
    const configured =
      root?.dataset?.api ||
      window.DEX_API_BASE_URL ||
      window.DEX_API_ORIGIN ||
      DEFAULT_API;
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

  function parseSidFromLocation() {
    const params = new URLSearchParams(window.location.search || '');
    const sid = toSafeText(params.get('sid'), '').replace(/[^a-zA-Z0-9._:-]/g, '');
    return sid;
  }

  function ensureStyles() {
    if (document.getElementById('dx-submission-runtime-style')) return;
    const style = document.createElement('style');
    style.id = 'dx-submission-runtime-style';
    style.textContent = `
      #dex-submission{width:100%;}
      #dex-submission .dx-sub-shell{display:grid;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.32);border-radius:10px;background:rgba(255,255,255,.18);backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%);box-shadow:0 8px 24px rgba(0,0,0,.12);font-family:'Courier New',monospace;color:#171a1f;}
      #dex-submission .dx-sub-head{display:grid;gap:8px;}
      #dex-submission .dx-sub-kicker{margin:0;font-size:.75rem;letter-spacing:.04em;text-transform:uppercase;color:rgba(17,24,39,.7);}
      #dex-submission .dx-sub-title{margin:0;font-family:'Typefesse',sans-serif;font-size:clamp(1.2rem,3.1vw,1.9rem);line-height:1.12;}
      #dex-submission .dx-sub-status{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      #dex-submission .dx-sub-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.45);border-radius:7px;padding:4px 8px;font-size:.74rem;background:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.02em;}
      #dex-submission .dx-sub-chip--critical{background:rgba(168,27,27,.14);border-color:rgba(168,27,27,.34);}
      #dex-submission .dx-sub-chip--warning{background:rgba(193,116,0,.14);border-color:rgba(193,116,0,.34);}
      #dex-submission .dx-sub-chip--info{background:rgba(22,80,173,.11);border-color:rgba(22,80,173,.26);}
      #dex-submission .dx-sub-stage-rail{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;}
      #dex-submission .dx-sub-stage{border:1px solid rgba(255,255,255,.32);border-radius:8px;padding:8px;background:rgba(255,255,255,.5);display:grid;gap:4px;min-height:62px;}
      #dex-submission .dx-sub-stage[data-state='done']{border-color:rgba(18,116,35,.46);background:rgba(27,138,50,.14);}
      #dex-submission .dx-sub-stage[data-state='active']{border-color:rgba(255,25,16,.52);background:rgba(255,25,16,.13);box-shadow:inset 0 0 0 1px rgba(255,25,16,.27);}
      #dex-submission .dx-sub-stage[data-state='todo']{opacity:.76;}
      #dex-submission .dx-sub-stage-label{margin:0;font-size:.82rem;font-weight:700;}
      #dex-submission .dx-sub-stage-time{margin:0;font-size:.74rem;color:rgba(17,24,39,.7);}
      #dex-submission .dx-sub-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
      #dex-submission .dx-sub-card{border:1px solid rgba(255,255,255,.34);border-radius:8px;padding:10px;background:rgba(255,255,255,.58);display:grid;gap:6px;}
      #dex-submission .dx-sub-links{display:flex;gap:8px;flex-wrap:wrap;}
      #dex-submission .dx-sub-link{display:inline-flex;align-items:center;gap:6px;font-size:.84rem;color:#111827;text-decoration:none;}
      #dex-submission .dx-sub-link:hover{text-decoration:underline;}
      #dex-submission .dx-sub-timeline{display:grid;gap:8px;}
      #dex-submission .dx-sub-item{border:1px solid rgba(255,255,255,.32);border-radius:8px;padding:10px;background:rgba(255,255,255,.66);display:grid;gap:6px;}
      #dex-submission .dx-sub-item-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;}
      #dex-submission .dx-sub-item-type{margin:0;font-size:.78rem;letter-spacing:.03em;text-transform:uppercase;color:rgba(17,24,39,.72);}
      #dex-submission .dx-sub-item-time{margin:0;font-size:.74rem;color:rgba(17,24,39,.72);}
      #dex-submission .dx-sub-item-body{margin:0;font-size:.88rem;line-height:1.35;color:#111827;}
      #dex-submission .dx-sub-actions{display:flex;gap:8px;flex-wrap:wrap;}
      #dex-submission .dx-sub-btn{appearance:none;border:1px solid rgba(255,255,255,.42);background:rgba(255,255,255,.6);color:#111827;border-radius:8px;padding:7px 10px;font-size:.8rem;line-height:1;cursor:pointer;}
      #dex-submission .dx-sub-btn:disabled{opacity:.5;cursor:not-allowed;}
      #dex-submission .dx-sub-warning{margin:0;padding:10px 12px;border:1px solid rgba(255,180,0,.45);border-radius:8px;background:rgba(255,191,0,.14);font-size:.85rem;}
      #dex-submission .dx-sub-empty{margin:0;padding:14px 12px;border:1px dashed rgba(17,24,39,.3);border-radius:9px;background:rgba(255,255,255,.45);font-size:.9rem;}
      @media (max-width:880px){
        #dex-submission .dx-sub-grid{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(style);
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

  function normalizeTimeline(timeline) {
    const rows = Array.isArray(timeline) ? timeline : [];
    return rows
      .map((row, index) => {
        const value = isObject(row) ? row : {};
        const eventType = toSafeText(value.eventType || value.event_type || value.stage, 'event');
        const publicNote = toSafeText(value.publicNote || value.public_note, '');
        const statusRaw = toSafeText(value.statusRaw || value.status_raw, '');
        const libraryHref = toSafeText(value.libraryHref || value.library_href, '');
        const createdAt = toSafeText(value.eventAt || value.event_at || value.createdAt || value.created_at, '');
        const id = toSafeText(value.id, `timeline-${index + 1}`);
        return {
          id,
          eventType,
          publicNote,
          statusRaw,
          libraryHref,
          createdAt,
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

  function renderSignIn(root) {
    root.innerHTML = `
      <aside class="dx-sub-shell">
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
      <aside class="dx-sub-shell">
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${escapeHtml(title || 'Submission Timeline')}</h1>
          <p class="dx-sub-empty">${escapeHtml(message || 'Unable to load this submission right now.')}</p>
        </section>
      </aside>
    `;
  }

  function renderTimeline(root, model) {
    ensureStyles();
    const timelineHtml = model.timeline.length
      ? model.timeline
        .map((event) => {
          const typeLabel = toSafeText(event.eventType, 'event').replace(/_/g, ' ');
          const body = event.publicNote
            ? `<p class="dx-sub-item-body">${escapeHtml(event.publicNote)}</p>`
            : '';
          const status = event.statusRaw
            ? `<span class="dx-sub-chip ${severityChipClass(stageSeverity(event.eventType))}">${escapeHtml(event.statusRaw)}</span>`
            : '';
          const libraryLink = event.libraryHref
            ? `<a class="dx-sub-link" href="${escapeHtml(event.libraryHref)}">Library link</a>`
            : '';
          return `
            <article class="dx-sub-item" data-dx-sub-item data-event-id="${escapeHtml(event.id)}">
              <div class="dx-sub-item-head">
                <p class="dx-sub-item-type">${escapeHtml(typeLabel)}</p>
                <p class="dx-sub-item-time">${escapeHtml(toDateTime(event.createdAt))}</p>
              </div>
              ${body}
              <div class="dx-sub-links">${status}${libraryLink}</div>
            </article>
          `;
        })
        .join('')
      : `<p class="dx-sub-empty">No timeline events yet.</p>`;

    const railHtml = model.stageRail
      .map((step) => `
        <article class="dx-sub-stage" data-state="${escapeHtml(step.state)}">
          <p class="dx-sub-stage-label">${escapeHtml(step.label)}</p>
          <p class="dx-sub-stage-time">${escapeHtml(step.at ? toDateTime(step.at) : '')}</p>
        </article>
      `)
      .join('');

    const warningHtml = model.warning
      ? `<p class="dx-sub-warning">${escapeHtml(model.warning)}</p>`
      : '';

    const sourceLink = model.thread.sourceLink
      ? `<a class="dx-sub-link" href="${escapeHtml(model.thread.sourceLink)}">Source submission</a>`
      : '';
    const libraryLink = model.thread.libraryHref
      ? `<a class="dx-sub-link" href="${escapeHtml(model.thread.libraryHref)}">In library</a>`
      : '';

    root.innerHTML = `
      <aside class="dx-sub-shell">
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${escapeHtml(model.thread.lookup || model.thread.title || 'Submission')}</h1>
          <div class="dx-sub-status">
            <span class="dx-sub-chip ${severityChipClass(stageSeverity(model.thread.currentStage))}">${escapeHtml(model.thread.currentStage.replace(/_/g, ' '))}</span>
            <span class="dx-sub-chip">Updated ${escapeHtml(toDateTime(model.thread.updatedAt))}</span>
          </div>
        </section>

        <section class="dx-sub-stage-rail" id="dx-sub-stage-rail">${railHtml}</section>

        <section class="dx-sub-grid">
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Submission</p>
            <p class="dx-sub-item-body">${escapeHtml(model.thread.title || 'Untitled submission')}</p>
            <p class="dx-sub-item-body">${escapeHtml(model.thread.creator || '')}</p>
            <p class="dx-sub-item-body">${escapeHtml(model.thread.currentStatusRaw || '')}</p>
          </article>
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Links</p>
            <div class="dx-sub-links">${sourceLink}${libraryLink}</div>
          </article>
        </section>

        ${warningHtml}

        <section>
          <div class="dx-sub-actions">
            <button type="button" class="dx-sub-btn" data-dx-sub-action="ack" ${model.thread.acknowledgedAt ? 'disabled' : ''}>Acknowledge</button>
            <a class="dx-sub-btn" href="/entry/messages/">Back to inbox</a>
          </div>
        </section>

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
    const threadRaw = isObject(payload.thread) ? payload.thread : {};
    const timelineRaw = normalizeTimeline(payload.timeline);
    const thread = {
      submissionId: toSafeText(threadRaw.submissionId || threadRaw.submission_id, sid),
      lookup: toSafeText(threadRaw.lookup, ''),
      title: toSafeText(threadRaw.title, ''),
      creator: toSafeText(threadRaw.creator, ''),
      currentStage: toSafeText(threadRaw.currentStage || threadRaw.current_stage, 'reviewing'),
      currentStatusRaw: toSafeText(threadRaw.currentStatusRaw || threadRaw.current_status_raw, ''),
      updatedAt: toSafeText(threadRaw.updatedAt || threadRaw.updated_at, ''),
      acknowledgedAt: toSafeText(threadRaw.acknowledgedAt || threadRaw.acknowledged_at, ''),
      sourceLink: toSafeText(threadRaw.sourceLink || threadRaw.source_link, ''),
      libraryHref: toSafeText(threadRaw.libraryHref || threadRaw.library_href, ''),
    };

    return {
      ok: true,
      status: response.status,
      thread,
      timeline: timelineRaw,
      stageRail: normalizeStageRail(payload.stageRail || payload.stage_rail, timelineRaw, thread),
      warning: '',
    };
  }

  async function postAcknowledge(apiBase, authSnapshot, sid) {
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

  function bindHandlers(root, context) {
    if (root.__dxSubmissionEventAbortController instanceof AbortController) {
      try {
        root.__dxSubmissionEventAbortController.abort();
      } catch {}
    }

    const controller = new AbortController();
    root.__dxSubmissionEventAbortController = controller;

    root.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-dx-sub-action');
      if (action !== 'ack') return;

      target.setAttribute('disabled', 'disabled');
      const ack = await postAcknowledge(context.apiBase, context.authSnapshot, context.sid);
      if (ack.ok) {
        const detail = await loadSubmissionDetail(context.apiBase, context.authSnapshot, context.sid);
        if (detail.ok) {
          context.model = detail;
          renderTimeline(root, context.model);
          bindHandlers(root, context);
          return;
        }
      }

      context.model.warning = 'Unable to acknowledge this submission right now.';
      renderTimeline(root, context.model);
      bindHandlers(root, context);
    }, { signal: controller.signal });
  }

  async function boot(root) {
    ensureStyles();
    const start = performance.now();
    setFetchState(root, FETCH_STATE_LOADING);

    const sid = parseSidFromLocation();
    if (!sid) {
      renderError(root, 'Submission Timeline', 'Missing or invalid submission id.');
      const elapsed = performance.now() - start;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const authSnapshot = await resolveAuthSnapshot(AUTH_TIMEOUT_MS);
    if (!authSnapshot.authenticated || !authSnapshot.token) {
      renderSignIn(root);
      const elapsed = performance.now() - start;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const apiBase = toApiBase(root);
    const detail = await loadSubmissionDetail(apiBase, authSnapshot, sid);
    if (!detail.ok) {
      if (detail.status === 403 || detail.status === 404) {
        renderError(root, 'Submission Timeline', 'Submission not found for this account.');
        const elapsed = performance.now() - start;
        if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
        setFetchState(root, FETCH_STATE_READY);
        return;
      }

      renderError(root, 'Submission Timeline', 'Unable to load this submission right now.');
      const elapsed = performance.now() - start;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_ERROR);
      return;
    }

    renderTimeline(root, detail);
    bindHandlers(root, {
      sid,
      apiBase,
      authSnapshot,
      model: detail,
    });

    const elapsed = performance.now() - start;
    if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
    setFetchState(root, FETCH_STATE_READY);
  }

  async function mount(options = {}) {
    const root = document.getElementById('dex-submission');
    if (!(root instanceof HTMLElement)) return false;

    const force = !!options.force;
    const booting = root.getAttribute('data-dx-sub-booting') === 'true';
    const mounted = root.getAttribute('data-dx-sub-mounted') === 'true';
    if (booting) return true;
    if (mounted && !force) return true;

    root.setAttribute('data-dx-sub-booting', 'true');
    if (force) root.removeAttribute('data-dx-sub-mounted');

    try {
      await boot(root);
      root.setAttribute('data-dx-sub-mounted', 'true');
      return true;
    } catch {
      setFetchState(root, FETCH_STATE_ERROR);
      return false;
    } finally {
      root.removeAttribute('data-dx-sub-booting');
    }
  }

  function scheduleMount(options = {}) {
    mount(options).catch(() => {});
  }

  window.__dxSubmissionTimelineMount = () => {
    scheduleMount();
  };

  window.addEventListener('dx:slotready', () => {
    scheduleMount({ force: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleMount(), { once: true });
  } else {
    scheduleMount();
  }
})();
