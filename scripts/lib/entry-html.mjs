import { load as loadCheerio } from 'cheerio';

const MARKERS = {
  video: ['DEX:VIDEO_START', 'DEX:VIDEO_END'],
  desc: ['DEX:DESC_START', 'DEX:DESC_END'],
  sidebar: ['DEX:SIDEBAR_PAGE_CONFIG_START', 'DEX:SIDEBAR_PAGE_CONFIG_END'],
};

const AUTH_CANDIDATES = ['/assets/dex-auth0-config.js', '/assets/dex-auth-config.js'];
const AUTH_CDN = 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js';
const REQUIRED_ANCHORS = ['video', 'desc', 'sidebar'];

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

function youtubeIdFromUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host.endsWith('.youtu.be')) return pathParts[0] || null;
  if (!(host === 'youtube.com' || host.endsWith('.youtube.com'))) return null;

  if (parsed.searchParams.get('v')) return parsed.searchParams.get('v');
  if (pathParts[0] === 'embed' && pathParts[1]) return pathParts[1];
  if (pathParts[0] === 'shorts' && pathParts[1]) return pathParts[1];
  if (pathParts[0] === 'live' && pathParts[1]) return pathParts[1];
  return null;
}

function vimeoIdFromUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (!(host === 'vimeo.com' || host.endsWith('.vimeo.com'))) return null;

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  if (!pathParts.length) return null;
  if ((host === 'player.vimeo.com' || host.endsWith('.player.vimeo.com')) && pathParts[0] === 'video' && pathParts[1]) {
    return pathParts[1];
  }
  const numericPart = [...pathParts].reverse().find((part) => /^\d+$/.test(part));
  return numericPart || null;
}

export function normalizeVideoEmbedUrl(url) {
  const input = String(url || '').trim();
  const yt = youtubeIdFromUrl(input);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  const vimeo = vimeoIdFromUrl(input);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;
  return input;
}

export function normalizeVideoUrl(url) {
  return normalizeVideoEmbedUrl(url);
}

function buildIframeHtml(embedUrl) {
  return `<iframe width="200" height="113" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}

function encodeDataHtmlIframe(rawIframeHtml) {
  return String(rawIframeHtml || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readTagAttr(tag, attrName) {
  const rx = new RegExp(`\\s${attrName}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  const match = tag.match(rx);
  if (!match) return '';
  return decodeAttrEntities(match[2]);
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

function hasVideoProviderHint(url) {
  return /(?:youtu\.be|youtube\.com|vimeo\.com)/i.test(String(url || ''));
}

function ensureEmbeddableKnownProvider(pageUrl, embedUrl) {
  if (/(?:youtu\.be|youtube\.com)/i.test(pageUrl) && !/youtube\.com\/embed\/[^/?#&]+/i.test(embedUrl)) {
    throw new Error(`Failed to parse embed ID from video URL: ${pageUrl}`);
  }
  if (/(?:vimeo\.com)/i.test(pageUrl) && !/player\.vimeo\.com\/video\/[^/?#&]+/i.test(embedUrl)) {
    throw new Error(`Failed to parse embed ID from video URL: ${pageUrl}`);
  }
}

function resolveVideoWrapperPayload(video, tag) {
  const mode = video?.mode === 'embed' ? 'embed' : 'url';
  if (mode === 'url') {
    const dataUrl = String(video?.dataUrl || '').trim();
    if (!dataUrl) throw new Error('Video URL is required for injection.');
    const embedUrl = normalizeVideoEmbedUrl(dataUrl);
    if (hasVideoProviderHint(dataUrl)) ensureEmbeddableKnownProvider(dataUrl, embedUrl);
    const iframeHtml = buildIframeHtml(embedUrl);
    return { dataUrl, dataHtml: encodeDataHtmlIframe(iframeHtml) };
  }

  let rawEmbedHtml = decodePossiblyEncodedHtml(video?.dataHtml || '');
  let dataUrl = String(video?.dataUrl || '').trim();
  if (!rawEmbedHtml) {
    if (!dataUrl) throw new Error('Video embed HTML is required when mode is "embed".');
    const embedUrl = normalizeVideoEmbedUrl(dataUrl);
    if (hasVideoProviderHint(dataUrl)) ensureEmbeddableKnownProvider(dataUrl, embedUrl);
    rawEmbedHtml = buildIframeHtml(embedUrl);
  }
  if (!dataUrl) dataUrl = iframeSrcFromHtml(rawEmbedHtml) || readTagAttr(tag, 'data-url');
  if (!dataUrl) throw new Error('Video URL is required for injection.');
  return { dataUrl, dataHtml: encodeDataHtmlIframe(rawEmbedHtml) };
}

function updateVideoWrapperTag(tag, video) {
  const payload = resolveVideoWrapperPayload(video, tag);
  let updatedTag = writeTagAttr(tag, 'data-html', payload.dataHtml);
  updatedTag = writeTagAttr(updatedTag, 'data-url', encodeAttrEntities(payload.dataUrl));
  return updatedTag;
}

function injectVideoRegion(regionHtml, video) {
  const wrapperRx = /<div[^>]*class=["'][^"']*sqs-video-wrapper[^"']*["'][^>]*>/i;
  const wrapper = regionHtml.match(wrapperRx);
  if (!wrapper) throw new Error('Template video anchor region missing .sqs-video-wrapper tag.');

  const tag = wrapper[0];
  const updatedTag = updateVideoWrapperTag(tag, video);
  return regionHtml.replace(tag, updatedTag);
}

function injectVideoBySelectorFallback(html, video) {
  const $ = loadCheerio(html, { sourceCodeLocationInfo: true });
  const wrapper = $('.sqs-block.video-block .sqs-video-wrapper').first();
  if (!wrapper.length) throw new Error('Template missing .sqs-block.video-block .sqs-video-wrapper for video injection.');
  const node = wrapper.get(0);
  const startTag = node?.sourceCodeLocation?.startTag;
  if (!startTag || typeof startTag.startOffset !== 'number' || typeof startTag.endOffset !== 'number') {
    throw new Error('Unable to locate .sqs-video-wrapper start tag offsets for selector fallback.');
  }
  const tag = html.slice(startTag.startOffset, startTag.endOffset);
  const updatedTag = updateVideoWrapperTag(tag, video);
  return `${html.slice(0, startTag.startOffset)}${updatedTag}${html.slice(startTag.endOffset)}`;
}

function buildSidebarRegion(sidebarConfig) {
  const compiled = {
    ...sidebarConfig,
    credits: compileSidebarCredits(sidebarConfig?.credits || {}),
  };
  const sidebarJson = JSON.stringify(compiled, null, 2);
  return `<script id="dex-sidebar-page-config" type="application/json">\n${sidebarJson}\n</script>\n<script>\n  try {\n    window.dexSidebarPageConfig = JSON.parse(\n      document.getElementById("dex-sidebar-page-config").textContent\n    );\n  } catch (e) {\n    console.error("[dex] failed to parse dex-sidebar-page-config", e);\n  }\n</script>`;
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
    .replace(/\b(src|href)\s*=\s*(["'])https?:\/\/[^"']+(\/(?:assets|scripts)\/[^"']*)\2/gi, '$1=$2$3$2')
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>__DEX_TITLE__</title>')
    .replace(/(<script[^>]*id="dex-manifest"[^>]*type="application\/json"[^>]*>)([\s\S]*?)(<\/script>)/i, '$1__DEX_MANIFEST__$3')
    .replace(/<script[^>]*src=['"](?:\/assets\/dex-auth0-config\.js|\/assets\/dex-auth-config\.js|https:\/\/cdn\.auth0\.com\/js\/auth0-spa-js\/2\.0\/auth0-spa-js\.production\.js|\/assets\/dex-auth\.js)['"][^>]*><\/script>\s*/g, '');
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
    if (problem.includes('anchors') && problem.includes('DEX:VIDEO_START')) return;
    if (problem.includes('anchors')) throw new Error(`Template must contain anchors: ${problem}`);
  });

  let videoStrategy = 'anchors';
  let videoRegion = null;
  try {
    videoRegion = getAnchoredRegion(html, 'video');
  } catch {}
  if (videoRegion) {
    html = replaceBetween(html, videoRegion, injectVideoRegion(videoRegion.content, video));
  } else {
    html = injectVideoBySelectorFallback(html, video);
    videoStrategy = 'selector';
  }

  const resolvedDescriptionHtml = descriptionTextToHtml(typeof descriptionText === 'string' ? descriptionText : stripHtmlTags(descriptionHtml));
  const descRegion = getAnchoredRegion(html, 'desc');
  html = replaceBetween(html, descRegion, resolvedDescriptionHtml.trim());

  const sidebarRegion = getAnchoredRegion(html, 'sidebar');
  html = replaceBetween(html, sidebarRegion, buildSidebarRegion(sidebarConfig));

  html = html.replace(/(<script[^>]*id="dex-manifest"[^>]*type="application\/json"[^>]*>)([\s\S]*?)(<\/script>)/i, `$1\n${JSON.stringify(manifest, null, 2)}\n$3`);
  if (!/"audio"\s*:/.test(html)) throw new Error('Failed to update dex-manifest JSON');
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

  return { html, strategy: { video: videoStrategy, description: 'anchors', sidebar: 'anchors' } };
}

export const AUTH_TRIO = [...AUTH_CANDIDATES, AUTH_CDN, '/assets/dex-auth.js'];
