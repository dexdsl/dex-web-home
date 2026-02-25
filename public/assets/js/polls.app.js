(()=>{(()=>{if(typeof window=="undefined"||typeof document=="undefined")return;if(window.__dxPollsAppLoaded&&typeof window.__dxPollsQueueBoot=="function"){try{window.__dxPollsQueueBoot()}catch{}return}window.__dxPollsAppLoaded=!0;let E=120,I="dx-polls-app-style",N=12,D=8;function B(){if(document.getElementById(I))return;let t=document.createElement("style");t.id=I,t.textContent=`
      .dx-polls-shell{
        --dx-polls-gap: clamp(14px,1.8vw,22px);
        width:var(--dx-header-frame-width);
        max-width:var(--dx-header-frame-width);
        margin:0 auto;
        padding:var(--dx-polls-gap) 0;
        box-sizing:border-box
      }
      .dx-polls-layout{display:grid;gap:var(--dx-polls-gap);grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}
      .dx-polls-panel{padding:clamp(16px,1.8vw,22px);border-radius:var(--dx-header-glass-radius,var(--dx-radius-md,10px));background:var(--dx-header-glass-bg);border:1px solid var(--dx-header-glass-rim);box-shadow:var(--dx-header-glass-shadow)}
      @supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))){.dx-polls-panel{-webkit-backdrop-filter:var(--dx-header-glass-backdrop);backdrop-filter:var(--dx-header-glass-backdrop)}}
      .dx-polls-title{margin:0;font-family:var(--font-heading);font-size:clamp(1.6rem,3.3vw,2.35rem);letter-spacing:.02em;text-transform:uppercase}
      .dx-polls-subtitle{margin:8px 0 0 0;font-family:var(--font-body);font-size:clamp(.9rem,1.2vw,1rem);color:var(--dx-color-text-muted,#5e6270)}
      .dx-polls-stack{display:grid;gap:12px;margin-top:16px}
      .dx-poll-card{display:grid;gap:10px;padding:14px;border-radius:var(--dx-radius-sm,8px);background:rgba(255,255,255,.32);border:1px solid rgba(255,255,255,.55)}
      .dx-poll-card.is-locked{opacity:.92}
      .dx-poll-card-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .dx-poll-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;border:1px solid rgba(38,42,52,.25);font-family:var(--font-body);font-size:.74rem;letter-spacing:.02em;text-transform:uppercase}
      .dx-poll-chip.is-accent{background:linear-gradient(90deg,#ff2d13 0%,#ff7a1a 100%);color:#fff;border-color:rgba(0,0,0,.18)}
      .dx-poll-chip.is-members{
        background:rgba(22,26,34,.9);
        color:#fff;
        border-color:rgba(255,255,255,.24);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 14px rgba(16,20,30,.22)
      }
      .dx-poll-question{margin:0;font-family:var(--font-heading);font-size:clamp(1rem,1.2vw,1.25rem);line-height:1.15;letter-spacing:.01em}
      .dx-poll-meta{margin:0;font-family:var(--font-body);font-size:.86rem;color:var(--dx-color-text-muted,#5e6270)}
      .dx-poll-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
      .dx-poll-link,.dx-poll-action{appearance:none;border:1px solid rgba(38,42,52,.26);background:rgba(255,255,255,.55);border-radius:var(--dx-radius-sm,8px);padding:8px 12px;font-family:var(--font-heading);font-size:.82rem;letter-spacing:.02em;text-transform:uppercase;color:var(--dx-color-text,#1e2129);text-decoration:none;cursor:pointer}
      .dx-poll-link:hover,.dx-poll-action:hover{background:rgba(255,255,255,.72)}
      .dx-poll-action.is-danger{background:#af1d17;color:#fff;border-color:#7f110f}
      .dx-polls-pager{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:10px}
      .dx-polls-pager .dx-poll-action[disabled]{opacity:.42;cursor:default}
      .dx-poll-detail{display:grid;gap:16px}
      .dx-poll-back{width:max-content}
      .dx-poll-options{display:grid;gap:10px}
      .dx-poll-option{display:grid;gap:8px;padding:10px;border-radius:var(--dx-radius-sm,8px);border:1px solid rgba(38,42,52,.2);background:rgba(255,255,255,.46);text-align:left;cursor:pointer}
      .dx-poll-option[disabled]{cursor:default;opacity:.78}
      .dx-poll-option.is-selected{border-color:#ff4d1a;box-shadow:inset 0 0 0 1px rgba(255,77,26,.35)}
      .dx-poll-option-title{font-family:var(--font-heading);font-size:.98rem;line-height:1.1;text-transform:uppercase;letter-spacing:.01em}
      .dx-poll-bar{position:relative;height:8px;border-radius:999px;overflow:hidden;background:rgba(24,30,44,.12)}
      .dx-poll-bar-fill{height:100%;width:0;background:linear-gradient(90deg,#ff2d13 0%,#ff7a1a 100%);transition:width 220ms var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1))}
      .dx-poll-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--font-body);font-size:.82rem;color:var(--dx-color-text-muted,#5e6270)}
      .dx-polls-empty{margin:0;padding:14px;border-radius:var(--dx-radius-sm,8px);border:1px solid rgba(38,42,52,.16);background:rgba(255,255,255,.4);font-family:var(--font-body);color:var(--dx-color-text-muted,#5e6270)}
      .dx-polls-error{margin:0;padding:14px;border-radius:var(--dx-radius-sm,8px);border:1px solid rgba(175,29,23,.25);background:rgba(175,29,23,.08);font-family:var(--font-body);color:#611313}
      @media (max-width: 980px){
        .dx-polls-shell{width:var(--dx-header-frame-width);max-width:var(--dx-header-frame-width)}
        .dx-polls-layout{grid-template-columns:1fr}
      }
    `,document.head.appendChild(t)}function u(t){return String(t!=null?t:"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function R(t){let e=String(t||"/").replace(/\/+/g,"/");return e==="/"?"/":e.endsWith("/")?e.slice(0,-1):e}function q(){let t=window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||"";return String(t||"https://dex-api.spring-fog-8edd.workers.dev").trim().replace(/\/$/,"")}function y(t){let e=Date.parse(String(t||""));return Number.isFinite(e)?e:null}function b(t){let e=y(t);if(!e)return"TBD";try{return new Date(e).toLocaleString(void 0,{year:"numeric",month:"short",day:"numeric"})}catch{return new Date(e).toISOString().slice(0,10)}}function L(t){let e=y(t);if(!e)return"Closing date TBD";let o=Date.now(),a=e-o;if(a<=0)return"Closed";let l=Math.floor(a/36e5),n=Math.floor(l/24),s=l%24;return n>0?`${n}d ${s}h left`:s>0?`${s}h left`:`${Math.max(1,Math.floor(a/6e4))}m left`}function z(t){return Array.isArray(t)?t.map(e=>String(e||"").trim()).filter(Boolean):typeof t=="string"?t.split("|").map(e=>e.trim()).filter(Boolean):[]}function w(t){let e=t&&typeof t=="object"?t:{};return{id:String(e.id||"").trim(),slug:String(e.slug||"").trim()||null,status:String(e.status||"").trim()||"draft",question:String(e.question||"").trim()||"Untitled poll",options:z(e.options),createdAt:String(e.createdAt||e.created_at||"").trim(),closeAt:String(e.closeAt||e.close_at||"").trim(),manualClose:!!(e.manualClose||e.manual_close),visibility:String(e.visibility||"public").trim()==="members"?"members":"public",closed:!!e.closed,locked:!!e.locked}}function T(t){let e={};if(!t||typeof t!="object")return e;for(let[o,a]of Object.entries(t)){let l=Number(a);!Number.isFinite(l)||l<0||(e[String(o)]=Math.floor(l))}return e}function U(t){let e=t&&typeof t=="object"?t:{},o=Array.isArray(e.counts)?e.counts.map(a=>Math.max(0,Number(a)||0)):T(e.counts);return{total:Math.max(0,Number(e.total)||0),counts:o,viewerVote:Number.isInteger(Number(e.viewerVote))?Number(e.viewerVote):null,closed:!!e.closed}}function j(t){return`/polls/${encodeURIComponent(t)}/`}function H(t=null){if(t&&t instanceof Element){let o=String(t.getAttribute("data-dx-poll-id")||"").trim();if(o)return{type:"detail",pollId:o};if(t.hasAttribute("data-dx-polls-app"))return{type:"list",pollId:null}}let e=R(window.location.pathname||"/");if(e==="/polls"||e==="/polls/index.html")return{type:"list",pollId:null};if(e.startsWith("/polls/")){let a=e.slice(7).replace(/\/index\.html$/i,"").replace(/\/$/,"");return a?{type:"detail",pollId:decodeURIComponent(a)}:{type:"list",pollId:null}}return{type:"list",pollId:null}}function O(){return document.querySelector("[data-dx-polls-app]")||document.getElementById("dx-polls-app")}function V(t,e={}){let o=String(t||"").trim();if(!o)return;let a=!!e.replace;if(typeof window.dxNavigate=="function")try{let l=window.dxNavigate(o,{pushHistory:!a,allowHardNavigate:!0});if(l&&typeof l.then=="function"){l.then(n=>{n===!1&&window.location.assign(o)}).catch(()=>{window.location.assign(o)});return}return}catch{}if(a){window.location.replace(o);return}window.location.assign(o)}function v(t){if(typeof window.dxNavigate=="function"||document.body.classList.contains("dx-slot-enabled"))return;t.querySelectorAll("a.dx-poll-link[href]").forEach(a=>{a instanceof HTMLAnchorElement&&a.getAttribute("data-dx-poll-link-bound")!=="true"&&(a.setAttribute("data-dx-poll-link-bound","true"),a.addEventListener("click",l=>{l.defaultPrevented||(l.preventDefault(),V(a.getAttribute("href")||""))}))})}function F(){return window.DEX_AUTH||window.dexAuth||null}async function k(){let t=F();if(!t)return{auth:null,authenticated:!1,token:null,user:null};try{typeof t.resolve=="function"?await t.resolve(2500):t.ready&&typeof t.ready.then=="function"&&await t.ready}catch{}let e=!1;try{typeof t.isAuthenticated=="function"&&(e=!!await t.isAuthenticated())}catch{}let o=null;if(e&&typeof t.getAccessToken=="function")try{o=await t.getAccessToken()}catch{o=null}let a=null;try{typeof t.getUser=="function"&&(a=await t.getUser())}catch{}return{auth:t,authenticated:e,token:o,user:a}}async function x(t,e={}){let o=q(),a=e.auth||"optional",l=e.authSnapshot||await k(),n={"content-type":"application/json"};if(l.token&&(n.authorization=`Bearer ${l.token}`),a==="required"&&!n.authorization)return{ok:!1,status:401,data:{error:"AUTH_REQUIRED"}};let s=await fetch(`${o}${t}`,{method:e.method||"GET",headers:n,body:e.body?JSON.stringify(e.body):void 0}),d=null;try{d=await s.json()}catch{d=null}return{ok:s.ok,status:s.status,data:d}}function C(t,e=1){if(Array.isArray(t))return{polls:t.map(w),page:e,pages:1,total:t.length};let o=t&&typeof t=="object"?t:{},l=[o.polls,o.items,o.data,o.rows].find(n=>Array.isArray(n))||[];return{polls:l.map(w),page:Math.max(1,Number(o.page)||e),pages:Math.max(1,Number(o.pages||o.totalPages)||1),total:Math.max(0,Number(o.total||o.count||l.length)||0)}}async function P(t){let e=performance.now()-t;e>=E||await new Promise(o=>setTimeout(o,E-e))}function $(t,e){t.setAttribute("data-dx-fetch-state",e),e==="loading"?t.setAttribute("aria-busy","true"):t.removeAttribute("aria-busy")}function Q(t,e){t.innerHTML=`
      <section class="dx-polls-shell">
        <article class="dx-polls-panel">
          <h1 class="dx-polls-title">Dex Polls</h1>
          <p class="dx-polls-error">${u(e||"Unable to load polls right now.")}</p>
        </article>
      </section>
    `}function _(t){if(!t||t.status==="closed"||t.manualClose||t.closed)return!0;let e=y(t.closeAt);return e?e<=Date.now():!1}function M(t,e){let o=_(t),a=t.visibility==="members"&&!e.authenticated,l=o?"Closed":t.status==="draft"?"Draft":"Open",n=o?`Closed ${b(t.closeAt)}`:`Closes ${b(t.closeAt)} (${L(t.closeAt)})`,s=t.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':"",d=a?`<button class="dx-poll-action" type="button" data-dx-poll-action="signin" data-dx-poll-id="${u(t.id)}">Sign in to unlock</button>`:`<a class="dx-poll-link" href="${u(j(t.id))}">View Poll</a>`;return`
      <article class="dx-poll-card${a?" is-locked":""}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${o?"":"is-accent"}">${l}</span>
          ${s}
        </div>
        <h3 class="dx-poll-question">${u(t.question)}</h3>
        <p class="dx-poll-meta">${u(n)}</p>
        <div class="dx-poll-actions">${d}</div>
      </article>
    `}function G(t,e){let o=e.open.polls.length?e.open.polls.map(l=>M(l,e.auth)).join(""):'<p class="dx-polls-empty">No open polls right now.</p>',a=e.closed.polls.length?e.closed.polls.map(l=>M(l,e.auth)).join(""):'<p class="dx-polls-empty">No closed polls yet.</p>';t.innerHTML=`
      <section class="dx-polls-shell">
        <article class="dx-polls-panel">
          <h1 class="dx-polls-title">Dex Polls</h1>
          <p class="dx-polls-subtitle">Community signal desk. Members-only polls require sign-in.</p>
        </article>
        <section class="dx-polls-layout">
          <article class="dx-polls-panel" data-dx-motion="pagination">
            <h2 class="dx-poll-question">Open polls</h2>
            <div class="dx-polls-stack">${o}</div>
          </article>
          <article class="dx-polls-panel" data-dx-motion="pagination">
            <h2 class="dx-poll-question">Closed polls</h2>
            <div class="dx-polls-stack">${a}</div>
            <div class="dx-polls-pager">
              <button type="button" class="dx-poll-action" data-dx-poll-action="closed-prev" ${e.closed.page<=1?"disabled":""}>Previous</button>
              <span class="dx-poll-meta">Page ${e.closed.page} of ${e.closed.pages}</span>
              <button type="button" class="dx-poll-action" data-dx-poll-action="closed-next" ${e.closed.page>=e.closed.pages?"disabled":""}>Next</button>
            </div>
          </article>
        </section>
      </section>
    `,v(t)}function X(t,e,o,a,l="idle"){let n=_(e)||!!o.closed,s=Array.isArray(o.counts)?o.counts:e.options.map((i,r)=>{var c;return Number(((c=o.counts)==null?void 0:c[String(r)])||0)}),d=e.options.map((i,r)=>{let c=Math.max(0,Number(s[r])||0),h=o.total>0?Math.round(c/o.total*100):0;return`
        <button type="button" class="dx-poll-option${o.viewerVote===r?" is-selected":""}" data-dx-poll-action="vote" data-dx-poll-option="${r}" ${n?"disabled":""}>
          <span class="dx-poll-option-title">${u(i)}</span>
          <div class="dx-poll-bar"><div class="dx-poll-bar-fill" style="width:${h}%"></div></div>
          <div class="dx-poll-row-foot"><span>${c} votes</span><span>${h}%</span></div>
        </button>
      `}).join(""),p=e.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':"",f=l==="saving"?"Submitting vote\u2026":l==="saved"?"Vote saved":l==="error"?"Vote failed":"";t.innerHTML=`
      <section class="dx-polls-shell">
        <article class="dx-polls-panel dx-poll-detail" data-dx-motion="pagination">
          <a class="dx-poll-link dx-poll-back" href="/polls/">Back to polls</a>
          <div class="dx-poll-card-head">
            <span class="dx-poll-chip ${n?"":"is-accent"}">${n?"Closed":"Open"}</span>
            ${p}
          </div>
          <h1 class="dx-polls-title">${u(e.question)}</h1>
          <p class="dx-polls-subtitle">${n?`Closed ${b(e.closeAt)}`:`Closes ${b(e.closeAt)} (${L(e.closeAt)})`}</p>
          ${a.authenticated?"":'<p class="dx-polls-empty">Sign in to vote. Live results remain visible.</p>'}
          <div class="dx-poll-options">${d}</div>
          <div class="dx-polls-pager">
            <span class="dx-poll-meta">${o.total} total votes</span>
            <span class="dx-poll-meta">${u(f)}</span>
          </div>
        </article>
      </section>
    `,v(t)}function W(t,e){t.innerHTML=`
      <section class="dx-polls-shell">
        <article class="dx-polls-panel">
          <h1 class="dx-polls-title">Members poll</h1>
          <p class="dx-polls-subtitle">This poll is available to signed-in members.</p>
          <div class="dx-polls-stack">
            <p class="dx-polls-empty">Poll id: ${u(e)}</p>
            <button type="button" class="dx-poll-action" data-dx-poll-action="signin">Sign in to continue</button>
            <a class="dx-poll-link" href="/polls/">Back to polls</a>
          </div>
        </article>
      </section>
    `,v(t)}async function A(t){let e=t&&t.auth;if(!(!e||typeof e.signIn!="function"))try{await e.signIn({returnTo:`${window.location.pathname}${window.location.search}${window.location.hash}`})}catch{}}async function J(t,e){let o=e,a=1;async function l(){let n=await x(`/polls?state=open&page=1&pageSize=${N}`,{auth:"optional",authSnapshot:o}),s=await x(`/polls?state=closed&page=${a}&pageSize=${D}`,{auth:"optional",authSnapshot:o});if(!n.ok||!s.ok)throw new Error("Failed to load poll lists");let d=C(n.data,1),p=C(s.data,a);a=p.page,G(t,{auth:o,open:d,closed:p}),t.querySelectorAll('[data-dx-poll-action="signin"]').forEach(r=>{r.addEventListener("click",async c=>{c.preventDefault(),await A(o)})});let f=t.querySelector('[data-dx-poll-action="closed-prev"]');f&&f.addEventListener("click",async()=>{a<=1||(a-=1,await l())});let i=t.querySelector('[data-dx-poll-action="closed-next"]');i&&i.addEventListener("click",async()=>{a+=1,await l()})}await l()}async function Z(t,e,o){var f;let a=o,l="idle",n=await x(`/polls/${encodeURIComponent(e)}`,{auth:"optional",authSnapshot:a});if(n.status===403||n.status===401){W(t,e);let i=t.querySelector('[data-dx-poll-action="signin"]');i&&i.addEventListener("click",async()=>{await A(a)});return}if(!n.ok)throw new Error(`Unable to load poll ${e}`);let s=w(((f=n.data)==null?void 0:f.poll)||n.data);if(!s.id)throw new Error("Poll payload is missing id");async function d(){var r;let i=await x(`/polls/${encodeURIComponent(s.id)}/results`,{auth:"optional",authSnapshot:a});if(!i.ok)throw new Error("Unable to load poll results");return U(((r=i.data)==null?void 0:r.results)||i.data)}async function p(){let i=await d();X(t,s,i,a,l),t.querySelectorAll('[data-dx-poll-action="vote"]').forEach(r=>{r.addEventListener("click",async()=>{let c=Number(r.getAttribute("data-dx-poll-option"));if(!(!Number.isInteger(c)||c<0)){if(a=await k(),!a.authenticated){await A(a);return}l="saving";try{let h=await x(`/polls/${encodeURIComponent(s.id)}/vote`,{method:"POST",auth:"required",authSnapshot:a,body:{optionIndex:c}});if(!h.ok){if(h.status===409){l="error",await p();return}throw new Error("Vote failed")}l="saved",await p(),window.setTimeout(()=>{l="idle",p().catch(()=>{})},900)}catch{l="error",await p()}}})})}await p()}async function Y(){let t=O();if(!t)return;B();let e=performance.now();$(t,"loading");try{let o=await k(),a=H(t);a.type==="detail"&&a.pollId?await Z(t,a.pollId,o):await J(t,o),await P(e),$(t,"ready")}catch(o){console.error("[dx-polls] boot error",o),Q(t,"Unable to load polls right now. Please try again."),await P(e),$(t,"error")}}let m=null,S=!1;async function K(){do S=!1,await Y();while(S)}function g(){return m?(S=!0,m):(m=K().catch(t=>{console.error("[dx-polls] queue boot error",t)}).finally(()=>{m=null}),m)}window.__dxPollsQueueBoot=g,window.addEventListener("dx:slotready",()=>{g().catch(()=>{})}),window.addEventListener("popstate",()=>{g().catch(()=>{})}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{g().catch(()=>{})},{once:!0}):g().catch(()=>{})})();})();
