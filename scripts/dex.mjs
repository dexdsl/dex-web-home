#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
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
import { deriveCanonicalEntry, descriptionTextFromSeed } from './lib/entry-html.mjs';
import { parseViewerArgs, startViewer } from './lib/viewer-server.mjs';
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
  return '/assets/series/dex.png';
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
    const videoUrl = String(base.video?.dataUrlOriginal || base.video?.dataUrl || '').trim();
    if (!videoUrl) throw new Error('Video URL is required for non-interactive init. Pass --from with video.dataUrl.');
    const seedCredits = base.creditsData || base.sidebarPageConfig?.credits;
    const sidebar = {
      lookupNumber: lookup,
      buckets: base.sidebarPageConfig?.buckets || ['A'],
      specialEventImage: base.sidebarPageConfig?.specialEventImage || mapSeriesToImage(base.series || 'dex'),
      attributionSentence: base.sidebarPageConfig?.attributionSentence || 'Attribution',
      credits: defaultCredits(seedCredits),
      fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
      metadata: { sampleLength: '', tags: [] },
    };
    const canonical = deriveCanonicalEntry({
      canonical: base.canonical,
      sidebarConfig: sidebar,
      creditsData: base.creditsData,
    });
    const manifest = normalizeManifest(buildEmptyManifestSkeleton(opts.formatKeys), opts.formatKeys, ALL_BUCKETS);
    manifestSchemaForFormats(opts.formatKeys?.audio || [], opts.formatKeys?.video || []).parse(manifest);
    return { slug: computedSlug, title, canonical, video: { mode: 'url', dataUrl: videoUrl, dataUrlOriginal: videoUrl, dataHtml: '' }, descriptionText: descriptionTextFromSeed(base), sidebar, manifest, authEnabled: true, outDir };
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
    ? { mode: 'embed', dataUrl: '', dataUrlOriginal: '', dataHtml: (await prompts({ type: 'text', name: 'dataHtml', message: 'Paste raw embed HTML:' })).dataHtml || '' }
    : { mode: 'url', dataUrl: '', dataUrlOriginal: '', dataHtml: '' };
  if (video.mode === 'url') {
    const ans = await prompts({ type: 'text', name: 'url', message: 'Video URL:', initial: base.video?.dataUrlOriginal || base.video?.dataUrl || '', validate: (v) => (!!v || 'Required') });
    video.dataUrl = ans.url;
    video.dataUrlOriginal = ans.url;
    video.dataHtml = '';
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
  const canonical = deriveCanonicalEntry({
    canonical: base.canonical,
    sidebarConfig: sidebar,
    creditsData: credits,
  });

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
    canonical,
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
  if (!opts.dryRun) {
    const relativeHtmlPath = path.relative(process.cwd(), report.htmlPath) || report.htmlPath;
    console.log(`Recent entry: ${relativeHtmlPath}`);
    console.log('To preview in localhost mode: dex view');
  }

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
  if (['init', 'update', 'doctor', 'status'].includes(firstNonFlag)) {
    const idx = args.indexOf(firstNonFlag);
    return { mode: 'ink-command', paletteOpen: false, command: firstNonFlag, rest: args.slice(idx + 1) };
  }
  if (['view', 'viewer'].includes(firstNonFlag)) {
    const idx = args.indexOf(firstNonFlag);
    return { mode: 'direct-command', paletteOpen: false, command: 'view', rest: args.slice(idx + 1) };
  }
  if (firstNonFlag === 'polls') {
    const idx = args.indexOf(firstNonFlag);
    return { mode: 'direct-command', paletteOpen: false, command: 'polls', rest: args.slice(idx + 1) };
  }
  if (firstNonFlag === 'newsletter') {
    const idx = args.indexOf(firstNonFlag);
    return { mode: 'direct-command', paletteOpen: false, command: 'newsletter', rest: args.slice(idx + 1) };
  }
  return { mode: 'legacy', paletteOpen: false, command: null, rest: args };
}

function parseInitArgs(rest = []) {
  const opts = { quick: true, out: './entries' };
  let slugArg;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const next = rest[i + 1];
    if (arg === '--quick') { opts.quick = true; continue; }
    if (arg === '--dry-run') { opts.dryRun = true; continue; }
    if (arg === '--flat') { opts.flat = true; continue; }
    if (arg === '--open') { opts.open = true; continue; }
    if (arg === '--template' && next) { opts.template = next; i += 1; continue; }
    if (arg.startsWith('--template=')) { opts.template = arg.slice('--template='.length); continue; }
    if (arg === '--out' && next) { opts.out = next; i += 1; continue; }
    if (arg.startsWith('--out=')) { opts.out = arg.slice('--out='.length); continue; }
    if (arg === '--from' && next) { opts.from = next; i += 1; continue; }
    if (arg.startsWith('--from=')) { opts.from = arg.slice('--from='.length); continue; }
    if (!arg.startsWith('-') && !slugArg) slugArg = arg;
  }
  return { slugArg, opts };
}

function parsePollsCommandArgs(rest = []) {
  const [subcommand = '', ...rawArgs] = rest;
  const flags = new Map();
  const values = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg.startsWith('--')) {
      const [name, inlineValue] = arg.split('=', 2);
      if (inlineValue !== undefined) {
        flags.set(name, inlineValue);
        continue;
      }
      const next = rawArgs[index + 1];
      if (next && !next.startsWith('--')) {
        flags.set(name, next);
        index += 1;
        continue;
      }
      flags.set(name, 'true');
      continue;
    }
    values.push(arg);
  }
  return { subcommand, flags, values };
}

async function runPollsCommand(rest = []) {
  const {
    readPollsFile,
    writePollsFile,
    createPollDraft,
    upsertPoll,
    setPollStatus,
  } = await import('./lib/polls-store.mjs');
  const { validatePollsFile } = await import('./lib/polls-schema.mjs');
  const { publishPolls } = await import('./lib/polls-publish.mjs');
  const { runPollsScreen } = await import('./ui/polls-screen.mjs');

  const parsed = parsePollsCommandArgs(rest);
  const { subcommand, flags, values } = parsed;

  if (!subcommand) {
    if (process.stdout.isTTY && process.stdin.isTTY) {
      const action = await runPollsScreen();
      if (action === 'validate') {
        const { data } = await readPollsFile();
        validatePollsFile(data);
        console.log('polls:validate passed.');
        return;
      }
      if (action === 'publish-test' || action === 'publish-prod') {
        const env = action === 'publish-prod' ? 'prod' : 'test';
        const result = await publishPolls({ env });
        const eventSummary = result.events
          ? ` events sent=${result.events.sent || 0} failed=${result.events.failed || 0} skipped=${result.events.skipped || 0}`
          : '';
        console.log(`polls:publish (${result.env}) synced ${result.count} polls -> ${result.apiBase}${eventSummary}`);
        return;
      }
    }
    console.log('Usage: dex polls <validate|create|edit|close|open|publish> [args]');
    return;
  }

  if (subcommand === 'validate') {
    const { data } = await readPollsFile();
    validatePollsFile(data);
    console.log('polls:validate passed.');
    return;
  }

  if (subcommand === 'publish') {
    const env = flags.get('--env') || flags.get('--target') || 'test';
    const filePath = flags.get('--file');
    const result = await publishPolls({ env, filePath });
    const eventSummary = result.events
      ? ` events sent=${result.events.sent || 0} failed=${result.events.failed || 0} skipped=${result.events.skipped || 0}`
      : '';
    console.log(`polls:publish (${result.env}) synced ${result.count} polls -> ${result.apiBase}${eventSummary}`);
    return;
  }

  const { data } = await readPollsFile(flags.get('--file'));

  if (subcommand === 'create') {
    const draft = createPollDraft(data, {
      question: flags.get('--question') || 'New poll question',
      visibility: flags.get('--visibility') || 'public',
      status: flags.get('--status') || 'draft',
    });
    const next = upsertPoll(data, draft);
    await writePollsFile(next, flags.get('--file'));
    console.log(`polls:create wrote ${draft.id}`);
    return;
  }

  if (subcommand === 'edit') {
    const pollId = values[0] || flags.get('--id');
    if (!pollId) {
      throw new Error('polls:edit requires a poll id');
    }
    const existing = data.polls.find((poll) => poll.id === pollId);
    if (!existing) {
      throw new Error(`polls:edit poll not found: ${pollId}`);
    }
    const updated = {
      ...existing,
      question: flags.get('--question') || existing.question,
      visibility: flags.get('--visibility') || existing.visibility,
      status: flags.get('--status') || existing.status,
      closeAt: flags.get('--closeAt') || existing.closeAt,
      manualClose: flags.has('--manualClose')
        ? flags.get('--manualClose') === 'true'
        : existing.manualClose,
    };
    const next = upsertPoll(data, updated);
    await writePollsFile(next, flags.get('--file'));
    console.log(`polls:edit wrote ${pollId}`);
    return;
  }

  if (subcommand === 'close' || subcommand === 'open') {
    const pollId = values[0] || flags.get('--id');
    if (!pollId) {
      throw new Error(`polls:${subcommand} requires a poll id`);
    }
    const status = subcommand === 'close' ? 'closed' : 'open';
    const next = setPollStatus(data, pollId, status);
    await writePollsFile(next, flags.get('--file'));
    console.log(`polls:${subcommand} wrote ${pollId}`);
    return;
  }

  throw new Error(`Unknown polls command: ${subcommand}`);
}

function parseCsvRow(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

async function parseCsvFile(filePath) {
  const source = await fs.readFile(path.resolve(filePath), 'utf8');
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const headers = parseCsvRow(lines[0]).map((value) => value.toLowerCase());
  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvRow(lines[index]);
    const row = {};
    for (let headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
      const key = headers[headerIndex];
      if (!key) continue;
      row[key] = values[headerIndex] || '';
    }
    rows.push(row);
  }
  return rows;
}

function parseJsonFlag(raw) {
  const source = String(raw || '').trim();
  if (!source) return {};
  return JSON.parse(source);
}

async function resolveNewsletterVars(flags) {
  const varsInline = flags.get('--vars');
  const varsFile = flags.get('--vars-file');
  if (varsFile) {
    const source = await fs.readFile(path.resolve(varsFile), 'utf8');
    return parseJsonFlag(source);
  }
  if (varsInline) return parseJsonFlag(varsInline);
  return {};
}

function openLocalFile(targetPath) {
  const absolute = path.resolve(targetPath);
  const command = process.platform === 'darwin'
    ? { cmd: 'open', args: [absolute] }
    : process.platform === 'win32'
      ? { cmd: 'cmd', args: ['/c', 'start', '', absolute] }
      : { cmd: 'xdg-open', args: [absolute] };
  spawn(command.cmd, command.args, { stdio: 'ignore', detached: true }).unref();
}

function printNewsletterUsage() {
  console.log('Usage: dex newsletter <templates|preview|draft|test-send|schedule|send|stats|segment-estimate|import> [args]');
  console.log('Examples:');
  console.log('  dex newsletter draft create --template release-notes --vars \'{"headline":"Dex Notes #042"}\'');
  console.log('  dex newsletter preview --template newsletter --vars-file ./vars.json');
  console.log('  dex newsletter test-send <campaignId> --to you@example.com');
}

async function runNewsletterCommand(rest = []) {
  const {
    createNewsletterCampaign,
    estimateNewsletterSegment,
    getNewsletterCampaignStats,
    importNewsletterSubscribers,
    listNewsletterCampaigns,
    patchNewsletterCampaign,
    scheduleNewsletterCampaign,
    sendNowNewsletterCampaign,
    testSendNewsletterCampaign,
  } = await import('./lib/newsletter-api.mjs');
  const {
    describeNewsletterTemplates,
    renderNewsletterTemplate,
  } = await import('./lib/newsletter-render.mjs');

  if (!rest.length) {
    if (process.stdout.isTTY && process.stdin.isTTY) {
      const { runDashboard } = await import('./ui/dashboard.mjs');
      await runDashboard({ initialMode: 'newsletter', version: JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8')).version || 'dev' });
      return;
    }
    printNewsletterUsage();
    return;
  }

  const parsed = parsePollsCommandArgs(rest);
  const { subcommand, flags, values } = parsed;

  if (subcommand === 'templates') {
    console.log(describeNewsletterTemplates());
    return;
  }

  if (subcommand === 'preview') {
    const templateKey = flags.get('--template') || 'newsletter';
    const variables = await resolveNewsletterVars(flags);
    const rendered = renderNewsletterTemplate({ templateKey, variables });
    const outPath = path.resolve(flags.get('--out') || path.join(PROJECT_ROOT, 'tmp', `newsletter-preview-${Date.now()}.html`));
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, rendered.html, 'utf8');
    if (String(flags.get('--open') || 'true').toLowerCase() !== 'false') {
      openLocalFile(outPath);
    }
    console.log(`newsletter:preview wrote ${outPath}`);
    return;
  }

  if (subcommand === 'draft') {
    const action = (values[0] || 'list').toLowerCase();

    if (action === 'list') {
      const payload = await listNewsletterCampaigns({ limit: Number(flags.get('--limit') || 50) });
      const campaigns = Array.isArray(payload?.campaigns) ? payload.campaigns : [];
      campaigns.forEach((campaign) => {
        console.log(`${campaign.id}  [${campaign.status}]  ${campaign.audienceSegment}  ${campaign.subject}`);
      });
      if (!campaigns.length) console.log('No newsletter campaigns found.');
      return;
    }

    if (action === 'create') {
      const templateKey = flags.get('--template') || 'newsletter';
      const variables = await resolveNewsletterVars(flags);
      const rendered = renderNewsletterTemplate({ templateKey, variables });
      const name = flags.get('--name') || `Dex Newsletter ${new Date().toISOString().slice(0, 10)}`;
      const audienceSegment = flags.get('--segment') || 'all_subscribers';
      const payload = await createNewsletterCampaign({
        name,
        templateKey: rendered.templateKey,
        subject: flags.get('--subject') || rendered.subject,
        preheader: flags.get('--preheader') || rendered.preheader,
        audienceSegment,
        variables: rendered.variables,
        html: rendered.html,
        text: rendered.text,
      });
      const campaign = payload?.campaign;
      console.log(`newsletter:draft:create wrote ${campaign?.id || 'unknown'}`);
      return;
    }

    if (action === 'edit') {
      const campaignId = values[1] || flags.get('--id');
      if (!campaignId) throw new Error('newsletter:draft:edit requires campaign id');

      const patch = {};
      if (flags.has('--name')) patch.name = flags.get('--name');
      if (flags.has('--subject')) patch.subject = flags.get('--subject');
      if (flags.has('--preheader')) patch.preheader = flags.get('--preheader');
      if (flags.has('--segment')) patch.audienceSegment = flags.get('--segment');

      if (flags.has('--template') || flags.has('--vars') || flags.has('--vars-file')) {
        const rendered = renderNewsletterTemplate({
          templateKey: flags.get('--template') || 'newsletter',
          variables: await resolveNewsletterVars(flags),
        });
        patch.templateKey = rendered.templateKey;
        patch.variables = rendered.variables;
        patch.html = rendered.html;
        patch.text = rendered.text;
        if (!patch.subject) patch.subject = rendered.subject;
        if (!patch.preheader) patch.preheader = rendered.preheader;
      }

      const payload = await patchNewsletterCampaign(campaignId, patch);
      console.log(`newsletter:draft:edit wrote ${payload?.campaign?.id || campaignId}`);
      return;
    }

    throw new Error(`Unknown newsletter draft action: ${action}`);
  }

  if (subcommand === 'test-send') {
    const campaignId = values[0] || flags.get('--id');
    if (!campaignId) throw new Error('newsletter:test-send requires campaign id');
    const to = flags.get('--to') || process.env.DEX_NEWSLETTER_TEST_EMAIL;
    if (!to) throw new Error('newsletter:test-send requires --to or DEX_NEWSLETTER_TEST_EMAIL');
    const payload = await testSendNewsletterCampaign(campaignId, to);
    console.log(`newsletter:test-send queued ${campaignId} -> ${to} (${payload?.id || 'ok'})`);
    return;
  }

  if (subcommand === 'schedule') {
    const campaignId = values[0] || flags.get('--id');
    if (!campaignId) throw new Error('newsletter:schedule requires campaign id');
    const at = flags.get('--at') || new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await scheduleNewsletterCampaign(campaignId, at);
    console.log(`newsletter:schedule wrote ${campaignId} at ${at}`);
    return;
  }

  if (subcommand === 'send') {
    const campaignId = values[0] || flags.get('--id');
    if (!campaignId) throw new Error('newsletter:send requires campaign id');
    await sendNowNewsletterCampaign(campaignId);
    console.log(`newsletter:send queued ${campaignId}`);
    return;
  }

  if (subcommand === 'stats') {
    const campaignId = values[0] || flags.get('--id');
    if (!campaignId) throw new Error('newsletter:stats requires campaign id');
    const payload = await getNewsletterCampaignStats(campaignId);
    const stats = payload?.stats || {};
    console.log(`campaign=${campaignId} queued=${stats.queued || 0} sent=${stats.sent || 0} failed=${stats.failed || 0} delivered=${stats.delivered || 0} bounced=${stats.bounced || 0} complaints=${stats.complaints || 0} opens=${stats.opens || 0} clicks=${stats.clicks || 0}`);
    return;
  }

  if (subcommand === 'segment-estimate') {
    const segment = values[0] || flags.get('--segment') || 'all_subscribers';
    const payload = await estimateNewsletterSegment(segment);
    const estimate = payload?.estimate || {};
    console.log(`segment=${estimate.segment || segment} count=${estimate.count || 0}`);
    return;
  }

  if (subcommand === 'import') {
    const csvPath = flags.get('--csv');
    if (!csvPath) throw new Error('newsletter:import requires --csv <path>');
    const source = flags.get('--source') || 'mailchimp';
    const consentMode = flags.get('--consent-mode') || 'verified';
    const rows = await parseCsvFile(csvPath);
    const mapped = rows.map((row) => {
      const tags = [];
      if (String(row.contributor || '').trim().toLowerCase() === 'true') tags.push('contributor');
      if (String(row.status_watcher || '').trim().toLowerCase() === 'true') tags.push('status-watcher');
      if (String(row.tags || '').trim()) {
        String(row.tags).split(/[|,]/).map((value) => value.trim()).filter(Boolean).forEach((tag) => tags.push(tag));
      }
      return {
        email: row.email || row['email address'] || '',
        auth0Sub: row.auth0_sub || row.auth0sub || '',
        timezone: row.timezone || 'UTC',
        tags,
        consentVerified: String(row.consent_verified || '').trim().toLowerCase() === 'true' || consentMode === 'verified',
        consentEvidence: {
          sourceRow: row,
        },
      };
    });
    const payload = await importNewsletterSubscribers({
      source,
      consentMode,
      rows: mapped,
    });
    console.log(`newsletter:import imported=${payload?.imported || 0} skipped=${payload?.skipped || 0}`);
    return;
  }

  printNewsletterUsage();
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
      const parsed = parseInitArgs(topLevel.rest);
      await initCommand(parsed.slugArg, parsed.opts);
      process.exit(0);
    }
    console.log(`dex ${topLevel.command}: requires a TTY`);
    process.exit(1);
  }
  const mode = topLevel.command === 'init'
    ? 'init'
    : topLevel.command === 'update'
      ? 'update'
      : topLevel.command === 'status'
        ? 'status'
        : 'doctor';
  await runDashboard({ initialMode: mode, version: packageJson.version || 'dev' });
  process.exit(0);
}

if (topLevel.mode === 'direct-command' && topLevel.command === 'view') {
  const viewOpts = parseViewerArgs(topLevel.rest);
  const { server, url, port } = await startViewer({
    cwd: process.cwd(),
    open: viewOpts.open,
    port: viewOpts.port,
    root: viewOpts.root,
  });
  console.log(`Dex viewer running at ${url}`);
  if (viewOpts.root) {
    console.log(`Scoped root: ${path.resolve(viewOpts.root)}`);
  } else {
    console.log('Scoped roots: recents + known output directories');
  }
  if (!viewOpts.open) {
    console.log('Tip: pass --open to launch your browser automatically.');
  }
  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);
  process.stdin.resume();
}

if (topLevel.mode === 'direct-command' && topLevel.command === 'polls') {
  await runPollsCommand(topLevel.rest);
  process.exit(0);
}

if (topLevel.mode === 'direct-command' && topLevel.command === 'newsletter') {
  await runNewsletterCommand(topLevel.rest);
  process.exit(0);
}

if (topLevel.mode === 'legacy') {
  // Backward compatibility: treat bare slug as init argument in non-dashboard scripts.
  const parsed = parseInitArgs(topLevel.rest);
  await initCommand(parsed.slugArg, parsed.opts);
}
