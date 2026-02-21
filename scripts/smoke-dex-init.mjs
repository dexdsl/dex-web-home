import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isBackspaceKey, shouldAppendWizardChar } from './lib/input-guard.mjs';
import { applyKeyToInputState } from './ui/init-wizard.mjs';
import { DEFAULT_ASSET_ORIGIN } from './lib/asset-origin.mjs';
import { assertAnchorOnlyChanges as assertTemplateDrift, injectEntryHtml } from './lib/entry-html.mjs';

const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-smoke-'));
const tmpl = `<!doctype html><html><head><title>Template</title><link rel="stylesheet" href="/assets/css/dex.css"><script defer src="/assets/dex-auth0-config.js"></script></head><body>
<script id="dex-sidebar-config" type="application/json">{"downloads":{"formats":{"audio":[{"key":"wav"}],"video":[{"key":"1080p"}]}}}</script>
<!-- DEX:SIDEBAR_PAGE_CONFIG_START --><script id="dex-sidebar-page-config" type="application/json">{}</script><!-- DEX:SIDEBAR_PAGE_CONFIG_END -->
<!-- DEX:VIDEO_START --><div class="dex-video" data-video-url=""><div class="dex-video-aspect"></div></div><!-- DEX:VIDEO_END -->
<!-- DEX:DESC_START --><p>lorem ipsum</p><!-- DEX:DESC_END -->
<script id="dex-manifest" type="application/json">{}</script>
</body></html>`;
await fs.writeFile(path.join(temp, 'index.html'), tmpl, 'utf8');
await fs.writeFile(path.join(temp, 'seed.json'), JSON.stringify({
  title: 'Smoke Title',
  slug: 'smoke-title',
  descriptionText: 'desc',
  video: { dataUrl: 'https://youtu.be/CSFGiU1gg4g?si=x' },
  creditsData: { artist:['Artist'], artistAlt:null, instruments:['Synth'], video:{director:['Dir'],cinematography:['Cin'],editing:['Edit']}, audio:{recording:['Rec'],mix:['Mix'],master:['Master']}, year:2026, season:'S2', location:'Somewhere' },
  manifest: { audio: { A: { wav: 'a1' } }, video: { A: { '1080p': 'v1' } } },
  sidebarPageConfig: { lookupNumber: 'LOOKUP-1', attributionSentence: 'attrib', buckets: ['A','B'], specialEventImage: '/assets/series/dex.png', credits: { artist: ['Artist'], instruments: ['Synth'], year: 2026, season: 'S2', location: 'Somewhere', video: { director: ['Dir'], cinematography: ['Cin'], editing: ['Edit'] }, audio: { recording: ['Rec'], mix: ['Mix'], master: ['Master'] } } },
}), 'utf8');


const ytInjected = injectEntryHtml(tmpl, {
  descriptionText: 'desc',
  manifest: { audio: { A: { wav: '' }, B: { wav: '' }, C: { wav: '' }, D: { wav: '' }, E: { wav: '' }, X: { wav: '' } }, video: { A: { '1080p': '' }, B: { '1080p': '' }, C: { '1080p': '' }, D: { '1080p': '' }, E: { '1080p': '' }, X: { '1080p': '' } } },
  sidebarConfig: { lookupNumber: 'LOOKUP-1', attributionSentence: 'attrib', buckets: ['A'], specialEventImage: null, credits: { artist: ['Artist'], instruments: ['Synth'], year: 2026, season: 'S2', location: 'Somewhere', video: { director: ['Dir'], cinematography: ['Cin'], editing: ['Edit'] }, audio: { recording: ['Rec'], mix: ['Mix'], master: ['Master'] } }, fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } }, metadata: { sampleLength: '', tags: [] } },
  video: { mode: 'url', dataUrl: 'https://youtu.be/CSFGiU1gg4g?si=x', dataHtml: '' },
  title: 'Yt Test',
  authEnabled: true,
});
if (!ytInjected.html.includes('src="https://www.youtube-nocookie.com/embed/CSFGiU1gg4g"')) throw new Error('youtube normalization failed');
if (!ytInjected.html.includes('data-person') || !ytInjected.html.includes('person-pin')) throw new Error('compiled credits pins missing');
const run = (args) => spawnSync('node', [path.join(root, 'scripts/dex.mjs'), ...args], { cwd: temp, encoding: 'utf8' });
const dry = run(['init', '--quick', '--template', './index.html', '--out', './entries', '--from', './seed.json', '--dry-run']);
if (dry.status !== 0) throw new Error(`dry-run failed: ${dry.stderr}\n${dry.stdout}`);
const real = run(['init', '--quick', '--template', './index.html', '--out', './entries', '--from', './seed.json']);
if (real.status !== 0) throw new Error(`write run failed: ${real.stderr}\n${real.stdout}`);

const generatedDirs = (await fs.readdir(path.join(temp, 'entries'), { withFileTypes: true })).filter((d) => d.isDirectory());
if (!generatedDirs.length) throw new Error('no generated entry dir');
const generatedSlug = generatedDirs[0].name;
const outHtml = await fs.readFile(path.join(temp, 'entries', generatedSlug, 'index.html'), 'utf8');
assertTemplateDrift(tmpl, outHtml);
for (const needle of [
  'src="https://www.youtube-nocookie.com/embed/CSFGiU1gg4g"',
  'data-video-url="https://youtu.be/CSFGiU1gg4g?si=x"',
  '<p>desc</p>',
  'LOOKUP-1',
  `${DEFAULT_ASSET_ORIGIN}/assets/css/dex.css`,
  `${DEFAULT_ASSET_ORIGIN}/assets/dex-auth0-config.js`,
  `${DEFAULT_ASSET_ORIGIN}/assets/dex-auth.js`,
  '<script id="dex-sidebar-page-config" type="application/json">',
  'window.dexSidebarPageConfig = JSON.parse(',
  '<script id="dex-manifest" type="application/json">',
]) {
  if (!outHtml.includes(needle)) throw new Error(`missing in output html: ${needle}`);
}

const regionMatch = outHtml.match(/<!-- DEX:VIDEO_START -->([\s\S]*?)<!-- DEX:VIDEO_END -->/);
if (!regionMatch) throw new Error('missing DEX:VIDEO region');
if (!regionMatch[1].includes('<iframe')) throw new Error('DEX:VIDEO region missing iframe');
if (!regionMatch[1].includes('https://www.youtube-nocookie.com/embed/CSFGiU1gg4g')) {
  throw new Error('DEX:VIDEO region missing normalized YouTube embed URL');
}

const cfgMatch = outHtml.match(/<script id="dex-sidebar-config" type="application\/json">([\s\S]*?)<\/script>/);
if (!cfgMatch) throw new Error('missing #dex-sidebar-config script node in output html');
const cfg = JSON.parse(cfgMatch[1]);
const audioKeys = (cfg.downloads?.formats?.audio || []).map((item) => item.key);
const videoKeys = (cfg.downloads?.formats?.video || []).map((item) => item.key);

const manifestNodeMatch = outHtml.match(/<script id="dex-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if (!manifestNodeMatch || !manifestNodeMatch[1].trim()) throw new Error('missing #dex-manifest script node in output html');
const htmlManifest = JSON.parse(manifestNodeMatch[1]);
for (const bucket of ['A', 'B', 'C', 'D', 'E', 'X']) {
  if (!(bucket in htmlManifest.audio)) throw new Error(`missing html audio bucket: ${bucket}`);
  if (!(bucket in htmlManifest.video)) throw new Error(`missing html video bucket: ${bucket}`);
  for (const key of audioKeys) {
    if (htmlManifest.audio?.[bucket]?.[key] !== '') throw new Error(`expected empty audio manifest value for ${bucket}.${key}`);
  }
  for (const key of videoKeys) {
    if (htmlManifest.video?.[bucket]?.[key] !== '') throw new Error(`expected empty video manifest value for ${bucket}.${key}`);
  }
}

const outManifest = JSON.parse(await fs.readFile(path.join(temp, 'entries', generatedSlug, 'manifest.json'), 'utf8'));
for (const bucket of ['A', 'B', 'C', 'D', 'E', 'X']) {
  if (!(bucket in outManifest.audio)) throw new Error(`missing audio bucket: ${bucket}`);
  if (!(bucket in outManifest.video)) throw new Error(`missing video bucket: ${bucket}`);
}

if (shouldAppendWizardChar('a', { ctrl: false, meta: false }) !== true) throw new Error('input guard should accept printable char');
if (shouldAppendWizardChar('\x1b', { ctrl: false, meta: false }) !== false) throw new Error('input guard should reject ESC char');
if (shouldAppendWizardChar('\x1b[27;5;13~', { ctrl: false, meta: false }) !== false) throw new Error('input guard should reject escape sequences');

if (isBackspaceKey('', { backspace: true }) !== true) throw new Error('backspace helper should accept key.backspace');
if (isBackspaceKey('\x7f', {}) !== true) throw new Error('backspace helper should accept DEL input');
if (isBackspaceKey('a', {}) !== false) throw new Error('backspace helper should reject non-backspace input');
if (isBackspaceKey('\x08', {}) !== true) throw new Error('backspace helper should accept BS input');

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 3 }, '', { backspace: true });
  if (next.value !== 'ab' || next.cursor !== 2) throw new Error('backspace should delete char before cursor');
}

const portableTemp = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-smoke-portable-'));
const runPortable = (args) => spawnSync('node', [path.join(root, 'scripts/dex.mjs'), ...args], { cwd: portableTemp, encoding: 'utf8' });
const portable = runPortable(['init', '--quick', '--template', path.join(root, 'entry-template', 'index.html'), '--out', './entries', '--from', path.join(temp, 'seed.json')]);
if (portable.status !== 0) throw new Error(`portable write run failed: ${portable.stderr}\n${portable.stdout}`);
const portableDirs = (await fs.readdir(path.join(portableTemp, 'entries'), { withFileTypes: true })).filter((d) => d.isDirectory());
if (!portableDirs.length) throw new Error('no generated portable entry dir');
const portableHtml = await fs.readFile(path.join(portableTemp, 'entries', portableDirs[0].name, 'index.html'), 'utf8');
for (const needle of [
  `${DEFAULT_ASSET_ORIGIN}/assets/css/dex.css`,
  `${DEFAULT_ASSET_ORIGIN}/assets/dex-auth0-config.js`,
  `${DEFAULT_ASSET_ORIGIN}/assets/dex-auth.js`,
  `${DEFAULT_ASSET_ORIGIN}/assets/dex-sidebar.js`,
]) {
  if (!portableHtml.includes(needle)) throw new Error(`portable output missing runtime URL: ${needle}`);
}
const portableVerify = spawnSync('node', [path.join(root, 'scripts/verify-portable-entry-html.mjs')], { cwd: portableTemp, encoding: 'utf8' });
if (portableVerify.status !== 0) {
  throw new Error(`portable verifier failed: ${portableVerify.stderr}\n${portableVerify.stdout}`);
}

console.log('smoke-dex-init ok');
