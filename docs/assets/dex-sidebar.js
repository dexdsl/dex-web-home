(function () {
  if (window.__dexSidebarRuntimeBound) return;
  window.__dexSidebarRuntimeBound = true;

  const ALL_BUCKETS = ['A', 'B', 'C', 'D', 'E', 'X'];
  const normalizeBuckets = (pageBuckets) => (Array.isArray(pageBuckets) ? pageBuckets : []);

  const prefersReducedMotion = () => {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  };

  const animateNode = (node, keyframes, options) => {
    if (!node || prefersReducedMotion()) return null;
    if (typeof node.animate !== 'function') return null;
    try {
      return node.animate(keyframes, options);
    } catch {
      return null;
    }
  };

  const buildBucketsHtml = (pageBuckets) => {
    const selected = normalizeBuckets(pageBuckets);
    return ALL_BUCKETS
      .map((bucket) => {
        const cls = selected.includes(bucket) ? 'available' : 'unavailable';
        return `<span class="badge ${cls}">${bucket}</span>`;
      })
      .join('');
  };

  const getSidebarAssetOrigin = () => {
    const s = document.querySelector('script[src*="dex-sidebar.js"]');
    if (s && s.src) {
      try {
        return new URL(s.src, window.location.href).origin;
      } catch {}
    }
    return window.location.origin;
  };

  const seriesKey = (page) => {
    const raw = String(page.series || '').toLowerCase();
    if (raw === 'index' || raw === 'indes') return 'index';
    if (raw === 'dexfest') return 'dexfest';
    if (raw === 'dex') return 'dex';
    const u = String(page.specialEventImage || '').toLowerCase();
    if (u.includes('dexfest')) return 'dexfest';
    if (u.includes('/index')) return 'index';
    return 'dex';
  };

  const parseJsonScript = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || '{}');
    } catch (error) {
      console.error(`Invalid JSON in #${id}`, error);
      return null;
    }
  };

  const pin = (person) => {
    if (!person || typeof person === 'string') return person || '';
    const name = person.name || '';
    const links = Array.isArray(person.links) ? person.links : [];
    return `<span data-person="${name}" data-links='${JSON.stringify(links)}' style="position:relative; cursor:pointer;">${name}<span class="person-pin"></span></span>`;
  };

  const randomizeTitle = (txt) => String(txt || '').toUpperCase();

  const render = (sel, title, html, noHeader = false) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const header = noHeader ? '' : `<h3>${randomizeTitle(title)}</h3>`;
    el.innerHTML = `${header}${html}`;
  };

  const buildUrl = (cfg, type, bucket, key) => {
    const id = type === 'audio' ? cfg.downloads.audioFileIds?.[bucket]?.[key] : cfg.downloads.videoFileIds?.[bucket]?.[key];
    if (!id) return '#';
    return cfg.downloads.driveBase + encodeURIComponent(id);
  };

  const attach = (cfg, type, btnSel) => {
    const btn = document.querySelector(btnSel);
    if (!btn || btn.dataset.dexBound === '1') return;
    btn.dataset.dexBound = '1';
    btn.addEventListener('click', () => {
      const formats = cfg.downloads.formats[type] || [];
      const allBuckets = ALL_BUCKETS;
      const links = [];
      allBuckets.forEach((bucket) => {
        const fileIds = (type === 'audio' ? cfg.downloads.audioFileIds?.[bucket] : cfg.downloads.videoFileIds?.[bucket]) || {};
        const bucketAvailable = Object.values(fileIds).some(Boolean);
        formats.forEach((fmt) => {
          const href = buildUrl(cfg, type, bucket, fmt.key);
          if (href !== '#') {
            links.push(`<a href="${href}" target="_blank" rel="noopener">${bucket} · ${fmt.label}</a>`);
          } else if (!bucketAvailable) {
            links.push(`<span aria-disabled="true" style="opacity:.5;cursor:not-allowed;">${bucket} · ${fmt.label} (unavailable)</span>`);
          }
        });
      });
      const modal = document.createElement('div');
      modal.className = 'dex-download-modal';
      modal.innerHTML = `<div class="dex-download-modal-inner"><button class="close" aria-label="Close">×</button>${links.join('')}</div>`;
      document.body.appendChild(modal);
      modal.querySelector('.close')?.addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
      });
    });
  };

  const initPersonPins = () => {
    document.querySelectorAll('[data-person]').forEach((holder) => {
      if (holder.dataset.dexPinBound === '1') return;
      holder.dataset.dexPinBound = '1';
      holder.style.cursor = 'pointer';
      holder.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.person-popup').forEach((p) => p.remove());
        const links = JSON.parse(holder.getAttribute('data-links') || '[]');
        const pop = document.createElement('div');
        pop.className = 'person-popup';
        pop.innerHTML = links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join('');
        document.body.append(pop);
        pop.style.position = 'absolute';
        pop.style.left = `${e.pageX + 4}px`;
        pop.style.top = `${e.pageY + 4}px`;
        setTimeout(() => {
          document.addEventListener('click', function handler(evt) {
            if (!pop.contains(evt.target)) {
              pop.remove();
              document.removeEventListener('click', handler);
            }
          });
        }, 0);
      });
    });
  };

  const installSidebarRevealMotion = () => {
    if (prefersReducedMotion()) return;
    if (!(window.IntersectionObserver && typeof window.IntersectionObserver === 'function')) return;

    const sections = Array.from(document.querySelectorAll('.dex-sidebar section'));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target;
          if (node.dataset.dexMotionReveal === '1') {
            instance.unobserve(node);
            return;
          }
          node.dataset.dexMotionReveal = '1';
          const index = Number(node.dataset.dexMotionRevealIndex || 0);
          animateNode(
            node,
            [
              { opacity: 0, transform: 'translate3d(0, 14px, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            ],
            {
              duration: 320,
              delay: Math.min(index * 28, 240),
              easing: 'cubic-bezier(.22,.8,.24,1)',
              fill: 'both',
            },
          );
          instance.unobserve(node);
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    sections.forEach((section, index) => {
      if (section.dataset.dexMotionReveal === '1') return;
      section.dataset.dexMotionRevealIndex = String(index);
      section.style.opacity = '0';
      section.style.transform = 'translate3d(0, 14px, 0)';
      observer.observe(section);
    });
  };

  const installSidebarInteractiveMotion = () => {
    if (prefersReducedMotion()) return;
    const nodes = Array.from(
      document.querySelectorAll('.dex-sidebar section, .dex-sidebar .license-btn, .dex-sidebar #downloads .btn-audio, .dex-sidebar #downloads .btn-video'),
    );
    nodes.forEach((node) => {
      if (node.dataset.dexMotionBound === '1') return;
      node.dataset.dexMotionBound = '1';
      node.addEventListener('pointerenter', () => {
        animateNode(
          node,
          [
            { transform: 'translate3d(0, 0, 0) scale(1)' },
            { transform: 'translate3d(0, -2px, 0) scale(1.01)' },
          ],
          {
            duration: 180,
            easing: 'cubic-bezier(.2,.9,.25,1)',
            fill: 'forwards',
          },
        );
      });
      node.addEventListener('pointerleave', () => {
        animateNode(
          node,
          [
            { transform: 'translate3d(0, -2px, 0) scale(1.01)' },
            { transform: 'translate3d(0, 0, 0) scale(1)' },
          ],
          {
            duration: 140,
            easing: 'cubic-bezier(.22,.8,.24,1)',
            fill: 'forwards',
          },
        );
      });
    });
  };

  const boot = () => {
    if (document.documentElement.dataset.dexSidebarRendered === '1') return;

    const globalCfg = parseJsonScript('dex-sidebar-config');
    if (!globalCfg) return;
    const manifest = parseJsonScript('dex-manifest');
    if (!manifest) return;

    const pageJson = parseJsonScript('dex-sidebar-page-config');
    const page = pageJson || window.dexSidebarPageConfig;
    if (!page) {
      console.error('Missing per-page sidebar config');
      return;
    }

    const credits = page.credits || {};
    const cfg = {
      license: globalCfg.license,
      attributionSentence: page.attributionSentence,
      credits: {
        ...credits,
        artist: pin(credits.artist),
        artistAlt: credits.artistAlt,
        instruments: (credits.instruments || []).map(pin),
        video: {
          director: pin(credits.video?.director),
          cinematography: pin(credits.video?.cinematography),
          editing: pin(credits.video?.editing),
        },
        audio: {
          recording: pin(credits.audio?.recording),
          mix: pin(credits.audio?.mix),
          master: pin(credits.audio?.master),
        },
      },
      downloads: {
        driveBase: 'https://drive.google.com/uc?export=download&id=',
        formats: globalCfg.downloads.formats,
        audioFileIds: manifest.audio || {},
        videoFileIds: manifest.video || {},
      },
      fileSpecs: page.fileSpecs || {},
      metadata: page.metadata || {},
    };

    const lookup = page.lookupNumber || '';
    const selected = normalizeBuckets(page.buckets);
    const badgesHtml = ALL_BUCKETS
      .map((bucket) => {
        const cls = selected.includes(bucket) ? 'available' : 'unavailable';
        return `<span class="badge ${cls}">${bucket}</span>`;
      })
      .join('');
    const origin = getSidebarAssetOrigin();
    const SERIES_PATHS = {
      dex: '/assets/series/dex.png',
      index: '/assets/series/index.png',
      dexfest: '/assets/series/dexfest.png',
    };
    const sk = seriesKey(page);
    const seriesSrc = new URL(SERIES_PATHS[sk] || SERIES_PATHS.dex, origin).toString();
    const overviewEl = document.querySelector('.dex-overview');
    if (overviewEl) {
      overviewEl.innerHTML = `
        <div class="overview-item">
          <span class="overview-lookup">#${lookup}</span>
          <p class="p3 overview-label">Lookup #</p>
        </div>
        <div class="overview-item">
          <img src="${seriesSrc}" alt="Series" class="overview-series-img"/>
          <p class="p3 overview-label">Series</p>
        </div>
        <div class="overview-item">
          <div class="overview-badges">${badgesHtml}</div>
          <p class="p3 overview-label">Buckets</p>
        </div>
      `;
    }

    render('.dex-license', 'License', `
      <a class="dex-license-badge" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener"><img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/by.svg" alt="Creative Commons Attribution 4.0" class="badge-by"/></a>
      <p class="dex-attrib">This work contains samples licensed under CC-BY 4.0 by Dex Digital Sample Library and ${cfg.credits.artist}</p>
      <div class="dex-license-controls">
        <button type="button" class="license-btn copy-btn dx-button-element--primary" title="Copy attribution"><span class="copy-text">Copy</span></button>
        <button type="button" class="license-btn usage-btn dx-button-element--primary" onclick="window.open('https://dexdsl.com/copyright','_blank')">Usage Notes</button>
      </div>
    `);

    const copyBtn = document.querySelector('.dex-license .copy-btn');
    if (copyBtn && copyBtn.dataset.dexBound !== '1') {
      copyBtn.dataset.dexBound = '1';
      copyBtn.addEventListener('click', () => {
        const txt = `This work contains samples licensed under CC-BY 4.0 by Dex Digital Sample Library and ${cfg.credits.artist}`;
        navigator.clipboard?.writeText(txt);
        const span = copyBtn.querySelector('.copy-text');
        const orig = span?.textContent || 'Copy';
        if (span) {
          span.textContent = 'Copied!';
          setTimeout(() => {
            span.textContent = orig;
          }, 2000);
        }
      });
    }

    render('.dex-credits', 'Credits', `
      <p><strong>${cfg.credits.artist}</strong>${cfg.credits.artistAlt ? `<br>${cfg.credits.artistAlt}` : ''}</p>
      <p>${(cfg.credits.instruments || []).join(', ')}</p>
      <p><em>Video:</em> Dir:${cfg.credits.video.director}, Cin:${cfg.credits.video.cinematography}, Edit:${cfg.credits.video.editing}</p>
      <p><em>Audio:</em> Rec:${cfg.credits.audio.recording}, Mix:${cfg.credits.audio.mix}, Master:${cfg.credits.audio.master}</p>
      <div class="dex-badges">
        <span class="badge">${cfg.credits.season || ''} ${cfg.credits.year || ''}</span>
        <span class="badge">${cfg.credits.location || ''}</span>
      </div>
    `);

    render('#downloads', 'Download', `<p>Please choose the asset you’d like to download:</p><button type="button" class="btn-audio dx-button-element--primary" aria-label="Download Audio"><span>${randomizeTitle('Audio Files')}</span></button><button type="button" class="btn-video dx-button-element--primary" aria-label="Download Video"><span>${randomizeTitle('Video Files')}</span></button>`, true);
    render('#file-specs', 'File Specs', `<p>All files are provided with the following specs:</p><div class="dex-badges"><span class="badge">🎚 ${cfg.fileSpecs.bitDepth || ''}-bit</span><span class="badge">🔊 ${cfg.fileSpecs.sampleRate || ''} Hz</span><span class="badge">🎧 ${cfg.fileSpecs.channels || ''}</span></div><div class="dex-badges">${Object.entries(cfg.fileSpecs.staticSizes || {}).map(([b, s]) => `<span class="badge">📁 ${b}: ${s}</span>`).join('')}</div>`, true);
    render('#metadata', 'Metadata', `<p>This sample contains the following metadata:</p><div class="dex-badges"><span class="badge">⏱ Length: ${cfg.metadata.sampleLength || ''}</span><span class="badge">🏷 Tags: ${(cfg.metadata.tags || []).join(', ')}</span></div>`, true);

    document.querySelectorAll('.file-info-tabs button').forEach((btn) => {
      if (btn.dataset.dexBound === '1') return;
      btn.dataset.dexBound = '1';
      btn.addEventListener('click', () => {
        const owner = btn.closest('.dex-file-info') || btn.closest('.dex-sidebar') || document;
        const panels = Array.from(owner.querySelectorAll('.file-info-panels > div'));
        const previous = panels.find((panel) => !panel.hidden) || null;
        document.querySelectorAll('.file-info-tabs button').forEach((b) => b.setAttribute('aria-selected', 'false'));
        btn.setAttribute('aria-selected', 'true');
        const target = btn.dataset.tab;
        document.querySelectorAll('.file-info-panels > div').forEach((panel) => {
          panel.hidden = panel.id !== target;
        });

        requestAnimationFrame(() => {
          const next = panels.find((panel) => !panel.hidden) || null;
          if (previous && previous !== next) {
            animateNode(
              previous,
              [
                { opacity: 1, transform: 'translate3d(0, 0, 0)' },
                { opacity: 0, transform: 'translate3d(0, 4px, 0)' },
              ],
              {
                duration: 160,
                easing: 'cubic-bezier(.4,0,.2,1)',
                fill: 'forwards',
              },
            );
          }
          if (next) {
            animateNode(
              next,
              [
                { opacity: 0, transform: 'translate3d(0, -4px, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' },
              ],
              {
                duration: 200,
                easing: 'cubic-bezier(.22,.8,.24,1)',
                fill: 'both',
              },
            );
          }
        });
      });
    });

    attach(cfg, 'audio', '#downloads .btn-audio');
    attach(cfg, 'video', '#downloads .btn-video');
    initPersonPins();
    installSidebarRevealMotion();
    installSidebarInteractiveMotion();

    document.documentElement.dataset.dexSidebarRendered = '1';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
