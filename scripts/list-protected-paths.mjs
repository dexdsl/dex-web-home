#!/usr/bin/env node
/**
 * List (best-effort) protected paths on https://dexdsl.org by:
 *  1) Expanding sitemap(s) (if present)
 *  2) Crawling internal links from public pages (limited)
 *  3) Probing each discovered URL and flagging likely protected routes (401/403, or password-gate redirects)
 *
 * Outputs one PATH per line (e.g. /entry/tim-feeney).
 *
 * Usage:
 *   node scripts/list-protected-paths.mjs > protected-paths.txt
 *
 * Optional env:
 *   BASE_URL=https://dexdsl.org
 *   MAX_PAGES=3000
 *   CONCURRENCY=10
 *   CRAWL_DEPTH=2
 *   TIMEOUT_MS=20000
 */

import { gunzipSync } from "node:zlib";

const BASE_URL = (process.env.BASE_URL ?? "https://dexdsl.org").replace(/\/+$/, "");
const ORIGIN = new URL(BASE_URL).origin;

const MAX_PAGES = Number(process.env.MAX_PAGES ?? 3000);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 10));
const CRAWL_DEPTH = Math.max(0, Number(process.env.CRAWL_DEPTH ?? 2));
const TIMEOUT_MS = Math.max(1000, Number(process.env.TIMEOUT_MS ?? 20000));

const SITEMAP_CANDIDATES = [
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/sitemap.xml.gz",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeUrl(u) {
  try {
    const url = new URL(u, ORIGIN);
    // stay on target origin
    if (url.origin !== ORIGIN) return null;
    // drop fragments for uniqueness
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function toPath(urlStr) {
  const u = new URL(urlStr);
  return `${u.pathname}${u.search}`;
}

function uniq(arr) {
  return [...new Set(arr)];
}

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "user-agent": "dex-protected-scan/1.0 (+local)",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init.headers ?? {}),
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchTextMaybeGzip(url) {
  const res = await fetchWithTimeout(url, { redirect: "follow" });
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const isGz =
    url.endsWith(".gz") ||
    ct.includes("application/gzip") ||
    ct.includes("application/x-gzip");

  const data = isGz ? gunzipSync(buf) : buf;
  return data.toString("utf8");
}

function extractLocsFromXml(xml) {
  // robust-enough for sitemaps; avoids adding an XML dependency
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) {
    locs.push(m[1]);
  }
  return locs;
}

function looksLikeSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

async function expandSitemaps() {
  const discovered = new Set();

  // try candidate sitemap entrypoints
  const entrypoints = [];
  for (const p of SITEMAP_CANDIDATES) {
    const url = `${BASE_URL}${p}`;
    try {
      const xml = await fetchTextMaybeGzip(url);
      if (!xml) continue;
      entrypoints.push(url);
      break;
    } catch {
      // ignore
    }
  }
  if (!entrypoints.length) return [];

  const queue = [...entrypoints];
  const seen = new Set(queue);

  while (queue.length && discovered.size < MAX_PAGES) {
    const sitemapUrl = queue.shift();
    let xml;
    try {
      xml = await fetchTextMaybeGzip(sitemapUrl);
    } catch {
      continue;
    }
    if (!xml) continue;

    const locs = extractLocsFromXml(xml);

    if (looksLikeSitemapIndex(xml)) {
      for (const loc of locs) {
        const n = normalizeUrl(loc);
        if (!n) continue;
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    } else {
      for (const loc of locs) {
        const n = normalizeUrl(loc);
        if (!n) continue;
        discovered.add(n);
        if (discovered.size >= MAX_PAGES) break;
      }
    }
  }

  return [...discovered];
}

function extractInternalHrefs(html, currentUrl) {
  const out = [];
  // Find href= values in anchors/areas only (avoid scripts/styles/forms)
  const re = /<(a|area)\b[^>]*\bhref\s*=\s*(["'])(.*?)\2/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[3] ?? "").trim();
    if (!raw) continue;
    if (raw.startsWith("#")) continue;
    if (raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:") || raw.startsWith("data:")) continue;

    const n = normalizeUrl(new URL(raw, currentUrl).toString());
    if (!n) continue;
    out.push(n);
  }
  return out;
}

async function probe(url) {
  // manual redirect handling so we can detect password-gate style redirects
  const chain = [];
  let current = url;
  for (let i = 0; i < 6; i++) {
    const res = await fetchWithTimeout(current, { redirect: "manual" });

    const status = res.status;
    const loc = res.headers.get("location");
    chain.push({ url: current, status, location: loc ?? null });

    // terminal statuses
    if (![301, 302, 303, 307, 308].includes(status) || !loc) {
      // read a tiny body slice when non-2xx, to help detect password gates that return 200 with gate HTML
      let bodySnippet = "";
      try {
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (ct.includes("text/html")) {
          const txt = await res.text();
          bodySnippet = txt.slice(0, 4000);
        }
      } catch {
        // ignore
      }
      return { finalUrl: current, status, chain, bodySnippet };
    }

    // follow redirect
    const next = new URL(loc, current).toString();
    const normalized = normalizeUrl(next);
    if (!normalized) return { finalUrl: current, status, chain, bodySnippet: "" };
    current = normalized;
  }
  return { finalUrl: current, status: 0, chain, bodySnippet: "" };
}

function isLikelyProtected(probeResult) {
  const { status, chain, bodySnippet } = probeResult;

  if (status === 401 || status === 403) return true;

  // Detect common Squarespace password-gate redirect patterns (best-effort)
  for (const hop of chain) {
    const loc = hop.location ?? "";
    if (/password/i.test(loc)) return true;
    if (/\?password=/i.test(loc)) return true;
  }

  // Detect gate HTML (best-effort; Squarespace gate pages often include password input)
  if (typeof bodySnippet === "string" && bodySnippet) {
    if (/<input[^>]+type=["']password["']/i.test(bodySnippet)) return true;
    if (/password\s*protected/i.test(bodySnippet)) return true;
  }

  return false;
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
      // tiny politeness delay (avoid tripping edge rate limits)
      await sleep(30);
    }
  });
  await Promise.all(workers);
  return results;
}

async function crawlFromPublicSeeds(seeds) {
  const queue = seeds.map((u) => ({ url: u, depth: 0 }));
  const seen = new Set(seeds);
  const found = new Set(seeds);

  while (queue.length && found.size < MAX_PAGES) {
    // batch
    const batch = queue.splice(0, CONCURRENCY).map((x) => x);

    const pages = await Promise.all(
      batch.map(async ({ url, depth }) => {
        try {
          const res = await fetchWithTimeout(url, { redirect: "follow" });
          const ct = (res.headers.get("content-type") ?? "").toLowerCase();
          if (!ct.includes("text/html")) return { url, depth, html: "" };
          const html = await res.text();
          return { url, depth, html };
        } catch {
          return { url, depth, html: "" };
        }
      })
    );

    for (const { url, depth, html } of pages) {
      if (!html) continue;
      if (depth >= CRAWL_DEPTH) continue;

      const hrefs = extractInternalHrefs(html, url);
      for (const h of hrefs) {
        if (found.size >= MAX_PAGES) break;
        if (seen.has(h)) continue;
        seen.add(h);
        found.add(h);
        queue.push({ url: h, depth: depth + 1 });
      }
    }
  }

  return [...found];
}

async function main() {
  // 1) sitemap expansion
  const sitemapUrls = await expandSitemaps();

  // 2) crawl internal links starting from homepage + a few obvious roots
  const seedCandidates = uniq([
    `${BASE_URL}/`,
    `${BASE_URL}/catalog`,
    `${BASE_URL}/about`,
    ...sitemapUrls.slice(0, 50), // seed crawl with a few sitemap pages if present
  ].map(normalizeUrl).filter(Boolean));

  const crawledUrls = await crawlFromPublicSeeds(seedCandidates);

  // 3) union + probe
  const all = uniq([...sitemapUrls, ...crawledUrls]).slice(0, MAX_PAGES);

  const probeResults = await mapLimit(all, CONCURRENCY, async (u) => {
    try {
      const pr = await probe(u);
      return { url: u, ...pr };
    } catch {
      return { url: u, finalUrl: u, status: -1, chain: [], bodySnippet: "" };
    }
  });

  const protectedPaths = [];
  for (const r of probeResults) {
    if (isLikelyProtected(r)) {
      protectedPaths.push(toPath(r.finalUrl));
    }
  }

  // stable output: sorted unique paths
  const out = uniq(protectedPaths).sort((a, b) => a.localeCompare(b));
  for (const p of out) console.log(p);
}

await main();
