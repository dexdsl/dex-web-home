import { test, expect } from 'playwright/test';

test('settings runtime state', async ({ page }) => {
  await page.goto('/entry/settings/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => {
    const body = document.body;
    const footer = document.querySelector('.dex-footer') as HTMLElement | null;
    const root = document.querySelector('#dex-settings') as HTMLElement | null;
    const mem = document.querySelector('#dxMembershipV3Root') as HTMLElement | null;
    const footerStyle = footer ? getComputedStyle(footer) : null;
    const rootStyle = root ? getComputedStyle(root) : null;
    const memStyle = mem ? getComputedStyle(mem) : null;
    return {
      bodyClass: body.className,
      isProtected: body.classList.contains('dx-route-profile-protected'),
      isStandardChrome: body.classList.contains('dx-route-standard-chrome'),
      footerExists: !!footer,
      footerPortaled: !!document.querySelector('.dex-footer.dx-profile-footer-portaled'),
      footerPosition: footerStyle?.position || null,
      rootExists: !!root,
      rootHeight: rootStyle?.height || null,
      rootMaxHeight: rootStyle?.maxHeight || null,
      rootOverflow: rootStyle?.overflow || null,
      memExists: !!mem,
      memScrollableFlag: mem?.getAttribute('data-dx-membership-rail-scrollable') || null,
      memOverflowY: memStyle?.overflowY || null,
      viewportWidth: window.innerWidth,
    };
  });
  console.log(JSON.stringify(state));
  expect(state.rootExists).toBeTruthy();
});
