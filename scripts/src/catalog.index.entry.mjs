import { animate } from 'framer-motion/dom';
import Fuse from 'fuse.js';
import { bindDexButtonMotion, bindPaginationMotion, prefersReducedMotion, revealStagger } from './shared/dx-motion.entry.mjs';

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
  let seasonCarouselSeason = '';
  const ZWNJ = '\u200C';

  function redirectLegacyHashes() {
    const target = REDIRECT_HASHES[window.location.hash || ''];
    if (target) {
      window.location.replace(target);
      return true;
    }
    return false;
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

  function canonicalEntryHref(hrefValue) {
    const href = text(hrefValue).trim();
    if (!/^\/entry\/[^?#]+\/?$/i.test(href)) return '';
    return href.endsWith('/') ? href : `${href}/`;
  }

  function normalizeImageSrc(rawValue) {
    const raw = text(rawValue).trim();
    if (!raw || raw.startsWith('data:')) return '';
    const stripQueryHash = (value) => value.split('#')[0].split('?')[0];

    if (/^https?:\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        const pathname = stripQueryHash(parsed.pathname);
        const file = pathname.split('/').filter(Boolean).pop() || '';
        if (/\.(?:jpe?g|png|webp|gif|avif)$/i.test(file)) {
          return `${parsed.origin}${pathname}`;
        }
        if (parsed.hostname.endsWith('dexdsl.com') || parsed.hostname.endsWith('dexdsl.org')) {
          return pathname || raw;
        }
        return `${parsed.origin}${pathname}`;
      } catch {
        return stripQueryHash(raw);
      }
    }

    return stripQueryHash(raw);
  }

  function imageCandidateForEntry(entry) {
    return normalizeImageSrc(entry?.image_src);
  }

  function randomEntryHref() {
    const pool = allEntries()
      .map((entry) => canonicalEntryHref(entry.entry_href))
      .filter(Boolean);
    if (!pool.length) return '/catalog/';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function seasonLabel(seasonRaw) {
    const season = text(seasonRaw).toUpperCase();
    if (season === 'S2') return "season 2 ('24-)";
    if (season === 'S1') return "season 1 ('22-'24)";
    const match = season.match(/^S(\d+)$/);
    if (match) return `season ${match[1]}`;
    return 'season';
  }

  function protectedAllCaps(value) {
    // Prevent ligature-like collapsing in double letters while preserving existing protection semantics.
    const normalized = text(value).replace(/\u200C/g, '').toUpperCase();
    return normalized.replace(/([A-Z])\1/g, `$1${ZWNJ}$1`);
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
    heading.appendChild(create('h1', 'dx-catalog-index-title', 'Browse by performer, instrument, or lookup code.'));
    const delta = create('p', 'dx-catalog-index-whats-new', 'Lookup guide and symbol key now live on separate pages.');
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

    const title = create('h1', 'dx-catalog-index-hero-title', 'CATALOG');
    const subtitle = create('div', 'dx-catalog-index-hero-subtitle');

    const guide = openCta('/catalog/how/#dex-how', 'Lookup guide', 'secondary');
    const random = create('button', 'dx-button-element dx-button-size--sm dx-button-element--secondary', 'Random entry');
    random.type = 'button';
    random.addEventListener('click', () => {
      window.location.assign(randomEntryHref());
    });

    subtitle.append(guide, random);
    section.append(title, subtitle);
    target.appendChild(section);
  }

  function createSeasonCarouselArrow(direction) {
    const button = create('button', `dx-catalog-index-season-arrow dx-catalog-index-season-arrow--${direction}`);
    button.type = 'button';
    button.setAttribute('aria-label', direction === 'left' ? 'Previous' : 'Next');
    if (direction === 'left') {
      button.innerHTML = `
        <span class="dx-catalog-index-season-arrow-bg" aria-hidden="true"></span>
        <svg class="dx-catalog-index-season-arrow-icon" viewBox="0 0 24 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path class="dx-catalog-index-season-arrow-icon-path" d="M7.87012 13L2.00021 7L7.87012 1"/>
          <path class="dx-catalog-index-season-arrow-icon-path" d="M22.9653 7L3.03948 7"/>
        </svg>
      `;
    } else {
      button.innerHTML = `
        <span class="dx-catalog-index-season-arrow-bg" aria-hidden="true"></span>
        <svg class="dx-catalog-index-season-arrow-icon" viewBox="0 0 24 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path class="dx-catalog-index-season-arrow-icon-path" d="M16.1299 1L21.9998 7L16.1299 13"/>
          <path class="dx-catalog-index-season-arrow-icon-path" d="M1.03472 7H20.9605"/>
        </svg>
      `;
    }
    return button;
  }

  function renderSeasonSlide(entry) {
    const href = canonicalEntryHref(entry.entry_href) || '/catalog/';
    const imageSrc = imageCandidateForEntry(entry);
    const slide = create('li', 'dx-catalog-index-season-slide');

    const media = create('a', 'dx-catalog-index-season-media');
    media.href = href;
    const image = create('img', 'dx-catalog-index-season-img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = text(entry.image_alt_raw || entry.title_raw || entry.performer_raw || 'Catalog entry');
    if (imageSrc) image.src = imageSrc;
    media.appendChild(image);

    const copy = create('div', 'dx-catalog-index-season-copy');
    copy.appendChild(create('h3', 'dx-catalog-index-season-performer', text(entry.performer_raw || 'Unknown performer')));
    copy.appendChild(create('p', 'dx-catalog-index-season-title', text(entry.title_raw || 'Untitled')));

    const open = openCta(href, protectedAllCaps('View collection'), 'primary');
    open.classList.add('dx-catalog-index-season-open');
    copy.appendChild(open);

    slide.append(media, copy);
    return slide;
  }

  function renderSeasonCarousel(target) {
    const imageEntries = allEntries().filter((entry) => {
      return !!canonicalEntryHref(entry.entry_href) && !!text(entry.season).trim() && !!imageCandidateForEntry(entry);
    });
    if (!imageEntries.length) return;

    const seasonBuckets = new Map();
    imageEntries.forEach((entry) => {
      const season = text(entry.season).trim();
      if (!season) return;
      if (!seasonBuckets.has(season)) seasonBuckets.set(season, []);
      seasonBuckets.get(season).push(entry);
    });

    const preferred = Array.isArray(model?.stats?.seasons)
      ? model.stats.seasons.map((value) => text(value).trim()).filter(Boolean)
      : [];
    const seasons = [];
    for (const season of [...preferred, ...seasonBuckets.keys()]) {
      if (!season || !seasonBuckets.has(season)) continue;
      if (seasons.includes(season)) continue;
      seasons.push(season);
    }
    if (!seasons.length) return;
    if (!seasons.includes(seasonCarouselSeason)) seasonCarouselSeason = seasons[0];

    const section = create('section', 'dx-catalog-index-season-carousel dx-catalog-index-surface');
    section.setAttribute('data-dx-motion', 'pagination');

    const tabs = create('div', 'dx-catalog-index-season-tabs');
    const seasonMeta = create('p', 'dx-catalog-index-season-meta', seasonLabel(seasonCarouselSeason));

    const gutter = create('div', 'dx-catalog-index-season-gutter');
    gutter.setAttribute('role', 'region');
    gutter.setAttribute('aria-label', 'Carousel');
    const revealer = create('div', 'dx-catalog-index-season-revealer');
    const track = create('ul', 'dx-catalog-index-season-track');
    track.setAttribute('aria-live', 'polite');
    revealer.appendChild(track);
    gutter.appendChild(revealer);

    const desktopArrows = create('div', 'dx-catalog-index-season-desktop-arrows');
    const desktopLeftWrap = create('div', 'dx-catalog-index-season-arrow-wrap dx-catalog-index-season-arrow-wrap--left');
    const desktopRightWrap = create('div', 'dx-catalog-index-season-arrow-wrap dx-catalog-index-season-arrow-wrap--right');
    const desktopLeft = createSeasonCarouselArrow('left');
    const desktopRight = createSeasonCarouselArrow('right');
    desktopLeftWrap.appendChild(desktopLeft);
    desktopRightWrap.appendChild(desktopRight);
    desktopArrows.append(desktopLeftWrap, desktopRightWrap);

    const mobileArrows = create('div', 'dx-catalog-index-season-mobile-arrows');
    const mobileLeft = createSeasonCarouselArrow('left');
    const mobileRight = createSeasonCarouselArrow('right');
    mobileArrows.append(mobileLeft, mobileRight);

    const scrollTrack = (direction) => {
      const firstCard = track.querySelector('.dx-catalog-index-season-slide');
      const gap = parseFloat(window.getComputedStyle(track).columnGap || '0') || 0;
      const step = firstCard ? firstCard.getBoundingClientRect().width + gap : Math.max(track.clientWidth * 0.8, 240);
      track.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    [desktopLeft, mobileLeft].forEach((button) => {
      button.addEventListener('click', () => scrollTrack(-1));
    });
    [desktopRight, mobileRight].forEach((button) => {
      button.addEventListener('click', () => scrollTrack(1));
    });

    const renderTabs = () => {
      clearNode(tabs);
      seasons.forEach((season) => {
        const tab = create('button', 'dx-catalog-index-season-tab', seasonLabel(season));
        tab.type = 'button';
        const active = season === seasonCarouselSeason;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-pressed', active ? 'true' : 'false');
        tab.addEventListener('click', () => {
          if (seasonCarouselSeason === season) return;
          const currentIndex = seasons.indexOf(seasonCarouselSeason);
          const nextIndex = seasons.indexOf(season);
          const direction = nextIndex === currentIndex ? 0 : (nextIndex > currentIndex ? 1 : -1);
          seasonCarouselSeason = season;
          renderTabs();
          renderTrack(direction);
        });
        tabs.appendChild(tab);
      });
    };

    const renderTrack = (direction = 0) => {
      clearNode(track);
      track.setAttribute('data-dx-motion', 'pagination');
      seasonMeta.textContent = seasonLabel(seasonCarouselSeason);
      const seasonEntries = seasonBuckets.get(seasonCarouselSeason) || [];
      seasonEntries.forEach((entry) => track.appendChild(renderSeasonSlide(entry)));
      track.scrollLeft = 0;

      if (prefersReducedMotion()) return;
      const offset = direction === 0 ? 0 : direction * 8;
      animate(
        track,
        {
          opacity: [0, 1],
          transform: [`translate3d(${offset}px, 0, 0)`, 'translate3d(0, 0, 0)'],
        },
        {
          duration: 0.24,
          ease: 'easeOut',
        },
      );
    };

    renderTabs();
    renderTrack();

    section.append(tabs, seasonMeta, gutter, desktopArrows, mobileArrows);
    target.appendChild(section);
  }

  function renderSpotlight(target) {
    const spotlight = model?.spotlight || {};
    const spotlightHref = canonicalEntryHref(spotlight.cta_href);
    const spotlightEntry = allEntries().find((entry) => {
      const entryHref = canonicalEntryHref(entry.entry_href);
      if (spotlightHref && entryHref === spotlightHref) return true;
      if (text(spotlight.entry_id) && text(entry.id) === text(spotlight.entry_id)) return true;
      return false;
    }) || null;
    const resolvedHref = canonicalEntryHref(spotlightEntry?.entry_href || spotlight.cta_href) || text(spotlight.cta_href || '/catalog/');
    const resolvedTitle = text(spotlightEntry?.title_raw || spotlight.subhead_raw || 'Featured entry');
    const resolvedBody = text(spotlight.body_raw || spotlightEntry?.performer_raw || '');
    const resolvedImage = normalizeImageSrc(text(spotlight.image_src || spotlightEntry?.image_src || ''));
    const section = create('section', 'dx-catalog-index-spotlight dx-catalog-index-surface');

    const copy = create('div', 'dx-catalog-index-spotlight-copy');
    copy.appendChild(create('p', 'dx-catalog-index-kicker', text(spotlight.headline_raw || 'ARTIST SPOTLIGHT')));
    copy.appendChild(create('h2', 'dx-catalog-index-spotlight-title', resolvedTitle));
    if (resolvedBody) copy.appendChild(create('p', 'dx-catalog-index-copy', resolvedBody));
    copy.appendChild(openCta(resolvedHref, text(spotlight.cta_label_raw || 'View entry'), 'primary'));

    section.appendChild(copy);

    if (resolvedImage) {
      const media = create('a', 'dx-catalog-index-spotlight-media');
      media.href = resolvedHref;
      const image = create('img', 'dx-catalog-index-spotlight-img');
      image.loading = 'lazy';
      image.decoding = 'async';
      image.alt = text(resolvedTitle || spotlight.headline_raw || 'Artist spotlight');
      image.src = resolvedImage;
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

    revealStagger(browse, '.dx-catalog-index-group', {
      key: 'catalog-index-browse-reveal',
      y: 8,
      duration: 0.24,
      stagger: 0.02,
      threshold: 0.1,
      rootMargin: '0px 0px -8% 0px',
    });
    bindDexButtonMotion(browse);
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
    renderSeasonCarousel(shell);
    renderSpotlight(shell);
    renderControls(shell);

    const browseHost = create('div', 'dx-catalog-index-browse-host');
    browseHost.setAttribute('data-catalog-index-browse', 'true');
    shell.appendChild(browseHost);

    root.appendChild(shell);
    renderBrowse();
    bindDexButtonMotion(root);
    bindPaginationMotion(root);
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
