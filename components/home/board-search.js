<!-- dexDRONES homepage promo -->
<section id="dex-board-promo" class="dex-board-promo" data-context="home" role="region" aria-labelledby="dex-board-promo-title">
  <div class="promo-surface" data-dx-hover-variant="magnetic">
    <div class="promo-grid">

      <header class="promo-head">
        <p class="eyebrow">DEXDRONES / INSTITUTIONAL LAUNCH</p>
        <h2 id="dex-board-promo-title" class="headline">Film-quality CC-BY 4.0 aerial assets for the public.</h2>
        <p class="kicker">Mojave Desert fieldwork begins April 2. Alaska applications are under review. Built with founding support from Kolari Vision.</p>
      </header>

      <ul class="value-list" aria-label="What dexDRONES delivers">
        <li class="value">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l4 4 12-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span><b>Open aerial library</b> for public reuse under CC-BY 4.0</span>
        </li>
        <li class="value">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span><b>Production-grade capture</b> in 4K visible light and full-spectrum IR</span>
        </li>
        <li class="value">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span><b>Reusable infrastructure</b> for filmmakers, educators, and developers</span>
        </li>
      </ul>

      <div class="proof" aria-label="Program proof points">
        <div class="stat"><b>30+ hours</b><small>catalog</small></div>
        <div class="stat"><b>~12,000</b><small>downloads</small></div>
        <div class="stat"><b>~500</b><small>monthly active users</small></div>
      </div>

      <div class="sponsor" aria-label="Founding support">
        <span class="sponsor-label">FOUNDING SUPPORT</span>
        <img src="/assets/img/1fd737f2e3d8eb049fcc.png" alt="Kolari Vision logo" loading="lazy" decoding="async">
        <span class="sponsor-name">Kolari Vision</span>
      </div>

      <div class="cta-row">
        <a href="/dexdrones/" class="dex-btn dx-button-element dx-button-element--primary dx-button-size--md" aria-label="Open dexDRONES">
          OPEN DEXDRONES <span class="arrow" aria-hidden="true">→</span>
        </a>
        <a href="/dexnotes/dexdrones-launch-announcement-2026-03-09/" class="dex-btn dx-button-element dx-button-element--secondary dx-button-size--md" aria-label="Read the announcement">
          READ THE ANNOUNCEMENT <span class="arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  </div>
</section>

<style>
  #dex-board-promo {
    --ink: rgba(16, 20, 28, 0.96);
    --muted: rgba(18, 24, 34, 0.7);
    --surface-bg: var(--dx-header-glass-bg, linear-gradient(120deg, rgba(221, 230, 240, 0.36) 0%, rgba(191, 208, 224, 0.26) 55%, rgba(232, 210, 203, 0.24) 100%));
    --surface-rim: var(--dx-header-glass-rim, rgba(255, 255, 255, 0.42));
    --surface-shadow: var(--dx-header-glass-shadow, 0 16px 36px rgba(18, 22, 30, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.32));
    --surface-backdrop: var(--dx-header-glass-backdrop, saturate(180%) blur(18px));
    --surface-radius: var(--dx-header-glass-radius, var(--dx-radius-md, 10px));
    --chip-bg: color-mix(in srgb, var(--surface-bg) 54%, rgba(255, 255, 255, 0.34));
    --chip-rim: color-mix(in srgb, var(--surface-rim) 78%, rgba(255, 255, 255, 0.2));
    --chip-shadow: 0 1px 0 rgba(255, 255, 255, 0.25) inset;
  }

  #dex-board-promo * { box-sizing: border-box; }

  #dex-board-promo .promo-surface {
    position: relative;
    isolation: isolate;
    display: block;
    width: 100%;
    color: var(--ink);
    text-decoration: none;
    border: 1px solid var(--surface-rim);
    border-radius: var(--surface-radius);
    background: var(--surface-bg);
    -webkit-backdrop-filter: var(--surface-backdrop);
    backdrop-filter: var(--surface-backdrop);
    box-shadow: var(--surface-shadow);
    overflow: hidden;
    will-change: transform;
  }

  #dex-board-promo .promo-surface::after {
    content: "";
    position: absolute;
    inset: -2px;
    z-index: 0;
    background: linear-gradient(120deg, transparent 30%, var(--dx-glass-highlight, rgba(255, 255, 255, 0.56)) 50%, transparent 70%);
    transform: translateX(-130%);
    pointer-events: none;
    opacity: 0;
  }

  @media (hover: hover) and (pointer: fine) {
    #dex-board-promo .promo-surface {
      transition:
        transform var(--dx-motion-dur-sm, 180ms) var(--dx-motion-ease-standard, cubic-bezier(.22, .8, .24, 1)),
        box-shadow var(--dx-motion-dur-sm, 180ms) var(--dx-motion-ease-standard, cubic-bezier(.22, .8, .24, 1));
    }

    #dex-board-promo .promo-surface:hover {
      transform: translateY(-1px) scale(var(--dx-motion-scale-hover, 1.015));
      box-shadow:
        0 18px 40px rgba(18, 22, 30, 0.26),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }

    #dex-board-promo .promo-surface:hover::after {
      opacity: 1;
      animation: dx-board-promo-sheen 1.1s cubic-bezier(.2, .7, .2, 1) both;
    }

    #dex-board-promo .promo-surface:active { transform: translateY(0); }
  }

  @keyframes dx-board-promo-sheen {
    to { transform: translateX(130%); }
  }

  #dex-board-promo .promo-grid {
    position: relative;
    z-index: 1;
    display: grid;
    gap: clamp(10px, 1.2vw, 14px);
    padding: clamp(16px, 1.7vw, 22px);
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    grid-template-areas:
      "head values"
      "proof proof"
      "sponsor cta";
    align-items: start;
  }

  #dex-board-promo .promo-head { grid-area: head; }
  #dex-board-promo .value-list { grid-area: values; align-content: start; }
  #dex-board-promo .proof { grid-area: proof; }
  #dex-board-promo .sponsor { grid-area: sponsor; justify-self: start; }
  #dex-board-promo .cta-row { grid-area: cta; justify-self: end; }

  @media (max-width: 900px) {
    #dex-board-promo .promo-grid {
      grid-template-columns: 1fr;
      grid-template-areas:
        "head"
        "proof"
        "values"
        "sponsor"
        "cta";
    }
    #dex-board-promo .promo-head,
    #dex-board-promo .value-list,
    #dex-board-promo .proof,
    #dex-board-promo .sponsor,
    #dex-board-promo .cta-row { grid-column: auto; }
    #dex-board-promo .cta-row { justify-self: start; justify-content: flex-start; }
  }

  #dex-board-promo .eyebrow {
    margin: 0;
    font: 700 11px/1.1 var(--font-body, "Courier Prime", monospace);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  #dex-board-promo .headline {
    margin: 6px 0 8px 0;
    font: 800 clamp(22px, 2.5vw, 30px)/1.08 var(--font-heading, "Stretch Pro", sans-serif);
    letter-spacing: 0;
    text-wrap: balance;
  }

  #dex-board-promo .kicker {
    margin: 0;
    max-width: 60ch;
    font: 400 clamp(13px, 1.12vw, 15px)/1.34 var(--font-body, "Courier Prime", monospace);
    color: rgba(20, 27, 38, 0.86);
  }

  #dex-board-promo .value-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 7px;
  }

  #dex-board-promo .value {
    display: grid;
    grid-template-columns: 20px 1fr;
    gap: 10px;
    align-items: start;
    padding: 9px 11px;
    border-radius: calc(var(--surface-radius) - 3px);
    border: 1px solid var(--chip-rim);
    background: var(--chip-bg);
    box-shadow: var(--chip-shadow);
    font: 400 clamp(13px, 1.08vw, 14px)/1.24 var(--font-body, "Courier Prime", monospace);
    color: rgba(24, 31, 44, 0.94);
  }

  #dex-board-promo .value svg {
    width: 20px;
    height: 20px;
    color: rgba(17, 23, 35, 0.88);
    opacity: 0.9;
  }

  #dex-board-promo .value b {
    font-weight: 700;
    color: rgba(14, 19, 29, 0.98);
  }

  #dex-board-promo .proof {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  #dex-board-promo .stat {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 10px 12px;
    border-radius: calc(var(--surface-radius) - 3px);
    border: 1px solid var(--chip-rim);
    background: var(--chip-bg);
    box-shadow: var(--chip-shadow);
  }

  #dex-board-promo .stat b {
    font: 700 13px/1.1 var(--font-heading, "Stretch Pro", sans-serif);
    color: rgba(15, 21, 32, 0.97);
  }

  #dex-board-promo .stat small {
    font: 400 11px/1.2 var(--font-body, "Courier Prime", monospace);
    color: rgba(53, 63, 84, 0.86);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  #dex-board-promo .dot {
    display: none;
  }

  #dex-board-promo .sponsor {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-height: 40px;
    padding: 8px 10px;
    border-radius: calc(var(--surface-radius) - 3px);
    border: 1px solid var(--chip-rim);
    background: var(--chip-bg);
    box-shadow: var(--chip-shadow);
  }

  #dex-board-promo .sponsor-label {
    font: 700 10px/1.1 var(--font-body, "Courier Prime", monospace);
    letter-spacing: 0.12em;
    color: rgba(58, 67, 88, 0.85);
    text-transform: uppercase;
  }

  #dex-board-promo .sponsor img {
    width: 30px;
    height: 30px;
    object-fit: contain;
    border-radius: 4px;
    background: #fff;
  }

  #dex-board-promo .sponsor-name {
    font: 700 13px/1.1 var(--font-heading, "Stretch Pro", sans-serif);
    color: rgba(16, 22, 34, 0.96);
  }

  #dex-board-promo .cta-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding-top: 0;
    align-self: center;
  }

  @media (max-width: 760px) {
    #dex-board-promo .proof {
      grid-template-columns: 1fr;
    }
  }

  #dex-board-promo .cta-row .dx-button-element {
    text-decoration: none;
    letter-spacing: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    #dex-board-promo .promo-surface { transition: none !important; }
  }

  body.homepage .page-section:has(#dex-board-promo),
  body.homepage .page-section:has(#dex-board-promo) .section-background,
  body.homepage .page-section:has(#dex-board-promo) .content-wrapper,
  body.homepage #block-ee939fa7ed636a261fd7 > .dx-block-content,
  body.homepage #block-ee939fa7ed636a261fd7 > .dx-block-content > .dx-code-container {
    background: transparent !important;
    box-shadow: none !important;
  }

  #dex-board-promo { height: auto !important; }
  #dex-board-promo > .promo-surface { min-height: 0 !important; display: block; }
  #dex-board-promo .promo-grid { width: 100%; }
</style>
