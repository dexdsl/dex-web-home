(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxHeaderSlotLoaded) return;
  window.__dxHeaderSlotLoaded = true;

  const BODY_CLASS = 'dx-slot-enabled';
  const ROUTING_CLASS = 'dx-slot-routing';
  const SLOT_SCROLL_ID = 'dx-slot-scroll-root';
  const SLOT_FOREGROUND_ID = 'dx-slot-foreground-root';
  const ROUTE_SCRIPT_ATTR = 'data-dx-route-script';
  const HISTORY_SLOT_KEY = '__dxSlot';
  const HISTORY_SCROLL_KEY = '__dxSlotScrollTop';

  const PRESERVED_IDS = new Set(['gooey-mesh-wrapper', 'scroll-gradient-bg', SLOT_SCROLL_ID, SLOT_FOREGROUND_ID]);
  const PRESERVED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META']);
  const SKIPPED_ROUTE_SCRIPTS = new Set(['/assets/js/header-slot.js', '/assets/js/dx-scroll-dot.js']);
  const ROUTE_SCRIPT_GUARDS = new Map([
    ['/assets/js/call.editorial.js', '__dxCallEditorialLoaded'],
    ['/assets/js/catalog.how.js', '__dxCatalogHowLoaded'],
    ['/assets/js/catalog.index.js', '__dxCatalogIndexLoaded'],
    ['/assets/js/catalog.symbols.js', '__dxCatalogSymbolsLoaded'],
    ['/assets/js/dexnotes.entry.js', '__dxDexnotesEntryLoaded'],
    ['/assets/js/dexnotes.index.js', '__dxDexnotesIndexLoaded'],
    ['/assets/js/dx-about.js', '__dxAboutRouteLoaded'],
    ['/assets/js/dx-scroll-dot.js', '__dxScrollDotLoaded'],
  ]);

  let routeAbortController = null;
  let isNavigating = false;
  let homeHeroAlignerInstalled = false;
  let softRouterInstalled = false;
  let scrollStateInstalled = false;
  let scrollStateRafId = 0;

  function getHeaderElement(root = document) {
    const wrapper = root.querySelector('.header-announcement-bar-wrapper');
    if (!wrapper) return null;
    return wrapper.closest('header') || wrapper;
  }

  function isHttpUrl(url) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  function isSameOriginUrl(url) {
    return url.origin === window.location.origin;
  }

  function toAbsoluteUrl(value, baseHref = window.location.href) {
    if (!value) return null;
    try {
      return new URL(value, baseHref);
    } catch {
      return null;
    }
  }

  function normalizePathname(pathname) {
    const raw = String(pathname || '/').replace(/\/{2,}/g, '/');
    if (raw === '/') return '/';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  function normalizeRouteKey(url) {
    return `${normalizePathname(url.pathname)}${url.search || ''}`;
  }

  function shouldPreserveOutsideSlot(node, headerElement) {
    if (!(node instanceof HTMLElement)) return true;
    if (node === headerElement) return true;
    if (headerElement && node.contains(headerElement)) return true;
    if (PRESERVED_IDS.has(node.id || '')) return true;
    if (PRESERVED_TAGS.has(node.tagName)) return true;
    if (node.hasAttribute('data-dx-slot-preserve')) return true;
    return false;
  }

  function ensureSlotRoots(container, headerElement) {
    let scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (!scrollRoot) {
      scrollRoot = document.createElement('div');
      scrollRoot.id = SLOT_SCROLL_ID;
      scrollRoot.setAttribute('data-dx-slot-root', 'true');
    }

    let foregroundRoot = document.getElementById(SLOT_FOREGROUND_ID);
    if (!foregroundRoot) {
      foregroundRoot = document.createElement('div');
      foregroundRoot.id = SLOT_FOREGROUND_ID;
      foregroundRoot.setAttribute('data-dx-slot-foreground', 'true');
    }

    if (!scrollRoot.contains(foregroundRoot)) {
      scrollRoot.appendChild(foregroundRoot);
    }

    const insertAfterHeader = headerElement.nextSibling;
    if (scrollRoot.parentNode !== container) {
      if (insertAfterHeader) {
        container.insertBefore(scrollRoot, insertAfterHeader);
      } else {
        container.appendChild(scrollRoot);
      }
    }

    return { scrollRoot, foregroundRoot };
  }

  function moveForegroundNodes(container, headerElement, scrollRoot, foregroundRoot) {
    const children = Array.from(container.children);
    let canMove = false;

    for (const node of children) {
      if (node === headerElement) {
        canMove = true;
        continue;
      }
      if (!canMove) continue;
      if (node === scrollRoot || node === foregroundRoot) continue;
      if (shouldPreserveOutsideSlot(node, headerElement)) continue;
      foregroundRoot.appendChild(node);
    }
  }

  function extractForegroundNodes(sourceDocument) {
    const sourceHeader = getHeaderElement(sourceDocument);
    const sourceContainer = (sourceHeader && sourceHeader.parentElement) || sourceDocument.body;
    const sourceChildren = Array.from(sourceContainer ? sourceContainer.children : []);
    const nodes = [];
    let canMove = sourceHeader ? false : true;

    for (const node of sourceChildren) {
      if (sourceHeader && node === sourceHeader) {
        canMove = true;
        continue;
      }
      if (!canMove) continue;
      if (shouldPreserveOutsideSlot(node, sourceHeader)) continue;
      nodes.push(node);
    }

    return nodes;
  }

  function buildForegroundFragment(sourceDocument) {
    const fragment = document.createDocumentFragment();
    const nodes = extractForegroundNodes(sourceDocument);

    for (const node of nodes) {
      fragment.appendChild(document.importNode(node, true));
    }

    const scripts = Array.from(fragment.querySelectorAll('script'));
    for (const script of scripts) {
      script.remove();
    }

    return fragment;
  }

  function dispatchSlotReady(scrollRoot, foregroundRoot) {
    const detail = { scrollRoot, foregroundRoot };
    try {
      window.dispatchEvent(new CustomEvent('dx:slotready', { detail }));
      return;
    } catch {}
    const legacyEvent = document.createEvent('Event');
    legacyEvent.initEvent('dx:slotready', false, false);
    legacyEvent.detail = detail;
    window.dispatchEvent(legacyEvent);
  }

  function scrollToHashTarget(hashValue) {
    const hash = String(hashValue || '').trim();
    if (!hash || hash === '#') return;
    let id = hash.replace(/^#/, '');
    try {
      id = decodeURIComponent(id);
    } catch {}
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    try {
      target.scrollIntoView({ block: 'start', inline: 'nearest' });
      return;
    } catch {}
    target.scrollIntoView();
  }

  function alignBlockToHeaderFrame(blockEl, headerRect) {
    if (!(blockEl instanceof HTMLElement)) return;
    if (!Number.isFinite(headerRect.width) || headerRect.width <= 0) return;

    const targetWidth = Math.round(headerRect.width);
    blockEl.style.setProperty('width', `${targetWidth}px`, 'important');
    blockEl.style.setProperty('max-width', `${targetWidth}px`, 'important');
    blockEl.style.setProperty('box-sizing', 'border-box', 'important');
    blockEl.style.setProperty('margin-left', '0', 'important');
    blockEl.style.setProperty('margin-right', '0', 'important');
    blockEl.style.setProperty('left', '0', 'important');
    blockEl.style.setProperty('position', 'relative', 'important');
    blockEl.style.setProperty('transform', 'none', 'important');

    const blockRect = blockEl.getBoundingClientRect();
    const shiftX = Math.round(headerRect.left - blockRect.left);
    blockEl.style.setProperty('transform', `translateX(${shiftX}px)`, 'important');
  }

  function alignHomeHeroToHeader() {
    if (!document.body.classList.contains('homepage')) return;

    const headerFrame = document.querySelector('.header-announcement-bar-wrapper');
    if (!headerFrame) return;

    const headerRect = headerFrame.getBoundingClientRect();
    if (!Number.isFinite(headerRect.width) || headerRect.width <= 0) return;

    const targetIds = [
      'block-448bd8f915f4abba552b',
      'block-ee939fa7ed636a261fd7',
      'block-7ccf390e6577e4e9f69e',
      'block-5976018fa8f9e1213243',
    ];

    let didAlign = false;
    for (const id of targetIds) {
      const blockEl = document.getElementById(id);
      if (!blockEl) continue;
      alignBlockToHeaderFrame(blockEl, headerRect);
      didAlign = true;
    }

    if (didAlign) return;

    const combined = document.getElementById('dexCombined');
    if (!combined) return;
    const heroBlock = combined.closest('.dx-block') || combined;
    alignBlockToHeaderFrame(heroBlock, headerRect);
  }

  function installHomeHeroAligner() {
    if (homeHeroAlignerInstalled) return;
    homeHeroAlignerInstalled = true;

    let rafId = 0;
    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        alignHomeHeroToHeader();
      });
    };

    schedule();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('dx:slotready', schedule);
    window.addEventListener('load', schedule);
  }

  function clearChildren(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function syncBodyAttributes(sourceBody) {
    const currentAttrs = Array.from(document.body.attributes);
    const nextAttrs = new Map(Array.from(sourceBody.attributes).map((attr) => [attr.name, attr.value]));

    for (const attr of currentAttrs) {
      if (attr.name === 'class' || attr.name === 'id') continue;
      if (!nextAttrs.has(attr.name)) {
        document.body.removeAttribute(attr.name);
      }
    }

    for (const [name, value] of nextAttrs.entries()) {
      if (name === 'class' || name === 'id') continue;
      document.body.setAttribute(name, value);
    }

    if (sourceBody.id) {
      document.body.id = sourceBody.id;
    } else {
      document.body.removeAttribute('id');
    }

    document.body.className = sourceBody.className || '';
    document.body.classList.add(BODY_CLASS);
  }

  function syncHtmlAttributes(sourceDocument) {
    const nextHtml = sourceDocument.documentElement;
    if (!nextHtml) return;

    if (nextHtml.lang) {
      document.documentElement.lang = nextHtml.lang;
    }

    document.documentElement.className = nextHtml.className || '';
  }

  function markHeaderActiveForPath(pathname) {
    const normalizedTarget = normalizePathname(pathname);
    const items = Array.from(document.querySelectorAll('.header-nav-item'));

    for (const item of items) {
      const link = item.querySelector('a[href]');
      if (!link) continue;

      const hrefUrl = toAbsoluteUrl(link.getAttribute('href'));
      const isActive = !!hrefUrl && normalizePathname(hrefUrl.pathname) === normalizedTarget;

      item.classList.toggle('header-nav-item--active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  function shouldIncludeRouteStylesheet(url) {
    if (!url || !isHttpUrl(url) || !isSameOriginUrl(url)) return false;
    const pathname = url.pathname;
    return pathname.startsWith('/css/') || pathname.startsWith('/assets/css/');
  }

  function syncRouteStyles(sourceDocument, baseUrl) {
    const existing = new Set(
      Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))
        .map((node) => toAbsoluteUrl(node.getAttribute('href')))
        .filter(Boolean)
        .map((url) => url.href)
    );

    const incomingLinks = [
      ...Array.from(sourceDocument.head ? sourceDocument.head.querySelectorAll('link[rel~="stylesheet"][href]') : []),
      ...Array.from(sourceDocument.body ? sourceDocument.body.querySelectorAll('link[rel~="stylesheet"][href]') : []),
    ];

    for (const link of incomingLinks) {
      const rawHref = link.getAttribute('href');
      const url = toAbsoluteUrl(rawHref, baseUrl);
      if (!url) continue;
      if (!shouldIncludeRouteStylesheet(url)) continue;
      if (existing.has(url.href)) continue;

      const nextLink = document.createElement('link');
      nextLink.rel = 'stylesheet';
      nextLink.href = url.href;
      nextLink.setAttribute('data-dx-route-style', 'true');

      const media = link.getAttribute('media');
      if (media) nextLink.media = media;
      if (link.hasAttribute('crossorigin')) {
        const value = link.getAttribute('crossorigin');
        if (value) nextLink.setAttribute('crossorigin', value);
        else nextLink.setAttribute('crossorigin', '');
      }

      document.head.appendChild(nextLink);
      existing.add(url.href);
    }
  }

  function isRouteScriptCandidate(url) {
    if (!url || !isHttpUrl(url) || !isSameOriginUrl(url)) return false;
    const pathname = url.pathname;
    if (!pathname.startsWith('/assets/js/')) return false;
    if (!pathname.endsWith('.js')) return false;
    if (SKIPPED_ROUTE_SCRIPTS.has(pathname)) return false;
    return true;
  }

  function collectRouteScripts(sourceDocument, baseUrl) {
    const orderedScripts = [
      ...Array.from(sourceDocument.head ? sourceDocument.head.querySelectorAll('script[src]') : []),
      ...Array.from(sourceDocument.body ? sourceDocument.body.querySelectorAll('script[src]') : []),
    ];

    const scripts = [];
    const seen = new Set();

    for (const script of orderedScripts) {
      const rawSrc = script.getAttribute('src');
      const url = toAbsoluteUrl(rawSrc, baseUrl);
      if (!url) continue;
      if (!isRouteScriptCandidate(url)) continue;
      if (seen.has(url.href)) continue;
      seen.add(url.href);

      scripts.push({
        url,
        type: script.getAttribute('type') || '',
        noModule: script.hasAttribute('nomodule'),
        crossOrigin: script.getAttribute('crossorigin') || '',
        referrerPolicy: script.getAttribute('referrerpolicy') || '',
        integrity: script.getAttribute('integrity') || '',
      });
    }

    return scripts;
  }

  function clearRouteScripts() {
    const nodes = Array.from(document.querySelectorAll(`script[${ROUTE_SCRIPT_ATTR}="true"]`));
    for (const node of nodes) {
      node.remove();
    }
  }

  function resetRouteScriptGuard(pathname) {
    const guardName = ROUTE_SCRIPT_GUARDS.get(pathname);
    if (!guardName) return;
    try {
      delete window[guardName];
    } catch {}
    window[guardName] = undefined;
  }

  function loadRouteScript(definition) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = definition.url.href;
      script.async = false;
      script.setAttribute(ROUTE_SCRIPT_ATTR, 'true');

      if (definition.type) script.type = definition.type;
      if (definition.noModule) script.noModule = true;
      if (definition.crossOrigin) script.setAttribute('crossorigin', definition.crossOrigin);
      if (definition.referrerPolicy) script.setAttribute('referrerpolicy', definition.referrerPolicy);
      if (definition.integrity) script.setAttribute('integrity', definition.integrity);

      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => reject(new Error(`Failed to load route script: ${definition.url.href}`)));

      document.body.appendChild(script);
    });
  }

  async function loadRouteScripts(definitions) {
    for (const definition of definitions) {
      resetRouteScriptGuard(definition.url.pathname);
      await loadRouteScript(definition);
    }
  }

  function captureGooeyMeshState() {
    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!wrapper) return null;
    const blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    if (!blobs.length) return null;

    return blobs.map((blob) => ({
      transform: blob.style.transform || '',
      x: Number(blob._x),
      y: Number(blob._y),
      vx: Number(blob._vx),
      vy: Number(blob._vy),
      rad: Number(blob._rad),
    }));
  }

  function restoreGooeyMeshState(state) {
    if (!Array.isArray(state) || state.length === 0) return;
    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!wrapper) return;
    const blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    if (blobs.length !== state.length) return;

    for (let index = 0; index < blobs.length; index += 1) {
      const blob = blobs[index];
      const item = state[index];
      if (!item) continue;

      if (Number.isFinite(item.x)) blob._x = item.x;
      if (Number.isFinite(item.y)) blob._y = item.y;
      if (Number.isFinite(item.vx)) blob._vx = item.vx;
      if (Number.isFinite(item.vy)) blob._vy = item.vy;
      if (Number.isFinite(item.rad)) blob._rad = item.rad;
      if (typeof item.transform === 'string') blob.style.transform = item.transform;
    }
  }

  function setRoutingState(active) {
    document.body.classList.toggle(ROUTING_CLASS, active);

    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (!scrollRoot) return;

    if (active) {
      scrollRoot.setAttribute('aria-busy', 'true');
    } else {
      scrollRoot.removeAttribute('aria-busy');
    }
  }

  function persistScrollState(scrollRoot) {
    if (!scrollRoot) return;
    const currentState = (history.state && typeof history.state === 'object') ? history.state : {};
    const nextState = {
      ...currentState,
      [HISTORY_SLOT_KEY]: true,
      [HISTORY_SCROLL_KEY]: scrollRoot.scrollTop,
    };

    try {
      history.replaceState(nextState, document.title, window.location.href);
    } catch {}
  }

  function installScrollStateTracker(scrollRoot) {
    if (scrollStateInstalled || !scrollRoot) return;
    scrollStateInstalled = true;

    const schedulePersist = () => {
      if (isNavigating) return;
      if (scrollStateRafId) cancelAnimationFrame(scrollStateRafId);
      scrollStateRafId = requestAnimationFrame(() => {
        scrollStateRafId = 0;
        persistScrollState(scrollRoot);
      });
    };

    scrollRoot.addEventListener('scroll', schedulePersist, { passive: true });
    window.addEventListener('beforeunload', () => persistScrollState(scrollRoot));

    persistScrollState(scrollRoot);
  }

  function syncDocumentFromRoute(sourceDocument, targetUrl) {
    if (sourceDocument.title) {
      document.title = sourceDocument.title;
    }

    syncHtmlAttributes(sourceDocument);
    syncBodyAttributes(sourceDocument.body);
    markHeaderActiveForPath(targetUrl.pathname);
  }

  function shouldBypassAnchor(anchor) {
    if (!anchor) return false;
    if (anchor.hasAttribute('download')) return true;
    if (anchor.hasAttribute('data-dx-soft-nav-skip')) return true;
    if (anchor.closest('[data-dx-soft-nav-skip]')) return true;

    const target = (anchor.getAttribute('target') || '').trim().toLowerCase();
    if (target && target !== '_self') return true;

    const href = String(anchor.getAttribute('href') || '').trim();
    if (!href) return true;
    if (href.startsWith('#')) return true;
    if (href.startsWith('javascript:')) return true;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;

    return false;
  }

  function shouldHandleSoftNavigation(targetUrl, anchor = null) {
    if (!targetUrl) return false;
    if (!isHttpUrl(targetUrl)) return false;
    if (!isSameOriginUrl(targetUrl)) return false;
    if (anchor && shouldBypassAnchor(anchor)) return false;

    const pathname = targetUrl.pathname.toLowerCase();
    if (pathname.endsWith('.xml') || pathname.endsWith('.pdf') || pathname.endsWith('.json')) return false;
    if (pathname.startsWith('/assets/')) return false;

    return true;
  }

  async function applyRouteDocument(sourceDocument, targetUrl, options = {}) {
    const headerElement = getHeaderElement(document);
    if (!headerElement) throw new Error('Unable to locate persistent header for soft route.');

    const container = headerElement.parentElement || document.body;
    const { scrollRoot, foregroundRoot } = ensureSlotRoots(container, headerElement);

    syncRouteStyles(sourceDocument, targetUrl.href);
    syncDocumentFromRoute(sourceDocument, targetUrl);

    const nextFragment = buildForegroundFragment(sourceDocument);
    clearChildren(foregroundRoot);
    foregroundRoot.appendChild(nextFragment);

    const scripts = collectRouteScripts(sourceDocument, targetUrl.href);
    const meshState = captureGooeyMeshState();

    clearRouteScripts();
    await loadRouteScripts(scripts);

    if (meshState) {
      restoreGooeyMeshState(meshState);
      requestAnimationFrame(() => {
        restoreGooeyMeshState(meshState);
      });
    }

    if (typeof options.restoreScrollTop === 'number' && Number.isFinite(options.restoreScrollTop)) {
      scrollRoot.scrollTop = Math.max(0, options.restoreScrollTop);
    } else if (targetUrl.hash) {
      scrollToHashTarget(targetUrl.hash);
    } else {
      scrollRoot.scrollTop = 0;
    }

    dispatchSlotReady(scrollRoot, foregroundRoot);
    installScrollStateTracker(scrollRoot);
    persistScrollState(scrollRoot);
  }

  function hardNavigate(url) {
    window.location.assign(url);
  }

  async function softNavigate(target, options = {}) {
    const targetUrl = (target instanceof URL) ? target : toAbsoluteUrl(String(target || ''), window.location.href);
    if (!targetUrl) return false;

    if (!shouldHandleSoftNavigation(targetUrl, options.anchor || null)) {
      if (options.allowHardNavigate === false) return false;
      hardNavigate(targetUrl.href);
      return false;
    }

    const currentUrl = new URL(window.location.href);
    const sameRoute = normalizeRouteKey(currentUrl) === normalizeRouteKey(targetUrl);
    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);

    if (sameRoute) {
      if (options.pushHistory && currentUrl.hash !== targetUrl.hash) {
        try {
          history.pushState({ [HISTORY_SLOT_KEY]: true, [HISTORY_SCROLL_KEY]: scrollRoot ? scrollRoot.scrollTop : 0 }, document.title, targetUrl.href);
        } catch {}
      }

      if (typeof options.restoreScrollTop === 'number' && scrollRoot) {
        scrollRoot.scrollTop = Math.max(0, options.restoreScrollTop);
      } else if (targetUrl.hash) {
        scrollToHashTarget(targetUrl.hash);
      }

      if (scrollRoot) persistScrollState(scrollRoot);
      return true;
    }

    if (routeAbortController) {
      routeAbortController.abort();
      routeAbortController = null;
    }

    const abortController = new AbortController();
    routeAbortController = abortController;
    isNavigating = true;
    setRoutingState(true);

    try {
      const response = await fetch(targetUrl.href, {
        credentials: 'same-origin',
        signal: abortController.signal,
      });

      const contentType = String(response.headers.get('content-type') || '');
      if (!response.ok || !contentType.includes('text/html')) {
        throw new Error(`Soft route fetch failed (${response.status}).`);
      }

      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      if (!parsed || !parsed.body) {
        throw new Error('Soft route parse failed.');
      }

      const finalUrl = toAbsoluteUrl(response.url || targetUrl.href, targetUrl.href) || targetUrl;
      finalUrl.hash = targetUrl.hash;

      await applyRouteDocument(parsed, finalUrl, options);

      if (options.pushHistory) {
        try {
          history.pushState({ [HISTORY_SLOT_KEY]: true, [HISTORY_SCROLL_KEY]: 0 }, parsed.title || document.title, finalUrl.href);
        } catch {}
      }

      return true;
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      hardNavigate(targetUrl.href);
      return false;
    } finally {
      if (routeAbortController === abortController) {
        routeAbortController = null;
      }
      isNavigating = false;
      setRoutingState(false);
    }
  }

  function installSoftRouter() {
    if (softRouterInstalled) return;
    softRouterInstalled = true;

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!anchor) return;

      const targetUrl = toAbsoluteUrl(anchor.getAttribute('href'));
      if (!targetUrl) return;
      if (!shouldHandleSoftNavigation(targetUrl, anchor)) return;

      event.preventDefault();
      void softNavigate(targetUrl, { pushHistory: true, anchor });
    }, true);

    window.addEventListener('popstate', (event) => {
      const restoreScrollTop = event && event.state && typeof event.state[HISTORY_SCROLL_KEY] === 'number'
        ? event.state[HISTORY_SCROLL_KEY]
        : null;

      void softNavigate(window.location.href, {
        pushHistory: false,
        restoreScrollTop,
        allowHardNavigate: true,
      });
    });
  }

  function init() {
    const headerElement = getHeaderElement(document);
    if (!headerElement) return;

    const container = headerElement.parentElement || document.body;
    const initialScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const { scrollRoot, foregroundRoot } = ensureSlotRoots(container, headerElement);

    moveForegroundNodes(container, headerElement, scrollRoot, foregroundRoot);

    document.body.classList.add(BODY_CLASS);

    window.dxGetSlotScrollRoot = () => document.getElementById(SLOT_SCROLL_ID);
    window.dxGetSlotForegroundRoot = () => document.getElementById(SLOT_FOREGROUND_ID);
    window.dxNavigate = (target, options = {}) => softNavigate(target, { ...options, allowHardNavigate: true });

    installSoftRouter();
    installScrollStateTracker(scrollRoot);

    requestAnimationFrame(() => {
      if (initialScroll > 0) {
        scrollRoot.scrollTop = initialScroll;
      }
      scrollToHashTarget(window.location.hash);
      dispatchSlotReady(scrollRoot, foregroundRoot);
      installHomeHeroAligner();
      persistScrollState(scrollRoot);
    });

    window.addEventListener('hashchange', () => {
      requestAnimationFrame(() => {
        scrollToHashTarget(window.location.hash);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
