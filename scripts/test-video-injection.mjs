import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { injectEntryHtml } from './lib/entry-html.mjs';

const root = process.cwd();
const templatePath = path.join(root, 'entry-template', 'index.html');
const templateHtml = await fs.readFile(templatePath, 'utf8');

const basePayload = {
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
  title: 'Video Test',
  authEnabled: false,
};

function render(video) {
  return injectEntryHtml(templateHtml, { ...basePayload, video }).html;
}

function renderResult(video, templateOverride = templateHtml) {
  return injectEntryHtml(templateOverride, { ...basePayload, video });
}

const watchHtml = render({
  mode: 'url',
  dataUrl: 'https://www.youtube.com/watch?v=CSFGiU1gg4g',
  dataHtml: '<iframe src="example.com"></iframe>',
});
assert.match(watchHtml, /data-html="&lt;iframe/i);
assert.match(watchHtml, /youtube\.com\/embed\/CSFGiU1gg4g/);
assert.doesNotMatch(watchHtml, /data-html="<iframe/i);
assert.doesNotMatch(watchHtml, /data-url="example\.com"/i);
assert.doesNotMatch(watchHtml, /src="example\.com"/i);

const shortHtml = render({
  mode: 'url',
  dataUrl: 'https://youtu.be/CSFGiU1gg4g?t=30',
  dataHtml: '<iframe src="example.com"></iframe>',
});
assert.match(shortHtml, /youtube\.com\/embed\/CSFGiU1gg4g/);
assert.match(shortHtml, /data-url="https:\/\/youtu\.be\/CSFGiU1gg4g\?t=30"/);
assert.doesNotMatch(shortHtml, /data-url="example\.com"/i);
assert.doesNotMatch(shortHtml, /src="example\.com"/i);

const vimeoHtml = render({
  mode: 'url',
  dataUrl: 'https://vimeo.com/123456789?feature=oembed',
  dataHtml: '<iframe src="example.com"></iframe>',
});
assert.match(vimeoHtml, /player\.vimeo\.com\/video\/123456789/);
assert.match(vimeoHtml, /data-url="https:\/\/vimeo\.com\/123456789\?feature=oembed"/);
assert.doesNotMatch(vimeoHtml, /data-url="example\.com"/i);
assert.doesNotMatch(vimeoHtml, /src="example\.com"/i);

const selectorTemplate = templateHtml
  .replace('<!-- DEX:VIDEO_START -->', '')
  .replace('<!-- DEX:VIDEO_END -->', '');
const selectorInjected = renderResult({
  mode: 'url',
  dataUrl: 'https://youtu.be/CSFGiU1gg4g',
  dataHtml: '',
}, selectorTemplate);
assert.equal(selectorInjected.strategy.video, 'selector');
assert.match(selectorInjected.html, /data-url="https:\/\/youtu\.be\/CSFGiU1gg4g"/);
assert.match(selectorInjected.html, /youtube\.com\/embed\/CSFGiU1gg4g/);

console.log('test-video-injection ok');
