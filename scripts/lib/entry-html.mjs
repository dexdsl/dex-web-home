import { load } from 'cheerio';

const MARKERS = {
  video: ['DEX:VIDEO_START', 'DEX:VIDEO_END'],
  desc: ['DEX:DESC_START', 'DEX:DESC_END'],
  sidebar: ['DEX:SIDEBAR_PAGE_CONFIG_START', 'DEX:SIDEBAR_PAGE_CONFIG_END'],
};

const AUTH_CANDIDATES = ['/assets/dex-auth0-config.js', '/assets/dex-auth-config.js'];
const AUTH_CDN = 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function markerTokens(html, key) {
  const [startCore, endCore] = MARKERS[key];
  const starts = [`<!-- ${startCore} -->`, `<!-- @-- ${startCore} --@ -->`];
  const ends = [`<!-- ${endCore} -->`, `<!-- @-- ${endCore} --@ -->`];
  const start = starts.find((t) => html.includes(t));
  const end = ends.find((t) => html.includes(t));
  return { start, end };
}

function replaceBetween(html, start, end, content) {
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  if (s < 0 || e < 0 || e <= s) throw new Error(`Missing/invalid anchor pair: ${start} .. ${end}`);
  return `${html.slice(0, s + start.length)}\n${content}\n${html.slice(e)}`;
}

export function detectTemplateProblems(html) {
  const missing = [];
  if (!/<script[^>]*id=["']dex-manifest["'][^>]*type=["']application\/json["']/i.test(html)) missing.push('script#dex-manifest[type="application/json"]');
    const hasWindowSidebar = /window\.dexSidebarPageConfig\s*=/.test(html);
    const hasJsonSidebar = /<script[^>]*id=["']dex-sidebar-page-config["'][^>]*type=["']application\/json["']/i.test(html);
    const hasSidebarAnchors = !!(markerTokens(html, 'sidebar').start && markerTokens(html, 'sidebar').end);

    if (!(hasWindowSidebar || hasJsonSidebar || hasSidebarAnchors)) {
      missing.push('sidebar config target (window.dexSidebarPageConfig OR script#dex-sidebar-page-config OR DEX sidebar anchors)');
    }
    const hasVideo = /class=["'][^"']*sqs-video-wrapper/.test(html) || !!(markerTokens(html, 'video').start && markerTokens(html, 'video').end);
  if (!hasVideo) missing.push('.sqs-video-wrapper or DEX video anchors');
  return missing;
}

export function extractFormatKeys(html) {
  const $ = load(html, { decodeEntities: false });
  const txt = $('#dex-sidebar-config[type="application/json"]').first().text().trim();
  if (!txt) return { audio: [], video: [] };
  try {
    const data = JSON.parse(txt);
    return {
      audio: (data.downloads?.formats?.audio || []).map((f) => f.key).filter(Boolean),
      video: (data.downloads?.formats?.video || []).map((f) => f.key).filter(Boolean),
    };
  } catch {
    return { audio: [], video: [] };
  }
}

export function injectEntryHtml(templateHtml, { descriptionHtml, manifest, sidebarConfig, video, title, authEnabled = true }) {
  let html = templateHtml;
  let videoStrategy = 'selectors';
  let descStrategy = 'selectors';
  let sidebarStrategy = 'selectors';
  const vm = markerTokens(html, 'video');
  if (vm.start && vm.end) {
    const start = html.indexOf(vm.start) + vm.start.length;
    const end = html.indexOf(vm.end);
    const region = html.slice(start, end);
    const updated = region.replace(/(<div[^>]*class="[^"]*sqs-video-wrapper[^"]*"[^>]*)(>)/, (_, a, b) => {
      const set = (tag, name, value) => {
        const rx = new RegExp(`\\s${name}="[^"]*"`);
        const v = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return rx.test(tag) ? tag.replace(rx, ` ${name}="${v}"`) : `${tag} ${name}="${v}"`;
      };
      let tag = a;
      if (video.mode === 'url') {
        tag = set(tag, 'data-url', video.dataUrl);
        if (video.dataHtml) tag = set(tag, 'data-html', video.dataHtml);
      } else {
        tag = set(tag, 'data-url', '');
        tag = set(tag, 'data-html', video.dataHtml);
      }
      return `${tag}${b}`;
    });
    html = replaceBetween(html, vm.start, vm.end, updated.trim());
    videoStrategy = 'anchors';
  } else {
    const $ = load(html, { decodeEntities: false });
    const node = $('.sqs-block.video-block .sqs-video-wrapper').first();
    if (!node.length) throw new Error('Video target missing; add DEX video anchors or .sqs-video-wrapper');
    if (video.mode === 'url') {
      node.attr('data-url', video.dataUrl);
      if (video.dataHtml) node.attr('data-html', video.dataHtml);
    } else {
      node.attr('data-url', '');
      node.attr('data-html', video.dataHtml);
    }
    html = $.html();
  }

  const dm = markerTokens(html, 'desc');
  if (dm.start && dm.end) {
    html = replaceBetween(html, dm.start, dm.end, descriptionHtml.trim());
    descStrategy = 'anchors';
  } else {
    throw new Error('Description anchors missing and selector fallback is ambiguous; add DEX:DESC anchors to template');
  }

    const sidebarJson = JSON.stringify(sidebarConfig, null, 2);
    const sidebarJs = `window.dexSidebarPageConfig = ${sidebarJson};`;

    const sm = markerTokens(html, 'sidebar');
    if (sm.start && sm.end) {
      const start = html.indexOf(sm.start) + sm.start.length;
      const end = html.indexOf(sm.end);
      const region = html.slice(start, end);

      let replaced = region;

      // A) Anchor region contains window assignment
      if (/window\.dexSidebarPageConfig\s*=/.test(region)) {
        replaced = region.replace(
          /window\.dexSidebarPageConfig\s*=\s*[\s\S]*?;\s*/m,
          `${sidebarJs}\n`
        );
      }
      // B) Anchor region contains JSON script blob
      else if (/<script[^>]*id=["']dex-sidebar-page-config["'][^>]*type=["']application\/json["']/i.test(region)) {
        replaced = region.replace(
          /(<script[^>]*id=["']dex-sidebar-page-config["'][^>]*type=["']application\/json["'][^>]*>)([\s\S]*?)(<\/script>)/i,
          `$1\n${sidebarJson}\n$3`
        );
      }

      if (replaced === region) {
        throw new Error(
          'Sidebar anchor region found, but no supported target inside it. ' +
          'Expected either window.dexSidebarPageConfig assignment OR script#dex-sidebar-page-config[type="application/json"] within the anchor bounds.'
        );
      }

      html = replaceBetween(html, sm.start, sm.end, replaced.trim());
      sidebarStrategy = 'anchors';
    } else {
        if (/window\.dexSidebarPageConfig\s*=/.test(html)) {
          html = html.replace(/window\.dexSidebarPageConfig\s*=\s*[\s\S]*?;\s*/m, `${sidebarJs}\n`);
          if (!html.includes(sidebarJs)) throw new Error('Sidebar config target missing; add DEX sidebar anchors');
        } else if (/<script[^>]*id=["']dex-sidebar-page-config["'][^>]*type=["']application\/json["']/i.test(html)) {
          html = html.replace(
            /(<script[^>]*id=["']dex-sidebar-page-config["'][^>]*type=["']application\/json["'][^>]*>)([\s\S]*?)(<\/script>)/i,
            `$1\n${sidebarJson}\n$3`
          );
        } else {
          throw new Error('Sidebar config target missing; add DEX sidebar anchors or a sidebar config placeholder');
        }
      }

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

  return { html, strategy: { video: videoStrategy, description: descStrategy, sidebar: sidebarStrategy } };
}

export const AUTH_TRIO = [...AUTH_CANDIDATES, AUTH_CDN, '/assets/dex-auth.js'];
