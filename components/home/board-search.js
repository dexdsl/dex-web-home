<!-- dexDRONES homepage promo -->
<section id="dex-board-promo" class="dex-board-promo" data-context="home" role="region" aria-labelledby="dex-board-promo-title">
  <div class="promo-surface">
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
        <div class="dot" aria-hidden="true"></div>
        <div class="stat"><b>~12,000</b><small>downloads</small></div>
        <div class="dot" aria-hidden="true"></div>
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
    --bg: rgba(255, 255, 255, 0.64);
    --ink: #11131a;
    --muted: #4b5163;
  }

  #dex-board-promo * { box-sizing: border-box; }

  #dex-board-promo .promo-surface {
    display: block;
    width: 100%;
    color: var(--ink);
    text-decoration: none;
    border: 1px solid rgba(17, 17, 17, 0.12);
    border-radius: 4px;
    background: color-mix(in oklab, var(--bg) 76%, transparent 24%);
    -webkit-backdrop-filter: blur(12px) saturate(135%);
    backdrop-filter: blur(12px) saturate(135%);
    box-shadow:
      0 1px 0 rgba(0, 0, 0, 0.06),
      0 12px 26px rgba(0, 0, 0, 0.08),
      0 4px 14px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    -webkit-mask-image: -webkit-radial-gradient(white, black);
  }

  @media (hover: hover) and (pointer: fine) {
    #dex-board-promo .promo-surface {
      transition: transform 0.16s cubic-bezier(.2,.7,.2,1), box-shadow 0.18s ease;
    }

    #dex-board-promo .promo-surface:hover {
      transform: translateY(-1px);
      box-shadow:
        0 1px 0 rgba(0, 0, 0, 0.06),
        0 16px 34px rgba(0, 0, 0, 0.1),
        0 7px 18px rgba(0, 0, 0, 0.06);
    }

    #dex-board-promo .promo-surface:active { transform: translateY(0); }
  }

  #dex-board-promo .promo-grid {
    display: grid;
    gap: clamp(12px, 1.6vw, 18px);
    padding: clamp(16px, 2vw, 24px);
    grid-template-columns: 1.1fr 0.9fr;
    align-items: start;
  }

  #dex-board-promo .promo-head { grid-column: 1; }
  #dex-board-promo .value-list { grid-column: 2; }
  #dex-board-promo .proof,
  #dex-board-promo .sponsor,
  #dex-board-promo .cta-row { grid-column: 1 / -1; }

  @media (max-width: 900px) {
    #dex-board-promo .promo-grid { grid-template-columns: 1fr; }
    #dex-board-promo .promo-head,
    #dex-board-promo .value-list,
    #dex-board-promo .proof,
    #dex-board-promo .sponsor,
    #dex-board-promo .cta-row { grid-column: auto; }
  }

  #dex-board-promo .eyebrow {
    margin: 0;
    font: 700 11px/1.1 var(--font-heading, system-ui);
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--muted);
  }

  #dex-board-promo .headline {
    margin: 4px 0 6px 0;
    font: 800 clamp(21px, 2.4vw, 28px)/1.12 var(--font-heading, system-ui);
  }

  #dex-board-promo .kicker {
    margin: 0;
    max-width: 60ch;
    font: 400 clamp(13px, 1.15vw, 15px)/1.34 var(--font-body, system-ui);
    color: #2f3442;
  }

  #dex-board-promo .value-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  #dex-board-promo .value {
    display: grid;
    grid-template-columns: 20px 1fr;
    gap: 10px;
    align-items: start;
    font: 400 clamp(13px, 1.1vw, 14px)/1.25 var(--font-body, system-ui);
    color: #242936;
  }

  #dex-board-promo .value svg {
    width: 20px;
    height: 20px;
    color: #11131a;
    opacity: 0.9;
  }

  #dex-board-promo .value b {
    font-weight: 700;
    color: #0f1117;
  }

  #dex-board-promo .proof {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  #dex-board-promo .stat {
    display: flex;
    flex-direction: column;
    min-width: max(120px, 17ch);
  }

  #dex-board-promo .stat b {
    font: 700 13px/1.1 var(--font-heading, system-ui);
    color: #11131a;
  }

  #dex-board-promo .stat small {
    font: 400 11px/1.2 var(--font-body, system-ui);
    color: #59607a;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  #dex-board-promo .dot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: rgba(17, 19, 26, 0.3);
  }

  #dex-board-promo .sponsor {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-height: 40px;
    padding: 8px 10px;
    border-radius: 4px;
    border: 1px solid rgba(17, 17, 17, 0.11);
    background: rgba(255, 255, 255, 0.44);
  }

  #dex-board-promo .sponsor-label {
    font: 700 10px/1.1 var(--font-heading, system-ui);
    letter-spacing: 0.12em;
    color: #4d5364;
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
    font: 700 13px/1.1 var(--font-heading, system-ui);
    color: #141824;
  }

  #dex-board-promo .cta-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding-top: 2px;
  }

  #dex-board-promo .cta-row .dx-button-element {
    text-decoration: none;
    letter-spacing: 0.06em;
  }

  @media (prefers-reduced-motion: reduce) {
    #dex-board-promo .promo-surface { transition: none !important; }
  }

  #dex-board-promo { height: 100% !important; }
  #dex-board-promo > .promo-surface { min-height: 100%; display: flex; align-items: center; }
  #dex-board-promo .promo-grid { width: 100%; }
</style>

<script>
(function() {
  const root = document.getElementById('dex-board-promo');
  if (!root || !('ResizeObserver' in window)) return;
  const wrapper = root.closest('.dx-block-content') || root.parentElement;
  const promo = root.querySelector('.promo-surface');
  if (!wrapper || !promo) return;

  const apply = () => {
    const hW = wrapper.clientHeight;
    const hP = promo.offsetHeight;
    if (hW - hP > 2) {
      wrapper.style.display = 'grid';
      wrapper.style.alignContent = 'center';
    } else {
      wrapper.style.display = '';
      wrapper.style.alignContent = '';
    }
  };

  const ro = new ResizeObserver(apply);
  ro.observe(wrapper);
  ro.observe(promo);
  requestAnimationFrame(apply);
})();
</script>
