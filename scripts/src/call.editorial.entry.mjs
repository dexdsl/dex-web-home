import { animate } from 'framer-motion/dom';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxCallEditorialLoaded) return;
  window.__dxCallEditorialLoaded = true;

  const APP_SELECTOR = '[data-call-editorial-app]';
  const DATA_URL = '/data/call.data.json';
  const SECTION_STEPS = [
    ['call-hero', 'PROGRAM BRIEF'],
    ['call-status', 'CURRENT STATUS'],
    ['call-lanes', 'LANE MODULES'],
    ['call-active', 'ACTIVE CALL MODULE'],
    ['call-mini', 'MINI-DEX MODULE'],
    ['call-requireements', 'REQUIREMENT CHECKLIST'],
    ['call-past', 'PAST CALL LOG'],
    ['call-newsletter', 'NEWSLETTER LOOP'],
  ];

  let blobRaf = 0;
  let blobResizeHandler = null;

  function text(value) {
    return String(value ?? '');
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

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  }

  function ensureGooeyMesh() {
    let wrapper = document.getElementById('gooey-mesh-wrapper');
    if (wrapper) return wrapper;

    wrapper = document.createElement('div');
    wrapper.id = 'gooey-mesh-wrapper';

    const stage = create('div', 'gooey-stage');
    const blobStyles = [
      '--d:36vmax;--g1a:#ff5f6d;--g1b:#ffc371;--g2a:#47c9e5;--g2b:#845ef7',
      '--d:32vmax;--g1a:#7F00FF;--g1b:#E100FF;--g2a:#00DBDE;--g2b:#FC00FF',
      '--d:33vmax;--g1a:#FFD452;--g1b:#FFB347;--g2a:#FF8456;--g2b:#FF5E62',
      '--d:37vmax;--g1a:#13F1FC;--g1b:#0470DC;--g2a:#A1FFCE;--g2b:#FAFFD1',
      '--d:27vmax;--g1a:#F9516D;--g1b:#FF9A44;--g2a:#FA8BFF;--g2b:#6F7BF7',
    ];

    blobStyles.forEach((styleValue) => {
      const blob = create('div', 'gooey-blob');
      blob.setAttribute('style', styleValue);
      stage.appendChild(blob);
    });
    wrapper.appendChild(stage);

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('id', 'goo-filter');
    svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(svgNs, 'defs');
    const filter = document.createElementNS(svgNs, 'filter');
    filter.setAttribute('id', 'goo');
    const blur = document.createElementNS(svgNs, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '15');
    blur.setAttribute('result', 'blur');
    const matrix = document.createElementNS(svgNs, 'feColorMatrix');
    matrix.setAttribute('in', 'blur');
    matrix.setAttribute('mode', 'matrix');
    matrix.setAttribute('values', '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -8');
    matrix.setAttribute('result', 'goo');
    const blend = document.createElementNS(svgNs, 'feBlend');
    blend.setAttribute('in', 'SourceGraphic');
    blend.setAttribute('in2', 'goo');
    blend.setAttribute('mode', 'normal');
    filter.appendChild(blur);
    filter.appendChild(matrix);
    filter.appendChild(blend);
    defs.appendChild(filter);
    svg.appendChild(defs);
    wrapper.appendChild(svg);

    document.body.appendChild(wrapper);
    return wrapper;
  }

  function startBlobMotion() {
    const mesh = ensureGooeyMesh();
    if (!mesh || prefersReducedMotion()) return;

    const blobs = Array.from(mesh.querySelectorAll('.gooey-blob'));
    if (!blobs.length) return;

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    blobs.forEach((el) => {
      const speed = 60 + Math.random() * 60;
      const angle = Math.random() * Math.PI * 2;
      el._rad = el.offsetWidth / 2;
      el._x = w() / 2;
      el._y = h() / 2;
      el._vx = Math.cos(angle) * speed * 0.25;
      el._vy = Math.sin(angle) * speed * 0.25;
    });

    if (blobRaf) cancelAnimationFrame(blobRaf);
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      blobs.forEach((el) => {
        el._x += el._vx * dt;
        el._y += el._vy * dt;
        if (el._x - el._rad <= 0 && el._vx < 0) el._vx *= -1;
        if (el._x + el._rad >= w() && el._vx > 0) el._vx *= -1;
        if (el._y - el._rad <= 0 && el._vy < 0) el._vy *= -1;
        if (el._y + el._rad >= h() && el._vy > 0) el._vy *= -1;
        el.style.transform = `translate(${el._x}px,${el._y}px) translate(-50%,-50%)`;
      });
      blobRaf = requestAnimationFrame(tick);
    };
    blobRaf = requestAnimationFrame(tick);

    if (blobResizeHandler) window.removeEventListener('resize', blobResizeHandler);
    blobResizeHandler = () => {
      blobs.forEach((el) => {
        el._x = Math.min(Math.max(el._rad, el._x), w() - el._rad);
        el._y = Math.min(Math.max(el._rad, el._y), h() - el._rad);
      });
    };
    window.addEventListener('resize', blobResizeHandler);
  }

  function hasOpenActiveCall(active) {
    if (!active || !text(active.cycle_raw).trim()) return false;
    const raw = text(active.deadline_iso).trim();
    if (!raw) return true;
    const parsed = new Date(`${raw}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) return true;
    return parsed.getTime() >= Date.now();
  }

  function stopBlobMotion() {
    if (blobRaf) {
      cancelAnimationFrame(blobRaf);
      blobRaf = 0;
    }
    if (blobResizeHandler) {
      window.removeEventListener('resize', blobResizeHandler);
      blobResizeHandler = null;
    }
  }

  function isExternalHref(href) {
    const value = text(href).trim();
    if (!value) return false;
    if (value.startsWith('mailto:')) return true;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const url = new URL(value, window.location.origin);
        return url.origin !== window.location.origin;
      } catch {
        return true;
      }
    }
    return false;
  }

  function ctaLabel(label, href) {
    const base = text(label);
    if (isExternalHref(href)) return `${base} ↗`;
    return base;
  }

  function createLinkButton(label, href, variant = 'secondary', size = 'md') {
    const anchor = create('a', `dx-button-element dx-button-size--${size} dx-button-element--${variant} dx-call-cta`);
    anchor.href = text(href || '#');
    anchor.textContent = ctaLabel(label, href);
    return anchor;
  }

  function appendOptionalText(parent, value, className) {
    const content = text(value);
    if (!content) return;
    parent.appendChild(create('p', className, content));
  }

  function createImage(src, alt, className) {
    const value = text(src);
    if (!value) return null;
    const img = create('img', className);
    img.src = value;
    img.alt = text(alt || '');
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  }

  function computeCountdown(deadlineIso) {
    const raw = text(deadlineIso);
    if (!raw) return '';

    const parsed = new Date(`${raw}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) return '';

    const now = new Date();
    const diffMs = parsed.getTime() - now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil(diffMs / dayMs);

    if (diffDays > 0) return `D-${diffDays}`;
    if (diffDays === 0) return 'D-0';
    return 'DEADLINE PASSED';
  }

  function wireProgressNav(root) {
    const nav = root.querySelector('[data-call-progress-nav]');
    if (!nav) return;

    const links = new Map();
    nav.querySelectorAll('a[href^="#"]').forEach((link) => {
      const id = text(link.getAttribute('href')).replace(/^#/, '');
      if (!id) return;
      links.set(id, link);
    });

    const activate = (id) => {
      links.forEach((link, key) => {
        if (key === id) {
          const wasActive = link.classList.contains('is-active');
          link.classList.add('is-active');
          if (!wasActive && !prefersReducedMotion()) {
            animate(
              link,
              {
                x: [0, 3, 0],
                scale: [1, 1.02, 1],
              },
              {
                duration: 0.24,
                ease: 'easeOut',
              },
            );
          }
        } else {
          link.classList.remove('is-active');
        }
      });
    };

    const first = SECTION_STEPS[0]?.[0];
    if (first) activate(first);

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;
        const top = visible[0].target;
        if (top && top.id) activate(top.id);
      },
      {
        root: null,
        threshold: 0.22,
        rootMargin: '-42% 0px -42% 0px',
      },
    );

    SECTION_STEPS.forEach(([id]) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });
  }

  function animateSections(root) {
    if (prefersReducedMotion()) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target;
          if (node.dataset.dxCallRevealed === '1') {
            obs.unobserve(node);
            return;
          }
          node.dataset.dxCallRevealed = '1';
          animate(
            node,
            {
              opacity: [0, 1],
              transform: ['translate3d(0px, 14px, 0px)', 'translate3d(0px, 0px, 0px)'],
            },
            {
              duration: 0.34,
              ease: 'easeOut',
            },
          );
          obs.unobserve(node);
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    root.querySelectorAll('.dx-call-reveal').forEach((section) => {
      section.style.opacity = '0';
      observer.observe(section);
    });
  }

  function bindInteractiveMotion(root) {
    if (prefersReducedMotion()) return;

    const hoverDefs = [
      {
        selector: '.dx-call-cta, .dx-call-newsletter-submit',
        enter: {
          y: -2,
          scale: 1.01,
          boxShadow: '0 14px 28px rgba(20, 28, 42, 0.2)',
        },
        leave: {
          y: 0,
          scale: 1,
          boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
        },
      },
      {
        selector: '.dx-call-lane-card, .dx-call-subcall-card, .dx-call-timeline-item, .dx-call-active-rail-card, .dx-call-utility',
        enter: {
          y: -3,
          scale: 1.006,
          boxShadow: '0 16px 34px rgba(16, 22, 36, 0.22)',
        },
        leave: {
          y: 0,
          scale: 1,
          boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
        },
      },
      {
        selector: '.dx-call-progress-link',
        enter: {
          x: 2,
          scale: 1.01,
        },
        leave: {
          x: 0,
          scale: 1,
        },
      },
    ];

    hoverDefs.forEach((def) => {
      root.querySelectorAll(def.selector).forEach((node) => {
        node.addEventListener('pointerenter', () => {
          animate(node, def.enter, { duration: 0.18, ease: 'easeOut' });
        });
        node.addEventListener('pointerleave', () => {
          animate(node, def.leave, { duration: 0.22, ease: 'easeOut' });
        });
      });
    });
  }

  function buildProgress(model) {
    const active = model?.active_call || {};
    const mini = model?.mini_call || {};
    const requirements = model?.requirements || {};

    const wrap = create('aside', 'dx-call-progress-wrap');
    const stack = create('div', 'dx-call-sidebar-stack');

    const progress = create('nav', 'dx-call-progress dx-call-surface');
    progress.setAttribute('aria-label', 'Call guide sections');
    progress.setAttribute('data-call-progress-nav', 'true');

    const title = create('p', 'dx-call-progress-title', 'SCROLL STEPS');
    progress.appendChild(title);

    const list = create('ul', 'dx-call-progress-list');
    SECTION_STEPS.forEach(([id, label]) => {
      const item = create('li', 'dx-call-progress-item');
      const link = create('a', 'dx-call-progress-link', label);
      link.href = `#${id}`;
      item.appendChild(link);
      list.appendChild(item);
    });

    progress.appendChild(list);
    stack.appendChild(progress);

    if (hasOpenActiveCall(active)) {
      const utility = create('section', 'dx-call-utility dx-call-surface');
      utility.appendChild(create('p', 'dx-call-progress-title', 'OPEN CALL STATUS'));
      if (active.cycle_raw) utility.appendChild(create('p', 'dx-call-utility-cycle', text(active.cycle_raw)));

      const chips = create('div', 'dx-call-sidebar-chips');
      if (active.deadline_label_raw) chips.appendChild(create('span', 'dx-call-chip', text(active.deadline_label_raw)));
      if (active.notification_label_raw) chips.appendChild(create('span', 'dx-call-chip', text(active.notification_label_raw)));
      const countdown = computeCountdown(active.deadline_iso);
      if (countdown) chips.appendChild(create('span', 'dx-call-chip dx-call-chip--accent', countdown));
      if (chips.childNodes.length > 0) utility.appendChild(chips);

      const actions = create('div', 'dx-call-sidebar-actions');
      if (active.submit_cta?.href) {
        actions.appendChild(createLinkButton(active.submit_cta.label_raw, active.submit_cta.href, 'primary', 'sm'));
      }
      if (mini.submit_cta?.href) {
        actions.appendChild(createLinkButton(mini.submit_cta.label_raw, mini.submit_cta.href, 'secondary', 'sm'));
      }
      if (requirements.contact_link?.href) {
        actions.appendChild(createLinkButton(requirements.contact_link.label_raw, requirements.contact_link.href, 'secondary', 'sm'));
      }
      if (actions.childNodes.length > 0) utility.appendChild(actions);

      stack.appendChild(utility);
    }

    wrap.appendChild(stack);
    return wrap;
  }

  function buildHero(model) {
    const heroData = model?.hero || {};
    const section = create('section', 'dx-call-surface dx-call-hero dx-call-reveal');
    section.id = 'call-hero';

    section.appendChild(create('p', 'dx-call-kicker', 'IN DEX PROGRAM BRIEF'));
    section.appendChild(create('h1', 'dx-call-title', text(heroData.heading_raw || 'in dex series')));
    appendOptionalText(section, heroData.subtitle_raw, 'dx-call-subtitle');
    appendOptionalText(section, heroData.credit_raw, 'dx-call-credit');
    appendOptionalText(section, heroData.framing_raw, 'dx-call-copy');
    appendOptionalText(section, heroData.categories_intro_raw, 'dx-call-copy');

    const media = createImage(heroData.image_src, heroData.heading_raw || '', 'dx-call-hero-image');
    if (media) {
      const mediaWrap = create('div', 'dx-call-hero-media');
      mediaWrap.appendChild(media);
      section.appendChild(mediaWrap);
    }

    return section;
  }

  function buildStatus(model) {
    const active = model?.active_call || {};
    const section = create('section', 'dx-call-surface dx-call-status dx-call-reveal');
    section.id = 'call-status';

    section.appendChild(create('p', 'dx-call-kicker', 'CURRENT STATUS'));
    section.appendChild(create('h2', 'dx-call-section-title', text(active.status_label_raw || 'ACTIVE CALL:')));

    const cycle = create('p', 'dx-call-cycle', text(active.cycle_raw || ''));
    section.appendChild(cycle);

    if (active.title_raw) {
      section.appendChild(create('p', 'dx-call-title-line', text(active.title_raw)));
    }

    const chips = create('div', 'dx-call-chip-row');
    if (active.deadline_label_raw) chips.appendChild(create('span', 'dx-call-chip', text(active.deadline_label_raw)));
    if (active.notification_label_raw) chips.appendChild(create('span', 'dx-call-chip', text(active.notification_label_raw)));

    const countdown = computeCountdown(active.deadline_iso);
    if (countdown) {
      chips.appendChild(create('span', 'dx-call-chip dx-call-chip--accent', countdown));
    }

    section.appendChild(chips);
    appendOptionalText(section, active.structure_raw, 'dx-call-copy');
    appendOptionalText(section, active.summary_raw, 'dx-call-copy');

    if (active.submit_cta?.href) {
      section.appendChild(createLinkButton(active.submit_cta.label_raw, active.submit_cta.href, 'primary', 'md'));
    }

    return section;
  }

  function buildLanes(model) {
    const section = create('section', 'dx-call-surface dx-call-lanes dx-call-reveal');
    section.id = 'call-lanes';

    section.appendChild(create('p', 'dx-call-kicker', 'LANE MODULES'));

    const list = create('div', 'dx-call-lane-grid');
    (model?.lanes || []).forEach((lane) => {
      const card = create('article', 'dx-call-lane-card');
      card.appendChild(create('h3', 'dx-call-lane-title', text(lane.code_raw || '')));
      appendOptionalText(card, lane.body_raw, 'dx-call-copy');
      list.appendChild(card);
    });

    section.appendChild(list);
    return section;
  }

  function buildActive(model) {
    const active = model?.active_call || {};
    const section = create('section', 'dx-call-surface dx-call-active dx-call-reveal');
    section.id = 'call-active';

    section.appendChild(create('p', 'dx-call-kicker', 'ACTIVE CALL MODULE'));
    section.appendChild(create('h2', 'dx-call-section-title', text(active.cycle_raw || '')));

    const layout = create('div', 'dx-call-active-layout');

    const content = create('div', 'dx-call-active-content');
    if (active.subcalls_image_src) {
      const media = createImage(active.subcalls_image_src, active.cycle_raw || '', 'dx-call-active-image');
      if (media) {
        const mediaWrap = create('div', 'dx-call-active-media');
        mediaWrap.appendChild(media);
        content.appendChild(mediaWrap);
      }
    }

    const subcallList = create('div', 'dx-call-subcall-list');
    (active.subcalls || []).forEach((subcall) => {
      const card = create('article', 'dx-call-subcall-card');
      card.appendChild(create('h3', 'dx-call-subcall-title', text(subcall.heading_raw || '')));
      (subcall.body_raw || []).forEach((line) => appendOptionalText(card, line, 'dx-call-copy'));
      subcallList.appendChild(card);
    });
    content.appendChild(subcallList);

    layout.appendChild(content);

    const rail = create('aside', 'dx-call-active-rail');
    const railCard = create('div', 'dx-call-active-rail-card');
    railCard.appendChild(create('p', 'dx-call-rail-title', 'RELATTED LINKS'));

    if (active.submit_cta?.href) {
      railCard.appendChild(createLinkButton(active.submit_cta.label_raw, active.submit_cta.href, 'primary', 'md'));
    }

    (active.related_links || []).forEach((link) => {
      railCard.appendChild(createLinkButton(link.label_raw, link.href, 'secondary', 'md'));
    });

    appendOptionalText(railCard, active.related_note_raw, 'dx-call-rail-note');
    rail.appendChild(railCard);
    layout.appendChild(rail);

    section.appendChild(layout);
    return section;
  }

  function buildMini(model) {
    const mini = model?.mini_call || {};
    const section = create('section', 'dx-call-surface dx-call-mini dx-call-reveal');
    section.id = 'call-mini';

    section.appendChild(create('p', 'dx-call-kicker', 'MINI-DEX MODULE'));
    section.appendChild(create('h2', 'dx-call-section-title', text(mini.status_label_raw || 'ACTIVEE CAL‏‏‎‎L:')));
    section.appendChild(create('h3', 'dx-call-cycle', text(mini.cycle_raw || '')));

    const body = create('div', 'dx-call-mini-body');
    (mini.body_raw || []).forEach((line) => appendOptionalText(body, line, 'dx-call-copy'));
    section.appendChild(body);

    if (mini.image_src) {
      const media = createImage(mini.image_src, mini.cycle_raw || '', 'dx-call-mini-image');
      if (media) {
        const mediaWrap = create('div', 'dx-call-mini-media');
        mediaWrap.appendChild(media);
        section.appendChild(mediaWrap);
      }
    }

    if (mini.submit_cta?.href) {
      section.appendChild(createLinkButton(mini.submit_cta.label_raw, mini.submit_cta.href, 'primary', 'md'));
    }

    return section;
  }

  function buildRequirements(model) {
    const requirements = model?.requirements || {};
    const section = create('section', 'dx-call-surface dx-call-requireements dx-call-reveal');
    section.id = 'call-requireements';

    section.appendChild(create('p', 'dx-call-kicker', 'REQUIREMENT CHECKLIST'));
    section.appendChild(create('h2', 'dx-call-section-title', text(requirements.heading_raw || '')));

    const list = create('ul', 'dx-call-requireements-list');
    (requirements.items_raw || []).forEach((itemText) => {
      const item = create('li', 'dx-call-requireements-item');

      if (itemText.includes('more information') && requirements.cc_link?.href) {
        const before = itemText.replace('here', '').replace('  ', ' ').trim();
        const prefix = create('span', 'dx-call-copy', before.length ? `${before} ` : '');
        item.appendChild(prefix);
        const link = create('a', 'dx-call-inline-link', ctaLabel(requirements.cc_link.label_raw || 'here', requirements.cc_link.href));
        link.href = requirements.cc_link.href;
        item.appendChild(link);
      } else {
        item.appendChild(create('span', 'dx-call-copy', itemText));
      }

      list.appendChild(item);
    });

    section.appendChild(list);

    if (requirements.contact_link?.href) {
      const contact = create('p', 'dx-call-copy');
      const emailLabel = text(requirements.contact_link.label_raw || '');
      const contactPrefix = text(requirements.contact_raw || '').replace(emailLabel, '').trim();
      if (contactPrefix) contact.append(`${contactPrefix} `);
      const email = create('a', 'dx-call-inline-link', ctaLabel(requirements.contact_link.label_raw, requirements.contact_link.href));
      email.href = requirements.contact_link.href;
      contact.appendChild(email);
      section.appendChild(contact);
    }

    return section;
  }

  function buildPast(model) {
    const past = model?.past_calls || {};
    const section = create('section', 'dx-call-surface dx-call-past dx-call-reveal');
    section.id = 'call-past';

    section.appendChild(create('p', 'dx-call-kicker', 'PAST CALL LOG'));

    const heading = create('h2', 'dx-call-section-title');
    const headingText = (past.heading_lines_raw || []).filter(Boolean).join(' ');
    heading.textContent = headingText;
    section.appendChild(heading);

    const timeline = create('div', 'dx-call-timeline');
    (past.entries || []).forEach((entry) => {
      const item = create('article', 'dx-call-timeline-item');
      item.appendChild(create('h3', 'dx-call-timeline-title', text(entry.cycle_raw || '')));
      appendOptionalText(item, entry.prompt_raw, 'dx-call-copy');
      appendOptionalText(item, entry.outcome_raw, 'dx-call-copy');
      appendOptionalText(item, entry.date_raw, 'dx-call-date');
      timeline.appendChild(item);
    });

    if (past.image_src) {
      const image = createImage(past.image_src, headingText, 'dx-call-past-image');
      if (image) {
        const media = create('div', 'dx-call-past-media');
        media.appendChild(image);
        timeline.appendChild(media);
      }
    }

    if (past.spotlight_link?.href) {
      timeline.appendChild(createLinkButton(past.spotlight_link.label_raw, past.spotlight_link.href, 'secondary', 'sm'));
    }

    section.appendChild(timeline);
    return section;
  }

  function buildNewsletter(model) {
    const data = model?.newsletter || {};
    const section = create('section', 'dx-call-surface dx-call-newsletter dx-call-reveal');
    section.id = 'call-newsletter';

    section.appendChild(create('p', 'dx-call-kicker', 'NEWSLETTER LOOP'));
    appendOptionalText(section, data.prompt_raw, 'dx-call-section-title');

    const form = create('form', 'dx-call-newsletter-form');
    form.setAttribute('novalidate', 'novalidate');

    const input = create('input', 'dx-call-newsletter-input');
    input.type = 'email';
    input.required = true;
    input.autocomplete = 'email';
    input.placeholder = 'EMAIL ADDRESS';
    input.name = 'email';

    const button = create('button', 'dx-button-element dx-button-size--md dx-button-element--secondary dx-call-newsletter-submit', 'JOIN');
    button.type = 'submit';

    const feedback = create('p', 'dx-call-newsletter-feedback');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const emailValue = text(input.value).trim();
      if (!emailValue || !/^\S+@\S+\.\S+$/.test(emailValue)) {
        feedback.textContent = 'ENTER A VALID EMAIL ADDRESS.';
        return;
      }

      const mailto = `mailto:info@dexdsl.com?subject=${encodeURIComponent('NEWSLETTER JOIN REQUEST')}&body=${encodeURIComponent(`Please add ${emailValue} to the dex newsletter list.`)}`;
      window.location.href = mailto;
      feedback.textContent = 'OPENING EMAIL APP...';
    });

    form.append(input, button);
    section.append(form, feedback);

    if (data.privacy_link?.href) {
      const privacy = create('p', 'dx-call-copy');
      const link = create('a', 'dx-call-inline-link', ctaLabel(data.privacy_link.label_raw, data.privacy_link.href));
      link.href = data.privacy_link.href;
      privacy.appendChild(link);
      section.appendChild(privacy);
    }

    appendOptionalText(section, data.thanks_raw, 'dx-call-thanks');
    return section;
  }

  function render(model) {
    const root = document.querySelector(APP_SELECTOR);
    if (!root) return;

    clearNode(root);

    const shell = create('div', 'dx-call-shell');
    const column = create('div', 'dx-call-column');

    column.appendChild(buildHero(model));
    column.appendChild(buildStatus(model));
    column.appendChild(buildLanes(model));
    column.appendChild(buildActive(model));
    column.appendChild(buildMini(model));
    column.appendChild(buildRequirements(model));
    column.appendChild(buildPast(model));
    column.appendChild(buildNewsletter(model));

    shell.appendChild(buildProgress(model));
    shell.appendChild(column);
    root.appendChild(shell);

    wireProgressNav(root);
    animateSections(root);
    bindInteractiveMotion(root);
    startBlobMotion();
  }

  function renderError(error) {
    const root = document.querySelector(APP_SELECTOR);
    if (!root) return;

    clearNode(root);
    const pane = create('section', 'dx-call-surface dx-call-error');
    pane.appendChild(create('h2', 'dx-call-title', 'CALL PAGE FAILED TO LOAD'));
    pane.appendChild(create('p', 'dx-call-copy', text(error?.message || 'Unknown error')));
    root.appendChild(pane);
  }

  async function loadJson(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return await response.json();
  }

  async function boot() {
    try {
      const model = await loadJson(DATA_URL);
      render(model);
    } catch (error) {
      renderError(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
