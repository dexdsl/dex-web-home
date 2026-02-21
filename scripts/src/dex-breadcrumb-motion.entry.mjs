import { animate } from 'framer-motion/dom';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dexBreadcrumbMotionRuntimeLoaded) {
    if (typeof window.dexBreadcrumbMotionMount === 'function') {
      try { window.dexBreadcrumbMotionMount(); } catch {}
    }
    return;
  }
  window.__dexBreadcrumbMotionRuntimeLoaded = true;

  const SELECTOR = '[data-dex-breadcrumb-delimiter]';
  const active = new WeakMap();
  const hoverBound = new WeakSet();

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  }

  function stopAnimation(node) {
    const controls = active.get(node);
    if (!controls) return;
    try {
      if (typeof controls.stop === 'function') controls.stop();
      else if (typeof controls.cancel === 'function') controls.cancel();
    } catch {}
    active.delete(node);
  }

  function animateIdle(node) {
    if (!node || active.has(node) || prefersReducedMotion()) return;
    try {
      const controls = animate(
        node,
        {
          rotate: [0, -12, 14, -8, 0],
          scale: [1, 1.28, 0.92, 1.08, 1],
          opacity: [0.68, 1, 0.78, 0.94, 0.68],
        },
        {
          duration: 2.6,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      );
      if (controls) active.set(node, controls);
    } catch {}
  }

  function animateBoost(node) {
    if (!node || prefersReducedMotion()) return;
    try {
      animate(
        node,
        {
          rotate: [0, 18, -12, 6, 0],
          scale: [1, 1.44, 0.92, 1.12, 1],
          opacity: [0.8, 1, 0.74, 0.96, 0.8],
        },
        {
          duration: 0.8,
          ease: 'easeOut',
        },
      );
    } catch {}
  }

  function bindHover(node) {
    if (!node || hoverBound.has(node)) return;
    hoverBound.add(node);
    node.addEventListener('pointerenter', () => animateBoost(node), { passive: true });
    node.addEventListener('focus', () => animateBoost(node), { passive: true });
  }

  function mount() {
    const nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;

    if (prefersReducedMotion()) {
      nodes.forEach((node) => {
        stopAnimation(node);
        node.style.transform = 'none';
      });
      return;
    }

    nodes.forEach((node) => {
      bindHover(node);
      animateIdle(node);
    });
  }

  window.dexBreadcrumbMotionMount = mount;

  try {
    window.dispatchEvent(new CustomEvent('dex:breadcrumb-motion-ready'));
  } catch {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
