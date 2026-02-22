<!-- File: footer.html (surface-aware + horizontal Candid seal, no card) -->

<!-- Load Font Awesome Free for social icons -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
/>

<style>
  /*───────────────────────────────────────────────────────────*/
  /* Dex Surface-Aware Footer (matches board glass)            */

  :root{
    --space-3:   1rem;
    --space-4:   1.5rem;
    --radius-md: 4px;
    --shadow-md: 0 8px 24px rgba(0,0,0,.12);
    --font-body: 'Courier New', monospace;
    --dex-accent:#ff1910;
    --ease:      .3s ease-out;

    --badge-size:   2.5rem;
    --badge-radius: 0.75rem;

    /* Glass tokens (same as board block) */
    --liquid-bg:     rgba(255,255,255,.18);
    --liquid-border: rgba(255,255,255,.35);

    /* Seal sizing */
    --seal-height: 4.5rem;

    /* Footer text color (set per-surface below) */
    --dex-footer-text: #fff;
  }

  /* Footer shell */
  .dex-footer{
    background: var(--liquid-bg);
    border: 1px solid var(--liquid-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: var(--space-4) var(--space-3);
    color: var(--dex-footer-text);
    font-family: var(--font-body);
  }

  .footer-grid{
    display:grid;
    grid-template-columns: auto 1fr auto auto; /* logo | attribution | seal | socials+nav */
    align-items:center;                        /* vertical centering */
    gap:var(--space-4);
  }

  /* Logo */
  .footer-logo-column{ justify-self:start; text-align:center; }
  .footer-logo{ display:grid; }
  .footer-logo img{ width:8rem; height:auto; display:none; margin:0; }

  /* Attribution */
  .footer-attribution{
    justify-self:center; text-align:center;
    font-size:.85rem; line-height:1.2;
  }

  /* Seal: its own column, image only (no card chrome) */
  .footer-seal-column{ justify-self:center; }
  .candid-seal{
  margin-right: calc(var(--space-4) + 5.5rem);
    display:inline-block;
    padding:0; background:none; border:0; box-shadow:none;
    line-height:0; text-decoration:none; transition:none;
  }
  .candid-seal img{ height:var(--seal-height); width:auto; display:block; }

  /* Links column */
  .footer-links-column{
    justify-self:end; align-self:stretch;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:var(--space-3);
  }

  /* Socials */
  .footer-social{ display:flex; gap:var(--space-3); }
  .footer-social a{
    width:var(--badge-size); height:var(--badge-size);
    display:inline-flex; align-items:center; justify-content:center;
    border-radius:var(--badge-radius);
    box-shadow:0 2px 6px rgba(0,0,0,.2);
    color:#fff; transition: transform var(--ease), background var(--ease);
  }
  .footer-social a:hover{ transform:scale(1.1); }
  .footer-social i{ font-size:1.25rem; }
  .footer-social a.youtube   { background:#FF0000; }
  .footer-social a.instagram { background: radial-gradient(circle at 30% 107%, #fdf497 0%,#fd5949 45%,#d6249f 60%,#285AEB 90%); }
  .footer-social a.tiktok    { background:#000; }
  .footer-social a.twitter   { background:#1DA1F2; }

  /* Nav */
  .footer-nav{ display:flex; gap:var(--space-3); font-size:.85rem; flex-wrap:wrap; justify-content:center; }
  .footer-nav a{ color:var(--dex-footer-text); text-decoration:none; transition:color var(--ease); white-space:nowrap; }
  .footer-nav a:hover{ color:var(--dex-accent); }

  /*──────── Surface control (choose one): data-surface or prefers-color-scheme ───────*/
  /* 1) Explicit (script sets this): data-surface="dark" | "light" */
  .dex-footer[data-surface="dark"]  { --dex-footer-text:#fff; }
  .dex-footer[data-surface="dark"]  .footer-logo .logo--dark { display:block; }
  .dex-footer[data-surface="light"] { --dex-footer-text:#fff; }
  .dex-footer[data-surface="light"] .footer-logo .logo--light{ display:block; }

  /* 2) Fallback: if no data-surface, follow OS theme */
  @media (prefers-color-scheme: dark){
    .dex-footer:not([data-surface]){ --dex-footer-text:#fff; }
    .dex-footer:not([data-surface]) .footer-logo .logo--dark{ display:block; }
  }
  @media (prefers-color-scheme: light){
    .dex-footer:not([data-surface]){ --dex-footer-text:#fff; }
    .dex-footer:not([data-surface]) .footer-logo .logo--light{ display:block; }
  }

  /* Responsive */
  @media (max-width:600px){
    .footer-grid{
      grid-template-columns:1fr;
      justify-items:center; width:100%;
      max-width: calc(100% - 2 * var(--space-3)); margin:0 auto; gap:var(--space-3);
    }
    .footer-logo-column, .footer-attribution, .footer-seal-column, .footer-links-column{
      justify-self:center; text-align:center;
    }
    .footer-links-column{ flex-direction:column; }
  }
  
</style>

<footer class="dex-footer"><!-- script will set data-surface="dark|light" -->
  <div class="footer-grid">
    <!-- Logo (shows the right one based on surface) -->
    <div class="footer-logo-column">
      <div class="footer-logo">
        <!-- DARK surface → white logo -->
        <img
          class="logo--dark"
          src="https://static1.legacysite.com/static/63956a55e99f9772a8cd1742/t/68b0b7dd85ff8d50b39feaf0/1756411869678/dex_web_wordmark_white_transparent_72dpi.png"
          alt="Dex Footer Logo (white)"
          loading="lazy" decoding="async">
        <!-- LIGHT surface → black logo (update URL if needed) -->
        <img
          class="logo--light"
          src="https://static1.legacysite.com/static/63956a55e99f9772a8cd1742/t/68b0b7dd85ff8d50b39feaf0/1756411869678/dex_web_wordmark_white_transparent_72dpi.png"
          alt="Dex Footer Logo (black)"
          loading="lazy" decoding="async">
      </div>
    </div>

    <!-- Two-line copyright attribution -->
    <div class="footer-attribution">
      © 2023–2025 DEX CO-OP CORP (EIN 92-3509152)<br>
      dba Dex Digital Sample Library. All rights reserved.
    </div>

    <!-- NEW: horizontal Candid (GuideStar) Transparency Seal -->
    <div class="footer-seal-column">
      <a
        class="candid-seal"
        href="https://app.candid.org/profile/15083758/dex-digital-sample-library-92-3509152"
        target="_blank" rel="noopener noreferrer"
        aria-label="View Dex Digital Sample Library's Candid (GuideStar) profile">
        <img
          src="https://widgets.guidestar.org/prod/v1/pdp/transparency-seal/15083758/svg"
          alt="Candid (GuideStar) Transparency Seal">
      </a>
    </div>

    <!-- Social badges + nav links -->
    <div class="footer-links-column">
      <div class="footer-social">
        <a href="https://www.youtube.com/dexdsl" aria-label="YouTube" class="youtube">
          <i class="fab fa-youtube"></i>
        </a>
        <a href="https://instagram.com/dexdsl" aria-label="Instagram" class="instagram">
          <i class="fab fa-instagram"></i>
        </a>
        <a href="https://www.tiktok.com/@dexdsl" aria-label="TikTok" class="tiktok">
          <i class="fab fa-tiktok"></i>
        </a>
        <a href="https://twitter.com/dexdsl" aria-label="Twitter" class="twitter">
          <i class="fab fa-twitter"></i>
        </a>
      </div>
      <nav class="footer-nav">
        <a href="/privacy">Privacy</a>
        <a href="/contact">Contact</a>
        <a href="/copyright">Copyright</a>
      </nav>
    </div>
  </div>
</footer>

<!-- Auto-detect page background and set data-surface="light|dark" -->
<script id="dex-footer-surface">
(() => {
  const clamp01 = n => Math.max(0, Math.min(1, n));
  const parseRGB = s => {
    if (!s) return { r:255, g:255, b:255, a:1 };
    if (s === 'transparent') return { r:0, g:0, b:0, a:0 };
    const m = s.match(/rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*(?:,\s*([0-9.]+)\s*)?\)/i);
    if (m) return { r:+m[1], g:+m[2], b:+m[3], a: m[4] == null ? 1 : +m[4] };
    return { r:255, g:255, b:255, a:1 };
  };
  const isTransparent = s => parseRGB(s).a < 0.01;
  const relLum = ({r,g,b}) => {
    const srgb = [r,g,b].map(v => clamp01(v/255));
    const lin = srgb.map(c => (c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)));
    return 0.2126*lin[0] + 0.7152*lin[1] + 0.0722*lin[2];
  };
  const median = arr => {
    const a = arr.slice().sort((x,y)=>x-y);
    const i = Math.floor(a.length/2);
    return a.length % 2 ? a[i] : (a[i-1] + a[i]) / 2;
  };
  const nearestBgColor = (el) => {
    let n = el;
    while (n) {
      const cs = getComputedStyle(n);
      const bg = cs.backgroundColor;
      if (bg && !isTransparent(bg)) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
  };
  const measureFooter = (footer) => {
    const rect = footer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const pts = [
      [rect.left + rect.width/2, rect.top + rect.height/2],
      [rect.left + 8,            rect.top + rect.height/2],
      [rect.right - 8,           rect.top + rect.height/2],
      [rect.left + rect.width/2, rect.top + 6],
      [rect.left + rect.width/2, rect.bottom - 6]
    ].map(([x,y]) => [
      Math.min(innerWidth  - 1, Math.max(0, x)),
      Math.min(innerHeight - 1, Math.max(0, y))
    ]);
    const prevPE = footer.style.pointerEvents;
    footer.style.pointerEvents = 'none';
    const lums = pts.map(([x,y]) => {
      const under = document.elementFromPoint(x,y) || document.body;
      const bg    = nearestBgColor(under);
      return relLum(parseRGB(bg));
    });
    footer.style.pointerEvents = prevPE;
    const L = median(lums);
    const surface = L >= 0.5 ? 'light' : 'dark';
    if (footer.getAttribute('data-surface') !== surface) {
      footer.setAttribute('data-surface', surface);
      footer.dataset.surfaceL = L.toFixed(3); // optional debug
    }
  };
  const footers = [...document.querySelectorAll('.dex-footer')];
  if (!footers.length) return;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) measureFooter(e.target);
  }, { threshold: 0.01 });
  footers.forEach(f => io.observe(f));
  const schedule = (() => {
    let raf = 0;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        footers.forEach(measureFooter);
        raf = 0;
      });
    };
  })();
  addEventListener('resize', schedule, { passive:true });
  addEventListener('orientationchange', schedule);
  addEventListener('load', schedule);
})();
</script>
