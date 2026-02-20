#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { watch } from 'node:fs';
import { Command } from 'commander';
import { load } from 'cheerio';
import { z } from 'zod';

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'entry-template', 'index.html');
const ENTRIES_DIR = path.join(ROOT, 'entries');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'entry');

const AUTH_SCRIPTS = [
  '/assets/dex-auth0-config.js',
  'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js',
  '/assets/dex-auth.js',
];

const entrySchema = z.object({
  slug: z.string().min(1),
  title: z.string().optional(),
  video: z.object({ dataUrl: z.string().url(), dataHtml: z.string().min(1) }),
  sidebarPageConfig: z.object({
    lookupNumber: z.string(),
    buckets: z.array(z.string()),
    specialEventImage: z.string().nullable().optional(),
    attributionSentence: z.string(),
    credits: z.object({
      artist: z.object({ name: z.string(), links: z.array(z.object({ label: z.string(), href: z.string() })) }),
      artistAlt: z.any().nullable().optional(),
      instruments: z.array(z.object({ name: z.string(), links: z.array(z.object({ label: z.string(), href: z.string() })) })),
      video: z.record(z.any()),
      audio: z.record(z.any()),
      year: z.number(),
      season: z.string(),
      location: z.string(),
    }),
    fileSpecs: z.object({
      bitDepth: z.number(), sampleRate: z.number(), channels: z.string(),
      staticSizes: z.record(z.string()),
    }),
    metadata: z.object({ sampleLength: z.string(), tags: z.array(z.string()) }),
  }),
});

const manifestSchema = z.record(z.any());

const markers = {
  videoStart: '<!-- DEX:VIDEO_START -->',
  videoEnd: '<!-- DEX:VIDEO_END -->',
  descStart: '<!-- DEX:DESC_START -->',
  descEnd: '<!-- DEX:DESC_END -->',
  cfgStart: '<!-- DEX:SIDEBAR_PAGE_CONFIG_START -->',
  cfgEnd: '<!-- DEX:SIDEBAR_PAGE_CONFIG_END -->',
};

function replaceBetweenMarkers(html, startMarker, endMarker, newInner) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) throw new Error(`Missing markers: ${startMarker} / ${endMarker}`);
  const from = start + startMarker.length;
  return html.slice(0, from) + '\n' + newInner + '\n' + html.slice(end);
}

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function getSlugs(target) {
  if (target !== 'all') return [target];
  if (!(await exists(ENTRIES_DIR))) return [];
  const dirs = await fs.readdir(ENTRIES_DIR, { withFileTypes: true });
  return dirs.filter((d) => d.isDirectory()).map((d) => d.name);
}

async function loadEntry(slug) {
  const base = path.join(ENTRIES_DIR, slug);
  const [entryRaw, desc, manifestRaw] = await Promise.all([
    fs.readFile(path.join(base, 'entry.json'), 'utf8'),
    fs.readFile(path.join(base, 'description.html'), 'utf8'),
    fs.readFile(path.join(base, 'manifest.json'), 'utf8'),
  ]);
  return {
    entry: entrySchema.parse(JSON.parse(entryRaw)),
    description: desc.trim(),
    manifest: manifestSchema.parse(JSON.parse(manifestRaw)),
  };
}

function validateTemplate(template) {
  const checks = {
    videoMarkers: template.includes(markers.videoStart) && template.includes(markers.videoEnd),
    descMarkers: template.includes(markers.descStart) && template.includes(markers.descEnd),
    cfgMarkers: template.includes(markers.cfgStart) && template.includes(markers.cfgEnd),
    manifestScript: /<script id="dex-manifest" type="application\/json">/i.test(template),
    sidebarConfigScript: /<script id="dex-sidebar-config" type="application\/json">/i.test(template),
  };
  return checks;
}

function ensureAuthSnippet(html) {
  let updated = html;
  for (const src of AUTH_SCRIPTS) {
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<script[^>]*src=["']${escaped}["'][^>]*>\\s*<\\/script>\\s*`, 'gi');
    updated = updated.replace(re, '');
  }
  const authBlock = AUTH_SCRIPTS.map((src) => `<script defer src="${src}"></script>`).join('\n');
  if (!updated.includes('</head>')) throw new Error('Missing </head> for auth injection');
  return updated.replace('</head>', `${authBlock}\n</head>`);
}

function updateVideoRegion(videoRegion, entry) {
  const $ = load(videoRegion, { decodeEntities: false });
  const wrapper = $('.sqs-video-wrapper').first();
  if (!wrapper.length) throw new Error('Video wrapper (.sqs-video-wrapper) not found in video anchor region');
  wrapper.attr('data-url', entry.video.dataUrl);
  wrapper.attr('data-html', entry.video.dataHtml.replace(/"/g, '&quot;'));
  return $.root().html();
}

function postCheck(html) {
  const $ = load(html);
  const parse = (id) => JSON.parse(($(`#${id}`).text() || '{}'));
  parse('dex-manifest');
  parse('dex-sidebar-page-config');
  if (!$('#dex-sidebar-config').length) throw new Error('#dex-sidebar-config missing');
  if ($('script[src="/assets/dex-sidebar.js"]').length !== 1) throw new Error('dex-sidebar.js include count invalid');
  const scripts = $('script[src]').toArray().map((el) => $(el).attr('src'));
  AUTH_SCRIPTS.forEach((src) => {
    if (scripts.filter((s) => s === src).length !== 1) throw new Error(`Auth script include count invalid: ${src}`);
  });
  if (!(scripts.indexOf(AUTH_SCRIPTS[0]) < scripts.indexOf(AUTH_SCRIPTS[1]) && scripts.indexOf(AUTH_SCRIPTS[1]) < scripts.indexOf(AUTH_SCRIPTS[2]))) {
    throw new Error('Auth script order invalid');
  }
}

async function writeOutput(slug, html, dryRun, alsoTopLevel) {
  const outputs = [];
  const primary = path.join(OUTPUT_DIR, slug, 'index.html');
  outputs.push(primary);
  if (alsoTopLevel) outputs.push(path.join(ROOT, 'docs', slug, 'index.html'));
  if (!dryRun) {
    for (const out of outputs) {
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, html, 'utf8');
    }
  }
  return outputs;
}

async function cmdInit(slug) {
  const dir = path.join(ENTRIES_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  const sample = {
    slug,
    title: 'Optional title',
    video: { dataUrl: 'https://player.vimeo.com/video/123456789', dataHtml: '<iframe src="https://player.vimeo.com/video/123456789" frameborder="0" allowfullscreen></iframe>' },
    sidebarPageConfig: {
      lookupNumber: 'ABCD-1234', buckets: ['A', 'B', 'C'], specialEventImage: null, attributionSentence: 'Attribution sentence',
      credits: {
        artist: { name: 'ARTIST NAME', links: [] }, artistAlt: null, instruments: [{ name: 'INSTRUMENT1', links: [] }],
        video: { director: { name: 'DIRECTOR', links: [] }, cinematography: { name: 'CINEMATOGRAPHY', links: [] }, editing: { name: 'EDITING', links: [] } },
        audio: { recording: { name: 'RECORDING', links: [] }, mix: { name: 'MIX', links: [] }, master: { name: 'MASTER', links: [] } },
        year: 2025, season: 'S1', location: 'LOCATION',
      },
      fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
      metadata: { sampleLength: '00:00:00', tags: ['TAG1', 'TAG2'] },
    },
  };
  await fs.writeFile(path.join(dir, 'entry.json'), `${JSON.stringify(sample, null, 2)}\n`);
  await fs.writeFile(path.join(dir, 'description.html'), '<p>Entry description HTML.</p>\n');
  await fs.writeFile(path.join(dir, 'manifest.json'), '{}\n');
  console.log(`Initialized entries/${slug}`);
}

async function cmdValidate(target) {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const templateChecks = validateTemplate(template);
  const slugs = await getSlugs(target);
  let failed = false;
  console.log(`Template: ${TEMPLATE_PATH}`);
  console.log(`Template anchors: ${JSON.stringify(templateChecks)}`);
  if (!Object.values(templateChecks).every(Boolean)) failed = true;
  for (const slug of slugs) {
    try {
      await loadEntry(slug);
      console.log(`✓ ${slug}`);
    } catch (error) {
      failed = true;
      console.error(`✗ ${slug}: ${error.message}`);
    }
  }
  if (failed) process.exit(1);
}

async function buildSlug(template, slug, options) {
  const { entry, description, manifest } = await loadEntry(slug);
  let html = template;

  const videoStart = html.indexOf(markers.videoStart);
  const videoEnd = html.indexOf(markers.videoEnd);
  if (videoStart === -1 || videoEnd === -1) throw new Error('Missing video markers');
  const region = html.slice(videoStart + markers.videoStart.length, videoEnd);
  const updatedRegion = updateVideoRegion(region, entry);
  html = replaceBetweenMarkers(html, markers.videoStart, markers.videoEnd, updatedRegion.trim());

  html = replaceBetweenMarkers(html, markers.descStart, markers.descEnd, description);
  html = replaceBetweenMarkers(
    html,
    markers.cfgStart,
    markers.cfgEnd,
    `<script id="dex-sidebar-page-config" type="application/json">${JSON.stringify(entry.sidebarPageConfig)}</script>`,
  );

  html = html.replace(
    /<script id="dex-manifest" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="dex-manifest" type="application/json">${JSON.stringify(manifest)}</script>`,
  );

  html = html.replace(/<script[^>]*>\s*window\.dexSidebarPageConfig\s*=\s*[\s\S]*?<\/script>/g, '');
  html = ensureAuthSnippet(html);
  postCheck(html);
  const outputs = await writeOutput(slug, html, options.dryRun, options.alsoTopLevel);

  console.log(`- ${slug}`);
  console.log(`  outputs: ${outputs.map((o) => path.relative(ROOT, o)).join(', ')}`);
  console.log('  anchors found: yes');
  console.log('  video wrapper updated: yes');
  console.log('  description injected: yes');
  console.log('  sidebar config injected: yes');
  console.log('  manifest injected: yes');
  console.log('  auth snippet present exactly once: yes');
}

async function cmdBuild(target, options) {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const checks = validateTemplate(template);
  if (!Object.values(checks).every(Boolean)) throw new Error(`Template missing requirements: ${JSON.stringify(checks)}`);
  const slugs = await getSlugs(target);
  if (!slugs.length) throw new Error('No entries found');
  console.log(`Template: ${TEMPLATE_PATH}`);
  for (const slug of slugs) {
    await buildSlug(template, slug, options);
  }
}

async function cmdWatch() {
  console.log('Watching entry-template/index.html and entries/** ...');
  let timer;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await cmdValidate('all');
        await cmdBuild('all', { dryRun: false, alsoTopLevel: false });
      } catch (error) {
        console.error(error.message);
      }
    }, 250);
  };
  watch(path.join(ROOT, 'entry-template'), { recursive: true }, run);
  watch(path.join(ROOT, 'entries'), { recursive: true }, run);
}

const program = new Command();
program.name('dex-entry');
program.command('init').argument('<slug>').action((slug) => cmdInit(slug).catch((e) => { console.error(e.message); process.exit(1); }));
program.command('validate').argument('<slugOrAll>').action((target) => cmdValidate(target).catch((e) => { console.error(e.message); process.exit(1); }));
program.command('build').argument('<slugOrAll>').option('--dry-run').option('--also-top-level').action((target, options) => cmdBuild(target, options).catch((e) => { console.error(e.message); process.exit(1); }));
program.command('watch').action(() => cmdWatch().catch((e) => { console.error(e.message); process.exit(1); }));
program.parse(process.argv);
