import { animate } from 'framer-motion/dom';
import Fuse from 'fuse.js';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxCatalogIndexLoaded) return;
  window.__dxCatalogIndexLoaded = true;

  const APP_SELECTOR = '[data-catalog-index-app]';
  const ENTRIES_URL = '/data/catalog.entries.json';
  const SEARCH_URL = '/data/catalog.search.json';
  const REDIRECT_HASHES = {
    '#dex-how': '/catalog/how/#dex-how',
    '#list-of-identifiers': '/catalog/symbols/#list-of-identifiers',
  };

  const MODE_VALUES = ['performer', 'instrument', 'lookup'];
  const SORT_VALUES = ['alpha', 'recent', 'lookup'];
  const DEFAULT_STATE = {
    mode: 'performer',
    season: 'all',
    instrument: 'all',
    q: '',
    sort: 'alpha',
  };

  let model = null;
  let searchModel = null;
  let fuse = null;
  let state = { ...DEFAULT_STATE };
  let blobRaf = 0;
  let blobResizeHandler = null;
  let drawerOpen = false;

  function redirectLegacyHashes() {
    const target = REDIRECT_HASHES[window.location.hash || ''];
    if (target) {
      window.location.replace(target);
      return true;
    }
    return false;
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

  function text(value) {
    return String(value ?? '');
  }

  function normalize(value) {
    return text(value).toLowerCase();
  }

  function create(tag, className, textValue = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textValue !== null) element.textContent = textValue;
    return element;
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function canonicalMode(value) {
    return MODE_VALUES.includes(value) ? value : DEFAULT_STATE.mode;
  }

  function canonicalSort(value) {
    return SORT_VALUES.includes(value) ? value : DEFAULT_STATE.sort;
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    return {
      mode: canonicalMode(params.get('mode') || DEFAULT_STATE.mode),
      season: params.get('season') || DEFAULT_STATE.season,
      instrument: params.get('instrument') || DEFAULT_STATE.instrument,
      q: params.get('q') || DEFAULT_STATE.q,
      sort: canonicalSort(params.get('sort') || DEFAULT_STATE.sort),
    };
  }

  function writeUrlState() {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const setOrDelete = (key, value, fallback) => {
      if (!value || value === fallback) params.delete(key);
      else params.set(key, value);
    };

    setOrDelete('mode', state.mode, DEFAULT_STATE.mode);
    setOrDelete('season', state.season, DEFAULT_STATE.season);
    setOrDelete('instrument', state.instrument, DEFAULT_STATE.instrument);
    setOrDelete('q', state.q, DEFAULT_STATE.q);
    setOrDelete('sort', state.sort, DEFAULT_STATE.sort);

    const nextUrl = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl);
  }

  function openCta(href, label, variant = 'secondary') {
    const link = create('a', `dx-button-element dx-button-size--sm dx-button-element--${variant}`);
    link.href = href || '#';
    link.textContent = label;
    return link;
  }

  function allEntries() {
    return Array.isArray(model?.entries) ? model.entries : [];
  }

  function buildFuse() {
    if (!Array.isArray(searchModel?.entries)) return null;
    return new Fuse(searchModel.entries, {
      keys: [
        { name: 'title_norm', weight: 0.4 },
        { name: 'performer_norm', weight: 0.3 },
        { name: 'lookup_norm', weight: 0.2 },
        { name: 'instrument_norm', weight: 0.1 },
        { name: 'search_blob', weight: 0.45 },
      ],
      includeScore: true,
      threshold: 0.34,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }

  function entriesById() {
    const map = new Map();
    for (const entry of allEntries()) {
      map.set(entry.id, entry);
    }
    return map;
  }

  function sortEntries(entries) {
    const sorter = {
      alpha: (a, b) => {
        const performerCmp = text(a.performer_raw).localeCompare(text(b.performer_raw));
        if (performerCmp !== 0) return performerCmp;
        return text(a.title_raw).localeCompare(text(b.title_raw));
      },
      recent: (a, b) => {
        const seasonCmp = text(b.season).localeCompare(text(a.season));
        if (seasonCmp !== 0) return seasonCmp;
        return text(a.performer_raw).localeCompare(text(b.performer_raw));
      },
      lookup: (a, b) => text(a.lookup_raw).localeCompare(text(b.lookup_raw)),
    };

    entries.sort(sorter[state.sort] || sorter.alpha);
  }

  function activeEntries() {
    let filtered = [...allEntries()];

    if (state.season !== 'all') {
      filtered = filtered.filter((entry) => text(entry.season) === state.season);
    }

    if (state.instrument !== 'all') {
      filtered = filtered.filter((entry) => (entry.instrument_family || []).some((family) => normalize(family) === normalize(state.instrument)));
    }

    const query = text(state.q).trim();
    if (query) {
      if (fuse) {
        const resultIds = new Set(fuse.search(query).map((result) => result.item.id));
        filtered = filtered.filter((entry) => resultIds.has(entry.id));
      } else {
        const q = normalize(query);
        filtered = filtered.filter((entry) => {
          const haystack = [entry.title_norm, entry.performer_norm, entry.lookup_norm, entry.instrument_norm].join(' ');
          return haystack.includes(q);
        });
      }
    }

    sortEntries(filtered);

    if (query && fuse) {
      const ordered = [];
      const seen = new Set();
      const idMap = entriesById();

      for (const result of fuse.search(query)) {
        const entry = idMap.get(result.item.id);
        if (!entry) continue;
        if (!filtered.includes(entry)) continue;
        if (seen.has(entry.id)) continue;
        ordered.push(entry);
        seen.add(entry.id);
      }

      for (const entry of filtered) {
        if (!seen.has(entry.id)) ordered.push(entry);
      }

      return ordered;
    }

    return filtered;
  }

  function groupEntries(entries) {
    if (state.mode === 'performer') {
      const groups = new Map();
      for (const entry of entries) {
        const key = text(entry.performer_raw || 'Unknown performer');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
      }
      return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    if (state.mode === 'instrument') {
      const groups = new Map();
      for (const entry of entries) {
        const families = (entry.instrument_family || []).length ? entry.instrument_family : ['Other'];
        for (const family of families) {
          if (!groups.has(family)) groups.set(family, []);
          groups.get(family).push(entry);
        }
      }
      return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    const groups = new Map();
    for (const entry of entries) {
      const lookupRaw = text(entry.lookup_raw);
      const prefix = lookupRaw.split(' ').filter(Boolean)[0] || 'Uncoded';
      const season = text(entry.season || 'S?');
      const key = `${season} · ${prefix}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function renderControls(target) {
    const controls = create('section', 'dx-catalog-index-controls dx-catalog-index-surface');

    const heading = create('div', 'dx-catalog-index-heading');
    heading.appendChild(create('p', 'dx-catalog-index-kicker', 'Catalog Index'));
    heading.appendChild(create('h1', 'dx-catalog-index-title', 'Browse the archive with an editorial reading flow.'));
    const delta = create('p', 'dx-catalog-index-whats-new', 'Guide and symbol references now live in dedicated reading pages.');
    heading.appendChild(delta);
    controls.appendChild(heading);

    const row = create('div', 'dx-catalog-index-toolbar');
    const mode = create('p', 'dx-catalog-index-mode-label', `Mode: ${state.mode}`);
    row.appendChild(mode);

    const searchWrap = create('label', 'dx-catalog-index-search-wrap');
    const search = create('input', 'dx-catalog-index-search');
    search.type = 'search';
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.placeholder = 'Search performer, title, lookup, instrument';
    search.value = state.q;
    search.addEventListener('input', (event) => {
      state.q = event.currentTarget.value || '';
      writeUrlState();
      renderBrowse();
    });
    searchWrap.appendChild(search);
    row.appendChild(searchWrap);

    const filters = create('button', 'dx-button-element dx-button-size--sm dx-button-element--secondary dx-catalog-index-filters-toggle', 'Filters');
    filters.type = 'button';
    filters.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
    filters.setAttribute('aria-controls', 'dx-catalog-index-drawer');
    filters.addEventListener('click', () => {
      drawerOpen = !drawerOpen;
      render();
    });
    row.appendChild(filters);

    controls.appendChild(row);

    if (drawerOpen) {
      const drawer = create('section', 'dx-catalog-index-drawer');
      drawer.id = 'dx-catalog-index-drawer';

      const drawerGrid = create('div', 'dx-catalog-index-drawer-grid');

      const modeWrap = create('label', 'dx-catalog-index-field');
      modeWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Browse mode'));
      const modeSelect = create('select', 'dx-catalog-index-select');
      MODE_VALUES.forEach((value) => {
        const option = create('option', '', value[0].toUpperCase() + value.slice(1));
        option.value = value;
        if (state.mode === value) option.selected = true;
        modeSelect.appendChild(option);
      });
      modeSelect.addEventListener('change', (event) => {
        state.mode = canonicalMode(event.currentTarget.value);
        if (state.mode !== 'instrument') state.instrument = 'all';
        writeUrlState();
        render();
      });
      modeWrap.appendChild(modeSelect);
      drawerGrid.appendChild(modeWrap);

      const seasonWrap = create('label', 'dx-catalog-index-field');
      seasonWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Season'));
      const seasonSelect = create('select', 'dx-catalog-index-select');
      ['all', ...new Set(allEntries().map((entry) => entry.season).filter(Boolean))].forEach((season) => {
        const option = create('option', '', season === 'all' ? 'All' : season);
        option.value = season;
        if (state.season === season) option.selected = true;
        seasonSelect.appendChild(option);
      });
      seasonSelect.addEventListener('change', (event) => {
        state.season = event.currentTarget.value || 'all';
        writeUrlState();
        renderBrowse();
      });
      seasonWrap.appendChild(seasonSelect);
      drawerGrid.appendChild(seasonWrap);

      const instrumentWrap = create('label', 'dx-catalog-index-field');
      instrumentWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Instrument family'));
      const instrumentSelect = create('select', 'dx-catalog-index-select');
      ['all', ...new Set(allEntries().flatMap((entry) => entry.instrument_family || []).filter(Boolean))]
        .forEach((instrument) => {
          const option = create('option', '', instrument === 'all' ? 'All' : instrument);
          option.value = instrument;
          if (state.instrument === instrument) option.selected = true;
          instrumentSelect.appendChild(option);
        });
      instrumentSelect.disabled = state.mode !== 'instrument';
      instrumentSelect.addEventListener('change', (event) => {
        state.instrument = event.currentTarget.value || 'all';
        writeUrlState();
        renderBrowse();
      });
      instrumentWrap.appendChild(instrumentSelect);
      drawerGrid.appendChild(instrumentWrap);

      const sortWrap = create('label', 'dx-catalog-index-field');
      sortWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Sort'));
      const sortSelect = create('select', 'dx-catalog-index-select');
      [
        ['alpha', 'Alpha'],
        ['recent', 'Recent'],
        ['lookup', 'Lookup'],
      ].forEach(([value, label]) => {
        const option = create('option', '', label);
        option.value = value;
        if (state.sort === value) option.selected = true;
        sortSelect.appendChild(option);
      });
      sortSelect.addEventListener('change', (event) => {
        state.sort = canonicalSort(event.currentTarget.value);
        writeUrlState();
        renderBrowse();
      });
      sortWrap.appendChild(sortSelect);
      drawerGrid.appendChild(sortWrap);

      drawer.appendChild(drawerGrid);

      const actions = create('div', 'dx-catalog-index-drawer-actions');
      const clear = create('button', 'dx-button-element dx-button-size--sm dx-button-element--secondary', 'Clear filters');
      clear.type = 'button';
      // Keep current mode while resetting query/filter/sort to avoid disorienting mode jumps.
      clear.addEventListener('click', () => {
        state = { ...DEFAULT_STATE, mode: state.mode };
        writeUrlState();
        render();
      });
      actions.appendChild(clear);

      const guide = openCta('/catalog/how/#dex-how', 'Lookup guide', 'secondary');
      const symbols = openCta('/catalog/symbols/#list-of-identifiers', 'List of symbols', 'secondary');
      actions.append(guide, symbols);
      drawer.appendChild(actions);

      controls.appendChild(drawer);
    }

    target.appendChild(controls);
  }

  function renderHero(target) {
    const section = create('section', 'dx-catalog-index-hero dx-catalog-index-surface');

    const kicker = create('p', 'dx-catalog-index-kicker', 'DEX CATALOG');
    const title = create('h2', 'dx-catalog-index-hero-title', 'An open editorial index for performer, instrument, and lookup browsing.');
    const body = create('p', 'dx-catalog-index-copy', 'Use one list architecture across modes, then branch into deep reading pages for lookup syntax and symbol definitions.');
    const cta = openCta('/catalog/how/#dex-how', 'Read lookup guide', 'primary');

    section.append(kicker, title, body, cta);
    target.appendChild(section);
  }

  function renderSpotlight(target) {
    const spotlight = model?.spotlight || {};
    const section = create('section', 'dx-catalog-index-spotlight dx-catalog-index-surface');

    const copy = create('div', 'dx-catalog-index-spotlight-copy');
    copy.appendChild(create('p', 'dx-catalog-index-kicker', text(spotlight.headline_raw || 'ARTIST SPOTLIGHT')));
    copy.appendChild(create('h2', 'dx-catalog-index-spotlight-title', text(spotlight.subhead_raw || 'Featured entry')));
    if (spotlight.body_raw) copy.appendChild(create('p', 'dx-catalog-index-copy', text(spotlight.body_raw)));
    copy.appendChild(openCta(text(spotlight.cta_href || '/catalog/'), text(spotlight.cta_label_raw || 'View entry'), 'primary'));

    section.appendChild(copy);

    if (spotlight.image_src) {
      const media = create('a', 'dx-catalog-index-spotlight-media');
      media.href = text(spotlight.cta_href || '/catalog/');
      const image = create('img', 'dx-catalog-index-spotlight-img');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = spotlight.image_src;
      image.alt = text(spotlight.subhead_raw || spotlight.headline_raw || 'Artist spotlight');
      media.appendChild(image);
      section.appendChild(media);
    }

    target.appendChild(section);
  }

  function renderEntryRow(entry) {
    const row = create('article', 'dx-catalog-index-row');

    const code = create('p', 'dx-catalog-index-row-code', text(entry.lookup_raw || '—'));
    const title = create('h4', 'dx-catalog-index-row-title', text(entry.title_raw || 'Untitled'));
    const performer = create('p', 'dx-catalog-index-row-performer', text(entry.performer_raw || ''));
    const meta = create('p', 'dx-catalog-index-row-meta', [
      text(entry.season || ''),
      ...(entry.instrument_family || []),
    ].filter(Boolean).join(' · '));

    const open = openCta(text(entry.entry_href || '#'), 'Open entry', 'secondary');
    open.classList.add('dx-catalog-index-row-open');

    const textWrap = create('div', 'dx-catalog-index-row-text');
    textWrap.append(title, performer, meta);

    row.append(code, textWrap, open);
    return row;
  }

  function renderBrowse() {
    const host = document.querySelector('[data-catalog-index-browse]');
    if (!host) return;
    clearNode(host);

    const entries = activeEntries();
    const browse = create('section', 'dx-catalog-index-browse dx-catalog-index-surface');

    const idByMode = {
      performer: 'dex-performer',
      instrument: 'dex-instrument',
      lookup: 'dex-lookup',
    };
    browse.id = idByMode[state.mode] || 'dex-performer';

    const heading = create('div', 'dx-catalog-index-browse-head');
    heading.appendChild(create('p', 'dx-catalog-index-kicker', `Browse mode: ${state.mode}`));
    heading.appendChild(create('h3', 'dx-catalog-index-browse-title', entries.length ? `${entries.length} matching entries` : 'No matching entries'));
    browse.appendChild(heading);

    if (!entries.length) {
      browse.appendChild(create('p', 'dx-catalog-index-copy', 'Try broadening your query or clearing filters.'));
      host.appendChild(browse);
      return;
    }

    const groups = groupEntries(entries);
    const list = create('div', 'dx-catalog-index-list');

    groups.forEach(([label, items]) => {
      const group = create('section', 'dx-catalog-index-group');
      const groupTitle = create('h4', 'dx-catalog-index-group-title', label);
      group.appendChild(groupTitle);

      const rows = create('div', 'dx-catalog-index-group-rows');
      items.forEach((entry) => rows.appendChild(renderEntryRow(entry)));
      group.appendChild(rows);
      list.appendChild(group);
    });

    browse.appendChild(list);
    host.appendChild(browse);

    if (!prefersReducedMotion()) {
      const groupsToAnimate = browse.querySelectorAll('.dx-catalog-index-group');
      groupsToAnimate.forEach((group, index) => {
        animate(
          group,
          {
            opacity: [0, 1],
            transform: ['translate3d(0px, 8px, 0px)', 'translate3d(0px, 0px, 0px)'],
          },
          {
            duration: 0.24,
            delay: Math.min(index * 0.02, 0.2),
            ease: 'easeOut',
          },
        );
      });
    }
  }

  function renderError(error) {
    const root = document.querySelector(APP_SELECTOR);
    if (!root) return;
    clearNode(root);
    const pane = create('section', 'dx-catalog-index-surface dx-catalog-index-error');
    pane.appendChild(create('h2', 'dx-catalog-index-title', 'Catalog failed to load'));
    pane.appendChild(create('p', 'dx-catalog-index-copy', text(error?.message || 'Unknown error')));
    root.appendChild(pane);
  }

  function render() {
    const root = document.querySelector(APP_SELECTOR);
    if (!root || !model) return;
    clearNode(root);

    const shell = create('div', 'dx-catalog-index-shell');
    renderHero(shell);
    renderSpotlight(shell);
    renderControls(shell);

    const browseHost = create('div', 'dx-catalog-index-browse-host');
    browseHost.setAttribute('data-catalog-index-browse', 'true');
    shell.appendChild(browseHost);

    root.appendChild(shell);
    renderBrowse();
    startBlobMotion();
  }

  async function loadJson(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return await response.json();
  }

  async function boot() {
    if (redirectLegacyHashes()) return;

    state = { ...DEFAULT_STATE, ...readUrlState() };

    try {
      const [loadedModel, loadedSearch] = await Promise.all([
        loadJson(ENTRIES_URL),
        loadJson(SEARCH_URL),
      ]);
      model = loadedModel;
      searchModel = loadedSearch;
      fuse = buildFuse();
      writeUrlState();
      render();
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
