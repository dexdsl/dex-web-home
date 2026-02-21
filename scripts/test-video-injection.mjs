import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { injectEntryHtml } from './lib/entry-html.mjs';

const root = process.cwd();
const templatePath = path.join(root, 'entry-template', 'index.html');
const templateHtml = await fs.readFile(templatePath, 'utf8');

const videoUrl = 'https://www.youtube.com/watch?v=CSFGiU1gg4g';

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

assert.match(videoRegion, /class="dex-video"/);
assert.match(videoRegion, /data-video-url="https:\/\/www\.youtube\.com\/watch\?v=CSFGiU1gg4g"/);
assert.match(videoRegion, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/CSFGiU1gg4g"/);
assert.match(videoRegion, /loading="lazy"/);
assert.match(videoRegion, /referrerpolicy="strict-origin-when-cross-origin"/);

assert.doesNotMatch(videoRegion, /sqs-video-wrapper/i);
assert.doesNotMatch(videoRegion, /data-html="&lt;iframe/i);

console.log('test-video-injection ok');
