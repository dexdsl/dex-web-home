(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxSubmissionTimelineRuntimeLoaded) {
    if (typeof window.__dxSubmissionTimelineMount === 'function') {
      try {
        window.__dxSubmissionTimelineMount({
          force: true,
          routeUrl: String(window.__dxLastSlotUrl || window.location.href || ''),
        });
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
  const JSONP_TIMEOUT_MS = 6000;
  const MIN_SHELL_MS = 120;
  const DEFAULT_API = 'https://dex-api.spring-fog-8edd.workers.dev';
  const SHEET_API = 'https://script.google.com/macros/s/AKfycbyh5TPML3_y5-j1QoOKfju_MayO1_0JErwvVkH3Eba195q_EmWGCEu3CdFFeohWes3Qzw/exec';
  const SUBMISSION_PENDING_SID_KEY = 'dex:messages:pending-submission-sid';
  const PREFETCH_SWR_MS = 60000;
  const INITIAL_ROUTE_URL = String(window.location.href || '');

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

  function releaseJsonpCallback(callbackName) {
    if (!callbackName) return;
    try {
      window[callbackName] = () => {};
    } catch {}
    window.setTimeout(() => {
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    }, 30000);
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

  function sanitizeSubmissionId(value) {
    return toSafeText(value, '').replace(/[^a-zA-Z0-9._:-]/g, '');
  }

  function readPendingSubmissionSid({ consume = false } = {}) {
    const fromWindow = sanitizeSubmissionId(window.__dxPendingSubmissionSid || '');
    if (fromWindow) {
      if (consume) {
        window.__dxPendingSubmissionSid = '';
        try {
          window.sessionStorage.removeItem(SUBMISSION_PENDING_SID_KEY);
        } catch {}
      }
      return fromWindow;
    }

    let fromStorage = '';
    try {
      fromStorage = sanitizeSubmissionId(window.sessionStorage.getItem(SUBMISSION_PENDING_SID_KEY) || '');
    } catch {
      fromStorage = '';
    }

    if (!fromStorage) return '';
    if (consume) {
      try {
        window.sessionStorage.removeItem(SUBMISSION_PENDING_SID_KEY);
      } catch {}
    }
    return fromStorage;
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

  function nowIso() {
    return new Date().toISOString();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeHref(value) {
    const raw = toSafeText(value, '');
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(raw)) return `https://${raw}`;
    if (raw.startsWith('/')) return raw;
    return raw;
  }

  function extractGoogleDriveFileId(value) {
    const href = normalizeHref(value);
    if (!href) return '';
    try {
      const url = new URL(href, window.location.origin);
      const host = String(url.hostname || '').toLowerCase();
      if (!host.includes('drive.google.com')) return '';

      const filePathMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (filePathMatch?.[1]) return filePathMatch[1];

      const openId = toSafeText(url.searchParams.get('id'), '');
      if (openId) return openId;
    } catch {}
    return '';
  }

  function toGoogleDrivePreviewHref(value) {
    const fileId = extractGoogleDriveFileId(value);
    if (!fileId) return '';
    return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
  }

  function getAuthRuntime() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  function getPrefetchRuntime() {
    const runtime = window.__DX_PREFETCH;
    if (!runtime || typeof runtime.getFresh !== 'function' || typeof runtime.set !== 'function') return null;
    return runtime;
  }

  function getSubmissionDetailPrefetchKey(scope, sid) {
    if (!scope || !sid) return '';
    return `submission:detail:${scope}:${sid}`;
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

  async function jsonpWithTimeout(url, timeoutMs = JSONP_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const callbackName = `dxSubDetailCb${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let settled = false;
      let timer = 0;

      function cleanup() {
        if (timer) window.clearTimeout(timer);
        releaseJsonpCallback(callbackName);
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = (payload) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(payload);
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP request failed'));
      };

      timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP request timed out'));
      }, Math.max(250, timeoutMs));

      const separator = url.includes('?') ? '&' : '?';
      script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
      document.body.appendChild(script);
    });
  }

  function parseSidFromLocation(routeUrl = '') {
    let sid = '';
    if (!sid && INITIAL_ROUTE_URL) {
      try {
        const parsedInitial = new URL(INITIAL_ROUTE_URL, window.location.origin);
        sid = toSafeText(parsedInitial.searchParams.get('sid'), '');
      } catch {}
    }

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

    if (!sid) {
      const cachedRouteUrl = toSafeText(window.__dxLastSlotUrl, '');
      if (cachedRouteUrl) {
        try {
          const parsed = new URL(cachedRouteUrl, window.location.origin);
          const routeParams = new URLSearchParams(parsed.search || '');
          sid = toSafeText(routeParams.get('sid'), '');
        } catch {}
      }
    }

    if (!sid) {
      sid = readPendingSubmissionSid({ consume: false });
    }

    return sanitizeSubmissionId(sid);
  }

  async function resolveSid(routeUrl = '') {
    let sid = parseSidFromLocation(routeUrl);
    if (sid) return sid;

    for (const waitMs of [16, 32, 64, 96, 140, 220, 320, 480]) {
      await delay(waitMs);
      sid = parseSidFromLocation(routeUrl);
      if (sid) return sid;
    }

    return '';
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

  function formatEventLabel(eventType) {
    const normalized = String(eventType || '').trim().toLowerCase();
    const labelMap = {
      lookup_generated: 'Lookup generated',
      lookup_finalized: 'Lookup finalized',
      bucket_assigned: 'Bucket assigned',
      user_acknowledged: 'Acknowledged',
    };
    if (labelMap[normalized]) return labelMap[normalized];
    const fallback = normalized.replace(/_/g, ' ');
    if (!fallback) return 'Event';
    return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  }

  function buildLookupTransitionNote(eventType, metadata, publicNote) {
    if (publicNote) return publicNote;
    const normalized = String(eventType || '').trim().toLowerCase();
    if (!['lookup_generated', 'lookup_finalized', 'bucket_assigned'].includes(normalized)) return '';

    const fromLookup = pickFirstText([
      metadata.fromLookup,
      metadata.from_lookup,
      metadata.previousLookupNumber,
      metadata.previous_lookup_number,
      metadata.submissionLookupNumber,
      metadata.submission_lookup_number,
      metadata.submissionLookupGenerated,
      metadata.submission_lookup_generated,
    ]);
    const toLookup = pickFirstText([
      metadata.toLookup,
      metadata.to_lookup,
      metadata.finalLookupNumber,
      metadata.final_lookup_number,
      metadata.effectiveLookupNumber,
      metadata.effective_lookup_number,
      metadata.lookupNumber,
      metadata.lookup_number,
      metadata.lookup,
    ]);

    if (normalized === 'lookup_generated') {
      const generated = toLookup || fromLookup;
      if (isPlaceholderSubmissionLookup(generated)) return '';
      return generated ? `Submission lookup generated: ${generated}.` : '';
    }

    if (normalized === 'lookup_finalized') {
      if (fromLookup && toLookup && fromLookup !== toLookup) {
        return `Lookup number finalized from ${fromLookup} to ${toLookup}.`;
      }
      return toLookup ? `Lookup number finalized: ${toLookup}.` : '';
    }

    if (normalized === 'bucket_assigned') {
      return toLookup ? `Bucket/file lookup assigned: ${toLookup}.` : '';
    }

    return '';
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

  function isPlaceholderSubmissionLookup(value) {
    const lookup = toSafeText(value, '');
    if (!lookup) return false;
    return /^SUB\d{2}-X\.Unk An O\d{4}$/i.test(lookup);
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
        const instrument = pickFirstText([value.instrument, metadata.instrument]);
        const category = pickFirstText([value.category, metadata.category]);
        const submittedAt = pickFirstText([
          value.submittedAt,
          value.submitted_at,
          value.clientSubmittedAt,
          value.client_submitted_at,
          metadata.submittedAt,
          metadata.submitted_at,
          metadata.clientSubmittedAt,
          metadata.client_submitted_at,
        ]);
        const lookup = pickFirstText([
          value.effectiveLookupNumber,
          value.effective_lookup_number,
          value.finalLookupNumber,
          value.final_lookup_number,
          value.submissionLookupNumber,
          value.submission_lookup_number,
          value.finalLookupBase,
          value.final_lookup_base,
          value.submissionLookupGenerated,
          value.submission_lookup_generated,
          value.lookup,
          metadata.effectiveLookupNumber,
          metadata.effective_lookup_number,
          metadata.finalLookupNumber,
          metadata.final_lookup_number,
          metadata.submissionLookupNumber,
          metadata.submission_lookup_number,
          metadata.finalLookupBase,
          metadata.final_lookup_base,
          metadata.submissionLookupGenerated,
          metadata.submission_lookup_generated,
          metadata.lookup,
          metadata.lookupNumber,
          metadata.lookup_number,
        ]);
        const createdAt = toSafeText(value.eventAt || value.event_at || value.createdAt || value.created_at, '');
        const id = toSafeText(value.id, `timeline-${index + 1}`);
        const displayNote = buildLookupTransitionNote(eventType, metadata, publicNote);
        return {
          id,
          eventType,
          publicNote: displayNote || publicNote,
          statusRaw,
          libraryHref: normalizeHref(libraryHref),
          sourceLink: normalizeHref(sourceLink),
          title,
          creator,
          instrument,
          category,
          submittedAt,
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
      threadPayload.effectiveLookupNumber,
      threadPayload.effective_lookup_number,
      threadPayload.finalLookupNumber,
      threadPayload.final_lookup_number,
      threadPayload.submissionLookupNumber,
      threadPayload.submission_lookup_number,
      threadPayload.finalLookupBase,
      threadPayload.final_lookup_base,
      threadPayload.submissionLookupGenerated,
      threadPayload.submission_lookup_generated,
      threadPayload.lookup,
      threadPayload.lookupNumber,
      threadPayload.lookup_number,
      ...mergedMeta.map((meta) => meta.effectiveLookupNumber),
      ...mergedMeta.map((meta) => meta.effective_lookup_number),
      ...mergedMeta.map((meta) => meta.finalLookupNumber),
      ...mergedMeta.map((meta) => meta.final_lookup_number),
      ...mergedMeta.map((meta) => meta.submissionLookupNumber),
      ...mergedMeta.map((meta) => meta.submission_lookup_number),
      ...mergedMeta.map((meta) => meta.finalLookupBase),
      ...mergedMeta.map((meta) => meta.final_lookup_base),
      ...mergedMeta.map((meta) => meta.submissionLookupGenerated),
      ...mergedMeta.map((meta) => meta.submission_lookup_generated),
      ...mergedMeta.map((meta) => meta.lookup),
      ...mergedMeta.map((meta) => meta.lookupNumber),
      ...mergedMeta.map((meta) => meta.lookup_number),
      latestEvent?.lookup,
    ]);
    thread.submissionLookupNumber = pickFirstText([
      thread.submissionLookupNumber,
      threadPayload.submissionLookupNumber,
      threadPayload.submission_lookup_number,
      threadPayload.submissionLookupGenerated,
      threadPayload.submission_lookup_generated,
      ...mergedMeta.map((meta) => meta.submissionLookupNumber),
      ...mergedMeta.map((meta) => meta.submission_lookup_number),
      ...mergedMeta.map((meta) => meta.submissionLookupGenerated),
      ...mergedMeta.map((meta) => meta.submission_lookup_generated),
    ]);
    thread.finalLookupNumber = pickFirstText([
      thread.finalLookupNumber,
      threadPayload.finalLookupNumber,
      threadPayload.final_lookup_number,
      threadPayload.effectiveLookupNumber,
      threadPayload.effective_lookup_number,
      ...mergedMeta.map((meta) => meta.finalLookupNumber),
      ...mergedMeta.map((meta) => meta.final_lookup_number),
      ...mergedMeta.map((meta) => meta.effectiveLookupNumber),
      ...mergedMeta.map((meta) => meta.effective_lookup_number),
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
    thread.instrument = pickFirstText([
      thread.instrument,
      threadPayload.instrument,
      ...mergedMeta.map((meta) => meta.instrument),
      latestEvent?.instrument,
    ]);
    thread.category = pickFirstText([
      thread.category,
      threadPayload.category,
      ...mergedMeta.map((meta) => meta.category),
      latestEvent?.category,
    ]);
    thread.submittedAt = pickFirstText([
      thread.submittedAt,
      threadPayload.submittedAt,
      threadPayload.submitted_at,
      threadPayload.clientSubmittedAt,
      threadPayload.client_submitted_at,
      ...mergedMeta.map((meta) => meta.submittedAt),
      ...mergedMeta.map((meta) => meta.submitted_at),
      ...mergedMeta.map((meta) => meta.clientSubmittedAt),
      ...mergedMeta.map((meta) => meta.client_submitted_at),
      timelineEvents.find((event) => String(event?.eventType || '').toLowerCase() === 'sent')?.createdAt,
      latestEvent?.submittedAt,
      latestEvent?.createdAt,
    ]);
    thread.sourceLink = normalizeHref(thread.sourceLink);
    thread.libraryHref = normalizeHref(thread.libraryHref);

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
    return (
      !toSafeText(thread.lookup)
      || !toSafeText(thread.title)
      || !toSafeText(thread.creator)
      || !toSafeText(thread.sourceLink)
      || !toSafeText(thread.submissionLookupNumber)
    );
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
      const rowSid = toSafeText(value.submissionId || value.submission_id || value.id, '');
      return rowSid && rowSid === sid;
    });
    if (!isObject(match)) return thread;
    const matchMeta = parseMetadata(match.metadata || match.metadata_json || match.metadataJson || match.meta);

    thread.lookup = pickFirstText([
      thread.lookup,
      match.effectiveLookupNumber,
      match.effective_lookup_number,
      match.finalLookupNumber,
      match.final_lookup_number,
      match.submissionLookupNumber,
      match.submission_lookup_number,
      match.finalLookupBase,
      match.final_lookup_base,
      match.submissionLookupGenerated,
      match.submission_lookup_generated,
      match.lookup,
      match.lookupNumber,
      match.lookup_number,
      matchMeta.lookup,
      matchMeta.lookupNumber,
      matchMeta.lookup_number,
    ]);
    thread.submissionLookupNumber = pickFirstText([
      thread.submissionLookupNumber,
      match.submissionLookupNumber,
      match.submission_lookup_number,
      match.submissionLookupGenerated,
      match.submission_lookup_generated,
      matchMeta.submissionLookupNumber,
      matchMeta.submission_lookup_number,
      matchMeta.submissionLookupGenerated,
      matchMeta.submission_lookup_generated,
    ]);
    thread.finalLookupNumber = pickFirstText([
      thread.finalLookupNumber,
      match.finalLookupNumber,
      match.final_lookup_number,
      match.effectiveLookupNumber,
      match.effective_lookup_number,
      matchMeta.finalLookupNumber,
      matchMeta.final_lookup_number,
      matchMeta.effectiveLookupNumber,
      matchMeta.effective_lookup_number,
    ]);
    thread.title = pickFirstText([thread.title, match.title, match.submissionTitle, match.submission_title, matchMeta.title, matchMeta.submissionTitle, matchMeta.submission_title]);
    thread.creator = pickFirstText([thread.creator, match.creator, match.artist, matchMeta.creator, matchMeta.artist]);
    thread.currentStatusRaw = pickFirstText([
      thread.currentStatusRaw,
      match.currentStatusRaw,
      match.current_status_raw,
      match.statusRaw,
      match.status_raw,
      match.status,
    ]);
    thread.sourceLink = pickFirstText([thread.sourceLink, match.sourceLink, match.source_link, match.link, matchMeta.sourceLink, matchMeta.source_link, matchMeta.link]);
    thread.libraryHref = pickFirstText([thread.libraryHref, match.libraryHref, match.library_href, matchMeta.libraryHref, matchMeta.library_href]);
    thread.instrument = pickFirstText([thread.instrument, match.instrument, matchMeta.instrument]);
    thread.category = pickFirstText([thread.category, match.category, matchMeta.category]);
    thread.submittedAt = pickFirstText([
      thread.submittedAt,
      match.submittedAt,
      match.submitted_at,
      match.clientSubmittedAt,
      match.client_submitted_at,
      match.createdAt,
      match.created_at,
      match.timestamp,
      matchMeta.submittedAt,
      matchMeta.submitted_at,
      matchMeta.clientSubmittedAt,
      matchMeta.client_submitted_at,
    ]);
    thread.updatedAt = pickFirstText([
      thread.updatedAt,
      match.updatedAt,
      match.updated_at,
      match.receivedAt,
      match.received_at,
    ]);
    thread.sourceLink = normalizeHref(thread.sourceLink);
    thread.libraryHref = normalizeHref(thread.libraryHref);

    return thread;
  }

  function statusRawToStage(statusRaw) {
    const normalized = String(statusRaw || '').trim().toLowerCase();
    if (!normalized) return 'reviewing';
    if (normalized.includes('acknowledged')) return 'acknowledged';
    if (normalized.includes('revision')) return 'revision_requested';
    if (normalized.includes('accepted')) return 'accepted';
    if (normalized.includes('rejected')) return 'rejected';
    if (normalized.includes('released') || normalized.includes('published') || normalized.includes('in library')) {
      return 'in_library';
    }
    if (normalized.includes('pending') || normalized.includes('review') || normalized.includes('submitted')) {
      return 'reviewing';
    }
    return 'reviewing';
  }

  function hasTimelineEvent(timeline, ...eventTypes) {
    const wanted = new Set(eventTypes.map((value) => String(value || '').toLowerCase()).filter(Boolean));
    if (!wanted.size) return false;
    return (Array.isArray(timeline) ? timeline : []).some((event) => {
      const type = String(event?.eventType || '').toLowerCase();
      return wanted.has(type);
    });
  }

  function deriveTimelineEvents(timeline, thread) {
    const events = Array.isArray(timeline) ? [...timeline] : [];
    const sid = toSafeText(thread?.submissionId, 'submission');
    const sourceLink = toSafeText(thread?.sourceLink, '');
    const libraryHref = toSafeText(thread?.libraryHref, '');
    const title = toSafeText(thread?.title, '');
    const creator = toSafeText(thread?.creator, '');
    const submissionLookup = pickFirstText([
      thread?.submissionLookupNumber,
      thread?.submissionLookupGenerated,
    ]);
    const finalLookup = pickFirstText([
      thread?.finalLookupNumber,
      thread?.effectiveLookupNumber,
    ]);
    const updatedAt = pickFirstText([thread?.updatedAt, nowIso()]);
    const statusRaw = toSafeText(thread?.currentStatusRaw, '');
    const statusStage = statusRawToStage(statusRaw);

    if (submissionLookup && !hasTimelineEvent(events, 'lookup_generated')) {
      events.push({
        id: `${sid}-lookup-generated`,
        eventType: 'lookup_generated',
        publicNote: '',
        statusRaw: statusRaw || 'lookup generated',
        libraryHref,
        sourceLink,
        title,
        creator,
        lookup: submissionLookup,
        createdAt: updatedAt,
        metadata: {
          submissionLookupNumber: submissionLookup,
          toLookup: submissionLookup,
        },
      });
    }

    if (
      submissionLookup
      && finalLookup
      && finalLookup !== submissionLookup
      && !hasTimelineEvent(events, 'lookup_finalized')
    ) {
      events.push({
        id: `${sid}-lookup-finalized`,
        eventType: 'lookup_finalized',
        publicNote: '',
        statusRaw: statusRaw || 'lookup finalized',
        libraryHref,
        sourceLink,
        title,
        creator,
        lookup: finalLookup,
        createdAt: updatedAt,
        metadata: {
          fromLookup: submissionLookup,
          toLookup: finalLookup,
          submissionLookupNumber: submissionLookup,
          finalLookupNumber: finalLookup,
          effectiveLookupNumber: finalLookup,
        },
      });
    }

    if (statusStage && statusStage !== 'reviewing' && !hasTimelineEvent(events, statusStage)) {
      events.push({
        id: `${sid}-status-${statusStage}`,
        eventType: statusStage,
        publicNote: '',
        statusRaw: statusRaw || statusStage.replace(/_/g, ' '),
        libraryHref,
        sourceLink,
        title,
        creator,
        lookup: finalLookup,
        createdAt: updatedAt,
        metadata: {},
      });
    }

    if (toSafeText(thread?.acknowledgedAt, '') && !hasTimelineEvent(events, 'acknowledged', 'user_acknowledged')) {
      events.push({
        id: `${sid}-acknowledged`,
        eventType: 'user_acknowledged',
        publicNote: '',
        statusRaw: 'acknowledged',
        libraryHref,
        sourceLink,
        title,
        creator,
        lookup: finalLookup || submissionLookup || '',
        createdAt: toSafeText(thread?.acknowledgedAt, updatedAt),
        metadata: {},
      });
    }

    if (libraryHref && !hasTimelineEvent(events, 'in_library')) {
      events.push({
        id: `${sid}-in-library`,
        eventType: 'in_library',
        publicNote: '',
        statusRaw: statusRaw || 'in library',
        libraryHref,
        sourceLink,
        title,
        creator,
        lookup: finalLookup || submissionLookup || '',
        createdAt: updatedAt,
        metadata: {},
      });
    }

    return events;
  }

  function resolveLookupFromLegacyRow(row, fallbackLookup, fallbackSid) {
    const legacy = isObject(row) ? row : {};
    const lookup = pickFirstText([
      legacy.effectiveLookupNumber,
      legacy.effective_lookup_number,
      legacy.finalLookupNumber,
      legacy.final_lookup_number,
      legacy.submissionLookupNumber,
      legacy.submission_lookup_number,
      legacy.finalLookupBase,
      legacy.final_lookup_base,
      legacy.submissionLookupGenerated,
      legacy.submission_lookup_generated,
      legacy.lookup,
      legacy.lookupNumber,
      legacy.lookup_number,
      fallbackLookup,
    ]);
    if (lookup) return lookup;
    const sid = toSafeText(fallbackSid, '');
    if (!sid) return 'Submission';
    return `Submission ${sid.slice(0, 8)}`;
  }

  async function loadSubmissionDetailFallback(apiBase, authSnapshot, sid, failingStatus = 0) {
    const thread = {
      submissionId: sid,
      lookup: '',
      submissionLookupNumber: '',
      finalLookupNumber: '',
      title: '',
      creator: '',
      instrument: '',
      category: '',
      submittedAt: '',
      currentStage: 'reviewing',
      currentStatusRaw: '',
      updatedAt: '',
      acknowledgedAt: '',
      sourceLink: '',
      libraryHref: '',
    };

    await hydrateThreadFromList(apiBase, authSnapshot, sid, thread);

    const essentialsFromThreadList = (
      toSafeText(thread.title)
      && toSafeText(thread.lookup)
      && (toSafeText(thread.sourceLink) || toSafeText(thread.libraryHref))
    );

    const sub = toSafeText(authSnapshot?.sub, '');
    let legacyRow = null;
    if (sub && !essentialsFromThreadList) {
      const legacyResponse = await withTimeout(
        jsonpWithTimeout(`${SHEET_API}?action=list&auth0Sub=${encodeURIComponent(sub)}`, JSONP_TIMEOUT_MS),
        JSONP_TIMEOUT_MS + 100,
        { status: 'timeout', rows: [] },
      );
      const rows = Array.isArray(legacyResponse?.rows) ? legacyResponse.rows : [];
      legacyRow = rows.find((row) => {
        const rowSid = sanitizeSubmissionId(row?.submissionId || row?.submission_id);
        return rowSid && rowSid === sid;
      }) || null;
    }

    if (!legacyRow && !thread.title && !thread.lookup) {
      return null;
    }

    const legacyStatus = toSafeText(legacyRow?.status, thread.currentStatusRaw || 'pending');
    const sentAt = toSafeText(
      legacyRow?.clientSubmittedAt || legacyRow?.client_submitted_at || legacyRow?.timestamp || thread.updatedAt,
      '',
    );
    const receivedAt = toSafeText(legacyRow?.timestamp || sentAt || thread.updatedAt, '');
    const reviewStage = statusRawToStage(legacyStatus);
    const notes = toSafeText(legacyRow?.notes || legacyRow?.note, '');

    thread.lookup = resolveLookupFromLegacyRow(legacyRow, thread.lookup, sid);
    thread.submissionLookupNumber = pickFirstText([
      legacyRow?.submissionLookupNumber,
      legacyRow?.submission_lookup_number,
      thread.submissionLookupNumber,
    ]);
    thread.finalLookupNumber = pickFirstText([
      legacyRow?.finalLookupNumber,
      legacyRow?.final_lookup_number,
      thread.finalLookupNumber,
    ]);
    thread.title = pickFirstText([legacyRow?.title, legacyRow?.submissionTitle, thread.title], '');
    thread.creator = pickFirstText([legacyRow?.creator, legacyRow?.artist, thread.creator], '');
    thread.currentStatusRaw = legacyStatus;
    thread.currentStage = reviewStage;
    thread.sourceLink = pickFirstText([legacyRow?.link, legacyRow?.sourceLink, thread.sourceLink], '');
    thread.libraryHref = pickFirstText([legacyRow?.libraryHref, legacyRow?.library_href, thread.libraryHref], '');
    thread.instrument = pickFirstText([legacyRow?.instrument, legacyRow?.instrument_raw, thread.instrument], '');
    thread.category = pickFirstText([legacyRow?.category, legacyRow?.category_raw, thread.category], '');
    thread.submittedAt = pickFirstText([sentAt, legacyRow?.clientSubmittedAt, legacyRow?.client_submitted_at, thread.submittedAt], '');
    thread.updatedAt = pickFirstText([receivedAt, thread.updatedAt], new Date().toISOString());
    thread.sourceLink = normalizeHref(thread.sourceLink);
    thread.libraryHref = normalizeHref(thread.libraryHref);

    const timeline = [];
    if (sentAt) {
      timeline.push({
        id: `${sid}-sent`,
        eventType: 'sent',
        publicNote: '',
        statusRaw: 'submitted',
        libraryHref: '',
        sourceLink: thread.sourceLink,
        title: thread.title,
        creator: thread.creator,
        lookup: thread.lookup,
        createdAt: sentAt,
        metadata: {},
      });
    }
    if (receivedAt) {
      timeline.push({
        id: `${sid}-received`,
        eventType: 'received',
        publicNote: notes,
        statusRaw: legacyStatus,
        libraryHref: thread.libraryHref,
        sourceLink: thread.sourceLink,
        title: thread.title,
        creator: thread.creator,
        lookup: thread.lookup,
        createdAt: receivedAt,
        metadata: {},
      });
    }
    if (!sentAt && !receivedAt) {
      timeline.push({
        id: `${sid}-status`,
        eventType: reviewStage,
        publicNote: notes,
        statusRaw: legacyStatus,
        libraryHref: thread.libraryHref,
        sourceLink: thread.sourceLink,
        title: thread.title,
        creator: thread.creator,
        lookup: thread.lookup,
        createdAt: thread.updatedAt || new Date().toISOString(),
        metadata: {},
      });
    }

    const warning = failingStatus >= 500
      ? 'Timeline sync is catching up. Showing latest submission details.'
      : 'Using legacy submissions feed while timeline sync catches up.';

    const timelineWithDerived = normalizeTimeline(deriveTimelineEvents(timeline, thread));

    return {
      ok: true,
      status: 200,
      thread,
      timeline: timelineWithDerived,
      stageRail: normalizeStageRail(null, timelineWithDerived, thread),
      warning,
    };
  }

  function renderBreadcrumb(currentLabel = 'submission timeline') {
    return `
      <div class="dex-breadcrumb-overlay">
        <nav class="dex-breadcrumb" aria-label="Breadcrumb" data-dex-breadcrumb>
          <a class="dex-breadcrumb-back" href="/entry/messages/">messages</a>
          <span class="dex-breadcrumb-delimiter" data-dex-breadcrumb-delimiter aria-hidden="true">
            <svg class="dex-breadcrumb-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path data-dex-breadcrumb-path d="M12 2L20 12L12 22L4 12Z"></path>
            </svg>
          </span>
          <span class="dex-breadcrumb-current">${escapeHtml(currentLabel)}</span>
        </nav>
      </div>
    `;
  }

  function renderLoading(root, sid = '') {
    const lookupLabel = toSafeText(sid, '');
    root.innerHTML = `
      <aside class="dx-sub-shell" data-dx-submission-shell data-dx-sub-loading="true">
        ${renderBreadcrumb('submission timeline')}
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${escapeHtml(lookupLabel ? `Submission ${lookupLabel.slice(0, 8)}` : 'Submission Timeline')}</h1>
          <div class="dx-sub-status">
            <span class="dx-sub-chip">Fetching</span>
            <span class="dx-sub-chip">Syncing timeline</span>
          </div>
        </section>
        <section class="dx-sub-grid">
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Submission</p>
            <p class="dx-sub-item-body">Loading submission details…</p>
          </article>
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Links</p>
            <p class="dx-sub-item-body">Validating source links…</p>
          </article>
        </section>
        <section class="dx-sub-timeline">
          <article class="dx-sub-item">
            <div class="dx-sub-item-head">
              <p class="dx-sub-item-type">Fetching timeline events</p>
              <p class="dx-sub-item-time">${escapeHtml(toDateTime(nowIso()))}</p>
            </div>
          </article>
        </section>
        <div class="dx-fetch-shell-overlay" aria-hidden="true">
          <div class="dx-fetch-shell dx-fetch-shell--card">
            <span class="dx-fetch-shell-pill"></span>
            <span class="dx-fetch-shell-line"></span>
            <span class="dx-fetch-shell-line"></span>
            <span class="dx-fetch-shell-line" style="width: 66%;"></span>
          </div>
        </div>
      </aside>
    `;
  }

  function renderSignIn(root) {
    root.innerHTML = `
      <aside class="dx-sub-shell" data-dx-submission-shell>
        ${renderBreadcrumb('submission timeline')}
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
        ${renderBreadcrumb('submission timeline')}
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
            const eventLabel = formatEventLabel(item.eventType);
            const note = item.publicNote ? `<p class="dx-sub-item-body">${escapeHtml(item.publicNote)}</p>` : '';
            const statusChip = item.statusRaw
              ? `<span class="dx-sub-chip ${severityChipClass(stageSeverity(item.eventType))}">${escapeHtml(item.statusRaw)}</span>`
              : '';
            const eventLink = normalizeHref(item.sourceLink || item.libraryHref || '');
            const link = eventLink
              ? `<a class="dx-sub-link" href="${escapeHtml(eventLink)}" target="_blank" rel="noopener">Submission link</a>`
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
    const submissionLinkHref = normalizeHref(model.thread.sourceLink || '');
    const publishedLinkHref = normalizeHref(model.thread.libraryHref || '');
    const sourceLink = submissionLinkHref
      ? `<a class="dx-sub-link" href="${escapeHtml(submissionLinkHref)}" target="_blank" rel="noopener">Submission link</a>`
      : '';
    const releaseLink = publishedLinkHref
      ? `<a class="dx-sub-link" href="${escapeHtml(publishedLinkHref)}" target="_blank" rel="noopener">Published release link</a>`
      : '';
    const previewHref = toGoogleDrivePreviewHref(submissionLinkHref);
    const previewHtml = previewHref
      ? `
        <div class="dx-sub-preview" data-dx-sub-preview="drive">
          <p class="dx-sub-kicker">Preview</p>
          <iframe
            class="dx-sub-preview-frame"
            src="${escapeHtml(previewHref)}"
            title="Submission preview"
            loading="lazy"
            allow="autoplay; fullscreen"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      `
      : '';

    const titleLine = model.thread.title
      ? `<p class="dx-sub-item-body">${escapeHtml(model.thread.title)}</p>`
      : model.thread.lookup
        ? `<p class="dx-sub-item-body">${escapeHtml(model.thread.lookup)}</p>`
        : '<p class="dx-sub-item-body">Submission</p>';
    const creatorLine = model.thread.creator
      ? `<p class="dx-sub-item-body">Creator: ${escapeHtml(model.thread.creator)}</p>`
      : '';
    const submittedAtLine = model.thread.submittedAt
      ? `<p class="dx-sub-item-body">Submitted: ${escapeHtml(toDateTime(model.thread.submittedAt))}</p>`
      : '';
    const instrumentLine = model.thread.instrument
      ? `<p class="dx-sub-item-body">Instrument: ${escapeHtml(model.thread.instrument)}</p>`
      : '';
    const categoryLine = model.thread.category
      ? `<p class="dx-sub-item-body">Category: ${escapeHtml(model.thread.category)}</p>`
      : '';
    const statusLine = model.thread.currentStatusRaw
      ? `<p class="dx-sub-item-body">Status: ${escapeHtml(model.thread.currentStatusRaw)}</p>`
      : '';

    const displayLookup = toSafeText(model.thread.lookup, '');
    const displayTitle = isPlaceholderSubmissionLookup(displayLookup) && model.thread.title
      ? model.thread.title
      : (displayLookup || model.thread.title || 'Submission');

    root.innerHTML = `
      <aside class="dx-sub-shell" data-dx-submission-shell>
        ${renderBreadcrumb('submission timeline')}
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${escapeHtml(displayTitle)}</h1>
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
            ${submittedAtLine}
            ${instrumentLine}
            ${categoryLine}
            ${statusLine}
          </article>
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Links</p>
            <div class="dx-sub-links">${sourceLink}${releaseLink}</div>
            ${previewHtml}
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
      if (response.status !== 403 && response.status !== 404) {
        const fallback = await loadSubmissionDetailFallback(apiBase, authSnapshot, sid, response.status);
        if (fallback) {
          return fallback;
        }
      }
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
    let timeline = normalizeTimeline(payload.timeline || payload.events);

    const thread = {
      submissionId: toSafeText(threadPayload.submissionId || threadPayload.submission_id || threadPayload.id, sid),
      lookup: pickFirstText([
        threadPayload.effectiveLookupNumber,
        threadPayload.effective_lookup_number,
        threadPayload.finalLookupNumber,
        threadPayload.final_lookup_number,
        threadPayload.submissionLookupNumber,
        threadPayload.submission_lookup_number,
        threadPayload.finalLookupBase,
        threadPayload.final_lookup_base,
        threadPayload.submissionLookupGenerated,
        threadPayload.submission_lookup_generated,
        threadPayload.lookup,
      ]),
      submissionLookupNumber: toSafeText(
        threadPayload.submissionLookupNumber
        || threadPayload.submission_lookup_number
        || threadPayload.submissionLookupGenerated
        || threadPayload.submission_lookup_generated,
        '',
      ),
      finalLookupNumber: toSafeText(
        threadPayload.finalLookupNumber
        || threadPayload.final_lookup_number
        || threadPayload.effectiveLookupNumber
        || threadPayload.effective_lookup_number,
        '',
      ),
      title: toSafeText(threadPayload.title, ''),
      creator: toSafeText(threadPayload.creator, ''),
      instrument: toSafeText(threadPayload.instrument, ''),
      category: toSafeText(threadPayload.category, ''),
      submittedAt: toSafeText(
        threadPayload.submittedAt
        || threadPayload.submitted_at
        || threadPayload.clientSubmittedAt
        || threadPayload.client_submitted_at
        || threadPayload.sentAt
        || threadPayload.sent_at,
        '',
      ),
      currentStage: toSafeText(threadPayload.currentStage || threadPayload.current_stage, 'reviewing'),
      currentStatusRaw: toSafeText(threadPayload.currentStatusRaw || threadPayload.current_status_raw, ''),
      updatedAt: toSafeText(threadPayload.updatedAt || threadPayload.updated_at, ''),
      acknowledgedAt: toSafeText(threadPayload.acknowledgedAt || threadPayload.acknowledged_at, ''),
      sourceLink: normalizeHref(toSafeText(threadPayload.sourceLink || threadPayload.source_link || threadPayload.link, '')),
      libraryHref: normalizeHref(toSafeText(threadPayload.libraryHref || threadPayload.library_href, '')),
    };

    hydrateThreadFromFallbacks(thread, threadPayload, timeline);
    await hydrateThreadFromList(apiBase, authSnapshot, sid, thread);

    const isSparseThread = !toSafeText(thread.title)
      || !toSafeText(thread.lookup)
      || (!toSafeText(thread.sourceLink) && !toSafeText(thread.libraryHref));

    let warning = '';
    if (isSparseThread) {
      const fallback = await loadSubmissionDetailFallback(apiBase, authSnapshot, sid, response.status);
      if (fallback?.ok) {
        hydrateThreadFromFallbacks(thread, fallback.thread || {}, fallback.timeline || []);
        timeline = normalizeTimeline([...(timeline || []), ...((fallback.timeline || []))]);
        warning = toSafeText(fallback.warning, '');
      }
    }

    const timelineWithDerived = normalizeTimeline(deriveTimelineEvents(timeline, thread));

    const resolved = {
      ok: true,
      status: response.status,
      thread,
      timeline: timelineWithDerived,
      stageRail: normalizeStageRail(payload.stageRail || payload.stage_rail || payload.rail, timelineWithDerived, thread),
      warning,
    };
    const scope = toSafeText(authSnapshot?.sub, '');
    const prefetch = getPrefetchRuntime();
    const cacheKey = getSubmissionDetailPrefetchKey(scope, sid);
    if (prefetch && cacheKey) {
      prefetch.set(cacheKey, resolved, { scope });
    }
    return resolved;
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
    renderLoading(root);

    const sid = await resolveSid(options.routeUrl || '');
    if (!sid) {
      renderError(root, 'Submission Timeline', 'Missing or invalid submission id.');
      const elapsed = performance.now() - startTs;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_READY);
      return;
    }
    readPendingSubmissionSid({ consume: true });
    renderLoading(root, sid);

    const authSnapshot = await resolveAuthSnapshot(AUTH_TIMEOUT_MS);
    if (!authSnapshot.authenticated || !authSnapshot.token) {
      renderSignIn(root);
      const elapsed = performance.now() - startTs;
      if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const apiBase = toApiBase(root);
    const scope = toSafeText(authSnapshot?.sub, '');
    const prefetch = getPrefetchRuntime();
    const cacheKey = getSubmissionDetailPrefetchKey(scope, sid);
    let renderedFromCache = false;

    if (prefetch && cacheKey) {
      const cached = prefetch.getFresh(cacheKey, PREFETCH_SWR_MS);
      if (cached?.payload?.ok) {
        renderReady(root, cached.payload);
        bindActions(root, {
          sid,
          apiBase,
          authSnapshot,
          model: cached.payload,
        });
        renderedFromCache = true;
      }
    }

    const model = await loadSubmissionDetail(apiBase, authSnapshot, sid);

    if (!model.ok) {
      if (model.status === 403 || model.status === 404) {
        renderError(root, 'Submission Timeline', 'Submission not found for this account.');
        const elapsed = performance.now() - startTs;
        if (elapsed < MIN_SHELL_MS) await delay(MIN_SHELL_MS - elapsed);
        setFetchState(root, FETCH_STATE_READY);
        return;
      }

      if (renderedFromCache) {
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
    if (prefetch && cacheKey) {
      prefetch.set(cacheKey, model, { scope });
    }
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
    if (isBooting) {
      if (force) {
        root.setAttribute('data-dx-sub-pending-mount', 'true');
        const pendingRouteUrl = toSafeText(options.routeUrl, '');
        if (pendingRouteUrl) {
          root.setAttribute('data-dx-sub-pending-route-url', pendingRouteUrl);
        }
      }
      return true;
    }
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
      const shouldRerun = root.getAttribute('data-dx-sub-pending-mount') === 'true';
      if (shouldRerun) {
        const pendingRouteUrl = toSafeText(root.getAttribute('data-dx-sub-pending-route-url'), '');
        root.removeAttribute('data-dx-sub-pending-mount');
        root.removeAttribute('data-dx-sub-pending-route-url');
        mount({ force: true, routeUrl: pendingRouteUrl || toSafeText(options.routeUrl, '') }).catch(() => {});
      }
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
