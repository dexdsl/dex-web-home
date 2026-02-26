#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILURES = [];

function readText(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    FAILURES.push(`Missing required file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(absPath, 'utf8');
}

function assertIncludes(relPath, text, markers) {
  for (const marker of markers) {
    if (!text.includes(marker)) {
      FAILURES.push(`${relPath} missing marker: ${marker}`);
    }
  }
}

function assertExcludes(relPath, text, markers) {
  for (const marker of markers) {
    if (text.includes(marker)) {
      FAILURES.push(`${relPath} should not include marker: ${marker}`);
    }
  }
}

function verifySettingsContract() {
  const relPath = 'docs/entry/settings/index.html';
  const text = readText(relPath);

  assertIncludes(relPath, text, [
    'id="notifDexNotes"',
    'id="notifDexNotes" type="checkbox" title="',
    'id="notifPolls"',
    'id="notifAchv"',
    'id="notifBill"',
    'id="notifSec"',
    'id="notifStatus"',
    'id="notifSubs"',
    'id="notifDigest" type="checkbox" title="Email me a weekly summary every Monday at 9:00 AM local time.',
    'version: 2',
    'categories:',
    'channels:',
    'digest:',
    "cadence: 'weekly'",
    "day: 'monday'",
    "localHour: 9",
  ]);

  assertExcludes(relPath, text, [
    'id="notifAnn"',
    'id="notifRel"',
    'id="quietStart"',
    'id="quietEnd"',
    'id="notifFol"',
    'id="notifMen"',
    'id="notifProj"',
    'New followers',
    'Mentions &amp; replies',
    'Project updates',
  ]);
}

function verifyMessagesRuntimeContract() {
  const sourceRel = 'scripts/src/messages.inbox.entry.mjs';
  const sourceText = readText(sourceRel);
  assertIncludes(sourceRel, sourceText, [
    'window.__dxMessagesInboxRuntimeLoaded',
    'withTimeout(',
    'jsonpWithTimeout(',
    'data-dx-msg-filter',
    "'/me/messages/read-all'",
    'dx:messages:unread-count',
    'SUBMISSION_STATE_PREFIX',
  ]);

  for (const relPath of [
    'public/assets/js/messages.inbox.js',
    'assets/js/messages.inbox.js',
    'docs/assets/js/messages.inbox.js',
  ]) {
    const text = readText(relPath);
    assertIncludes(relPath, text, [
      '__dxMessagesInboxRuntimeLoaded',
      'dx:messages:unread-count',
      'me/messages/read-all',
    ]);
  }
}

function verifyRouteContract() {
  const routeRel = 'docs/entry/messages/index.html';
  const routeText = readText(routeRel);
  assertIncludes(routeRel, routeText, [
    'id="dex-msg"',
    'data-dx-fetch-state="loading"',
    'data-api="https://dex-api.spring-fog-8edd.workers.dev"',
    '/assets/js/messages.inbox.js',
  ]);

  const stubRel = 'docs/messages.html';
  const stubText = readText(stubRel);
  assertIncludes(stubRel, stubText, [
    'url=./entry/messages/',
    "location.replace('./entry/messages/' + location.search + location.hash);",
  ]);
}

function verifyAuthBadgeContract() {
  for (const relPath of [
    'assets/dex-auth.js',
    'public/assets/dex-auth.js',
    'docs/assets/dex-auth.js',
  ]) {
    const text = readText(relPath);
    assertIncludes(relPath, text, [
      'auth-ui-messages-badge',
      'dx:messages:unread-count',
      '/me/messages/unread-count',
      'bindMessagesUnreadEvents',
      'syncMessagesUnreadCount',
    ]);
  }
}

function main() {
  verifySettingsContract();
  verifyMessagesRuntimeContract();
  verifyRouteContract();
  verifyAuthBadgeContract();

  if (FAILURES.length > 0) {
    console.error(`verify:notifications failed with ${FAILURES.length} issue(s):`);
    for (const failure of FAILURES) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:notifications passed.');
}

main();
