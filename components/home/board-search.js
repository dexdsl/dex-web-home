<!-- Dex /board PROMO — White-Opal, 4px radius, no filters, GSAP entrance -->
<section id="dex-board-promo" class="dex-board-promo" data-context="home" role="region" aria-labelledby="dex-board-promo-title">
  <a class="promo-surface" href="/board" aria-label="Go to Dex /board">
    <div class="promo-grid">

      <!-- 1) Narrative -->
      <header class="promo-head">
        <p class="eyebrow">Help steward Dex</p>
        <h2 id="dex-board-promo-title" class="headline">Founding Expansion Board</h2>
        <p class="kicker">Keep the library free, forever.</p>
      </header>

      <!-- 2) Value cues -->
      <ul class="value-list" aria-label="What you’ll impact">
        <li class="value">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l4 4 12-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span><b>Protect CC-BY</b> as a hard-lock</span>
        </li>
        <li class="value">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span><b>Shape releases</b> & commissions</span>
        </li>
        <li class="value">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span><b>Build the model</b> for open access</span>
        </li>
      </ul>

      <!-- 3) Proof row -->
      <div class="proof" aria-label="Proof points">
        <div class="chip">Directors</div>
        <div class="chip">Advisors</div>
        <div class="chip">Observers</div>
        <div class="dot" aria-hidden="true"></div>
        <div class="stat"><b>~30&nbsp;hours</b><small>catalog</small></div>
        <div class="sep" aria-hidden="true"></div>
        <div class="stat"><b>~12k</b><small>downloads</small></div>
      </div>

      <!-- 4) Timeline -->
      <div class="timeline" aria-label="Timeline">
        <div class="tl-item"><b>Soft deadline</b><span>Nov&nbsp;15,&nbsp;2025</span></div>
        <div class="tl-sep" aria-hidden="true"></div>
        <div class="tl-item"><b>Briefings</b><span>Dec ’25 – Jan ’26</span></div>
        <div class="tl-sep" aria-hidden="true"></div>
        <div class="tl-item"><b>Seating</b><span>Q1&nbsp;2026</span></div>
      </div>

      <!-- 5) CTA focus row -->
      <div class="cta-row">
        <div class="cta-primary">
          <span class="cta-label">Nominate or Apply</span>
          <svg class="cta-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span class="cta-aside">~6 hrs/mo · Remote OK · Builders, not gatekeepers</span>
      </div>

    </div>
  </a>
</section>

<style>
  /* ===== Scope & tokens ===== */
  #dex-board-promo{ --bg:rgba(255,255,255,.62); --ink:#111; --muted:#555; --ringA:#ff3b2f; --ringB:#ffb000; --ringC:#8a5cff; --ringD:#2fd6ff; --ang:24deg; }
  #dex-board-promo *{ box-sizing:border-box; }

  /* ===== Surface (white-opal, no filter) ===== */
  #dex-board-promo .promo-surface{
    display:block; width:100%; color:var(--ink); text-decoration:none;
    border-radius:65px;
    /* gradient ring + white fill (industry-standard pattern) */
    background:
      linear-gradient(0deg, var(--bg), var(--bg)) padding-box,
      conic-gradient(from var(--ang),
        var(--ringA), var(--ringB) 25%, var(--ringC) 55%, var(--ringD) 75%, var(--ringA) 100%
      ) border-box;
    border:1px solid transparent;
    /* quiet elevation that reads on #fff */
    box-shadow:
      0 1px 0 rgba(0,0,0,.06),
      0 12px 24px rgba(0,0,0,.06),
      0 2px 10px rgba(0,0,0,.04);
  }

  /* Minimal hover: no filter, no backdrop, no layout shifts */
  @media (hover:hover) and (pointer:fine){
    #dex-board-promo .promo-surface{
      transition: transform .16s cubic-bezier(.2,.7,.2,1), box-shadow .18s ease, background-position .2s linear;
    }
    #dex-board-promo .promo-surface:hover{
      transform: translateY(-1px);
      box-shadow:
        0 1px 0 rgba(0,0,0,.06),
        0 16px 36px rgba(0,0,0,.08),
        0 6px 16px rgba(0,0,0,.05);
    }
    #dex-board-promo .promo-surface:active{ transform: translateY(0); }
  }

  /* ===== Layout ===== */
  #dex-board-promo .promo-grid{
    display:grid; gap: clamp(12px,1.6vw,18px);
    padding: clamp(16px,2vw,24px);
    grid-template-columns: 1.1fr .9fr; /* narrative | cues */
    align-items:start;
  }
  @media (max-width: 900px){ #dex-board-promo .promo-grid{ grid-template-columns:1fr; } }

  /* ===== Type ===== */
  #dex-board-promo .eyebrow{
    font:700 11px/1.1 var(--font-heading, system-ui);
    letter-spacing:.13em; text-transform:uppercase; color:var(--muted); margin:0;
  }
  #dex-board-promo .headline{
    font:800 clamp(20px,2.2vw,24px)/1.1 var(--font-heading, system-ui); margin:4px 0 6px 0;
  }
  #dex-board-promo .kicker{
    font:400 clamp(13px,1.2vw,15px)/1.3 var(--font-body, system-ui); color:#333; margin:0;
  }

  /* ===== Value list ===== */
  #dex-board-promo .value-list{ list-style:none; margin:0; padding:0; display:grid; gap:8px; }
  #dex-board-promo .value{
    display:grid; grid-template-columns: 20px 1fr; gap:10px; align-items:start;
    font:400 clamp(13px,1.1vw,14px)/1.25 var(--font-body, system-ui); color:#222;
  }
  #dex-board-promo .value svg{ width:20px; height:20px; color:#111; opacity:.9; }
  #dex-board-promo .value b{ font-weight:700; color:#000; }

  /* ===== Proof row ===== */
  #dex-board-promo .proof{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  #dex-board-promo .chip{
    border:1px solid rgba(0,0,0,.12); border-radius:4px; padding:6px 8px;
    font:600 11px/1 var(--font-heading, system-ui); text-transform:uppercase; letter-spacing:.06em; color:#222; background:rgba(255,255,255,.65);
  }
  #dex-board-promo .dot{ width:4px; height:4px; border-radius:999px; background:rgba(0,0,0,.28); }
  #dex-board-promo .stat{ display:flex; flex-direction:column; min-width:max(120px, 18ch); }
  #dex-board-promo .stat b{ font:700 13px/1.1 var(--font-heading, system-ui); color:#111; }
  #dex-board-promo .stat small{ font:400 11px/1.2 var(--font-body, system-ui); color:#555; }

  /* ===== Timeline ===== */
  #dex-board-promo .timeline{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  #dex-board-promo .tl-item{ display:flex; gap:6px; align-items:baseline; color:#222; }
  #dex-board-promo .tl-item b{ font-weight:700; color:#000; }
  #dex-board-promo .tl-item span{ color:#444; }
  #dex-board-promo .tl-sep{ width:10px; height:1px; background:rgba(0,0,0,.18); }

  /* ===== CTA row ===== */
  #dex-board-promo .cta-row{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  #dex-board-promo .cta-primary{
    display:inline-flex; align-items:center; gap:10px;
    padding:10px 12px; border-radius:4px;
    background: #111; color:rgba(255,255,255,.62);
  }
  #dex-board-promo .cta-label{
    font:700 12px/1 var(--font-heading, system-ui);
    text-transform:uppercase; letter-spacing:.08em;
  }
  #dex-board-promo .cta-arrow{ width:18px; height:18px; color:#fff; }
  #dex-board-promo .cta-aside{ font:400 12px/1.25 var(--font-body, system-ui); color:#333; }

  /* ===== Motion prefs ===== */
  @media (prefers-reduced-motion: reduce){
    #dex-board-promo .promo-surface{ transition:none !important; }
  }
  #dex-board-promo .promo-surface{
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
          backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
}
/* Your promo surface */
#dex-board-promo .promo-surface{
  border: 1px solid transparent;                 /* keep your 1px outline */
  border-radius: 4px;

  /* glass center (see-through to blobs) */
  background: color-mix(in oklab, var(--bg) 70%, transparent 30%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
          backdrop-filter: blur(14px) saturate(140%);

  /* gradient lives ONLY in the border */
  border-image: conic-gradient(from var(--ang, 24deg),
                var(--ringA), var(--ringB), var(--ringC), var(--ringD), var(--ringA)) 1;
}
/* apply to the element that has the glass & the gradient border */
#dex-board-promo .promo-surface{
  overflow: hidden;                           /* forces the radius to clip all paints */
  /* OPTIONAL (Safari/WebKit quirk fix): */
  -webkit-mask-image: -webkit-linear-gradient(#fff,#fff);
}
/* host */
#dex-board-promo{
  position: relative;
  border-radius: 4px;
  overflow: visible;                 /* ← don't clip the ring */
  isolation: isolate;                /* clean stacking so ::before sits behind content */
}

/* GLASS (inside, clipped to radius) */
#dex-board-promo::before{
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
  /* glass */
  -webkit-backdrop-filter: blur(12px) saturate(140%);
          backdrop-filter: blur(12px) saturate(140%);
  background: color-mix(in oklab, #fff 8%, transparent);
  box-shadow: inset 0 1px rgba(255,255,255,.08);
  /* Safari quirk: ensure rounded blur respects corners */
  -webkit-mask-image: -webkit-radial-gradient(white, black);
}

/* RING (outside, not clipped) */
#dex-board-promo::after{
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 2;
  padding: 1px;                                   /* ring width */
  background: conic-gradient(
    from var(--ang,24deg),
    var(--ringA,#ff3b2f), var(--ringB,#ffb000),
    var(--ringC,#8a5cff), var(--ringD,#2fd6ff),
    var(--ringA,#ff3b2f)
  );
  /* show gradient only as an outline */
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}

/* keep your content above the glass layer */
#dex-board-promo > *{ position: relative; z-index: 1; }
/* De-dupe: remove gradient border from .promo-surface */
#dex-board-promo .promo-surface{
  border-image: none !important;   /* was conic-gradient … */
  border-color: transparent !important; /* keep layout without a visible border */
  background-clip: padding-box;    /* belt & suspenders: fill stays inside */
}
/* === Auto-resize vertical-centering shim (legacysite Code Block) === */
#dex-board-promo{ height:100% !important; }                                    /* fill the reserved wrapper height */
#dex-board-promo > .promo-surface{ min-height:100%; display:flex; align-items:center; } /* center the card vertically */
#dex-board-promo .promo-grid{ width:100%; }                                     /* keep width stable inside the flex box */

</style>

<script>
(function(){
  const root = document.getElementById('dex-board-promo');
  if(!root) return;
// Center inside the auto-resize wrapper when there's extra reserved height
(function(){
  const wrapper = root.closest('.dx-block-content') || root.parentElement; // wrapper that owns the reserved height
  const promo   = root.querySelector('.promo-surface');
  if (!wrapper || !promo || !('ResizeObserver' in window)) return;

  const apply = ()=>{
    const hW = wrapper.clientHeight;
    const hP = promo.offsetHeight;
    // If wrapper reserves more height than our card uses, center the card
    if (hW - hP > 2){
      wrapper.style.display = 'grid';
      wrapper.style.alignContent = 'center';     // vertical centering
    } else {
      // reset to avoid layout side effects when heights match
      wrapper.style.display = '';
      wrapper.style.alignContent = '';
    }
  };

  const ro = new ResizeObserver(apply);
  ro.observe(wrapper);
  ro.observe(promo);
  // run once on load too
  requestAnimationFrame(apply);
})();

  // Contextual copy per page
  const ctx = (root.getAttribute('data-context')||'home').toLowerCase();
  const copy = {
    home: {
      eyebrow:'Help steward Dex',
      headline:'Founding Expansion Board',
      kicker:'Keep the library free, forever.',
      values: [
        ['Protect CC-BY','as a hard-lock'],
        ['Shape releases','& commissions'],
        ['Build the model','for open access']
      ],
      aside:'~6 hrs/mo · Remote OK · Builders, not gatekeepers'
    },
    catalog: {
      eyebrow:'Love the catalog?',
      headline:'Help steward the library',
      kicker:'Directors & advisors · CC-BY first.',
      values: [
        ['Curate for reuse','and impact'],
        ['Grow community','and pathways'],
        ['Sustain the catalog','without paywalls']
      ],
      aside:'Uncompensated board service · Remote welcome'
    },
    about: {
      eyebrow:'Governance-minded?',
      headline:'Join our Founding Expansion Board',
      kicker:'Purpose over paywalls.',
      values: [
        ['Lock CC-BY','into bylaws'],
        ['Guide Season 3','releases'],
        ['Open gateways','for funding']
      ],
      aside:'Search/Governance intake · Conflict-clearance applies'
    }
  }[ctx];

  const $ = s => root.querySelector(s);
  if(copy){
    const [v1,v2,v3] = copy.values;
    $('.eyebrow').textContent = copy.eyebrow;
    $('.headline').textContent = copy.headline;
    $('.kicker').textContent  = copy.kicker;
    const nodes = root.querySelectorAll('.value span');
    if(nodes[0]) nodes[0].innerHTML = `<b>${v1[0]}</b> ${v1[1]}`;
    if(nodes[1]) nodes[1].innerHTML = `<b>${v2[0]}</b> ${v2[1]}`;
    if(nodes[2]) nodes[2].innerHTML = `<b>${v3[0]}</b> ${v3[1]}`;
    $('.cta-aside').textContent = copy.aside;
  }

  // Micro-entrance + one-time iridescent sweep (no hover animations)
  const run = ()=>{
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = root.querySelector('.promo-surface'); if(!card) return;

    // Start hidden
    const seq = [
      '.eyebrow','.headline','.kicker',
      '.value-list .value:nth-child(1)',
      '.value-list .value:nth-child(2)',
      '.value-list .value:nth-child(3)',
      '.proof','.timeline','.cta-row'
    ].map(sel => root.querySelector(sel)).filter(Boolean);
    seq.forEach(el=>{ el.style.opacity=0; el.style.transform='translateY(6px)'; });

    const io = new IntersectionObserver(es=>{
      if(!es[0].isIntersecting) return;
      if (window.gsap){
        gsap.to(seq, { opacity:1, y:0, duration:.22, ease:'power2.out', stagger:.05, clearProps:'transform' });
        // One-time border shimmer: rotate conic angle slightly then settle
        const proxy = { a: 24 };
        gsap.to(proxy, {
          a: 402, duration: 1.1, ease: 'power2.out',
          onUpdate(){ root.style.setProperty('--ang', proxy.a + 'deg'); },
          onComplete(){ root.style.setProperty('--ang', '36deg'); }
        });
      } else {
        seq.forEach(el=>{ el.style.opacity=1; el.style.transform='none'; });
      }
      io.disconnect();
    }, {threshold:.35});
    io.observe(card);
  };

  if (!window.gsap){
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
    s.defer = true; s.onload = run; document.head.appendChild(s);
  } else { run(); }
})();
</script>
