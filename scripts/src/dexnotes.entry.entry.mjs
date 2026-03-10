import { bindDexButtonMotion, bindPaginationMotion, prefersReducedMotion, revealStagger } from './shared/dx-motion.entry.mjs';
import { mountMarketingNewsletter } from './shared/dx-marketing-newsletter.entry.mjs';
import { mountPollEmbeds } from './shared/dx-polls-embed.entry.mjs';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxDexnotesEntryLoaded) return;
  window.__dxDexnotesEntryLoaded = true;

  const APP_SELECTOR = '[data-dexnotes-entry-app]';
  const ENTRIES_URL = '/data/dexnotes.entries.json';
  const COMMENTS_URL = '/data/dexnotes.comments.json';
  const PROGRESS_ID = 'dx-dexnotes-reading-progress';
  const ROUTE_TRANSITION_OUT_START = 'dx:route-transition-out:start';
  const BLOB_RUNTIME_KEY = '__dxDexnotesBlobRuntime';
  const blobRuntimeHandle = {};

  let blobRaf = 0;
  let blobResizeHandler = null;
  let progressRaf = 0;
  let progressBound = false;
  let progressScrollTarget = null;
  let progressSlotListenerBound = false;
  let lifecycleCleanupInstalled = false;

  function text(value) {
    return String(value ?? '');
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

  function isExternalHref(href) {
    const value = text(href).trim();
    if (!value) return false;
    if (value.startsWith('mailto:') || value.startsWith('tel:')) return true;
    if (!/^https?:\/\//i.test(value)) return false;
    try {
      const url = new URL(value, window.location.origin);
      return url.origin !== window.location.origin;
    } catch {
      return true;
    }
  }

  function ensureProgressBar() {
    let node = document.getElementById(PROGRESS_ID);
    if (node) return node;
    node = document.createElement('div');
    node.id = PROGRESS_ID;
    node.className = 'dx-dexnotes-reading-progress';
    const fill = document.createElement('span');
    fill.className = 'dx-dexnotes-reading-progress-fill';
    node.appendChild(fill);
    document.body.appendChild(node);
    return node;
  }

  function scheduleProgressUpdate() {
    if (progressRaf) return;
    progressRaf = requestAnimationFrame(() => {
      progressRaf = 0;
      const progress = ensureProgressBar();
      const fill = progress.querySelector('.dx-dexnotes-reading-progress-fill');
      if (!fill) return;
      let top = 0;
      let maxScroll = 1;
      if (progressScrollTarget && progressScrollTarget !== window) {
        const host = progressScrollTarget;
        top = Number(host.scrollTop || 0);
        maxScroll = Math.max(Number(host.scrollHeight || 0) - Number(host.clientHeight || 0), 1);
      } else {
        const docEl = document.documentElement;
        top = Number(window.scrollY || docEl.scrollTop || 0);
        maxScroll = Math.max(Number(docEl.scrollHeight || 0) - Number(window.innerHeight || 0), 1);
      }
      const ratio = Math.max(0, Math.min(1, top / maxScroll));
      fill.style.transform = `scaleX(${ratio})`;
    });
  }

  function resolveProgressScrollTarget() {
    if (typeof window.dxGetSlotScrollRoot === 'function') {
      const slotRoot = window.dxGetSlotScrollRoot();
      if (slotRoot && typeof slotRoot.addEventListener === 'function') return slotRoot;
    }
    return window;
  }

  function bindProgress() {
    const nextTarget = resolveProgressScrollTarget();
    if (progressBound && progressScrollTarget === nextTarget) {
      scheduleProgressUpdate();
      return;
    }
    if (progressBound) unbindProgress();
    progressBound = true;
    progressScrollTarget = nextTarget;
    scheduleProgressUpdate();
    progressScrollTarget.addEventListener('scroll', scheduleProgressUpdate, { passive: true });
    window.addEventListener('resize', scheduleProgressUpdate);
    if (!progressSlotListenerBound) {
      progressSlotListenerBound = true;
      window.addEventListener('dx:slotready', bindProgress);
    }
  }

  function unbindProgress() {
    if (!progressBound) return;
    progressBound = false;
    if (progressScrollTarget) {
      progressScrollTarget.removeEventListener('scroll', scheduleProgressUpdate);
    }
    window.removeEventListener('resize', scheduleProgressUpdate);
    if (progressRaf) {
      cancelAnimationFrame(progressRaf);
      progressRaf = 0;
    }
    progressScrollTarget = null;
  }

  function removeProgressBar() {
    const node = document.getElementById(PROGRESS_ID);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function startBlobMotion() {
    const activeRuntime = window[BLOB_RUNTIME_KEY];
    if (activeRuntime && activeRuntime.handle !== blobRuntimeHandle && typeof activeRuntime.stop === 'function') {
      try {
        activeRuntime.stop();
      } catch {
        // Ignore stale blob runtime failures.
      }
    }

    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!wrapper) return;

    const stage = wrapper.querySelector('.gooey-stage') || wrapper;
    let blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    if (blobs.length === 0 && stage instanceof HTMLElement) {
      const defaults = [
        { size: '44vw', g1a: 'rgba(255, 42, 27, 0.56)', g1b: 'rgba(255, 164, 16, 0.42)', g2a: 'rgba(24, 36, 56, 0.26)', g2b: 'rgba(24, 36, 56, 0)' },
        { size: '40vw', g1a: 'rgba(255, 16, 74, 0.42)', g1b: 'rgba(255, 120, 18, 0.36)', g2a: 'rgba(34, 44, 68, 0.24)', g2b: 'rgba(34, 44, 68, 0)' },
        { size: '38vw', g1a: 'rgba(255, 71, 45, 0.46)', g1b: 'rgba(255, 184, 46, 0.34)', g2a: 'rgba(21, 29, 48, 0.2)', g2b: 'rgba(21, 29, 48, 0)' },
      ];
      defaults.forEach((preset) => {
        const blob = document.createElement('div');
        blob.className = 'gooey-blob';
        blob.style.setProperty('--d', preset.size);
        blob.style.setProperty('--g1a', preset.g1a);
        blob.style.setProperty('--g1b', preset.g1b);
        blob.style.setProperty('--g2a', preset.g2a);
        blob.style.setProperty('--g2b', preset.g2b);
        stage.appendChild(blob);
      });
      blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    }
    if (blobs.length === 0) return;

    const width = () => window.innerWidth;
    const height = () => window.innerHeight;
    const placeStatic = () => {
      const columns = Math.ceil(Math.sqrt(blobs.length));
      const rows = Math.ceil(blobs.length / columns);
      blobs.forEach((blob, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = ((col + 1) / (columns + 1)) * width();
        const y = ((row + 1) / (rows + 1)) * height();
        blob.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      });
    };

    blobs.forEach((blob) => {
      blob._rad = blob.offsetWidth / 2;
      if (!Number.isFinite(blob._x)) blob._x = width() / 2;
      if (!Number.isFinite(blob._y)) blob._y = height() / 2;
      if (!Number.isFinite(blob._vx) || !Number.isFinite(blob._vy)) {
        const speed = 60 + Math.random() * 60;
        const angle = Math.random() * Math.PI * 2;
        blob._vx = Math.cos(angle) * speed * 0.24;
        blob._vy = Math.sin(angle) * speed * 0.24;
      }
      blob._x = Math.min(Math.max(blob._rad, blob._x), width() - blob._rad);
      blob._y = Math.min(Math.max(blob._rad, blob._y), height() - blob._rad);
    });

    if (blobRaf) {
      cancelAnimationFrame(blobRaf);
      blobRaf = 0;
    }
    if (blobResizeHandler) {
      window.removeEventListener('resize', blobResizeHandler);
      blobResizeHandler = null;
    }

    if (prefersReducedMotion()) {
      wrapper.classList.add('dx-gooey-static');
      placeStatic();
      blobResizeHandler = () => {
        placeStatic();
      };
      window.addEventListener('resize', blobResizeHandler);
      window[BLOB_RUNTIME_KEY] = { handle: blobRuntimeHandle, stop: stopBlobMotion };
      return;
    }

    wrapper.classList.remove('dx-gooey-static');
    if (blobRaf) cancelAnimationFrame(blobRaf);
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      blobs.forEach((blob) => {
        blob._x += blob._vx * dt;
        blob._y += blob._vy * dt;

        if (blob._x - blob._rad <= 0 && blob._vx < 0) blob._vx *= -1;
        if (blob._x + blob._rad >= width() && blob._vx > 0) blob._vx *= -1;
        if (blob._y - blob._rad <= 0 && blob._vy < 0) blob._vy *= -1;
        if (blob._y + blob._rad >= height() && blob._vy > 0) blob._vy *= -1;

        blob.style.transform = `translate(${blob._x}px, ${blob._y}px) translate(-50%, -50%)`;
      });

      blobRaf = requestAnimationFrame(tick);
    };

    blobRaf = requestAnimationFrame(tick);

    blobResizeHandler = () => {
      blobs.forEach((blob) => {
        blob._x = Math.min(Math.max(blob._rad, blob._x), width() - blob._rad);
        blob._y = Math.min(Math.max(blob._rad, blob._y), height() - blob._rad);
      });
    };
    window.addEventListener('resize', blobResizeHandler);
    window[BLOB_RUNTIME_KEY] = { handle: blobRuntimeHandle, stop: stopBlobMotion };
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
    const activeRuntime = window[BLOB_RUNTIME_KEY];
    if (activeRuntime && activeRuntime.handle === blobRuntimeHandle) {
      try {
        delete window[BLOB_RUNTIME_KEY];
      } catch {
        window[BLOB_RUNTIME_KEY] = undefined;
      }
    }
  }

  function handleBeforeUnloadCleanup() {
    stopBlobMotion();
    unbindProgress();
    removeProgressBar();
  }

  function removeLifecycleCleanup() {
    if (!lifecycleCleanupInstalled) return;
    lifecycleCleanupInstalled = false;
    window.removeEventListener('beforeunload', handleBeforeUnloadCleanup);
    window.removeEventListener(ROUTE_TRANSITION_OUT_START, handleRouteTransitionOutStart);
  }

  function handleRouteTransitionOutStart() {
    handleBeforeUnloadCleanup();
    removeLifecycleCleanup();
  }

  function installLifecycleCleanup() {
    if (lifecycleCleanupInstalled) return;
    lifecycleCleanupInstalled = true;
    window.addEventListener('beforeunload', handleBeforeUnloadCleanup);
    window.addEventListener(ROUTE_TRANSITION_OUT_START, handleRouteTransitionOutStart);
  }

  function normalizeSlug(rawSlug) {
    return decodeURIComponent(text(rawSlug || '').trim()).replace(/^\/+|\/+$/g, '');
  }

  function slugFromPathname() {
    const match = window.location.pathname.match(/\/dexnotes\/([^/?#]+)\/?$/i);
    return match ? normalizeSlug(match[1]) : '';
  }

  function buildMetaRail(entry) {
    const rail = create('div', 'dx-dexnotes-meta-rail');
    rail.appendChild(create('span', 'dx-dexnotes-meta-chip', text(entry.published_display_raw)));

    const category = create('a', 'dx-dexnotes-meta-chip dx-dexnotes-meta-chip--link', text(entry.category_label_raw));
    category.href = `/dexnotes/category/${encodeURIComponent(text(entry.category_slug_raw))}/`;
    rail.appendChild(category);

    const author = create('a', 'dx-dexnotes-meta-chip dx-dexnotes-meta-chip--link', text(entry.author_name_raw));
    author.href = `/dexnotes/?author=${encodeURIComponent(text(entry.author_id))}`;
    rail.appendChild(author);

    const tags = Array.isArray(entry.tags_raw) ? entry.tags_raw : [];
    tags.slice(0, 6).forEach((tag) => {
      const chip = create('a', 'dx-dexnotes-meta-chip dx-dexnotes-meta-chip--link', text(tag.label_raw));
      chip.href = `/dexnotes/tag/${encodeURIComponent(text(tag.slug_raw))}/`;
      rail.appendChild(chip);
    });

    return rail;
  }

  function annotateExternalLinks(root) {
    root.querySelectorAll('a[href]').forEach((link) => {
      const href = text(link.getAttribute('href'));
      if (!isExternalHref(href)) return;
      link.classList.add('dx-external-link');
      if (!link.hasAttribute('target')) link.setAttribute('target', '_blank');
      if (!link.hasAttribute('rel')) link.setAttribute('rel', 'noopener noreferrer');
      if (!link.hasAttribute('aria-label')) {
        const base = text(link.textContent).replace(/[ \t\r\n]+/g, ' ').trim();
        link.setAttribute('aria-label', base ? `${base} (external)` : 'External link');
      }
    });
  }

  function normalizeLegacyBody(root) {
    const first = root.firstElementChild;
    if (!first) return;
    if (!(first.matches && first.matches('.blog-item-content.e-content'))) return;
    while (first.firstChild) root.appendChild(first.firstChild);
    first.remove();

    root.querySelectorAll('script, style').forEach((node) => {
      node.remove();
    });

    root.querySelectorAll('.dx-video-wrapper[data-html]').forEach((mount) => {
      if (mount.querySelector('iframe, video')) return;
      const htmlSource = text(mount.getAttribute('data-html'));
      if (!/<iframe/i.test(htmlSource)) return;
      const template = document.createElement('template');
      template.innerHTML = htmlSource;
      const iframe = template.content.querySelector('iframe');
      if (!iframe) return;
      iframe.loading = 'lazy';
      iframe.classList.add('dx-dexnotes-legacy-iframe');
      const source = text(iframe.getAttribute('src')).toLowerCase();
      if (source.includes('youtube') || source.includes('vimeo')) {
        iframe.removeAttribute('width');
        iframe.removeAttribute('height');
      }
      if (!iframe.hasAttribute('referrerpolicy')) iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      mount.replaceChildren(iframe);
    });

    root.querySelectorAll('.spacer-block, .dx-block-website-component[data-definition-name="website.components.spacer"]').forEach((node) => {
      node.remove();
    });

    root.querySelectorAll('.dx-block.dx-block-html').forEach((block) => {
      const html = block.querySelector('.dx-html-content');
      if (!html) return;
      const hasMedia = !!html.querySelector('img, iframe, video, figure');
      const plain = text(html.textContent).replace(/[\s\u00A0]+/g, '');
      if (!hasMedia && plain.length === 0) {
        block.remove();
      }
    });

    const emptySelectors = [
      '.dx-block-content',
      '.dx-html-content',
      '.sqsrte-scaled-text-container',
      '.sqsrte-scaled-text',
      'p',
      'div',
      'span',
    ];

    const hasVisualPayload = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.matches('img, video, iframe, figure, audio, canvas, svg, table, ul, ol, blockquote, pre, hr, input, textarea, button, select')) {
        return true;
      }
      if (
        node.querySelector(
          'img, video, iframe, figure, audio, canvas, svg, table, ul, ol, blockquote, pre, hr, input, textarea, button, select, .dx-block-button-container',
        )
      ) {
        return true;
      }
      const plain = text(node.textContent).replace(/[\s\u00A0]+/g, '');
      return plain.length > 0;
    };

    for (let pass = 0; pass < 4; pass += 1) {
      let removedAny = false;
      root.querySelectorAll(emptySelectors.join(', ')).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node === root) return;
        if (hasVisualPayload(node)) return;
        node.remove();
        removedAny = true;
      });
      if (!removedAny) break;
    }

    root.querySelectorAll('iframe').forEach((iframe) => {
      iframe.classList.add('dx-dexnotes-legacy-iframe');
      const source = text(iframe.getAttribute('src')).toLowerCase();
      if (source.includes('youtube') || source.includes('vimeo')) {
        iframe.removeAttribute('width');
        iframe.removeAttribute('height');
      }
    });

    const isLayoutWrapper = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node === root) return false;
      if (node.classList.contains('dx-layout') || node.classList.contains('dx-row') || node.classList.contains('row') || node.classList.contains('col')) {
        return true;
      }
      return [...node.classList].some((name) => name.startsWith('dx-col-') || name.startsWith('span-') || name === 'columns-12' || name === 'dx-grid-12');
    };

    for (let pass = 0; pass < 3; pass += 1) {
      let changed = false;
      root.querySelectorAll('div, section, article').forEach((node) => {
        if (!isLayoutWrapper(node)) return;
        const parent = node.parentNode;
        if (!(parent instanceof Node)) return;
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        node.remove();
        changed = true;
      });
      if (!changed) break;
    }

    for (let pass = 0; pass < 2; pass += 1) {
      let removedAny = false;
      root.querySelectorAll(emptySelectors.join(', ')).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node === root) return;
        if (hasVisualPayload(node)) return;
        node.remove();
        removedAny = true;
      });
      if (!removedAny) break;
    }

    const imageBlocks = Array.from(root.querySelectorAll('.dx-block.image-block')).filter((node) => node instanceof HTMLElement);
    const parseDimensions = (block) => {
      const img = block.querySelector('img');
      if (!(img instanceof HTMLElement)) return { width: 0, height: 0 };
      const raw = text(img.getAttribute('data-image-dimensions') || `${img.getAttribute('width') || ''}x${img.getAttribute('height') || ''}`);
      const match = raw.match(/(\d+)\s*x\s*(\d+)/i);
      if (!match) return { width: 0, height: 0 };
      return { width: Number(match[1]) || 0, height: Number(match[2]) || 0 };
    };
    const heroIndex = (() => {
      if (imageBlocks.length === 0) return -1;
      let bestIndex = 0;
      let bestScore = -Infinity;
      imageBlocks.slice(0, 5).forEach((block, index) => {
        const dims = parseDimensions(block);
        const img = block.querySelector('img');
        const sizes = text(img?.getAttribute('sizes')).toLowerCase();
        let score = 0;
        if (dims.width >= 1800) score += 5;
        else if (dims.width >= 1400) score += 4;
        else if (dims.width >= 1100) score += 3;
        else if (dims.width >= 800) score += 2;
        if (sizes.includes('100vw')) score += 2;
        if (index === 0) score += 1;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      return bestIndex;
    })();

    let nonHeroCounter = 0;
    imageBlocks.forEach((block, index) => {
      if (index === heroIndex) {
        block.setAttribute('data-dx-legacy-media-align', 'hero');
        return;
      }
      const align = nonHeroCounter % 2 === 0 ? 'left' : 'right';
      block.setAttribute('data-dx-legacy-media-align', align);
      nonHeroCounter += 1;
    });

    const isEmptyNode = (node) =>
      !node.querySelector('img, video, iframe, figure, ul, ol, blockquote, pre, table') &&
      text(node.textContent).replace(/[\s\u00A0]+/g, '').length === 0;

    const isPairableTextBlock = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (!node.matches('.dx-block.html-block, .dx-block.dx-block-html, .dx-block.quote-block')) return false;
      if (node.querySelector('img, video, iframe, figure, .dx-video-wrapper, .dx-block-image-figure')) return false;
      const plain = text(node.textContent).replace(/[\s\u00A0]+/g, ' ').trim();
      return plain.length >= 50;
    };

    const findNeighborTextBlock = (imageBlock, direction, claimed) => {
      let cursor = direction > 0 ? imageBlock.nextElementSibling : imageBlock.previousElementSibling;
      while (cursor) {
        if (!(cursor instanceof HTMLElement)) break;
        if (isEmptyNode(cursor)) {
          cursor = direction > 0 ? cursor.nextElementSibling : cursor.previousElementSibling;
          continue;
        }
        if (claimed.has(cursor)) return null;
        if (isPairableTextBlock(cursor)) return cursor;
        if (cursor.matches('.dx-block.image-block, .dx-block.video-block, .dx-block.embed-block')) return null;
        if (cursor.matches('.dx-dexnotes-legacy-media-row')) return null;
        cursor = direction > 0 ? cursor.nextElementSibling : cursor.previousElementSibling;
      }
      return null;
    };

    const claimedTextBlocks = new WeakSet();
    root.querySelectorAll('.dx-block.image-block[data-dx-legacy-media-align="left"], .dx-block.image-block[data-dx-legacy-media-align="right"]').forEach((imageBlock) => {
      if (!(imageBlock instanceof HTMLElement)) return;
      if (imageBlock.closest('.dx-dexnotes-legacy-media-row')) return;
      const parent = imageBlock.parentNode;
      if (!(parent instanceof Node)) return;
      const align = text(imageBlock.getAttribute('data-dx-legacy-media-align'));
      const nextText = findNeighborTextBlock(imageBlock, 1, claimedTextBlocks);
      const prevText = findNeighborTextBlock(imageBlock, -1, claimedTextBlocks);
      const textBlock = nextText || prevText;
      if (!textBlock || textBlock.parentNode !== parent) return;

      const row = document.createElement('div');
      row.className = `dx-dexnotes-legacy-media-row dx-dexnotes-legacy-media-row--${align}`;
      imageBlock.classList.add('dx-dexnotes-legacy-media-card');
      textBlock.classList.add('dx-dexnotes-legacy-media-text');
      claimedTextBlocks.add(textBlock);

      const textBeforeImage = !!(textBlock.compareDocumentPosition(imageBlock) & Node.DOCUMENT_POSITION_FOLLOWING);
      const anchor = textBeforeImage ? textBlock : imageBlock;
      parent.insertBefore(row, anchor);
      if (align === 'right') {
        row.appendChild(textBlock);
        row.appendChild(imageBlock);
      } else {
        row.appendChild(imageBlock);
        row.appendChild(textBlock);
      }
    });

    root.querySelectorAll('.image-caption-wrapper, .image-card-wrapper, .image-caption, .image-card, .image-title-wrapper, .image-title').forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.classList.add('dx-dexnotes-legacy-caption');
    });

    root.querySelectorAll('.image-inset[data-description]').forEach((inset) => {
      if (!(inset instanceof HTMLElement)) return;
      const figure = inset.closest('figure');
      if (!(figure instanceof HTMLElement)) return;
      if (figure.querySelector('.image-caption-wrapper, .image-card-wrapper, figcaption')) return;
      const source = text(inset.getAttribute('data-description'));
      if (!source) return;
      const template = document.createElement('template');
      template.innerHTML = source;
      const captionText = text(template.content.textContent).replace(/[ \t\r\n]+/g, ' ').trim();
      if (!captionText) return;
      const caption = document.createElement('figcaption');
      caption.className = 'image-caption-wrapper dx-dexnotes-legacy-caption';
      const copy = document.createElement('p');
      copy.textContent = captionText;
      caption.appendChild(copy);
      figure.appendChild(caption);
    });

    root.querySelectorAll('.dx-block-button-container').forEach((container) => {
      if (!(container instanceof HTMLElement)) return;
      container.classList.add('dx-dexnotes-legacy-button-row');
    });

    root.querySelectorAll('a.dx-block-button-element, a.dx-button-element').forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      button.classList.add('dx-dexnotes-legacy-button', 'dx-button-element');
      if (!button.classList.contains('dx-button-element--primary') && !button.classList.contains('dx-button-element--secondary')) {
        button.classList.add('dx-button-element--secondary');
      }
      if (![...button.classList].some((name) => name.startsWith('dx-button-size--'))) {
        button.classList.add('dx-button-size--sm');
      }
    });
  }

  function renderRelatedRail(entry) {
    const rail = create('aside', 'dx-dexnotes-entry-rail');
    rail.appendChild(create('h2', 'dx-dexnotes-entry-rail-title', 'CONTEXT RAIL'));

    const related = Array.isArray(entry.related_entries) ? entry.related_entries : [];
    if (related.length === 0) {
      rail.appendChild(create('p', 'dx-dexnotes-copy', 'No related entries available yet.'));
    } else {
      const list = create('ul', 'dx-dexnotes-entry-related-list');
      related.slice(0, 6).forEach((item) => {
        const row = create('li', 'dx-dexnotes-entry-related-item');
        const link = create('a', 'dx-dexnotes-entry-related-link', text(item.title_raw));
        link.href = text(item.route_path || `/dexnotes/${text(item.slug)}/`);
        row.appendChild(link);
        row.appendChild(create('p', 'dx-dexnotes-entry-related-meta', `${text(item.published_display_raw)} • ${text(item.category_label_raw)}`));
        list.appendChild(row);
      });
      rail.appendChild(list);
    }

    const allNotes = create(
      'a',
      'dx-button-element dx-button-size--sm dx-button-element--secondary dx-dexnotes-entry-rail-cta',
      'VIEW ALL NOTES',
    );
    allNotes.href = '/dexnotes/';
    rail.appendChild(allNotes);
    return rail;
  }

  function renderPrevNext(entry) {
    const nav = create('nav', 'dx-dexnotes-surface dx-dexnotes-entry-pagination dx-dexnotes-entry-reveal');
    nav.setAttribute('data-dx-motion', 'pagination');
    nav.setAttribute('aria-label', 'Dex Notes article navigation');
    nav.appendChild(create('h2', 'dx-dexnotes-entry-pagination-title', 'KEEP READING'));

    const row = create('div', 'dx-dexnotes-entry-pagination-row');
    const prev = entry.prev_entry || null;
    const next = entry.next_entry || null;

    if (prev && text(prev.slug)) {
      const prevLink = create('a', 'dx-button-element dx-button-size--md dx-button-element--secondary', `PREVIOUS: ${text(prev.title_raw)}`);
      prevLink.href = text(prev.route_path || `/dexnotes/${text(prev.slug)}/`);
      row.appendChild(prevLink);
    }

    if (next && text(next.slug)) {
      const nextLink = create('a', 'dx-button-element dx-button-size--md dx-button-element--primary', `NEXT: ${text(next.title_raw)}`);
      nextLink.href = text(next.route_path || `/dexnotes/${text(next.slug)}/`);
      row.appendChild(nextLink);
    }

    if (!row.firstChild) {
      row.appendChild(create('p', 'dx-dexnotes-copy', 'No additional entries found.'));
    }

    nav.appendChild(row);
    return nav;
  }

  function hasValidGiscusConfig(config) {
    if (!config || config.enabled !== true) return false;
    const required = ['repo', 'repoId', 'category', 'categoryId'];
    return required.every((key) => text(config[key]).trim().length > 0);
  }

  function renderComments(entry, commentsConfig) {
    const section = create('section', 'dx-dexnotes-surface dx-dexnotes-entry-comments dx-dexnotes-entry-reveal');
    section.appendChild(create('h2', 'dx-dexnotes-entry-comments-title', 'COMMENTS'));

    const fallbackText = text(commentsConfig?.fallback_message_raw || 'Comments unavailable right now. Check back soon.');

    if (!hasValidGiscusConfig(commentsConfig)) {
      const fallback = create('div', 'dx-dexnotes-comments-fallback');
      fallback.appendChild(create('p', 'dx-dexnotes-copy', fallbackText));
      section.appendChild(fallback);
      return section;
    }

    const mount = create('div', 'dx-dexnotes-comments-mount');
    section.appendChild(mount);

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-repo', text(commentsConfig.repo));
    script.setAttribute('data-repo-id', text(commentsConfig.repoId));
    script.setAttribute('data-category', text(commentsConfig.category));
    script.setAttribute('data-category-id', text(commentsConfig.categoryId));
    script.setAttribute('data-mapping', text(commentsConfig.mapping || 'pathname'));
    script.setAttribute('data-term', text(entry.slug));
    script.setAttribute('data-strict', text(commentsConfig.strict || '0'));
    script.setAttribute('data-reactions-enabled', text(commentsConfig.reactionsEnabled || '1'));
    script.setAttribute('data-emit-metadata', text(commentsConfig.emitMetadata || '0'));
    script.setAttribute('data-input-position', text(commentsConfig.inputPosition || 'bottom'));
    script.setAttribute('data-theme', text(commentsConfig.theme || 'preferred_color_scheme'));
    script.setAttribute('data-lang', text(commentsConfig.lang || 'en'));
    script.setAttribute('data-loading', text(commentsConfig.loading || 'lazy'));
    mount.appendChild(script);

    return section;
  }

  function tuneBodyLinks(scope) {
    scope.querySelectorAll('.dx-dexnotes-entry-body a').forEach((node) => {
      node.classList.add('dx-dexnotes-link');
    });
  }

  function renderNotFound(app, slug) {
    clearNode(app);
    app.removeAttribute('data-dx-entry-mode');
    app.removeAttribute('data-dexnotes-slug');
    const panel = create('section', 'dx-dexnotes-surface dx-dexnotes-error');
    panel.appendChild(create('h1', 'dx-dexnotes-title', 'STORY NOT FOUND.'));
    panel.appendChild(create('p', 'dx-dexnotes-copy', `No Dex Notes entry found for slug "${slug}".`));
    const link = create('a', 'dx-button-element dx-button-size--md dx-button-element--secondary', 'BACK TO DEX NOTES');
    link.href = '/dexnotes/';
    panel.appendChild(link);
    app.appendChild(panel);
  }

  function renderEntry(app, entry, commentsConfig) {
    clearNode(app);

    const isLegacyBody = text(entry.body_mode) === 'raw_html';
    app.setAttribute('data-dx-entry-mode', isLegacyBody ? 'raw_html' : 'markdown');
    app.setAttribute('data-dexnotes-slug', text(entry.slug));
    const mast = create('header', 'dx-dexnotes-surface dx-dexnotes-entry-mast dx-dexnotes-entry-reveal');
    mast.appendChild(create('p', 'dx-dexnotes-kicker', 'DEX NOTES'));
    mast.appendChild(create('h1', 'dx-dexnotes-title', text(entry.title_raw)));
    if (text(entry.excerpt_raw)) mast.appendChild(create('p', 'dx-dexnotes-copy', text(entry.excerpt_raw)));
    mast.appendChild(buildMetaRail(entry));

    if (text(entry.cover_image_src) && !isLegacyBody) {
      const coverLink = create('a', 'dx-dexnotes-entry-cover-link');
      coverLink.href = text(entry.cover_image_src);
      if (isExternalHref(coverLink.href)) {
        coverLink.target = '_blank';
        coverLink.rel = 'noopener noreferrer';
      }
      const img = create('img', 'dx-dexnotes-entry-cover');
      img.src = text(entry.cover_image_src);
      img.alt = text(entry.cover_image_alt_raw);
      img.loading = 'lazy';
      img.decoding = 'async';
      coverLink.appendChild(img);
      mast.appendChild(coverLink);
    }
    app.appendChild(mast);

    const contentSurface = create('section', 'dx-dexnotes-surface dx-dexnotes-entry-content dx-dexnotes-entry-reveal');
    const layout = create('div', 'dx-dexnotes-entry-layout');
    const bodyWrap = create('div', 'dx-dexnotes-entry-body-wrap');
    const body = create('div', 'dx-dexnotes-entry-body');
    body.innerHTML = text(entry.body_html || '');
    normalizeLegacyBody(body);
    annotateExternalLinks(body);
    bodyWrap.appendChild(body);
    bodyWrap.appendChild(renderRelatedRail(entry));
    layout.appendChild(bodyWrap);
    contentSurface.appendChild(layout);
    app.appendChild(contentSurface);

    app.appendChild(renderPrevNext(entry));
    app.appendChild(renderComments(entry, commentsConfig));

    const newsletter = create('section', 'dx-dexnotes-surface dx-dexnotes-entry-newsletter dx-dexnotes-entry-reveal');
    newsletter.appendChild(create('p', 'dx-dexnotes-kicker', 'Newsletter'));
    newsletter.appendChild(create('h2', 'dx-dexnotes-entry-pagination-title', 'Enjoyed this article? Subscribe for future notes.'));
    newsletter.appendChild(
      create(
        'p',
        'dx-dexnotes-copy dx-dexnotes-entry-newsletter-copy',
        'Receive new Dex Notes stories, release updates, and open-call highlights.',
      ),
    );
    const newsletterMount = create('div', 'dx-dexnotes-entry-newsletter-mount');
    newsletterMount.setAttribute('data-dx-marketing-newsletter-mount', 'dexnotes-article-page');
    newsletter.appendChild(newsletterMount);
    const newsletterPrivacy = create('a', 'dx-dexnotes-entry-newsletter-privacy', 'Read privacy policy');
    newsletterPrivacy.href = '/privacy/';
    newsletter.appendChild(newsletterPrivacy);
    app.appendChild(newsletter);
    mountMarketingNewsletter(newsletterMount, {
      source: 'dexnotes-article-page',
      formClassName: 'dx-dexnotes-entry-newsletter-form',
      inputClassName: 'dx-dexnotes-entry-newsletter-input',
      submitClassName: 'dx-button-element dx-button-size--sm dx-button-element--secondary dx-dexnotes-entry-newsletter-submit',
      feedbackClassName: 'dx-dexnotes-entry-newsletter-feedback',
      submitLabel: 'Subscribe',
      submitBusyLabel: 'Submitting...',
    });

    revealStagger(app, '.dx-dexnotes-entry-reveal', {
      key: 'dexnotes-entry-reveal',
      y: 20,
      duration: 0.42,
      stagger: 0.038,
      threshold: 0.13,
      rootMargin: '0px 0px -6% 0px',
      initialHidden: false,
    });
    bindDexButtonMotion(app, {
      selector: '.dx-button-element, .dx-dexnotes-entry-related-item, .dx-dexnotes-entry-cover-link',
    });
    bindPaginationMotion(app);
    tuneBodyLinks(app);
    bindProgress();
    scheduleProgressUpdate();
    Promise.resolve().then(() => mountPollEmbeds({ root: app })).catch(() => {});
  }

  async function loadJson(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`Unable to load ${url} (HTTP ${response.status})`);
    }
    return response.json();
  }

  function renderError(app, error) {
    clearNode(app);
    app.removeAttribute('data-dx-entry-mode');
    app.removeAttribute('data-dexnotes-slug');
    const panel = create('section', 'dx-dexnotes-surface dx-dexnotes-error');
    panel.appendChild(create('h1', 'dx-dexnotes-title', 'DEX NOTES FAILED TO LOAD.'));
    panel.appendChild(create('p', 'dx-dexnotes-copy', text(error?.message || 'Unknown Dex Notes error.')));
    app.appendChild(panel);
  }

  async function bootstrap() {
    const app = document.querySelector(APP_SELECTOR);
    if (!app) return;

    installLifecycleCleanup();
    const slug = normalizeSlug(app.getAttribute('data-dexnotes-slug') || slugFromPathname());
    startBlobMotion();

    try {
      const [entriesPayload, commentsConfig] = await Promise.all([loadJson(ENTRIES_URL), loadJson(COMMENTS_URL).catch(() => ({}))]);
      const entries = Array.isArray(entriesPayload?.entries) ? entriesPayload.entries : [];
      const entry = entries.find((item) => normalizeSlug(item.slug) === slug);
      if (!entry) {
        renderNotFound(app, slug);
      } else {
        renderEntry(app, entry, commentsConfig || {});
      }
    } catch (error) {
      renderError(app, error);
    }
  }

  bootstrap();
})();
