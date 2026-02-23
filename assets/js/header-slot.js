(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxHeaderSlotLoaded) return;
  window.__dxHeaderSlotLoaded = true;

  const BODY_CLASS = 'dx-slot-enabled';
  const SLOT_SCROLL_ID = 'dx-slot-scroll-root';
  const SLOT_FOREGROUND_ID = 'dx-slot-foreground-root';
  const PRESERVED_IDS = new Set(['gooey-mesh-wrapper', 'scroll-gradient-bg', SLOT_SCROLL_ID, SLOT_FOREGROUND_ID]);
  const PRESERVED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META']);

  function getHeaderElement() {
    const wrapper = document.querySelector('.header-announcement-bar-wrapper');
    if (!wrapper) return null;
    return wrapper.closest('header') || wrapper;
  }

  function shouldPreserveOutsideSlot(node, headerElement) {
    if (!(node instanceof HTMLElement)) return true;
    if (node === headerElement) return true;
    if (node.contains(headerElement)) return true;
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

  function init() {
    const headerElement = getHeaderElement();
    if (!headerElement) return;

    const container = headerElement.parentElement || document.body;
    const initialScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const { scrollRoot, foregroundRoot } = ensureSlotRoots(container, headerElement);

    moveForegroundNodes(container, headerElement, scrollRoot, foregroundRoot);

    document.body.classList.add(BODY_CLASS);

    window.dxGetSlotScrollRoot = () => document.getElementById(SLOT_SCROLL_ID);
    window.dxGetSlotForegroundRoot = () => document.getElementById(SLOT_FOREGROUND_ID);

    requestAnimationFrame(() => {
      if (initialScroll > 0) {
        scrollRoot.scrollTop = initialScroll;
      }
      scrollToHashTarget(window.location.hash);
      dispatchSlotReady(scrollRoot, foregroundRoot);
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
