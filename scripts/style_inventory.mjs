import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const ROLES_PATH = path.join(ROOT, 'style.roles.json');
const SANITIZE_CONFIG_PATH = path.join(ROOT, 'sanitize.config.json');
const PHASE2_CONFIG_PATH = path.join(ROOT, 'phase2.config.json');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'style-inventory.raw.json');

const STYLE_FIELDS = [
  // Color
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'fill',
  'stroke',
  // Typography
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'fontVariantLigatures',
  // Spacing
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'rowGap',
  'columnGap',
  // Shape
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'boxShadow',
  // Layout
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'maxWidth',
  'minWidth',
  'alignItems',
  'justifyContent',
  'alignSelf',
  'justifySelf',
  'gridTemplateColumns',
  'gridTemplateRows',
  'flexDirection',
  'flexWrap',
  'textAlign',
  'opacity',
  'zIndex',
];

const DEFAULT_PHASE2_CONFIG = {
  pages: ['/', '/favorites'],
  viewports: [
    { name: 'mobile', w: 390, h: 844 },
    { name: 'tablet', w: 834, h: 1112 },
    { name: 'desktop', w: 1440, h: 900 },
  ],
};

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadConfig() {
  if (fs.existsSync(SANITIZE_CONFIG_PATH)) {
    return loadJSON(SANITIZE_CONFIG_PATH);
  }
  if (fs.existsSync(PHASE2_CONFIG_PATH)) {
    return loadJSON(PHASE2_CONFIG_PATH);
  }
  fs.writeFileSync(PHASE2_CONFIG_PATH, JSON.stringify(DEFAULT_PHASE2_CONFIG, null, 2));
  return DEFAULT_PHASE2_CONFIG;
}

async function waitForServer(baseURL, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseURL, { method: 'HEAD' });
      if (res.ok || res.status === 404) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
  };
  return map[ext] || 'application/octet-stream';
}

function resolvePathSafe(baseDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const cleanPath = decoded.replace(/\/+/g, '/');
  const resolved = path.resolve(baseDir, `.${cleanPath}`);
  const normalizedBase = path.resolve(baseDir);
  if (!resolved.startsWith(normalizedBase)) return null;
  return resolved;
}

function startStaticServer(baseDir, port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url || '/', `http://${host || 'localhost'}:${port}`);
      let filePath = resolvePathSafe(baseDir, requestUrl.pathname);
      if (!filePath) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', guessContentType(filePath));
      if (req.method === 'HEAD') {
        res.statusCode = 200;
        res.end();
        return;
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        res.statusCode = 500;
        res.end('Server error');
      });
      stream.pipe(res);
    });
    server.on('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

function buildSelectorHint(elInfo, role) {
  const tag = elInfo.tag || '';
  const id = elInfo.id ? `#${elInfo.id}` : '';
  const cls = elInfo.firstClass ? `.${elInfo.firstClass}` : '';
  return `${tag}${id}${cls} [role:${role}]`.trim();
}

function roundHalf(value) {
  return Math.round(Number(value) * 2) / 2;
}

async function preparePage(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
  await page.addStyleTag({
    content: `
      * { animation: none !important; transition: none !important; caret-color: auto !important; scroll-behavior: auto !important; }
    `,
  });
}

async function collectRoleSamples(page, pagePath, viewportName, roleName, selectors) {
  const selector = selectors.join(',');
  const elements = await page.$$(selector);
  const slice = elements.slice(0, 60);
  const records = [];

  for (const handle of slice) {
    const record = await handle.evaluate(
      (el, payload) => {
        const { role, fields } = payload;
        const rect = el.getBoundingClientRect();
        const styles = getComputedStyle(el);
        const data = {};
        for (const field of fields) {
          data[field] = styles[field];
        }
        const firstClass = (el.classList && el.classList[0]) || '';
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          firstClass,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          styles: data,
          role,
        };
      },
      { role: roleName, fields: STYLE_FIELDS },
    );

    records.push({
      page: pagePath,
      viewport: viewportName,
      role: roleName,
      selectorHint: buildSelectorHint(record, roleName),
      rect: {
        x: roundHalf(record.rect.x),
        y: roundHalf(record.rect.y),
        width: roundHalf(record.rect.width),
        height: roundHalf(record.rect.height),
      },
      styles: record.styles,
    });
  }

  return records;
}

async function main() {
  const config = loadConfig();
  const pages = Array.isArray(config.pages) && config.pages.length > 0 ? config.pages : DEFAULT_PHASE2_CONFIG.pages;
  const viewports = Array.isArray(config.viewports) && config.viewports.length > 0 ? config.viewports : DEFAULT_PHASE2_CONFIG.viewports;
  const baseURL = config.baseURL || process.env.PHASE2_BASE_URL || 'http://localhost:8080';
  const roles = loadJSON(ROLES_PATH);

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const base = new URL(baseURL);
  const port = Number(base.port) || (base.protocol === 'https:' ? 443 : 80);
  const host = base.hostname === 'localhost' ? '127.0.0.1' : base.hostname || '127.0.0.1';

  let serverInstance = null;
  const serverReady = await waitForServer(baseURL);
  if (!serverReady) {
    try {
      serverInstance = await startStaticServer(path.join(ROOT, 'docs'), port, host);
    } catch (err) {
      throw new Error(`Could not start local server on ${host}:${port}: ${err.message}. Start your dev server manually at ${baseURL} and retry.`);
    }
  }

  const inventory = [];
  const roleCounts = {};

  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.w, height: viewport.h },
      });

      try {
        for (const pagePath of pages) {
          const page = await context.newPage();
          const url = new URL(pagePath, baseURL).toString();
          await page.goto(url, { waitUntil: 'networkidle' });
          await preparePage(page);

          for (const [roleName, selectors] of Object.entries(roles)) {
            const samples = await collectRoleSamples(page, pagePath, viewport.name, roleName, selectors);
            inventory.push(...samples);
            roleCounts[roleName] = (roleCounts[roleName] || 0) + samples.length;
          }

          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }

  const sortedInventory = inventory.sort((a, b) => {
    if (a.page !== b.page) return a.page.localeCompare(b.page);
    if (a.viewport !== b.viewport) return a.viewport.localeCompare(b.viewport);
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    return a.selectorHint.localeCompare(b.selectorHint);
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sortedInventory, null, 2));

  console.log('Style inventory saved to artifacts/style-inventory.raw.json');
  console.log(`Pages visited: ${pages.join(', ')}`);
  console.log(`Viewports: ${viewports.map((v) => v.name).join(', ')}`);
  console.log('Samples per role:');
  for (const roleName of Object.keys(roles)) {
    const count = roleCounts[roleName] || 0;
    console.log(`  ${roleName}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
