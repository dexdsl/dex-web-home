import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const routes = [
  '/docs/entry/favorites/',
  '/docs/polls/',
  '/docs/entry/submit/',
  '/docs/entry/messages/',
  '/docs/entry/pressroom/',
  '/docs/entry/settings/',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }});

for (const route of routes) {
  await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const header = document.querySelector('.header-announcement-bar-wrapper');
    const footer = document.querySelector('.dex-footer');
    const ids = ['#dex-favorites','#dex-console','#dex-submit','#dex-msg','#dex-press','#dex-settings'];
    let root = null;
    for (const id of ids) {
      const el = document.querySelector(id);
      if (el) { root = el; break; }
    }
    const sidebar = root ? (root.querySelector(':scope > .dex-sidebar') || root) : null;
    const hRect = header?.getBoundingClientRect();
    const sRect = sidebar?.getBoundingClientRect();
    const fRect = footer?.getBoundingClientRect();
    return {
      path: location.pathname,
      hasRouteClass: document.body.classList.contains('dx-route-profile-protected'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      hasMesh: !!document.getElementById('gooey-mesh-wrapper'),
      rootId: root ? root.id : null,
      header: hRect ? { x: hRect.x, w: hRect.width, h: hRect.height } : null,
      sidebar: sRect ? { x: sRect.x, w: sRect.width, h: sRect.height } : null,
      footer: fRect ? { x: fRect.x, w: fRect.width, h: fRect.height } : null,
      scrollHeight: document.scrollingElement?.scrollHeight || null,
      innerHeight: window.innerHeight,
      canScrollToFooter: !!footer && (document.scrollingElement?.scrollHeight || 0) > window.innerHeight,
    };
  });
  console.log(JSON.stringify(info));
}

await browser.close();
