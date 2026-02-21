const MARKERS = {
  video: ['DEX:VIDEO_START', 'DEX:VIDEO_END'],
  desc: ['DEX:DESC_START', 'DEX:DESC_END'],
  sidebar: ['DEX:SIDEBAR_PAGE_CONFIG_START', 'DEX:SIDEBAR_PAGE_CONFIG_END'],
};

const AUTH_CANDIDATES = ['/assets/dex-auth0-config.js', '/assets/dex-auth-config.js'];
const AUTH_CDN = 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js';
const REQUIRED_ANCHORS = ['video', 'desc', 'sidebar'];
const REQUIRED_CONTRACT_SCRIPT_IDS = ['dex-sidebar-config', 'dex-sidebar-page-config', 'dex-manifest'];
const PAGE_CONFIG_BRIDGE_SCRIPT_ID = 'dex-sidebar-page-config-bridge';
const BREADCRUMB_BACK_HREF = '/catalog';
const BREADCRUMB_MOTION_RUNTIME_SRC = 'https://dexdsl.github.io/assets/js/dex-breadcrumb-motion.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtmlTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeAttrEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function encodeAttrEntities(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeNameList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  if (value && typeof value === 'object' && typeof value.name === 'string') {
    return value.name.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function firstName(value) {
  return normalizeNameList(value)[0] || '';
}

function normalizeCanonicalValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function deriveCanonicalEntry({ canonical, sidebarConfig, creditsData } = {}) {
  const inputCanonical = canonical && typeof canonical === 'object' ? canonical : {};
  const instrument = normalizeCanonicalValue(
    inputCanonical.instrument
    || firstName(creditsData?.instruments)
    || firstName(sidebarConfig?.credits?.instruments),
  );
  const artistName = normalizeCanonicalValue(
    inputCanonical.artistName
    || firstName(creditsData?.artist)
    || firstName(sidebarConfig?.credits?.artist),
  );
  return { instrument, artistName };
}

export function formatBreadcrumbCurrentLabel(canonical = {}) {
  const instrument = normalizeCanonicalValue(canonical.instrument);
  const artistName = normalizeCanonicalValue(canonical.artistName);
  if (instrument && artistName) return `${instrument}, ${artistName}`.toLowerCase();
  if (instrument) return instrument.toLowerCase();
  if (artistName) return artistName.toLowerCase();
  return 'entry';
}

export function resolveBreadcrumbBackStrategy({ referrer = '', locationOrigin = '', locationPath = '', historyLength = 0 } = {}) {
  const fallbackHref = BREADCRUMB_BACK_HREF;
  try {
    if (!referrer || !locationOrigin || Number(historyLength || 0) < 2) return { useHistoryBack: false, fallbackHref };
    const ref = new URL(String(referrer), String(locationOrigin));
    if (ref.origin !== String(locationOrigin)) return { useHistoryBack: false, fallbackHref };
    const currentPath = String(locationPath || '');
    const previousPath = `${ref.pathname}${ref.search}`;
    if (previousPath === currentPath) return { useHistoryBack: false, fallbackHref };
    return { useHistoryBack: true, fallbackHref };
  } catch {
    return { useHistoryBack: false, fallbackHref };
  }
}

function pinFor(name) {
  const safeName = escapeHtml(name);
  const linksJson = JSON.stringify([]);
  return `<span data-person="${safeName}" data-links='${linksJson}' style="position:relative; cursor:pointer;">${safeName}<span class="person-pin"></span></span>`;
}

function pinsString(names) {
  return normalizeNameList(names).map(pinFor).join(', ');
}

export function compileSidebarCredits(credits = {}) {
  return {
    artist: pinsString(credits.artist),
    artistAlt: credits.artistAlt ?? null,
    instruments: normalizeNameList(credits.instruments).map(pinFor),
    video: {
      director: pinsString(credits.video?.director),
      cinematography: pinsString(credits.video?.cinematography),
      editing: pinsString(credits.video?.editing),
    },
    audio: {
      recording: pinsString(credits.audio?.recording),
      mix: pinsString(credits.audio?.mix),
      master: pinsString(credits.audio?.master),
    },
    year: credits.year,
    season: credits.season,
    location: credits.location,
  };
}

export function descriptionTextFromSeed(seed = {}) {
  if (typeof seed.descriptionText === 'string') return seed.descriptionText;
  if (typeof seed.descriptionHtml === 'string') return stripHtmlTags(seed.descriptionHtml);
  return '';
}

export function descriptionTextToHtml(descriptionText) {
  const value = String(descriptionText || '').trim();
  if (!value) return '<p></p>';
  return `<p>${escapeHtml(value)}</p>`;
}

function markerTokens(html, key) {
  const [startCore, endCore] = MARKERS[key];
  const start = `<!-- ${startCore} -->`;
  const end = `<!-- ${endCore} -->`;
  return { start, end };
}

function getAnchoredRegion(html, key) {
  const { start, end } = markerTokens(html, key);
  const startIx = html.indexOf(start);
  const endIx = html.indexOf(end);
  if (startIx < 0 || endIx < 0 || endIx <= startIx) {
    if (key === 'video') throw new Error('Template missing DEX:VIDEO anchors');
    throw new Error(`Template must contain anchors: ${start} ... ${end}`);
  }
  return {
    start,
    end,
    startIx,
    endIx,
    contentStart: startIx + start.length,
    contentEnd: endIx,
    content: html.slice(startIx + start.length, endIx),
  };
}

function replaceBetween(html, region, content) {
  return `${html.slice(0, region.contentStart)}\n${content}\n${html.slice(region.contentEnd)}`;
}

function parseUrl(rawUrl) {
  if (!rawUrl) return null;
  const input = String(rawUrl || '').trim();
  if (!input) return null;
  try {
    return new URL(input);
  } catch {}

  if (/^(?:www\.|(?:m\.)?youtube\.com\/|youtu\.be\/|youtube-nocookie\.com\/|vimeo\.com\/|player\.vimeo\.com\/)/i.test(input)) {
    try {
      return new URL(`https://${input}`);
    } catch {}
  }
  return null;
}

function cleanVideoId(value) {
  return String(value || '')
    .trim()
    .split(/[?&#/]/)[0]
    .trim();
}

function isLikelyYouTubeId(value) {
  return /^[A-Za-z0-9_-]{6,}$/.test(String(value || '').trim());
}

export function extractYouTubeId(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return '';
  const parsed = parseUrl(input);
  if (!parsed) return '';

  const host = parsed.hostname.toLowerCase();
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  let id = '';

  if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
    id = cleanVideoId(pathParts[0]);
  } else if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
    if (parsed.searchParams.get('v')) {
      id = cleanVideoId(parsed.searchParams.get('v'));
    } else if (['embed', 'shorts', 'live', 'v'].includes(pathParts[0]) && pathParts[1]) {
      id = cleanVideoId(pathParts[1]);
    }
  }

  return isLikelyYouTubeId(id) ? id : '';
}

export function parseVideoUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return { provider: 'unknown', id: '', embedUrl: '' };

  const parsed = parseUrl(input);
  if (parsed) {
    const youtubeId = extractYouTubeId(input);
    if (youtubeId) {
      return {
        provider: 'youtube',
        id: youtubeId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      };
    }

    const host = parsed.hostname.toLowerCase();
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      let id = '';
      if ((host === 'player.vimeo.com' || host.endsWith('.player.vimeo.com')) && pathParts[0] === 'video' && pathParts[1]) {
        id = cleanVideoId(pathParts[1]);
      } else {
        const numeric = [...pathParts].reverse().find((part) => /^\d+$/.test(part));
        id = cleanVideoId(numeric);
      }
      if (id) {
        return {
          provider: 'vimeo',
          id,
          embedUrl: `https://player.vimeo.com/video/${id}`,
        };
      }
    }
  }

  return { provider: 'unknown', id: '', embedUrl: input };
}

export function normalizeVideoEmbedUrl(url) {
  return parseVideoUrl(url).embedUrl;
}

export function normalizeVideoUrl(url) {
  return normalizeVideoEmbedUrl(url);
}

export function buildVideoIframe(embedUrl) {
  return `<iframe
  src="${escapeHtml(embedUrl)}"
  title="Video"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>`;
}

function buildBreadcrumbMarkup(canonical = {}) {
  const current = escapeHtml(formatBreadcrumbCurrentLabel(canonical));
  return `<div class="dex-breadcrumb-overlay" data-dex-breadcrumb-overlay>
  <div class="dex-breadcrumb" data-dex-breadcrumb>
    <a class="dex-breadcrumb-back" href="${BREADCRUMB_BACK_HREF}" data-dex-breadcrumb-back>catalog</a>
    <span class="dex-breadcrumb-delimiter" data-dex-breadcrumb-delimiter aria-hidden="true">⟡</span>
    <span class="dex-breadcrumb-current">${current}</span>
  </div>
</div>
<script id="dex-breadcrumb-motion-runtime" defer src="${BREADCRUMB_MOTION_RUNTIME_SRC}"></script>
<script id="dex-breadcrumb-motion-bootstrap">
(function(){
  if (window.__dexBreadcrumbMotionBootstrapped) return;
  window.__dexBreadcrumbMotionBootstrapped = true;
  var mount = function(){
    if (typeof window.dexBreadcrumbMotionMount === 'function') window.dexBreadcrumbMotionMount();
  };
  window.addEventListener('dex:breadcrumb-motion-ready', mount);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
</script>
<script id="dex-breadcrumb-back-script">
(function(){
  if (window.__dexBreadcrumbBackBound) return;
  window.__dexBreadcrumbBackBound = true;
  document.addEventListener('click', function(event){
    var trigger = event && event.target && event.target.closest ? event.target.closest('[data-dex-breadcrumb-back]') : null;
    if (!trigger) return;
    var strategy = (function(){
      var fallbackHref = '${BREADCRUMB_BACK_HREF}';
      try {
        if (!document.referrer || !window.location || !window.location.origin || !window.location.pathname || window.history.length < 2) return { useHistoryBack: false, fallbackHref: fallbackHref };
        var ref = new URL(document.referrer, window.location.origin);
        if (ref.origin !== window.location.origin) return { useHistoryBack: false, fallbackHref: fallbackHref };
        var currentPath = window.location.pathname + (window.location.search || '');
        var previousPath = ref.pathname + (ref.search || '');
        if (previousPath === currentPath) return { useHistoryBack: false, fallbackHref: fallbackHref };
        return { useHistoryBack: true, fallbackHref: fallbackHref };
      } catch (error) {
        return { useHistoryBack: false, fallbackHref: fallbackHref };
      }
    })();
    if (!strategy.useHistoryBack) return;
    event.preventDefault();
    window.history.back();
  }, true);
})();
</script>`;
}

function writeTagAttr(tag, attrName, attrValue) {
  const rx = new RegExp(`\\s${attrName}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i');
  if (rx.test(tag)) return tag.replace(rx, ` ${attrName}="${attrValue}"`);
  return `${tag.slice(0, -1)} ${attrName}="${attrValue}">`;
}

function decodePossiblyEncodedHtml(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  const once = decodeAttrEntities(input);
  if (/<iframe\b/i.test(once)) return once;
  const twice = decodeAttrEntities(once);
  return /<iframe\b/i.test(twice) ? twice : once;
}

function iframeSrcFromHtml(rawHtml) {
  const srcMatch = String(rawHtml || '').match(/\bsrc\s*=\s*(["'])([^"']+)\1/i);
  return srcMatch ? String(srcMatch[2] || '').trim() : '';
}

function resolveVideoSourceUrl(video) {
  const originalUrl = String(video?.dataUrlOriginal || '').trim();
  if (originalUrl) return originalUrl;

  const mode = video?.mode === 'embed' ? 'embed' : 'url';
  if (mode === 'embed') {
    const dataUrl = String(video?.dataUrl || '').trim();
    if (dataUrl) return dataUrl;
    const rawEmbedHtml = decodePossiblyEncodedHtml(video?.dataHtml || '');
    const src = iframeSrcFromHtml(rawEmbedHtml);
    if (src) return src;
  }
  const url = String(video?.dataUrl || '').trim();
  if (!url) throw new Error('Video URL is required for injection.');
  return url;
}

function injectVideoRegion(regionHtml, video, canonical) {
  const originalUrl = resolveVideoSourceUrl(video);
  const parsed = parseVideoUrl(originalUrl);
  if (parsed.provider === 'unknown') {
    console.warn(`[dex] unrecognized video provider: ${originalUrl}`);
  }
  const iframeHtml = buildVideoIframe(parsed.embedUrl || originalUrl);

  const videoTagRx = /<div[^>]*class=["'][^"']*\bdex-video\b[^"']*["'][^>]*>/i;
  const videoTagMatch = regionHtml.match(videoTagRx);
  if (!videoTagMatch) throw new Error('Template video anchor region missing .dex-video container.');
  const videoTag = videoTagMatch[0];
  let updatedVideoTag = writeTagAttr(videoTag, 'data-video-url', encodeAttrEntities(originalUrl));

  const aspectRx = /(<div[^>]*class=["'][^"']*\bdex-video-aspect\b[^"']*["'][^>]*>)([\s\S]*?)(<\/div>)/i;
  if (!aspectRx.test(regionHtml)) throw new Error('Template video anchor region missing .dex-video-aspect container.');

  const breadcrumbMarkup = buildBreadcrumbMarkup(canonical);
  const videoMarkup = `${updatedVideoTag}
  <div class="dex-video-aspect">
${iframeHtml}
  </div>
</div>`;

  return `<div class="dex-video-shell">
${breadcrumbMarkup}
${videoMarkup}
</div>`;
}

function buildSidebarRegion({ globalSidebarConfig, sidebarConfig, manifest }) {
  const compiled = {
    ...sidebarConfig,
    credits: compileSidebarCredits(sidebarConfig?.credits || {}),
  };
  const globalJson = JSON.stringify(globalSidebarConfig || {}, null, 2);
  const sidebarJson = JSON.stringify(compiled, null, 2);
  const manifestJson = JSON.stringify(manifest || {}, null, 2);
  return `<script id="dex-sidebar-config" type="application/json">\n${globalJson}\n</script>\n<script id="dex-sidebar-page-config" type="application/json">\n${sidebarJson}\n</script>\n<script id="${PAGE_CONFIG_BRIDGE_SCRIPT_ID}">\nwindow.dexSidebarPageConfig = JSON.parse(document.getElementById('dex-sidebar-page-config').textContent || '{}');\n</script>\n<script id="dex-manifest" type="application/json">\n${manifestJson}\n</script>`;
}

function scriptByIdRegex(id) {
  return new RegExp(`<script[^>]*id=["']${esc(id)}["'][^>]*>[\\s\\S]*?<\\/script>\\s*`, 'gi');
}

function extractJsonScriptById(html, id) {
  const rx = new RegExp(`<script[^>]*id=["']${esc(id)}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
  const match = String(html || '').match(rx);
  if (!match) throw new Error(`Template missing #${id} JSON script.`);
  try {
    return JSON.parse(String(match[1] || '{}').trim() || '{}');
  } catch (error) {
    throw new Error(`Invalid JSON in #${id}: ${error.message || error}`);
  }
}

function stripDexContractScripts(html) {
  return REQUIRED_CONTRACT_SCRIPT_IDS.reduce(
    (acc, id) => acc.replace(scriptByIdRegex(id), ''),
    String(html || ''),
  );
}

function countScriptById(html, id) {
  const rx = new RegExp(`<script[^>]*id=["']${esc(id)}["']`, 'gi');
  return (String(html || '').match(rx) || []).length;
}

function assertDexSidebarContract(html) {
  for (const id of REQUIRED_CONTRACT_SCRIPT_IDS) {
    const count = countScriptById(html, id);
    if (count !== 1) {
      throw new Error(`Generated HTML must contain exactly one script#${id}; found ${count}.`);
    }
  }

  const hasSidebarRuntime = /<script[^>]*src=["'][^"']*dex-sidebar\.js[^"']*["'][^>]*>/i.test(String(html || ''));
  const hasPageConfig = countScriptById(html, 'dex-sidebar-page-config') === 1;
  if (hasSidebarRuntime && !hasPageConfig) {
    throw new Error('Generated HTML includes dex-sidebar.js but is missing script#dex-sidebar-page-config.');
  }
}

export function detectTemplateProblems(html) {
  const missing = [];
  if (!/<script[^>]*id=["']dex-manifest["'][^>]*type=["']application\/json["']/i.test(html)) {
    missing.push('script#dex-manifest[type="application/json"]');
  }
  if (!/<script[^>]*id=["']dex-sidebar-config["'][^>]*type=["']application\/json["']/i.test(html)) {
    missing.push('script#dex-sidebar-config[type="application/json"]');
  }
  for (const key of REQUIRED_ANCHORS) {
    try {
      getAnchoredRegion(html, key);
    } catch {
      const [start, end] = MARKERS[key];
      missing.push(`anchors <!-- ${start} --> ... <!-- ${end} -->`);
    }
  }
  return missing;
}

export function extractFormatKeys(html) {
  const match = html.match(/<script[^>]*id=["']dex-sidebar-config["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return { audio: [], video: [] };
  try {
    const data = JSON.parse(match[1].trim());
    return {
      audio: (data.downloads?.formats?.audio || []).map((f) => f.key).filter(Boolean),
      video: (data.downloads?.formats?.video || []).map((f) => f.key).filter(Boolean),
    };
  } catch {
    return { audio: [], video: [] };
  }
}


function normalizeAllowedOutsideAnchorChanges(html) {
  return String(html || '')
    .replace(/<!doctype[^>]*>/i, '<!doctype html>')
    .replace(/\b(src|href)\s*=\s*(["'])https?:\/\/[^"']+(\/(?:assets|scripts)\/[^"']*)\2/gi, '$1=$2$3$2')
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>__DEX_TITLE__</title>')
    .replace(scriptByIdRegex('dex-sidebar-config'), '')
    .replace(scriptByIdRegex('dex-manifest'), '')
    .replace(scriptByIdRegex('dex-sidebar-page-config'), '')
    .replace(scriptByIdRegex(PAGE_CONFIG_BRIDGE_SCRIPT_ID), '')
    .replace(/<style[^>]*id=['"]dex-layout-patch['"][^>]*>[\s\S]*?<\/style>\s*/gi, '')
    .replace(/<script[^>]*src=['"]\/assets\/dex-sidebar\.js['"][^>]*><\/script>\s*/g, '')
    .replace(/<script[^>]*src=['"](?:\/assets\/dex-auth0-config\.js|\/assets\/dex-auth-config\.js|https:\/\/cdn\.auth0\.com\/js\/auth0-spa-js\/2\.0\/auth0-spa-js\.production\.js|\/assets\/dex-auth\.js)['"][^>]*><\/script>\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function assertAnchorOnlyChanges(templateHtml, outputHtml) {
  const normalizedTemplate = normalizeAllowedOutsideAnchorChanges(templateHtml);
  const normalizedOutput = normalizeAllowedOutsideAnchorChanges(outputHtml);
  const regions = REQUIRED_ANCHORS.map((key) => ({ key, template: getAnchoredRegion(normalizedTemplate, key), output: getAnchoredRegion(normalizedOutput, key) }))
    .sort((a, b) => a.template.startIx - b.template.startIx);

  let tCursor = 0;
  let oCursor = 0;
  for (const region of regions) {
    const tStatic = normalizedTemplate.slice(tCursor, region.template.contentStart);
    const oStatic = normalizedOutput.slice(oCursor, region.output.contentStart);
    if (tStatic !== oStatic) {
      throw new Error(`Output drift detected outside anchors before ${region.key}.`);
    }
    tCursor = region.template.contentEnd;
    oCursor = region.output.contentEnd;
  }
  if (normalizedTemplate.slice(tCursor) !== normalizedOutput.slice(oCursor)) {
    throw new Error('Output drift detected outside anchors after final region.');
  }
}

export function injectEntryHtml(templateHtml, { descriptionText, descriptionHtml, manifest, sidebarConfig, creditsData, canonical, video, title, authEnabled = true }) {
  let html = templateHtml;
  detectTemplateProblems(html).forEach((problem) => {
    if (problem.includes('DEX:VIDEO_START')) throw new Error('Template missing DEX:VIDEO anchors');
    if (problem.includes('anchors')) throw new Error(`Template must contain anchors: ${problem}`);
  });

  const globalSidebarConfig = extractJsonScriptById(html, 'dex-sidebar-config');
  html = stripDexContractScripts(html);

  const resolvedCanonical = deriveCanonicalEntry({ canonical, sidebarConfig, creditsData });

  const videoRegion = getAnchoredRegion(html, 'video');
  html = replaceBetween(html, videoRegion, injectVideoRegion(videoRegion.content, video, resolvedCanonical));

  const resolvedDescriptionHtml = descriptionTextToHtml(typeof descriptionText === 'string' ? descriptionText : stripHtmlTags(descriptionHtml));
  const descRegion = getAnchoredRegion(html, 'desc');
  html = replaceBetween(html, descRegion, resolvedDescriptionHtml.trim());

  const sidebarRegion = getAnchoredRegion(html, 'sidebar');
  html = replaceBetween(html, sidebarRegion, buildSidebarRegion({ globalSidebarConfig, sidebarConfig, manifest }));
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

  if (authEnabled) {
    const canonical = AUTH_CANDIDATES.find((s) => html.includes(`src="${s}"`)) || AUTH_CANDIDATES[0];
    html = html
      .replace(/<!-- Auth0 -->[\s\S]*?<!-- end Auth0 -->/g, '')
      .replace(/<[^>]*id="btn-login"[\s\S]*?<\/[^>]+>/g, '')
      .replace(/<[^>]*id="btn-profile-container"[\s\S]*?<\/[^>]+>/g, '')
      .replace(new RegExp(`<script[^>]*src="${esc(canonical)}"[^>]*><\\/script>\\s*`, 'g'), '')
      .replace(new RegExp(`<script[^>]*src="${esc(AUTH_CDN)}"[^>]*><\\/script>\\s*`, 'g'), '')
      .replace(/<script[^>]*src="\/assets\/dex-auth\.js"[^>]*><\/script>\s*/g, '');
    const trio = `<script defer src="${canonical}"></script>\n<script defer src="${AUTH_CDN}"></script>\n<script defer src="/assets/dex-auth.js"></script>`;
    if (!html.includes('</head>')) throw new Error('Cannot inject auth snippets: </head> not found');
    html = html.replace('</head>', `${trio}\n</head>`);
  }

  assertDexSidebarContract(html);
  return { html, strategy: { video: 'anchors', description: 'anchors', sidebar: 'anchors' } };
}

export const AUTH_TRIO = [...AUTH_CANDIDATES, AUTH_CDN, '/assets/dex-auth.js'];
