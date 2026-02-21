import assert from 'node:assert/strict';
import { load as loadHtml } from 'cheerio';
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
    <section class="page-section has-section-divider">
      <div class="content-wrapper" style="padding-bottom: 10px;">
        <div class="fluid-engine fe-demo">
          <div class="fe-block fe-block-legacy">
            <div class="sqs-block website-component-block sqs-block-website-component sqs-block-code code-block"
              data-block-css='["https://definitions.sqspcdn.com/website-component-definition/static-assets/website.components.code/example/legacy.styles.css"]'
              data-block-scripts='["https://definitions.sqspcdn.com/website-component-definition/static-assets/website.components.code/example/legacy.visitor.js"]'>
              <div class="sqs-block-content"><div class="sqs-code-container"><style>.legacy{display:block}</style></div></div>
            </div>
          </div>
          <div class="fe-block fe-block-right">
            <div class="sqs-block website-component-block sqs-block-website-component sqs-block-code code-block"
              data-block-css='["https://definitions.sqspcdn.com/website-component-definition/static-assets/website.components.code/example/website.components.code.styles.css"]'
              data-block-scripts='["https://definitions.sqspcdn.com/website-component-definition/static-assets/website.components.code/example/website.components.code.visitor.js"]'>
              <div class="sqs-block-content">
                <div class="sqs-code-container">
                  <div class="dex-entry-layout">
                    <div class="dex-entry-main"></div>
                    <aside class="dex-sidebar"></aside>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="section-divider-display">divider</div>
      </div>
    </section>
    <section class="page-section section-height--custom" style="min-height: 5vh;">
      <div class="content-wrapper" style="padding-top: calc(5vmax / 5); padding-bottom: 8px;">
        <footer class="dex-footer">Footer</footer>
      </div>
    </section>
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
assert.ok(sanitized.includes('id="dex-sidebar-page-config-bridge"'), 'Dex page config bridge script should exist');
assert.ok(sanitized.includes("window.dexSidebarPageConfig = JSON.parse(document.getElementById('dex-sidebar-page-config').textContent || '{}');"), 'Dex page config bridge should use deterministic snippet');
assert.ok(sanitized.includes('id="dex-manifest"'), 'Dex manifest script should remain');

const siteCssIndex = sanitized.search(/https:\/\/static1\.squarespace\.com\/static\/versioned-site-css\/demo\/site\.css/i);
const dexCssIndex = sanitized.indexOf('https://dexdsl.github.io/assets/css/dex.css');
assert.ok(dexCssIndex > siteCssIndex, 'Dex stylesheet should load after site.css');

const $ = loadHtml(sanitized, { decodeEntities: false });
assert.equal($('.fluid-engine .dex-entry-layout').length, 1, 'Dex layout should remain in Fluid Engine host');
assert.equal($('.dex-entry-host .dex-entry-layout').length, 1, 'Dex layout host should be preserved and marked');
assert.equal($('.dex-entry-host').closest('.fluid-engine').length, 1, 'Dex layout host should remain scoped to Fluid Engine');
assert.equal($('.fluid-engine .website-component-block').length, 1, 'Only Dex website component block should remain');
assert.equal($('.fluid-engine .fe-block').length, 1, 'Legacy Fluid Engine sibling blocks should be removed');
assert.match(String($('.fluid-engine .fe-block.dex-entry-host').attr('style') || ''), /grid-area:\s*auto\s*\/\s*1\s*\/\s*auto\s*\/\s*-1\s*!important/i, 'Dex host should enforce full-width grid span');
assert.equal($('.dex-entry-section').length, 1, 'Dex entry section should be tagged');
assert.ok(!$('.dex-entry-section').hasClass('has-section-divider'), 'Dex entry section should drop section-divider class');
assert.equal($('.section-divider-display').length, 0, 'Divider before dex footer section should be removed');
assert.equal($('.dex-footer-section').length, 1, 'Dex footer section should be tagged');
assert.ok(!$('.dex-footer-section').hasClass('section-height--custom'), 'Dex footer section should drop custom-height class');
assert.ok(!/min-height\s*:/i.test(String($('.dex-footer-section').attr('style') || '')), 'Dex footer section should not enforce min-height');
assert.ok(!/padding-top\s*:/i.test(String($('.dex-footer-section > .content-wrapper').attr('style') || '')), 'Dex footer wrapper should not enforce top padding');
assert.ok(!/padding-bottom\s*:/i.test(String($('.dex-footer-section > .content-wrapper').attr('style') || '')), 'Dex footer wrapper should not enforce bottom padding');

console.log('ok sanitize generated html');
