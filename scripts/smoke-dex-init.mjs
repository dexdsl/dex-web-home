import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isBackspaceKey, shouldAppendWizardChar } from './lib/input-guard.mjs';
import { applyKeyToInputState } from './ui/init-wizard.mjs';

const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-smoke-'));
const tmpl = `<!doctype html><html><head><title>Template</title><script defer src="/assets/dex-auth0-config.js"></script></head><body>
<script id="dex-sidebar-config" type="application/json">{"downloads":{"formats":{"audio":[{"key":"wav"}],"video":[{"key":"1080p"}]}}}</script>
<!-- DEX:SIDEBAR_PAGE_CONFIG_START --><script>window.dexSidebarPageConfig = {};</script><!-- DEX:SIDEBAR_PAGE_CONFIG_END -->
<!-- DEX:VIDEO_START --><div class="sqs-block video-block"><div class="sqs-video-wrapper" data-url="" data-html=""></div></div><!-- DEX:VIDEO_END -->
<!-- DEX:DESC_START --><p>lorem ipsum</p><!-- DEX:DESC_END -->
<script id="dex-manifest" type="application/json">{}</script>
</body></html>`;
await fs.writeFile(path.join(temp, 'index.html'), tmpl, 'utf8');
await fs.writeFile(path.join(temp, 'seed.json'), JSON.stringify({
  title: 'Smoke Title',
  slug: 'smoke-title',
  descriptionText: 'desc',
  video: { dataUrl: 'https://player.vimeo.com/video/1' },
  manifest: { audio: { A: { wav: 'a1' } }, video: { A: { '1080p': 'v1' } } },
  sidebarPageConfig: { lookupNumber: 'LOOKUP-1', attributionSentence: 'attrib', buckets: ['A','B'], specialEventImage: '/assets/series/dex.png', credits: { artist: { name: 'Artist' }, instruments: [{name:'Synth', links: []}], year: 2026, season: 'S2', location: 'Somewhere', video: { director: {name:'',links:[]}, cinematography: {name:'',links:[]}, editing: {name:'',links:[]} }, audio: { recording: {name:'',links:[]}, mix: {name:'',links:[]}, master: {name:'',links:[]} } } },
}), 'utf8');

const run = (args) => spawnSync('node', [path.join(root, 'scripts/dex.mjs'), ...args], { cwd: temp, encoding: 'utf8' });
const dry = run(['init', '--quick', '--template', './index.html', '--out', './entries', '--dry-run', '--from', './seed.json']);
if (dry.status !== 0) throw new Error(`dry-run failed: ${dry.stderr}\n${dry.stdout}`);
const real = run(['init', '--quick', '--template', './index.html', '--out', './entries', '--from', './seed.json']);
if (real.status !== 0) throw new Error(`write run failed: ${real.stderr}\n${real.stdout}`);

const outHtml = await fs.readFile(path.join(temp, 'entries', 'smoke-title', 'index.html'), 'utf8');
for (const needle of ['data-url="https://player.vimeo.com/video/1"', '<p>desc</p>', 'LOOKUP-1', '/assets/series/dex.png', '/assets/dex-auth0-config.js', '/assets/dex-auth.js']) {
  if (!outHtml.includes(needle)) throw new Error(`missing in output html: ${needle}`);
}

const cfgMatch = outHtml.match(/<script id="dex-sidebar-config" type="application\/json">([\s\S]*?)<\/script>/);
if (!cfgMatch) throw new Error('missing #dex-sidebar-config script node in output html');
const cfg = JSON.parse(cfgMatch[1]);
const audioKeys = (cfg.downloads?.formats?.audio || []).map((item) => item.key);
const videoKeys = (cfg.downloads?.formats?.video || []).map((item) => item.key);

const manifestNodeMatch = outHtml.match(/<script id="dex-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if (!manifestNodeMatch) throw new Error('missing #dex-manifest script node in output html');
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

const outManifest = JSON.parse(await fs.readFile(path.join(temp, 'entries', 'smoke-title', 'manifest.json'), 'utf8'));
for (const bucket of ['A', 'B', 'C', 'D', 'E', 'X']) {
  if (!(bucket in outManifest.audio)) throw new Error(`missing audio bucket: ${bucket}`);
  if (!(bucket in outManifest.video)) throw new Error(`missing video bucket: ${bucket}`);
  for (const key of audioKeys) {
    if (outManifest.audio[bucket]?.[key] !== '') throw new Error(`expected empty manifest audio value for ${bucket}.${key}`);
  }
  for (const key of videoKeys) {
    if (outManifest.video[bucket]?.[key] !== '') throw new Error(`expected empty manifest video value for ${bucket}.${key}`);
  }
}

const sidebarRuntime = await fs.readFile(path.join(root, 'docs/assets/dex-sidebar.js'), 'utf8');
if (!sidebarRuntime.includes("const ALL_BUCKETS = ['A', 'B', 'C', 'D', 'E', 'X'];")) throw new Error('sidebar runtime missing ALL_BUCKETS literal');



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

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 0 }, '', { backspace: true });
  if (next.value !== 'abc' || next.cursor !== 0) throw new Error('backspace at 0 should do nothing');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 1 }, '', { delete: true });
  if (next.value !== 'ac' || next.cursor !== 1) throw new Error('delete should remove char at cursor');
}

{
  const next = applyKeyToInputState({ value: 'ac', cursor: 1 }, 'b', { ctrl: false, meta: false });
  if (next.value !== 'abc' || next.cursor !== 2) throw new Error('insert should work at cursor');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 1 }, '\x1b[27;5;13~', {});
  if (next.value !== 'abc' || next.cursor !== 1) throw new Error('escape sequence should be ignored');
}


{
  const next = applyKeyToInputState({ value: 'abc', cursor: 2 }, '', { leftArrow: true });
  if (next.value !== 'abc' || next.cursor !== 1) throw new Error('left arrow should move cursor left');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 1 }, '', { rightArrow: true });
  if (next.value !== 'abc' || next.cursor !== 2) throw new Error('right arrow should move cursor right');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 2 }, '', { home: true });
  if (next.value !== 'abc' || next.cursor !== 0) throw new Error('home should move cursor to start');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 1 }, '', { end: true });
  if (next.value !== 'abc' || next.cursor !== 3) throw new Error('end should move cursor to end');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 2 }, '[D', { leftArrow: false });
  if (next.value !== 'abc' || next.cursor !== 1) throw new Error('left escape sequence should move cursor left');
}


{
  const next = applyKeyToInputState({ value: 'abc', cursor: 2 }, 'OD', { leftArrow: false });
  if (next.value !== 'abc' || next.cursor !== 1) throw new Error('left SS3 sequence should move cursor left');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 1 }, '[3~', {});
  if (next.value !== 'ac' || next.cursor !== 1) throw new Error('delete escape sequence should remove char at cursor');
}


{
  const next = applyKeyToInputState({ value: 'abc', cursor: 1 }, '\x1b[1~', {});
  if (!next || typeof next !== 'object') throw new Error('reducer should always return an object');
  if (next.value !== 'abc' || next.cursor !== 0) throw new Error('home [1~ should move cursor to start');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 0 }, '\x1b[4~', {});
  if (!next || typeof next !== 'object') throw new Error('reducer should always return an object');
  if (next.value !== 'abc' || next.cursor !== 3) throw new Error('end [4~ should move cursor to end');
}

{
  const next = applyKeyToInputState({ value: 'abc', cursor: 1 }, '\x1b[3~', {});
  if (!next || typeof next !== 'object') throw new Error('reducer should always return an object');
  if (next.value !== 'ac' || next.cursor !== 1) throw new Error('delete [3~ should remove char at cursor');
}

console.log('smoke-dex-init ok');
