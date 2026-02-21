import assert from 'node:assert/strict';
import { sanitizeGeneratedHtml, verifySanitizedHtml } from './lib/sanitize-generated-html.mjs';

const fixtureHtml = `
<!doctype html>
<html lang="en">
  <head>
    <base href="">
    <script src="//use.typekit.net/ik/abc.js" onload="try{Typekit.load();}catch(e){}"></script>
    <script>SQUARESPACE_ROLLUPS = {};</script>
    <script>Static.SQUARESPACE_CONTEXT = { rollups: { core: "//assets.squarespace.com/x.js" } };</script>
    <link rel="stylesheet" href="https://static1.squarespace.com/static/versioned-site-css/demo/site.css">
    <link rel="stylesheet" href="https://definitions.sqspcdn.com/website-component-definition/static-assets/website.components.code/example/website.components.code.styles.css">
    <script defer src="https://definitions.sqspcdn.com/website-component-definition/static-assets/website.components.code/example/website.components.code.visitor.js"></script>
    <link rel="stylesheet" href="/assets/css/dex.css">
    <script defer src="/assets/dex-auth0-config.js"></script>
    <script defer src="/assets/dex-auth.js"></script>
    <script src="/assets/dex-sidebar.js"></script>
  </head>
  <body>
    <script id="dex-sidebar-config" type="application/json">{}</script>
    <script id="dex-sidebar-page-config" type="application/json">{}</script>
    <script id="dex-manifest" type="application/json">{}</script>
    <a href="//images.squarespace-cdn.com/content/v1/demo.jpg">asset link</a>
    <div data-block-scripts='["https://definitions.sqspcdn.com/website.components.code.js"]'>runtime block</div>
  </body>
</html>
`;

const sanitized = sanitizeGeneratedHtml(fixtureHtml);
const sanitizedTwice = sanitizeGeneratedHtml(sanitized);
const verify = verifySanitizedHtml(sanitized);
const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

assert.ok(!/<script[^>]*src=["'][^"']*use\.typekit\.net\/ik\/[^"']*["']/i.test(sanitized), 'Sanitizer should remove Typekit runtime scripts');
assert.ok(!/SQUARESPACE_ROLLUPS/i.test(sanitized), 'Sanitizer should remove inline Squarespace rollup scripts');
assert.ok(!/Static\.SQUARESPACE_CONTEXT/i.test(sanitized), 'Sanitizer should remove inline Static bootstrap scripts');
assert.ok(!/website\.components\.code\.visitor/i.test(sanitized), 'Sanitizer should remove website component runtime scripts');
assert.ok(!/<base\b/i.test(sanitized), 'Sanitizer should remove <base> tags');
assert.equal(normalizeWhitespace(sanitizedTwice), normalizeWhitespace(sanitized), 'Sanitizer should be idempotent');
assert.ok(verify.ok, `Sanitized output should verify cleanly: ${JSON.stringify(verify.issues)}`);

assert.ok(/https:\/\/static1\.squarespace\.com\/static\/versioned-site-css\/demo\/site\.css/i.test(sanitized), 'Sanitizer should keep Squarespace site.css');
assert.ok(/href="https:\/\/images\.squarespace-cdn\.com\/content\/v1\/demo\.jpg"/i.test(sanitized), 'Sanitizer should normalize protocol-relative href values');
assert.ok(!/\b(?:src|href)\s*=\s*["']\/\//i.test(sanitized), 'Sanitizer should remove protocol-relative src/href attributes');
assert.ok(!/sqspcdn/i.test(sanitized), 'Sanitizer should remove sqspcdn runtime markers');
assert.ok(!/websiteComponents/i.test(sanitized), 'Sanitizer should remove websiteComponents runtime markers');

const dexCssCount = (sanitized.match(/https:\/\/dexdsl\.github\.io\/assets\/css\/dex\.css/g) || []).length;
const dexSidebarCount = (sanitized.match(/https:\/\/dexdsl\.github\.io\/assets\/dex-sidebar\.js/g) || []).length;
assert.equal(dexCssCount, 1, 'Dex stylesheet should exist exactly once');
assert.equal(dexSidebarCount, 1, 'Dex sidebar script should exist exactly once');
assert.ok(sanitized.includes('id="dex-sidebar-config"'), 'Dex global config script should remain');
assert.ok(sanitized.includes('id="dex-sidebar-page-config"'), 'Dex page config script should remain');
assert.ok(sanitized.includes('id="dex-manifest"'), 'Dex manifest script should remain');

const siteCssIndex = sanitized.search(/https:\/\/static1\.squarespace\.com\/static\/versioned-site-css\/demo\/site\.css/i);
const dexCssIndex = sanitized.indexOf('https://dexdsl.github.io/assets/css/dex.css');
assert.ok(dexCssIndex > siteCssIndex, 'Dex stylesheet should load after site.css');

console.log('ok sanitize generated html');
