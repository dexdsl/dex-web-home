<style>
  /* 0 ▸ make *content* sections transparent – skip anything with “footer”
     (case-insensitive so it also matches 'Footer', 'site-footer', etc.) */
  .Index-page .dx-section:not([class*="footer" i]) {
    background: transparent !important;
  }
 /* 1 ▸ fixed gradient layer behind everything */
  #scroll-gradient-bg {
    position: fixed;
        transition: background 0.25s linear;
    pointer-events: none;
    z-index: 0; /* CHANGED from big negative to 0 */
  }
/* fixed gradient layer behind everything */
#scroll-gradient-bg{
  position: fixed;
  top: 0;                /* was: inset: 0; */
  left: 0;
  right: 0;
  bottom: auto;          /* important: do NOT pin the bottom */
  width: 100vw;
  height: 100vh;         /* cover the viewport */
  /* if you want the modern unit for mobile address-bar shrink/expand: */
  height: 100dvh;        /* keep both lines; the latter will win where supported */

  background: #FCFCFC;
  transition: background 0.25s linear;
  pointer-events: none;
  z-index: -10002;       /* stays behind content */
}

/* keep blobs one step above the gradient, still below content */
#gooey-mesh-wrapper{
  position: fixed;
  top: 0; left: 0; right: 0;
  bottom: auto;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  pointer-events: none;
  z-index: -10001;
}

 
  /* 2 ▸ gooey-mesh wrapper above gradient, below page content */
  #gooey-mesh-wrapper {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0; /* CHANGED from big negative to 0 */
  }
  #gooey-mesh-wrapper .gooey-stage {
    position: absolute; inset: 0;
    filter: url("#goo");
  }
  #gooey-mesh-wrapper .gooey-blob {
    position: absolute;
    width: var(--d); height: var(--d);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background:
      radial-gradient(circle at 30% 30%, var(--g1a) 0%, var(--g1b) 45%, transparent 75%),
      radial-gradient(circle at 70% 70%, var(--g2a) 0%, var(--g2b) 45%, transparent 75%);
    filter: blur(34px) saturate(150%);
    will-change: transform;
  }
  #gooey-mesh-wrapper svg#goo-filter { position: absolute; width: 0; height: 0; }
/* ——— VISIBILITY PATCHES (place at the end of the block) ——— */

/* A) Make content sections transparent, but NEVER the footer section
   - Case-insensitive "footer" match
   - Also guard the section that actually contains a <footer> element */
.Index-page .dx-section:not([class*="footer" i]) {
  background: transparent !important;
}
@supports selector(.dx-section:has(footer)) {
  .Index-page .dx-section:has(footer) {
    background: initial !important;
  }
}

/* B) Editor / no-JS default:
   If the script hasn’t set data-surface, show a LIGHT surface (black text + light logo).
   Use !important to beat the prefers-color-scheme rules. */
footer.dex-footer:not([data-surface]) {
  --dex-footer-text: #000 !important;
}
footer.dex-footer:not([data-surface]) .footer-logo .logo--light { display:block !important; }
footer.dex-footer:not([data-surface]) .footer-logo .logo--dark  { display:none  !important; }

/* C) Belt & suspenders in case the editor (or a reset) hides nested <footer> */
.dx-section footer.dex-footer {
  display:block !important;
  visibility:visible !important;
  opacity:1 !important;
}

/* D) Ensure it paints above odd stacking contexts */
footer.dex-footer { position:relative; z-index:1; isolation:isolate; }
/* clamp the full-bleed fixed layers to the viewport height even if
   a transformed ancestor captures them in the editor */
#scroll-gradient-bg,
#gooey-mesh-wrapper{
  /* keep your existing declarations (including inset:0) */
  -webkit-clip-path: inset(0 0 calc(100% - 100dvh) 0);
          clip-path: inset(0 0 calc(100% - 100dvh) 0);
}

/* fallback for older browsers that lack dvh */
@supports not (height: 100dvh){
  #scroll-gradient-bg,
  #gooey-mesh-wrapper{
    -webkit-clip-path: inset(0 0 calc(100% - 100vh) 0);
            clip-path: inset(0 0 calc(100% - 100vh) 0);
  }
}

/* also make sure the gradient sits behind content (unchanged design) */
#scroll-gradient-bg{ z-index: -10002; }
#gooey-mesh-wrapper{ z-index: -10001; }

</style>

<!-- gradient layer -->
<div id="scroll-gradient-bg"></div>

<!-- gooey blobs -->
<div id="gooey-mesh-wrapper">
  <div class="gooey-stage">
    <div class="gooey-blob" style="--d:36vmax;--g1a:#ff5f6d;--g1b:#ffc371;--g2a:#47c9e5;--g2b:#845ef7"></div>
    <div class="gooey-blob" style="--d:32vmax;--g1a:#7F00FF;--g1b:#E100FF;--g2a:#00DBDE;--g2b:#FC00FF"></div>
    <div class="gooey-blob" style="--d:33vmax;--g1a:#FFD452;--g1b:#FFB347;--g2a:#FF8456;--g2b:#FF5E62"></div>
    <div class="gooey-blob" style="--d:37vmax;--g1a:#13F1FC;--g1b:#0470DC;--g2a:#A1FFCE;--g2b:#FAFFD1"></div>
    <div class="gooey-blob" style="--d:27vmax;--g1a:#F9516D;--g1b:#FF9A44;--g2a:#FA8BFF;--g2b:#6F7BF7"></div>
  </div>
  <!-- hidden SVG filters -->
  <svg id="goo-filter" aria-hidden="true">
    <defs>
      <filter id="goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur"/>
        <feColorMatrix in="blur" mode="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo"/>
        <feBlend in="SourceGraphic" in2="goo" mode="normal"/>
      </filter>
    </defs>
  </svg>
</div>

<script>
;(function(){
  /* ── 1. gooey blob animation ── */
  const blobs=[...document.querySelectorAll('#gooey-mesh-wrapper .gooey-blob')];
  if(blobs.length){
    const W=()=>innerWidth, H=()=>innerHeight;
    blobs.forEach(b=>{
      const speed=60+Math.random()*60,
            ang=Math.random()*6.283;
      b._r=b.offsetWidth/2;
      b._x=W()/2; b._y=H()/2;
      b._vx=Math.cos(ang)*speed*.25;
      b._vy=Math.sin(ang)*speed*.25;
    });
    let last=performance.now();
    const tick=now=>{
      const dt=(now-last)/1000; last=now;
      blobs.forEach(b=>{
        b._x+=b._vx*dt; b._y+=b._vy*dt;
        if((b._x-b._r<=0&&b._vx<0)||(b._x+b._r>=W()&&b._vx>0)) b._vx*=-1;
        if((b._y-b._r<=0&&b._vy<0)||(b._y+b._r>=H()&&b._vy>0)) b._vy*=-1;
        b.style.transform=`translate(${b._x}px,${b._y}px) translate(-50%,-50%)`;
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    addEventListener('resize',()=>blobs.forEach(b=>{
      b._x=Math.min(Math.max(b._r,b._x),W()-b._r);
      b._y=Math.min(Math.max(b._r,b._y),H()-b._r);
    }));
  }

  /* ── 2. scroll-gradient (RAF-throttled) ── */
  const grad=document.getElementById('scroll-gradient-bg'),
        start=[252,252,252], end=[35,35,35];
  const lerp=(a,b,t)=>a+(b-a)*t;
  let rafId=null;
  const update=()=>{
    const max=document.documentElement.scrollHeight-innerHeight||1;
    const t=Math.min(Math.max(scrollY/max,0),1);
    const rgb=start.map((s,i)=>Math.round(lerp(s,end[i],t)));
    grad.style.background=`rgb(${rgb.join(',')})`;
    rafId=null;
  };
  addEventListener('scroll',()=>{
    if(!rafId) rafId=requestAnimationFrame(update);
  },{passive:true});
  update(); /* initial paint */
})();
</script>
