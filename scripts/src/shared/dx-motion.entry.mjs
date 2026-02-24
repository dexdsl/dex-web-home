import { animate } from 'framer-motion/dom';

const ACTIVE_CONTROLS = new Map();
const GROUP_STATE = new WeakMap();

const DEFAULTS = {
  easeStandard: [0.22, 0.8, 0.24, 1],
  easeEmphasis: [0.2, 0.9, 0.25, 1],
  easeExit: [0.4, 0, 0.2, 1],
  hoverY: -2,
  hoverScale: 1.015,
  pressScale: 0.985,
};

function markBound(node, key) {
  const raw = String(node.dataset.dxMotionBound || '');
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.includes(key)) return false;
  tokens.push(key);
  node.dataset.dxMotionBound = tokens.join(' ');
  return true;
}

function hasBound(node, key) {
  const raw = String(node.dataset.dxMotionBound || '');
  return raw.split(/\s+/).includes(key);
}

function toCssTime(value, fallbackMs) {
  if (typeof value === 'number') return value / 1000;
  if (typeof value !== 'string') return fallbackMs / 1000;
  const trimmed = value.trim();
  if (!trimmed) return fallbackMs / 1000;
  if (trimmed.endsWith('ms')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(parsed) ? parsed / 1000 : fallbackMs / 1000;
  }
  if (trimmed.endsWith('s')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(parsed) ? parsed : fallbackMs / 1000;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : fallbackMs / 1000;
}

function cssValue(node, property, fallback = '') {
  if (!node || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  try {
    const value = window.getComputedStyle(node).getPropertyValue(property);
    return value ? value.trim() : fallback;
  } catch {
    return fallback;
  }
}

function tokenMs(node, property, fallbackMs) {
  const raw = cssValue(node, property, `${fallbackMs}ms`);
  return toCssTime(raw, fallbackMs);
}

function tokenNum(node, property, fallback) {
  const raw = cssValue(node, property, String(fallback));
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function registerControl(node, control) {
  if (!node || !control || typeof control.stop !== 'function') return control;
  let set = ACTIVE_CONTROLS.get(node);
  if (!set) {
    set = new Set();
    ACTIVE_CONTROLS.set(node, set);
  }
  set.add(control);

  if (typeof control.then === 'function') {
    control.then(
      () => {
        set.delete(control);
        if (!set.size) ACTIVE_CONTROLS.delete(node);
      },
      () => {
        set.delete(control);
        if (!set.size) ACTIVE_CONTROLS.delete(node);
      },
    );
  }

  return control;
}

function animateNode(node, keyframes, options) {
  return registerControl(node, animate(node, keyframes, options));
}

function getInteractiveButtons(scopeEl, selectors) {
  if (!scopeEl || typeof scopeEl.querySelectorAll !== 'function') return [];
  return Array.from(scopeEl.querySelectorAll(selectors));
}

function registerMotionPair(node, key, onEnter, onLeave) {
  if (!markBound(node, key)) return;
  node.dataset.dxMotion = node.dataset.dxMotion || 'interactive';

  const onPointerEnter = () => onEnter(node);
  const onPointerLeave = () => onLeave(node);
  const onFocusIn = () => onEnter(node);
  const onFocusOut = () => onLeave(node);

  node.addEventListener('pointerenter', onPointerEnter);
  node.addEventListener('pointerleave', onPointerLeave);
  node.addEventListener('focusin', onFocusIn);
  node.addEventListener('focusout', onFocusOut);
}

function resetGroupOpacity(group) {
  if (!group) return;
  const buttons = GROUP_STATE.get(group);
  if (!buttons) return;
  buttons.forEach((button) => {
    button.style.opacity = '';
  });
}

function updateGroupOpacity(target) {
  if (!target || !target.parentElement) return;
  const group = target.parentElement;
  let buttons = GROUP_STATE.get(group);
  if (!buttons) {
    buttons = Array.from(group.querySelectorAll('[data-dx-motion="interactive"]'));
    if (buttons.length < 2) return;
    GROUP_STATE.set(group, buttons);
  }

  buttons.forEach((button) => {
    if (button === target || button.matches(':focus-visible')) {
      button.style.opacity = '1';
    } else {
      button.style.opacity = '0.76';
    }
  });
}

export function prefersReducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export function stopAllInScope(scopeEl) {
  if (!scopeEl || typeof scopeEl.contains !== 'function') return;

  ACTIVE_CONTROLS.forEach((controls, node) => {
    if (!scopeEl.contains(node)) return;
    controls.forEach((control) => {
      try {
        control.stop();
      } catch {
        // Ignore stale controls.
      }
    });
    controls.clear();
  });
}

export function routeTransitionOut(scopeEl, opts = {}) {
  if (!scopeEl || prefersReducedMotion()) return null;
  const distance = typeof opts.distance === 'number' ? opts.distance : tokenNum(scopeEl, '--dx-motion-distance-md', 10);
  const duration = typeof opts.duration === 'number' ? opts.duration : tokenMs(scopeEl, '--dx-motion-dur-sm', 180);

  scopeEl.dataset.dxMotion = 'route-exit';
  return animateNode(
    scopeEl,
    {
      opacity: [1, 0],
      y: [0, distance],
      filter: ['blur(0px)', 'blur(2px)'],
    },
    {
      duration,
      ease: DEFAULTS.easeExit,
    },
  );
}

export function routeTransitionIn(scopeEl, opts = {}) {
  if (!scopeEl || prefersReducedMotion()) return null;
  const distance = typeof opts.distance === 'number' ? opts.distance : tokenNum(scopeEl, '--dx-motion-distance-lg', 20);
  const duration = typeof opts.duration === 'number' ? opts.duration : tokenMs(scopeEl, '--dx-motion-dur-md', 260);

  scopeEl.dataset.dxMotion = 'route-enter';
  return animateNode(
    scopeEl,
    {
      opacity: [tokenNum(scopeEl, '--dx-motion-opacity-enter', 0.001), 1],
      y: [distance, 0],
      filter: ['blur(2px)', 'blur(0px)'],
    },
    {
      duration,
      ease: DEFAULTS.easeStandard,
    },
  );
}

export function bindDexButtonMotion(scopeEl, opts = {}) {
  if (!scopeEl || prefersReducedMotion()) return;

  const selector = opts.selector || [
    '.dx-button-element',
    '.dx-block-button-element',
    '.sqs-button-element',
    '.cta-btn',
    '.cta',
    '.dex-btn',
    '.ghost',
    '.ghost-btn',
    '.theme-btn--primary',
    '.btn--border.theme-btn--primary-inverse',
  ].join(', ');

  const nodes = getInteractiveButtons(scopeEl, selector);
  const hoverY = opts.hoverY ?? tokenNum(scopeEl, '--dx-motion-distance-sm', Math.abs(DEFAULTS.hoverY));
  const hoverScale = opts.hoverScale ?? tokenNum(scopeEl, '--dx-motion-scale-hover', DEFAULTS.hoverScale);
  const pressScale = opts.pressScale ?? tokenNum(scopeEl, '--dx-motion-scale-press', DEFAULTS.pressScale);
  const durationSm = tokenMs(scopeEl, '--dx-motion-dur-sm', 180);
  const durationXs = tokenMs(scopeEl, '--dx-motion-dur-xs', 120);

  nodes.forEach((node) => {
    registerMotionPair(
      node,
      'button',
      (target) => {
        updateGroupOpacity(target);
        animateNode(
          target,
          {
            y: [-hoverY],
            scale: [hoverScale],
          },
          {
            duration: durationSm,
            ease: DEFAULTS.easeEmphasis,
          },
        );
      },
      (target) => {
        resetGroupOpacity(target.parentElement);
        animateNode(
          target,
          {
            y: [0, -0.4, 0],
            scale: [1, 1.006, 1],
          },
          {
            duration: durationXs,
            ease: DEFAULTS.easeStandard,
          },
        );
      },
    );

    if (hasBound(node, 'button-press')) return;
    markBound(node, 'button-press');

    const press = () => {
      animateNode(
        node,
        {
          y: [0],
          scale: [pressScale],
        },
        {
          duration: durationXs,
          ease: DEFAULTS.easeExit,
        },
      );
    };

    node.addEventListener('pointerdown', press, { passive: true });
    node.addEventListener('mousedown', press);
  });
}

function inferDirection(node) {
  const cls = `${node.className || ''}`.toLowerCase();
  const label = `${node.textContent || ''}`.toLowerCase();
  if (cls.includes('--left') || cls.includes('prev') || label.includes('previous') || label.includes('prev')) return -1;
  if (cls.includes('--right') || cls.includes('next') || label.includes('next')) return 1;
  return 0;
}

export function bindPaginationMotion(scopeEl, opts = {}) {
  if (!scopeEl || prefersReducedMotion()) return;

  const selector = opts.selector || [
    '[data-dx-motion="pagination"] a',
    '[data-dx-motion="pagination"] button',
    '.dx-dexnotes-entry-pagination-row a',
    '.dx-catalog-index-season-tab',
    '.dx-catalog-index-season-arrow',
  ].join(', ');

  const nodes = getInteractiveButtons(scopeEl, selector);
  const durationSm = tokenMs(scopeEl, '--dx-motion-dur-sm', 180);
  const durationXs = tokenMs(scopeEl, '--dx-motion-dur-xs', 120);
  const pressScale = tokenNum(scopeEl, '--dx-motion-scale-press', DEFAULTS.pressScale);

  nodes.forEach((node) => {
    registerMotionPair(
      node,
      'pagination',
      (target) => {
        const direction = inferDirection(target);
        const drift = direction === 0 ? 0 : direction * 3;
        animateNode(
          target,
          {
            x: [drift],
            scale: [1.01],
          },
          {
            duration: durationSm,
            ease: DEFAULTS.easeStandard,
          },
        );
      },
      (target) => {
        animateNode(
          target,
          {
            x: [0],
            scale: [1],
          },
          {
            duration: durationXs,
            ease: DEFAULTS.easeStandard,
          },
        );
      },
    );

    if (hasBound(node, 'pagination-press')) return;
    markBound(node, 'pagination-press');
    node.addEventListener('pointerdown', () => {
      animateNode(
        node,
        {
          scale: [pressScale],
        },
        {
          duration: durationXs,
          ease: DEFAULTS.easeExit,
        },
      );
    }, { passive: true });
  });
}

function bindSidebarPanels(scopeEl) {
  const tabs = Array.from(scopeEl.querySelectorAll('.file-info-tabs button[data-tab], .file-info-tabs [role="tab"][data-tab]'));
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    if (!markBound(tab, 'sidebar-tab')) return;

    tab.addEventListener('click', () => {
      const owner = tab.closest('.dex-file-info') || tab.closest('.dex-sidebar') || scopeEl;
      if (!owner) return;

      const panels = Array.from(owner.querySelectorAll('.file-info-panels > [role="tabpanel"], .file-info-panels > div'));
      const previous = panels.find((panel) => !panel.hidden);

      requestAnimationFrame(() => {
        const next = panels.find((panel) => !panel.hidden);
        if (previous && previous !== next) {
          animateNode(
            previous,
            {
              opacity: [1, 0],
              y: [0, 4],
            },
            {
              duration: 0.16,
              ease: DEFAULTS.easeExit,
            },
          );
        }

        if (next) {
          animateNode(
            next,
            {
              opacity: [0, 1],
              y: [-4, 0],
            },
            {
              duration: 0.2,
              ease: DEFAULTS.easeStandard,
            },
          );
        }
      });
    });
  });
}

export function bindSidebarMotion(scopeEl, opts = {}) {
  if (!scopeEl || prefersReducedMotion()) return;

  const selector = opts.selector || '.dex-sidebar section, .dx-call-sidebar-stack > *, .dx-call-progress-link';
  revealStagger(scopeEl, selector, {
    key: 'sidebar-reveal',
    y: 14,
    duration: 0.3,
    stagger: 0.03,
    threshold: 0.14,
    rootMargin: '0px 0px -8% 0px',
  });
  bindSidebarPanels(scopeEl);
}

export function revealStagger(scopeEl, selector, opts = {}) {
  if (!scopeEl || prefersReducedMotion()) return;
  if (!(window.IntersectionObserver && typeof window.IntersectionObserver === 'function')) return;

  const key = opts.key || `reveal-${selector}`;
  const nodes = Array.from(scopeEl.querySelectorAll(selector));
  if (!nodes.length) return;

  const duration = typeof opts.duration === 'number' ? opts.duration : 0.42;
  const stagger = typeof opts.stagger === 'number' ? opts.stagger : 0.028;
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.13;
  const rootMargin = typeof opts.rootMargin === 'string' ? opts.rootMargin : '0px 0px -6% 0px';
  const y = typeof opts.y === 'number' ? opts.y : 20;

  const observer = new IntersectionObserver(
    (entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const node = entry.target;
        if (node.dataset.dxRevealed === key) {
          instance.unobserve(node);
          return;
        }

        node.dataset.dxRevealed = key;
        const localOrder = Number(node.dataset.dxRevealOrder || 0);

        animateNode(
          node,
          {
            opacity: [0, 1],
            transform: [`translate3d(0, ${y}px, 0)`, 'translate3d(0, 0, 0)'],
          },
          {
            duration,
            ease: DEFAULTS.easeStandard,
            delay: localOrder * stagger,
          },
        );

        instance.unobserve(node);
      });
    },
    {
      threshold,
      rootMargin,
    },
  );

  nodes.forEach((node, index) => {
    if (!markBound(node, key)) return;
    node.style.opacity = '0';
    node.style.transform = `translate3d(0, ${y}px, 0)`;
    node.dataset.dxRevealOrder = String(index);
    observer.observe(node);
  });
}
