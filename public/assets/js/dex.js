<style>
/*header injection */

/* chromatic abberation 
  
  /*──────────────────────────────────────────────────*/
  /*  LIQUID-GLASS + RGB SPLIT (raw CSS in <style>)   */
  /*──────────────────────────────────────────────────*/
  :root {
    --liquid-blur:    28px;
    --liquid-bg:      rgba(255,255,255,0.18);
    --liquid-border:  rgba(255,255,255,0.35);
  }

  /* SVG filter must already be injected as shown earlier */

  .dex-sidebar,
  .dex-sidebar section,
  .dex-overview,
  .dex-license,
  .dex-credits,
  .badge,
  .license-btn.usage-btn,
  .dex-modal,
  .dex-modal-content {
    background: var(--liquid-bg);
    border: 1px solid var(--liquid-border);

    /* raw CSS so saturate() etc. stay intact: */
    backdrop-filter:
      blur(var(--liquid-blur))
      saturate(180%)
      contrast(1.12)
      brightness(1.06);
    -webkit-backdrop-filter:
      blur(var(--liquid-blur))
      saturate(180%)
      contrast(1.12)
      brightness(1.06);

    /* the SVG chromatic-prism filter you injected earlier */
    filter: url("#chromatic-aberration");
  }

  @keyframes liquidChromaticShift {
    0%,100% { transform: translate3d(0,0,0); }
    50%     { transform: translate3d(1.5px,1.5px,0); }
  }

  @media (prefers-reduced-motion: no-preference) {
    .dex-sidebar,
    .dex-modal-content,
    .badge {
      position: relative;
      overflow: hidden;
    }
    .dex-sidebar::after,
    .dex-modal-content::after,
    .badge::after {
      content: "";
      position: absolute;
      inset: -6%;
      background: linear-gradient(130deg, rgba(255,0,140,0.06) 0%, rgba(0,170,255,0.06) 100%);
      mix-blend-mode: screen;
      pointer-events: none;
      animation: liquidChromaticShift 14s ease-in-out infinite;
    }
  }

/*specific page header code injection */
:root {
  /* tweak these if you like */
  --holo-spread:  24px;    /* how far beyond the card the glow extends */
  --holo-blur:    28px;    /* how soft the glow is */
  --holo-speed:   0.6s;    /* hover fade/scale timing */
}

.dex-sidebar section,
.dex-overview,
.dex-license,
.dex-credits {
  position: relative;
  overflow: visible;               /* let the glow shine outside */
}

/* the glow ring */
.dex-sidebar section::before,
.dex-overview::before,
.dex-license::before,
.dex-credits::before {
  content: "";
  position: absolute;
  /* expand outward by --holo-spread */
  inset: calc(-1 * var(--holo-spread));
  border-radius: inherit;    
  
  /* create a transparent border of the right thickness */
  border: var(--holo-spread) solid transparent;
  
  /* draw that border as your conic rainbow */
  border-image-source: conic-gradient(
    from 0deg,
    red, orange, yellow, green,
    cyan, blue, magenta, red
  );
  border-image-slice: 1;
  
  /* soften it */
  filter: blur(var(--holo-blur)) saturate(300%);
  
  /* initial state */
  opacity: 0;
  transition:
    opacity var(--holo-speed) ease-out,
    transform var(--holo-speed) ease-out;
  pointer-events: none;
  z-index: -1;
  
  /* scale it in from slightly smaller if you like */
  transform: scale(0.9);
}
/* inside your ::before rule, right after filter: blur(...) */

  clip-path: inset(
    var(--holo-spread) /* top */
    var(--holo-spread) /* right */
    var(--holo-spread) /* bottom */
    var(--holo-spread) /* left */
    round var(--radius-sm)
  );

/* on hover, fade/scale it up */
.dex-sidebar section:hover::before,
.dex-overview:hover::before,
.dex-license:hover::before,
.dex-credits:hover::before {
  opacity: 1;
  transform: scale(1);
  

  }
</style>
