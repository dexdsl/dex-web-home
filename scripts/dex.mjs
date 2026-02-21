#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import prompts from 'prompts';
import { fileURLToPath } from 'node:url';
import {
  ALL_BUCKETS,
  BUCKETS,
  manifestSchemaForFormats,
  normalizeManifest,
  slugify,
} from './lib/entry-schema.mjs';
import { buildEmptyManifestSkeleton, prepareTemplate, writeEntryFromData } from './lib/init-core.mjs';
import { scanEntries } from './lib/doctor.mjs';
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
    artist: Array.isArray(base?.artist) ? base.artist : (base?.artist?.name ? String(base.artist.name).split(',').map((v) => v.trim()).filter(Boolean) : []),
    artistAlt: base?.artistAlt || null,
    instruments: Array.isArray(base?.instruments) ? base.instruments : [],
    video: {
      director: Array.isArray(base?.video?.director) ? base.video.director : (base?.video?.director?.name ? String(base.video.director.name).split(',').map((v) => v.trim()).filter(Boolean) : []),
      cinematography: Array.isArray(base?.video?.cinematography) ? base.video.cinematography : (base?.video?.cinematography?.name ? String(base.video.cinematography.name).split(',').map((v) => v.trim()).filter(Boolean) : []),
      editing: Array.isArray(base?.video?.editing) ? base.video.editing : (base?.video?.editing?.name ? String(base.video.editing.name).split(',').map((v) => v.trim()).filter(Boolean) : []),
    },
    audio: { recording: Array.isArray(base?.audio?.recording) ? base.audio.recording : (base?.audio?.recording?.name ? String(base.audio.recording.name).split(',').map((v) => v.trim()).filter(Boolean) : []), mix: Array.isArray(base?.audio?.mix) ? base.audio.mix : (base?.audio?.mix?.name ? String(base.audio.mix.name).split(',').map((v) => v.trim()).filter(Boolean) : []), master: Array.isArray(base?.audio?.master) ? base.audio.master : (base?.audio?.master?.name ? String(base.audio.master.name).split(',').map((v) => v.trim()).filter(Boolean) : []) },
    year: Number(base?.year) || now,
    season: base?.season || 'S1',
    location: typeof base?.location === 'string' && base.location.trim() ? base.location : 'Unknown',
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
    const seedCredits = base.creditsData || base.sidebarPageConfig?.credits;
    const sidebar = {
      lookupNumber: lookup, buckets: base.sidebarPageConfig?.buckets || ['A'], specialEventImage: base.sidebarPageConfig?.specialEventImage || null,
      attributionSentence: base.sidebarPageConfig?.attributionSentence || 'Attribution',
      credits: defaultCredits(seedCredits),
      fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
      metadata: { sampleLength: '', tags: [] },
    };
    const manifest = normalizeManifest(buildEmptyManifestSkeleton(opts.formatKeys), opts.formatKeys, ALL_BUCKETS);
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

  const nameAns = await prompts({ type: 'text', name: 'name', message: 'Name:', initial: Array.isArray(base.sidebarPageConfig?.credits?.artist) ? base.sidebarPageConfig.credits.artist.join(', ') : (base.sidebarPageConfig?.credits?.artist?.name || ''), validate: (v) => (!!v || 'Required') });

  const instruments = [(await prompts({ type: 'text', name: 'instrument', message: 'Instrument:', initial: Array.isArray(base.sidebarPageConfig?.credits?.instruments) ? String(base.sidebarPageConfig.credits.instruments[0] || '') : String(base.sidebarPageConfig?.credits?.instruments?.[0]?.name || ''), validate: (v) => (!!v || 'Required') })).instrument];
  if (!quick) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { add } = await prompts({ type: 'toggle', name: 'add', message: 'Add another instrument?', initial: false, active: 'yes', inactive: 'no' });
      if (!add) break;
      const item = await prompts({ type: 'text', name: 'name', message: 'Instrument name:', validate: (v) => (!!v || 'Required') });
      instruments.push(item.name);
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

  let credits = defaultCredits(base.sidebarPageConfig?.credits);
  await prompts({
    type: 'text',
    name: 'continue',
    message: 'Credits flow not implemented yet. Using minimal defaults for now. Press Enter to continue.',
    initial: '',
  });
  credits.artist = nameAns.name.split(',').map((v) => v.trim()).filter(Boolean);
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

  await prompts({
    type: 'text',
    name: 'continue',
    message: 'Download manifest flow not implemented yet. Generating an empty manifest skeleton. Press Enter to continue.',
    initial: '',
  });
  const manifest = buildEmptyManifestSkeleton(opts.formatKeys);
  normalizeManifest(manifest, opts.formatKeys, ALL_BUCKETS);
  manifestSchemaForFormats(opts.formatKeys?.audio || [], opts.formatKeys?.video || []).parse(manifest);

  return {
    slug: computedSlug,
    title: id.title,
    video,
    descriptionText,
    sidebar,
    manifest: normalizeManifest(manifest, opts.formatKeys, ALL_BUCKETS),
    authEnabled: true,
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
  const hasTopHelp = args.includes('--help') || args.includes('-h');
  const firstNonFlag = args.find((arg) => !arg.startsWith('-'));
  if (!firstNonFlag && args.length === 0) return { mode: 'dashboard', paletteOpen: false, command: null, rest: [] };
  if (!firstNonFlag && hasTopHelp) return { mode: 'dashboard', paletteOpen: true, command: null, rest: [] };
  if (['init', 'update', 'doctor'].includes(firstNonFlag)) {
    const idx = args.indexOf(firstNonFlag);
    return { mode: 'ink-command', paletteOpen: false, command: firstNonFlag, rest: args.slice(idx + 1) };
  }
  return { mode: 'legacy', paletteOpen: false, command: null, rest: args };
}

const topLevel = parseTopLevelMode(process.argv);
const packageJson = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
const { runDashboard } = await import('./ui/dashboard.mjs');

if (topLevel.mode === 'dashboard') {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.log('dex: interactive dashboard requires a TTY. Try: dex init');
    process.exit(0);
  }
  await runDashboard({ paletteOpen: topLevel.paletteOpen, version: packageJson.version || 'dev' });
  process.exit(0);
}

if (topLevel.mode === 'ink-command') {
  if (topLevel.command === 'doctor' && (!process.stdout.isTTY || !process.stdin.isTTY)) {
    const reports = await scanEntries({ entriesDir: './entries' });
    reports.forEach((r) => {
      const status = r.errors.length ? '❌' : r.warnings.length ? '⚠️' : '✅';
      console.log(`${status} ${r.slug}`);
      r.errors.forEach((e) => console.log(`  - ERROR: ${e}`));
      r.warnings.forEach((w) => console.log(`  - WARN: ${w}`));
    });
    process.exit(reports.some((r) => r.errors.length) ? 1 : 0);
  }
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    if (topLevel.command === 'init') {
      await initCommand(topLevel.rest[0], { quick: true, out: './entries' });
      process.exit(0);
    }
    console.log(`dex ${topLevel.command}: requires a TTY`);
    process.exit(1);
  }
  const mode = topLevel.command === 'init' ? 'init' : topLevel.command === 'update' ? 'update' : 'doctor';
  await runDashboard({ initialMode: mode, version: packageJson.version || 'dev' });
  process.exit(0);
}

if (topLevel.mode === 'legacy') {
  // Backward compatibility: treat bare slug as init argument in non-dashboard scripts.
  await initCommand(topLevel.rest[0], { quick: true, out: './entries' });
}
