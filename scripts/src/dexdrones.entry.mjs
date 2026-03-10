import { animate } from 'framer-motion/dom';
import { bindDexButtonMotion, bindSidebarMotion, prefersReducedMotion, revealStagger } from './shared/dx-motion.entry.mjs';

(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxDexdronesRouteLoaded) return;
  window.__dxDexdronesRouteLoaded = true;

  const APP_SELECTOR = '[data-dx-dexdrones-app]';
  const DEFAULT_DATA_URL = '/data/dexdrones.data.json';
  const DEFAULT_SOURCE = 'dexdrones-page';
  const DEFAULT_NAV_TITLE = 'SCROLL STEPS';
  const DEFAULT_HASH_ALIASES = {
    launch: 'dexdrones-hero',
    proof: 'dexdrones-proof',
    mission: 'dexdrones-why',
    publishes: 'dexdrones-publishes',
    underway: 'dexdrones-underway',
    sponsor: 'dexdrones-kolari',
    partners: 'dexdrones-partners',
    participate: 'dexdrones-participate',
    quotes: 'dexdrones-quotes',
    support: 'dexdrones-support',
    press: 'dexdrones-press',
    about: 'dexdrones-about',
  };
  const DEFAULT_STEPS = [
    { id: 'dexdrones-hero', label: 'LAUNCH' },
    { id: 'dexdrones-proof', label: 'PROOF' },
    { id: 'dexdrones-why', label: 'WHY THIS WING EXISTS' },
    { id: 'dexdrones-publishes', label: 'WHAT IT PUBLISHES' },
    { id: 'dexdrones-underway', label: 'UNDERWAY NOW' },
    { id: 'dexdrones-kolari', label: 'KOLARI SUPPORT' },
    { id: 'dexdrones-partners', label: 'WHY PARTNERS JOIN' },
    { id: 'dexdrones-participate', label: 'WAYS TO PARTICIPATE' },
    { id: 'dexdrones-quotes', label: 'QUOTES' },
    { id: 'dexdrones-support', label: 'SUPPORT' },
    { id: 'dexdrones-press', label: 'PRESS MATERIALS' },
    { id: 'dexdrones-about', label: 'ABOUT DEX' },
  ];
  const HEADING_DUPLICATE_EXCLUDED_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function toText(value, fallback = '', max = 600) {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    return text.slice(0, max);
  }

  function toBool(value, fallback = true) {
    if (value == null) return fallback;
    const text = String(value).trim().toLowerCase();
    if (!text) return fallback;
    if (text === '1' || text === 'true' || text === 'yes' || text === 'on') return true;
    if (text === '0' || text === 'false' || text === 'no' || text === 'off') return false;
    return fallback;
  }

  function normalizeHash(value) {
    return toText(String(value || '').replace(/^#/, ''), '', 120).toLowerCase();
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function create(tag, className, textValue = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textValue !== null) element.textContent = textValue;
    return element;
  }

  function toHeadingText(value, fallback = '', max = 300) {
    return toText(value, fallback, max).toUpperCase();
  }

  function applyHeadingDuplicateExclusions(heading) {
    if (!(heading instanceof HTMLElement)) return heading;
    heading.setAttribute('data-dx-heading-duplicate-exclude-letters', HEADING_DUPLICATE_EXCLUDED_LETTERS);
    return heading;
  }

  function parseConfig() {
    const config = window.DEX_DRONES_CONFIG && typeof window.DEX_DRONES_CONFIG === 'object'
      ? window.DEX_DRONES_CONFIG
      : {};

    return {
      source: toText(config.source, DEFAULT_SOURCE, 120),
      sectionNavTitle: toText(config.sectionNavTitle, DEFAULT_NAV_TITLE, 120),
      dataUrl: toText(config.dataUrl, DEFAULT_DATA_URL, 500),
      enableReveal: toBool(config.enableReveal, true),
      hashAliases: config.hashAliases && typeof config.hashAliases === 'object' ? config.hashAliases : {},
    };
  }

  function mergeAliases(configAliases, dataAliases) {
    const merged = { ...DEFAULT_HASH_ALIASES };
    [dataAliases, configAliases].forEach((source) => {
      if (!source || typeof source !== 'object') return;
      Object.entries(source).forEach(([key, value]) => {
        const alias = normalizeHash(key);
        const target = normalizeHash(value);
        if (!alias || !target) return;
        merged[alias] = target;
      });
    });
    return merged;
  }

  function isExternalHref(href) {
    const value = toText(href, '', 900);
    if (!value) return false;
    return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('mailto:');
  }

  function createButtonLink(cta) {
    const label = toText(cta?.label, 'Learn more', 140);
    const href = toText(cta?.href, '#', 900);
    const variant = toText(cta?.variant, 'secondary', 32).toLowerCase() === 'primary' ? 'primary' : 'secondary';
    const size = toText(cta?.size, 'sm', 16).toLowerCase() === 'md' ? 'md' : 'sm';

    const anchor = create('a', `dx-button-element dx-button-size--${size} dx-button-element--${variant} dx-dexdrones-cta`, label);
    anchor.href = href;
    if (isExternalHref(href) && !href.startsWith('mailto:')) {
      anchor.target = '_blank';
      anchor.rel = 'noreferrer noopener';
    }
    return anchor;
  }

  async function loadData(dataUrl) {
    try {
      const response = await fetch(dataUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const json = await response.json();
      if (!json || typeof json !== 'object') return null;
      return json;
    } catch {
      return null;
    }
  }

  function renderCopyLines(parent, lines) {
    if (!Array.isArray(lines)) return;
    lines.forEach((line) => {
      const text = toText(line, '', 900);
      if (!text) return;
      parent.appendChild(create('p', 'dx-dexdrones-copy', text));
    });
  }

  function renderCtas(parent, items = []) {
    if (!Array.isArray(items) || !items.length) return;
    const row = create('div', 'dx-dexdrones-cta-row');
    items.forEach((cta) => {
      row.appendChild(createButtonLink(cta));
    });
    if (row.childElementCount) parent.appendChild(row);
  }

  function buildSectionShell(id, kicker, title) {
    const section = create('section', 'dx-dexdrones-surface dx-dexdrones-section dx-dexdrones-reveal');
    section.id = id;
    if (kicker) section.appendChild(create('p', 'dx-dexdrones-kicker', toText(kicker, '', 140)));
    if (title) {
      const heading = create('h2', 'dx-dexdrones-title', toHeadingText(title, '', 300));
      applyHeadingDuplicateExclusions(heading);
      section.appendChild(heading);
    }
    return section;
  }

  function buildSponsorCard(data = {}, className = '') {
    const card = create('div', `dx-dexdrones-sponsor ${className}`.trim());
    card.setAttribute('data-dx-hover-variant', 'magnetic');
    card.appendChild(create('p', 'dx-dexdrones-sponsor-label', toText(data.label, 'Founding Sponsor', 120)));
    card.appendChild(create('p', 'dx-dexdrones-sponsor-name', toText(data.name, '', 120)));
    const sponsorLogoSrc = toText(data.logoSrc, '', 900);
    if (sponsorLogoSrc) {
      const logo = create('img', 'dx-dexdrones-sponsor-logo');
      logo.src = sponsorLogoSrc;
      logo.alt = toText(data.logoAlt || data.name, 'Sponsor logo', 180);
      logo.loading = 'lazy';
      logo.decoding = 'async';
      card.appendChild(logo);
    }
    return card;
  }

  function buildHero(data = {}) {
    const section = create('section', 'dx-dexdrones-surface dx-dexdrones-section dx-dexdrones-reveal dx-dexdrones-hero dx-dexdrones-home-hero');
    section.id = 'dexdrones-hero';

    const mast = create('div', 'dx-dexdrones-hero-mast');
    const launchTag = toText(data.launchTag, toText(data.kicker, '', 140), 140);
    if (launchTag) mast.appendChild(create('p', 'dx-dexdrones-kicker dx-dexdrones-launch-tag', launchTag));

    const dateStamp = toText(data.dateStamp, '', 20);
    const launchDate = toText(data.launchDate, '', 100);
    const stampText = dateStamp || (launchDate ? launchDate : '');
    if (stampText) mast.appendChild(create('p', 'dx-dexdrones-date-stamp', stampText));

    if (mast.childElementCount) section.appendChild(mast);

    const layout = create('div', 'dx-dexdrones-hero-layout dx-dexdrones-launch-plate');
    const heroBody = create('div', 'dx-dexdrones-hero-body');
    const sponsor = data.sponsor && typeof data.sponsor === 'object' ? data.sponsor : {};

    const lead = toText(data.identifier, '', 240);
    if (lead) heroBody.appendChild(create('p', 'dx-dexdrones-identifier', lead));

    const title = toHeadingText(data.title, '', 300);
    if (title) {
      const heading = create('h1', 'dx-dexdrones-home-title', title);
      applyHeadingDuplicateExclusions(heading);
      heroBody.appendChild(heading);
    }

    const subhead = toText(data.subhead, '', 460);
    if (subhead) heroBody.appendChild(create('p', 'dx-dexdrones-copy dx-dexdrones-hero-subhead', subhead));

    const sponsorLabel = toText(sponsor.label, 'Founding Sponsor', 120);
    const sponsorName = toText(sponsor.name, '', 120);
    if (sponsorName) {
      heroBody.appendChild(create('p', 'dx-dexdrones-copy dx-dexdrones-sponsor-inline', `${sponsorLabel}: ${sponsorName}`));
    }

    renderCtas(heroBody, data.ctas || []);

    const markWrap = create('div', 'dx-dexdrones-mark-wrap dx-dexdrones-brand-plate');
    const markSrc = toText(data.markSrc, '', 900);
    if (markSrc) {
      const mark = create('img', 'dx-dexdrones-mark');
      mark.src = markSrc;
      mark.alt = toText(data.markAlt, 'dexDRONES mark', 160);
      mark.loading = 'eager';
      mark.decoding = 'async';
      markWrap.appendChild(mark);
    }

    if (sponsorName) markWrap.appendChild(buildSponsorCard(sponsor, 'dx-dexdrones-sponsor--plate'));

    layout.append(heroBody, markWrap);
    section.appendChild(layout);

    const proofChips = Array.isArray(data.proofChips) ? data.proofChips : [];
    if (proofChips.length) {
      const chipRow = create('div', 'dx-dexdrones-hero-proof');
      proofChips.forEach((item) => {
        const value = toText(item?.value, '', 120);
        const label = toText(item?.label, '', 160);
        if (!value || !label) return;
        const chip = create('article', 'dx-dexdrones-hero-chip');
        chip.setAttribute('data-dx-hover-variant', 'magnetic');
        chip.appendChild(create('p', 'dx-dexdrones-hero-chip-value', value));
        chip.appendChild(create('p', 'dx-dexdrones-hero-chip-label', label));
        chipRow.appendChild(chip);
      });
      if (chipRow.childElementCount) section.appendChild(chipRow);
    }

    return section;
  }

  function buildProof(data = {}) {
    const section = buildSectionShell('dexdrones-proof', data.kicker, data.title);
    section.classList.add('dx-dexdrones-proof');

    const metrics = Array.isArray(data.metrics) ? data.metrics : [];
    const grid = create('div', 'dx-dexdrones-metric-grid');

    metrics.forEach((metric) => {
      const value = toText(metric?.value, '', 160);
      const label = toText(metric?.label, '', 180);
      if (!value || !label) return;
      const card = create('article', 'dx-dexdrones-metric');
      card.setAttribute('data-dx-hover-variant', 'magnetic');
      card.appendChild(create('p', 'dx-dexdrones-metric-value', value));
      card.appendChild(create('p', 'dx-dexdrones-metric-label', label));
      grid.appendChild(card);
    });

    if (grid.childElementCount) section.appendChild(grid);
    return section;
  }

  function buildCardsSection(id, data = {}, className = '') {
    const section = buildSectionShell(id, data.kicker, data.title);
    if (className) section.classList.add(className);

    renderCopyLines(section, data.copy || []);

    const cards = Array.isArray(data.cards) ? data.cards : [];
    if (cards.length) {
      const grid = create('div', 'dx-dexdrones-card-grid');
      cards.forEach((item) => {
        const card = create('article', 'dx-dexdrones-card');
        card.setAttribute('data-dx-hover-variant', 'magnetic');
        const badge = toText(item?.status, '', 120);
        if (badge) card.appendChild(create('p', 'dx-dexdrones-card-badge', badge));
        card.appendChild(create('h3', 'dx-dexdrones-card-title', toHeadingText(item?.title, '', 220)));
        card.appendChild(create('p', 'dx-dexdrones-card-copy', toText(item?.body, '', 520)));
        grid.appendChild(card);
      });
      section.appendChild(grid);
    }

    const bullets = Array.isArray(data.bullets) ? data.bullets : [];
    if (bullets.length) {
      const list = create('ul', 'dx-dexdrones-list');
      bullets.forEach((item) => {
        const text = toText(item, '', 340);
        if (!text) return;
        list.appendChild(create('li', 'dx-dexdrones-list-item', text));
      });
      if (list.childElementCount) section.appendChild(list);
    }

    renderCtas(section, data.ctas || []);
    return section;
  }

  function buildQuotes(data = {}) {
    const section = buildSectionShell('dexdrones-quotes', data.kicker, data.title);
    section.classList.add('dx-dexdrones-quotes');

    const items = Array.isArray(data.items) ? data.items : [];
    const grid = create('div', 'dx-dexdrones-quote-grid');

    items.forEach((item) => {
      const quote = toText(item?.quote, '', 900);
      const author = toText(item?.author, '', 180);
      if (!quote || !author) return;
      const card = create('article', 'dx-dexdrones-quote');
      card.setAttribute('data-dx-hover-variant', 'magnetic');
      card.appendChild(create('p', 'dx-dexdrones-quote-text', `“${quote}”`));
      const byline = create('p', 'dx-dexdrones-quote-author', author);
      const role = toText(item?.role, '', 200);
      if (role) {
        const roleSpan = create('span', 'dx-dexdrones-quote-role', role);
        byline.appendChild(document.createTextNode(' — '));
        byline.appendChild(roleSpan);
      }
      card.appendChild(byline);
      grid.appendChild(card);
    });

    if (grid.childElementCount) section.appendChild(grid);
    return section;
  }

  function buildPress(data = {}) {
    const section = buildSectionShell('dexdrones-press', data.kicker, data.title);
    renderCopyLines(section, data.copy || []);

    const materials = Array.isArray(data.materials) ? data.materials : [];
    if (materials.length) {
      const list = create('ul', 'dx-dexdrones-press-list');
      materials.forEach((item) => {
        const href = toText(item?.href, '', 900);
        const label = toText(item?.label, '', 220);
        if (!href || !label) return;
        const li = create('li', 'dx-dexdrones-press-item');
        li.setAttribute('data-dx-hover-variant', 'magnetic');
        const link = create('a', 'dx-dexdrones-press-link', label);
        link.href = href;
        if (isExternalHref(href) && !href.startsWith('mailto:')) {
          link.target = '_blank';
          link.rel = 'noreferrer noopener';
        }
        li.appendChild(link);
        const meta = toText(item?.meta, '', 260);
        if (meta) li.appendChild(create('p', 'dx-dexdrones-press-meta', meta));
        list.appendChild(li);
      });
      if (list.childElementCount) section.appendChild(list);
    }

    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    if (contacts.length) {
      const grid = create('div', 'dx-dexdrones-contact-grid');
      contacts.forEach((contact) => {
        const card = create('article', 'dx-dexdrones-contact');
        card.setAttribute('data-dx-hover-variant', 'magnetic');
        card.appendChild(create('p', 'dx-dexdrones-contact-label', toText(contact?.label, '', 120)));
        const href = toText(contact?.href, '', 900);
        const value = toText(contact?.value, '', 220);
        if (href && value) {
          const link = create('a', 'dx-dexdrones-contact-link', value);
          link.href = href;
          if (isExternalHref(href) && !href.startsWith('mailto:')) {
            link.target = '_blank';
            link.rel = 'noreferrer noopener';
          }
          card.appendChild(link);
        } else if (value) {
          card.appendChild(create('p', 'dx-dexdrones-contact-value', value));
        }
        grid.appendChild(card);
      });
      if (grid.childElementCount) section.appendChild(grid);
    }

    renderCtas(section, data.ctas || []);
    return section;
  }

  function buildProgress(steps, title) {
    const wrap = create('aside', 'dx-dexdrones-progress-wrap');
    const stack = create('div', 'dx-dexdrones-sidebar-stack');
    const nav = create('nav', 'dx-dexdrones-progress dx-dexdrones-surface');

    nav.setAttribute('aria-label', 'dexDRONES page sections');
    nav.setAttribute('data-dexdrones-progress-nav', 'true');
    nav.appendChild(create('p', 'dx-dexdrones-progress-title', toText(title, DEFAULT_NAV_TITLE, 140)));

    const list = create('ul', 'dx-dexdrones-progress-list');
    steps.forEach((step) => {
      const id = toText(step?.id, '', 120);
      if (!id) return;
      const item = create('li', 'dx-dexdrones-progress-item');
      const link = create('a', 'dx-dexdrones-progress-link', toText(step?.label, id, 160));
      link.href = `#${id}`;
      item.appendChild(link);
      list.appendChild(item);
    });

    nav.appendChild(list);
    stack.appendChild(nav);
    wrap.appendChild(stack);
    return wrap;
  }

  function wireProgressNav(root, steps) {
    const nav = root.querySelector('[data-dexdrones-progress-nav]');
    if (!nav) return;

    const links = new Map();
    nav.querySelectorAll('a[href^="#"]').forEach((link) => {
      const id = toText(link.getAttribute('href'), '', 140).replace(/^#/, '');
      if (!id) return;
      links.set(id, link);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.getElementById(id);
        if (!target) return;
        history.pushState(null, '', `#${id}`);
        target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
    });

    const activate = (id) => {
      links.forEach((link, key) => {
        if (key === id) {
          const wasActive = link.classList.contains('is-active');
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'true');
          if (!wasActive && !prefersReducedMotion()) {
            animate(link, { x: [0, 3, 0], scale: [1, 1.02, 1] }, { duration: 0.24, ease: 'easeOut' });
          }
          return;
        }
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      });
    };

    const firstId = toText(steps?.[0]?.id, '', 120);
    if (firstId) activate(firstId);

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (!visible.length) return;
      const target = visible[0].target;
      if (target instanceof HTMLElement && target.id) activate(target.id);
    }, {
      root: null,
      threshold: 0.22,
      rootMargin: '-42% 0px -42% 0px',
    });

    steps.forEach((step) => {
      const id = toText(step?.id, '', 120);
      if (!id) return;
      const target = document.getElementById(id);
      if (target) observer.observe(target);
    });
  }

  function resolveHash(value, knownIds, aliases) {
    const normalized = normalizeHash(value);
    if (!normalized) return '';
    if (knownIds.has(normalized)) return normalized;
    const mapped = normalizeHash(aliases[normalized]);
    return mapped && knownIds.has(mapped) ? mapped : '';
  }

  function wireHashCompatibility(steps, aliases) {
    const knownIds = new Set(
      (Array.isArray(steps) ? steps : [])
        .map((step) => normalizeHash(step?.id))
        .filter(Boolean),
    );

    const applyHash = (shouldScroll) => {
      const resolved = resolveHash(window.location.hash, knownIds, aliases);
      if (!resolved) return;
      const canonical = `#${resolved}`;
      if (window.location.hash !== canonical) {
        window.history.replaceState(null, '', canonical);
      }
      if (!shouldScroll) return;
      const section = document.getElementById(resolved);
      if (section) {
        section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    };

    window.addEventListener('hashchange', () => {
      applyHash(true);
    }, { passive: true });

    if (window.location.hash) {
      window.setTimeout(() => applyHash(true), 0);
    }
  }

  function renderApp(root, data, config) {
    clearNode(root);

    const steps = Array.isArray(data.steps) && data.steps.length ? data.steps : DEFAULT_STEPS;
    const aliases = mergeAliases(config.hashAliases, data.hashAliases);

    const editorial = create('section', 'dx-dexdrones-editorial');
    const hero = buildHero(data.hero || {});
    const shell = create('div', 'dx-dexdrones-shell');
    const column = create('div', 'dx-dexdrones-column');

    shell.appendChild(buildProgress(steps, config.sectionNavTitle));

    column.appendChild(buildProof(data.proof || {}));
    column.appendChild(buildCardsSection('dexdrones-why', data.whyExists || {}));
    column.appendChild(buildCardsSection('dexdrones-publishes', data.publishes || {}));
    column.appendChild(buildCardsSection('dexdrones-underway', data.underway || {}, 'dx-dexdrones-underway'));
    column.appendChild(buildCardsSection('dexdrones-kolari', data.kolari || {}));
    column.appendChild(buildCardsSection('dexdrones-partners', data.whyPartners || {}));
    column.appendChild(buildCardsSection('dexdrones-participate', data.participate || {}));
    column.appendChild(buildQuotes(data.quotes || {}));
    column.appendChild(buildCardsSection('dexdrones-support', data.support || {}));
    column.appendChild(buildPress(data.press || {}));
    column.appendChild(buildCardsSection('dexdrones-about', data.aboutDex || {}));

    shell.appendChild(column);
    editorial.appendChild(hero);
    editorial.appendChild(shell);
    root.appendChild(editorial);

    wireProgressNav(root, steps);
    wireHashCompatibility(steps, aliases);

    if (config.enableReveal) {
      revealStagger(root, '.dx-dexdrones-reveal', {
        key: 'dx-dexdrones-reveal',
        y: 16,
        duration: 0.34,
        stagger: 0.03,
        threshold: 0.14,
        rootMargin: '0px 0px -8% 0px',
      });
    }

    bindDexButtonMotion(root, {
      selector: '.dx-button-element, .dx-dexdrones-cta, .dx-dexdrones-progress-link',
    });
    bindSidebarMotion(root);
  }

  function renderFallback(root) {
    clearNode(root);
    const section = buildSectionShell('dexdrones-hero', 'DEXDRONES', 'dexDRONES content is temporarily unavailable.');
    section.appendChild(create('p', 'dx-dexdrones-copy', 'Please refresh the page, or contact info@dexdsl.org while we restore this section.'));
    section.appendChild(createButtonLink({ label: 'Contact dex', href: 'mailto:info@dexdsl.org', variant: 'primary' }));
    root.appendChild(section);
  }

  async function boot() {
    const root = document.querySelector(APP_SELECTOR);
    if (!(root instanceof HTMLElement)) return;

    document.documentElement.setAttribute('data-dx-route', 'dexdrones');
    if (document.body) document.body.setAttribute('data-dx-route', 'dexdrones');

    const config = parseConfig();
    const data = await loadData(config.dataUrl);
    if (!data) {
      renderFallback(root);
      return;
    }

    renderApp(root, data, config);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
