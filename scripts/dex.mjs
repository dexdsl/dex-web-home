#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Command } from 'commander';
import { load } from 'cheerio';
import { z } from 'zod';

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'entry-template', 'index.html');
const ENTRIES_DIR = path.join(ROOT, 'entries');
const DOCS_DIR = path.join(ROOT, 'docs');
const AUTH_SCRIPTS = [
  '/assets/dex-auth0-config.js',
  'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js',
  '/assets/dex-auth.js',
];

const markers = {
  videoStart: '@-- DEX:VIDEO_START --',
  videoEnd: '@-- DEX:VIDEO_END --',
  descStart: '@-- DEX:DESC_START --',
  descEnd: '@-- DEX:DESC_END --',
  sidebarStart: '@-- DEX:SIDEBAR_PAGE_CONFIG_START --',
  sidebarEnd: '@-- DEX:SIDEBAR_PAGE_CONFIG_END --',
};

const pinSchema = z.object({
  name: z.string(),
  links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
});

const entrySchema = z.object({
  slug: z.string(),
  title: z.string().optional(),
  video: z.object({ dataUrl: z.string().url(), dataHtml: z.string() }),
  sidebarPageConfig: z.object({
    lookupNumber: z.string(),
    buckets: z.array(z.string()),
    specialEventImage: z.string().nullable().optional(),
    attributionSentence: z.string(),
    credits: z.object({
      artist: pinSchema,
      artistAlt: z.string().nullable(),
      instruments: z.array(pinSchema),
      video: z.object({ director: pinSchema, cinematography: pinSchema, editing: pinSchema }),
      audio: z.object({ recording: pinSchema, mix: pinSchema, master: pinSchema }),
      year: z.number(),
      season: z.string(),
      location: z.string(),
    }),
    fileSpecs: z.object({
      bitDepth: z.number(),
      sampleRate: z.number(),
      channels: z.string(),
      staticSizes: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string(), E: z.string(), X: z.string() }),
    }),
    metadata: z.object({ sampleLength: z.string(), tags: z.array(z.string()) }),
  }),
});

const manifestSchema = z.object({
  audio: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  video: z.record(z.string(), z.record(z.string(), z.string())).default({}),
});

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function listSlugs() {
  if (!(await exists(ENTRIES_DIR))) return [];
  const entries = await fs.readdir(ENTRIES_DIR, { withFileTypes: true });
  return entries.filter((d) => d.isDirectory()).map((d) => d.name);
}

async function loadTemplate() {
  const html = await fs.readFile(TEMPLATE_PATH, 'utf8');
  return html;
}

function replaceBetweenMarkers(html, startMarker, endMarker, newInner) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Missing/invalid markers: ${startMarker} ... ${endMarker}`);
  }
  const insertStart = start + startMarker.length;
  return html.slice(0, insertStart) + `\n${newInner}\n` + html.slice(end);
}

function updateVideoRegion(region, entry) {
  const idx = region.indexOf('<div class="sqs-video-wrapper"');
  if (idx === -1) throw new Error('Missing .sqs-video-wrapper inside video marker region');
  const tagEnd = region.indexOf('>', idx);
  if (tagEnd === -1) throw new Error('Malformed .sqs-video-wrapper tag');
  let openTag = region.slice(idx, tagEnd + 1);
  const setAttr = (tag, name, value) => {
    const escaped = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const rx = new RegExp(`\\s${name}="[^"]*"`);
    if (rx.test(tag)) return tag.replace(rx, ` ${name}="${escaped}"`);
    return tag.replace(/>$/, ` ${name}="${escaped}">`);
  };
  openTag = setAttr(openTag, 'data-url', entry.video.dataUrl);
  openTag = setAttr(openTag, 'data-html', entry.video.dataHtml);
  return region.slice(0, idx) + openTag + region.slice(tagEnd + 1);
}

function updateScriptJson(html, selectorId, obj) {
  const json = `${JSON.stringify(obj, null, 2)}\n`;
  const rx = new RegExp(`(<script[^>]*id="${selectorId}"[^>]*type="application/json"[^>]*>)([\\s\\S]*?)(</script>)`);
  const m = html.match(rx);
  if (!m) throw new Error(`Missing script#${selectorId}[type="application/json"]`);
  return html.replace(rx, `$1\n${json}$3`);
}

function ensureAuthSnippet(html) {
  const noLegacy = html.replace(/<!-- Auth0 -->[\s\S]*?<!-- end Auth0 -->/g, '');
  const stripped = noLegacy.replace(/<script[^>]*src="(?:\/assets\/dex-auth0-config\.js|https:\/\/cdn\.auth0\.com\/js\/auth0-spa-js\/2\.0\/auth0-spa-js\.production\.js|\/assets\/dex-auth\.js)"[^>]*><\/script>\s*/g, '');
  const block = AUTH_SCRIPTS.map((src) => `<script defer src="${src}"></script>`).join('\n');
  if (!stripped.includes('</head>')) throw new Error('Missing </head> while injecting auth scripts');
  return stripped.replace('</head>', `${block}\n</head>`);
}

async function loadEntry(slug) {
  const dir = path.join(ENTRIES_DIR, slug);
  const entryPath = path.join(dir, 'entry.json');
  const descriptionPath = path.join(dir, 'description.html');
  const manifestPath = path.join(dir, 'manifest.json');
  const [entryRaw, descriptionHtml, manifestRaw] = await Promise.all([
    fs.readFile(entryPath, 'utf8'),
    fs.readFile(descriptionPath, 'utf8'),
    fs.readFile(manifestPath, 'utf8'),
  ]);
  const entry = entrySchema.parse(JSON.parse(entryRaw));
  const manifest = manifestSchema.parse(JSON.parse(manifestRaw));
  return { entry, descriptionHtml, manifest };
}

function postCheck(html) {
  const $ = load(html);
  const manifestTxt = $('#dex-manifest[type="application/json"]').text();
  JSON.parse(manifestTxt);
  if ($('#dex-sidebar-config[type="application/json"]').length !== 1) throw new Error('Missing #dex-sidebar-config');
  const pageCfgEl = $('#dex-sidebar-page-config[type="application/json"]');
  if (pageCfgEl.length !== 1) throw new Error('Missing #dex-sidebar-page-config');
  JSON.parse(pageCfgEl.text() || '{}');
  if ($('script[src="/assets/dex-sidebar.js"]').length !== 1) throw new Error('dex-sidebar.js include count != 1');
  const authNodes = $('script[src]').toArray().map((el) => $(el).attr('src'));
  AUTH_SCRIPTS.forEach((src) => {
    if (authNodes.filter((s) => s === src).length !== 1) throw new Error(`Auth script count invalid: ${src}`);
  });
  const indices = AUTH_SCRIPTS.map((src) => authNodes.findIndex((s) => s === src));
  if (!(indices[0] < indices[1] && indices[1] < indices[2])) throw new Error('Auth script order invalid');
}

async function validate(slugArg) {
  const template = await loadTemplate();
  const anchorChecks = {
    video: template.includes(markers.videoStart) && template.includes(markers.videoEnd),
    desc: template.includes(markers.descStart) && template.includes(markers.descEnd),
    sidebar: template.includes(markers.sidebarStart) && template.includes(markers.sidebarEnd),
    manifestScript: /id="dex-manifest"\s+type="application\/json"/.test(template),
    sidebarConfigScript: /id="dex-sidebar-config"\s+type="application\/json"/.test(template),
  };
  const slugs = slugArg === 'all' ? await listSlugs() : [slugArg];
  let failed = false;
  console.log(`Template: ${TEMPLATE_PATH}`);
  for (const slug of slugs) {
    try {
      await loadEntry(slug);
      console.log(`[${slug}] ok`);
    } catch (error) {
      failed = true;
      console.log(`[${slug}] fail: ${error.message}`);
    }
  }
  console.log(`Anchors: ${JSON.stringify(anchorChecks)}`);
  if (Object.values(anchorChecks).some((v) => !v)) failed = true;
  if (failed) process.exit(1);
}

async function build(slugArg, opts) {
  const slugs = slugArg === 'all' ? await listSlugs() : [slugArg];
  const template = await loadTemplate();
  let failed = false;
  console.log(`Template: ${TEMPLATE_PATH}`);

  for (const slug of slugs) {
    try {
      const { entry, descriptionHtml, manifest } = await loadEntry(slug);
      let html = template;

      const videoStartIndex = html.indexOf(markers.videoStart);
      const videoEndIndex = html.indexOf(markers.videoEnd);
      if (videoStartIndex === -1 || videoEndIndex === -1) throw new Error('Video anchors missing');
      const videoRegion = html.slice(videoStartIndex + markers.videoStart.length, videoEndIndex);
      const updatedVideoRegion = updateVideoRegion(videoRegion, entry);
      html = replaceBetweenMarkers(html, markers.videoStart, markers.videoEnd, updatedVideoRegion.trim());

      html = replaceBetweenMarkers(html, markers.descStart, markers.descEnd, descriptionHtml.trim());

      const sidebarSegmentStart = html.indexOf(markers.sidebarStart);
      const sidebarSegmentEnd = html.indexOf(markers.sidebarEnd);
      if (sidebarSegmentStart === -1 || sidebarSegmentEnd === -1) throw new Error('Sidebar anchors missing');
      const sidebarSegment = html.slice(sidebarSegmentStart + markers.sidebarStart.length, sidebarSegmentEnd);
      const sidebarUpdated = updateScriptJson(sidebarSegment, 'dex-sidebar-page-config', entry.sidebarPageConfig);
      html = replaceBetweenMarkers(html, markers.sidebarStart, markers.sidebarEnd, sidebarUpdated.trim());

      html = updateScriptJson(html, 'dex-manifest', manifest);
      html = ensureAuthSnippet(html);
      postCheck(html);

      const out = path.join(DOCS_DIR, 'entry', slug, 'index.html');
      const outAlias = path.join(DOCS_DIR, slug, 'index.html');
      if (!opts.dryRun) {
        await fs.mkdir(path.dirname(out), { recursive: true });
        await fs.writeFile(out, html, 'utf8');
        if (opts.alsoTopLevel) {
          await fs.mkdir(path.dirname(outAlias), { recursive: true });
          await fs.writeFile(outAlias, html, 'utf8');
        }
      }

      const $ = load(html);
      const authSrcs = $('script[src]').toArray().map((el) => $(el).attr('src'));
      const authOk = AUTH_SCRIPTS.every((src) => authSrcs.filter((s) => s === src).length === 1);
      console.log(`[${slug}] output=${out}${opts.alsoTopLevel ? `, ${outAlias}` : ''} anchors=ok video=yes desc=yes sidebar=yes manifest=yes authOnce=${authOk ? 'yes' : 'no'}`);
    } catch (error) {
      failed = true;
      console.log(`[${slug}] fail: ${error.message}`);
    }
  }

  if (failed) process.exit(1);
}

async function init(slug) {
  const dir = path.join(ENTRIES_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  const entryPath = path.join(dir, 'entry.json');
  const descPath = path.join(dir, 'description.html');
  const manifestPath = path.join(dir, 'manifest.json');
  if (!(await exists(entryPath))) {
    await fs.writeFile(entryPath, JSON.stringify({
      slug,
      title: '',
      video: { dataUrl: 'https://player.vimeo.com/video/123456789', dataHtml: '<iframe src="https://player.vimeo.com/video/123456789" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>' },
      sidebarPageConfig: {
        lookupNumber: 'ABCD-1234',
        buckets: ['A', 'B', 'C'],
        specialEventImage: null,
        attributionSentence: 'YOUR ATTRIBUTION SENTENCE HERE',
        credits: {
          artist: { name: 'ARTIST NAME', links: [] }, artistAlt: null, instruments: [{ name: 'INSTRUMENT1', links: [] }],
          video: { director: { name: 'VIDEO DIRECTOR', links: [] }, cinematography: { name: 'CINEMATOGRAPHY', links: [] }, editing: { name: 'EDITING', links: [] } },
          audio: { recording: { name: 'RECORDING ENGINEER', links: [] }, mix: { name: 'MIX ENGINEER', links: [] }, master: { name: 'MASTER ENGINEER', links: [] } },
          year: 2025, season: 'S1', location: 'LOCATION',
        },
        fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '...', B: '...', C: '...', D: '...', E: '...', X: '...' } },
        metadata: { sampleLength: '00:00:00', tags: ['TAG1', 'TAG2'] },
      },
    }, null, 2) + '\n', 'utf8');
  }
  if (!(await exists(descPath))) await fs.writeFile(descPath, '<p>Entry description goes here.</p>\n', 'utf8');
  if (!(await exists(manifestPath))) await fs.writeFile(manifestPath, JSON.stringify({ audio: {}, video: {} }, null, 2) + '\n', 'utf8');
  console.log(`Initialized ${slug} in ${dir}`);
}

async function watch() {
  console.log('Watching entry-template/index.html and entries/** ...');
  let timeout;
  const run = () => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      try {
        await validate('all');
        await build('all', { dryRun: false, alsoTopLevel: false });
      } catch (error) {
        console.error(error.message);
      }
    }, 250);
  };
  run();
  const watcher = await import('node:fs');
  watcher.watch(path.join(ROOT, 'entry-template'), { recursive: true }, run);
  watcher.watch(ENTRIES_DIR, { recursive: true }, run);
}

const program = new Command();
program.name('dex-entry');
program.command('init').argument('<slug>').action((slug) => init(slug));
program.command('validate').argument('<slug|all>').action((slug) => validate(slug));
program.command('build').argument('<slug|all>').option('--dry-run').option('--also-top-level').action((slug, opts) => build(slug, opts));
program.command('watch').action(() => watch());

await program.parseAsync(process.argv);
