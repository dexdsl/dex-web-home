(() => {
  if (window.__DEX_SIDEBAR_BOOTED__) return;
  window.__DEX_SIDEBAR_BOOTED__ = true;

  const parseJsonScript = (id) => {
    const node = document.getElementById(id);
    if (!node) return null;
    try {
      return JSON.parse(node.textContent || '{}');
    } catch (error) {
      console.error(`[dex-sidebar] invalid JSON in #${id}`, error);
      return null;
    }
  };

  const pin = (item) => {
    if (!item || !item.name) return '';
    const links = Array.isArray(item.links) ? item.links : [];
    if (!links.length) return `<span class="dex-pin-name">${item.name}</span>`;
    const rendered = links
      .filter((link) => link && link.href)
      .map((link) => `<a class="dex-pin-link" href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label || link.href}</a>`)
      .join(' · ');
    return `<span class="dex-pin-name">${item.name}</span><span class="dex-pin-links"> (${rendered})</span>`;
  };

  const render = () => {
    const globalConfig = parseJsonScript('dex-sidebar-config') || {};
    const manifest = parseJsonScript('dex-manifest') || {};
    const pageConfig = parseJsonScript('dex-sidebar-page-config') || window.dexSidebarPageConfig || {};
    const root = document.querySelector('[data-dex-sidebar-root]');
    if (!root) return;

    const credits = pageConfig.credits || {};
    const tags = (pageConfig.metadata && pageConfig.metadata.tags) || [];
    const buckets = Array.isArray(pageConfig.buckets) ? pageConfig.buckets.join(', ') : '';

    root.innerHTML = `
      <section class="dex-sidebar-runtime">
        <h3>${pageConfig.lookupNumber || ''}</h3>
        <p>${pageConfig.attributionSentence || ''}</p>
        <p>${pin((credits && credits.artist) || null)}</p>
        <p>${buckets}</p>
        <p>${tags.join(', ')}</p>
        <p>${Object.keys(manifest || {}).length ? 'Manifest loaded' : ''}</p>
        <p>${globalConfig.license && globalConfig.license.type ? globalConfig.license.type : ''}</p>
      </section>
    `;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
