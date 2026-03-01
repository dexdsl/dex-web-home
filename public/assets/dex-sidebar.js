(function () {
  if (window.__dexSidebarRuntimeBound) return;
  window.__dexSidebarRuntimeBound = true;

  const ALL_BUCKETS = ['A', 'B', 'C', 'D', 'E', 'X'];
  const FAVORITES_STORAGE_PREFIX = 'dex:favorites:v2:';
  const FAVORITES_RUNTIME_PATH = '/assets/js/dx-favorites.js';
  const FAVORITES_UI_STYLE_ID = 'dx-favorites-ui-style';
  const FAVORITES_TOAST_ROOT_ID = 'dx-favorites-toast-root';
  const FAVORITES_TOAST_ID = 'dx-favorites-toast';
  const HEART_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 dx-fav-heart-svg" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  `.trim();
  let favoritesRuntimePromise = null;
  let favoritesSignalsBound = false;
  let favoritesToastTimer = 0;
  let activeEntryTooltipTarget = null;
  let entryRailLayoutBound = false;
  let entryRailFooterResizeObserver = null;
  let entryRailFooterMutationObserver = null;
  let entryRailObservedFooter = null;
  const ENTRY_RAIL_BREAKPOINT = 960;
  const COLLECTION_HEADING_CANONICAL = 'COLLECTION';
  const BUCKET_TOOLTIP_CACHE_PREFIX = 'dx:entry:bucket-tooltips:v1:';
  const ENTRY_RUNTIME_STYLE_ID = 'dx-entry-runtime-layout-overrides';
  const DX_MIN_SHEEN_MS = 120;
  const DX_ENTRY_TARGET_TIMEOUT_MS = 15000;
  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const ENTRY_FETCH_SHELL_MARKER = 'data-dx-entry-fetch-shell';
  const TOOLTIP_FETCH_SHELL_MARKER = 'data-dx-tooltip-fetch-shell';
  const ENTRY_FETCH_TARGET_SPECS = [
    { key: 'layout', selectors: ['[data-dx-entry-fetch-target="layout"]', '.dex-entry-layout'], variant: 'rows' },
    { key: 'header', selectors: ['[data-dx-entry-fetch-target="header"]', '.dex-entry-header'], variant: 'rows' },
    { key: 'media', selectors: ['[data-dx-entry-fetch-target="media"]', '.dex-entry-media', '.dex-video-shell'], variant: 'card' },
    { key: 'description', selectors: ['[data-dx-entry-fetch-target="description"]', '.dex-entry-desc-scroll'], variant: 'rows' },
    { key: 'overview', selectors: ['[data-dx-entry-fetch-target="overview"]', '.dex-overview'], variant: 'card' },
    { key: 'collections', selectors: ['[data-dx-entry-fetch-target="collections"]', '.dex-collections'], variant: 'rows' },
    { key: 'license', selectors: ['[data-dx-entry-fetch-target="license"]', '.dex-license'], variant: 'card' },
  ];
  const ENTRY_FETCH_WATCH_OPTIONS = { childList: true, subtree: true, characterData: true, attributes: true };
  const BUCKET_TOOLTIP_METRIC_ATTRS = [
    'data-dx-tooltip-status',
    'data-dx-tooltip-audio',
    'data-dx-tooltip-video',
    'data-dx-tooltip-mapped',
    'data-dx-tooltip-pdf',
    'data-dx-tooltip-bundle',
  ];
  let overviewLookupFitBound = false;
  let overviewLookupResizeObserver = null;
  let activeEntryTooltipMetricsObserver = null;

  const normalizeBuckets = (pageBuckets) => (Array.isArray(pageBuckets) ? pageBuckets : []);

  const prefersReducedMotion = () => {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  };

  const animateNode = (node, keyframes, options) => {
    if (!node || prefersReducedMotion()) return null;
    if (typeof node.animate !== 'function') return null;
    try {
      return node.animate(keyframes, options);
    } catch {
      return null;
    }
  };

  const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

  const readManifestToken = (cfg, type, bucket, formatKey) => {
    const source = type === 'audio'
      ? cfg?.downloads?.audioFileIds?.[bucket]
      : cfg?.downloads?.videoFileIds?.[bucket];
    return String(source?.[formatKey] || '').trim();
  };

  const computeBucketStats = (cfg, bucket, selectedBuckets = []) => {
    const audioFormats = Array.isArray(cfg?.downloads?.formats?.audio) ? cfg.downloads.formats.audio : [];
    const videoFormats = Array.isArray(cfg?.downloads?.formats?.video) ? cfg.downloads.formats.video : [];
    const audioCount = audioFormats.reduce((count, format) => {
      const token = parseAssetRefToken(readManifestToken(cfg, 'audio', bucket, format?.key));
      return count + (token ? 1 : 0);
    }, 0);
    const videoCount = videoFormats.reduce((count, format) => {
      const token = parseAssetRefToken(readManifestToken(cfg, 'video', bucket, format?.key));
      return count + (token ? 1 : 0);
    }, 0);
    const selected = selectedBuckets.includes(bucket);
    const hasPdf = Boolean(parseRecordingIndexPdfToken(cfg?.downloads?.recordingIndexPdfRef));
    const hasBundle = Boolean(parseRecordingIndexBundleToken(cfg?.downloads?.recordingIndexBundleRef));
    return {
      bucket,
      selected,
      audioCount,
      videoCount,
      hasPdf,
      hasBundle,
      totalMapped: audioCount + videoCount,
    };
  };

  const getBucketTooltipStatus = (stats) => ((stats?.selected || stats?.totalMapped > 0) ? 'available' : 'unavailable');

  const formatBucketTooltip = (stats) => {
    if (!stats) return '';
    const status = getBucketTooltipStatus(stats);
    const recordingPdf = stats.hasPdf ? 'yes' : 'no';
    const recordingBundle = stats.hasBundle ? 'yes' : 'no';
    return [
      `Bucket ${stats.bucket.toUpperCase()}`,
      `Status: ${status}`,
      `Audio formats: ${stats.audioCount}`,
      `Video formats: ${stats.videoCount}`,
      `Mapped rows: ${stats.totalMapped}`,
      `Recording PDF: ${recordingPdf}`,
      `Recording bundle: ${recordingBundle}`,
    ].join(' • ');
  };

  const readBucketTooltipCache = (lookupNumber = '') => {
    const safeLookup = String(lookupNumber || '').trim();
    if (!safeLookup) return {};
    try {
      const raw = window.localStorage?.getItem(`${BUCKET_TOOLTIP_CACHE_PREFIX}${safeLookup}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeBucketTooltipCache = (lookupNumber = '', nextMap = {}) => {
    const safeLookup = String(lookupNumber || '').trim();
    if (!safeLookup) return;
    try {
      window.localStorage?.setItem(`${BUCKET_TOOLTIP_CACHE_PREFIX}${safeLookup}`, JSON.stringify(nextMap || {}));
    } catch {}
  };

  const buildBucketsHtml = (pageBuckets, cfg, lookupNumber = '') => {
    const selected = normalizeBuckets(pageBuckets);
    const tooltipCache = readBucketTooltipCache(lookupNumber);
    const nextTooltipCache = { ...tooltipCache };
    const html = ALL_BUCKETS
      .map((bucket) => {
        const available = selected.includes(bucket) || bucketHasAnyAsset(cfg, bucket);
        const cls = available ? 'available' : 'unavailable';
        const stats = computeBucketStats(cfg, bucket, selected);
        const liveTooltip = formatBucketTooltip(stats);
        const persistedTooltip = String(tooltipCache[bucket] || '').trim();
        const tooltipText = String(liveTooltip || persistedTooltip || `Bucket ${bucket}`).trim();
        nextTooltipCache[bucket] = tooltipText;
        const tooltip = escapeHtml(tooltipText);
        const status = escapeHtml(getBucketTooltipStatus(stats));
        const audio = escapeHtml(String(stats?.audioCount ?? 0));
        const video = escapeHtml(String(stats?.videoCount ?? 0));
        const mapped = escapeHtml(String(stats?.totalMapped ?? 0));
        const pdf = escapeHtml(stats?.hasPdf ? 'yes' : 'no');
        const bundle = escapeHtml(stats?.hasBundle ? 'yes' : 'no');
        return `<span class="dx-bucket-tile ${cls}" data-dx-bucket-key="${bucket}" data-dx-bucket-tooltip="${tooltip}" data-dx-tooltip="${tooltip}" data-dx-tooltip-status="${status}" data-dx-tooltip-audio="${audio}" data-dx-tooltip-video="${video}" data-dx-tooltip-mapped="${mapped}" data-dx-tooltip-pdf="${pdf}" data-dx-tooltip-bundle="${bundle}" title="${tooltip}" aria-label="${tooltip}" tabindex="0"><span class="dx-bucket-label">${bucket}</span></span>`;
      })
      .join('');
    writeBucketTooltipCache(lookupNumber, nextTooltipCache);
    return html;
  };

  const getSidebarAssetOrigin = () => {
    const s = document.querySelector('script[src*="dex-sidebar.js"]');
    if (s && s.src) {
      try {
        return new URL(s.src, window.location.href).origin;
      } catch {}
    }
    return window.location.origin;
  };

  const ensureProfileChromeRuntime = (origin) => {
    if (!(document.body instanceof HTMLElement)) return;
    document.body.classList.add('dx-entry-page', 'dx-route-profile-protected', 'dx-route-show-mesh');
    document.body.classList.remove('dx-route-standard-chrome');
    document.body.classList.remove('announcement-bar-reserved-space');
    const scriptPath = '/assets/js/header-slot.js';
    const existing = Array.from(document.querySelectorAll('script[src]')).find((script) => {
      try {
        const parsed = new URL(script.src, window.location.href);
        return parsed.pathname === scriptPath;
      } catch {
        return false;
      }
    });
    if (existing || window.__dxHeaderSlotLoaded) return;
    const script = document.createElement('script');
    script.defer = true;
    script.src = new URL(scriptPath, origin || window.location.origin).toString();
    document.head.appendChild(script);
  };

  const ensureEntryRuntimeLayoutOverrides = () => {
    if (!(document.head instanceof HTMLElement)) return;
    if (document.getElementById(ENTRY_RUNTIME_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = ENTRY_RUNTIME_STYLE_ID;
    style.textContent = `
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #siteWrapper,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #page,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #sections,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-section,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-host,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-host .dx-code-container {
        max-height: none !important;
        min-height: 0 !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-layout {
        height: var(--dx-entry-rails-height, 62vh) !important;
        min-height: 0 !important;
        overflow: visible !important;
        align-items: stretch !important;
      }

      body.dx-entry-page .dex-entry-section {
        margin-bottom: var(--dx-entry-footer-gap, clamp(18px, 2.2vh, 30px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-section {
        margin-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      body.dx-entry-page .dex-entry-main,
      body.dx-entry-page .dex-sidebar {
        padding-bottom: var(--dx-entry-footer-gap, clamp(18px, 2.2vh, 30px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
        height: var(--dx-entry-rails-height, 62vh) !important;
        max-height: var(--dx-entry-rails-height, 62vh) !important;
        min-height: 0 !important;
        overscroll-behavior: contain !important;
        scrollbar-gutter: stable !important;
        padding-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main {
        overflow-y: hidden !important;
        overflow-x: hidden !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding-bottom: calc(var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) + 10px) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main > :last-child {
        margin-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar > section:last-of-type {
        margin-bottom: calc(var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) + 10px) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
        padding-right: var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar section {
        padding-top: clamp(16px, 1.35vw, 22px) !important;
        padding-bottom: clamp(16px, 1.35vw, 22px) !important;
        padding-left: var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px)) !important;
        padding-right: var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar section + section {
        margin-top: clamp(12px, 1.05vw, 18px) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-footer-section {
        position: static !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        margin: 0 !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        padding-left: var(--dx-entry-footer-inline-pad, var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px))) !important;
        padding-right: var(--dx-entry-footer-inline-pad, var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px))) !important;
        min-height: 0 !important;
      }

      body.dx-route-profile-protected.dx-entry-page #footer-sections {
        margin: 0 !important;
        padding: 0 !important;
        min-height: 0 !important;
      }

      body.dx-entry-page .dex-sidebar section {
        height: auto !important;
        min-height: max-content !important;
        padding: clamp(16px, 1.35vw, 22px) clamp(16px, 1.6vw, 22px) !important;
        box-sizing: border-box !important;
      }

      body.dx-entry-page .dex-sidebar section + section {
        margin-top: clamp(12px, 1.05vw, 18px) !important;
      }

      @media (max-width: 979px) {
        html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-layout,
        html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main,
        html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const parseCssPx = (value) => {
    const num = Number.parseFloat(String(value || '').trim().replace(/px$/i, ''));
    return Number.isFinite(num) ? num : 0;
  };

  const parseFirstCssPx = (...values) => {
    for (const value of values) {
      const parsed = parseCssPx(value);
      if (parsed > 0) return parsed;
    }
    return 0;
  };

  const setFetchState = (root, state) => {
    if (!(root instanceof HTMLElement)) return;
    root.setAttribute('data-dx-fetch-state', state);
    if (state === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  };

  const createFetchShell = (variant = 'card') => {
    const shell = document.createElement('div');
    shell.className = `dx-fetch-shell dx-fetch-shell--${variant === 'rows' ? 'rows' : 'card'}`;
    if (variant === 'rows') {
      shell.innerHTML = `
        <span class="dx-fetch-shell-pill"></span>
        <span class="dx-fetch-shell-line" style="width: 94%;"></span>
        <span class="dx-fetch-shell-line" style="width: 86%;"></span>
        <span class="dx-fetch-shell-line" style="width: 72%;"></span>
      `;
      return shell;
    }

    shell.innerHTML = `
      <span class="dx-fetch-shell-pill"></span>
      <span class="dx-fetch-shell-line"></span>
      <span class="dx-fetch-shell-line" style="width: 76%;"></span>
    `;
    return shell;
  };

  const nowTs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

  const ensureFetchShell = (target, variant = 'card', marker = ENTRY_FETCH_SHELL_MARKER) => {
    if (!(target instanceof HTMLElement)) return;
    const existing = target.querySelector(`:scope > .dx-fetch-shell-overlay[${marker}="1"]`);
    if (existing) return;
    const overlay = document.createElement('div');
    overlay.className = 'dx-fetch-shell-overlay';
    overlay.setAttribute(marker, '1');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.appendChild(createFetchShell(variant));
    target.prepend(overlay);
  };

  const resolveEntryFetchTarget = (selectors = []) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node instanceof HTMLElement) return node;
    }
    return null;
  };

  const queueFetchTransition = (record, nextState) => {
    if (!record) return Promise.resolve();
    record.pending = (record.pending || Promise.resolve()).then(async () => {
      if (record.state !== FETCH_STATE_LOADING) return;
      const elapsed = nowTs() - Number(record.startTs || 0);
      if (elapsed < DX_MIN_SHEEN_MS) {
        await delay(DX_MIN_SHEEN_MS - elapsed);
      }
      if (record.state !== FETCH_STATE_LOADING) return;
      record.state = nextState;
      setFetchState(record.target, nextState);
      if (record.timeoutId) {
        window.clearTimeout(record.timeoutId);
        record.timeoutId = 0;
      }
    });
    return record.pending;
  };

  const collectEntryFetchTargets = () => {
    const seen = new Set();
    const byKey = new Map();
    ENTRY_FETCH_TARGET_SPECS.forEach((spec) => {
      const target = resolveEntryFetchTarget(spec.selectors);
      if (!(target instanceof HTMLElement) || seen.has(target)) return;
      seen.add(target);
      target.setAttribute('data-dx-entry-fetch-target', spec.key);
      byKey.set(spec.key, {
        key: spec.key,
        target,
        variant: spec.variant === 'rows' ? 'rows' : 'card',
        state: '',
        startTs: 0,
        timeoutId: 0,
        pending: Promise.resolve(),
      });
    });
    return {
      byKey,
      list: Array.from(byKey.values()),
    };
  };

  const getEntryFetchRecord = (targets, key) => {
    if (!targets || !(targets.byKey instanceof Map)) return null;
    return targets.byKey.get(String(key || '').trim()) || null;
  };

  const startTargetLoading = (record, targets = null) => {
    if (!record || !(record.target instanceof HTMLElement)) return;
    record.state = FETCH_STATE_LOADING;
    record.startTs = nowTs();
    setFetchState(record.target, FETCH_STATE_LOADING);
    ensureFetchShell(record.target, record.variant, ENTRY_FETCH_SHELL_MARKER);
    if (record.timeoutId) {
      window.clearTimeout(record.timeoutId);
      record.timeoutId = 0;
    }
    record.timeoutId = window.setTimeout(() => {
      if (record.state !== FETCH_STATE_LOADING) return;
      if (targets && record.key) {
        void markTargetError(targets, record.key);
        return;
      }
      void queueFetchTransition(record, FETCH_STATE_ERROR);
    }, DX_ENTRY_TARGET_TIMEOUT_MS);
  };

  const ensureEntryFetchShells = (targets = []) => {
    if (!targets || !Array.isArray(targets.list)) return;
    targets.list.forEach((record) => {
      startTargetLoading(record, targets);
    });
  };

  const maybeMarkEntryLayoutReady = async (targets) => {
    const layout = getEntryFetchRecord(targets, 'layout');
    if (!layout || layout.state !== FETCH_STATE_LOADING) return;
    const keys = ['header', 'media', 'description', 'overview', 'collections', 'license'];
    const unresolved = keys.some((key) => {
      const record = getEntryFetchRecord(targets, key);
      return record && record.state === FETCH_STATE_LOADING;
    });
    if (unresolved) return;
    await queueFetchTransition(layout, FETCH_STATE_READY);
  };

  const markTargetReady = async (targets, key) => {
    const record = getEntryFetchRecord(targets, key);
    if (!record) return;
    await queueFetchTransition(record, FETCH_STATE_READY);
    if (key !== 'layout') await maybeMarkEntryLayoutReady(targets);
  };

  const markTargetError = async (targets, key) => {
    const record = getEntryFetchRecord(targets, key);
    if (!record) return;
    await queueFetchTransition(record, FETCH_STATE_ERROR);
    if (key !== 'layout') await maybeMarkEntryLayoutReady(targets);
  };

  const markAllEntryFetchTargets = async (targets, state = FETCH_STATE_ERROR) => {
    if (!targets || !Array.isArray(targets.list)) return;
    const nextState = state === FETCH_STATE_READY ? FETCH_STATE_READY : FETCH_STATE_ERROR;
    await Promise.all(
      targets.list.map((record) => {
        if (!record || record.state !== FETCH_STATE_LOADING) return Promise.resolve();
        return queueFetchTransition(record, nextState);
      }),
    );
  };

  const hasMeaningfulText = (value) => String(value || '').replace(/\s+/g, ' ').trim().length > 0;

  const isHeaderReady = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const title = target.querySelector('[data-dex-entry-page-title], .dex-entry-page-title');
    const subtitle = target.querySelector('[data-dex-entry-subtitle], .dex-entry-subtitle');
    if (!(title instanceof HTMLElement) || !(subtitle instanceof HTMLElement)) return false;
    const titleTextReady = hasMeaningfulText(title.textContent);
    const subtitleValues = Array.from(subtitle.querySelectorAll('.dex-entry-subtitle-value'))
      .filter((node) => node instanceof HTMLElement)
      .map((node) => node.textContent)
      .filter((value) => hasMeaningfulText(value));
    const subtitleReady = subtitleValues.length > 0 || hasMeaningfulText(subtitle.textContent);
    return titleTextReady && subtitleReady;
  };

  const isDescriptionReady = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const content = target.querySelector('.dex-entry-desc-content') || target;
    if (!(content instanceof HTMLElement)) return false;
    const text = String(content.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length >= 16;
  };

  const watchTargetUntilReady = (target, isReady, onReady) => {
    if (!(target instanceof HTMLElement) || typeof isReady !== 'function' || typeof onReady !== 'function') return null;
    if (isReady()) {
      onReady();
      return null;
    }
    if (typeof MutationObserver !== 'function') return null;
    const observer = new MutationObserver(() => {
      if (!isReady()) return;
      observer.disconnect();
      onReady();
    });
    observer.observe(target, ENTRY_FETCH_WATCH_OPTIONS);
    return observer;
  };

  const bindHeaderFetchLifecycle = (targets) => {
    const record = getEntryFetchRecord(targets, 'header');
    if (!record) return;
    watchTargetUntilReady(record.target, () => isHeaderReady(record.target), () => {
      void markTargetReady(targets, 'header');
    });
  };

  const bindDescriptionFetchLifecycle = (targets) => {
    const record = getEntryFetchRecord(targets, 'description');
    if (!record) return;
    watchTargetUntilReady(record.target, () => isDescriptionReady(record.target), () => {
      void markTargetReady(targets, 'description');
    });
  };

  const mediaTargetLooksReady = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const mediaNode = target.querySelector('iframe, img, video, canvas');
    if (!(mediaNode instanceof Element)) return false;
    const targetRect = target.getBoundingClientRect();
    const mediaRect = mediaNode.getBoundingClientRect();
    return targetRect.width >= 120
      && targetRect.height >= 64
      && mediaRect.width >= 120
      && mediaRect.height >= 64;
  };

  const bindMediaFetchLifecycle = (targets) => {
    const record = getEntryFetchRecord(targets, 'media');
    if (!record || !(record.target instanceof HTMLElement)) return;
    let disposed = false;
    let rafId = 0;
    let observer = null;
    const nodesBound = new WeakSet();

    const cleanup = () => {
      disposed = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (observer instanceof MutationObserver) {
        observer.disconnect();
        observer = null;
      }
    };

    const settle = () => {
      if (disposed) return;
      cleanup();
      void markTargetReady(targets, 'media');
    };

    const maybeSettle = () => {
      if (disposed) return;
      if (!mediaTargetLooksReady(record.target)) return;
      settle();
    };

    const bindLoadHandlers = () => {
      const nodes = Array.from(record.target.querySelectorAll('iframe, img, video'));
      nodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || nodesBound.has(node)) return;
        nodesBound.add(node);
        node.addEventListener('load', maybeSettle, { once: true, passive: true });
      });
    };

    bindLoadHandlers();
    maybeSettle();
    if (record.state !== FETCH_STATE_LOADING) return;

    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(() => {
        bindLoadHandlers();
        maybeSettle();
      });
      observer.observe(record.target, ENTRY_FETCH_WATCH_OPTIONS);
    }

    const tick = () => {
      maybeSettle();
      const current = getEntryFetchRecord(targets, 'media');
      if (!disposed && current && current.state === FETCH_STATE_LOADING) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    window.setTimeout(maybeSettle, 60);
    window.setTimeout(maybeSettle, 240);
  };

  const fitOverviewLookupText = () => {
    const lookup = document.querySelector('.dex-overview .overview-lookup');
    if (!(lookup instanceof HTMLElement)) return;
    const lookupItem = lookup.closest('.overview-item--lookup');
    const host = lookupItem instanceof HTMLElement ? lookupItem : lookup.parentElement;
    if (!(host instanceof HTMLElement)) return;

    const hostStyle = window.getComputedStyle(host);
    const availableWidth = Math.max(
      56,
      host.clientWidth
      - parseCssPx(hostStyle.paddingLeft)
      - parseCssPx(hostStyle.paddingRight)
      - 8,
    );

    const MIN_SIZE = 12;
    const MAX_SIZE = 34;
    const lookupStyle = window.getComputedStyle(lookup);
    const probe = document.createElement('span');
    probe.textContent = String(lookup.textContent || '').trim();
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.whiteSpace = 'nowrap';
    probe.style.fontFamily = lookupStyle.fontFamily;
    probe.style.fontWeight = lookupStyle.fontWeight;
    probe.style.fontStyle = lookupStyle.fontStyle;
    probe.style.letterSpacing = lookupStyle.letterSpacing;
    probe.style.lineHeight = lookupStyle.lineHeight;
    probe.style.textTransform = lookupStyle.textTransform;
    probe.style.fontSize = `${MAX_SIZE}px`;
    host.appendChild(probe);
    const measuredWidth = Math.max(1, Math.ceil(probe.getBoundingClientRect().width));
    probe.remove();

    const SAFE_RATIO = 0.94;
    const fitSize = measuredWidth > availableWidth
      ? Math.max(MIN_SIZE, Math.floor((MAX_SIZE * (availableWidth / measuredWidth) * SAFE_RATIO) * 100) / 100)
      : MAX_SIZE;
    lookup.style.setProperty('font-size', `${fitSize}px`, 'important');
  };

  const bindOverviewLookupFit = () => {
    const schedule = () => window.requestAnimationFrame(() => fitOverviewLookupText());
    if (overviewLookupFitBound) {
      schedule();
      return;
    }
    overviewLookupFitBound = true;
    window.addEventListener('resize', schedule, { passive: true });
    if (typeof window.ResizeObserver === 'function') {
      overviewLookupResizeObserver = new ResizeObserver(schedule);
      const overview = document.querySelector('.dex-overview');
      const lookup = document.querySelector('.dex-overview .overview-lookup');
      if (overview instanceof HTMLElement) overviewLookupResizeObserver.observe(overview);
      if (lookup instanceof HTMLElement) overviewLookupResizeObserver.observe(lookup);
    }
    schedule();
    window.setTimeout(schedule, 60);
    window.setTimeout(schedule, 240);
  };

  const normalizeLocationPath = (pathname) => {
    const raw = String(pathname || '').trim();
    if (!raw) return '/';
    const clean = raw.startsWith('/') ? raw.replace(/\/+/g, '/') : `/${raw.replace(/\/+/g, '/')}`;
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean : `${clean}/`;
  };

  const seriesKey = (page) => {
    const raw = String(page.series || '').toLowerCase();
    if (raw === 'index' || raw === 'indes') return 'index';
    if (raw === 'dexfest') return 'dexfest';
    if (raw === 'dex') return 'dex';
    const u = String(page.specialEventImage || '').toLowerCase();
    if (u.includes('dexfest')) return 'dexfest';
    if (u.includes('/index')) return 'index';
    return 'dex';
  };

  const parseJsonScript = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || '{}');
    } catch (error) {
      console.error(`Invalid JSON in #${id}`, error);
      return null;
    }
  };

  const pin = (person) => {
    if (!person || typeof person === 'string') return person || '';
    const name = person.name || '';
    const links = Array.isArray(person.links) ? person.links : [];
    if (!links.length) return `<span class="person-text" data-person-linkable="false">${escapeHtml(name)}</span>`;
    return `<span class="person-link" data-person="${escapeHtml(name)}" data-links='${escapeHtml(JSON.stringify(links))}' data-person-linkable="true" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false">${escapeHtml(name)}<span class="person-pin" aria-hidden="true"></span></span>`;
  };

  const normalizePersonKey = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const normalizeLinksByPersonMap = (raw) => {
    const map = new Map();
    if (!raw || typeof raw !== 'object') return map;
    Object.entries(raw).forEach(([nameRaw, linksRaw]) => {
      const key = normalizePersonKey(nameRaw);
      if (!key) return;
      const links = Array.isArray(linksRaw) ? linksRaw : [];
      const next = links
        .map((link) => ({
          label: String(link?.label || '').trim(),
          href: String(link?.href || '').trim(),
        }))
        .filter((link) => link.label && link.href);
      if (next.length) map.set(key, next);
    });
    return map;
  };

  const pinWithLinks = (name, linksByPerson = new Map()) => {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const links = linksByPerson.get(normalizePersonKey(clean)) || [];
    return pin({ name: clean, links });
  };

  const pinValue = (value, linksByPerson = new Map()) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => pinValue(item, linksByPerson))
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join(', ');
    }
    if (value && typeof value === 'object') {
      if (typeof value.name === 'string') {
        const cleanName = String(value.name || '').replace(/\s+/g, ' ').trim();
        if (!cleanName) return '';
        const ownLinks = Array.isArray(value.links)
          ? value.links
            .map((link) => ({
              label: String(link?.label || '').trim(),
              href: String(link?.href || '').trim(),
            }))
            .filter((link) => link.label && link.href)
          : [];
        const fallbackLinks = linksByPerson.get(normalizePersonKey(cleanName)) || [];
        return pin({ name: cleanName, links: ownLinks.length ? ownLinks : fallbackLinks });
      }
      return '';
    }
    const text = String(value || '').trim();
    if (!text) return '';
    if (/<[^>]+>/.test(text) || /data-person-linkable\s*=/.test(text)) return text;
    return text
      .split(',')
      .map((part) => pinWithLinks(part, linksByPerson))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(', ');
  };

  const renderStretchHeading = (value, { seedKey = '', uppercase = true } = {}) => {
    const input = uppercase ? String(value || '').toUpperCase() : String(value || '');
    const runtime = window.__dxHeadingFx;
    const stripHeadingSeparators = (text) => String(text == null ? '' : text).replace(/\u200C/g, '');
    if (runtime && typeof runtime.renderHeadingText === 'function') {
      try {
        return stripHeadingSeparators(runtime.renderHeadingText(input, { uppercase: false, seedKey: seedKey || input }) || input);
      } catch {}
    }
    return stripHeadingSeparators(input);
  };

  const randomizeTitle = (txt, options = {}) => renderStretchHeading(txt, options);
  const addZeroWidthJoiners = (value) => {
    const cleaned = String(value == null ? '' : value).replace(/[\u200C\u200D]/g, '');
    let output = '';
    for (let i = 0; i < cleaned.length; i += 1) {
      const current = cleaned.charAt(i);
      const next = cleaned.charAt(i + 1);
      output += current;
      if (!next) continue;
      const isAlphaPair = current.toLowerCase() !== current.toUpperCase()
        && next.toLowerCase() !== next.toUpperCase();
      if (!isAlphaPair) continue;
      if (current.toLowerCase() !== next.toLowerCase()) continue;
      output += '\u200D';
    }
    return output;
  };
  const randomizeTitleWithJoiners = (txt, options = {}) => addZeroWidthJoiners(randomizeTitle(txt, options));
  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const render = (sel, title, html, noHeader = false) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const headingSeed = `${window.location.pathname || '/'}|${sel}|${title}`;
    const header = noHeader ? '' : `<h3 data-dx-entry-heading="1">${randomizeTitle(title, { seedKey: headingSeed })}</h3>`;
    el.innerHTML = `${header}${html}`;
  };

  const DEFAULT_ASSETS_API = 'https://dex-api.spring-fog-8edd.workers.dev';
  const MAX_BUNDLE_POLLS = 30;

  const resolveAssetsApiBase = () => {
    const configured = String(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_ASSETS_API || '').trim();
    return configured.replace(/\/+$/, '');
  };

  const parseAssetRefToken = (value) => {
    const raw = String(value || '').trim();
    if (!raw || /^https?:\/\//i.test(raw)) return null;
    const pivot = raw.indexOf(':');
    if (pivot <= 0 || pivot >= raw.length - 1) return null;
    const kind = raw.slice(0, pivot).toLowerCase();
    const tokenValue = raw.slice(pivot + 1).trim();
    if (!tokenValue) return null;
    if (kind === 'lookup') {
      if (!/^[A-Z]\.[A-Za-z0-9._-]{1,64}$/i.test(tokenValue)
        && !/^SUB\d{2,4}-[A-Z]\.[A-Za-z]{3}\s[A-Za-z]{2}\s(?:AV|A|V|O)\d{4}$/i.test(tokenValue)
        && !/^[A-Z]\.[A-Za-z]{3}\.\s[A-Za-z]{2}\s(?:AV|A|V|O)\d{4}(?:\sS\d+)?$/i.test(tokenValue)) {
        return null;
      }
      return { kind, value: tokenValue, normalized: `lookup:${tokenValue}` };
    }
    if (kind === 'asset' || kind === 'bundle') {
      const pattern = kind === 'bundle'
        ? /^[A-Za-z0-9._:\- ]{3,240}$/
        : /^[A-Za-z0-9._:-]{3,160}$/;
      if (!pattern.test(tokenValue)) return null;
      return { kind, value: tokenValue, normalized: `${kind}:${tokenValue}` };
    }
    return null;
  };

  const parseRecordingIndexPdfToken = (value) => {
    const parsed = parseAssetRefToken(value);
    if (!parsed) return null;
    if (parsed.kind === 'lookup' || parsed.kind === 'asset') return parsed;
    return null;
  };

  const parseRecordingIndexBundleToken = (value) => {
    const parsed = parseAssetRefToken(value);
    if (!parsed) return null;
    if (parsed.kind === 'bundle') return parsed;
    return null;
  };

  const buildEntryTooltipMarkup = (target, fallbackTooltip = '') => {
    if (!(target instanceof HTMLElement)) return '';
    const bucketKey = String(target.getAttribute('data-dx-bucket-key') || '').trim().toUpperCase();
    const statusRaw = String(target.getAttribute('data-dx-tooltip-status') || '').trim().toLowerCase();
    const audio = String(target.getAttribute('data-dx-tooltip-audio') || '').trim();
    const video = String(target.getAttribute('data-dx-tooltip-video') || '').trim();
    const mapped = String(target.getAttribute('data-dx-tooltip-mapped') || '').trim();
    const pdf = String(target.getAttribute('data-dx-tooltip-pdf') || '').trim().toLowerCase();
    const bundle = String(target.getAttribute('data-dx-tooltip-bundle') || '').trim().toLowerCase();

    const hasStructuredMetrics = statusRaw || audio || video || mapped || pdf || bundle;
    if (!hasStructuredMetrics) return '';

    const title = escapeHtml(bucketKey ? `Bucket ${bucketKey}` : String(fallbackTooltip || '').trim());
    const status = statusRaw === 'available' ? 'available' : 'unavailable';
    const statusLabel = status === 'available' ? 'Available' : 'Unavailable';
    const normalizeCount = (value) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? String(parsed) : '0';
    };
    const normalizeBinary = (value) => (String(value || '').trim().toLowerCase() === 'yes' ? 'Yes' : 'No');
    const metrics = [
      ['Audio Formats', normalizeCount(audio)],
      ['Video Formats', normalizeCount(video)],
      ['Mapped Rows', normalizeCount(mapped)],
      ['Recording PDF', normalizeBinary(pdf)],
      ['Recording Bundle', normalizeBinary(bundle)],
    ];
    const metricRows = metrics
      .map(([label, value]) => `
        <div class="dx-submit-tooltip-metric" style="display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;align-items:baseline;">
          <dt style="margin:0;font:600 0.58rem/1.15 var(--font-body, 'Courier Prime', monospace);letter-spacing:0.02em;text-transform:uppercase;opacity:0.72;">${escapeHtml(label)}</dt>
          <dd style="margin:0;font:700 0.63rem/1.15 var(--font-body, 'Courier Prime', monospace);letter-spacing:0.01em;text-transform:uppercase;">${escapeHtml(value)}</dd>
        </div>
      `)
      .join('');

    return `
      <div class="dx-submit-tooltip-card" style="display:grid;gap:8px;min-width:196px;max-width:min(312px,calc(100vw - 16px));">
        <div class="dx-submit-tooltip-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span class="dx-submit-tooltip-title" style="margin:0;font:800 0.78rem/1 var(--font-heading, 'Typefesse', sans-serif);letter-spacing:0.05em;text-transform:uppercase;">${title}</span>
          <span class="dx-submit-tooltip-status is-${status}" style="display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:999px;border:1px solid ${status === 'available' ? 'rgba(255,25,16,0.55)' : 'rgba(20,22,29,0.24)'};font:700 0.56rem/1 var(--font-body, 'Courier Prime', monospace);letter-spacing:0.03em;text-transform:uppercase;white-space:nowrap;color:${status === 'available' ? '#fff' : 'rgba(20,22,29,0.82)'};background:${status === 'available' ? 'linear-gradient(130deg, rgba(255, 25, 16, 0.92), rgba(255, 140, 16, 0.92))' : 'rgba(255,255,255,0.76)'};">${statusLabel}</span>
        </div>
        <dl class="dx-submit-tooltip-metrics" style="margin:0;display:grid;gap:3px;">${metricRows}</dl>
      </div>
    `;
  };

  const ensureEntryTooltipLayer = () => {
    let layer = document.getElementById('dx-submit-tooltip-layer');
    if (layer instanceof HTMLElement) {
      ensureFetchShell(layer, 'rows', TOOLTIP_FETCH_SHELL_MARKER);
      return layer;
    }
    layer = document.createElement('div');
    layer.id = 'dx-submit-tooltip-layer';
    layer.setAttribute('role', 'tooltip');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-state', 'hidden');
    layer.setAttribute('data-dx-tooltip-layer', '1');
    layer.setAttribute('data-dx-fetch-state', FETCH_STATE_READY);
    layer.hidden = true;
    layer.style.position = 'fixed';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '2147483000';
    layer.style.left = '0px';
    layer.style.top = '0px';
    layer.style.visibility = 'hidden';
    layer.style.opacity = '0';
    layer.style.setProperty('display', 'none', 'important');
    layer.style.padding = '10px 12px';
    layer.style.borderRadius = '10px';
    layer.style.border = '1px solid rgba(15, 19, 28, 0.18)';
    layer.style.background = 'linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 255, 0.95))';
    layer.style.boxShadow = '0 14px 28px rgba(9, 14, 24, 0.2)';
    layer.style.backdropFilter = 'blur(10px)';
    layer.style.webkitBackdropFilter = 'blur(10px)';
    layer.style.whiteSpace = 'normal';
    layer.style.color = 'rgba(18, 21, 28, 0.94)';
    layer.style.font = "600 11px/1.35 var(--font-body, 'Courier Prime', monospace)";
    layer.appendChild(document.createElement('div')).className = 'dx-submit-tooltip-content';
    ensureFetchShell(layer, 'rows', TOOLTIP_FETCH_SHELL_MARKER);
    document.body.appendChild(layer);
    return layer;
  };

  const getTooltipContentNode = (layer) => {
    if (!(layer instanceof HTMLElement)) return null;
    let content = layer.querySelector(':scope > .dx-submit-tooltip-content');
    if (content instanceof HTMLElement) return content;
    content = document.createElement('div');
    content.className = 'dx-submit-tooltip-content';
    layer.appendChild(content);
    return content;
  };

  const clearEntryTooltipMetricObserver = () => {
    if (!(activeEntryTooltipMetricsObserver instanceof MutationObserver)) return;
    try {
      activeEntryTooltipMetricsObserver.disconnect();
    } catch {}
    activeEntryTooltipMetricsObserver = null;
  };

  const hasBucketTooltipMetrics = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    return BUCKET_TOOLTIP_METRIC_ATTRS.every((attr) => hasMeaningfulText(target.getAttribute(attr)));
  };

  const setTooltipFetchState = (layer, state) => {
    if (!(layer instanceof HTMLElement)) return;
    setFetchState(layer, state);
    layer.setAttribute('data-dx-tooltip-fetch-state', state);
  };

  const armEntryTooltipMetricObserver = (target) => {
    clearEntryTooltipMetricObserver();
    if (!(target instanceof HTMLElement)) return;
    if (hasBucketTooltipMetrics(target)) return;
    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
      if (!(activeEntryTooltipTarget instanceof HTMLElement) || activeEntryTooltipTarget !== target) {
        clearEntryTooltipMetricObserver();
        return;
      }
      if (!hasBucketTooltipMetrics(target)) return;
      clearEntryTooltipMetricObserver();
      showEntryTooltip(target);
    });
    observer.observe(target, { attributes: true, attributeFilter: BUCKET_TOOLTIP_METRIC_ATTRS });
    activeEntryTooltipMetricsObserver = observer;
  };

  const hideEntryTooltip = () => {
    activeEntryTooltipTarget = null;
    clearEntryTooltipMetricObserver();
    const layer = document.getElementById('dx-submit-tooltip-layer');
    if (!(layer instanceof HTMLElement)) return;
    const content = getTooltipContentNode(layer);
    if (content instanceof HTMLElement) content.textContent = '';
    setTooltipFetchState(layer, FETCH_STATE_READY);
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-state', 'hidden');
    layer.hidden = true;
    layer.style.setProperty('display', 'none', 'important');
    layer.style.setProperty('visibility', 'hidden', 'important');
    layer.style.setProperty('opacity', '0', 'important');
    layer.removeAttribute('data-rich');
  };

  const positionEntryTooltip = (layer, target) => {
    if (!(layer instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
    const viewportPadding = 8;
    layer.style.left = '0px';
    layer.style.top = '0px';
    layer.style.maxWidth = `${Math.max(160, Math.min(280, window.innerWidth - viewportPadding * 2))}px`;

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = layer.getBoundingClientRect();

    let left = targetRect.left + ((targetRect.width - tooltipRect.width) / 2);
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));

    let top = targetRect.bottom + 8;
    if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
      top = targetRect.top - tooltipRect.height - 8;
    }
    top = Math.max(viewportPadding, top);

    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  };

  const showEntryTooltip = (target) => {
    if (!(target instanceof HTMLElement)) return;
    const tooltip = String(target.getAttribute('data-dx-tooltip') || '').trim();
    if (!tooltip) {
      hideEntryTooltip();
      return;
    }
    const layer = ensureEntryTooltipLayer();
    const content = getTooltipContentNode(layer);
    if (!(content instanceof HTMLElement)) return;
    clearEntryTooltipMetricObserver();
    const richMarkup = buildEntryTooltipMarkup(target, tooltip);
    if (richMarkup) {
      content.innerHTML = richMarkup;
      layer.setAttribute('data-rich', '1');
      setTooltipFetchState(layer, FETCH_STATE_READY);
    } else {
      content.textContent = tooltip;
      layer.removeAttribute('data-rich');
      setTooltipFetchState(layer, FETCH_STATE_LOADING);
      armEntryTooltipMetricObserver(target);
    }
    layer.hidden = false;
    layer.removeAttribute('hidden');
    layer.style.setProperty('display', 'block', 'important');
    layer.style.setProperty('visibility', 'visible', 'important');
    layer.style.setProperty('opacity', '1', 'important');
    layer.style.setProperty('z-index', '2147483000', 'important');
    layer.style.setProperty('pointer-events', 'none', 'important');
    layer.setAttribute('aria-hidden', 'false');
    layer.setAttribute('data-state', 'visible');
    activeEntryTooltipTarget = target;
    positionEntryTooltip(layer, target);
  };

  const resolveEntryTooltipTarget = (input, scope) => {
    if (!(input instanceof Element)) return null;
    const target = input.closest('[data-dx-tooltip]');
    if (!(target instanceof HTMLElement)) return null;
    if (!(scope instanceof HTMLElement) || !scope.contains(target)) return null;
    return target;
  };

  const resolveActiveEntryFooter = () => {
    const candidates = Array.from(document.querySelectorAll('.dx-slot-profile-footer .dex-footer-section, #footer-sections .dex-footer-section, .dex-footer.dx-profile-footer-portaled, #footer-sections .dex-footer, .dex-footer'));
    let best = null;
    let bestScore = -1;
    candidates.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') <= 0) return;
      const rect = node.getBoundingClientRect();
      if (rect.height <= 1 || rect.width <= 1) return;
      const bottomDistance = Math.abs(window.innerHeight - rect.bottom);
      const bottomProximity = Math.max(0, 420 - bottomDistance);
      const bottomOcclusion = Math.max(0, window.innerHeight - Math.max(0, rect.top));
      const footerExtent = Math.max(rect.height, bottomOcclusion);
      const score = (footerExtent * 6) + (bottomProximity * 5);
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    });
    return best;
  };

  const bindEntryTooltips = (scope) => {
    if (!(scope instanceof HTMLElement)) return;
    if (scope.__dxEntryTooltipAbortController instanceof AbortController) {
      try {
        scope.__dxEntryTooltipAbortController.abort();
      } catch {}
    }

    const controller = new AbortController();
    scope.__dxEntryTooltipAbortController = controller;
    const options = { signal: controller.signal };
    const pointerSupported = typeof window.PointerEvent === 'function';
    const addScopedListener = (target, type, handler, opts = options) => {
      try {
        target.addEventListener(type, handler, opts);
      } catch {
        target.addEventListener(type, handler);
      }
    };

    hideEntryTooltip();
    const tooltipNodes = Array.from(scope.querySelectorAll('[data-dx-tooltip]'));
    tooltipNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const tooltipText = String(node.getAttribute('data-dx-tooltip') || '').trim();
      if (!tooltipText) return;
      node.removeAttribute('title');
      if (!node.getAttribute('aria-label')) node.setAttribute('aria-label', tooltipText);
    });

    addScopedListener(scope, 'focusin', (event) => {
      const target = resolveEntryTooltipTarget(event.target, scope);
      if (!target) return;
      showEntryTooltip(target);
    });

    addScopedListener(scope, 'focusout', (event) => {
      const next = resolveEntryTooltipTarget(event.relatedTarget, scope);
      if (next) {
        showEntryTooltip(next);
        return;
      }
      hideEntryTooltip();
    });

    const leaveToNextTarget = (event, node) => {
      const next = resolveEntryTooltipTarget(event?.relatedTarget, scope);
      if (next && next !== node) {
        showEntryTooltip(next);
        return;
      }
      if (activeEntryTooltipTarget === node) hideEntryTooltip();
    };

    tooltipNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (pointerSupported) {
        addScopedListener(node, 'pointerenter', () => showEntryTooltip(node), { ...options, capture: true });
        addScopedListener(node, 'pointerleave', (event) => leaveToNextTarget(event, node), { ...options, capture: true });
      } else {
        addScopedListener(node, 'mouseenter', () => showEntryTooltip(node), { ...options, capture: true });
        addScopedListener(node, 'mouseleave', (event) => leaveToNextTarget(event, node), { ...options, capture: true });
      }
    });

    addScopedListener(scope, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      hideEntryTooltip();
    });

    addScopedListener(window, 'scroll', () => {
      if (!(activeEntryTooltipTarget instanceof HTMLElement)) return;
      const layer = document.getElementById('dx-submit-tooltip-layer');
      if (layer instanceof HTMLElement && !layer.hidden) {
        if (!document.contains(activeEntryTooltipTarget)) {
          hideEntryTooltip();
          return;
        }
        positionEntryTooltip(layer, activeEntryTooltipTarget);
      }
    }, { signal: controller.signal, passive: true });

    addScopedListener(window, 'resize', () => {
      if (!(activeEntryTooltipTarget instanceof HTMLElement)) return;
      const layer = document.getElementById('dx-submit-tooltip-layer');
      if (layer instanceof HTMLElement && !layer.hidden) {
        if (!document.contains(activeEntryTooltipTarget)) {
          hideEntryTooltip();
          return;
        }
        positionEntryTooltip(layer, activeEntryTooltipTarget);
      }
    });
  };

  const applyEntryRailLayout = () => {
    const layout = document.querySelector('.dex-entry-layout');
    const main = layout?.querySelector('.dex-entry-main');
    const sidebar = layout?.querySelector('.dex-sidebar');
    const header = document.querySelector('.dex-entry-header');
    const footer = resolveActiveEntryFooter();
    if (!(layout instanceof HTMLElement) || !(main instanceof HTMLElement) || !(sidebar instanceof HTMLElement) || !(header instanceof HTMLElement)) return;

    const desktop = window.innerWidth >= ENTRY_RAIL_BREAKPOINT;
    const root = document.documentElement;
    const globalHeader = document.querySelector('.header-announcement-bar-wrapper, #header, #siteHeader');
    const docStyle = window.getComputedStyle(document.documentElement);
    const bodyStyle = window.getComputedStyle(document.body);
    let headerOffset = parseCssPx(docStyle.getPropertyValue('--dx-fixed-header-top'))
      + parseCssPx(docStyle.getPropertyValue('--dx-slot-content-offset'));
    if (!headerOffset && globalHeader instanceof HTMLElement) {
      const style = window.getComputedStyle(globalHeader);
      if (style.position === 'fixed' || style.position === 'sticky') {
        const rect = globalHeader.getBoundingClientRect();
        headerOffset = Math.min(120, Math.max(0, Math.ceil(rect.bottom + 8)));
      }
    }
    root.style.setProperty('--dx-entry-header-offset', `${headerOffset}px`);
    if (!desktop) {
      root.setAttribute('data-dx-entry-rail-mode', 'mobile-flow');
      document.body.setAttribute('data-dx-entry-rail-mode', 'mobile-flow');
      document.body.classList.remove('dx-entry-desktop-fixed');
      root.style.removeProperty('--dx-entry-rails-height');
      root.style.removeProperty('--dx-entry-rail-inline-pad');
      root.style.removeProperty('--dx-entry-footer-inline-pad');
      document.body.style.removeProperty('overflow');
      main.style.height = '';
      main.style.maxHeight = '';
      sidebar.style.height = '';
      sidebar.style.maxHeight = '';
      main.style.overflowY = '';
      sidebar.style.overflowY = '';
      return;
    }

    let bottomInset = 20;
    const footerBottomVar = parseFirstCssPx(
      docStyle.getPropertyValue('--dx-profile-footer-bottom'),
      bodyStyle.getPropertyValue('--dx-profile-footer-bottom')
    );
    const footerHeightVar = parseFirstCssPx(
      docStyle.getPropertyValue('--dx-profile-footer-height'),
      docStyle.getPropertyValue('--dx-profile-footer-height-effective'),
      bodyStyle.getPropertyValue('--dx-profile-footer-height'),
      bodyStyle.getPropertyValue('--dx-profile-footer-height-effective')
    );
    if (footerHeightVar > 0) {
      bottomInset = Math.max(bottomInset, Math.ceil(footerBottomVar + footerHeightVar + 12));
    }
    if (footer instanceof HTMLElement) {
      const footerRect = footer.getBoundingClientRect();
      const bottomOcclusion = Math.max(0, window.innerHeight - Math.max(0, footerRect.top));
      const footerExtent = Math.max(footerRect.height, bottomOcclusion);
      if (footerExtent > 0) bottomInset = Math.max(bottomInset, Math.ceil(footerExtent + 12));
    }

    const layoutRect = layout.getBoundingClientRect();
    const topInset = Math.max(0, Math.ceil(layoutRect.top));
    const available = Math.max(280, Math.floor(window.innerHeight - topInset - bottomInset));
    const railInlinePad = Math.max(14, Math.min(24, Math.round(window.innerWidth * 0.016)));
    const footerGap = Math.max(16, Math.min(42, Math.round(Math.max(railInlinePad * 1.1, bottomInset * 0.16))));
    root.style.setProperty('--dx-entry-rails-height', `${available}px`);
    root.style.setProperty('--dx-entry-rail-inline-pad', `${railInlinePad}px`);
    root.style.setProperty('--dx-entry-footer-inline-pad', `${railInlinePad}px`);
    root.style.setProperty('--dx-entry-footer-gap', `${footerGap}px`);
    root.setAttribute('data-dx-entry-rail-mode', 'desktop-fixed');
    document.body.setAttribute('data-dx-entry-rail-mode', 'desktop-fixed');
    document.body.classList.add('dx-entry-desktop-fixed');
    document.body.style.overflow = 'hidden';

    main.style.height = `${available}px`;
    main.style.maxHeight = `${available}px`;
    sidebar.style.height = `${available}px`;
    sidebar.style.maxHeight = `${available}px`;
    main.style.overflowY = 'hidden';
    sidebar.style.overflowY = 'auto';

    layout.setAttribute('data-dx-entry-rail-mode', 'desktop-fixed');

    const desc = main.querySelector('.dex-entry-desc-scroll');
    if (desc instanceof HTMLElement) {
      desc.style.minHeight = '0px';
      if (typeof window.__dexDescSyncSchedule === 'function') {
        try { window.__dexDescSyncSchedule(); } catch {}
      }
    }
  };

  const bindEntryRailLayout = () => {
    if (entryRailLayoutBound) {
      applyEntryRailLayout();
      return;
    }
    entryRailLayoutBound = true;
    let bindFooterObservers = () => {};
    const schedule = () => window.requestAnimationFrame(() => {
      bindFooterObservers();
      applyEntryRailLayout();
    });
    const scheduleBurst = () => {
      schedule();
      window.setTimeout(schedule, 80);
      window.setTimeout(schedule, 220);
      window.setTimeout(schedule, 420);
      window.setTimeout(() => bindFooterObservers(), 50);
      window.setTimeout(() => bindFooterObservers(), 180);
    };
    bindFooterObservers = () => {
      const footer = resolveActiveEntryFooter();
      if (!(footer instanceof HTMLElement)) return;
      if (entryRailObservedFooter === footer) return;
      if (entryRailFooterResizeObserver instanceof ResizeObserver) {
        try { entryRailFooterResizeObserver.disconnect(); } catch {}
      }
      if (entryRailFooterMutationObserver instanceof MutationObserver) {
        try { entryRailFooterMutationObserver.disconnect(); } catch {}
      }
      entryRailObservedFooter = footer;
      if (typeof window.ResizeObserver === 'function') {
        entryRailFooterResizeObserver = new ResizeObserver(() => schedule());
        entryRailFooterResizeObserver.observe(footer);
      }
      if (typeof window.MutationObserver === 'function') {
        entryRailFooterMutationObserver = new MutationObserver(() => schedule());
        entryRailFooterMutationObserver.observe(footer, { attributes: true, childList: true, subtree: true });
      }
    };
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule, { once: true });
    window.addEventListener('load', () => bindFooterObservers(), { once: true });
    window.addEventListener('dx:slotready', scheduleBurst);
    window.addEventListener('dx:route-transition-in:end', scheduleBurst);
    window.addEventListener('dx:route-transition-out:end', scheduleBurst);
    schedule();
    window.setTimeout(bindFooterObservers, 40);
    window.setTimeout(schedule, 60);
    window.setTimeout(bindFooterObservers, 120);
    window.setTimeout(schedule, 240);
    window.setTimeout(bindFooterObservers, 420);
  };

  const bindBreadcrumbSpinFallback = () => {
    const delimiter = document.querySelector('[data-dex-breadcrumb-delimiter]');
    if (!(delimiter instanceof HTMLElement) || delimiter.dataset.dxSpinBound === '1') return;
    delimiter.dataset.dxSpinBound = '1';
    const triggerSpin = () => {
      const shouldSpin = Math.random() < 0.82;
      if (!shouldSpin) return;
      const path = delimiter.querySelector('[data-dex-breadcrumb-path]');
      if (path instanceof SVGElement) {
        path.style.opacity = '1';
        path.style.visibility = 'visible';
      }
      delimiter.classList.remove('dx-spin-once');
      void delimiter.offsetWidth;
      delimiter.classList.add('dx-spin-once');
      window.setTimeout(() => delimiter.classList.remove('dx-spin-once'), 780);
    };
    document.addEventListener('click', (event) => {
      const target = event && event.target && event.target.closest
        ? event.target.closest('[data-dex-breadcrumb-back], [data-dex-breadcrumb-delimiter], .dex-breadcrumb-current')
        : null;
      if (!target) return;
      triggerSpin();
    }, true);
  };

  const setDownloadState = (row, state, message) => {
    if (!row) return;
    const statusEl = row.querySelector('[data-dx-download-status]');
    row.setAttribute('data-dx-download-state', state || 'idle');
    if (!statusEl) return;
    statusEl.textContent = String(message || '');
    statusEl.hidden = !String(message || '').trim();
  };

  const getAccessToken = async () => {
    const auth = window.DEX_AUTH || window.dexAuth || null;
    if (!auth || typeof auth.getAccessToken !== 'function') return '';
    try {
      const token = await auth.getAccessToken();
      return String(token || '').trim();
    } catch {
      return '';
    }
  };

  const requestAssetsJson = async ({ path, method, body }) => {
    const token = await getAccessToken();
    if (!token) {
      const err = new Error('unauthorized');
      err.code = 'forbidden';
      throw err;
    }

    const headers = {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(`${resolveAssetsApiBase()}${path}`, {
      method: method || 'GET',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
    });
    const text = await res.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(payload?.message || payload?.error || `http_${res.status}`);
      if (res.status === 403) err.code = 'forbidden';
      else if (res.status === 404) err.code = 'not-found';
      else err.code = 'failed';
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  };

  const resolveBundleReadyPayload = (payload) => {
    const status = String(payload?.status || '').toLowerCase();
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
      const err = new Error(payload?.message || 'failed');
      err.code = 'failed';
      throw err;
    }
    const signedUrl = String(payload?.signedUrl || payload?.url || payload?.downloadUrl || '').trim();
    if (status === 'ready' && signedUrl) {
      return { signedUrl, expiresAt: String(payload?.expiresAt || '').trim() };
    }
    return null;
  };

  const pollBundleReady = async (jobId, onQueuedTick) => {
    const safeJobId = encodeURIComponent(String(jobId || '').trim());
    if (!safeJobId) {
      const err = new Error('missing job id');
      err.code = 'failed';
      throw err;
    }
    for (let attempt = 0; attempt < MAX_BUNDLE_POLLS; attempt += 1) {
      const payload = await requestAssetsJson({
        path: `/me/assets/bundle/${safeJobId}`,
        method: 'GET',
      });
      const ready = resolveBundleReadyPayload(payload);
      if (ready) return ready;
      if (typeof onQueuedTick === 'function') onQueuedTick(attempt, payload);
      const waitMs = Number(payload?.pollAfterMs || 1200);
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(350, Math.min(waitMs, 3000))));
    }
    const err = new Error('bundle_timeout');
    err.code = 'failed';
    throw err;
  };

  const openSignedUrl = (url) => {
    const href = String(url || '').trim();
    if (!href) return false;
    const win = window.open(href, '_blank', 'noopener');
    if (win) return true;
    window.location.assign(href);
    return true;
  };

  const requestBundleDownload = async ({ lookup, tokens, onQueuedTick }) => {
    const safeLookup = String(lookup || '').trim();
    if (!safeLookup) {
      const err = new Error('missing lookup');
      err.code = 'not-found';
      throw err;
    }
    const payload = await requestAssetsJson({
      path: `/me/assets/${encodeURIComponent(safeLookup)}/bundle`,
      method: 'POST',
      body: {
        tokens: Array.isArray(tokens) ? tokens : [],
        source: 'entry-sidebar',
      },
    });
    const delivery = String(payload?.delivery || '').toLowerCase();
    if (delivery === 'sync') {
      const signedUrl = String(payload?.signedUrl || payload?.url || '').trim();
      if (!signedUrl) {
        const err = new Error('missing signed url');
        err.code = 'failed';
        throw err;
      }
      return { signedUrl, expiresAt: String(payload?.expiresAt || '').trim() };
    }
    if (delivery === 'async') {
      const jobId = String(payload?.jobId || '').trim();
      return pollBundleReady(jobId, onQueuedTick);
    }
    const fallback = resolveBundleReadyPayload(payload);
    if (fallback) return fallback;
    const err = new Error('unsupported bundle response');
    err.code = 'failed';
    throw err;
  };

  const bucketHasAnyAsset = (cfg, bucket) => {
    const audio = Object.values(cfg.downloads.audioFileIds?.[bucket] || {});
    const video = Object.values(cfg.downloads.videoFileIds?.[bucket] || {});
    return [...audio, ...video].some((value) => String(value || '').trim());
  };

  const getFavoritesApi = () => {
    const api = window.__dxFavorites;
    if (!api || typeof api.toggle !== 'function' || typeof api.isFavorite !== 'function' || typeof api.keyFor !== 'function') {
      return null;
    }
    return api;
  };

  const ensureFavoritesApi = (origin) => {
    const existing = getFavoritesApi();
    if (existing) return Promise.resolve(existing);
    if (favoritesRuntimePromise) return favoritesRuntimePromise;

    favoritesRuntimePromise = new Promise((resolve) => {
      const done = () => resolve(getFavoritesApi());
      const src = new URL(FAVORITES_RUNTIME_PATH, origin || window.location.origin).toString();
      const found = Array.from(document.querySelectorAll('script[src]')).find((script) => {
        try {
          const parsed = new URL(script.src, window.location.href);
          return parsed.pathname === FAVORITES_RUNTIME_PATH;
        } catch {
          return false;
        }
      });

      if (found) {
        if (getFavoritesApi()) {
          done();
          return;
        }
        found.addEventListener('load', done, { once: true });
        found.addEventListener('error', done, { once: true });
        window.setTimeout(done, 3000);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = done;
      script.onerror = done;
      document.head.appendChild(script);
      window.setTimeout(done, 3000);
    });

    return favoritesRuntimePromise;
  };

  const ensureFavoritesUiStyles = () => {
    if (document.getElementById(FAVORITES_UI_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = FAVORITES_UI_STYLE_ID;
    style.textContent = `
      .dx-fav-sr {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      .dx-fav-heart-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.3rem;
        min-width: 2rem;
        min-height: 2rem;
        width: auto;
        padding: 0.42rem 0.56rem;
        border-radius: 999px;
        border: 1px solid rgba(27, 33, 45, 0.24);
        background: rgba(255, 255, 255, 0.3);
        color: rgba(29, 33, 42, 0.86);
        line-height: 1;
        cursor: pointer;
        overflow: visible;
        transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 180ms ease;
      }

      .dx-fav-heart-btn:hover,
      .dx-fav-heart-btn:focus-visible {
        transform: translateY(-1px);
        border-color: rgba(224, 36, 94, 0.42);
      }

      .dx-fav-heart-btn .dx-fav-heart-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        pointer-events: none;
      }

      .dx-fav-heart-btn .dx-fav-heart-svg {
        width: 1rem;
        height: 1rem;
        stroke: currentColor;
      }

      .dx-fav-heart-btn .dx-fav-heart-svg path {
        fill: transparent;
        transition: fill 160ms ease, stroke 160ms ease;
      }

      .dx-fav-heart-btn .dx-fav-heart-chip {
        font-family: "Courier Prime", monospace;
        font-size: 0.66rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 700;
      }

      .dx-fav-heart-btn.is-active {
        color: #e0245e;
        border-color: rgba(224, 36, 94, 0.44);
        background: rgba(224, 36, 94, 0.1);
      }

      .dx-fav-heart-btn.is-active .dx-fav-heart-svg path {
        fill: currentColor;
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1'] .dx-fav-heart-icon {
        animation: dx-fav-heart-pop 460ms cubic-bezier(.17,.89,.31,1.35);
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1']::before,
      .dx-fav-heart-btn[data-dx-fav-animating='1']::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        pointer-events: none;
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1']::before {
        width: 0.42rem;
        height: 0.42rem;
        border-radius: 999px;
        border: 2px solid rgba(224, 36, 94, 0.45);
        transform: translate(-50%, -50%);
        animation: dx-fav-heart-ring 520ms ease-out;
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1']::after {
        width: 0.15rem;
        height: 0.15rem;
        border-radius: 999px;
        background: rgba(224, 36, 94, 0.92);
        transform: translate(-50%, -50%);
        box-shadow:
          0 -1rem 0 rgba(224, 36, 94, 0.86),
          0.94rem -0.32rem 0 rgba(255, 120, 154, 0.88),
          0.86rem 0.56rem 0 rgba(255, 58, 111, 0.82),
          -0.86rem 0.56rem 0 rgba(255, 89, 129, 0.78),
          -0.94rem -0.32rem 0 rgba(255, 133, 164, 0.84);
        animation: dx-fav-heart-spark 560ms ease-out;
      }

      .overview-item .dx-fav-heart-btn {
        min-width: 2.05rem;
      }

      .dx-fav-file-toggle {
        min-height: 1.9rem;
      }

      @keyframes dx-fav-heart-pop {
        0% { transform: scale(0.62); }
        50% { transform: scale(1.22); }
        100% { transform: scale(1); }
      }

      @keyframes dx-fav-heart-ring {
        0% { opacity: 0.78; transform: translate(-50%, -50%) scale(0.2); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2); }
      }

      @keyframes dx-fav-heart-spark {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
        24% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.34); }
      }

      #${FAVORITES_TOAST_ROOT_ID} {
        position: fixed;
        left: 50%;
        bottom: max(16px, env(safe-area-inset-bottom, 0px) + 8px);
        transform: translateX(-50%);
        z-index: 2147482400;
        pointer-events: none;
      }

      #${FAVORITES_TOAST_ID} {
        border: 1px solid rgba(255, 255, 255, 0.42);
        border-radius: 999px;
        background: linear-gradient(128deg, rgba(23, 28, 40, 0.9), rgba(38, 20, 40, 0.88));
        color: #fff2f7;
        font-family: "Courier Prime", monospace;
        font-size: 12px;
        letter-spacing: 0.02em;
        line-height: 1;
        padding: 0.62rem 0.96rem;
        box-shadow: 0 12px 30px rgba(14, 16, 24, 0.34);
        backdrop-filter: blur(16px) saturate(150%);
        -webkit-backdrop-filter: blur(16px) saturate(150%);
        opacity: 0;
        transform: translateY(6px) scale(0.97);
        transition: opacity 170ms ease, transform 170ms ease;
      }

      #${FAVORITES_TOAST_ID}.is-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      @media (prefers-reduced-motion: reduce) {
        .dx-fav-heart-btn[data-dx-fav-animating='1'] .dx-fav-heart-icon,
        .dx-fav-heart-btn[data-dx-fav-animating='1']::before,
        .dx-fav-heart-btn[data-dx-fav-animating='1']::after {
          animation: none !important;
        }
        #${FAVORITES_TOAST_ID} {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const showFavoritesToast = (message = 'Added to favorites!') => {
    ensureFavoritesUiStyles();
    let root = document.getElementById(FAVORITES_TOAST_ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = FAVORITES_TOAST_ROOT_ID;
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'true');
      document.body.appendChild(root);
    }
    let toast = document.getElementById(FAVORITES_TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = FAVORITES_TOAST_ID;
      root.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    if (favoritesToastTimer) {
      window.clearTimeout(favoritesToastTimer);
      favoritesToastTimer = 0;
    }
    favoritesToastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      favoritesToastTimer = 0;
    }, 1800);
  };

  const animateFavoriteAdded = (button) => {
    if (!(button instanceof HTMLElement)) return;
    if (prefersReducedMotion()) return;
    button.setAttribute('data-dx-fav-animating', '1');
    window.setTimeout(() => {
      if (button.getAttribute('data-dx-fav-animating') === '1') {
        button.removeAttribute('data-dx-fav-animating');
      }
    }, 620);
  };

  const ensureFavoriteButtonContent = (button) => {
    if (!(button instanceof HTMLElement)) return;
    if (button.dataset.dxFavUiReady === '1') return;
    button.dataset.dxFavUiReady = '1';
    button.classList.add('dx-fav-heart-btn');
    const chip = String(button.getAttribute('data-dx-fav-chip') || '').trim().toUpperCase();
    button.innerHTML = `
      <span class="dx-fav-heart-icon">${HEART_SVG}</span>
      ${chip ? `<span class="dx-fav-heart-chip">${chip}</span>` : ''}
      <span class="dx-fav-sr"></span>
    `;
  };

  const setFavoriteButtonState = (button, active, activeLabel, inactiveLabel) => {
    ensureFavoritesUiStyles();
    ensureFavoriteButtonContent(button);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.toggle('is-active', active);
    const label = active ? activeLabel : inactiveLabel;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    const sr = button.querySelector('.dx-fav-sr');
    if (sr) sr.textContent = label;
  };

  const refreshFavoriteButtons = (favoritesApi, root = document) => {
    const api = favoritesApi || getFavoritesApi();
    if (!api) return;
    root.querySelectorAll('[data-dx-fav-key]').forEach((button) => {
      const key = String(button.getAttribute('data-dx-fav-key') || '').trim();
      if (!key) return;
      const active = api.isFavorite(key);
      const activeLabel = String(button.getAttribute('data-dx-fav-active-label') || 'Favorited');
      const inactiveLabel = String(button.getAttribute('data-dx-fav-inactive-label') || 'Favorite');
      setFavoriteButtonState(button, active, activeLabel, inactiveLabel);
    });
  };

  const bindFavoritesSignals = (favoritesApi) => {
    if (favoritesSignalsBound) return;
    const api = favoritesApi || getFavoritesApi();
    if (!api) return;
    favoritesSignalsBound = true;
    window.addEventListener('dx:favorites:changed', () => {
      refreshFavoriteButtons(api, document);
    });
    window.addEventListener('storage', (event) => {
      const key = String(event?.key || '').trim();
      if (!key || !key.startsWith(FAVORITES_STORAGE_PREFIX)) return;
      refreshFavoriteButtons(api, document);
    });
  };

  const bindFavoriteToggle = (button, favoritesApi, record, labels) => {
    const api = favoritesApi || getFavoritesApi();
    if (!api || !button || !record) return;
    const activeLabel = labels?.active || 'Favorited';
    const inactiveLabel = labels?.inactive || 'Favorite';
    const key = api.keyFor(record);
    if (!key) return;

    button.setAttribute('data-dx-fav-key', key);
    button.setAttribute('data-dx-fav-kind', String(record.kind || 'entry'));
    button.setAttribute('data-dx-fav-lookup', String(record.lookupNumber || ''));
    button.setAttribute('data-dx-fav-active-label', activeLabel);
    button.setAttribute('data-dx-fav-inactive-label', inactiveLabel);

    if (button.dataset.dxFavBound !== '1') {
      button.dataset.dxFavBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const result = api.toggle(record);
        if (result && result.action === 'added') {
          animateFavoriteAdded(button);
          showFavoritesToast('Added to favorites!');
        }
        refreshFavoriteButtons(api, document);
      });
    }

    setFavoriteButtonState(button, api.isFavorite(key), activeLabel, inactiveLabel);
  };

  const buildEntryFavoriteRecord = (lookup, entryHref) => ({
    kind: 'entry',
    lookupNumber: String(lookup || 'Unknown lookup').trim() || 'Unknown lookup',
    entryLookupNumber: String(lookup || 'Unknown lookup').trim() || 'Unknown lookup',
    entryHref: normalizeLocationPath(entryHref || window.location.pathname || '/'),
    source: 'entry-sidebar',
  });

  const buildBucketFavoriteRecord = (lookup, entryHref, bucket) => {
    const bucketLabel = String(bucket || '').trim().toUpperCase();
    const entryLookup = String(lookup || 'Unknown lookup').trim() || 'Unknown lookup';
    return {
      kind: 'bucket',
      lookupNumber: `${entryLookup} ${bucketLabel}`,
      entryLookupNumber: entryLookup,
      entryHref: normalizeLocationPath(entryHref || window.location.pathname || '/'),
      bucket: bucketLabel,
      source: 'entry-sidebar',
    };
  };

  const buildFileFavoriteRecord = ({ lookup, entryHref, bucket, format, fileId, type }) => {
    const entryLookup = String(lookup || 'Unknown lookup').trim() || 'Unknown lookup';
    const bucketLabel = String(bucket || '').trim().toUpperCase();
    const formatKey = String(format?.key || '').trim();
    const formatLabel = String(format?.label || formatKey || '').trim();
    return {
      kind: 'file',
      lookupNumber: `${entryLookup} ${bucketLabel} [${formatLabel || formatKey || type}]`,
      entryLookupNumber: entryLookup,
      entryHref: normalizeLocationPath(entryHref || window.location.pathname || '/'),
      bucket: bucketLabel,
      formatKey,
      formatLabel,
      fileId: String(fileId || '').trim(),
      source: 'entry-sidebar',
    };
  };

  const getDownloadModalConfig = (cfg = {}) => {
    const raw = cfg?.downloads?.modal && typeof cfg.downloads.modal === 'object'
      ? cfg.downloads.modal
      : {};
    const groupBy = String(raw.groupBy || 'bucket').toLowerCase() === 'format' ? 'format' : 'bucket';
    const defaultFilter = String(raw.defaultFilter || 'available').toLowerCase() === 'all' ? 'all' : 'available';
    return {
      groupBy,
      showUnavailable: Boolean(raw.showUnavailable),
      defaultFilter,
      enableBatch: raw.enableBatch !== false,
    };
  };

  const buildDownloadRows = ({ cfg, type, buckets, formats }) => {
    const rows = [];
    for (const bucket of buckets) {
      const fileIds = (type === 'audio' ? cfg.downloads.audioFileIds?.[bucket] : cfg.downloads.videoFileIds?.[bucket]) || {};
      for (const fmt of formats) {
        const tokenRaw = String(fileIds?.[fmt.key] || '').trim();
        const parsedToken = parseAssetRefToken(tokenRaw);
        rows.push({
          bucket,
          format: fmt,
          tokenRaw,
          parsedToken,
          available: Boolean(parsedToken),
          invalid: Boolean(tokenRaw && !parsedToken),
          rowId: `${bucket}:${fmt.key}`,
        });
      }
    }
    return rows;
  };

  const sortDownloadRows = (rows, groupBy) => {
    const list = Array.isArray(rows) ? rows.slice() : [];
    list.sort((a, b) => {
      if (groupBy === 'format') {
        const f = String(a.format?.label || a.format?.key || '').localeCompare(String(b.format?.label || b.format?.key || ''));
        if (f !== 0) return f;
      } else {
        const bucketCmp = String(a.bucket || '').localeCompare(String(b.bucket || ''));
        if (bucketCmp !== 0) return bucketCmp;
      }
      return String(a.format?.label || a.format?.key || '').localeCompare(String(b.format?.label || b.format?.key || ''));
    });
    return list;
  };

  const buildDownloadRowsForRender = (rows, { filterMode, showUnavailable }) => {
    let nextRows = Array.isArray(rows) ? rows.slice() : [];
    if (filterMode === 'available') {
      nextRows = nextRows.filter((row) => row.available);
    } else if (!showUnavailable) {
      nextRows = nextRows.filter((row) => row.available || row.invalid);
    }
    return nextRows;
  };

  const attach = (cfg, type, btnSel, context) => {
    const btn = document.querySelector(btnSel);
    if (!btn || btn.dataset.dexBound === '1') return;
    btn.dataset.dexBound = '1';
    btn.addEventListener('click', () => {
      const formats = cfg.downloads.formats[type] || [];
      const allBuckets = ALL_BUCKETS;
      const modalConfig = getDownloadModalConfig(cfg);
      const rows = sortDownloadRows(
        buildDownloadRows({
          cfg,
          type,
          buckets: allBuckets,
          formats,
        }),
        modalConfig.groupBy,
      );
      const selectedTokens = new Set();
      let filterMode = modalConfig.defaultFilter;

      const modal = document.createElement('div');
      modal.className = 'dex-download-modal';
      const inner = document.createElement('div');
      inner.className = 'dex-download-modal-inner';
      const close = document.createElement('button');
      close.className = 'close';
      close.setAttribute('aria-label', 'Close');
      close.type = 'button';
      close.textContent = '×';

      const heading = document.createElement('h4');
      heading.textContent = `${type === 'audio' ? 'Audio' : 'Video'} downloads`;
      heading.style.margin = '0 0 0.35rem';
      heading.style.fontFamily = '"Typefesse", sans-serif';
      heading.style.letterSpacing = '0.02em';
      heading.style.textTransform = 'uppercase';

      const statusBanner = document.createElement('p');
      statusBanner.style.margin = '0';
      statusBanner.style.fontSize = '0.75rem';
      statusBanner.style.lineHeight = '1.35';
      statusBanner.style.opacity = '0.82';
      statusBanner.hidden = true;

      const setModalStatus = (state, message) => {
        const text = String(message || '').trim();
        if (!text) {
          statusBanner.hidden = true;
          statusBanner.textContent = '';
          statusBanner.removeAttribute('data-dx-download-state');
          return;
        }
        statusBanner.hidden = false;
        statusBanner.setAttribute('data-dx-download-state', String(state || 'idle'));
        statusBanner.textContent = text;
      };

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.alignItems = 'center';
      controls.style.justifyContent = 'space-between';
      controls.style.gap = '0.45rem';
      controls.style.flexWrap = 'wrap';

      const chipWrap = document.createElement('div');
      chipWrap.style.display = 'inline-flex';
      chipWrap.style.gap = '0.35rem';

      const chipAll = document.createElement('button');
      chipAll.type = 'button';
      chipAll.className = 'dx-button-element--secondary';
      chipAll.textContent = 'All';
      chipAll.style.padding = '0.34rem 0.55rem';
      chipAll.style.fontSize = '0.7rem';

      const chipAvailable = document.createElement('button');
      chipAvailable.type = 'button';
      chipAvailable.className = 'dx-button-element--secondary';
      chipAvailable.textContent = 'Available';
      chipAvailable.style.padding = '0.34rem 0.55rem';
      chipAvailable.style.fontSize = '0.7rem';

      const batchButton = document.createElement('button');
      batchButton.type = 'button';
      batchButton.className = 'dx-button-element--secondary';
      batchButton.textContent = 'Download selected';
      batchButton.style.padding = '0.34rem 0.55rem';
      batchButton.style.fontSize = '0.72rem';
      batchButton.hidden = !modalConfig.enableBatch;
      batchButton.disabled = true;

      chipWrap.appendChild(chipAll);
      chipWrap.appendChild(chipAvailable);
      controls.appendChild(chipWrap);
      controls.appendChild(batchButton);

      const list = document.createElement('div');
      list.style.display = 'grid';
      list.style.gap = '0.4rem';
      list.style.maxHeight = '60vh';
      list.style.overflowY = 'auto';
      list.style.paddingRight = '0.15rem';

      const updateChipState = () => {
        chipAll.setAttribute('aria-pressed', String(filterMode === 'all'));
        chipAvailable.setAttribute('aria-pressed', String(filterMode === 'available'));
        chipAll.style.opacity = filterMode === 'all' ? '1' : '0.75';
        chipAvailable.style.opacity = filterMode === 'available' ? '1' : '0.75';
      };

      const updateBatchState = () => {
        batchButton.disabled = selectedTokens.size === 0;
        batchButton.textContent = selectedTokens.size > 0
          ? `Download selected (${selectedTokens.size})`
          : 'Download selected';
      };

      const removeModal = () => {
        document.removeEventListener('keydown', onKeyDown);
        modal.remove();
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') removeModal();
      };

      const renderRows = () => {
        list.replaceChildren();
        const visibleRows = buildDownloadRowsForRender(rows, {
          filterMode,
          showUnavailable: modalConfig.showUnavailable,
        });
        if (!visibleRows.length) {
          const empty = document.createElement('p');
          empty.style.margin = '0';
          empty.style.opacity = '0.75';
          empty.textContent = 'No downloads available for this filter.';
          list.appendChild(empty);
          updateBatchState();
          return;
        }

        visibleRows.forEach((rowData) => {
          const row = document.createElement('div');
          row.style.display = 'grid';
          row.style.gridTemplateColumns = modalConfig.enableBatch ? 'auto minmax(0,1fr) auto' : 'minmax(0,1fr) auto';
          row.style.alignItems = 'center';
          row.style.gap = '0.45rem';
          row.style.padding = '0.35rem 0.4rem';
          row.style.border = '1px solid rgba(0,0,0,0.12)';
          row.style.borderRadius = '10px';
          row.setAttribute('data-dx-download-state', 'idle');

          if (modalConfig.enableBatch) {
            const select = document.createElement('input');
            select.type = 'checkbox';
            select.disabled = !rowData.available;
            select.checked = rowData.available && selectedTokens.has(rowData.parsedToken?.normalized);
            select.addEventListener('change', () => {
              if (!rowData.available || !rowData.parsedToken?.normalized) return;
              if (select.checked) selectedTokens.add(rowData.parsedToken.normalized);
              else selectedTokens.delete(rowData.parsedToken.normalized);
              updateBatchState();
            });
            row.appendChild(select);
          }

          const actionWrap = document.createElement('div');
          actionWrap.style.display = 'inline-flex';
          actionWrap.style.flexDirection = 'column';
          actionWrap.style.gap = '0.2rem';

          const actionButton = document.createElement('button');
          actionButton.type = 'button';
          actionButton.className = 'dx-button-element--secondary';
          actionButton.style.justifySelf = 'start';
          actionButton.textContent = `${rowData.bucket} · ${rowData.format?.label || rowData.format?.key || 'file'}`;

          const status = document.createElement('span');
          status.setAttribute('data-dx-download-status', '1');
          status.style.opacity = '0.8';
          status.style.fontSize = '0.74rem';
          status.hidden = true;

          if (!rowData.available) {
            actionButton.disabled = true;
            actionButton.setAttribute('aria-disabled', 'true');
            if (rowData.invalid) {
              setDownloadState(row, 'error', 'Invalid token (DX-DL-422).');
            } else {
              setDownloadState(row, 'not-found', 'Unavailable (DX-DL-404).');
            }
          } else {
            actionButton.addEventListener('click', async () => {
              setDownloadState(row, 'resolving', 'Resolving secure download…');
              actionButton.disabled = true;
              try {
                const result = await requestBundleDownload({
                  lookup: context?.lookup,
                  tokens: [rowData.parsedToken.normalized],
                  onQueuedTick: () => {
                    setDownloadState(row, 'queued', 'Preparing bundle…');
                    setModalStatus('queued', 'Preparing secure bundle…');
                  },
                });
                setDownloadState(row, 'ready', 'Ready. Opening download…');
                setModalStatus('ready', 'Bundle ready. Opening signed URL…');
                openSignedUrl(result?.signedUrl);
                window.setTimeout(() => setDownloadState(row, 'idle', ''), 2200);
              } catch (error) {
                const code = String(error?.code || '').toLowerCase();
                if (code === 'forbidden') {
                  setDownloadState(row, 'forbidden', 'Access denied (DX-DL-403).');
                  setModalStatus('forbidden', 'Access denied for this token (DX-DL-403).');
                } else if (code === 'not-found') {
                  setDownloadState(row, 'not-found', 'Download not found (DX-DL-404).');
                  setModalStatus('not-found', 'Bundle source not found (DX-DL-404).');
                } else {
                  setDownloadState(row, 'error', 'Download failed (DX-DL-500).');
                  setModalStatus('error', 'Bundle request failed. Retry or refresh (DX-DL-500).');
                }
              } finally {
                actionButton.disabled = false;
              }
            });
          }

          actionWrap.appendChild(actionButton);
          actionWrap.appendChild(status);
          row.appendChild(actionWrap);

          const favoritesApi = context?.favoritesApi || getFavoritesApi();
          if (favoritesApi && rowData.tokenRaw) {
            const favButton = document.createElement('button');
            favButton.type = 'button';
            favButton.className = 'dx-button-element--secondary dx-fav-toggle dx-fav-file-toggle';
            favButton.setAttribute('aria-label', 'Add file to favorites');
            favButton.setAttribute('title', 'Add file to favorites');
            const record = buildFileFavoriteRecord({
              lookup: context?.lookup,
              entryHref: context?.entryHref,
              bucket: rowData.bucket,
              format: rowData.format,
              fileId: rowData.tokenRaw,
              type,
            });
            bindFavoriteToggle(favButton, favoritesApi, record, {
              active: 'Favorited file',
              inactive: 'Favorite file',
            });
            row.appendChild(favButton);
          }
          list.appendChild(row);
        });
        updateBatchState();
      };

      chipAll.addEventListener('click', () => {
        filterMode = 'all';
        updateChipState();
        renderRows();
      });
      chipAvailable.addEventListener('click', () => {
        filterMode = 'available';
        updateChipState();
        renderRows();
      });

      batchButton.addEventListener('click', async () => {
        if (!selectedTokens.size) return;
        batchButton.disabled = true;
        setModalStatus('resolving', `Resolving ${selectedTokens.size} selected item(s)…`);
        try {
          const result = await requestBundleDownload({
            lookup: context?.lookup,
            tokens: Array.from(selectedTokens),
          });
          setModalStatus('ready', 'Batch bundle ready. Opening signed URL…');
          openSignedUrl(result?.signedUrl);
        } catch (error) {
          const msg = String(error?.code || 'failed').toLowerCase();
          if (msg === 'forbidden') setModalStatus('forbidden', 'Batch request denied (DX-DL-403).');
          else if (msg === 'not-found') setModalStatus('not-found', 'Batch source not found (DX-DL-404).');
          else setModalStatus('error', 'Batch download failed (DX-DL-500).');
        } finally {
          updateBatchState();
        }
      });

      inner.appendChild(close);
      inner.appendChild(heading);
      inner.appendChild(statusBanner);
      inner.appendChild(controls);
      inner.appendChild(list);
      modal.appendChild(inner);
      document.body.appendChild(modal);
      updateChipState();
      renderRows();
      close.addEventListener('click', removeModal);
      modal.addEventListener('click', (event) => {
        if (event.target === modal) removeModal();
      });
      document.addEventListener('keydown', onKeyDown);
      refreshFavoriteButtons(context?.favoritesApi || getFavoritesApi(), modal);
    });
  };

  const attachRecordingIndex = (cfg, btnSel, context) => {
    const btn = document.querySelector(btnSel);
    if (!btn || btn.dataset.dexBound === '1') return;
    btn.dataset.dexBound = '1';

    const row = btn.closest('[data-dx-recording-index-row]');
    const pdfTokenRaw = String(cfg?.downloads?.recordingIndexPdfRef || '').trim();
    const bundleTokenRaw = String(cfg?.downloads?.recordingIndexBundleRef || '').trim();
    const parsedPdfToken = parseRecordingIndexPdfToken(pdfTokenRaw);
    const parsedBundleToken = parseRecordingIndexBundleToken(bundleTokenRaw);

    if (!row) return;
    row.setAttribute('data-dx-download-kind', 'recording-index-pdf');
    row.setAttribute('data-dx-download-state', 'idle');

    if (!parsedPdfToken || !parsedBundleToken) {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      setDownloadState(row, 'not-found', 'Recording index bundle unavailable.');
      return;
    }

    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    setDownloadState(row, 'idle', '');
    btn.addEventListener('click', async () => {
      setDownloadState(row, 'resolving', 'Resolving secure download…');
      btn.disabled = true;
      try {
        const tokens = [];
        if (parsedPdfToken?.normalized) tokens.push(parsedPdfToken.normalized);
        if (parsedBundleToken?.normalized && !tokens.includes(parsedBundleToken.normalized)) {
          tokens.push(parsedBundleToken.normalized);
        }
        const result = await requestBundleDownload({
          lookup: context?.lookup,
          tokens,
          onQueuedTick: () => {
            setDownloadState(row, 'queued', 'Preparing bundle…');
          },
        });
        setDownloadState(row, 'ready', 'Ready. Opening download…');
        openSignedUrl(result?.signedUrl);
        window.setTimeout(() => setDownloadState(row, 'idle', ''), 2200);
      } catch (error) {
        const code = String(error?.code || '').toLowerCase();
        if (code === 'forbidden') {
          setDownloadState(row, 'forbidden', 'Access denied (403).');
        } else if (code === 'not-found') {
          setDownloadState(row, 'not-found', 'Download not found (404).');
        } else {
          setDownloadState(row, 'error', 'Download failed (DX-DL-500).');
        }
      } finally {
        btn.disabled = false;
      }
    });
  };

  const initPersonPins = () => {
    let activePopup = null;
    let activeHolder = null;
    const POPUP_MARGIN = 8;

    const parseLinks = (holder) => {
      let links = [];
      try {
        const parsed = JSON.parse(holder.getAttribute('data-links') || '[]');
        links = Array.isArray(parsed) ? parsed : [];
      } catch {
        links = [];
      }
      return links
        .map((link) => ({
          label: String(link?.label || '').trim(),
          href: String(link?.href || '').trim(),
        }))
        .filter((link) => link.label && link.href);
    };

    const setExpanded = (holder, expanded) => {
      if (!(holder instanceof HTMLElement)) return;
      holder.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    const closePopup = ({ restoreFocus = false } = {}) => {
      if (activePopup instanceof HTMLElement) {
        activePopup.remove();
      }
      activePopup = null;
      if (activeHolder instanceof HTMLElement) {
        const target = activeHolder;
        setExpanded(target, false);
        activeHolder = null;
        if (restoreFocus) {
          try {
            target.focus({ preventScroll: true });
          } catch {
            target.focus();
          }
        }
      }
    };

    const positionPopup = (popup, holder) => {
      if (!(popup instanceof HTMLElement) || !(holder instanceof HTMLElement)) return;
      const rect = holder.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      popup.style.left = `${Math.max(POPUP_MARGIN, scrollX + rect.left)}px`;
      popup.style.top = `${Math.max(POPUP_MARGIN, scrollY + rect.bottom + POPUP_MARGIN)}px`;

      const popupRect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const maxLeft = scrollX + viewportWidth - popupRect.width - POPUP_MARGIN;
      const clampedLeft = Math.min(Math.max(scrollX + rect.left, POPUP_MARGIN), Math.max(POPUP_MARGIN, maxLeft));

      let top = scrollY + rect.bottom + POPUP_MARGIN;
      const maxTop = scrollY + viewportHeight - popupRect.height - POPUP_MARGIN;
      if (top > maxTop) {
        top = scrollY + rect.top - popupRect.height - POPUP_MARGIN;
      }
      const clampedTop = Math.max(POPUP_MARGIN, Math.min(top, Math.max(POPUP_MARGIN, maxTop)));
      popup.style.left = `${clampedLeft}px`;
      popup.style.top = `${clampedTop}px`;
    };

    const openPopup = (holder) => {
      if (!(holder instanceof HTMLElement)) return;
      const links = parseLinks(holder);
      if (!links.length) return;

      closePopup();
      const popup = document.createElement('div');
      const personLabel = String(holder.getAttribute('data-person') || 'Credit links').trim();
      popup.className = 'person-popup person-popup--dx';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-label', `${personLabel} links`);
      popup.style.position = 'absolute';
      popup.style.zIndex = '2147483000';
      popup.style.minWidth = '196px';
      popup.style.maxWidth = 'min(312px, calc(100vw - 16px))';
      popup.style.padding = '10px 12px';
      popup.style.borderRadius = '10px';
      popup.style.border = '1px solid rgba(15, 19, 28, 0.18)';
      popup.style.background = 'linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 255, 0.95))';
      popup.style.boxShadow = '0 14px 28px rgba(9, 14, 24, 0.2)';
      popup.style.backdropFilter = 'blur(10px)';
      popup.style.webkitBackdropFilter = 'blur(10px)';
      popup.style.display = 'grid';
      popup.style.gap = '4px';
      popup.innerHTML = links
        .map((link) => `<a class="person-popup-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`)
        .join('');
      document.body.append(popup);
      positionPopup(popup, holder);
      activePopup = popup;
      activeHolder = holder;
      setExpanded(holder, true);
    };

    const togglePopup = (holder) => {
      if (holder === activeHolder && activePopup instanceof HTMLElement) {
        closePopup();
        return;
      }
      openPopup(holder);
    };

    document.addEventListener('click', (event) => {
      if (!(activePopup instanceof HTMLElement)) return;
      const target = event.target;
      if (activePopup.contains(target)) return;
      if (activeHolder instanceof HTMLElement && activeHolder.contains(target)) return;
      closePopup();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!(activePopup instanceof HTMLElement)) return;
      event.preventDefault();
      closePopup({ restoreFocus: true });
    }, true);

    window.addEventListener('resize', () => {
      if (!(activePopup instanceof HTMLElement) || !(activeHolder instanceof HTMLElement)) return;
      positionPopup(activePopup, activeHolder);
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (!(activePopup instanceof HTMLElement) || !(activeHolder instanceof HTMLElement)) return;
      positionPopup(activePopup, activeHolder);
    }, { passive: true, capture: true });

    document.querySelectorAll('[data-person-linkable="true"][data-person]').forEach((holder) => {
      if (!(holder instanceof HTMLElement)) return;
      if (holder.dataset.dexPinBound === '1') return;
      holder.dataset.dexPinBound = '1';
      holder.classList.add('person-link');
      holder.style.cursor = 'pointer';
      holder.style.textDecoration = holder.style.textDecoration || 'underline';
      holder.style.textUnderlineOffset = holder.style.textUnderlineOffset || '0.12em';
      holder.setAttribute('role', holder.getAttribute('role') || 'button');
      holder.setAttribute('tabindex', holder.getAttribute('tabindex') || '0');
      holder.setAttribute('aria-haspopup', holder.getAttribute('aria-haspopup') || 'dialog');
      setExpanded(holder, false);

      holder.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePopup(holder);
      });

      holder.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        togglePopup(holder);
      });
    });
  };

  const installSidebarRevealMotion = () => {
    if (prefersReducedMotion()) return;
    if (!(window.IntersectionObserver && typeof window.IntersectionObserver === 'function')) return;

    const sections = Array.from(document.querySelectorAll('.dex-sidebar section'));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target;
          if (node.dataset.dexMotionReveal === '1') {
            instance.unobserve(node);
            return;
          }
          node.dataset.dexMotionReveal = '1';
          const index = Number(node.dataset.dexMotionRevealIndex || 0);
          animateNode(
            node,
            [
              { opacity: 0, transform: 'translate3d(0, 14px, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            ],
            {
              duration: 320,
              delay: Math.min(index * 28, 240),
              easing: 'cubic-bezier(.22,.8,.24,1)',
              fill: 'both',
            },
          );
          instance.unobserve(node);
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    sections.forEach((section, index) => {
      if (section.dataset.dexMotionReveal === '1') return;
      section.dataset.dexMotionRevealIndex = String(index);
      section.style.opacity = '0';
      section.style.transform = 'translate3d(0, 14px, 0)';
      observer.observe(section);
    });
  };

  const installSidebarInteractiveMotion = () => {
    if (prefersReducedMotion()) return;
    const nodes = Array.from(
      document.querySelectorAll('.dex-sidebar section, .dex-sidebar .license-btn, .dex-sidebar #downloads .btn-audio, .dex-sidebar #downloads .btn-video, .dex-sidebar #downloads .btn-recording-index'),
    );
    nodes.forEach((node) => {
      if (node.dataset.dexMotionBound === '1') return;
      node.dataset.dexMotionBound = '1';
      node.addEventListener('pointerenter', () => {
        animateNode(
          node,
          [
            { transform: 'translate3d(0, 0, 0) scale(1)' },
            { transform: 'translate3d(0, -2px, 0) scale(1.01)' },
          ],
          {
            duration: 180,
            easing: 'cubic-bezier(.2,.9,.25,1)',
            fill: 'forwards',
          },
        );
      });
      node.addEventListener('pointerleave', () => {
        animateNode(
          node,
          [
            { transform: 'translate3d(0, -2px, 0) scale(1.01)' },
            { transform: 'translate3d(0, 0, 0) scale(1)' },
          ],
          {
            duration: 140,
            easing: 'cubic-bezier(.22,.8,.24,1)',
            fill: 'forwards',
          },
        );
      });
    });
  };

  const boot = async () => {
    if (document.documentElement.dataset.dexSidebarRendered === '1') return;
    const fetchTargets = collectEntryFetchTargets();
    ensureEntryFetchShells(fetchTargets);
    bindHeaderFetchLifecycle(fetchTargets);
    bindDescriptionFetchLifecycle(fetchTargets);
    bindMediaFetchLifecycle(fetchTargets);
    try {
      const pageJson = parseJsonScript('dex-sidebar-page-config');
      const page = pageJson || window.dexSidebarPageConfig;
      if (!page) {
        throw new Error('Missing per-page sidebar config');
      }

      const globalCfg = parseJsonScript('dex-sidebar-config') || {};
      const manifest = parseJsonScript('dex-manifest') || { audio: {}, video: {} };

      const credits = page.credits || {};
      const linksByPerson = normalizeLinksByPersonMap(credits.linksByPerson);
      const instrumentValues = Array.isArray(credits.instruments)
        ? credits.instruments
        : [credits.instruments];
      const cfg = {
        license: globalCfg.license || {},
        attributionSentence: page.attributionSentence,
        credits: {
          ...credits,
          artist: pinValue(credits.artist, linksByPerson),
          artistAlt: credits.artistAlt,
          instruments: instrumentValues
            .map((value) => pinValue(value, linksByPerson))
            .map((value) => String(value || '').trim())
            .filter(Boolean),
          video: {
            director: pinValue(credits.video?.director, linksByPerson),
            cinematography: pinValue(credits.video?.cinematography, linksByPerson),
            editing: pinValue(credits.video?.editing, linksByPerson),
          },
          audio: {
            recording: pinValue(credits.audio?.recording, linksByPerson),
            mix: pinValue(credits.audio?.mix, linksByPerson),
            master: pinValue(credits.audio?.master, linksByPerson),
          },
        },
        downloads: {
          delivery: 'worker_bundle',
          formats: {
            audio: Array.isArray(globalCfg?.downloads?.formats?.audio) ? globalCfg.downloads.formats.audio : [],
            video: Array.isArray(globalCfg?.downloads?.formats?.video) ? globalCfg.downloads.formats.video : [],
          },
          recordingIndexPdfRef: String(
            page?.downloads?.recordingIndexPdfRef
            || page?.recordingIndexPdfRef
            || '',
          ).trim(),
          recordingIndexBundleRef: String(
            page?.downloads?.recordingIndexBundleRef
            || page?.recordingIndexBundleRef
            || '',
          ).trim(),
          recordingIndexSourceUrl: String(
            page?.downloads?.recordingIndexSourceUrl
            || page?.recordingIndexSourceUrl
            || '',
          ).trim(),
          audioFileIds: manifest.audio || {},
          videoFileIds: manifest.video || {},
        },
        fileSpecs: page.fileSpecs || {},
        metadata: page.metadata || {},
      };

      const lookup = String(page.lookupNumber || '').trim() || 'Unknown lookup';
      const selected = normalizeBuckets(page.buckets);
      const badgesHtml = buildBucketsHtml(page.buckets, cfg, lookup);
      const favoriteBuckets = (selected.length ? selected : ALL_BUCKETS.filter((bucket) => bucketHasAnyAsset(cfg, bucket)));

      const origin = getSidebarAssetOrigin();
      ensureProfileChromeRuntime(origin);
      ensureEntryRuntimeLayoutOverrides();
      const favoritesApi = await ensureFavoritesApi(origin);
      if (favoritesApi && typeof favoritesApi.migrateLegacy === 'function') {
        try {
          favoritesApi.migrateLegacy();
        } catch {}
        bindFavoritesSignals(favoritesApi);
      }

      const SERIES_PATHS = {
        dex: '/assets/series/dex.png',
        index: '/assets/series/index.png',
        dexfest: '/assets/series/dexfest.png',
      };
      const sk = seriesKey(page);
      const seriesSrc = new URL(SERIES_PATHS[sk] || SERIES_PATHS.dex, origin).toString();
      const entryHref = normalizeLocationPath(window.location.pathname || '/');

      const overviewEl = document.querySelector('.dex-overview');
      if (overviewEl) {
        overviewEl.innerHTML = `
          <div class="overview-item overview-item--lookup">
            <span class="overview-lookup">#${lookup}</span>
            <p class="p3 overview-label overview-label--lookup">Lookup #</p>
          </div>
          <div class="overview-item overview-item--series">
            <img src="${seriesSrc}" alt="Series" class="overview-series-img"/>
            <p class="p3 overview-label overview-label--series">Series</p>
          </div>
        `;
        bindOverviewLookupFit();
        fitOverviewLookupText();
        await markTargetReady(fetchTargets, 'overview');
      }

      const collectionsEl = document.querySelector('.dex-collections');
      if (collectionsEl) {
        const bucketFavoriteButtonsHtml = favoriteBuckets
          .map((bucket) => `
            <button
              type="button"
              class="dx-button-element--secondary dx-fav-toggle dx-fav-bucket-toggle"
              data-bucket="${bucket}"
              data-dx-fav-chip="${bucket}"
              aria-label="Add bucket ${bucket} to favorites"
              title="Add bucket ${bucket} to favorites"
            ></button>
          `)
          .join('');
        collectionsEl.innerHTML = `
          <h3 data-dx-entry-heading="1">${randomizeTitle(COLLECTION_HEADING_CANONICAL, { uppercase: false, seedKey: `${window.location.pathname || '/'}|collection` })}</h3>
          <div class="overview-item overview-item--buckets">
            <p class="p3 overview-label">Available Buckets</p>
            <div class="overview-buckets-grid">${badgesHtml}</div>
          </div>
          <div class="overview-item overview-item--favorite-collection">
            <p class="p3 overview-label">Favorite This Collection</p>
            <button
              type="button"
              class="dx-button-element--primary dx-fav-toggle dx-fav-entry-toggle"
              aria-label="Add entry to favorites"
              title="Add entry to favorites"
            ></button>
          </div>
          <div class="overview-item overview-item--favorite-buckets">
            <p class="p3 overview-label">Favorite Buckets</p>
            <div class="overview-badges">${bucketFavoriteButtonsHtml || '<span class="badge unavailable">No buckets</span>'}</div>
          </div>
        `;

        bindEntryTooltips(collectionsEl);

        if (favoritesApi) {
          const entryFavButton = collectionsEl.querySelector('.dx-fav-entry-toggle');
          if (entryFavButton) {
            bindFavoriteToggle(entryFavButton, favoritesApi, buildEntryFavoriteRecord(lookup, entryHref), {
              active: 'Favorited entry',
              inactive: 'Favorite entry',
            });
          }

          collectionsEl.querySelectorAll('.dx-fav-bucket-toggle').forEach((bucketButton) => {
            const bucket = String(bucketButton.getAttribute('data-bucket') || '').trim().toUpperCase();
            if (!bucket) return;
            bindFavoriteToggle(bucketButton, favoritesApi, buildBucketFavoriteRecord(lookup, entryHref, bucket), {
              active: `Favorited ${bucket}`,
              inactive: `Favorite ${bucket}`,
            });
          });
        }
        await markTargetReady(fetchTargets, 'collections');
      }

      const labelSeedBase = `${window.location.pathname || '/'}|sidebar-label`;
      const copyLabel = randomizeTitleWithJoiners('Copy', { seedKey: `${labelSeedBase}|copy` });
      const usageNotesLabel = randomizeTitleWithJoiners('Usage Notes', { seedKey: `${labelSeedBase}|usage-notes` });
      const audioFilesLabel = randomizeTitleWithJoiners('Audio Files', { seedKey: `${labelSeedBase}|audio-files` });
      const videoFilesLabel = randomizeTitleWithJoiners('Video Files', { seedKey: `${labelSeedBase}|video-files` });
      const recordingIndexPdfLabel = randomizeTitleWithJoiners('Recording Index PDF', { seedKey: `${labelSeedBase}|recording-index-pdf` });

      render('.dex-license', 'License', `
        <a class="dex-license-badge" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener"><img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/by.svg" alt="Creative Commons Attribution 4.0" class="badge-by"/></a>
        <p class="dex-attrib">This work contains samples licensed under CC-BY 4.0 by Dex Digital Sample Library and ${cfg.credits.artist}</p>
        <div class="dex-license-controls">
          <button type="button" class="license-btn copy-btn dx-button-element--primary" title="Copy attribution"><span class="copy-text">${copyLabel}</span></button>
          <button type="button" class="license-btn usage-btn dx-button-element--primary" onclick="window.open('https://dexdsl.com/copyright','_blank')">${usageNotesLabel}</button>
        </div>
      `);

      const copyBtn = document.querySelector('.dex-license .copy-btn');
      if (copyBtn && copyBtn.dataset.dexBound !== '1') {
        copyBtn.dataset.dexBound = '1';
        copyBtn.addEventListener('click', () => {
          const txt = `This work contains samples licensed under CC-BY 4.0 by Dex Digital Sample Library and ${cfg.credits.artist}`;
          navigator.clipboard?.writeText(txt);
          const span = copyBtn.querySelector('.copy-text');
          const orig = span?.textContent || copyLabel;
          if (span) {
            span.textContent = 'Copied!';
            setTimeout(() => {
              span.textContent = orig;
            }, 2000);
          }
        });
      }
      await markTargetReady(fetchTargets, 'license');

      const blankCredit = '<span class="person-text" data-person-linkable="false">—</span>';
      const creditValue = (value) => {
        const text = String(value || '').trim();
        return text || blankCredit;
      };
      const creditRow = (label, value, { role = false } = {}) => `
        <div class="${role ? 'dex-credits-role' : 'dex-credits-row'}">
          <span class="dex-credits-key">${label}</span>
          <span class="dex-credits-value">${creditValue(value)}</span>
        </div>
      `;
      const instrumentsLine = Array.isArray(cfg.credits.instruments) ? cfg.credits.instruments.join(', ') : String(cfg.credits.instruments || '');
      render('.dex-credits', 'Credits', `
        <div class="dex-credits-grid">
          ${creditRow('Artist', cfg.credits.artist)}
          ${cfg.credits.artistAlt ? creditRow('Alias', cfg.credits.artistAlt) : ''}
          ${creditRow('Instrument', instrumentsLine)}
          <div class="dex-credits-group">
            <div class="dex-credits-group-title">Video</div>
            ${creditRow('Dir', cfg.credits.video.director, { role: true })}
            ${creditRow('Cin', cfg.credits.video.cinematography, { role: true })}
            ${creditRow('Edit', cfg.credits.video.editing, { role: true })}
          </div>
          <div class="dex-credits-group">
            <div class="dex-credits-group-title">Audio</div>
            ${creditRow('Rec', cfg.credits.audio.recording, { role: true })}
            ${creditRow('Mix', cfg.credits.audio.mix, { role: true })}
            ${creditRow('Master', cfg.credits.audio.master, { role: true })}
          </div>
        </div>
        <div class="dex-badges">
          <span class="badge">${cfg.credits.season || ''} ${cfg.credits.year || ''}</span>
          <span class="badge">${cfg.credits.location || ''}</span>
        </div>
      `);

      render('#downloads', 'Download', `<p>Please choose the asset you'd like to download:</p><button type="button" class="btn-audio dx-button-element--primary" aria-label="Download Audio"><span>${audioFilesLabel}</span></button><button type="button" class="btn-video dx-button-element--primary" aria-label="Download Video"><span>${videoFilesLabel}</span></button><div class="dx-download-inline" data-dx-recording-index-row="1" data-dx-download-kind="recording-index-pdf" data-dx-download-state="idle"><button type="button" class="btn-recording-index dx-button-element--secondary" aria-label="Download Recording Index PDF" data-dx-download-kind="recording-index-pdf"><span>${recordingIndexPdfLabel}</span></button><span data-dx-download-status="1" hidden></span></div>`, true);
      render('#file-specs', 'File Specs', `<p>All files are provided with the following specs:</p><div class="dex-badges"><span class="badge">🎚 ${cfg.fileSpecs.bitDepth || ''}-bit</span><span class="badge">🔊 ${cfg.fileSpecs.sampleRate || ''} Hz</span><span class="badge">🎧 ${cfg.fileSpecs.channels || ''}</span></div><div class="dex-badges">${Object.entries(cfg.fileSpecs.staticSizes || {}).map(([b, s]) => `<span class="badge">📁 ${b}: ${s}</span>`).join('')}</div>`, true);
      render('#metadata', 'Metadata', `<p>This sample contains the following metadata:</p><div class="dex-badges"><span class="badge">⏱ Length: ${cfg.metadata.sampleLength || ''}</span><span class="badge">🏷 Tags: ${(cfg.metadata.tags || []).join(', ')}</span></div>`, true);

      const fileInfoTabLabels = {
        downloads: 'Download',
        'file-specs': 'File Specs',
        metadata: 'Metadata',
      };
      document.querySelectorAll('.file-info-tabs button').forEach((btn) => {
        const tabKey = String(btn.dataset.tab || '').trim();
        const canonical = fileInfoTabLabels[tabKey] || String(btn.textContent || '').trim() || tabKey;
        if (canonical) {
          btn.textContent = randomizeTitleWithJoiners(canonical, { seedKey: `${labelSeedBase}|tab|${tabKey || canonical}` });
        }
      });

      document.querySelectorAll('.file-info-tabs button').forEach((btn) => {
        if (btn.dataset.dexBound === '1') return;
        btn.dataset.dexBound = '1';
        btn.addEventListener('click', () => {
          const owner = btn.closest('.dex-file-info') || btn.closest('.dex-sidebar') || document;
          const panels = Array.from(owner.querySelectorAll('.file-info-panels > div'));
          const previous = panels.find((panel) => !panel.hidden) || null;
          document.querySelectorAll('.file-info-tabs button').forEach((b) => b.setAttribute('aria-selected', 'false'));
          btn.setAttribute('aria-selected', 'true');
          const target = btn.dataset.tab;
          document.querySelectorAll('.file-info-panels > div').forEach((panel) => {
            panel.hidden = panel.id !== target;
          });

          requestAnimationFrame(() => {
            const next = panels.find((panel) => !panel.hidden) || null;
            if (previous && previous !== next) {
              animateNode(
                previous,
                [
                  { opacity: 1, transform: 'translate3d(0, 0, 0)' },
                  { opacity: 0, transform: 'translate3d(0, 4px, 0)' },
                ],
                {
                  duration: 160,
                  easing: 'cubic-bezier(.4,0,.2,1)',
                  fill: 'forwards',
                },
              );
            }
            if (next) {
              animateNode(
                next,
                [
                  { opacity: 0, transform: 'translate3d(0, -4px, 0)' },
                  { opacity: 1, transform: 'translate3d(0, 0, 0)' },
                ],
                {
                  duration: 200,
                  easing: 'cubic-bezier(.22,.8,.24,1)',
                  fill: 'both',
                },
              );
            }
          });
        });
      });

      attach(cfg, 'audio', '#downloads .btn-audio', { lookup, entryHref, favoritesApi });
      attach(cfg, 'video', '#downloads .btn-video', { lookup, entryHref, favoritesApi });
      attachRecordingIndex(cfg, '#downloads .btn-recording-index', { lookup, entryHref, favoritesApi });
      initPersonPins();
      installSidebarRevealMotion();
      installSidebarInteractiveMotion();
      bindEntryRailLayout();
      bindBreadcrumbSpinFallback();
      refreshFavoriteButtons(favoritesApi, document);

      document.documentElement.dataset.dexSidebarRendered = '1';
      await maybeMarkEntryLayoutReady(fetchTargets);
    } catch (error) {
      await markAllEntryFetchTargets(fetchTargets, FETCH_STATE_ERROR);
      throw error;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot().catch((error) => {
        console.error('[dex-sidebar] boot error', error);
      });
    }, { once: true });
  } else {
    boot().catch((error) => {
      console.error('[dex-sidebar] boot error', error);
    });
  }
})();
