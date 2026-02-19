<!-- ────────────────────────────────────────────────────────────────
 Dex 2.0 ▸ FAQ + CTA Block  ⤷ single Squarespace Code Block
   (updated to match Board block visual language)
   Changes:
   • Header uses glassmorphic "card" styling (like accordion items)
   • CTA uses Squarespace primary button classes + ligature-friendly typography
   • Consistent 4px border-radius everywhere
────────────────────────────────────────────────────────────────── -->
<section id="dex-faq">
  <!-- HEAD -->
  <header class="hdr card-like">
    <h2 id="dex-faq-head" class="p1">FAQ</h2>
    <nav class="faq-cta">
      <a id="btn-catalog" href="/catalog" class="ghost" data-label="Explore Our Catalog">Explore Our Catalog</a>
      <!-- SQS primary button classes added; keep .cta for local styling -->
      <a id="btn-call" href="/call"
         class="cta sqs-button-element sqs-button-element--primary sqs-block-button-element sqs-block-button-element--primary"
         data-label="Submit Your Work">Submit Your Work</a>
    </nav>
  </header>

  <!-- BODY -->
  <main class="card">
    <div id="faq-accordion" class="spark-accordion" aria-label="Dex FAQ"></div>
  </main>

  <!-- STYLE (scoped) -->
  <style>
    /* ===== Base / tokens to mirror #dex-board ===== */
    #dex-faq, #dex-faq * { box-sizing: border-box; }
    #dex-faq{
      --pad: var(--space-3,14px);
      --liquid-bg:     rgba(255,255,255,.18);
      --liquid-border: rgba(255,255,255,.35);
      --dex-accent:    var(--dex-accent,#ff1910);
      color:#000;
      font-family: var(--font-body,'Courier New',monospace);
      width:100%;
      display:grid; gap: var(--space-2,8px);
    }

    /* Header layout matches Board, and now uses glass "card" styling */
    #dex-faq .hdr{
      margin:0;
      padding: var(--pad);
      display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
      border:1px solid var(--liquid-border);
      background: var(--liquid-bg);
      border-radius:4px;
      box-shadow: 0 1px 0 rgba(0,0,0,.02);
    }
    #dex-faq .p1{
      margin:0;
      font-family: var(--font-heading,'Typefesse',sans-serif);
      font-weight: 700;
      font-size: clamp(18px,3.2vw,28px);
      line-height:1.06;
      text-transform: uppercase;
      letter-spacing: 0;
      font-variant-ligatures: common-ligatures discretionary-ligatures contextual;
      font-feature-settings: "liga" 1, "dlig" 1, "calt" 1, "ss01" 1, "salt" 1, "rlig" 1;
      text-rendering: optimizeLegibility;
    }
    #dex-faq .faq-cta{
      display:inline-flex; gap:12px; flex-wrap:wrap;
    }
    @container (max-width: 520px){
      #dex-faq .hdr{ flex-direction:column; align-items:flex-start; }
      #dex-faq .faq-cta{ align-self:stretch; }
    }

    /* Card wrapper = same glass as Board panes */
    #dex-faq .card{
      margin:0;
      border:1px solid var(--liquid-border);
      background: var(--liquid-bg);
      border-radius: 4px;
      padding: var(--pad);
      display:grid; gap: var(--space-2,8px);
    }

    /* Buttons = Board’s .cta / .ghost
       NOTE: SQS primary classes are also targeted to ensure theme compliance.
       Ligatures require zero letter-spacing + font features enabled. */
    #dex-faq .cta,
    #dex-faq .sqs-button-element--primary,
    #dex-faq .sqs-block-button-element--primary{
      display:inline-flex; align-items:center; justify-content:center;
      padding:.52rem .85rem; border-radius:4px !important;
      border:1px solid rgba(0,0,0,.15);
      background:linear-gradient(130deg,var(--dex-accent,#ff1910),orange);
      color:#fff; text-decoration:none;
      font:800 clamp(11px,1vw,12px) var(--font-heading,'Typefesse',sans-serif);
      /* critical for ligatures: */
      letter-spacing: 0;
      font-kerning: normal;
      font-variant-ligatures: common-ligatures discretionary-ligatures contextual;
      font-feature-settings: "liga" 1, "dlig" 1, "calt" 1, "ss01" 1, "salt" 1, "rlig" 1;
      text-rendering: optimizeLegibility;
      text-transform: none; /* rTitle handles casing; avoids breaking dlig */
      box-shadow:0 0 0 1px rgba(255,255,255,.35) inset, 0 10px 30px rgba(255,0,80,.25);
      cursor:pointer;
    }
    #dex-faq .ghost{
      display:inline-flex; align-items:center; justify-content:center;
      padding:.52rem .85rem; border-radius:4px !important;
      border:1px solid var(--liquid-border);
      background:var(--liquid-bg);
      color:#000; text-decoration:none;
      font:700 clamp(11px,1vw,12px) var(--font-heading,system-ui);
      letter-spacing: 0;
      font-kerning: normal;
      font-variant-ligatures: common-ligatures discretionary-ligatures contextual;
      font-feature-settings: "liga" 1, "dlig" 1, "calt" 1, "ss01" 1, "salt" 1, "rlig" 1;
      text-rendering: optimizeLegibility;
      cursor:pointer;
    }
    @media (prefers-reduced-motion: no-preference){
      #dex-faq .cta,
      #dex-faq .ghost,
      #dex-faq .sqs-button-element--primary,
      #dex-faq .sqs-block-button-element--primary{
        transition: transform .16s cubic-bezier(.2,.7,.2,1), box-shadow .22s cubic-bezier(.2,.7,.2,1), background-color .22s cubic-bezier(.2,.7,.2,1), border-color .22s cubic-bezier(.2,.7,.2,1), filter .22s cubic-bezier(.2,.7,.2,1);
      }
      #dex-faq .cta:hover,
      #dex-faq .ghost:hover,
      #dex-faq .sqs-button-element--primary:hover,
      #dex-faq .sqs-block-button-element--primary:hover{ transform: translateY(-1px); }
      /* CTA glint */
      #dex-faq .cta,
      #dex-faq .sqs-button-element--primary,
      #dex-faq .sqs-block-button-element--primary{ position:relative; overflow:hidden; }
      #dex-faq .cta::after,
      #dex-faq .sqs-button-element--primary::after,
      #dex-faq .sqs-block-button-element--primary::after{
        content:""; position:absolute; inset:-2px;
        background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.75) 50%, transparent 70%);
        transform: translateX(-120%); pointer-events:none;
      }
      #dex-faq .cta:hover::after,
      #dex-faq .sqs-button-element--primary:hover::after,
      #dex-faq .sqs-block-button-element--primary:hover::after{ animation: dex-glint 1.1s cubic-bezier(.2,.7,.2,1); }
      @keyframes dex-glint{ to{ transform: translateX(120%); } }
    }

    /* Accordion = glass cards like Board facts/process lists */
    #dex-faq .spark-accordion{ display:grid; gap: var(--space-2,8px); }
    #dex-faq .spark-accordion__item{
      background: var(--liquid-bg);
      border: 1px solid var(--liquid-border);
      border-radius: 4px;
      box-shadow: 0 1px 0 rgba(0,0,0,.02);
      transition: transform .18s cubic-bezier(.2,.7,.2,1), box-shadow .22s cubic-bezier(.2,.7,.2,1);
      will-change: transform;
    }
    @media (hover:hover){
      #dex-faq .spark-accordion__item:hover{
        transform: translateY(-1px);
        box-shadow: 0 10px 28px rgba(0,0,0,.10);
      }
    }
    #dex-faq .spark-accordion__item > h4{ margin:0; }

    /* Questions: Courier, not bold; answers: readable body size */
    #dex-faq .spark-accordion__header{
      display:flex; align-items:center; width:100%;
      padding: 10px 12px;
      background: none; border: 0; cursor:pointer; text-align:left;
      color:#000; font-weight:400;
      font-family: var(--font-body,'Courier New',monospace);
      font-size: clamp(13px,1.2vw,15px);
      position:relative;
    }
    #dex-faq .spark-accordion__header::after{
      content:"+";
      font-family: var(--font-body,'Courier New',monospace);
      font-size: 18px;
      position:absolute; right:12px; top:50%; transform:translateY(-50%);
      transition: transform .2s ease;
    }
    #dex-faq .spark-accordion__header[aria-expanded="true"]{
      color: color-mix(in oklab, #000 60%, var(--dex-accent) 40%);
    }
    #dex-faq .spark-accordion__header[aria-expanded="true"]::after{ content:"−"; transform: translateY(-50%) rotate(180deg); }

    #dex-faq .spark-accordion__panel{
      padding: 6px 12px 12px;
      color:#000;
      font: clamp(13px,1.15vw,15px) var(--font-body,'Courier New',monospace);
      line-height:1.55;
      transition: max-height .28s ease, opacity .28s ease, padding .28s ease;
    }
    #dex-faq .spark-accordion__panel[hidden]{
      max-height:0; opacity:0; overflow:hidden; padding:0 12px;
    }

    /* Responsive tightening */
    @media (max-width: 720px){
   #dex-faq .card,
   #dex-faq .hdr{ margin:0; padding: var(--pad); }
      #dex-faq .faq-cta{ width:100%; }
      #dex-faq .faq-cta a{ flex: 1 1 auto; text-align:center; }
    }
  </style>

  <!-- SCRIPT (keeps your data + single-open behaviour; removes old hue/holo) -->
  <script>
  (() => {
    /* Reuse site randomizer if present (Board sets window.randomizeTitle) */
    const rTitle = window.randomizeTitle || (txt => (txt||'').toUpperCase());

    // Build headline (keep your playful two-line scheme, but Typefesse caps)
    const head = document.getElementById('dex-faq-head');
    if (head){
      head.innerHTML =
        rTitle('Frequently Asked') + '<br>' + rTitle('Questions');
    }

    // Label text (randomized like Board if available)
    // IMPORTANT: set textContent before measuring/painting so ligatures form.
    document.querySelectorAll('#dex-faq .faq-cta [data-label]').forEach(btn => {
      const label = rTitle(btn.dataset.label);
      btn.textContent = label;
      // If Squarespace injects inner spans later, ensure aria-label matches too:
      btn.setAttribute('aria-label', label);
    });

    // FAQ data (unchanged content)
    const FAQ = [
      { q:'What is Dex?',           a:'Dex is an open-access sample library powered by artists. Every asset is released under CC-BY 4.0 so you can use it commercially—as long as you credit the creator.' },
      { q:'Is everything really FRE\u200cE?', a:'Yes. No paywalls, no watermarks. We’re funded by donors and volunteers so the catalog stays open for everyone.' },
      { q:'How do I credit Dex?',   a:'Add “Samples courtesy of Dex Digital Sample Library (dexdsl.com) + Artist Name” in your liner notes, video description, or end credits.' },
      { q:'Can I contribute?',      a:'Absolutely. Click “Submit Your Work” above and we’ll walk you through the CC-BY 4.0 release and ingest specs.' },
      { q:'Do you accept video?',   a:'Yes. We encourage audiovisual loops, performance clips, and field recordings alongside pure audio.' }
    ];

    // Build accordion (raw q text preserved)
    const holder = document.getElementById('faq-accordion');
    FAQ.forEach(({q,a},i) => {
      holder.insertAdjacentHTML('beforeend', `
        <div class="spark-accordion__item">
          <h4>
            <button id="faq-h${i}" class="spark-accordion__header"
              aria-expanded="false" aria-controls="faq-p${i}" role="button">${q}</button>
          </h4>
          <div id="faq-p${i}" class="spark-accordion__panel" role="region" aria-labelledby="faq-h${i}" hidden>
            <p>${a}</p>
          </div>
        </div>
      `);
    });

    // Single-open logic (uses SparkAccordion if present; otherwise fallback)
    const closeOthers = (except) => {
      document.querySelectorAll('#dex-faq .spark-accordion__header').forEach(h => {
        if (h !== except){
          const p = document.getElementById(h.getAttribute('aria-controls'));
          h.setAttribute('aria-expanded','false');
          if (p) p.hidden = true;
        }
      });
    };

    if (window.SparkAccordion) {
      SparkAccordion.init({
        selector: '#faq-accordion',
        onToggle: ({header, panel, isOpen}) => {
          if (isOpen) closeOthers(header);
          header.setAttribute('aria-expanded', isOpen);
          panel.hidden = !isOpen;
        }
      });
    } else {
      holder.addEventListener('click', (e) => {
        const hdr = e.target.closest('.spark-accordion__header');
        if (!hdr) return;
        const pnl = document.getElementById(hdr.getAttribute('aria-controls'));
        const willOpen = hdr.getAttribute('aria-expanded') !== 'true';
        closeOthers(hdr);
        hdr.setAttribute('aria-expanded', willOpen);
        pnl.hidden = !willOpen;
      });
    }
  })();
  </script>
</section>
