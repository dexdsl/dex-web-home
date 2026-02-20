#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import prompts from 'prompts';
import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import {
  BUCKETS,
  slugify,
} from './lib/entry-schema.mjs';
import { detectTemplateProblems, extractFormatKeys } from './lib/entry-html.mjs';
import { writeEntryFromData } from './lib/entry-run.mjs';
import { runDashboard } from './ui/dashboard.mjs';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const ROOT = process.cwd();
const ENTRIES_DIR = path.join(ROOT, 'entries');

const ensure = async (p) => { try { await fs.access(p); return true; } catch { return false; } };
const parseJsonMaybe = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

async function detectTemplate(templateArg) {
  // If user explicitly passed a template, treat failures as hard errors.
  if (templateArg) {
    const p = path.resolve(templateArg);
    if (!(await ensure(p))) throw new Error(`Template not found: ${p}`);
    const html = await fs.readFile(p, 'utf8');
    const missing = detectTemplateProblems(html);
    if (missing.length) throw new Error(`Template validation failed (${p}); missing: ${missing.join(', ')}`);
    return { templatePath: p, templateHtml: html };
  }

  // Otherwise: prefer CWD index.html ONLY if it validates; else fall back to repo template.
  const candidates = [
    path.resolve(process.cwd(), 'index.html'),
    path.join(PROJECT_ROOT, 'entry-template', 'index.html'),
  ];

  const reports = [];
  for (const p of candidates) {
    if (!(await ensure(p))) {
      reports.push(`- ${p}: not found`);
      continue;
    }
    const html = await fs.readFile(p, 'utf8');
    const missing = detectTemplateProblems(html);
    if (!missing.length) return { templatePath: p, templateHtml: html };
    reports.push(`- ${p}: invalid (missing: ${missing.join(', ')})`);
  }

  throw new Error(
    `No valid template found.\n` +
    `Tried:\n${reports.join('\n')}\n` +
    `Tip: pass --template <path> to force a specific template.`
  );
}

function dedupeSlug(base, existing) {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

async function promptLinks(message) {
  const links = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { add } = await prompts({ type: 'toggle', name: 'add', message, initial: false, active: 'yes', inactive: 'no' });
    if (!add) break;
    const ans = await prompts([
      { type: 'text', name: 'label', message: 'Link label:', validate: (v) => (!!v || 'Required') },
      { type: 'text', name: 'href', message: 'Link href:', validate: (v) => (!!v || 'Required') },
    ]);
    links.push(ans);
  }
  return links;
}

async function openEditor(initial = '') {
  const file = path.join(os.tmpdir(), `dex-desc-${Date.now()}.html`);
  await fs.writeFile(file, initial, 'utf8');
  const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vi');
  const r = spawnSync(editor, [file], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Editor exited with code ${r.status}`);
  const out = await fs.readFile(file, 'utf8');
  await fs.unlink(file).catch(() => {});
  return out.trim();
}

function iframeFor(url) {
  return `<iframe src="${url}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}

async function collectInitData(opts, slugArg) {
  const base = opts.from ? await parseJsonMaybe(path.resolve(opts.from)) : {};
  const quick = !!opts.quick;
  const advanced = !!opts.advanced;

  const nonInteractive = !process.stdin.isTTY;
  if (nonInteractive) {
    const title = base.title || slugArg || 'new entry';
    const lookup = base.sidebarPageConfig?.lookupNumber || 'LOOKUP-0000';
    const outDir = path.resolve(opts.out || './entries');
    const existing = new Set((await ensure(outDir)) ? (await fs.readdir(outDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : []);
    const computedSlug = dedupeSlug(slugify(slugArg || base.slug || title), existing);
    const videoUrl = base.video?.dataUrl || 'https://player.vimeo.com/video/123456789';
    const sidebar = {
      lookupNumber: lookup, buckets: base.sidebarPageConfig?.buckets || ['A'], specialEventImage: null,
      attributionSentence: base.sidebarPageConfig?.attributionSentence || 'Attribution',
      credits: { artist: { name: base.sidebarPageConfig?.credits?.artist?.name || 'Artist', links: [] }, artistAlt: null, instruments: [],
        video: { director: { name: '', links: [] }, cinematography: { name: '', links: [] }, editing: { name: '', links: [] } },
        audio: { recording: { name: '', links: [] }, mix: { name: '', links: [] }, master: { name: '', links: [] } },
        year: base.sidebarPageConfig?.credits?.year || new Date().getUTCFullYear(), season: base.sidebarPageConfig?.credits?.season || 'S1', location: base.sidebarPageConfig?.credits?.location || 'Unknown' },
      fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
      metadata: { sampleLength: '', tags: [] },
    };
    const manifest = base.manifest || { audio: { A: Object.fromEntries((opts.formatKeys?.audio || []).map((k)=>[k,''])) }, video: { A: Object.fromEntries((opts.formatKeys?.video || []).map((k)=>[k,''])) } };
    return { slug: computedSlug, title, video: { mode: 'url', dataUrl: videoUrl, dataHtml: iframeFor(videoUrl) }, descriptionHtml: base.descriptionHtml || '<p></p>', sidebar, manifest, authEnabled: true, outDir };
  }

  const id = await prompts([
    { type: 'text', name: 'title', message: 'Title:', initial: base.title || '', validate: (v) => (!!v || 'Required') },
    { type: 'text', name: 'slug', message: 'Slug:', initial: slugArg || base.slug || undefined },
    { type: 'text', name: 'lookup', message: 'Lookup number:', initial: base.sidebarPageConfig?.lookupNumber || '', validate: (v) => (!!v || 'Required') },
  ]);
  const outDir = path.resolve(opts.out || './entries');
  const existing = new Set((await ensure(outDir)) ? (await fs.readdir(outDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : []);
  const computedSlug = dedupeSlug(slugify(id.slug || id.title), existing);

  const videoMode = await prompts({
    type: 'select',
    name: 'mode',
    message: 'Video input:',
    choices: [{ title: 'Paste URL', value: 'url' }, { title: 'Paste raw embed HTML', value: 'embed' }],
    initial: 0,
  });
  const video = videoMode.mode === 'embed'
    ? { mode: 'embed', dataUrl: '', dataHtml: (await prompts({ type: 'text', name: 'dataHtml', message: 'Paste raw embed HTML:' })).dataHtml || '' }
    : (() => {
      const dataUrl = (base.video?.dataUrl) || 'https://player.vimeo.com/video/123456789';
      return { mode: 'url', dataUrl: (prompts.inject ? undefined : dataUrl), dataHtml: '' };
    })();
  if (video.mode === 'url') {
    const ans = await prompts({ type: 'text', name: 'url', message: 'Video URL:', initial: base.video?.dataUrl || '', validate: (v) => (!!v || 'Required') });
    video.dataUrl = ans.url;
    video.dataHtml = iframeFor(ans.url);
  }

  const descMode = await prompts({ type: 'select', name: 'mode', message: 'Description:', choices: [{ title: 'Paste now', value: 'paste' }, { title: 'Open $EDITOR', value: 'editor' }] });
  let descriptionHtml = '';
  if (descMode.mode === 'editor') descriptionHtml = await openEditor(base.descriptionHtml || '<p></p>');
  else descriptionHtml = (await prompts({ type: 'text', name: 'description', message: 'Paste description HTML:' })).description || '<p></p>';

  const defaults = {
    buckets: base.sidebarPageConfig?.buckets || ['A'],
    specialEventImage: base.sidebarPageConfig?.specialEventImage || null,
    attributionSentence: base.sidebarPageConfig?.attributionSentence || '',
    artist: base.sidebarPageConfig?.credits?.artist?.name || '',
    artistAlt: base.sidebarPageConfig?.credits?.artistAlt || '',
    year: base.sidebarPageConfig?.credits?.year || new Date().getUTCFullYear(),
    season: base.sidebarPageConfig?.credits?.season || 'S1',
    location: base.sidebarPageConfig?.credits?.location || '',
  };

  const baseQs = [
    { type: 'multiselect', name: 'buckets', message: 'Buckets:', choices: BUCKETS.map((b) => ({ title: b, value: b })), initial: defaults.buckets.map((b) => BUCKETS.indexOf(b)).filter((i) => i >= 0), min: 1 },
    { type: 'text', name: 'attributionSentence', message: 'Attribution sentence:', initial: defaults.attributionSentence, validate: (v) => (!!v || 'Required') },
    { type: 'text', name: 'artist', message: 'Artist name:', initial: defaults.artist, validate: (v) => (!!v || 'Required') },
    { type: 'number', name: 'year', message: 'Year:', initial: defaults.year },
    { type: 'text', name: 'season', message: 'Season:', initial: defaults.season, validate: (v) => (!!v || 'Required') },
    { type: 'text', name: 'location', message: 'Location:', initial: defaults.location, validate: (v) => (!!v || 'Required') },
  ];

  const quickAns = await prompts(quick ? baseQs : [...baseQs, { type: 'text', name: 'specialEventImage', message: 'Special event image URL (optional):', initial: defaults.specialEventImage || '' }]);
  const sidebar = {
    lookupNumber: id.lookup,
    buckets: quickAns.buckets,
    specialEventImage: quick ? null : (quickAns.specialEventImage || null),
    attributionSentence: quickAns.attributionSentence,
    credits: {
      artist: { name: quickAns.artist, links: quick ? [] : await promptLinks('Add artist link?') },
      artistAlt: quick ? null : ((await prompts({ type: 'text', name: 'artistAlt', message: 'ArtistAlt (optional):', initial: defaults.artistAlt })).artistAlt || null),
      instruments: quick ? [] : [],
      video: { director: { name: '', links: [] }, cinematography: { name: '', links: [] }, editing: { name: '', links: [] } },
      audio: { recording: { name: '', links: [] }, mix: { name: '', links: [] }, master: { name: '', links: [] } },
      year: Number(quickAns.year),
      season: quickAns.season,
      location: quickAns.location,
    },
    fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
    metadata: { sampleLength: '', tags: [] },
  };

  if (!quick) {
    const inst = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { add } = await prompts({ type: 'toggle', name: 'add', message: 'Add instrument credit?', initial: false, active: 'yes', inactive: 'no' });
      if (!add) break;
      const item = await prompts({ type: 'text', name: 'name', message: 'Instrument name:', validate: (v) => (!!v || 'Required') });
      inst.push({ name: item.name, links: await promptLinks('Add instrument link?') });
    }
    sidebar.credits.instruments = inst;
  }

  const manifestMode = await prompts({ type: 'select', name: 'mode', message: 'Manifest input:', choices: [{ title: 'Paste JSON', value: 'json' }, { title: 'Guided', value: 'guided' }] });
  const manifest = { audio: {}, video: {} };
  if (manifestMode.mode === 'json') {
    const raw = (await prompts({ type: 'text', name: 'raw', message: 'Paste manifest JSON:' })).raw || '{}';
    Object.assign(manifest, JSON.parse(raw));
  } else {
    const fmt = opts.formatKeys || { audio: [], video: [] };
    for (const bucket of sidebar.buckets) {
      manifest.audio[bucket] = {};
      manifest.video[bucket] = {};
      for (const k of fmt.audio) {
        manifest.audio[bucket][k] = (await prompts({ type: 'text', name: 'v', message: `Audio ${bucket}.${k} file id (blank ok):` })).v || '';
      }
      for (const k of fmt.video) {
        manifest.video[bucket][k] = (await prompts({ type: 'text', name: 'v', message: `Video ${bucket}.${k} file id (blank ok):` })).v || '';
      }
    }
  }

  if (advanced) {
    const raw = JSON.stringify(sidebar, null, 2);
    const editRaw = await prompts({ type: 'toggle', name: 'edit', message: 'Edit sidebar JSON in editor?', initial: false, active: 'yes', inactive: 'no' });
    if (editRaw.edit) Object.assign(sidebar, JSON.parse(await openEditor(raw)));
  }

  const auth = await prompts({ type: 'toggle', name: 'enabled', message: 'Ensure canonical auth snippet + strip legacy Auth0 blocks?', initial: true, active: 'yes', inactive: 'no' });

  return {
    slug: computedSlug,
    title: id.title,
    video,
    descriptionHtml,
    sidebar,
    manifest,
    authEnabled: auth.enabled,
    outDir,
  };
}

async function initCommand(slugArg, opts) {
  const { templatePath, templateHtml } = await detectTemplate(opts.template);
  const formatKeys = extractFormatKeys(templateHtml);
  const data = await collectInitData({ ...opts, formatKeys }, slugArg);
  const report = await writeEntryFromData({ templatePath, templateHtml, data, opts, log: console.log });

  if (process.env.DEX_INIT_REPORT_PATH) {
    await fs.writeFile(process.env.DEX_INIT_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8').catch(() => {});
  }
}


function parseTopLevelMode(argv) {
  const args = argv.slice(2);
  const firstNonFlag = args.find((arg) => !arg.startsWith('-'));
  const hasTopHelp = args.includes('--help') || args.includes('-h');

  if (!firstNonFlag && args.length === 0) return { mode: 'dashboard', paletteOpen: false };
  if (!firstNonFlag && hasTopHelp) return { mode: 'dashboard', paletteOpen: true };
  return { mode: 'commander', paletteOpen: false };
}

const topLevel = parseTopLevelMode(process.argv);
if (topLevel.mode === 'dashboard') {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.log('dex: interactive dashboard requires a TTY. Try: dex init');
    process.exit(0);
  }

  const packageJson = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  await runDashboard({
    paletteOpen: topLevel.paletteOpen,
    version: packageJson.version || 'dev',
    onRunInit: async (data, log) => {
      const { templatePath, templateHtml } = await detectTemplate();
      return writeEntryFromData({
        templatePath,
        templateHtml,
        data: { ...data, outDir: ENTRIES_DIR },
        opts: {},
        log,
      });
    },
  });
  process.exit(0);
}

const program = new Command();
program.name('dex');
program.command('init').argument('[slug]').option('--quick').option('--advanced').option('--out <dir>', 'output root', './entries').option('--template <path>').option('--open').option('--dry-run').option('--flat').option('--from <entryJson>').action(initCommand);

await program.parseAsync(process.argv);
