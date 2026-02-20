#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import prompts from 'prompts';
import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import {
  ALL_BUCKETS,
  BUCKETS,
  creditsSchema,
  manifestSchemaForFormats,
  normalizeManifest,
  slugify,
} from './lib/entry-schema.mjs';
import { prepareTemplate, writeEntryFromData } from './lib/init-core.mjs';
import { descriptionTextFromSeed } from './lib/entry-html.mjs';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

const ensure = async (p) => { try { await fs.access(p); return true; } catch { return false; } };
const parseJsonMaybe = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

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

function defaultCredits(base) {
  const now = new Date().getUTCFullYear();
  return {
    artist: { name: base?.artist?.name || '', links: Array.isArray(base?.artist?.links) ? base.artist.links : [] },
    artistAlt: base?.artistAlt || null,
    instruments: Array.isArray(base?.instruments) ? base.instruments : [],
    video: {
      director: { name: base?.video?.director?.name || '', links: Array.isArray(base?.video?.director?.links) ? base.video.director.links : [] },
      cinematography: { name: base?.video?.cinematography?.name || '', links: Array.isArray(base?.video?.cinematography?.links) ? base.video.cinematography.links : [] },
      editing: { name: base?.video?.editing?.name || '', links: Array.isArray(base?.video?.editing?.links) ? base.video.editing.links : [] },
    },
    audio: { recording: { name: base?.audio?.recording?.name || '', links: Array.isArray(base?.audio?.recording?.links) ? base.audio.recording.links : [] }, mix: { name: base?.audio?.mix?.name || '', links: Array.isArray(base?.audio?.mix?.links) ? base.audio.mix.links : [] }, master: { name: base?.audio?.master?.name || '', links: Array.isArray(base?.audio?.master?.links) ? base.audio.master.links : [] } },
    year: Number(base?.year) || now,
    season: base?.season || 'S1',
    location: typeof base?.location === 'string' ? base.location : '',
  };
}

function mapSeriesToImage(series) {
  if (series === 'dex') return '/assets/series/dex.png';
  if (series === 'inDex') return '/assets/series/index.png';
  if (series === 'dexFest') return '/assets/series/dexfest.png';
  return null;
}

function iframeFor(url) {
  return `<iframe src="${url}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}

async function collectInitData(opts, slugArg) {
  const base = opts.from ? await parseJsonMaybe(path.resolve(opts.from)) : {};
  const quick = !!opts.quick;

  const nonInteractive = !process.stdin.isTTY;
  if (nonInteractive) {
    const title = base.title || slugArg || 'new entry';
    const lookup = base.sidebarPageConfig?.lookupNumber || 'LOOKUP-0000';
    const outDir = path.resolve(opts.out || './entries');
    const existing = new Set((await ensure(outDir)) ? (await fs.readdir(outDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : []);
    const computedSlug = dedupeSlug(slugify(slugArg || base.slug || title), existing);
    const videoUrl = base.video?.dataUrl || 'https://player.vimeo.com/video/123456789';
    const sidebar = {
      lookupNumber: lookup, buckets: base.sidebarPageConfig?.buckets || ['A'], specialEventImage: base.sidebarPageConfig?.specialEventImage || null,
      attributionSentence: base.sidebarPageConfig?.attributionSentence || 'Attribution',
      credits: defaultCredits(base.sidebarPageConfig?.credits),
      fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
      metadata: { sampleLength: '', tags: [] },
    };
    const manifest = normalizeManifest(base.manifest || {}, opts.formatKeys, ALL_BUCKETS);
    manifestSchemaForFormats(opts.formatKeys?.audio || [], opts.formatKeys?.video || []).parse(manifest);
    return { slug: computedSlug, title, video: { mode: 'url', dataUrl: videoUrl, dataHtml: iframeFor(videoUrl) }, descriptionText: descriptionTextFromSeed(base), sidebar, manifest, authEnabled: true, outDir };
  }

  const id = await prompts([
    { type: 'text', name: 'title', message: 'Title:', initial: base.title || '', validate: (v) => (!!v || 'Required') },
    { type: 'text', name: 'slug', message: 'Slug:', initial: slugArg || base.slug || undefined },
  ]);
  const outDir = path.resolve(opts.out || './entries');
  const existing = new Set((await ensure(outDir)) ? (await fs.readdir(outDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : []);
  const computedSlug = dedupeSlug(slugify(id.slug || id.title), existing);

  const nameAns = await prompts({ type: 'text', name: 'name', message: 'Name:', initial: base.sidebarPageConfig?.credits?.artist?.name || '', validate: (v) => (!!v || 'Required') });

  const instruments = [{ name: (await prompts({ type: 'text', name: 'instrument', message: 'Instrument:', initial: base.sidebarPageConfig?.credits?.instruments?.[0]?.name || '', validate: (v) => (!!v || 'Required') })).instrument, links: quick ? [] : await promptLinks('Add instrument link?') }];
  if (!quick) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { add } = await prompts({ type: 'toggle', name: 'add', message: 'Add another instrument?', initial: false, active: 'yes', inactive: 'no' });
      if (!add) break;
      const item = await prompts({ type: 'text', name: 'name', message: 'Instrument name:', validate: (v) => (!!v || 'Required') });
      instruments.push({ name: item.name, links: await promptLinks('Add instrument link?') });
    }
  }



  const lookupAns = await prompts({ type: 'text', name: 'lookup', message: 'Lookup number:', initial: base.sidebarPageConfig?.lookupNumber || '', validate: (v) => (!!v || 'Required') });

  const videoMode = await prompts({
    type: 'select',
    name: 'mode',
    message: 'Video input:',
    choices: [{ title: 'Paste URL', value: 'url' }, { title: 'Paste raw embed HTML', value: 'embed' }],
    initial: 0,
  });
  const video = videoMode.mode === 'embed'
    ? { mode: 'embed', dataUrl: '', dataHtml: (await prompts({ type: 'text', name: 'dataHtml', message: 'Paste raw embed HTML:' })).dataHtml || '' }
    : { mode: 'url', dataUrl: '', dataHtml: '' };
  if (video.mode === 'url') {
    const ans = await prompts({ type: 'text', name: 'url', message: 'Video URL:', initial: base.video?.dataUrl || '', validate: (v) => (!!v || 'Required') });
    video.dataUrl = ans.url;
    video.dataHtml = iframeFor(ans.url);
  }

  const artistLinks = quick ? [] : await promptLinks('Add artist link?');

  const descriptionText = (await prompts({ type: 'text', name: 'description', message: 'Description (plain text):', initial: descriptionTextFromSeed(base) })).description || '';

  const seriesAns = await prompts({
    type: 'select',
    name: 'series',
    message: 'Series:',
    choices: [{ title: 'dex', value: 'dex' }, { title: 'inDex', value: 'inDex' }, { title: 'dexFest', value: 'dexFest' }, { title: 'none', value: 'none' }],
    initial: 3,
  });

  const bucketAns = await prompts({ type: 'multiselect', name: 'buckets', message: 'Buckets (available):', choices: BUCKETS.map((b) => ({ title: b, value: b })), initial: (base.sidebarPageConfig?.buckets || ['A']).map((b) => BUCKETS.indexOf(b)).filter((i) => i >= 0), min: 1 });
  const attributionAns = await prompts({ type: 'text', name: 'attributionSentence', message: 'Attribution sentence:', initial: base.sidebarPageConfig?.attributionSentence || '', validate: (v) => (!!v || 'Required') });

  const creditsMode = await prompts({ type: 'select', name: 'mode', message: 'Credits:', choices: [{ title: 'Use minimal defaults', value: 'defaults' }, { title: 'Paste credits JSON (advanced)', value: 'json' }], initial: 0 });
  let credits = defaultCredits(base.sidebarPageConfig?.credits);
  if (creditsMode.mode === 'json') {
    const raw = (await prompts({ type: 'text', name: 'raw', message: 'Paste credits JSON:' })).raw || '{}';
    credits = creditsSchema.parse(JSON.parse(raw));
  } else {
    const c = await prompts([
      { type: 'number', name: 'year', message: 'Year:', initial: credits.year },
      { type: 'text', name: 'season', message: 'Season:', initial: credits.season, validate: (v) => (!!v || 'Required') },
      { type: 'text', name: 'location', message: 'Location:', initial: credits.location || '' },
    ]);
    credits.year = Number(c.year) || credits.year;
    credits.season = c.season;
    credits.location = c.location || '';
  }
  credits.artist = { name: nameAns.name, links: artistLinks };
  credits.instruments = instruments;

  const sidebar = {
    lookupNumber: lookupAns.lookup,
    buckets: bucketAns.buckets,
    specialEventImage: mapSeriesToImage(seriesAns.series),
    attributionSentence: attributionAns.attributionSentence,
    credits,
    fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
    metadata: { sampleLength: '', tags: [] },
  };

  const manifestMode = await prompts({ type: 'select', name: 'mode', message: 'Download:', choices: [{ title: 'Paste manifest JSON', value: 'json' }, { title: 'Generate empty manifest (fill later)', value: 'empty' }] });
  const manifest = manifestMode.mode === 'json'
    ? JSON.parse((await prompts({ type: 'text', name: 'raw', message: 'Paste manifest JSON:' })).raw || '{}')
    : {};
  normalizeManifest(manifest, opts.formatKeys, ALL_BUCKETS);
  manifestSchemaForFormats(opts.formatKeys?.audio || [], opts.formatKeys?.video || []).parse(manifest);
  const auth = await prompts({ type: 'toggle', name: 'enabled', message: 'Ensure canonical auth snippet + strip legacy Auth0 blocks?', initial: true, active: 'yes', inactive: 'no' });

  return {
    slug: computedSlug,
    title: id.title,
    video,
    descriptionText,
    sidebar,
    manifest: normalizeManifest(manifest, opts.formatKeys, ALL_BUCKETS),
    authEnabled: auth.enabled,
    outDir,
  };
}

async function initCommand(slugArg, opts) {
  const { templatePath, templateHtml, formatKeys } = await prepareTemplate({ templateArg: opts.template });
  const data = await collectInitData({ ...opts, formatKeys }, slugArg);
  const { report, lines } = await writeEntryFromData({ templatePath, templateHtml, data, opts });
  lines.forEach((line) => console.log(line));

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
  const { runDashboard } = await import('./ui/dashboard.mjs');
  await runDashboard({
    paletteOpen: topLevel.paletteOpen,
    version: packageJson.version || 'dev',
  });
  process.exit(0);
}

const program = new Command();
program.name('dex');
program.command('init').argument('[slug]').option('--quick').option('--advanced').option('--out <dir>', 'output root', './entries').option('--template <path>').option('--open').option('--dry-run').option('--flat').option('--from <entryJson>').action(initCommand);

await program.parseAsync(process.argv);
