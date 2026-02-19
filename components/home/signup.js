<!-- ────────────────────────────────────────────────────────────────
Dex 2.0 • SIGN-UP FOR FR‎E‎E AC‎C‎E‎SS  (Squarespace code-block)
• Glassmorphic liquid-card + holo glow (uses your global tokens)
• CTA uses Squarespace’s Pricing-Plan join button provided
────────────────────────────────────────────────────────────────── -->
<section id="dex-signup" class="dex-signup-card">

  <!-- media loop -->
  <div class="signup-media">
    <video
      src="https://video.squarespace-cdn.com/content/v1/63956a55e99f9772a8cd1742/a157f35d-b252-448e-80dd-233e3c3cf26b/playlist.m3u8"
      muted autoplay playsinline loop
      poster="https://static1.squarespace.com/static/63956a55e99f9772a8cd1742/t/68884a57882b5b2f1deb51e2/1753762393566/dex+sky+promo.jpg"></video>
  </div>

  <!-- copy + CTA -->
  <div class="signup-body">
    <h2 class="signup-heading">
      SIGN-UP FOR FR‎E‎E AC‎C‎E‎S‎SSS
    </h2>

    <p class="signup-tag">
      700+ CC-BY artist loops in one click – join Dex &amp; start sampling now.
    </p>

    <!-- Squarespace Pricing-Plan button (free tier) -->
    <div class="product-block">
      <div class="productDetails center">
        <button class="cta-btn join-button sqs-button-element--primary"
          onclick="UserAccountApi.joinPricingPlan(
            'ee53ec15-15ad-4405-b664-143d74f2c75c','', '', false,
            'MEMBER_AREA_BLOCK',
            {&quot;pricingPlanId&quot;:&quot;ee53ec15-15ad-4405-b664-143d74f2c75c&quot;,
             &quot;showJoinButton&quot;:true,&quot;joinButtonText&quot;:&quot;JOIN DEX&quot;,
             &quot;pricingType&quot;:&quot;FREE&quot;})">
          <div class="sqs-add-to-cart-button-inner">
            JOIN&nbsp;DEX
          </div>
        </button>
      </div>
    </div>
  </div>
</section>

<style>
/* scoped styles — glassmorphic card & layout */
#dex-signup.dex-signup-card{
  --gap: var(--space-4);
  display:grid; grid-template-columns:1fr 1fr; gap:var(--gap);
  padding:var(--space-5);
  border-radius:4px;
  background:var(--liquid-bg);
  border:1px solid var(--liquid-border);
  backdrop-filter:blur(var(--liquid-blur)) saturate(180%) contrast(1.12) brightness(1.06);
  -webkit-backdrop-filter:blur(var(--liquid-blur)) saturate(180%) contrast(1.12) brightness(1.06);
  position:relative; overflow:visible;
}
#dex-signup.dex-signup-card::before{
  content:""; position:absolute; inset:calc(-1*var(--holo-spread));
  border-radius:4px; border:var(--holo-spread) solid transparent;
  filter:blur(var(--holo-blur)) saturate(300%); opacity:0; transform:scale(.9);
  clip-path:inset(var(--holo-spread) round var(--radius-md));
  transition:opacity var(--holo-speed) ease-out, transform var(--holo-speed) ease-out;
  pointer-events:none; z-index:-1;
}
#dex-signup.dex-signup-card:hover::before{opacity:1; transform:scale(1);}

/* media */
.signup-media video{width:100%;height:100%;object-fit:cover;border-radius:4px;box-shadow:var(--shadow-light);aspect-ratio:16/9;}

/* text block */
.signup-body{display:flex;flex-direction:column;justify-content:center;gap:var(--space-3);}
.signup-heading{margin:0;font-family:var(--font-heading);font-size:clamp(1.4rem,4vw,2rem);text-transform:uppercase;}
.signup-tag{margin:0;font-family:var(--font-body);}

/* CTA button inherits .cta-btn core styles already loaded */
.cta-btn.join-button{min-width:11rem;}

/* responsive */
@media(max-width:700px){
  #dex-signup.dex-signup-card{grid-template-columns:1fr;text-align:center;}
  .signup-body{align-items:center;}
}
</style>

<script>
/* Insert blank char (\u200c) between duplicate letters, then RandomizeTitle() */
(function(){
  const BLANK = '\u200c';
  function insertBlanks(str){
    return str.replace(/([A-Za-z])\1/g, (m, p)=>p+BLANK+p);
  }
  const rand = window.randomizeTitle || (t=>t);
  const h = document.querySelector('#dex-signup .signup-heading');
  h.textContent = rand(insertBlanks('Sign up for Free Access'));
})();
</script>
