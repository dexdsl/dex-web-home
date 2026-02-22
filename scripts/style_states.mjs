import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const SANITIZE_CONFIG_PATH = path.join(ROOT, 'sanitize.config.json');
const PHASE2_CONFIG_PATH = path.join(ROOT, 'phase2.config.json');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts');
const OUTPUT_PATH = path.join(ARTIFACT_DIR, 'style-states.json');

const DEFAULT_CONFIG = {
  pages: ['/', '/favorites'],
  viewports: [
    { name: 'mobile', w: 390, h: 844 },
    { name: 'tablet', w: 834, h: 1112 },
    { name: 'desktop', w: 1440, h: 900 },
  ],
};

const CATEGORY_SELECTORS = {
  buttons: ['button', '.sqs-button-element', "a[href].buttonlike", "[role='button']"],
  links: ['a[href]'],
  inputs: ['input', 'textarea', 'select'],
};

const STYLE_FIELDS = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'outlineColor',
  'outlineWidth',
  'boxShadow',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'transform',
  'opacity',
];

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
  fs.writeFileSync(PHASE2_CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  return DEFAULT_CONFIG;
}

async function waitForServer(baseURL, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseURL, { method: 'HEAD' });
      if (res.ok || res.status === 404) return true;
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

async function preparePage(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
  await page.addStyleTag({
    content: `
      * { animation: none !important; transition: none !important; caret-color: auto !important; scroll-behavior: auto !important; }
      .dx-force-disabled { opacity: 0.5 !important; pointer-events: none !important; }
    `,
  });
  await page.evaluate(() => {
    const stop = (event) => {
      const target = event.target;
      const clickable = target && (target.closest('a[href]') || target.closest('button') || target.closest('[role=\"button\"]'));
      if (clickable) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((name) => {
      window.addEventListener(name, stop, true);
    });
  });
}

async function guardNavigation(element) {
  await element.evaluate((el) => {
    const state = {};
    if (el instanceof HTMLAnchorElement) {
      state.href = el.getAttribute('href');
      el.setAttribute('href', '#');
    }
    if (el instanceof HTMLButtonElement) {
      state.type = el.getAttribute('type');
      el.setAttribute('type', 'button');
    }
    if (el instanceof HTMLInputElement && el.type === 'submit') {
      state.inputType = el.getAttribute('type');
      el.setAttribute('type', 'button');
    }
    el.dataset.dxNavGuardState = JSON.stringify(state);
  });
}

async function restoreNavigation(element) {
  await element.evaluate((el) => {
    const stateText = el.dataset.dxNavGuardState;
    if (!stateText) return;
    const state = JSON.parse(stateText);
    if (state.href !== undefined) {
      if (state.href === null) el.removeAttribute('href');
      else el.setAttribute('href', state.href);
    }
    if (state.type !== undefined) {
      if (state.type === null) el.removeAttribute('type');
      else el.setAttribute('type', state.type);
    }
    if (state.inputType !== undefined) {
      if (state.inputType === null) el.removeAttribute('type');
      else el.setAttribute('type', state.inputType);
    }
    delete el.dataset.dxNavGuardState;
  });
}

async function findFirstVisible(page, selectors) {
  const handle = await page.evaluateHandle((sels) => {
    const isVisible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return rect.width * rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    for (const sel of sels) {
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const node of nodes) {
        if (isVisible(node)) {
          node.dataset.dxSelectorUsed = sel;
          return node;
        }
      }
    }
    return null;
  }, selectors);

  const element = handle.asElement();
  if (!element) {
    await handle.dispose();
    return null;
  }
  const selectorUsed = await page.evaluate((el) => el.dataset.dxSelectorUsed || '', element);
  return { element, selectorUsed };
}

async function captureStyles(handle) {
  return handle.evaluate(
    (el, fields) => {
      const styles = getComputedStyle(el);
      const result = {};
      for (const field of fields) {
        result[field] = styles[field];
      }
      const firstClass = (el.classList && el.classList[0]) || '';
      return {
        styles: result,
        meta: {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          firstClass,
        },
      };
    },
    STYLE_FIELDS,
  );
}

function buildSelectorHint(meta, category) {
  const tag = meta.tag || '';
  const id = meta.id ? `#${meta.id}` : '';
  const cls = meta.firstClass ? `.${meta.firstClass}` : '';
  return `${tag}${id}${cls} [category:${category}]`.trim();
}

function diff(base, target) {
  const delta = {};
  if (!base || !target) return delta;
  for (const key of Object.keys(base)) {
    if (target[key] !== base[key]) {
      delta[key] = target[key];
    }
  }
  return delta;
}

async function applyHoverAndCapture(page, element) {
  const box = await element.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await element.hover();
  }
  return captureStyles(element);
}

async function applyActiveAndCapture(page, element) {
  const box = await element.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
  } else {
    await element.hover();
    await page.mouse.down();
  }
  const captured = await captureStyles(element);
  await page.mouse.up();
  return captured;
}

async function captureDisabledState(page, element, category) {
  const disableable = await element.evaluate((el) => el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement);
  const alreadyDisabled = await element.evaluate((el) => el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true');

  if (disableable && !alreadyDisabled) {
    return null;
  }

  if (disableable && alreadyDisabled) {
    return captureStyles(element);
  }

  await element.evaluate((el) => el.classList.add('dx-force-disabled'));
  const captured = await captureStyles(element);
  await element.evaluate((el) => el.classList.remove('dx-force-disabled'));
  return captured;
}

async function main() {
  const config = loadConfig();
  const pages = Array.isArray(config.pages) && config.pages.length > 0 ? config.pages : DEFAULT_CONFIG.pages;
  const viewports = Array.isArray(config.viewports) && config.viewports.length > 0 ? config.viewports : DEFAULT_CONFIG.viewports;
  const baseURL = config.baseURL || process.env.PHASE2_BASE_URL || 'http://localhost:8080';

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

  const browser = await chromium.launch({ headless: true });
  const results = [];

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

          for (const [category, selectors] of Object.entries(CATEGORY_SELECTORS)) {
            const found = await findFirstVisible(page, selectors);
            if (!found) continue;

            const { element, selectorUsed } = found;
            await guardNavigation(element);

            try {
              const baseCapture = await captureStyles(element);
              const hoverCapture = await applyHoverAndCapture(page, element);
              await element.evaluate((el) => el.focus());
              const focusCapture = await captureStyles(element);
              const activeCapture = await applyActiveAndCapture(page, element);
              const disabledCapture = await captureDisabledState(page, element, category);

              results.push({
                page: pagePath,
                viewport: viewport.name,
                category,
                selectorUsed,
                selectorHint: buildSelectorHint(baseCapture.meta, category),
                stylesDefault: baseCapture.styles,
                stylesHover: hoverCapture.styles,
                stylesFocus: focusCapture.styles,
                stylesActive: activeCapture.styles,
                stylesDisabled: disabledCapture ? disabledCapture.styles : null,
                deltas: {
                  hover: diff(baseCapture.styles, hoverCapture.styles),
                  focus: diff(baseCapture.styles, focusCapture.styles),
                  active: diff(baseCapture.styles, activeCapture.styles),
                  disabled: disabledCapture ? diff(baseCapture.styles, disabledCapture.styles) : {},
                },
              });
            } finally {
              await restoreNavigation(element);
            }
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

  const sorted = results.sort((a, b) => {
    if (a.page !== b.page) return a.page.localeCompare(b.page);
    if (a.viewport !== b.viewport) return a.viewport.localeCompare(b.viewport);
    return a.category.localeCompare(b.category);
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2));

  console.log('Style states saved to artifacts/style-states.json');
  console.log(`Pages visited: ${pages.join(', ')}`);
  console.log(`Viewports: ${viewports.map((v) => v.name).join(', ')}`);
  console.log(`States captured: ${sorted.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
