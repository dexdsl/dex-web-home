(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxAboutRouteLoaded) return;
  window.__dxAboutRouteLoaded = true;

  // Route boot flags: lock /about and disable global scroll-dot.
  document.documentElement.setAttribute('data-dx-route', 'about');
  document.documentElement.setAttribute('data-no-dex-scroll', '');
  if (document.body) {
    document.body.setAttribute('data-dx-route', 'about');
  }

  function initAboutRoute() {
    const root = document.getElementById('dex-about');
    if (!root) return;
    document.documentElement.setAttribute('data-dx-route', 'about');
    if (document.body) {
      document.body.setAttribute('data-dx-route', 'about');
    }

    const $ = (selector, scope = document) => scope.querySelector(selector);
    const tabs = [...document.querySelectorAll('#dex-about .pill')];
    const panes = {
      mission: $('#pane-mission'),
      work: $('#pane-work'),
      impact: $('#pane-impact'),
      team: $('#pane-team'),
      partners: $('#pane-partners'),
      press: $('#pane-press'),
      contact: $('#pane-contact'),
      license: $('#pane-license'),
    };
    const order = Object.keys(panes);
    let current = 'mission';
    const frameWidthExpr = 'var(--dx-header-frame-width-vw, min(calc(100vw - clamp(16px, 3vw, 40px)), 1380px))';
    const setImportant = (node, property, value) => {
      if (!node) return;
      node.style.setProperty(property, value, 'important');
    };

    function enforceFrameWidth() {
      const codeContainer = root.parentElement;
      const blockContent = codeContainer?.parentElement || null;
      const block = blockContent?.parentElement || null;
      const feBlock = block?.closest?.('.fe-block') || null;
      const fluidEngine = block?.closest?.('.fluid-engine') || null;
      const content = fluidEngine?.closest?.('.content') || null;

      if (fluidEngine) {
        setImportant(fluidEngine, 'width', frameWidthExpr);
        setImportant(fluidEngine, 'max-width', frameWidthExpr);
        setImportant(fluidEngine, 'margin-left', 'auto');
        setImportant(fluidEngine, 'margin-right', 'auto');
        setImportant(fluidEngine, 'overflow-x', 'visible');
        setImportant(fluidEngine, 'overflow-y', 'visible');
      }
      if (feBlock) {
        setImportant(feBlock, 'grid-column', '1 / -1');
        setImportant(feBlock, 'width', '100%');
        setImportant(feBlock, 'max-width', 'none');
        setImportant(feBlock, 'overflow-x', 'visible');
        setImportant(feBlock, 'overflow-y', 'visible');
      }
      if (block) {
        setImportant(block, 'width', '100%');
        setImportant(block, 'max-width', 'none');
        setImportant(block, 'margin-left', '0');
        setImportant(block, 'margin-right', '0');
        setImportant(block, 'justify-self', 'stretch');
        setImportant(block, 'box-sizing', 'border-box');
      }
      [blockContent, codeContainer].forEach((node) => {
        if (!node) return;
        setImportant(node, 'width', '100%');
        setImportant(node, 'max-width', 'none');
        setImportant(node, 'margin', '0');
        setImportant(node, 'padding-left', '0');
        setImportant(node, 'padding-right', '0');
        setImportant(node, 'box-sizing', 'border-box');
      });
      if (content) {
        setImportant(content, 'width', frameWidthExpr);
        setImportant(content, 'max-width', frameWidthExpr);
        setImportant(content, 'margin-left', 'auto');
        setImportant(content, 'margin-right', 'auto');
      }
    }

    function selectTab(name) {
      tabs.forEach((button) => {
        button.setAttribute('aria-selected', button.dataset.pane === name ? 'true' : 'false');
      });
    }

    function showPane(name, push = true) {
      if (!panes[name] || name === current) return;
      [panes[current], panes[name]].forEach((pane) => pane?.getAnimations?.().forEach((animation) => animation.cancel()));
      panes[current].setAttribute('aria-hidden', 'true');
      panes[name].setAttribute('aria-hidden', 'false');
      selectTab(name);
      current = name;
      if (push) history.replaceState(null, '', `#${name}`);
    }

    tabs.forEach((button) => {
      button.addEventListener('click', () => showPane(button.dataset.pane));
    });

    const prev = $('#aboutPrev');
    const next = $('#aboutNext');
    function step(direction) {
      const i = order.indexOf(current);
      const j = (i + (direction < 0 ? -1 : 1) + order.length) % order.length;
      showPane(order[j]);
    }
    prev?.addEventListener('click', () => step(-1));
    next?.addEventListener('click', () => step(1));

    document.querySelectorAll('#dex-about [data-goto]').forEach((anchor) => {
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        showPane(anchor.getAttribute('data-goto'));
      });
    });

    const valid = new Set(order.map((key) => `#${key}`));
    function route() {
      const hash = location.hash || '#mission';
      showPane(valid.has(hash) ? hash.slice(1) : 'mission', false);
    }

    window.addEventListener('hashchange', route, { passive: true });
    route();

    const TEAM_BIOS = {
      ssuarez: 'S. Suarez-Solis leads Dex’s strategy and partnerships, aligning programs with a commons-forward mission and building durable collaborations across arts, education, and civic orgs.',
      cchurch: 'C. Church directs Dex’s cinematic capture and editorial pipeline, designing session formats that travel to editorial and classroom use while training capture teams.',
      tjordan: 'T. Jordan stewards Creative Commons practice across Dex, implementing CC BY 4.0 in releases and agreements and authoring plain-language guidance for legal reuse.',
    };

    const teamModal = document.getElementById('teamModal');
    const modalTitle = document.getElementById('teamModalTitle');
    const modalBody = document.getElementById('teamModalBody');

    function openBio(slug) {
      const card = document.querySelector(`#pane-team .member[data-slug="${slug}"]`);
      if (!card || !teamModal || !modalTitle || !modalBody) return;
      if (current !== 'team') showPane('team');
      modalTitle.textContent = card.querySelector('.name')?.textContent || 'Bio';
      modalBody.textContent = TEAM_BIOS[slug] || '—';
      teamModal.hidden = false;
      teamModal.querySelector('.dex-modal-content')?.focus();
    }

    function closeBio() {
      if (teamModal) teamModal.hidden = true;
    }

    document.addEventListener('click', (event) => {
      const trigger = event.target?.closest?.('.bio-btn');
      if (trigger) {
        event.preventDefault();
        openBio(trigger.dataset.bio);
      }
      if (event.target?.id === 'teamModalClose' || event.target === teamModal) closeBio();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && teamModal && !teamModal.hidden) closeBio();
    });

    function fit() {
      enforceFrameWidth();
      const viewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
      const top = root.getBoundingClientRect().top + (window.scrollY || 0);
      const height = Math.max(360, Math.floor(viewportHeight - top - 4));
      root.style.setProperty('--about-h', `${height}px`);
    }

    fit();
    window.addEventListener('resize', fit, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAboutRoute, { once: true });
  } else {
    initAboutRoute();
  }
})();
