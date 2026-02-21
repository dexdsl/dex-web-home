const MARKERS = {
  video: ['DEX:VIDEO_START', 'DEX:VIDEO_END'],
  desc: ['DEX:DESC_START', 'DEX:DESC_END'],
  sidebar: ['DEX:SIDEBAR_PAGE_CONFIG_START', 'DEX:SIDEBAR_PAGE_CONFIG_END'],
};

const AUTH_CANDIDATES = ['/assets/dex-auth0-config.js', '/assets/dex-auth-config.js'];
const AUTH_CDN = 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js';
const REQUIRED_ANCHORS = ['video', 'desc', 'sidebar'];
const REQUIRED_CONTRACT_SCRIPT_IDS = ['dex-sidebar-config', 'dex-sidebar-page-config', 'dex-manifest'];

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
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function cleanVideoId(value) {
  return String(value || '')
    .trim()
    .split(/[?&#/]/)[0]
    .trim();
}

export function parseVideoUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return { provider: 'unknown', id: '', embedUrl: '' };

  const parsed = parseUrl(input);
  if (parsed) {
    const host = parsed.hostname.toLowerCase();
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be' || host.endsWith('.youtu.be') || host === 'youtube.com' || host.endsWith('.youtube.com')) {
      let id = '';
      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        id = cleanVideoId(pathParts[0]);
      } else if (parsed.searchParams.get('v')) {
        id = cleanVideoId(parsed.searchParams.get('v'));
      } else if (pathParts[0] === 'embed' && pathParts[1]) {
        id = cleanVideoId(pathParts[1]);
      }
      if (id) {
        return {
          provider: 'youtube',
          id,
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        };
      }
    }

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

function injectVideoRegion(regionHtml, video) {
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

  return regionHtml
    .replace(videoTag, updatedVideoTag)
    .replace(aspectRx, `$1\n${iframeHtml}\n$3`);
}

function buildSidebarRegion({ globalSidebarConfig, sidebarConfig, manifest }) {
  const compiled = {
    ...sidebarConfig,
    credits: compileSidebarCredits(sidebarConfig?.credits || {}),
  };
  const globalJson = JSON.stringify(globalSidebarConfig || {}, null, 2);
  const sidebarJson = JSON.stringify(compiled, null, 2);
  const manifestJson = JSON.stringify(manifest || {}, null, 2);
  return `<script id="dex-sidebar-config" type="application/json">\n${globalJson}\n</script>\n<script id="dex-sidebar-page-config" type="application/json">\n${sidebarJson}\n</script>\n<script>\n  try {\n    const el = document.getElementById('dex-sidebar-page-config');\n    if (el && !window.dexSidebarPageConfig) {\n      window.dexSidebarPageConfig = JSON.parse(el.textContent || '{}');\n    }\n  } catch (e) { console.error('[dex] sidebar page config parse failed', e); }\n</script>\n<script id="dex-manifest" type="application/json">\n${manifestJson}\n</script>`;
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

export function injectEntryHtml(templateHtml, { descriptionText, descriptionHtml, manifest, sidebarConfig, video, title, authEnabled = true }) {
  let html = templateHtml;
  detectTemplateProblems(html).forEach((problem) => {
    if (problem.includes('DEX:VIDEO_START')) throw new Error('Template missing DEX:VIDEO anchors');
    if (problem.includes('anchors')) throw new Error(`Template must contain anchors: ${problem}`);
  });

  const globalSidebarConfig = extractJsonScriptById(html, 'dex-sidebar-config');
  html = stripDexContractScripts(html);

  const videoRegion = getAnchoredRegion(html, 'video');
  html = replaceBetween(html, videoRegion, injectVideoRegion(videoRegion.content, video));

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
