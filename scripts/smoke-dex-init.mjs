import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
  descriptionHtml: '<p>desc</p>',
  video: { dataUrl: 'https://player.vimeo.com/video/1' },
  manifest: { audio: { A: { wav: 'a1' } }, video: { A: { '1080p': 'v1' } } },
  sidebarPageConfig: { lookupNumber: 'LOOKUP-1', attributionSentence: 'attrib', buckets: ['A'], credits: { artist: { name: 'Artist' }, year: 2026, season: 'S2', location: 'Somewhere' } },
}), 'utf8');

const run = (args) => spawnSync('node', [path.join(root, 'scripts/dex.mjs'), ...args], { cwd: temp, encoding: 'utf8' });
const dry = run(['init', '--quick', '--template', './index.html', '--out', './entries', '--dry-run', '--from', './seed.json']);
if (dry.status !== 0) throw new Error(`dry-run failed: ${dry.stderr}\n${dry.stdout}`);
const real = run(['init', '--quick', '--template', './index.html', '--out', './entries', '--from', './seed.json']);
if (real.status !== 0) throw new Error(`write run failed: ${real.stderr}\n${real.stdout}`);

const outHtml = await fs.readFile(path.join(temp, 'entries', 'smoke-title', 'index.html'), 'utf8');
for (const needle of ['data-url="https://player.vimeo.com/video/1"', 'LOOKUP-1', '"wav": "a1"', '/assets/dex-auth0-config.js', '/assets/dex-auth.js']) {
  if (!outHtml.includes(needle)) throw new Error(`missing in output html: ${needle}`);
}
console.log('smoke-dex-init ok');
