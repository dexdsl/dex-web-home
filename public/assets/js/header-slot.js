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
  const MOBILE_MENU_ROOT_ID = 'dx-mobile-menu';
  const MOBILE_MENU_OPEN_CLASS = 'dx-mobile-menu-open';
  const MOBILE_BREAKPOINT_QUERY = '(max-width: 980px)';

  const PRESERVED_IDS = new Set(['gooey-mesh-wrapper', 'scroll-gradient-bg', SLOT_SCROLL_ID, SLOT_FOREGROUND_ID]);
  const PRESERVED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META']);
  const SKIPPED_ROUTE_SCRIPTS = new Set(['/assets/js/header-slot.js', '/assets/js/dx-scroll-dot.js']);
  const HOME_STACK_BLOCK_IDS = [
    'block-448bd8f915f4abba552b',
    'block-ee939fa7ed636a261fd7',
    'block-7ccf390e6577e4e9f69e',
    'block-5976018fa8f9e1213243',
    'block-9f43a906d54ed3a7b492',
  ];
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
  let slotLayoutStabilizerInstalled = false;
  let mobileMenuInstalled = false;
  let mobileMenuLastFocused = null;
  let mobileMenuCloseTimer = 0;

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

  function isHeaderWordmarkAnchor(anchor) {
    if (!(anchor instanceof Element)) return false;
    return !!anchor.closest('.header-title-logo');
  }

  function normalizeHeaderWordmarkLinks(root = document) {
    const links = Array.from(root.querySelectorAll('.header-title-logo a[href]'));
    for (const link of links) {
      const rawHref = String(link.getAttribute('href') || '').trim();
      const lowerHref = rawHref.toLowerCase();
      if (
        lowerHref === '/' ||
        lowerHref === 'index.html' ||
        lowerHref === './index.html' ||
        lowerHref === 'index.htm' ||
        lowerHref === './'
      ) {
        link.setAttribute('href', '/');
        link.setAttribute('data-dx-home-link', 'true');
        continue;
      }

      const absoluteHref = toAbsoluteUrl(rawHref);
      if (!absoluteHref) continue;
      if (normalizePathname(absoluteHref.pathname) === '/index.html') {
        link.setAttribute('href', '/');
        link.setAttribute('data-dx-home-link', 'true');
      }
    }
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
    const inlineScripts = [];

    for (const node of nodes) {
      fragment.appendChild(document.importNode(node, true));
    }

    const scripts = Array.from(fragment.querySelectorAll('script'));
    for (const script of scripts) {
      if (script.getAttribute('src')) {
        script.remove();
        continue;
      }
      const writeOutput = resolveDocumentWriteScriptOutput(script.textContent || '');
      if (writeOutput !== null) {
        script.replaceWith(document.createTextNode(writeOutput));
        continue;
      }
      if (!isExecutableInlineScript(script)) continue;
      inlineScripts.push({
        code: script.textContent || '',
        type: String(script.getAttribute('type') || '').trim(),
        noModule: script.hasAttribute('nomodule'),
      });
      script.remove();
    }

    return { fragment, inlineScripts };
  }

  function isExecutableInlineScript(script) {
    if (!(script instanceof HTMLScriptElement)) return false;
    if (script.getAttribute('src')) return false;

    const type = String(script.getAttribute('type') || '').trim().toLowerCase();
    if (!type) return true;
    if (type === 'text/javascript' || type === 'application/javascript') return true;
    if (type === 'application/ecmascript' || type === 'text/ecmascript') return true;
    return false;
  }

  function resolveDocumentWriteScriptOutput(sourceCode) {
    const code = String(sourceCode || '').trim();
    if (!code) return '';

    const match = code.match(/^document\.write\(([\s\S]*)\);?$/);
    if (!match) return null;

    const expression = String(match[1] || '').trim();
    if (!expression) return '';

    const randomizeCallMatch = expression.match(/^randomizeTitle\(([\s\S]*)\)$/);
    if (randomizeCallMatch) {
      const value = parseSingleJsStringLiteral(randomizeCallMatch[1]);
      return randomizeTitleText(value || '');
    }

    const literal = parseSingleJsStringLiteral(expression);
    if (literal !== null) return literal;

    return '';
  }

  function parseSingleJsStringLiteral(expression) {
    const raw = String(expression || '').trim();
    if (!raw) return '';
    const first = raw[0];
    const last = raw[raw.length - 1];
    if (!first || first !== last) return null;
    if (first !== '\'' && first !== '"' && first !== '`') return null;

    const inner = raw.slice(1, -1);
    if (first === '\'') return inner.replace(/\\'/g, '\'').replace(/\\\\/g, '\\');
    if (first === '`') return inner.replace(/\\`/g, '`').replace(/\\\\/g, '\\');
    try {
      return JSON.parse(raw);
    } catch {
      return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }

  function randomizeTitleText(input) {
    const source = String(input || '').toUpperCase();
    const roll = Math.random();
    const duplicateCount = roll < 0.4 ? 0 : (roll < 0.8 ? 1 : 2);
    if (!duplicateCount) return source;

    const excluded = new Set('–L:TIAWMKX&VYH?!@#$%-1234567890'.split(''));
    const letters = [];
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (!/\S/.test(char)) continue;
      if (excluded.has(char)) continue;
      letters.push({ char, index });
    }
    if (!letters.length) return source;

    const selected = letters[Math.floor(Math.random() * letters.length)];
    const repeatChar = selected.char.repeat(duplicateCount);
    return `${source.slice(0, selected.index + 1)}${repeatChar}${source.slice(selected.index + 1)}`;
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
    const headerCenterX = headerRect.left + (headerRect.width / 2);
    const blockCenterX = blockRect.left + (blockRect.width / 2);
    const shiftX = Math.round((headerCenterX - blockCenterX) * 1000) / 1000;
    blockEl.style.setProperty('transform', `translateX(${shiftX}px)`, 'important');
  }

  function isMobileViewport() {
    try {
      return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
    } catch {
      return window.innerWidth <= 980;
    }
  }

  function sanitizeClonedNode(node) {
    if (!(node instanceof HTMLElement)) return node;
    if (node.hasAttribute('id')) node.removeAttribute('id');
    const descendantsWithIds = Array.from(node.querySelectorAll('[id]'));
    for (const descendant of descendantsWithIds) {
      descendant.removeAttribute('id');
    }
    return node;
  }

  function getCurrentReturnTo() {
    return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
  }

  function triggerMobileLogin() {
    const returnTo = getCurrentReturnTo();
    const dexAuth = window.DEX_AUTH || window.dexAuth || null;
    if (dexAuth && typeof dexAuth.signIn === 'function') {
      try {
        dexAuth.signIn(returnTo);
        return true;
      } catch {}
    }

    const signInButton = document.getElementById('auth-ui-signin');
    if (signInButton instanceof HTMLElement) {
      signInButton.click();
      return true;
    }

    const loginAnchor = document.querySelector('.header-display-desktop .customerAccountLoginDesktop a[href], .header-display-mobile .customerAccountLoginDesktop a[href]');
    if (loginAnchor instanceof HTMLElement) {
      loginAnchor.click();
      return true;
    }

    return false;
  }

  function syncMobileUtilityLayout(root) {
    if (!(root instanceof HTMLElement)) return;

    const utility = root.querySelector('.dx-mobile-menu-utility');
    const socialHost = root.querySelector('.dx-mobile-menu-social');
    const actionsHost = root.querySelector('.dx-mobile-menu-actions');
    if (!(utility instanceof HTMLElement) || !(socialHost instanceof HTMLElement) || !(actionsHost instanceof HTMLElement)) return;

    root.setAttribute('data-dx-mobile-utility-stacked', 'false');
    if (!isMobileViewport()) return;

    const utilityStyles = window.getComputedStyle(utility);
    const utilityGap = parseFloat(utilityStyles.columnGap || utilityStyles.gap || '0') || 0;
    const availableWidth = utility.clientWidth;
    if (availableWidth <= 0) return;

    const socialStyles = window.getComputedStyle(socialHost);
    const socialGap = parseFloat(socialStyles.columnGap || socialStyles.gap || '0') || 0;
    const actionStyles = window.getComputedStyle(actionsHost);
    const actionGap = parseFloat(actionStyles.columnGap || actionStyles.gap || '0') || 0;

    const socialItems = Array.from(socialHost.children).filter((item) => item instanceof HTMLElement);
    const socialWidth = socialItems.reduce((total, item, index) => {
      const rect = item.getBoundingClientRect();
      return total + rect.width + (index > 0 ? socialGap : 0);
    }, 0);

    const actionItems = Array.from(actionsHost.children).filter((item) => item instanceof HTMLElement);
    const actionsWidth = actionItems.reduce((total, item, index) => {
      const rect = item.getBoundingClientRect();
      return total + rect.width + (index > 0 ? actionGap : 0);
    }, 0);

    const requiredWidth = socialWidth + actionsWidth + utilityGap;
    const shouldStack = requiredWidth > (availableWidth - 2);
    root.setAttribute('data-dx-mobile-utility-stacked', shouldStack ? 'true' : 'false');
  }

  function closeMobileMenu({ restoreFocus = true } = {}) {
    const root = document.getElementById(MOBILE_MENU_ROOT_ID);
    if (!root) return;

    document.body.classList.remove(MOBILE_MENU_OPEN_CLASS);
    if (mobileMenuCloseTimer) {
      clearTimeout(mobileMenuCloseTimer);
      mobileMenuCloseTimer = 0;
    }
    mobileMenuCloseTimer = window.setTimeout(() => {
      if (!document.body.classList.contains(MOBILE_MENU_OPEN_CLASS)) {
        root.setAttribute('aria-hidden', 'true');
      }
      mobileMenuCloseTimer = 0;
    }, 240);

    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (scrollRoot instanceof HTMLElement) {
      const previousOverflow = String(scrollRoot.getAttribute('data-dx-mobile-menu-prev-overflow') || '');
      if (previousOverflow) {
        scrollRoot.style.overflowY = previousOverflow;
      } else {
        scrollRoot.style.removeProperty('overflow-y');
      }
      scrollRoot.removeAttribute('data-dx-mobile-menu-prev-overflow');
    }

    const burgerButtons = Array.from(document.querySelectorAll('.header-display-mobile .header-burger-btn'));
    for (const button of burgerButtons) {
      button.setAttribute('aria-expanded', 'false');
    }

    if (restoreFocus && mobileMenuLastFocused && mobileMenuLastFocused instanceof HTMLElement) {
      try {
        mobileMenuLastFocused.focus({ preventScroll: true });
      } catch {}
    }
    mobileMenuLastFocused = null;
  }

  function markMobileMenuActiveForPath(pathname) {
    const root = document.getElementById(MOBILE_MENU_ROOT_ID);
    if (!root) return;

    const normalizedTarget = normalizePathname(pathname);
    const links = Array.from(root.querySelectorAll('.dx-mobile-menu-nav a[data-dx-mobile-menu-route]'));
    for (const link of links) {
      const routePath = normalizePathname(String(link.getAttribute('data-dx-mobile-menu-route') || ''));
      const isActive = routePath === normalizedTarget;
      link.setAttribute('data-dx-mobile-menu-active', isActive ? 'true' : 'false');
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  function getUniqueAnchors(candidates) {
    const unique = [];
    const seen = new Set();
    for (const anchor of candidates) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      const href = String(anchor.getAttribute('href') || '').trim();
      if (!href) continue;
      if (href.startsWith('javascript:')) continue;
      const text = String(anchor.textContent || '').trim();
      const key = `${href}::${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(anchor);
    }
    return unique;
  }

  function buildMobileMenuContent(root) {
    if (!(root instanceof HTMLElement)) return;

    const socialHost = root.querySelector('.dx-mobile-menu-social');
    const actionsHost = root.querySelector('.dx-mobile-menu-actions');
    const navHost = root.querySelector('.dx-mobile-menu-nav');
    if (!(socialHost instanceof HTMLElement) || !(actionsHost instanceof HTMLElement) || !(navHost instanceof HTMLElement)) return;

    clearChildren(socialHost);
    clearChildren(actionsHost);
    clearChildren(navHost);

    const socialCandidates = getUniqueAnchors(Array.from(document.querySelectorAll(
      '.header-display-desktop .header-actions--left .header-actions-action--social a.icon[href], .header-display-mobile .header-actions--left .header-actions-action--social a.icon[href]'
    )));
    for (const anchor of socialCandidates) {
      const clone = sanitizeClonedNode(anchor.cloneNode(true));
      if (!(clone instanceof HTMLAnchorElement)) continue;
      clone.classList.add('icon');
      socialHost.appendChild(clone);
    }

    const loginAction = document.createElement('a');
    loginAction.href = '#';
    loginAction.textContent = 'LOGIN';
    loginAction.setAttribute('data-dx-mobile-menu-action', 'true');
    loginAction.setAttribute('data-dx-mobile-login-trigger', 'true');
    actionsHost.appendChild(loginAction);

    const donateSource = document.querySelector('.header-display-desktop .header-actions-action--cta a[href], .header-display-mobile .header-actions-action--cta a[href]');
    if (donateSource instanceof HTMLAnchorElement) {
      const donateClone = sanitizeClonedNode(donateSource.cloneNode(true));
      if (donateClone instanceof HTMLAnchorElement) {
        donateClone.setAttribute('data-dx-mobile-menu-action', 'true');
        actionsHost.appendChild(donateClone);
      }
    }

    const navCandidates = getUniqueAnchors(Array.from(document.querySelectorAll(
      '.header-display-desktop .header-nav-list .header-nav-item > a[href], .header-display-mobile .header-nav-list .header-nav-item > a[href]'
    )));
    for (const anchor of navCandidates) {
      const href = String(anchor.getAttribute('href') || '').trim();
      const absoluteHref = toAbsoluteUrl(href);
      if (!absoluteHref) continue;
      if (!isHttpUrl(absoluteHref)) continue;
      if (!isSameOriginUrl(absoluteHref)) continue;

      const clone = sanitizeClonedNode(anchor.cloneNode(true));
      if (!(clone instanceof HTMLAnchorElement)) continue;
      clone.setAttribute('data-dx-mobile-menu-route', normalizePathname(absoluteHref.pathname));
      clone.removeAttribute('target');
      clone.removeAttribute('rel');
      navHost.appendChild(clone);
    }

    markMobileMenuActiveForPath(window.location.pathname);
    syncMobileUtilityLayout(root);
  }

  function openMobileMenu(root, triggerButton = null) {
    if (!(root instanceof HTMLElement)) return;
    if (!isMobileViewport()) return;

    if (mobileMenuCloseTimer) {
      clearTimeout(mobileMenuCloseTimer);
      mobileMenuCloseTimer = 0;
    }
    syncMobileUtilityLayout(root);
    root.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      document.body.classList.add(MOBILE_MENU_OPEN_CLASS);
      syncMobileUtilityLayout(root);
    });
    mobileMenuLastFocused = triggerButton instanceof HTMLElement ? triggerButton : (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (scrollRoot instanceof HTMLElement) {
      if (!scrollRoot.hasAttribute('data-dx-mobile-menu-prev-overflow')) {
        scrollRoot.setAttribute('data-dx-mobile-menu-prev-overflow', scrollRoot.style.overflowY || '');
      }
      scrollRoot.style.overflowY = 'hidden';
    }

    const burgerButtons = Array.from(document.querySelectorAll('.header-display-mobile .header-burger-btn'));
    for (const button of burgerButtons) {
      button.setAttribute('aria-expanded', 'true');
    }
  }

  function normalizeMobileBurgerHooks(root = document) {
    const burgerContainers = Array.from(root.querySelectorAll('.header-display-mobile .header-burger'));
    for (const container of burgerContainers) {
      container.classList.remove('header-burger');
      container.classList.add('dx-header-burger');
    }

    const burgerButtons = Array.from(root.querySelectorAll('.header-display-mobile .header-burger-btn'));
    for (const button of burgerButtons) {
      button.setAttribute('type', 'button');
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', document.body.classList.contains(MOBILE_MENU_OPEN_CLASS) ? 'true' : 'false');
      button.setAttribute('aria-controls', MOBILE_MENU_ROOT_ID);
    }
  }

  function installMobileMenu() {
    if (mobileMenuInstalled) return;
    mobileMenuInstalled = true;

    let root = document.getElementById(MOBILE_MENU_ROOT_ID);
    if (!(root instanceof HTMLElement)) {
      root = document.createElement('div');
      root.id = MOBILE_MENU_ROOT_ID;
      root.className = 'dx-mobile-menu';
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = `
        <button class="dx-mobile-menu-backdrop" type="button" aria-label="Close menu" data-dx-mobile-menu-close="true"></button>
        <div class="dx-mobile-menu-sheet" role="dialog" aria-modal="true" aria-label="Site menu">
          <div class="dx-mobile-menu-utility">
            <div class="dx-mobile-menu-social" aria-label="Social links"></div>
            <div class="dx-mobile-menu-actions" aria-label="Account and actions"></div>
          </div>
          <nav class="dx-mobile-menu-nav" aria-label="Site navigation"></nav>
        </div>
      `;
      document.body.appendChild(root);
    }

    buildMobileMenuContent(root);
    normalizeMobileBurgerHooks(document);

    document.addEventListener('click', (event) => {
      const target = event.target;
      const burgerButton = target && target.closest ? target.closest('.header-display-mobile .header-burger-btn') : null;
      if (!burgerButton) return;
      if (!isMobileViewport()) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      if (document.body.classList.contains(MOBILE_MENU_OPEN_CLASS)) {
        closeMobileMenu();
      } else {
        openMobileMenu(root, burgerButton);
      }
    }, true);

    root.addEventListener('click', (event) => {
      const target = event.target;
      const closeTrigger = target && target.closest ? target.closest('[data-dx-mobile-menu-close="true"]') : null;
      if (closeTrigger) {
        event.preventDefault();
        closeMobileMenu();
        return;
      }

      const clickedLink = target && target.closest ? target.closest('a[href]') : null;
      if (!clickedLink) return;
      const href = String(clickedLink.getAttribute('href') || '').trim();
      if (!href) return;
      if (clickedLink.matches('[data-dx-mobile-login-trigger="true"]')) {
        event.preventDefault();
        triggerMobileLogin();
      }
      closeMobileMenu({ restoreFocus: false });
    });

    window.addEventListener('resize', () => {
      if (!isMobileViewport()) {
        closeMobileMenu({ restoreFocus: false });
      }
      normalizeMobileBurgerHooks(document);
      syncMobileUtilityLayout(root);
    }, { passive: true });

    window.addEventListener('orientationchange', () => {
      if (!isMobileViewport()) {
        closeMobileMenu({ restoreFocus: false });
      }
      normalizeMobileBurgerHooks(document);
      syncMobileUtilityLayout(root);
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!document.body.classList.contains(MOBILE_MENU_OPEN_CLASS)) return;
      closeMobileMenu();
    }, true);

    window.addEventListener('dx:slotready', () => {
      closeMobileMenu({ restoreFocus: false });
      normalizeMobileBurgerHooks(document);
      buildMobileMenuContent(root);
      markMobileMenuActiveForPath(window.location.pathname);
      syncMobileUtilityLayout(root);
    });
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

  function clearHomeStackSpacingOverrides() {
    if (!document.body.classList.contains('homepage')) return;
    for (const id of HOME_STACK_BLOCK_IDS) {
      const block = document.getElementById(id);
      if (!block) continue;
      const section = block.closest('section.page-section');
      if (!section) continue;
      section.style.removeProperty('margin-top');
    }
  }

  function installHomeHeroAligner() {
    if (homeHeroAlignerInstalled) return;
    homeHeroAlignerInstalled = true;

    let rafId = 0;
    const run = () => {
      alignHomeHeroToHeader();
      clearHomeStackSpacingOverrides();
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        run();
        requestAnimationFrame(run);
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

    markMobileMenuActiveForPath(pathname);
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

  function digestInlineScript(definition) {
    const type = String((definition && definition.type) || '').trim().toLowerCase();
    const code = String((definition && definition.code) || '').trim();
    if (!code) return '';

    let hash = 2166136261;
    const payload = `${type}::${code}`;
    for (let index = 0; index < payload.length; index += 1) {
      hash ^= payload.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `dx-inline-${(hash >>> 0).toString(16)}`;
  }

  function buildInlineRouteScriptBundle(definitions) {
    const seen = new Set();
    const chunks = [];
    for (const definition of definitions) {
      const code = String((definition && definition.code) || '').trim();
      if (!code) continue;
      const digest = digestInlineScript(definition);
      if (digest && seen.has(digest)) continue;
      if (digest) seen.add(digest);
      chunks.push(code);
    }
    if (!chunks.length) return '';

    return `\n(function(){\n  const __dxOriginalAddEventListener = document.addEventListener.bind(document);\n  const __dxDomReadyEvent = (() => {\n    try {\n      return new Event('DOMContentLoaded', { bubbles: true, cancelable: true });\n    } catch {\n      const fallback = document.createEvent('Event');\n      fallback.initEvent('DOMContentLoaded', true, true);\n      return fallback;\n    }\n  })();\n  const __dxDispatchDomReady = (listener) => {\n    if (!listener) return;\n    if (typeof listener === 'function') {\n      listener.call(document, __dxDomReadyEvent);\n      return;\n    }\n    if (listener && typeof listener.handleEvent === 'function') {\n      listener.handleEvent(__dxDomReadyEvent);\n    }\n  };\n  document.addEventListener = function(type, listener, options) {\n    if (String(type || '').toLowerCase() === 'domcontentloaded') {\n      try {\n        __dxDispatchDomReady(listener);\n      } catch (error) {\n        try { console.error(error); } catch {}\n      }\n      return;\n    }\n    return __dxOriginalAddEventListener(type, listener, options);\n  };\n  try {\n${chunks.join('\n;\n')}\n  } finally {\n    document.addEventListener = __dxOriginalAddEventListener;\n  }\n})();\n`;
  }

  function loadInlineRouteScripts(definitions) {
    const bundledCode = buildInlineRouteScriptBundle(definitions);
    if (!bundledCode) return false;

    try {
      const script = document.createElement('script');
      script.setAttribute(ROUTE_SCRIPT_ATTR, 'true');
      script.text = bundledCode;
      document.body.appendChild(script);
      return true;
    } catch (error) {
      try {
        console.warn('[dx-slot] inline route bundle skipped due to execution error.', error);
      } catch {}
      return false;
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

  function installSlotLayoutStabilizer(scrollRoot, foregroundRoot) {
    if (slotLayoutStabilizerInstalled || !scrollRoot || !foregroundRoot) return;
    slotLayoutStabilizerInstalled = true;

    let lastHeight = foregroundRoot.getBoundingClientRect().height;
    let rafId = 0;

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const nextHeight = foregroundRoot.getBoundingClientRect().height;
        const delta = nextHeight - lastHeight;
        lastHeight = nextHeight;
        if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) return;

        const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
        const isNearBottom = (maxScroll - scrollRoot.scrollTop) <= 120;
        if (isNearBottom && delta > 0) {
          scrollRoot.scrollTop = maxScroll;
        }
      });
    };

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(schedule);
      observer.observe(foregroundRoot);
    }

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule);
    window.addEventListener('dx:slotready', () => {
      lastHeight = foregroundRoot.getBoundingClientRect().height;
      schedule();
    });
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

    const { fragment: nextFragment, inlineScripts } = buildForegroundFragment(sourceDocument);
    clearChildren(foregroundRoot);
    foregroundRoot.appendChild(nextFragment);

    const scripts = collectRouteScripts(sourceDocument, targetUrl.href);
    const meshState = captureGooeyMeshState();

    clearRouteScripts();
    await loadRouteScripts(scripts);
    loadInlineRouteScripts(inlineScripts);

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

      const targetUrl = isHeaderWordmarkAnchor(anchor)
        ? new URL('/', window.location.origin)
        : toAbsoluteUrl(anchor.getAttribute('href'));
      if (!targetUrl) return;
      if (!shouldHandleSoftNavigation(targetUrl, anchor)) return;

      if (isHeaderWordmarkAnchor(anchor)) {
        anchor.setAttribute('href', '/');
        anchor.setAttribute('data-dx-home-link', 'true');
      }

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
    normalizeHeaderWordmarkLinks();

    window.dxGetSlotScrollRoot = () => document.getElementById(SLOT_SCROLL_ID);
    window.dxGetSlotForegroundRoot = () => document.getElementById(SLOT_FOREGROUND_ID);
    window.dxNavigate = (target, options = {}) => softNavigate(target, { ...options, allowHardNavigate: true });

    installSoftRouter();
    installScrollStateTracker(scrollRoot);
    installSlotLayoutStabilizer(scrollRoot, foregroundRoot);
    installMobileMenu();

    requestAnimationFrame(() => {
      if (initialScroll > 0) {
        scrollRoot.scrollTop = initialScroll;
      }
      scrollToHashTarget(window.location.hash);
      dispatchSlotReady(scrollRoot, foregroundRoot);
      installHomeHeroAligner();
      normalizeMobileBurgerHooks(document);
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
