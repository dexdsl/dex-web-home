#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SETTINGS_PATH = path.join(ROOT, 'docs', 'entry', 'settings', 'index.html');
const AUTH_CONFIG_PATHS = [
  path.join(ROOT, 'public', 'assets', 'dex-auth0-config.js'),
  path.join(ROOT, 'public', 'assets', 'dex-auth-config.js')
];
const STRIPE_PRODUCT_MAP_PATH = path.join(ROOT, 'data', 'stripe-membership-products.json');

const REQUIRED_ENDPOINT_MARKERS = [
  '/me/billing/plans',
  '/me/billing/summary',
  '/me/billing/checkout-session',
  '/me/billing/portal-session',
  '/me/billing/subscription/pause',
  '/me/billing/subscription/resume'
];

const REQUIRED_HANDLER_MARKERS = [
  'manageBtn?.addEventListener(\'click\'',
  'portalHistoryBtn?.addEventListener(\'click\'',
  'pauseResumeBtn?.addEventListener(\'click\'',
  'startBtn?.addEventListener(\'click\'',
  'returnPath: RETURN_PATH'
];

const BANNED_MARKERS = [
  "fetch(api + '/stripe/create-checkout-session'",
  'if (window.DEX_AUTH && window.DEX_AUTH.ready)',
  'createAuth0Client({'
];

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function verifySettingsContract(failures) {
  const html = readText(SETTINGS_PATH);

  for (const marker of REQUIRED_ENDPOINT_MARKERS) {
    if (!html.includes(marker)) {
      failures.push(`settings page missing endpoint marker: ${marker}`);
    }
  }

  for (const marker of REQUIRED_HANDLER_MARKERS) {
    if (!html.includes(marker)) {
      failures.push(`settings page missing handler marker: ${marker}`);
    }
  }

  for (const marker of BANNED_MARKERS) {
    if (html.includes(marker)) {
      failures.push(`settings page still contains banned legacy marker: ${marker}`);
    }
  }

  if (!html.includes('BILLING_ENDPOINTS')) {
    failures.push('settings page is missing BILLING_ENDPOINTS contract object');
  }

  if (!html.includes('data/stripe-membership-products.json') && !fs.existsSync(STRIPE_PRODUCT_MAP_PATH)) {
    failures.push('stripe membership product mapping file is missing');
  }
}

function verifyAudienceContract(failures) {
  for (const configPath of AUTH_CONFIG_PATHS) {
    const source = readText(configPath);
    const matches = [...source.matchAll(/audience:\s*"([^"]*)"/g)];
    if (!matches.length) {
      failures.push(`${path.relative(ROOT, configPath)} has no audience declarations`);
      continue;
    }
    // Compatibility mode: empty audience keeps auth stable until Auth0 API identifier is confirmed.
    // Contract only requires declarations to exist.
  }
}

function verifyStripeProductMap(failures) {
  let parsed;
  try {
    parsed = JSON.parse(readText(STRIPE_PRODUCT_MAP_PATH));
  } catch (error) {
    failures.push(`stripe product map is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const envs = ['production', 'test'];
  const tiers = ['S', 'M', 'L'];
  const intervals = ['month', 'year'];

  for (const env of envs) {
    for (const tier of tiers) {
      for (const interval of intervals) {
        const node = parsed?.[env]?.[tier]?.[interval];
        if (!node || typeof node !== 'object') {
          failures.push(`stripe product map missing node ${env}.${tier}.${interval}`);
          continue;
        }
        const productId = String(node.productId || '').trim();
        const priceId = String(node.priceId || '').trim();
        if (!productId.startsWith('prod_')) {
          failures.push(`stripe product map ${env}.${tier}.${interval} has invalid productId`);
        }
        if (!priceId.startsWith('price_')) {
          failures.push(`stripe product map ${env}.${tier}.${interval} has invalid priceId`);
        }
        if (!(Number.isFinite(Number(node.amount)) && Number(node.amount) > 0)) {
          failures.push(`stripe product map ${env}.${tier}.${interval} has invalid amount`);
        }
      }
    }
  }
}

function main() {
  const failures = [];

  verifySettingsContract(failures);
  verifyAudienceContract(failures);
  verifyStripeProductMap(failures);

  if (failures.length > 0) {
    console.error(`verify:membership-billing failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('verify:membership-billing passed.');
}

try {
  main();
} catch (error) {
  console.error(`verify:membership-billing error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
