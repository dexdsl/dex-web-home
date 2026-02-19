<!-- File: featured-carousel.html -->

<style>
  /*───────────────────────────────────────────────────────────*/
  /* Glassmorphic Sidebar & Carousel Styles (from dex_css.css) */
  :root {
    --space-0_5: 0.125rem;
    --space-1:   0.25rem;
    --space-2:   0.5rem;
    --space-3:   1rem;
    --space-4:   1.5rem;
    --space-5:   2rem;
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
    --shadow-light: 0 4px 12px rgba(0,0,0,0.08);
    --shadow-md:    0 8px 24px rgba(0,0,0,0.12);
    --font-heading: 'Typefesse', sans-serif;
    --font-body:    'Courier New', monospace;
    --dex-bg:       rgba(255,255,255,0.15);
    --dex-text:     #fff;
    --dex-accent:   #ff1910;
    --ease:         0.3s ease-out;
  }

  .dex-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-5);
    background: var(--dex-bg);
    backdrop-filter: blur(12px);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    color: var(--dex-text);
    font-family: var(--font-body);
    height: 100%;
    box-sizing: border-box;
  }

  .dex-header {
    text-align: left;
    margin-bottom:0 !important;
  }

  .meta-badges {
  dislay: flex;
  gap: var(--sace-1);
  flex-wrap: nowrap;
  overflow: hidden;
  justify-content: flex-start !important;
  }
  .dex-header h2 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: clamp(1.5rem,4vw,2rem);
    text-transform: uppercase;
  }
.carousel-card {
padding-bottom: 0 !important;
}
.carousel-card .lead-text {
margin-bottom: 0 !important;
}
.carousel-indicators {
margin-bottom: 0 !important;
justify-content: center !important;
padding-bottom: 0 !important;
}
.carousel-card .carousel-title {
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
font-size: clamp(.5rem, 4vw, 1.3rem) !important;
width: 100% !important;
}
#dexCombined a#heroExplore:hover, #dexCombined a#heroSignup:hover, #dexCombined a#heroExplore:focus, #dexCombined a#heroSignup:focus {
text-decoration: none !important;
border-bottom: none !important;
}

  .dex-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /*───────────────────────────────────────────────────────────*/
  /* Carousel Layout & Glassmorphic Card (from dex_catalog.css) */
  .carousel-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: center;
    height: 100%;
  }
  .carousel-frame {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .carousel-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: #232323;
    border: 1.2px solid rgba(0,0,0,0.15);
    border-radius: 50%;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #232323;
    z-index: 2;
  }
  .carousel-nav.prev { left: calc(-2.86rem - var(--space-3));background: rgba(0,0,0,0.25) }  /* pinned to middle card :contentReference[oaicite:4]{index=4} */
  .carousel-nav.next { right: calc(-2.86rem - var(--space-3)); background: rgba(0,0,0,0.25) }

.carousel-nav.prev:hover, .carousel-nav.next:hover {background: rgba(0,0,0,0.5); transition: opacity 0.2s ease-in-out !important;}
  .carousel-indicators {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }
  .dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: rgba(0,0,0,0.3);
    cursor: pointer;
    transition: background var(--ease);
  }
  .dot.active { background: #232323; }  /* selected indicator white :contentReference[oaicite:5]{index=5} */

  .carousel-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto auto auto;
    gap: var(--space-3);
    background: rgba(0,0,0,0.6);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(8px) saturate(180%) contrast(1.1) brightness(1.06);
    width: 100%;
    max-width: 80rem;
  }
  .carousel-title {
    grid-column: 1 / -1;
    margin: 0;
    font-family: var(--font-heading);
    font-size: 1.5rem;
    text-transform: uppercase;
    text-align: left;
    color: #fff;
  }
  .meta-badges {
    grid-column: 1 / -1;
    display: flex;
    gap: var(--space-1);
    justify-content: center;
  }
  .badge {
    background: rgba(255,255,255,0.2);
    padding: var(--space-0_5) var(--space-1);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    color: #fff;
  }
  .carousel-video {
    grid-column: 1 / -1;
    width: 100%;
    aspect-ratio: 16/9;
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .carousel-video iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
  .lead-text {
    grid-column: 1 / -1;
    margin: 0;
    color: #fff;
    font-family: var(--font-body);
  }
  .cta-btn {
    grid-column: 1 / -1;
    padding: var(--space-2) var(--space-3);
    background: linear-gradient(130deg,#ff1910 0%,orange 100%);
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-heading);
    text-transform: uppercase;
    color: #fff;
    cursor: pointer;
    width: 100%;  /* match iframe width :contentReference[oaicite:6]{index=6} */
    justify-self: center;
  }
</style>



<!--───────────────────────────────────────────────────────────────
DEX 2.0 • HERO + FEATURED ENTRIES (one Code Block, two equal-height columns)
(Hero CTAs inline randomizeTitle; featured heading inline randomizeTitle; hero title typing + native caret;
carousel card titles are links instead of CTA buttons)
──────────────────────────────────────────────────────────────────-->

<!-- 1) Duplicate-letter randomizer (verbatim) + hero word bank setup -->
<script>
function randomizeTitle(txt){
  const U=(txt||'').toUpperCase();
  const r=Math.random(),count=r<0.4?0:r<0.8?1:2;
  if(!count) return U;
  const excluded=new Set("–L:TIAWMKX&VYH?!@#$%-1234567890".split(''));
  const letters=[...U].map((c,i)=>({c,i}))
                     .filter(o=>/\S/.test(o.c)&&!excluded.has(o.c));
  if(!letters.length) return U;
  const{i}=letters[Math.floor(Math.random()*letters.length)];
  return U.slice(0,i+1)+U[i].repeat(count)+U.slice(i+1);
}

const heroBank = [
  "WEIRD\nNOISEEE.","OD‎D\nSOUNNDS.","NOISE\nMAKERS.",
  "ARTISTSS.","CREATIVEES.","PERFORMERS.",
  "COMPOSSERS.","MUUSICIANS.","STRANGEEE.", "STRANGE\nSOUNDDDS.",
  "EC‎CENTRICS.","YOUUU.","AL‎LLL.",
  "EVERYOONE.","%*!?%","!!!","???","***"
];

document.addEventListener('DOMContentLoaded', function(){
  const pick = heroBank[Math.floor(Math.random()*heroBank.length)];
  const target = document.getElementById('heroWord');
  let i = 0;

  // mark as "in‐typing" up front:
  target.classList.add('typing-complete');
  target.focus();

  function typeNext(){
    if(i <= pick.length){
      target.textContent = pick.slice(0,i);
      // place native caret at end
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      i++;
      setTimeout(typeNext, 100);
    } else {
      // done typing → remove the class so opacity returns to 1
      target.classList.remove('typing-complete');
    }
  }

  typeNext();
});
</script>

<div id="dexCombined" style="
  display:flex;
  gap:1.75rem;
  width:100%;
  height:100%;
  margin:0;
  padding:0;
  box-sizing:border-box;
">

  <!-- HERO COLUMN -->
  
  <div id="dexHeroSide" style="
    flex:1 1 0;
    margin:0;
    padding:0;
    display:flex;
    flex-direction:column;
    height:100%;
    box-sizing:border-box;
  ">
    <div id="dexHeroCard" style="
      flex:1 1 auto;
      display:flex;
      flex-direction:column;
      justify-content:flex-start;
      gap:1.25rem;
      width:100%;
      padding:clamp(2rem,5vw,3rem);
      box-sizing:border-box;
    ">
      <!-- HERO HEADING with typing span & native caret -->
      <h1 style="
        margin:0;
        font:700 clamp(2rem,5vw,3rem)/1.15 var(--font-heading,sans-serif);
        text-transform:uppercase;
      ">
        THE OPEN-AC&zwnj;CES&zwnj;S<br>
        RECORDING LIBRARY FOR<br>
        <span
          id="heroWord"
          contenteditable="true"
          spellcheck="false"
          style="
            background:linear-gradient(135deg,#ff3c3c 0%,#ff9d32 100%);
            -webkit-background-clip:text;
            color:transparent;
            display:inline-block;
            outline:none;
            white-space:pre-line;
            caret-color:#ff9d32;
            backdrop-filter:blur(4px);
          "
        ></span>
      </h1>
      <p style="
        margin:0;
        font:1.25rem/1.45 var(--font-body,sans-serif);
        opacity:.85;
      ">
        dexFest 2024 recordings releasing all month — free & CC-BY.
      </p>
      <div style="display:flex;flex-direction:column;gap:1rem;margin-top:1.5rem;">
        <a id="heroExplore"
   href="/catalog"
   class="sqs-button-element--primary sqs-block-button-element--large"
   style="display:inline-flex;align-items:center;justify-content:center;padding:.75em 1.6em;">
  <script>document.write(randomizeTitle("EXPLORE CATALOG"))</script>
</a>

<div class="product-block">
  <div class="productDetails center">
    <button class="cta-btn join-button sqs-button-element--secondary sqs-block-button-element--large"
      onclick="UserAccountApi.joinPricingPlan(
        'ee53ec15-15ad-4405-b664-143d74f2c75c','', '', false,
        'MEMBER_AREA_BLOCK',
        {&quot;pricingPlanId&quot;:&quot;ee53ec15-15ad-4405-b664-143d74f2c75c&quot;,
         &quot;showJoinButton&quot;:true,
         &quot;joinButtonText&quot;:&quot;SIGN UP FREE →&quot;,
         &quot;pricingType&quot;:&quot;FREE&quot;})">
      <div class="sqs-add-to-cart-button-inner">
        SIGN&nbsp;UP&nbsp;FREE&nbsp;→
      </div>
    </button>
  </div>
</div>


      </div>
    </div>
  </div>

  <!-- FEATURED ENTRIES COLUMN -->
  <div id="dexFeaturedSide" style="
    flex:1 1 0;
    margin:0;
    padding:0;
    display:flex;
    flex-direction:column;
    height:100%;
    box-sizing:border-box;
  ">
    <aside class="dex-sidebar" style="
      flex:1 1 auto;
      display:flex;
      flex-direction:column;
      gap:var(--space-3,1rem);
      padding:var(--space-5,2rem);
      background:var(--dex-bg,rgba(0,0,0,0.15));
      backdrop-filter:blur(12px);
      border-radius:4px;
      box-shadow:var(--shadow-md,0 8px 24px rgba(0,0,0,0.12));
      color:#111;
      font-family:var(--font-body,'Courier New',monospace);
      box-sizing:border-box;
      min-height:0;
    ">
      <section class="dex-header" style="text-align:left;margin:0 0 var(--space-2,0.5rem);">
        <h2 id="featuredTitle" style="
          margin:0;
          font:700 clamp(1.5rem,4vw,2rem)/1.2 var(--font-heading,'Typefesse',sans-serif);
          text-transform:uppercase;
          color:inherit;
        "><script>document.write(randomizeTitle("FEATURED ENTRIES"))</script></h2>
      </section>
      <div class="dex-body" style="
        flex:1 1 auto;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        gap:var(--space-3,1rem);
        overflow:visible;
        min-height:0;
      ">
        <div id="carousel-frame" class="carousel-frame" style="
          flex:1 1 auto;
          min-height:0;
          position:relative;
          width:100%;
          display:flex;
          align-items:flex-end;
          justify-content:flex-start;
          overflow:visible;
        "></div>
        <div id="carousel-indicators" class="carousel-indicators" style="
          display:flex;
          gap:var(--space-2,0.5rem);
          justify-content:center;
          margin-top:var(--space-2,0.5rem);
        "></div>
      </div>
    </aside>
  </div>
</div>

<style>

.sqs-block-code > .sqs-block-content {
  margin:0!important;
  padding:0!important;
  display:flex!important;
  flex-direction:column!important;
  height:100%!important;
}
.sqs-block-code + .sqs-block-overlay {
  display:none!important;
}
/* base state: fully opaque */
#heroWord {
  opacity: 1;
  transition: opacity 0.2s ease-in-out;
}
/* hero primary: remove any theme hover overlay */
#heroExplore.sqs-button-element--primary,
#heroExplore.sqs-button-element--primary:hover{
  filter: none !important;
}
#heroExplore.sqs-button-element--primary:hover::before{
  content: none !important;      /* kill transparent overlay */
}

/* while typing: slightly faded */
#heroWord.typing-complete {
  opacity: 0.75;
}

/* on hover at any time: slightly faded */
#heroWord:not(.typing-complete):hover,
#heroWord.typing-complete:hover {
  opacity: 0.75;
}


  /* carousel nav buttons */

.carousel-nav {
  position:absolute;
  top:50%;
  transform:translateY(-50%);
  background:rgba(0,0,0,0.4);
  border-radius:50%;
  width:3rem;
  height:3rem;
  cursor:pointer;
  z-index:2;
}
.carousel-nav.prev { left:calc(-3rem - var(--space-3,1rem)); }
.carousel-nav.next { right:calc(-3rem - var(--space-3,1rem)); }
.dot {
  width:.75rem;
  height:.75rem;
  border-radius:50%;
  background:rgba(0,0,0,.3);
  cursor:pointer;
  transition:background var(--ease,.3s);
}
.dot.active { background:#232323; }
.carousel-card {
  display:grid;
  grid-template-columns:1fr 1fr;
  grid-template-rows:auto auto auto auto;
  gap:var(--space-3,1rem);
  background:rgba(0,0,0,0.6);
  border:1px solid rgba(0,0,0,0.2);
  border-radius:4px;
  padding:var(--space-4,1.5rem);
  box-shadow:var(--shadow-md,0 8px 24px rgba(0,0,0,0.12));
  backdrop-filter:blur(8px) saturate(180%) contrast(1.1) brightness(1.06);
  width:100%;
  max-width:none;
  box-sizing:border-box;
}

.meta-badges { display:flex;gap:var(--space-1,0.5rem);flex-wrap:nowrap;overflow:hidden;justify-content:flex-start; }
.meta-badges .badge { white-space:nowrap; }
.carousel-title { margin:0;font:1rem var(--font-heading,'Typefesse',sans-serif);text-transform:none; }
.carousel-title a { color:inherit!important;text-decoration:none!important;transition:filter .25s; }
.carousel-title a:hover { filter:brightness(1.12)!important; }
.carousel-card, .dex-sidebar { -webkit-backdrop-filter:none!important; backdrop-filter:none!important; }
/* Ensure Safari paints the YouTube iframe correctly */
#dexCombined .carousel-video{
  grid-column: 1 / -1;      /* span both columns */
  width: 100%;
  aspect-ratio: 16 / 9;     /* works in Safari 15+ */
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}
#dexCombined .carousel-video iframe{
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
#dexCombined .carousel-video{ will-change: transform; transform: translateZ(0); }

</style>

<script id="featured-manifest" type="application/json">
[
  {"lookup":"W.Pob. Ma AV2024 S2","artist":"Sky Macklay","instrument":"Prepared Oboe","season":"Season 2","tags":["dexFest"],"leadIn":"","video":"https://www.youtube.com/watch?v=LPHD-ynh-MA","url":"/entry/prepared-oboe-sky-macklay","thumbnail":"","date":"2024-04-16"},
  {"lookup":"S.Pdb. He AV2024 S2","artist":"Jakob Heinemann: Splinterings","instrument":"Prepared Double Bass & Electronics","season":"Season 2","tags":["dexFest"],"leadIn":"","video":"https://www.youtube.com/watch?v=8sia2JYhwvI","url":"/entry/jakob-heinemann","thumbnail":"","date":"2024-10-10"},
  {"lookup":"E.Mod. Zh AV2024 S2","artist":"Bojun Zhang","instrument":"Modular Synth","season":"Season 2","tags":["dexFest"],"leadIn":"","video":"https://www.youtube.com/watch?v=qNuxhAKCekg","url":"/entry/bojun-zhang","thumbnail":"","date":"2024-10-10"},
  {"lookup":"X.Tlv. Pl AV2024 S1","artist":"Sam Pluta","instrument":"Feedback Televisions","season":"Season 2","tags":["dexFest"],"leadIn":"","video":"https://www.youtube.com/watch?v=tPOTWpo4bWY&t=15s","url":"/entry/amplified-tv-sam-pluta","thumbnail":"","date":"2024-10-10"}
]
</script>

<script>
document.addEventListener('DOMContentLoaded',function(){
  const items=JSON.parse(document.getElementById('featured-manifest').textContent)
                .filter(i=>i.tags.includes('dexFest')).slice(0,4);
  let idx=0,
      frame=document.getElementById('carousel-frame'),
      dots=document.getElementById('carousel-indicators');

  function getYouTubeId(url){
    try{const u=new URL(url);
      return u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||'';}
    catch{return'';}
  }
  const toEmbed = u => {
  const x = new URL(u);
  const id = x.hostname==='youtu.be' ? x.pathname.slice(1) : x.searchParams.get('v');
  const t  = (()=>{ const z=x.searchParams.get('t')||x.searchParams.get('start'); if(!z) return 0; if(/^\d+$/.test(z)) return +z; const m=z.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/); return (+(m?.[1]||0))*3600+(+(m?.[2]||0))*60+(+(m?.[3]||0)); })();
  return `https://www.youtube.com/embed/${id}?rel=0&playsinline=1${t?`&start=${t}`:''}`;
};

function parseStartParam(u){
  try{
    const url = new URL(u);
    const t = url.searchParams.get('t') || url.searchParams.get('start');
    if(!t) return 0;
    if(/^\d+$/.test(t)) return +t; // "90"
    const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/); // "1m30s"
    return (+(m?.[1]||0))*3600 + (+(m?.[2]||0))*60 + (+(m?.[3]||0));
  } catch { return 0; }
}
// --- tiny speed boost (optional) ---
(function preconnectYT(){
  const head = document.head || document.getElementsByTagName('head')[0];
  ['https://www.youtube-nocookie.com','https://www.youtube.com','https://i.ytimg.com','https://s.ytimg.com']
    .forEach(h=>{
      const l = document.createElement('link');
      l.rel = 'preconnect'; l.href = h; l.crossOrigin = 'anonymous';
      head && head.appendChild(l);
    });
})();

// keep your getYouTubeId() as you already have it

function parseStartParam(u){
  try{
    const url = new URL(u);
    const t = url.searchParams.get('t') || url.searchParams.get('start');
    if(!t) return 0;
    if(/^\d+$/.test(t)) return +t;
    const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    return (+(m?.[1]||0))*3600 + (+(m?.[2]||0))*60 + (+(m?.[3]||0));
  } catch { return 0; }
}

// Load YT IFrame API once
let __ytReady;
function loadYT(){
  if (__ytReady) return __ytReady;
  __ytReady = new Promise((resolve)=>{
    if (window.YT && window.YT.Player) return resolve();
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function(){
      try{ if (typeof prev === 'function') prev(); }catch(e){}
      resolve();
    };
  });
  return __ytReady;
}

  function render(){
    frame.innerHTML=''; dots.innerHTML='';

    const prev=document.createElement('button');
    prev.className='carousel-nav prev';
    prev.setAttribute('aria-label','Previous');
    prev.onclick=()=>{ idx=(idx+items.length-1)%items.length; render(); };
    frame.appendChild(prev);

    const it=items[idx],
          card=document.createElement('div');
    card.className='carousel-card';

    const h1=document.createElement('h1');
    h1.className='carousel-title';
    const a=document.createElement('a');
    a.href=it.url;
    a.textContent=randomizeTitle(`${it.artist} – ${it.instrument}`);
    h1.appendChild(a);
    card.appendChild(h1);

    const mb=document.createElement('div');
    mb.className='meta-badges';
    [it.lookup,it.instrument,it.season].forEach(v=>{
      if(v){
        const b=document.createElement('span');
        b.className='badge'; b.textContent=v; mb.appendChild(b);
      }
    });
    card.appendChild(mb);

    const vw = document.createElement('div');
vw.className = 'carousel-video';
// SAFARI: force a real box + isolate from ancestor filters
vw.style.position = 'relative';
vw.style.width = '100%';
vw.style.aspectRatio = '16 / 9';
vw.style.background = '#000';
vw.style.borderRadius = '4px';
vw.style.overflow = 'hidden';
vw.style.isolation = 'isolate';

const ifr = document.createElement('iframe');
const s   = parseStartParam(it.video);

// Use nocookie + origin + inline playback (Safari 18.x friendly)
ifr.src = `https://www.youtube-nocookie.com/embed/${getYouTubeId(it.video)}?rel=0&modestbranding=1&playsinline=1${s?`&start=${s}`:''}&origin=${encodeURIComponent(location.origin)}`;

// Fill the box, force its own layer (prevents blanking)
ifr.style.position = 'absolute';
ifr.style.inset = '0';
ifr.style.width = '100%';
ifr.style.height = '100%';
ifr.style.border = '0';
ifr.style.transform = 'translateZ(0)';
ifr.style.webkitTransform = 'translateZ(0)';

// Minimal, permissive attrs
ifr.setAttribute('playsinline','');
ifr.setAttribute('allowfullscreen','');
ifr.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');

// Drop referrerpolicy + lazy for Safari quirks
ifr.removeAttribute('referrerpolicy');
ifr.removeAttribute('loading');

vw.appendChild(ifr);
card.appendChild(vw);

// Belt-and-suspenders: neutralize any residual filter on this card only
card.style.filter = 'none';
card.style.webkitBackdropFilter = 'none';





    const p=document.createElement('p'); p.className='lead-text';
    p.textContent=it.leadIn; card.appendChild(p);

    frame.appendChild(card);

    const next=document.createElement('button');
    next.className='carousel-nav next';
    next.setAttribute('aria-label','Next');
    next.onclick=()=>{ idx=(idx+1)%items.length; render(); };
    frame.appendChild(next);

    items.forEach((_,i)=>{
      const d=document.createElement('div');
      d.className='dot'+(i===idx?' active':'');
      d.onclick=()=>{idx=i;render();};
      dots.appendChild(d);
    });
  }

  render();
});
</script>




<script>
document.addEventListener('click', function(e){
  const a = e.target.closest('a[href*="t="],a[href*="start="]');
  if(!a) return;
  // find the current player in the visible card
  const holder = document.querySelector('.carousel-card .carousel-video > div[id^="yt-"]');
  if(!holder || !window.YT || !YT.get) return;
  const p = YT.get(holder.id);
  if(!p || !p.seekTo) return;

  const t = parseStartParam(a.href);
  if(!t) return; // let the link behave normally if no time
  e.preventDefault();
  try { p.seekTo(t, true); p.playVideo(); } catch(_){}
});
</script>
<script>
document.addEventListener('DOMContentLoaded', function(){
  // Safari detection that excludes Chrome/iOS Chrome
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if(!isSafari) return;

  // 1) Kill problematic visual effects *inline* on likely ancestors
  ['.dex-sidebar','.carousel-card','#carousel-frame','#dexCombined']
    .forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        el.style.webkitBackdropFilter = 'none';
        el.style.backdropFilter = 'none';
        el.style.filter = 'none';
      });
    });

  // 2) Ensure the video wrapper has a real box & its own layer
  var box = document.querySelector('.carousel-video');
  if (box){
    box.style.position = 'relative';
    box.style.isolation = 'isolate';
    box.style.aspectRatio = '16 / 9';
    box.style.background = '#000';
    box.style.borderRadius = '4px';
    box.style.overflow = 'hidden';
  }

  // 3) Repoint the iframe with Safari-safe params
  var ifr = document.querySelector('.carousel-video iframe');
  if (ifr){
    // build from existing URL if present
    var u = new URL(ifr.src || 'about:blank');
    var id = (u.pathname.match(/\/embed\/([^/?#]+)/)||[])[1] || (u.searchParams.get('v')||'');
    var start = u.searchParams.get('start') || u.searchParams.get('t') || 0;
    ifr.src = 'https://www.youtube.com/embed/'+id
      + '?rel=0&modestbranding=1&playsinline=1&enablejsapi=1'
      + (start ? '&start=' + start : '')
      + '&origin=' + encodeURIComponent(location.origin);

    // attributes Safari expects
    ifr.setAttribute('playsinline','');
    ifr.setAttribute('allowfullscreen','');
    ifr.setAttribute('allow','autoplay; clipboard-write; encrypted-media; gyroscope; accelerometer; picture-in-picture; fullscreen');
    ifr.removeAttribute('referrerpolicy'); // avoid strict referrer quirks
    ifr.removeAttribute('loading');        // avoid lazy-iframe quirk

    // paint nudge for rare 18.x blanking
    requestAnimationFrame(()=>{ ifr.style.opacity='0.999'; requestAnimationFrame(()=>{ ifr.style.opacity='1'; }); });
  }
});
</script>

<style>
/* one rule for all browsers, very small and safe */
#dexCombined .carousel-video { aspect-ratio:16/9; }
#dexCombined .carousel-video iframe{
  position:absolute; inset:0; width:100%; height:100%; border:0;
  transform: translateZ(0); -webkit-transform: translateZ(0);
}
</style>
<style>
/* --- Layout: 1 column on mobile, 2 columns on web --- */

/* Mobile (≤768px): stack */
@media (max-width: 900px){
  /* make the two sides stack */
  #dexCombined{
    flex-direction: column !important;
    gap: 4px !important;
  }
  #dexHeroSide,
  #dexFeaturedSide{
    flex: auto !important;
    width: 100% !important;
  }

  /* carousel card: single-column grid on small screens */
  .carousel-card{
    grid-template-columns: 1fr !important;
  }
  /* ensure video spans full width in the single-column grid */
  #dexCombined .carousel-video{
    grid-column: 1 / -1 !important;
    width: 100% !important;
  }
/* carousel frame must be a clean vertical flow (title -> badges -> video -> indicators) */
  #carousel-frame {
    margin: 4px !important;
    padding: 4px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
        padding-left: 0 !important;
    justify-content: flex-start !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
  }

  /* remove extra card paddings that created space under the iframe */
  .carousel-card {
    margin: 0 !important;
    padding-top: 12px !important;
    padding-bottom: 0 !important;
    gap: 0.5rem !important; /* keep a tiny internal gap for visual breathing, reduce if you want zero */
    box-sizing: border-box !important;
  }

  /* ensure the video takes full width and doesn't leave stray space at bottom */
  #dexCombined .carousel-video{
    grid-column: 1 / -1 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  .carousel-video iframe{
    display:block;
    width:100%;
    height:100%;
    border:0;
    margin:0;
    padding:0;
  }
  /* keep nav buttons inside the frame on narrow viewports */
  .carousel-nav{
    width: 2.25rem;
    height: 2.25rem;
  }
  .carousel-nav.prev{ left: -3.35rem !important; }
  .carousel-nav.next{ right: -3.35rem !important; }

  #dexFeaturedSide{
    display: none !important;
  }
}

/* Web (≥769px): explicit 2-column just to be clear */
@media (min-width: 769px){
  #dexCombined{ flex-direction: row !important; }
}

@media (max-width: 900px){
  /* Kill featured side completely */
  #dexFeaturedSide { 
    display: none !important; 
  }

  /* Let #dexCombined collapse naturally */
  #dexCombined {
    height: auto !important;
    min-height: 0 !important;
  }

  /* Force Squarespace's wrapper to shrink as well */
  .sqs-block-code > .sqs-block-content {
    height: auto !important;
    min-height: 0 !important;
  }
}

</style>
