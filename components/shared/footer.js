<!-- File: footer.html (surface-aware + horizontal Candid seal, no card) -->

<!-- Load Font Awesome Free for social icons -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<style>
  /*───────────────────────────────────────────────────────────*/
  /* Dex Surface-Aware Footer (matches board glass)            */

  :root{
    --space-3:   1rem;
    --space-4:   1.5rem;
    --radius-md: 0.5rem;
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
  .footer-social{ display:flex; align-items:center; gap:var(--space-3); }
  .footer-social:hover a:not(:hover):not(:focus-visible){ opacity:.72; }
  .footer-social a{
    position:relative;
    width:var(--badge-size); height:var(--badge-size);
    display:inline-flex; align-items:center; justify-content:center;
    border-radius:var(--dx-radius-md, 10px);
    border:1px solid rgba(255,255,255,.42);
    background:linear-gradient(120deg, rgba(221,230,240,.34) 0%, rgba(191,208,224,.25) 55%, rgba(232,210,203,.22) 100%);
    box-shadow:0 10px 22px rgba(18,22,30,.20), inset 0 1px 0 rgba(255,255,255,.30);
    color:#191b20;
    overflow:hidden;
    isolation:isolate;
    backdrop-filter:saturate(180%) blur(12px);
    -webkit-backdrop-filter:saturate(180%) blur(12px);
    transition:transform .24s cubic-bezier(.22,.8,.24,1), box-shadow .24s cubic-bezier(.22,.8,.24,1), opacity .24s cubic-bezier(.22,.8,.24,1), color .24s cubic-bezier(.22,.8,.24,1);
  }
  .footer-social a::before{
    content:"";
    position:absolute;
    inset:-44% -120%;
    background:linear-gradient(110deg, rgba(255,255,255,0) 35%, rgba(255,255,255,.56) 50%, rgba(255,255,255,0) 65%);
    transform:translateX(-130%) skewX(-18deg);
    opacity:0;
    pointer-events:none;
    z-index:0;
  }
  .footer-social a::after{
    content:"";
    position:absolute;
    inset:0;
    border-radius:inherit;
    pointer-events:none;
    opacity:0;
    z-index:2;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.72), 0 0 0 2px rgba(255,108,42,.52);
    transition:opacity .24s cubic-bezier(.22,.8,.24,1);
  }
  .footer-social a svg{
    width:1.52rem;
    height:1.52rem;
    fill:currentColor;
    position:relative;
    z-index:1;
    transition:transform .24s cubic-bezier(.22,.8,.24,1), opacity .24s cubic-bezier(.22,.8,.24,1);
  }
  .footer-social a:hover,
  .footer-social a:focus-visible{
    transform:translateY(-2px);
    box-shadow:0 14px 28px rgba(18,22,30,.26), inset 0 1px 0 rgba(255,255,255,.42);
    color:#101218;
  }
  .footer-social a:hover::before,
  .footer-social a:focus-visible::before{
    opacity:1;
    animation:dx-social-sheen 700ms cubic-bezier(.22,.8,.24,1) 1 both;
  }
  .footer-social a:hover::after,
  .footer-social a:focus-visible::after{ opacity:1; }
  .footer-social a:hover svg,
  .footer-social a:focus-visible svg{ transform:scale(1.08); }
  .footer-social a:active{ transform:translateY(0) scale(.98); }
  .footer-social a:focus{ outline:none; }

  @keyframes dx-social-sheen {
    from { transform:translateX(-130%) skewX(-18deg); }
    to { transform:translateX(130%) skewX(-18deg); }
  }

  @media (prefers-reduced-motion: reduce){
    .footer-social a,
    .footer-social a svg{
      transition:color .24s cubic-bezier(.22,.8,.24,1), opacity .24s cubic-bezier(.22,.8,.24,1);
    }
    .footer-social a:hover,
    .footer-social a:focus-visible,
    .footer-social a:active,
    .footer-social a:hover svg,
    .footer-social a:focus-visible svg{
      transform:none;
    }
    .footer-social a:hover::before,
    .footer-social a:focus-visible::before{
      opacity:0;
      animation:none;
    }
  }

  /* Nav */
  .footer-nav{ display:flex; gap:var(--space-3); font-size:.85rem; flex-wrap:wrap; justify-content:center; }
  .footer-nav a{ color:var(--dex-footer-text); text-decoration:none; transition:color var(--ease); white-space:nowrap; }
  .footer-nav a:hover{ color:var(--dex-accent); }

  /*──────── Surface control (choose one): data-surface or prefers-color-scheme ───────*/
  /* 1) Explicit (script sets this): data-surface="dark" | "light" */
  .dex-footer[data-surface="dark"]  { --dex-footer-text:#fff; }
  .dex-footer[data-surface="dark"]  .footer-logo .logo--dark { display:block; }
  .dex-footer[data-surface="light"] { --dex-footer-text:#000; }
  .dex-footer[data-surface="light"] .footer-logo .logo--light{ display:block; }

  /* 2) Fallback: if no data-surface, follow OS theme */
  @media (prefers-color-scheme: dark){
    .dex-footer:not([data-surface]){ --dex-footer-text:#fff; }
    .dex-footer:not([data-surface]) .footer-logo .logo--dark{ display:block; }
  }
  @media (prefers-color-scheme: light){
    .dex-footer:not([data-surface]){ --dex-footer-text:#000; }
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

<footer class="dex-footer" data-surface="light"><!-- script will set data-surface="dark|light" -->
  <div class="footer-grid">
    <!-- Logo (shows the right one based on surface) -->
    <div class="footer-logo-column">
      <div class="footer-logo">
        <!-- DARK surface → white logo -->
        <img class="logo--dark" src="https://static1.squarespace.com/static/63956a55e99f9772a8cd1742/t/68b0b7dd85ff8d50b39feaf0/1756411869678/dex_web_wordmark_white_transparent_72dpi.png" alt="Dex Footer Logo (white)" loading="lazy" decoding="async">
        <!-- LIGHT surface → black logo (update URL if needed) -->
        <img class="logo--light" src="https://static1.squarespace.com/static/63956a55e99f9772a8cd1742/t/68b3ad9db971dd68b77c9cc8/1756605853287/dex_web_wordmark_black_transparent_72dpi.png" alt="Dex Footer Logo (black)" loading="lazy" decoding="async">
      </div>
    </div>

    <!-- Two-line copyright attribution -->
    <div class="footer-attribution">
      © 2023–2026 DEX CO-OP CORP (EIN 92-3509152)<br>
      dba Dex Digital Sample Library. All rights reserved.
    </div>

    <!-- NEW: horizontal Candid (GuideStar) Transparency Seal -->
    <div class="footer-seal-column">
      <a class="candid-seal" href="https://app.candid.org/profile/15083758/dex-digital-sample-library-92-3509152" target="_blank" rel="noopener noreferrer" aria-label="View Dex Digital Sample Library's Candid (GuideStar) profile">
        <img src="https://widgets.guidestar.org/prod/v1/pdp/transparency-seal/15083758/svg" alt="Candid (GuideStar) Transparency Seal">
      </a>
    </div>

    <!-- Social badges + nav links -->
    <div class="footer-links-column">
      <div class="footer-social">
        <a href="https://www.youtube.com/dexdsl" aria-label="YouTube" class="youtube">
          <svg aria-hidden="true" viewBox="0 0 64 64"><use xlink:href="#youtube-unauth-icon"></use></svg>
        </a>
        <a href="https://instagram.com/dexdsl" aria-label="Instagram" class="instagram">
          <svg aria-hidden="true" viewBox="0 0 64 64"><use xlink:href="#instagram-unauth-icon"></use></svg>
        </a>
        <a href="https://www.tiktok.com/@dexdsl" aria-label="TikTok" class="tiktok">
          <svg aria-hidden="true" viewBox="0 0 64 64"><use xlink:href="#tiktok-unauth-icon"></use></svg>
        </a>
        <a href="https://twitter.com/dexdsl" aria-label="Twitter" class="twitter">
          <svg aria-hidden="true" viewBox="0 0 64 64"><use xlink:href="#twitter-unauth-icon"></use></svg>
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



