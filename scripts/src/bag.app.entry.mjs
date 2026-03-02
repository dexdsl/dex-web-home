(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxBagAppLoaded) return;
  window.__dxBagAppLoaded = true;

  const ROOT_ID = 'dex-bag';
  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';
  const FETCH_TIMEOUT_MS = 9000;
  const RESUME_KEY = 'dex:bag:resume:v1';

  function toText(value) {
    return String(value ?? '');
  }

  function normalizeLookup(value) {
    return toText(value).trim();
  }

  function normalizeBucket(value) {
    const bucket = toText(value).trim().toUpperCase();
    return /^[A-Z]$/.test(bucket) ? bucket : '';
  }

  function normalizeMediaType(value) {
    const mediaType = toText(value).trim().toLowerCase();
    return mediaType === 'audio' || mediaType === 'video' ? mediaType : '';
  }

  function htmlEscape(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getApiBase() {
    const configured = toText(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API_BASE).trim();
    return configured.replace(/\/+$/, '');
  }

  function getAuth() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  function withTimeout(promise, timeoutMs, fallbackValue = null) {
    const ms = Number(timeoutMs);
    const safeMs = Number.isFinite(ms) && ms > 0 ? ms : FETCH_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        if (fallbackValue !== null) {
          resolve(fallbackValue);
          return;
        }
        reject(new Error('timeout'));
      }, safeMs);
      Promise.resolve(promise)
        .then((value) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (fallbackValue !== null) {
            resolve(fallbackValue);
            return;
          }
          reject(error);
        });
    });
  }

  async function resolveAuthSnapshot(timeoutMs = 2200) {
    const auth = getAuth();
    if (!auth) {
      return { auth: null, authenticated: false, token: '', user: null };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(auth.resolve(timeoutMs), timeoutMs, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, timeoutMs, null);
      }
    } catch {}

    let authenticated = false;
    let token = '';
    let user = null;

    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await withTimeout(auth.isAuthenticated(), timeoutMs, false));
      }
    } catch {
      authenticated = false;
    }

    if (authenticated && typeof auth.getAccessToken === 'function') {
      try {
        token = toText(await withTimeout(auth.getAccessToken(), timeoutMs, ''));
      } catch {
        token = '';
      }
    }

    if (authenticated && typeof auth.getUser === 'function') {
      try {
        user = await withTimeout(auth.getUser(), timeoutMs, null);
      } catch {
        user = null;
      }
    }

    return { auth, authenticated, token, user };
  }

  async function requestJson(pathname, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const token = toText(options.token);
    const body = options.body;
    const headers = {
      accept: 'application/json',
    };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${getApiBase()}${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        signal: ctrl.signal,
      });
      const text = await response.text();
      let payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { raw: text };
      }
      if (!response.ok) {
        const err = new Error(toText(payload?.message || payload?.error || `http_${response.status}`) || `http_${response.status}`);
        err.status = response.status;
        if (response.status === 401 || response.status === 403) err.code = 'forbidden';
        else if (response.status === 404) err.code = 'not-found';
        else err.code = 'failed';
        err.payload = payload;
        throw err;
      }
      return payload;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeAvailableTypes(input, fallbackType = '') {
    const seen = new Set();
    const out = [];
    const add = (value) => {
      const mediaType = normalizeMediaType(value);
      if (!mediaType || seen.has(mediaType)) return;
      seen.add(mediaType);
      out.push(mediaType);
    };
    if (Array.isArray(input)) {
      input.forEach(add);
    } else {
      const raw = toText(input).trim();
      if (raw) raw.split(',').forEach(add);
    }
    if (!out.length) add(fallbackType);
    out.sort();
    return out;
  }

  function normalizeLookupFiles(payload = {}, lookup) {
    const list = Array.isArray(payload?.files)
      ? payload.files
      : (Array.isArray(payload?.lookup?.files)
        ? payload.lookup.files
        : (Array.isArray(payload?.items) ? payload.items : []));
    return list
      .map((row) => {
        const bucket = normalizeBucket(row?.bucket || toText(row?.bucketNumber).split('.')[0]);
        const fileId = toText(row?.fileId || row?.assetId || row?.id).trim();
        const type = normalizeMediaType(row?.type || row?.media_type);
        const availableTypes = normalizeAvailableTypes(row?.availableTypes || row?.available_types, type);
        const label = toText(row?.label || row?.sourceLabel || row?.bucketNumber || fileId).trim();
        if (!bucket || !fileId) return null;
        return {
          lookup,
          bucket,
          fileId,
          label,
          type,
          availableTypes,
        };
      })
      .filter(Boolean);
  }

  function summarizeNode(node) {
    if (!node || typeof node !== 'object') return '';
    if (node.kind === 'collection') return 'Whole collection';
    if (node.kind === 'bucket') return `${node.bucket} bucket`;
    if (node.kind === 'type') return `${node.bucket} ${String(node.mediaType || '').toUpperCase()}`;
    if (node.kind === 'file') return `${node.bucket}.${node.fileId}`;
    return node.kind || 'Selection';
  }

  function expandSelectionsForLookup(rows, files) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const fileRows = Array.isArray(files) ? files : [];
    if (!normalizedRows.length || !fileRows.length) return [];

    const hasCollection = normalizedRows.some((row) => row.kind === 'collection');
    if (hasCollection) {
      return fileRows.map((file) => ({
        ...file,
        dedupeKey: `${file.lookup}|${file.fileId}|${file.availableTypes.join(',')}`,
      }));
    }

    const selectedBuckets = new Set(normalizedRows.filter((row) => row.kind === 'bucket').map((row) => normalizeBucket(row.bucket)).filter(Boolean));
    const selectedTypes = normalizedRows
      .filter((row) => row.kind === 'type')
      .map((row) => ({ bucket: normalizeBucket(row.bucket), mediaType: normalizeMediaType(row.mediaType) }))
      .filter((row) => row.bucket && row.mediaType && !selectedBuckets.has(row.bucket));
    const selectedFiles = normalizedRows
      .filter((row) => row.kind === 'file')
      .map((row) => ({
        bucket: normalizeBucket(row.bucket),
        fileId: toText(row.fileId).trim(),
        mediaTypes: normalizeAvailableTypes(row.mediaTypes, row.mediaType),
      }))
      .filter((row) => row.bucket && row.fileId && !selectedBuckets.has(row.bucket));

    const out = [];
    const addFile = (file, mediaTypesOverride = null) => {
      const mediaTypes = Array.isArray(mediaTypesOverride) && mediaTypesOverride.length
        ? mediaTypesOverride.slice().sort()
        : (Array.isArray(file.availableTypes) ? file.availableTypes.slice().sort() : []);
      const dedupeKey = `${file.lookup}|${file.fileId}|${mediaTypes.join(',')}`;
      out.push({ ...file, availableTypes: mediaTypes, dedupeKey });
    };

    for (const file of fileRows) {
      if (selectedBuckets.has(file.bucket)) {
        addFile(file);
        continue;
      }
      let selectedByType = false;
      for (const typeRow of selectedTypes) {
        if (typeRow.bucket !== file.bucket) continue;
        if (!file.availableTypes.includes(typeRow.mediaType)) continue;
        addFile(file, [typeRow.mediaType]);
        selectedByType = true;
      }
      if (selectedByType) continue;
      const exact = selectedFiles.find((row) => row.bucket === file.bucket && row.fileId === file.fileId);
      if (!exact) continue;
      const mediaTypes = exact.mediaTypes.length
        ? exact.mediaTypes.filter((mediaType) => file.availableTypes.includes(mediaType))
        : file.availableTypes.slice();
      addFile(file, mediaTypes.length ? mediaTypes : file.availableTypes.slice());
    }

    const deduped = new Map();
    for (const row of out) {
      if (!deduped.has(row.dedupeKey)) {
        deduped.set(row.dedupeKey, row);
      }
    }
    return Array.from(deduped.values());
  }

  async function requestBagBundle({ token, selections }) {
    return requestJson('/me/assets/bag/bundle', {
      method: 'POST',
      token,
      body: {
        source: 'entry-bag',
        dedupe: true,
        selections: Array.isArray(selections) ? selections : [],
      },
    });
  }

  async function pollBundleJob({ token, jobId, onTick }) {
    const safeJobId = encodeURIComponent(toText(jobId).trim());
    if (!safeJobId) throw new Error('missing job id');
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const payload = await requestJson(`/me/assets/bundle/${safeJobId}`, { token });
      const status = toText(payload?.status).toLowerCase();
      const signedUrl = toText(payload?.signedUrl || payload?.url || payload?.downloadUrl).trim();
      if (status === 'ready' && signedUrl) return payload;
      if (status === 'forbidden') {
        const err = new Error('forbidden');
        err.code = 'forbidden';
        throw err;
      }
      if (status === 'not_found' || status === 'not-found') {
        const err = new Error('not-found');
        err.code = 'not-found';
        throw err;
      }
      if (status === 'error' || status === 'failed') {
        const err = new Error('failed');
        err.code = 'failed';
        throw err;
      }
      if (typeof onTick === 'function') onTick(attempt, payload);
      const waitMs = Number(payload?.pollAfterMs || 1100);
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(320, Math.min(waitMs, 3000))));
    }
    throw new Error('bundle timeout');
  }

  function openSignedUrl(url) {
    const href = toText(url).trim();
    if (!href) return false;
    const win = window.open(href, '_blank', 'noopener');
    if (win) return true;
    window.location.assign(href);
    return true;
  }

  function readResumeAction() {
    try {
      const raw = window.sessionStorage.getItem(RESUME_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeResumeAction(action) {
    try {
      window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(action || {}));
    } catch {}
  }

  function clearResumeAction() {
    try {
      window.sessionStorage.removeItem(RESUME_KEY);
    } catch {}
  }

  function mount() {
    const root = document.getElementById(ROOT_ID);
    if (!(root instanceof HTMLElement)) return;
    const bagApi = window.__dxBag;
    if (!bagApi || typeof bagApi.list !== 'function' || typeof bagApi.removeSelection !== 'function') {
      root.innerHTML = '<section class="dx-bag-shell"><p class="dx-bag-note">Bag runtime unavailable.</p></section>';
      return;
    }

    const state = {
      auth: { auth: null, authenticated: false, token: '', user: null },
      rows: bagApi.list(),
      filesByLookup: new Map(),
      error: '',
      busy: '',
      status: '',
    };

    const setFetchState = (value) => {
      root.setAttribute('data-dx-fetch-state', value);
      if (value === 'loading') root.setAttribute('aria-busy', 'true');
      else root.removeAttribute('aria-busy');
    };

    const groupedRows = () => {
      const byLookup = new Map();
      for (const row of state.rows) {
        const lookup = normalizeLookup(row.lookup);
        if (!lookup) continue;
        if (!byLookup.has(lookup)) byLookup.set(lookup, []);
        byLookup.get(lookup).push(row);
      }
      return Array.from(byLookup.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    };

    const collectSelectionsPayload = () => groupedRows().map(([lookup, rows]) => ({
      lookup,
      nodes: rows.map((row) => ({
        kind: row.kind,
        lookup,
        bucket: row.bucket || '',
        mediaType: row.mediaType || '',
        mediaTypes: Array.isArray(row.mediaTypes) ? row.mediaTypes.slice() : [],
        fileId: row.fileId || '',
      })),
    }));

    const render = () => {
      const lookupGroups = groupedRows();
      const selectedLookupCount = lookupGroups.length;
      let selectedFileCount = 0;
      for (const [lookup, rows] of lookupGroups) {
        const files = state.filesByLookup.get(lookup) || [];
        selectedFileCount += expandSelectionsForLookup(rows, files).length;
      }

      const signedLabel = state.auth.authenticated
        ? `Signed in as ${htmlEscape(toText(state.auth.user?.name || state.auth.user?.email || state.auth.user?.nickname || 'member'))}`
        : 'Public fallback mode. Sign in to resolve protected files and download.';
      const statusText = htmlEscape(state.error || state.status || '');

      const lookupCards = lookupGroups.map(([lookup, rows]) => {
        const files = state.filesByLookup.get(lookup) || [];
        const expanded = expandSelectionsForLookup(rows, files);
        const nodeChips = rows.map((row) => `
          <button type="button" class="dx-bag-chip" data-bag-remove="${htmlEscape(row.key)}" title="Remove selection">
            <span>${htmlEscape(summarizeNode(row))}</span>
            <span aria-hidden="true">×</span>
          </button>
        `).join('');
        const countLabel = state.auth.authenticated
          ? `${expanded.length} resolved file selection${expanded.length === 1 ? '' : 's'}`
          : `${rows.length} saved selection${rows.length === 1 ? '' : 's'}`;
        return `
          <article class="dx-bag-card" data-bag-lookup="${htmlEscape(lookup)}">
            <header class="dx-bag-card-head">
              <h3>${htmlEscape(lookup)}</h3>
              <p>${htmlEscape(countLabel)}</p>
            </header>
            <div class="dx-bag-chip-list">${nodeChips || '<p class="dx-bag-note">No selections.</p>'}</div>
          </article>
        `;
      }).join('');

      root.innerHTML = `
        <section class="dx-bag-shell">
          <header class="dx-bag-head">
            <h1>DOWNLOAD BAG</h1>
            <p class="dx-bag-note">${signedLabel}</p>
          </header>
          <section class="dx-bag-summary">
            <div class="dx-bag-stats">
              <span><strong>${selectedLookupCount}</strong> lookups</span>
              <span><strong>${selectedFileCount}</strong> files</span>
            </div>
            <div class="dx-bag-actions">
              <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary" data-bag-signin ${state.auth.authenticated ? 'hidden' : ''}>SIGN IN</button>
              <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary" data-bag-clear ${state.rows.length ? '' : 'disabled'}>CLEAR</button>
              <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--primary" data-bag-download ${state.rows.length ? '' : 'disabled'}>${htmlEscape(state.busy ? 'PREPARING…' : 'DOWNLOAD BAG')}</button>
            </div>
          </section>
          <section class="dx-bag-list">
            ${lookupCards || '<p class="dx-bag-note">No saved selections yet. Use DOWNLOAD from any entry sidebar.</p>'}
          </section>
          ${statusText ? `<p class="dx-bag-status">${statusText}</p>` : ''}
        </section>
      `;
    };

    const refreshRows = () => {
      state.rows = bagApi.list();
    };

    const ensureAuthForAction = async (resumePayload) => {
      state.auth = await resolveAuthSnapshot();
      if (state.auth.authenticated && state.auth.token) return true;
      const auth = state.auth.auth;
      if (!auth || typeof auth.signIn !== 'function') {
        state.error = 'Sign-in runtime unavailable.';
        render();
        return false;
      }
      writeResumeAction(resumePayload);
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      try {
        await auth.signIn(returnTo);
      } catch {
        state.error = 'Unable to start sign-in.';
        render();
      }
      return false;
    };

    const resolveLookupFiles = async () => {
      if (!state.auth.authenticated || !state.auth.token) return;
      const groups = groupedRows();
      await Promise.all(groups.map(async ([lookup]) => {
        if (state.filesByLookup.has(lookup)) return;
        try {
          const payload = await requestJson(`/me/assets/${encodeURIComponent(lookup)}`, {
            token: state.auth.token,
          });
          state.filesByLookup.set(lookup, normalizeLookupFiles(payload, lookup));
        } catch (error) {
          if (toText(error?.code) === 'forbidden') {
            state.filesByLookup.set(lookup, []);
            return;
          }
          state.filesByLookup.set(lookup, []);
        }
      }));
    };

    const executeDownload = async () => {
      refreshRows();
      if (!state.rows.length) {
        state.status = 'Bag is empty.';
        render();
        return;
      }
      const permitted = await ensureAuthForAction({ action: 'download' });
      if (!permitted) return;
      state.busy = 'download';
      state.error = '';
      state.status = 'Preparing secure bundle…';
      render();
      try {
        const payload = await requestBagBundle({
          token: state.auth.token,
          selections: collectSelectionsPayload(),
        });
        const delivery = toText(payload?.delivery).toLowerCase();
        if (delivery === 'sync') {
          const signedUrl = toText(payload?.signedUrl || payload?.url).trim();
          if (!signedUrl) throw new Error('missing signed url');
          openSignedUrl(signedUrl);
          state.status = 'Bundle ready. Opening download…';
        } else if (delivery === 'async') {
          const result = await pollBundleJob({
            token: state.auth.token,
            jobId: payload?.jobId,
            onTick: () => {
              state.status = 'Preparing secure bundle…';
              render();
            },
          });
          openSignedUrl(result?.signedUrl || result?.url || result?.downloadUrl);
          state.status = 'Bundle ready. Opening download…';
        } else {
          const fallbackSigned = toText(payload?.signedUrl || payload?.url || payload?.downloadUrl).trim();
          if (!fallbackSigned) throw new Error('unsupported response');
          openSignedUrl(fallbackSigned);
          state.status = 'Bundle ready. Opening download…';
        }
      } catch (error) {
        if (toText(error?.code) === 'not-found') {
          state.error = 'Bag bundle endpoint unavailable.';
        } else if (toText(error?.code) === 'forbidden') {
          state.error = 'Access denied for current selection.';
        } else {
          state.error = 'Unable to prepare bag bundle.';
        }
      } finally {
        state.busy = '';
        render();
      }
    };

    root.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const removeKey = target.closest('[data-bag-remove]')?.getAttribute('data-bag-remove');
      if (removeKey) {
        bagApi.removeSelection(removeKey);
        refreshRows();
        render();
        return;
      }
      if (target.closest('[data-bag-clear]')) {
        bagApi.clear();
        state.filesByLookup.clear();
        refreshRows();
        render();
        return;
      }
      if (target.closest('[data-bag-signin]')) {
        ensureAuthForAction({ action: 'signin' });
        return;
      }
      if (target.closest('[data-bag-download]') && !state.busy) {
        void executeDownload();
      }
    });

    const onBagChanged = () => {
      refreshRows();
      state.error = '';
      state.status = '';
      render();
    };
    bagApi.subscribe(onBagChanged);

    const boot = async () => {
      setFetchState('loading');
      state.auth = await resolveAuthSnapshot();
      refreshRows();
      await resolveLookupFiles();
      render();
      setFetchState('ready');

      const resume = readResumeAction();
      if (resume && resume.action === 'download' && state.auth.authenticated && state.auth.token) {
        clearResumeAction();
        await executeDownload();
      }
    };

    boot().catch((error) => {
      state.error = `Bag failed to load: ${toText(error?.message || error)}`;
      render();
      setFetchState('error');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
