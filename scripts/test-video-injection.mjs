import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { formatBreadcrumbCurrentLabel, injectEntryHtml, resolveBreadcrumbBackStrategy } from './lib/entry-html.mjs';

const root = process.cwd();
const templatePath = path.join(root, 'entry-template', 'index.html');
const templateHtml = await fs.readFile(templatePath, 'utf8');

const videoUrl = 'https://www.youtube.com/watch?v=CSFGiU1gg4g';
const schemelessVideoUrl = 'www.youtube.com/watch?v=CSFGiU1gg4g';

const injected = injectEntryHtml(templateHtml, {
  descriptionText: 'Video injection test',
  descriptionHtml: '',
  manifest: {
    audio: {
      A: { wav: '' },
      B: { wav: '' },
      C: { wav: '' },
      D: { wav: '' },
      E: { wav: '' },
      X: { wav: '' },
    },
    video: {
      A: { '1080p': '' },
      B: { '1080p': '' },
      C: { '1080p': '' },
      D: { '1080p': '' },
      E: { '1080p': '' },
      X: { '1080p': '' },
    },
  },
  sidebarConfig: {
    lookupNumber: 'LOOKUP-TEST',
    attributionSentence: 'Attribution',
    buckets: ['A'],
    specialEventImage: '/assets/series/dex.png',
    credits: {
      artist: ['Artist'],
      artistAlt: null,
      instruments: ['Instrument'],
      video: { director: ['Director'], cinematography: ['Cinematography'], editing: ['Editing'] },
      audio: { recording: ['Recording'], mix: ['Mix'], master: ['Master'] },
      year: 2026,
      season: 'S1',
      location: 'Somewhere',
    },
    fileSpecs: {
      bitDepth: 24,
      sampleRate: 48000,
      channels: 'stereo',
      staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' },
    },
    metadata: { sampleLength: '', tags: [] },
  },
  video: { mode: 'url', dataUrl: videoUrl, dataHtml: '' },
  title: 'Video Test',
  authEnabled: false,
}).html;

const videoRegionMatch = injected.match(/<!-- DEX:VIDEO_START -->([\s\S]*?)<!-- DEX:VIDEO_END -->/);
assert.ok(videoRegionMatch, 'DEX:VIDEO region missing');
const videoRegion = videoRegionMatch[1];

assert.match(videoRegion, /class="dex-video-shell"/);
assert.match(videoRegion, /class="dex-breadcrumb-overlay"/);
assert.match(videoRegion, /class="dex-breadcrumb"/);
assert.match(videoRegion, /class="dex-breadcrumb-current">instrument, artist<\/span>/);
assert.match(videoRegion, /id="dex-breadcrumb-back-script"/);
assert.match(videoRegion, /id="dex-breadcrumb-motion-bootstrap"/);
assert.match(videoRegion, /src="https:\/\/dexdsl\.github\.io\/assets\/js\/dex-breadcrumb-motion\.js"/);
assert.match(videoRegion, /window\.history\.back\(\)/);
assert.match(videoRegion, /href="\/catalog"/);
assert.match(videoRegion, /class="dex-video"/);
assert.match(videoRegion, /data-video-url="https:\/\/www\.youtube\.com\/watch\?v=CSFGiU1gg4g"/);
assert.match(videoRegion, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/CSFGiU1gg4g"/);
assert.match(videoRegion, /loading="lazy"/);
assert.match(videoRegion, /referrerpolicy="strict-origin-when-cross-origin"/);
assert.doesNotMatch(videoRegion, /\bstyle=/i);
assert.doesNotMatch(videoRegion, /source_ve_path/i);

assert.doesNotMatch(videoRegion, /sqs-video-wrapper/i);
assert.doesNotMatch(videoRegion, /data-html="&lt;iframe/i);

const injectedSchemeless = injectEntryHtml(templateHtml, {
  descriptionText: 'Video injection test',
  descriptionHtml: '',
  manifest: {
    audio: { A: { wav: '' }, B: { wav: '' }, C: { wav: '' }, D: { wav: '' }, E: { wav: '' }, X: { wav: '' } },
    video: { A: { '1080p': '' }, B: { '1080p': '' }, C: { '1080p': '' }, D: { '1080p': '' }, E: { '1080p': '' }, X: { '1080p': '' } },
  },
  sidebarConfig: {
    lookupNumber: 'LOOKUP-TEST',
    attributionSentence: 'Attribution',
    buckets: ['A'],
    specialEventImage: '/assets/series/dex.png',
    credits: {
      artist: ['Artist'],
      artistAlt: null,
      instruments: ['Instrument'],
      video: { director: ['Director'], cinematography: ['Cinematography'], editing: ['Editing'] },
      audio: { recording: ['Recording'], mix: ['Mix'], master: ['Master'] },
      year: 2026,
      season: 'S1',
      location: 'Somewhere',
    },
    fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
    metadata: { sampleLength: '', tags: [] },
  },
  video: { mode: 'url', dataUrl: schemelessVideoUrl, dataHtml: '' },
  title: 'Video Test',
  authEnabled: false,
}).html;
assert.match(injectedSchemeless, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/CSFGiU1gg4g"/);

const videoEndIx = injected.indexOf('<!-- DEX:VIDEO_END -->');
const descStartIx = injected.indexOf('<!-- DEX:DESC_START -->');
const asideCloseIx = injected.indexOf('</aside>');
assert.ok(videoEndIx >= 0 && descStartIx >= 0 && videoEndIx < descStartIx, 'DEX:VIDEO must come before DEX:DESC');
assert.ok(videoEndIx >= 0 && asideCloseIx >= 0 && videoEndIx < asideCloseIx, 'DEX:VIDEO must be inside main column before closing </aside>');
assert.ok(videoRegion.indexOf('class="dex-breadcrumb"') < videoRegion.indexOf('class="dex-video"'), 'breadcrumb should appear before the video container');
assert.ok(videoRegion.indexOf('class="dex-breadcrumb-overlay"') < videoRegion.indexOf('class="dex-video"'), 'overlay wrapper should precede video container');

assert.equal(formatBreadcrumbCurrentLabel({ instrument: 'GUITAR AND VOICE', artistName: 'Aidan Yeats' }), 'guitar and voice, aidan yeats');
assert.deepEqual(
  resolveBreadcrumbBackStrategy({
    referrer: 'http://localhost:4173/catalog',
    locationOrigin: 'http://localhost:4173',
    locationPath: '/view/123',
    historyLength: 2,
  }),
  { useHistoryBack: true, fallbackHref: '/catalog' },
);
assert.deepEqual(
  resolveBreadcrumbBackStrategy({
    referrer: 'https://dexdsl.org/catalog',
    locationOrigin: 'http://localhost:4173',
    locationPath: '/view/123',
    historyLength: 2,
  }),
  { useHistoryBack: false, fallbackHref: '/catalog' },
);

console.log('test-video-injection ok');
