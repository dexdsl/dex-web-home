(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxBagAppLoaded) return;
  window.__dxBagAppLoaded = true;

  const ROOT_ID = 'dex-bag';
  const BAG_ROUTE_PATH = '/entry/bag/';
  const BAG_ROUTE_CLASS = 'dx-bag-page';
  const PROFILE_PROTECTED_ROUTE_CLASS = 'dx-route-profile-protected';
  const PROFILE_SHOW_MESH_ROUTE_CLASS = 'dx-route-show-mesh';
  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';
  const FETCH_TIMEOUT_MS = 9000;
  const RESUME_KEY = 'dex:bag:resume:v1';
  const RECEIPT_VISIBLE_LIMIT = 8;
  const MESH_RUNTIME_KEY = '__dxBagMeshRuntime';

  const MESH_BLOBS = [
    '--d:36vmax;--g1a:#ff5f6d;--g1b:#ffc371;--g2a:#47c9e5;--g2b:#845ef7',
    '--d:32vmax;--g1a:#7f00ff;--g1b:#e100ff;--g2a:#00dbde;--g2b:#fc00ff',
    '--d:33vmax;--g1a:#ffd452;--g1b:#ffb347;--g2a:#ff8456;--g2b:#ff5e62',
    '--d:37vmax;--g1a:#13f1fc;--g1b:#0470dc;--g2a:#a1ffce;--g2b:#faffd1',
    '--d:27vmax;--g1a:#f9516d;--g1b:#ff9a44;--g2a:#fa8bff;--g2b:#6f7bf7',
  ];

  function toText(value) {
    return String(value ?? '');
  }

  function parseDateMs(value) {
    const ms = Date.parse(toText(value));
    return Number.isFinite(ms) ? ms : 0;
  }

  function normalizePath(pathname) {
    const raw = toText(pathname).trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const parsed = new URL(raw, window.location.origin);
        return normalizePath(parsed.pathname || '/');
      } catch {
        return '';
      }
    }
    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    const clean = normalized.replace(/\/+/, '/').replace(/\/+/g, '/');
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean : `${clean}/`;
  }

  function isLocalViewerRoute() {
    const host = toText(window.location.hostname || '').trim().toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    if (!isLocalHost) return false;
    const pathname = normalizePath(window.location.pathname || '/');
    return pathname.startsWith('/view/');
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
    const headers = { accept: 'application/json' };
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

  function normalizeFormatToken(value) {
    const raw = toText(value).trim();
    if (!raw) return '';
    const compact = raw.replace(/^\./, '').replace(/\s+/g, '').toLowerCase();
    if (!compact) return '';
    if (compact === '4k' || compact === '2160p' || compact === 'uhd') return '4K';
    if (compact === '1080p' || compact === 'fhd') return '1080p';
    return compact;
  }

  function parseBracketFormats(value) {
    const out = [];
    const seen = new Set();
    const text = toText(value);
    const re = /\[([^\]]+)\]/g;
    let match = null;
    while ((match = re.exec(text))) {
      const normalized = normalizeFormatToken(match[1]);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    return out;
  }

  function collectRowFormats(row, fileId, label, availableTypes) {
    const out = [];
    const seen = new Set();
    const add = (value) => {
      const normalized = normalizeFormatToken(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      out.push(normalized);
    };

    add(row?.format);
    add(row?.fileType);
    add(row?.ext);
    add(row?.extension);
    add(row?.codec);
    add(row?.container);
    add(row?.quality);
    if (Array.isArray(row?.formats)) row.formats.forEach(add);
    if (Array.isArray(row?.availableFormats)) row.availableFormats.forEach(add);
    parseBracketFormats(label).forEach(add);

    const extMatch = toText(fileId).match(/\.([A-Za-z0-9]+)$/);
    if (extMatch) add(extMatch[1]);

    if (!out.length && availableTypes.includes('audio')) add('audio');
    if (!out.length && availableTypes.includes('video')) add('video');
    return out;
  }

  function parseFiniteSizeBytes(value) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 0;
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
        const formats = collectRowFormats(row, fileId, label, availableTypes);
        const sizeBytes = parseFiniteSizeBytes(row?.sizeBytes || row?.size_bytes || row?.bytes || row?.size);
        if (!bucket || !fileId) return null;
        return {
          lookup,
          bucket,
          fileId,
          label,
          type,
          availableTypes,
          formats,
          sizeBytes,
        };
      })
      .filter(Boolean);
  }

  function getKindOrder(kind) {
    if (kind === 'collection') return 0;
    if (kind === 'bucket') return 1;
    if (kind === 'type') return 2;
    if (kind === 'file') return 3;
    return 9;
  }

  function joinNatural(parts = []) {
    const list = Array.isArray(parts) ? parts.map((part) => toText(part).trim()).filter(Boolean) : [];
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
  }

  function formatBucketLabelList(bucketValues = []) {
    const buckets = Array.from(new Set((Array.isArray(bucketValues) ? bucketValues : []).map((value) => normalizeBucket(value)).filter(Boolean))).sort();
    if (!buckets.length) return '';
    if (buckets.length === 1) return `${buckets[0]} Bucket`;
    return `${joinNatural(buckets)} Buckets`;
  }

  function summarizeSelection(rows = []) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    if (!normalizedRows.length) return 'No selection';
    if (normalizedRows.some((row) => row.kind === 'collection')) return 'Entire Collection';

    const bucketRows = normalizedRows.filter((row) => row.kind === 'bucket').map((row) => normalizeBucket(row.bucket)).filter(Boolean);
    const typeRows = normalizedRows
      .filter((row) => row.kind === 'type')
      .map((row) => ({ bucket: normalizeBucket(row.bucket), mediaType: normalizeMediaType(row.mediaType) }))
      .filter((row) => row.bucket && row.mediaType);
    const fileRows = normalizedRows
      .filter((row) => row.kind === 'file')
      .map((row) => ({ bucket: normalizeBucket(row.bucket), fileId: toText(row.fileId).trim() }))
      .filter((row) => row.bucket && row.fileId);

    const buckets = Array.from(new Set(bucketRows)).sort();
    const fileBuckets = Array.from(new Set(fileRows.map((row) => row.bucket))).sort();
    const typeBuckets = Array.from(new Set(typeRows.map((row) => row.bucket))).sort();

    if (buckets.length && !fileRows.length && !typeRows.length) {
      return formatBucketLabelList(buckets);
    }

    if (buckets.length && (fileRows.length || typeRows.length)) {
      const head = formatBucketLabelList(buckets);
      const extraBuckets = Array.from(new Set([...fileBuckets, ...typeBuckets].filter((bucket) => !buckets.includes(bucket)))).sort();
      if (!extraBuckets.length) return head;
      if (extraBuckets.length === 1) {
        const bucket = extraBuckets[0];
        const count = fileRows.filter((row) => row.bucket === bucket).length + typeRows.filter((row) => row.bucket === bucket).length;
        const suffix = count > 1 ? `Various ${bucket} Bucket Files` : `${bucket} Bucket File`;
        return `${head}, plus ${suffix}`;
      }
      return `${head}, plus files from ${formatBucketLabelList(extraBuckets)}`;
    }

    if (!buckets.length && typeRows.length && !fileRows.length) {
      const labels = typeRows.map((row) => `${row.bucket} ${row.mediaType.toUpperCase()} Files`);
      return joinNatural(labels);
    }

    if (fileRows.length) {
      if (fileBuckets.length === 1) {
        return fileRows.length === 1 ? `${fileBuckets[0]} Bucket File` : `Various ${fileBuckets[0]} Bucket Files`;
      }
      return `${fileRows.length} Selected Files Across ${formatBucketLabelList(fileBuckets)}`;
    }

    return 'Scoped Selection';
  }

  function formatDisplayFormat(value) {
    const normalized = normalizeFormatToken(value);
    if (!normalized) return '';
    if (normalized === '4K') return '4K';
    if (normalized === '1080p') return '1080p';
    return normalized.toLowerCase();
  }

  function resolveFileFormatsForNode(node, files = []) {
    const bucket = normalizeBucket(node?.bucket);
    const fileId = toText(node?.fileId).trim();
    if (!bucket || !fileId) {
      return normalizeAvailableTypes(node?.mediaTypes, node?.mediaType).map((value) => value.toUpperCase());
    }

    const preferredTypes = normalizeAvailableTypes(node?.mediaTypes, node?.mediaType);
    const matching = (Array.isArray(files) ? files : []).filter((file) => {
      if (normalizeBucket(file?.bucket) !== bucket) return false;
      if (toText(file?.fileId).trim() !== fileId) return false;
      const fileTypes = normalizeAvailableTypes(file?.availableTypes, file?.type);
      if (!preferredTypes.length) return true;
      return preferredTypes.some((mediaType) => fileTypes.includes(mediaType));
    });

    const out = [];
    const seen = new Set();
    const add = (value) => {
      const label = formatDisplayFormat(value);
      if (!label || seen.has(label)) return;
      seen.add(label);
      out.push(label);
    };

    matching.forEach((file) => {
      if (Array.isArray(file?.formats) && file.formats.length) {
        file.formats.forEach(add);
      } else {
        normalizeAvailableTypes(file?.availableTypes, file?.type).forEach((mediaType) => add(mediaType.toUpperCase()));
      }
    });

    if (!out.length) {
      normalizeAvailableTypes(node?.mediaTypes, node?.mediaType)
        .map((mediaType) => mediaType.toUpperCase())
        .forEach(add);
    }
    return out;
  }

  function buildReceiptLines(lookup, rows = [], files = []) {
    const safeLookup = normalizeLookup(lookup);
    const normalizedRows = Array.isArray(rows) ? rows.slice() : [];
    const out = [];
    const seen = new Set();
    const pushLine = (line) => {
      const text = toText(line).trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push(text);
    };

    normalizedRows.sort((a, b) => {
      const kindOrder = getKindOrder(a?.kind) - getKindOrder(b?.kind);
      if (kindOrder) return kindOrder;
      const bucketOrder = normalizeBucket(a?.bucket).localeCompare(normalizeBucket(b?.bucket));
      if (bucketOrder) return bucketOrder;
      const fileA = toText(a?.fileId).trim();
      const fileB = toText(b?.fileId).trim();
      const numericA = Number((fileA.match(/(?:^|\.)(\d+(?:\.\d+)?)$/) || fileA.match(/(\d+(?:\.\d+)?)/) || [])[1]);
      const numericB = Number((fileB.match(/(?:^|\.)(\d+(?:\.\d+)?)$/) || fileB.match(/(\d+(?:\.\d+)?)/) || [])[1]);
      if (Number.isFinite(numericA) && Number.isFinite(numericB) && numericA !== numericB) return numericA - numericB;
      return fileA.localeCompare(fileB);
    });

    normalizedRows.forEach((row) => {
      const kind = toText(row?.kind).trim().toLowerCase();
      const bucket = normalizeBucket(row?.bucket);
      if (kind === 'collection') {
        pushLine(`${safeLookup} ALL BUCKETS`);
        return;
      }
      if (kind === 'bucket') {
        pushLine(`${safeLookup} ${bucket}`);
        return;
      }
      if (kind === 'type') {
        const mediaType = normalizeMediaType(row?.mediaType);
        pushLine(`${safeLookup} ${bucket} [${mediaType.toUpperCase()}]`);
        return;
      }
      if (kind === 'file') {
        const fileId = toText(row?.fileId).trim();
        const base = `${safeLookup} ${bucket}.${fileId}`;
        const formats = resolveFileFormatsForNode(row, files);
        if (!formats.length) {
          pushLine(base);
          return;
        }
        formats.forEach((format) => pushLine(`${base} [${format}]`));
      }
    });

    return out;
  }

  function resolveCardTitle(rows = [], lookup) {
    const normalizedRows = Array.isArray(rows) ? rows.slice() : [];
    normalizedRows.sort((a, b) => parseDateMs(b?.updatedAt || b?.addedAt) - parseDateMs(a?.updatedAt || a?.addedAt));
    for (const row of normalizedRows) {
      const title = toText(row?.title).trim();
      if (!title) continue;
      const normalizedTitle = title.replace(/\s+/g, ' ').toLowerCase();
      const normalizedLookup = toText(lookup).replace(/\s+/g, ' ').trim().toLowerCase();
      if (!normalizedLookup || normalizedTitle !== normalizedLookup) return title;
    }
    return lookup;
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '\u2014';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unit = 0;
    let scaled = value;
    while (scaled >= 1024 && unit < units.length - 1) {
      scaled /= 1024;
      unit += 1;
    }
    const text = unit === 0 ? Math.round(scaled).toString() : scaled.toFixed(scaled >= 10 ? 1 : 2).replace(/\.0+$/, '');
    return `${text} ${units[unit]}`;
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
      if (!deduped.has(row.dedupeKey)) deduped.set(row.dedupeKey, row);
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

  function ensureBagRouteClasses() {
    if (!(document.body instanceof HTMLElement)) return;
    document.body.classList.add('dx-entry-page', BAG_ROUTE_CLASS, PROFILE_PROTECTED_ROUTE_CLASS, PROFILE_SHOW_MESH_ROUTE_CLASS);
  }

  function ensureMeshBackdropElements() {
    if (!(document.body instanceof HTMLElement)) return;

    let gradient = document.getElementById('scroll-gradient-bg');
    if (!(gradient instanceof HTMLElement)) {
      gradient = document.createElement('div');
      gradient.id = 'scroll-gradient-bg';
      gradient.setAttribute('data-dx-bag-bg', '1');
      document.body.prepend(gradient);
    }

    let mesh = document.getElementById('gooey-mesh-wrapper');
    if (!(mesh instanceof HTMLElement)) {
      mesh = document.createElement('div');
      mesh.id = 'gooey-mesh-wrapper';
      mesh.setAttribute('data-dx-bag-bg', '1');

      const stage = document.createElement('div');
      stage.className = 'gooey-stage';
      MESH_BLOBS.forEach((styleText) => {
        const blob = document.createElement('div');
        blob.className = 'gooey-blob';
        blob.setAttribute('style', styleText);
        stage.appendChild(blob);
      });
      mesh.appendChild(stage);

      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('id', 'goo-filter');
      svg.setAttribute('aria-hidden', 'true');
      const defs = document.createElementNS(ns, 'defs');
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', 'goo');
      const blur = document.createElementNS(ns, 'feGaussianBlur');
      blur.setAttribute('in', 'SourceGraphic');
      blur.setAttribute('stdDeviation', '15');
      blur.setAttribute('result', 'blur');
      const matrix = document.createElementNS(ns, 'feColorMatrix');
      matrix.setAttribute('in', 'blur');
      matrix.setAttribute('mode', 'matrix');
      matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8');
      matrix.setAttribute('result', 'goo');
      const blend = document.createElementNS(ns, 'feBlend');
      blend.setAttribute('in', 'SourceGraphic');
      blend.setAttribute('in2', 'goo');
      blend.setAttribute('mode', 'normal');
      filter.appendChild(blur);
      filter.appendChild(matrix);
      filter.appendChild(blend);
      defs.appendChild(filter);
      svg.appendChild(defs);
      mesh.appendChild(svg);

      document.body.prepend(mesh);
    }
  }

  function ensureBagMeshMotion(attempt = 0) {
    ensureMeshBackdropElements();

    const mesh = document.getElementById('gooey-mesh-wrapper');
    if (!(mesh instanceof HTMLElement)) {
      if (attempt < 30) window.requestAnimationFrame(() => ensureBagMeshMotion(attempt + 1));
      return;
    }
    const blobs = Array.from(mesh.querySelectorAll('.gooey-blob'));
    if (!blobs.length) {
      if (attempt < 30) window.requestAnimationFrame(() => ensureBagMeshMotion(attempt + 1));
      return;
    }

    const previous = window[MESH_RUNTIME_KEY];
    if (previous && previous.mesh === mesh && previous.blobCount === blobs.length) return;
    if (previous && typeof previous.stop === 'function') {
      try {
        previous.stop();
      } catch {}
    }

    const viewportWidth = () => Math.max(window.innerWidth || 0, 1);
    const viewportHeight = () => Math.max(window.innerHeight || 0, 1);

    blobs.forEach((blob) => {
      blob._r = Math.max(blob.offsetWidth / 2, 1);
      const speed = 60 + Math.random() * 60;
      const angle = Math.random() * Math.PI * 2;
      blob._x = blob._r + Math.random() * Math.max(viewportWidth() - blob._r * 2, 1);
      blob._y = blob._r + Math.random() * Math.max(viewportHeight() - blob._r * 2, 1);
      blob._vx = Math.cos(angle) * speed * 0.25;
      blob._vy = Math.sin(angle) * speed * 0.25;
      blob.style.transform = `translate(${blob._x}px, ${blob._y}px) translate(-50%, -50%)`;
    });

    let raf = 0;
    let stopped = false;
    let last = performance.now();

    const clampToViewport = () => {
      const vw = viewportWidth();
      const vh = viewportHeight();
      blobs.forEach((blob) => {
        blob._x = Math.min(Math.max(blob._r, blob._x), vw - blob._r);
        blob._y = Math.min(Math.max(blob._r, blob._y), vh - blob._r);
      });
    };

    const step = (now) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      const vw = viewportWidth();
      const vh = viewportHeight();
      blobs.forEach((blob) => {
        blob._x += blob._vx * dt;
        blob._y += blob._vy * dt;
        if ((blob._x - blob._r <= 0 && blob._vx < 0) || (blob._x + blob._r >= vw && blob._vx > 0)) blob._vx *= -1;
        if ((blob._y - blob._r <= 0 && blob._vy < 0) || (blob._y + blob._r >= vh && blob._vy > 0)) blob._vy *= -1;
        blob.style.transform = `translate(${blob._x}px, ${blob._y}px) translate(-50%, -50%)`;
      });
      raf = window.requestAnimationFrame(step);
    };

    const onResize = () => {
      clampToViewport();
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };

    window.addEventListener('resize', onResize, { passive: true });
    raf = window.requestAnimationFrame(step);
    window.addEventListener('pagehide', stop, { once: true });
    window[MESH_RUNTIME_KEY] = { stop, mesh, blobCount: blobs.length };
  }

  function mount() {
    ensureBagRouteClasses();
    ensureBagMeshMotion();

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
      expandedReceipts: new Set(),
      localViewerMode: isLocalViewerRoute(),
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
      return Array.from(byLookup.entries()).sort((a, b) => {
        const latestA = Math.max(...a[1].map((row) => parseDateMs(row?.updatedAt || row?.addedAt) || 0));
        const latestB = Math.max(...b[1].map((row) => parseDateMs(row?.updatedAt || row?.addedAt) || 0));
        if (latestA !== latestB) return latestB - latestA;
        return a[0].localeCompare(b[0]);
      });
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

    const removeLookupSelections = (lookup) => {
      const keys = state.rows
        .filter((row) => normalizeLookup(row.lookup) === lookup)
        .map((row) => toText(row.key).trim())
        .filter(Boolean);
      if (!keys.length) return;
      keys.forEach((key) => bagApi.removeSelection(key));
      state.expandedReceipts.delete(lookup);
    };

    const computeGroupModel = (lookup, rows) => {
      const files = state.filesByLookup.get(lookup) || [];
      const expandedFiles = expandSelectionsForLookup(rows, files);
      const estimatedBytes = expandedFiles.reduce((sum, file) => sum + parseFiniteSizeBytes(file?.sizeBytes), 0);
      const receiptLines = buildReceiptLines(lookup, rows, files);
      const latestRow = rows
        .slice()
        .sort((a, b) => parseDateMs(b?.updatedAt || b?.addedAt) - parseDateMs(a?.updatedAt || a?.addedAt))[0] || null;
      return {
        lookup,
        title: resolveCardTitle(rows, lookup),
        scopeSummary: summarizeSelection(rows),
        resolvedCount: expandedFiles.length,
        estimatedBytes,
        receiptLines,
        entryHref: normalizePath(latestRow?.entryHref || ''),
      };
    };

    const render = () => {
      const lookupGroups = groupedRows();
      const models = lookupGroups.map(([lookup, rows]) => computeGroupModel(lookup, rows));
      const selectedLookupCount = models.length;
      const selectedFileCount = models.reduce((sum, model) => sum + model.resolvedCount, 0);
      const selectedUnitCount = models.reduce((sum, model) => sum + (model.receiptLines.length || 0), 0);
      const estimatedBytes = models.reduce((sum, model) => sum + model.estimatedBytes, 0);
      const signedLabel = state.auth.authenticated
        ? `Signed in as ${htmlEscape(toText(state.auth.user?.name || state.auth.user?.email || state.auth.user?.nickname || 'member'))}`
        : (state.localViewerMode
          ? 'Local viewer mode on /view/. Bag preview is available without auth.'
          : 'Sign in required.');
      const statusText = htmlEscape(state.error || state.status || '');

      const cardMarkup = models.map((model) => {
        const expanded = state.expandedReceipts.has(model.lookup);
        const totalLines = model.receiptLines.length;
        const hiddenCount = Math.max(0, totalLines - RECEIPT_VISIBLE_LIMIT);
        const visibleLines = expanded ? model.receiptLines : model.receiptLines.slice(0, RECEIPT_VISIBLE_LIMIT);
        const receiptItems = visibleLines.map((line) => `<li>${htmlEscape(line)}</li>`).join('');
        const showMore = hiddenCount > 0
          ? `<button type="button" class="dx-bag-receipt-toggle" data-bag-toggle-receipt="${htmlEscape(model.lookup)}">${expanded ? 'Show Less' : `Show All (${hiddenCount} more)`}</button>`
          : '';

        return `
          <article class="dx-bag-card" data-bag-lookup="${htmlEscape(model.lookup)}">
            <header class="dx-bag-card-head">
              <div class="dx-bag-card-ident">
                <h3>${htmlEscape(model.title)}</h3>
                <p>${htmlEscape(model.lookup)}</p>
              </div>
              <div class="dx-bag-card-controls">
                <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary" data-bag-edit="${htmlEscape(model.lookup)}" ${model.entryHref ? '' : 'disabled'}>EDIT SELECTION</button>
                <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary" data-bag-remove-lookup="${htmlEscape(model.lookup)}">REMOVE</button>
              </div>
            </header>
            <p class="dx-bag-scope">${htmlEscape(model.scopeSummary)}</p>
            <p class="dx-bag-count">${htmlEscape(`${model.resolvedCount} resolved file selection${model.resolvedCount === 1 ? '' : 's'}`)}</p>
            <ol class="dx-bag-receipt">${receiptItems || '<li>No receipt lines.</li>'}</ol>
            ${showMore}
          </article>
        `;
      }).join('');

      root.innerHTML = `
        <section class="dx-bag-shell">
          <header class="dx-bag-head">
            <p class="dx-bag-breadcrumb"><a href="/catalog">catalog</a> <span>✧</span> <span>bag</span></p>
            <h1>DOWNLOAD BAG</h1>
            <p class="dx-bag-note">${signedLabel}</p>
          </header>

          <div class="dx-bag-layout">
            <section class="dx-bag-list" aria-live="polite">
              ${cardMarkup || '<p class="dx-bag-note">No saved selections yet. Use FILES from any entry sidebar.</p>'}
            </section>

            <aside class="dx-bag-summary">
              <div class="dx-bag-summary-block">
                <h2>BAG SUMMARY</h2>
                <div class="dx-bag-stats">
                  <span><strong>${selectedLookupCount}</strong> entries</span>
                  <span><strong>${selectedUnitCount}</strong> units</span>
                  <span><strong>${selectedFileCount}</strong> files</span>
                  <span><strong>${htmlEscape(formatBytes(estimatedBytes))}</strong> estimated size</span>
                </div>
              </div>
              <div class="dx-bag-actions">
                <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary" data-bag-clear ${state.rows.length ? '' : 'disabled'}>CLEAR</button>
                <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--primary" data-bag-download ${state.rows.length ? '' : 'disabled'}>${htmlEscape(state.busy ? 'PREPARING…' : 'DOWNLOAD BAG')}</button>
              </div>
            </aside>
          </div>

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
      if (state.localViewerMode) {
        const action = toText(resumePayload?.action).trim().toLowerCase();
        if (action && action !== 'open-bag') {
          state.error = 'Sign in is disabled in local /view mode. Use /entry/bag for secure download actions.';
          render();
        }
        return false;
      }
      const auth = state.auth.auth;
      if (!auth || typeof auth.signIn !== 'function') {
        state.error = 'Sign-in runtime unavailable.';
        render();
        return false;
      }
      writeResumeAction(resumePayload);
      try {
        await auth.signIn(BAG_ROUTE_PATH);
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

      if (state.localViewerMode && (!state.auth.authenticated || !state.auth.token)) {
        state.error = 'Download is unavailable in local /view mode. Open /entry/bag after signing in.';
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

      const removeLookup = target.closest('[data-bag-remove-lookup]')?.getAttribute('data-bag-remove-lookup');
      if (removeLookup) {
        removeLookupSelections(removeLookup);
        refreshRows();
        state.filesByLookup.delete(removeLookup);
        state.error = '';
        state.status = '';
        render();
        return;
      }

      const toggleLookup = target.closest('[data-bag-toggle-receipt]')?.getAttribute('data-bag-toggle-receipt');
      if (toggleLookup) {
        if (state.expandedReceipts.has(toggleLookup)) state.expandedReceipts.delete(toggleLookup);
        else state.expandedReceipts.add(toggleLookup);
        render();
        return;
      }

      const editLookup = target.closest('[data-bag-edit]')?.getAttribute('data-bag-edit');
      if (editLookup) {
        const model = groupedRows().map(([lookup, rows]) => computeGroupModel(lookup, rows)).find((item) => item.lookup === editLookup);
        if (model?.entryHref) {
          window.location.assign(model.entryHref);
        }
        return;
      }

      if (target.closest('[data-bag-clear]')) {
        bagApi.clear();
        state.filesByLookup.clear();
        state.expandedReceipts.clear();
        refreshRows();
        state.error = '';
        state.status = '';
        render();
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
      if (!state.auth.authenticated || !state.auth.token) {
        if (state.localViewerMode) {
          state.status = '';
        } else {
          const permitted = await ensureAuthForAction({ action: 'open-bag' });
          if (!permitted) {
            root.innerHTML = '<section class="dx-bag-shell"><p class="dx-bag-note">Redirecting to sign in…</p></section>';
            return;
          }
        }
      }

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
