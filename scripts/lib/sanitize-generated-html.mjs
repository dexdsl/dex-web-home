import { load as loadHtml } from 'cheerio';

export const DEX_ORIGIN = 'https://dexdsl.github.io';
export const DEX_CSS_HREF = `${DEX_ORIGIN}/assets/css/dex.css`;
export const DEX_SIDEBAR_SRC = `${DEX_ORIGIN}/assets/dex-sidebar.js`;
export const AUTH_CDN_SRC = 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js';

const AUTH_CONFIG_PATHS = ['/assets/dex-auth0-config.js', '/assets/dex-auth-config.js'];
const REQUIRED_CONTRACT_IDS = ['dex-sidebar-config', 'dex-sidebar-page-config', 'dex-manifest'];
const PAGE_CONFIG_BRIDGE_SCRIPT_ID = 'dex-sidebar-page-config-bridge';
const PAGE_CONFIG_BRIDGE_SNIPPET = "window.dexSidebarPageConfig = JSON.parse(document.getElementById('dex-sidebar-page-config').textContent || '{}');";
const SITE_CSS_HREF_PATTERN = /https:\/\/static1\.squarespace\.com\/static\/versioned-site-css\/[\s\S]*?\/site\.css/i;

const BLOCKED_SCRIPT_SRC_PATTERNS = [
  /squarespace\.com/i,
  /sqspcdn\.com/i,
  /assets\.squarespace\.com/i,
  /definitions\.sqspcdn\.com/i,
  /static1\.squarespace\.com\/static\/vta\//i,
  /website\.components\./i,
  /website-component-definition/i,
  /use\.typekit\.net\/ik\//i,
];

const INLINE_SCRIPT_MARKERS = [
  { token: 'Static.', regex: /\bStatic\./i },
  { token: 'Static =', regex: /\bStatic\s*=/i },
  { token: 'SQUARESPACE_', regex: /SQUARESPACE_/i },
  { token: 'Squarespace', regex: /Squarespace/i },
  { token: 'websiteComponents', regex: /websiteComponents/i },
  { token: 'sqspcdn', regex: /sqspcdn/i },
  { token: 'assets.squarespace.com', regex: /assets\.squarespace\.com/i },
  { token: 'website.components', regex: /website\.components/i },
  { token: 'sqsp runtime marker', regex: /\bsqsp[a-z0-9_.-]*/i },
  { token: 'sqs runtime marker', regex: /\bsqs[a-z0-9_.-]*/i },
];

const FORBIDDEN_REMAINING_MARKERS = [
  { token: 'SQUARESPACE_', regex: /SQUARESPACE_/i },
  { token: 'Static.', regex: /Static\./ },
  { token: 'websiteComponents', regex: /websiteComponents/i },
  { token: 'sqspcdn', regex: /sqspcdn/i },
];

export const REQUIRED_SANITIZED_SNIPPETS = [
  DEX_CSS_HREF,
  DEX_SIDEBAR_SRC,
  'id="dex-sidebar-config"',
  'id="dex-sidebar-page-config"',
  `id="${PAGE_CONFIG_BRIDGE_SCRIPT_ID}"`,
  'id="dex-manifest"',
];

export const VERIFY_TOKEN_CHECKS = [
  { token: 'blocked squarespace script src', regex: /<script[^>]*src=["'][^"']*(?:squarespace\.com|sqspcdn\.com)[^"']*["']/i },
  { token: 'Static runtime marker', regex: /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\bStatic(?:\.|\s*=)/ },
  { token: 'SQUARESPACE_ runtime marker', regex: /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?SQUARESPACE_/i },
  { token: 'protocol-relative src/href', regex: /\b(?:src|href)\s*=\s*["']\/\//i },
  ...FORBIDDEN_REMAINING_MARKERS,
];

function startsProtocolRelative(value) {
  return String(value || '').trim().startsWith('//');
}

function normalizeProtocolRelativeUrl(value) {
  const input = String(value || '').trim();
  return startsProtocolRelative(input) ? `https:${input}` : input;
}

function findInlineMarker(scriptBody) {
  const text = String(scriptBody || '');
  const match = INLINE_SCRIPT_MARKERS.find((marker) => marker.regex.test(text));
  return match ? match.token : '';
}

function isExecutableInlineScriptType(typeValue) {
  const value = String(typeValue || '').trim().toLowerCase();
  if (!value) return true;
  if (value === 'module') return true;
  return [
    'application/javascript',
    'text/javascript',
    'application/ecmascript',
    'text/ecmascript',
    'application/x-javascript',
    'text/jscript',
  ].includes(value);
}

function hasSquarespaceRuntimeDataAttrs(element) {
  const attrs = element?.attribs || {};
  return Object.entries(attrs).some(([name, value]) => {
    const attr = String(name || '').toLowerCase();
    const text = String(value || '').toLowerCase();
    if (attr.startsWith('data-sqs-')) return true;
    if (attr === 'data-name' && text.includes('static-context')) return true;
    if (attr === 'data-block-scripts' || attr === 'data-block-css') return true;
    if (attr === 'data-definition-name' && text.includes('website.components')) return true;
    return false;
  });
}

function stripSquarespaceRuntimeDataAttrs($) {
  $('*').each((_, element) => {
    const attrs = element?.attribs || {};
    for (const [name, rawValue] of Object.entries(attrs)) {
      const attr = String(name || '').toLowerCase();
      const value = String(rawValue || '');
      const shouldStrip =
        attr.startsWith('data-sqs-')
        || attr === 'data-block-scripts'
        || attr === 'data-block-css'
        || attr === 'data-definition-name'
        || (attr === 'data-name' && /static-context/i.test(value))
        || (attr.startsWith('data-') && /(sqspcdn|website\.components|websitecomponents|assets\.squarespace\.com)/i.test(value));
      if (shouldStrip) $(element).removeAttr(name);
    }
  });
}

function stripInlineStyleProps(styleText, propNames = []) {
  let next = String(styleText || '');
  for (const propName of propNames) {
    const rx = new RegExp(`(?:^|;)\\s*${propName}\\s*:[^;]*;?`, 'gi');
    next = next.replace(rx, ';');
  }
  next = next.replace(/;{2,}/g, ';').replace(/\s+/g, ' ').trim();
  next = next.replace(/^;\s*/, '').replace(/\s*;$/, '').trim();
  return next;
}

function markDexEntryHosts($) {
  $('.fluid-engine').each((_, fluidElement) => {
    const fluid = $(fluidElement);
    const hostBlocks = fluid.children('.fe-block').filter((__, block) => $(block).find('.dex-entry-layout').length > 0);
    if (!hostBlocks.length) return;

    hostBlocks.each((__, block) => {
      const host = $(block);
      host.addClass('dex-entry-host');
      const existingStyle = String(host.attr('style') || '').trim();
      const cleanedStyle = existingStyle
        .replace(/\bgrid-area\s*:[^;]*;?/gi, '')
        .replace(/\bgrid-column\s*:[^;]*;?/gi, '')
        .replace(/\bjustify-self\s*:[^;]*;?/gi, '')
        .trim();
      const prefix = cleanedStyle
        ? `${cleanedStyle}${cleanedStyle.endsWith(';') ? '' : ';'} `
        : '';
      host.attr('style', `${prefix}grid-area: auto / 1 / auto / -1 !important; grid-column: 1 / -1 !important; justify-self: stretch !important;`);
    });

    fluid.children('.fe-block').each((__, block) => {
      const sibling = $(block);
      if (sibling.find('.dex-entry-layout').length > 0) return;
      if (sibling.find('.website-component-block').length > 0) {
        sibling.remove();
        return;
      }
      const htmlContent = sibling.find('.sqs-html-content').first();
      if (!htmlContent.length) return;
      const text = htmlContent.text().replace(/\s+/g, ' ').trim();
      const hasMedia = htmlContent.find('img, video, iframe, svg, canvas').length > 0;
      if (!text && !hasMedia) sibling.remove();
    });
  });

  $('.dex-entry-layout').each((_, layoutElement) => {
    const host = $(layoutElement).closest('.fe-block').first();
    if (host.length) host.addClass('dex-entry-host');
  });
}

function normalizeDexSectionSpacing($) {
  $('section').each((_, sectionElement) => {
    const section = $(sectionElement);
    const hasDexFooter = section.find('.dex-footer').length > 0;
    const hasDexEntry = section.find('.dex-entry-layout').length > 0;
    if (!hasDexFooter && !hasDexEntry) return;

    if (hasDexEntry) {
      section.addClass('dex-entry-section');
      section.removeClass('has-section-divider');
      section.find('.section-divider-display').remove();
    }

    if (hasDexFooter) {
      section.addClass('dex-footer-section');
      section.removeClass('section-height--custom');
      const cleanedSectionStyle = stripInlineStyleProps(section.attr('style'), ['min-height']);
      if (cleanedSectionStyle) section.attr('style', cleanedSectionStyle);
      else section.removeAttr('style');

      const previous = section.prev();
      if (previous.length && previous.hasClass('section-divider-display')) previous.remove();
    }

    const wrappers = section.children('.content-wrapper');
    wrappers.each((__, wrapperElement) => {
      const wrapper = $(wrapperElement);
      const propsToStrip = hasDexFooter ? ['padding-top', 'padding-bottom'] : ['padding-bottom'];
      const cleanedWrapperStyle = stripInlineStyleProps(wrapper.attr('style'), propsToStrip);
      if (cleanedWrapperStyle) wrapper.attr('style', cleanedWrapperStyle);
      else wrapper.removeAttr('style');
    });
  });
}

function isBlockedScriptSrc(src) {
  const value = String(src || '').trim();
  if (!value) return false;
  return BLOCKED_SCRIPT_SRC_PATTERNS.some((pattern) => pattern.test(value));
}

function canonicalDexPath(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  if (/^(?:\/(?:assets|scripts)\/|(?:assets|scripts)\/)/i.test(value)) {
    return value.startsWith('/') ? value : `/${value}`;
  }

  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const parsed = new URL(value);
    if (!/^(?:www\.)?dexdsl\.(?:github\.io|org|com)$/i.test(parsed.hostname)) return null;
    if (!/^\/(?:assets|scripts)\//i.test(parsed.pathname)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function canonicalDexUrl(value) {
  const pathValue = canonicalDexPath(value);
  if (!pathValue) return null;
  return `${DEX_ORIGIN}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`;
}

function canonicalPathKey(value) {
  const normalized = canonicalDexPath(value);
  if (!normalized) return '';
  return normalized.split('?')[0].split('#')[0];
}

function ensureHead($) {
  let head = $('head').first();
  if (head.length) return head;

  if ($('html').length) {
    $('html').prepend('<head></head>');
  } else {
    $.root().prepend('<head></head>');
  }
  head = $('head').first();
  return head;
}

function isContractScriptId(id) {
  return REQUIRED_CONTRACT_IDS.includes(String(id || '').trim()) || String(id || '').trim() === PAGE_CONFIG_BRIDGE_SCRIPT_ID;
}

function dedupeScriptsByPath($, pathMatch, canonicalUrl, options = {}) {
  const scripts = $('script[src]').filter((_, el) => canonicalPathKey($(el).attr('src')) === pathMatch);
  scripts.each((index, element) => {
    const node = $(element);
    if (index === 0) {
      node.attr('src', canonicalUrl);
      if (options.defer) node.attr('defer', '');
      if (options.removeAsync) node.removeAttr('async');
      return;
    }
    node.remove();
  });
  return scripts.length;
}

function ensureDexCssAfterSiteCss($, head) {
  const dexCssByPath = $('link[href]').filter((_, el) => canonicalPathKey($(el).attr('href')) === '/assets/css/dex.css');
  dexCssByPath.each((index, element) => {
    const node = $(element);
    if (index === 0) {
      node.attr('rel', 'stylesheet');
      node.attr('href', DEX_CSS_HREF);
      return;
    }
    node.remove();
  });

  let dexCssLink = $('link[href]').filter((_, el) => String($(el).attr('href') || '').trim() === DEX_CSS_HREF).first();
  if (!dexCssLink.length) {
    head.append(`\n<link rel="stylesheet" href="${DEX_CSS_HREF}">`);
    dexCssLink = $('link[href]').filter((_, el) => String($(el).attr('href') || '').trim() === DEX_CSS_HREF).first();
  }

  const siteCssLinks = $('link[href]').filter((_, el) => SITE_CSS_HREF_PATTERN.test(String($(el).attr('href') || '').trim()));
  if (siteCssLinks.length && dexCssLink.length) {
    dexCssLink.remove();
    siteCssLinks.last().after(`\n<link rel="stylesheet" href="${DEX_CSS_HREF}">`);
  }
}

function ensureRequiredRuntimeScripts($, head) {
  const configScripts = $('script[src]').filter((_, el) => AUTH_CONFIG_PATHS.includes(canonicalPathKey($(el).attr('src'))));
  if (configScripts.length > 1) configScripts.slice(1).remove();
  configScripts.each((_, el) => {
    const pathKey = canonicalPathKey($(el).attr('src'));
    if (pathKey) $(el).attr('src', `${DEX_ORIGIN}${pathKey}`);
  });

  dedupeScriptsByPath($, '/assets/dex-auth.js', `${DEX_ORIGIN}/assets/dex-auth.js`, { defer: true });
  dedupeScriptsByPath($, '/assets/dex-auth0-config.js', `${DEX_ORIGIN}/assets/dex-auth0-config.js`, { defer: true });
  dedupeScriptsByPath($, '/assets/dex-auth-config.js', `${DEX_ORIGIN}/assets/dex-auth-config.js`, { defer: true });
  dedupeScriptsByPath($, '/assets/dex-sidebar.js', DEX_SIDEBAR_SRC, { defer: true, removeAsync: true });

  const authCdnScripts = $('script[src]').filter((_, el) => String($(el).attr('src') || '').trim() === AUTH_CDN_SRC);
  authCdnScripts.each((index, element) => {
    const node = $(element);
    if (index === 0) {
      node.attr('defer', '');
      node.removeAttr('async');
      return;
    }
    node.remove();
  });

  if ($('script[src]').filter((_, el) => String($(el).attr('src') || '').trim() === DEX_SIDEBAR_SRC).length === 0) {
    head.append(`\n<script defer src="${DEX_SIDEBAR_SRC}"></script>`);
  }
}

function ensureContractScript($, id, fallbackJson, preferredContainer) {
  const matches = $(`script#${id}`);
  matches.each((index, element) => {
    if (index > 0) $(element).remove();
  });

  let script = $(`script#${id}`).first();
  if (!script.length) {
    script = $(`<script id="${id}" type="application/json">${fallbackJson}</script>`);
    preferredContainer.append(`\n`);
    preferredContainer.append(script);
    return script;
  }

  script.attr('type', 'application/json');
  if (!String(script.html() || '').trim()) {
    script.text(fallbackJson);
  }
  return script;
}

function ensureDexContractScripts($, head) {
  const body = $('body').first();
  const baseContainer = body.length ? body : head;
  const existingPageConfig = $('script#dex-sidebar-page-config').first();
  const contractContainer = existingPageConfig.length ? existingPageConfig.parent() : baseContainer;

  const pageScript = ensureContractScript($, 'dex-sidebar-page-config', '{}', contractContainer);
  ensureContractScript($, 'dex-sidebar-config', '{}', contractContainer);
  ensureContractScript($, 'dex-manifest', '{}', contractContainer);

  let bridge = $(`script#${PAGE_CONFIG_BRIDGE_SCRIPT_ID}`).first();
  $(`script#${PAGE_CONFIG_BRIDGE_SCRIPT_ID}`).each((index, element) => {
    if (index > 0) $(element).remove();
  });
  if (!bridge.length) {
    bridge = $(`<script id="${PAGE_CONFIG_BRIDGE_SCRIPT_ID}">${PAGE_CONFIG_BRIDGE_SNIPPET}</script>`);
  } else {
    bridge.text(PAGE_CONFIG_BRIDGE_SNIPPET);
  }
  bridge.remove();
  pageScript.after(`\n`);
  pageScript.after(bridge);
}

function scriptTagCount($, id) {
  const typed = $(`script#${id}[type="application/json"]`).length;
  if (typed) return typed;
  return $(`script#${id}`).length;
}

function hasDexSidebarRuntime($) {
  return $('script[src]').toArray().some((el) => canonicalPathKey($(el).attr('src')) === '/assets/dex-sidebar.js');
}

function collectSanitizationIssues($) {
  const issues = [];

  for (const id of REQUIRED_CONTRACT_IDS) {
    const count = scriptTagCount($, id);
    if (count === 0) issues.push({ type: 'missing', token: `script#${id}` });
    if (count > 1) issues.push({ type: 'duplicate', token: `script#${id}` });
  }
  const bridgeCount = $(`script#${PAGE_CONFIG_BRIDGE_SCRIPT_ID}`).length;
  if (bridgeCount === 0) issues.push({ type: 'missing', token: `script#${PAGE_CONFIG_BRIDGE_SCRIPT_ID}` });
  if (bridgeCount > 1) issues.push({ type: 'duplicate', token: `script#${PAGE_CONFIG_BRIDGE_SCRIPT_ID}` });
  const bridgeText = String($(`script#${PAGE_CONFIG_BRIDGE_SCRIPT_ID}`).first().html() || '').trim();
  if (bridgeCount === 1 && bridgeText !== PAGE_CONFIG_BRIDGE_SNIPPET) {
    issues.push({ type: 'mismatch', token: `script#${PAGE_CONFIG_BRIDGE_SCRIPT_ID} must match bridge snippet` });
  }

  $('script[src]').each((_, element) => {
    const src = String($(element).attr('src') || '').trim();
    if (!src) return;
    if (startsProtocolRelative(src)) {
      issues.push({ type: 'protocol-relative', token: src });
    }
    if (isBlockedScriptSrc(src) || hasSquarespaceRuntimeDataAttrs(element)) {
      issues.push({ type: 'forbidden-script', token: src });
    }
  });

  $('script:not([src])').each((_, element) => {
    if (!isExecutableInlineScriptType($(element).attr('type'))) return;
    const marker = findInlineMarker($(element).html() || '');
    if (marker) issues.push({ type: 'forbidden-inline-script', token: marker });
  });

  $('[src], [href]').each((_, element) => {
    const node = $(element);
    for (const attr of ['src', 'href']) {
      const value = String(node.attr(attr) || '').trim();
      if (!value) continue;
      if (startsProtocolRelative(value)) {
        issues.push({ type: 'protocol-relative', token: `${attr}=${value}` });
      }
    }
  });

  const dexCssLinks = $('link[href]').toArray();
  const dexCssIndex = dexCssLinks.findIndex((el) => String($(el).attr('href') || '').trim() === DEX_CSS_HREF);
  if (dexCssIndex < 0) issues.push({ type: 'missing', token: DEX_CSS_HREF });

  const siteCssIndex = dexCssLinks.reduce((lastIndex, el, index) => {
    const href = String($(el).attr('href') || '').trim();
    return SITE_CSS_HREF_PATTERN.test(href) ? index : lastIndex;
  }, -1);
  if (siteCssIndex >= 0 && dexCssIndex >= 0 && dexCssIndex < siteCssIndex) {
    issues.push({ type: 'order', token: 'dex.css must load after site.css' });
  }

  if (!hasDexSidebarRuntime($)) {
    issues.push({ type: 'missing', token: DEX_SIDEBAR_SRC });
  }

  if (hasDexSidebarRuntime($) && scriptTagCount($, 'dex-sidebar-page-config') === 0) {
    issues.push({
      type: 'missing',
      token: 'Generated HTML includes dex-sidebar.js but is missing script#dex-sidebar-page-config',
    });
  }

  return issues;
}

export function sanitizeGeneratedHtml(html) {
  const input = String(html || '');
  const doctypeMatch = input.match(/^\s*<!doctype[^>]*>/i);
  const $ = loadHtml(input, { decodeEntities: false });

  $('base').remove();
  stripSquarespaceRuntimeDataAttrs($);
  markDexEntryHosts($);
  normalizeDexSectionSpacing($);

  $('script').each((_, element) => {
    const node = $(element);
    const scriptId = String(node.attr('id') || '').trim();
    const protectedScript = isContractScriptId(scriptId);
    const rawSrc = String(node.attr('src') || '').trim();
    const src = normalizeProtocolRelativeUrl(rawSrc);
    if (src) {
      if (src !== rawSrc) node.attr('src', src);
      if (!protectedScript && (isBlockedScriptSrc(src) || hasSquarespaceRuntimeDataAttrs(element))) {
        node.remove();
        return;
      }
      const canonicalSrc = canonicalDexUrl(src);
      if (canonicalSrc) node.attr('src', canonicalSrc);
      return;
    }

    if (!protectedScript && hasSquarespaceRuntimeDataAttrs(element)) {
      node.remove();
      return;
    }

    if (!isExecutableInlineScriptType(node.attr('type'))) return;
    if (!protectedScript && findInlineMarker(node.html() || '')) {
      node.remove();
    }
  });

  $('link[href]').each((_, element) => {
    const node = $(element);
    const rawHref = String(node.attr('href') || '').trim();
    const href = normalizeProtocolRelativeUrl(rawHref);
    if (!href) return;
    if (href !== rawHref) node.attr('href', href);

    const lowerHref = href.toLowerCase();
    const isWebsiteComponentsAsset = lowerHref.includes('website.components') || lowerHref.includes('website-component-definition');
    if (isWebsiteComponentsAsset) {
      node.remove();
      return;
    }

    const canonicalHref = canonicalDexUrl(href);
    if (canonicalHref) node.attr('href', canonicalHref);
  });

  $('[src], [href]').each((_, element) => {
    const node = $(element);
    for (const attr of ['src', 'href']) {
      const value = node.attr(attr);
      if (!value) continue;
      const normalized = normalizeProtocolRelativeUrl(value);
      if (normalized !== value) node.attr(attr, normalized);
      const canonical = canonicalDexUrl(normalized);
      if (canonical) node.attr(attr, canonical);
    }
  });

  const head = ensureHead($);
  ensureDexCssAfterSiteCss($, head);
  ensureDexContractScripts($, head);
  ensureRequiredRuntimeScripts($, head);

  let output = $.html();
  if (doctypeMatch && !/^\s*<!doctype/i.test(output)) {
    output = `${doctypeMatch[0]}\n${output.replace(/^\s+/, '')}`;
  }
  return output;
}

export function verifySanitizedHtml(html) {
  const source = String(html || '');
  const $ = loadHtml(source, { decodeEntities: false });
  const issues = collectSanitizationIssues($);
  for (const check of VERIFY_TOKEN_CHECKS) {
    if (check.regex.test(source)) issues.push({ type: 'verify-token', token: check.token });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

export function formatSanitizationIssues(issues = []) {
  return issues.map((issue) => issue.token).join(', ');
}
