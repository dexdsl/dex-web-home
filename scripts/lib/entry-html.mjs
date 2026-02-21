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

function providerId(rawUrl, hosts) {
  if (!rawUrl) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) return null;
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  if (host.includes('youtu.be') && pathParts[0]) return pathParts[0];
  if (pathParts[0] === 'embed' && pathParts[1]) return pathParts[1];
  if (parsed.searchParams.get('v')) return parsed.searchParams.get('v');
  if (pathParts[0] === 'video' && pathParts[1]) return pathParts[1];
  if (pathParts[0]) return pathParts[0];
  return null;
}

export function normalizeVideoUrl(url) {
  const input = String(url || '').trim();
  const yt = providerId(input, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
  if (yt) return `https://www.youtube.com/embed/${yt}`;
  const vimeo = providerId(input, ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;
  return input;
}

function replaceIframeSrcInDataHtml(dataHtml, normalizedEmbedUrl) {
  const srcRx = /(\bsrc\s*=\s*)(["'])([^"']*)(\2)/i;
  if (!srcRx.test(dataHtml)) {
    throw new Error('Template video wrapper data-html missing iframe src; re-snapshot or adjust template.');
  }
  return dataHtml.replace(srcRx, `$1$2${normalizedEmbedUrl}$2`);
}

function injectVideoRegion(regionHtml, video) {
  const wrapperRx = /<div[^>]*class=["'][^"']*sqs-video-wrapper[^"']*["'][^>]*>/i;
  const wrapper = regionHtml.match(wrapperRx);
  if (!wrapper) throw new Error('Template video anchor region missing .sqs-video-wrapper tag.');

  const tag = wrapper[0];
  const dataHtmlMatch = tag.match(/\sdata-html\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!dataHtmlMatch) throw new Error('Template video wrapper missing data-html attribute; re-snapshot or adjust template.');

  const normalizedUrl = normalizeVideoUrl(video?.dataUrl || '');
  if (!normalizedUrl) throw new Error('Video URL is required for injection.');
  const rawVideoUrl = String(video?.dataUrl || '').trim();
  if (/(?:youtu\.be|youtube\.com)/i.test(rawVideoUrl) && !/youtube\.com\/embed\/[^/?#&]+/i.test(normalizedUrl)) {
    throw new Error(`Failed to parse embed ID from video URL: ${rawVideoUrl}`);
  }
  if (/(?:vimeo\.com)/i.test(rawVideoUrl) && !/player\.vimeo\.com\/video\/[^/?#&]+/i.test(normalizedUrl)) {
    throw new Error(`Failed to parse embed ID from video URL: ${rawVideoUrl}`);
  }

  const decodedDataHtml = decodeAttrEntities(dataHtmlMatch[2]);
  const updatedDataHtml = replaceIframeSrcInDataHtml(decodedDataHtml, normalizedUrl);
  const encodedDataHtml = encodeAttrEntities(updatedDataHtml);

  let updatedTag = tag.replace(dataHtmlMatch[0], ` data-html="${encodedDataHtml}"`);
  if (/\sdata-url\s*=\s*["'][\s\S]*?["']/i.test(updatedTag)) {
    updatedTag = updatedTag.replace(/\sdata-url\s*=\s*(["'])[\s\S]*?\1/i, ` data-url="${encodeAttrEntities(normalizedUrl)}"`);
  } else {
    updatedTag = `${updatedTag.slice(0, -1)} data-url="${encodeAttrEntities(normalizedUrl)}">`;
  }

  return regionHtml.replace(tag, updatedTag);
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
    if (problem.includes('anchors')) throw new Error(`Template must contain anchors: ${problem}`);
  });

  const videoRegion = getAnchoredRegion(html, 'video');
  html = replaceBetween(html, videoRegion, injectVideoRegion(videoRegion.content, video));

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

  return { html, strategy: { video: 'anchors', description: 'anchors', sidebar: 'anchors' } };
}

export const AUTH_TRIO = [...AUTH_CANDIDATES, AUTH_CDN, '/assets/dex-auth.js'];
