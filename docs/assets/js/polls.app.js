(()=>{(()=>{if(typeof window=="undefined"||typeof document=="undefined")return;if(window.__dxPollsAppLoaded&&typeof window.__dxPollsQueueBoot=="function"){try{window.__dxPollsQueueBoot()}catch{}return}window.__dxPollsAppLoaded=!0;let I=120,P="dx-polls-app-style",U=12,H=8,M=6e4;function j(){if(document.getElementById(P))return;let t=document.createElement("style");t.id=P,t.textContent=`
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
    `,document.head.appendChild(t)}function u(t){return String(t!=null?t:"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function O(t){let e=String(t||"/").replace(/\/+/g,"/");return e==="/"?"/":e.endsWith("/")?e.slice(0,-1):e}function F(){let t=window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||"";return String(t||"https://dex-api.spring-fog-8edd.workers.dev").trim().replace(/\/$/,"")}function $(t){let e=Date.parse(String(t||""));return Number.isFinite(e)?e:null}function y(t){let e=$(t);if(!e)return"TBD";try{return new Date(e).toLocaleString(void 0,{year:"numeric",month:"short",day:"numeric"})}catch{return new Date(e).toISOString().slice(0,10)}}function D(t){let e=$(t);if(!e)return"Closing date TBD";let o=Date.now(),n=e-o;if(n<=0)return"Closed";let a=Math.floor(n/36e5),i=Math.floor(a/24),d=a%24;return i>0?`${i}d ${d}h left`:d>0?`${d}h left`:`${Math.max(1,Math.floor(n/6e4))}m left`}function V(t){return Array.isArray(t)?t.map(e=>String(e||"").trim()).filter(Boolean):typeof t=="string"?t.split("|").map(e=>e.trim()).filter(Boolean):[]}function A(t){let e=t&&typeof t=="object"?t:{};return{id:String(e.id||"").trim(),slug:String(e.slug||"").trim()||null,status:String(e.status||"").trim()||"draft",question:String(e.question||"").trim()||"Untitled poll",options:V(e.options),createdAt:String(e.createdAt||e.created_at||"").trim(),closeAt:String(e.closeAt||e.close_at||"").trim(),manualClose:!!(e.manualClose||e.manual_close),visibility:String(e.visibility||"public").trim()==="members"?"members":"public",closed:!!e.closed,locked:!!e.locked}}function X(t){let e={};if(!t||typeof t!="object")return e;for(let[o,n]of Object.entries(t)){let a=Number(n);!Number.isFinite(a)||a<0||(e[String(o)]=Math.floor(a))}return e}function G(t){let e=t&&typeof t=="object"?t:{},o=Array.isArray(e.counts)?e.counts.map(n=>Math.max(0,Number(n)||0)):X(e.counts);return{total:Math.max(0,Number(e.total)||0),counts:o,viewerVote:Number.isInteger(Number(e.viewerVote))?Number(e.viewerVote):null,closed:!!e.closed}}function Q(t){return`/polls/${encodeURIComponent(t)}/`}function W(t=null){if(t&&t instanceof Element){let o=String(t.getAttribute("data-dx-poll-id")||"").trim();if(o)return{type:"detail",pollId:o};if(t.hasAttribute("data-dx-polls-app"))return{type:"list",pollId:null}}let e=O(window.location.pathname||"/");if(e==="/polls"||e==="/polls/index.html")return{type:"list",pollId:null};if(e.startsWith("/polls/")){let n=e.slice(7).replace(/\/index\.html$/i,"").replace(/\/$/,"");return n?{type:"detail",pollId:decodeURIComponent(n)}:{type:"list",pollId:null}}return{type:"list",pollId:null}}function J(){return document.querySelector("[data-dx-polls-app]")||document.getElementById("dx-polls-app")}function Z(t,e={}){let o=String(t||"").trim();if(!o)return;let n=!!e.replace;if(typeof window.dxNavigate=="function")try{let a=window.dxNavigate(o,{pushHistory:!n,allowHardNavigate:!0});if(a&&typeof a.then=="function"){a.then(i=>{i===!1&&window.location.assign(o)}).catch(()=>{window.location.assign(o)});return}return}catch{}if(n){window.location.replace(o);return}window.location.assign(o)}function S(t){if(typeof window.dxNavigate=="function"||document.body.classList.contains("dx-slot-enabled"))return;t.querySelectorAll("a.dx-poll-link[href]").forEach(n=>{n instanceof HTMLAnchorElement&&n.getAttribute("data-dx-poll-link-bound")!=="true"&&(n.setAttribute("data-dx-poll-link-bound","true"),n.addEventListener("click",a=>{a.defaultPrevented||(a.preventDefault(),Z(n.getAttribute("href")||""))}))})}function N(){return window.DEX_AUTH||window.dexAuth||null}function w(){return{auth:N(),authenticated:!1,token:null,user:null}}function R(){let t=window.__DX_PREFETCH;return!t||typeof t.getFresh!="function"||typeof t.set!="function"?null:t}function v(t,e){return`polls:list:${t}:page:${e}`}async function E(){let t=N();if(!t)return{auth:null,authenticated:!1,token:null,user:null};try{typeof t.resolve=="function"?await t.resolve(2500):t.ready&&typeof t.ready.then=="function"&&await t.ready}catch{}let e=!1;try{typeof t.isAuthenticated=="function"&&(e=!!await t.isAuthenticated())}catch{}let o=null;if(e&&typeof t.getAccessToken=="function")try{o=await t.getAccessToken()}catch{o=null}let n=null;try{typeof t.getUser=="function"&&(n=await t.getUser())}catch{}return{auth:t,authenticated:e,token:o,user:n}}async function m(t,e={}){let o=F(),n=e.auth||"optional",a=e.authSnapshot||null;!a&&n==="required"&&(a=await E()),a||(a=w());let i={"content-type":"application/json"};if(a.token&&(i.authorization=`Bearer ${a.token}`),n==="required"&&!i.authorization)return{ok:!1,status:401,data:{error:"AUTH_REQUIRED"}};let d=await fetch(`${o}${t}`,{method:e.method||"GET",headers:i,body:e.body?JSON.stringify(e.body):void 0}),c=null;try{c=await d.json()}catch{c=null}return{ok:d.ok,status:d.status,data:c}}function k(t,e=1){if(Array.isArray(t))return{polls:t.map(A),page:e,pages:1,total:t.length};let o=t&&typeof t=="object"?t:{},a=[o.polls,o.items,o.data,o.rows].find(i=>Array.isArray(i))||[];return{polls:a.map(A),page:Math.max(1,Number(o.page)||e),pages:Math.max(1,Number(o.pages||o.totalPages)||1),total:Math.max(0,Number(o.total||o.count||a.length)||0)}}async function B(t){let e=performance.now()-t;e>=I||await new Promise(o=>setTimeout(o,I-e))}function L(t,e){t.setAttribute("data-dx-fetch-state",e),e==="loading"?t.setAttribute("aria-busy","true"):t.removeAttribute("aria-busy")}function K(t,e){t.innerHTML=`
      <section class="dx-polls-shell">
        <article class="dx-polls-panel">
          <h1 class="dx-polls-title">Dex Polls</h1>
          <p class="dx-polls-error">${u(e||"Unable to load polls right now.")}</p>
        </article>
      </section>
    `}function q(t){if(!t||t.status==="closed"||t.manualClose||t.closed)return!0;let e=$(t.closeAt);return e?e<=Date.now():!1}function T(t,e){let o=q(t),n=t.visibility==="members"&&!e.authenticated,a=o?"Closed":t.status==="draft"?"Draft":"Open",i=o?`Closed ${y(t.closeAt)}`:`Closes ${y(t.closeAt)} (${D(t.closeAt)})`,d=t.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':"",c=n?`<button class="dx-poll-action" type="button" data-dx-poll-action="signin" data-dx-poll-id="${u(t.id)}">Sign in to unlock</button>`:`<a class="dx-poll-link" href="${u(Q(t.id))}">View Poll</a>`;return`
      <article class="dx-poll-card${n?" is-locked":""}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${o?"":"is-accent"}">${a}</span>
          ${d}
        </div>
        <h3 class="dx-poll-question">${u(t.question)}</h3>
        <p class="dx-poll-meta">${u(i)}</p>
        <div class="dx-poll-actions">${c}</div>
      </article>
    `}function z(t,e){let o=e.open.polls.length?e.open.polls.map(a=>T(a,e.auth)).join(""):'<p class="dx-polls-empty">No open polls right now.</p>',n=e.closed.polls.length?e.closed.polls.map(a=>T(a,e.auth)).join(""):'<p class="dx-polls-empty">No closed polls yet.</p>';t.innerHTML=`
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
            <div class="dx-polls-stack">${n}</div>
            <div class="dx-polls-pager">
              <button type="button" class="dx-poll-action" data-dx-poll-action="closed-prev" ${e.closed.page<=1?"disabled":""}>Previous</button>
              <span class="dx-poll-meta">Page ${e.closed.page} of ${e.closed.pages}</span>
              <button type="button" class="dx-poll-action" data-dx-poll-action="closed-next" ${e.closed.page>=e.closed.pages?"disabled":""}>Next</button>
            </div>
          </article>
        </section>
      </section>
    `,S(t)}function Y(t,e,o,n,a="idle"){let i=q(e)||!!o.closed,d=Array.isArray(o.counts)?o.counts:e.options.map((r,l)=>{var s;return Number(((s=o.counts)==null?void 0:s[String(l)])||0)}),c=e.options.map((r,l)=>{let s=Math.max(0,Number(d[l])||0),p=o.total>0?Math.round(s/o.total*100):0;return`
        <button type="button" class="dx-poll-option${o.viewerVote===l?" is-selected":""}" data-dx-poll-action="vote" data-dx-poll-option="${l}" ${i?"disabled":""}>
          <span class="dx-poll-option-title">${u(r)}</span>
          <div class="dx-poll-bar"><div class="dx-poll-bar-fill" style="width:${p}%"></div></div>
          <div class="dx-poll-row-foot"><span>${s} votes</span><span>${p}%</span></div>
        </button>
      `}).join(""),f=e.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':"",x=a==="saving"?"Submitting vote\u2026":a==="saved"?"Vote saved":a==="error"?"Vote failed":"";t.innerHTML=`
      <section class="dx-polls-shell">
        <article class="dx-polls-panel dx-poll-detail" data-dx-motion="pagination">
          <a class="dx-poll-link dx-poll-back" href="/polls/">Back to polls</a>
          <div class="dx-poll-card-head">
            <span class="dx-poll-chip ${i?"":"is-accent"}">${i?"Closed":"Open"}</span>
            ${f}
          </div>
          <h1 class="dx-polls-title">${u(e.question)}</h1>
          <p class="dx-polls-subtitle">${i?`Closed ${y(e.closeAt)}`:`Closes ${y(e.closeAt)} (${D(e.closeAt)})`}</p>
          ${n.authenticated?"":'<p class="dx-polls-empty">Sign in to vote. Live results remain visible.</p>'}
          <div class="dx-poll-options">${c}</div>
          <div class="dx-polls-pager">
            <span class="dx-poll-meta">${o.total} total votes</span>
            <span class="dx-poll-meta">${u(x)}</span>
          </div>
        </article>
      </section>
    `,S(t)}function tt(t,e){t.innerHTML=`
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
    `,S(t)}async function C(t){let e=t&&t.auth;if(!(!e||typeof e.signIn!="function"))try{await e.signIn({returnTo:`${window.location.pathname}${window.location.search}${window.location.hash}`})}catch{}}async function et(t,e,o=null){let n=e||w(),a=1;function i(){t.querySelectorAll('[data-dx-poll-action="signin"]').forEach(s=>{s.addEventListener("click",async p=>{p.preventDefault(),await C(n)})});let r=t.querySelector('[data-dx-poll-action="closed-prev"]');r&&r.addEventListener("click",async()=>{a<=1||(a-=1,await f())});let l=t.querySelector('[data-dx-poll-action="closed-next"]');l&&l.addEventListener("click",async()=>{a+=1,await f()})}function d(){if(a!==1)return!1;let r=R();if(!r)return!1;let l=r.getFresh(v("open",1),M),s=r.getFresh(v("closed",1),M);if(!(l!=null&&l.payload)||!(s!=null&&s.payload))return!1;let p=k(l.payload,1),b=k(s.payload,1);return z(t,{auth:n,open:p,closed:b}),i(),!0}function c(r,l){if(a!==1)return;let s=R();s&&(s.set(v("open",1),r,{scope:"public"}),s.set(v("closed",1),l,{scope:"public"}))}async function f(){let r=await m(`/polls?state=open&page=1&pageSize=${U}`,{auth:"optional",authSnapshot:n}),l=await m(`/polls?state=closed&page=${a}&pageSize=${H}`,{auth:"optional",authSnapshot:n});if(!r.ok||!l.ok)throw new Error("Failed to load poll lists");let s=k(r.data,1),p=k(l.data,a);a=p.page,c(r.data,l.data),z(t,{auth:n,open:s,closed:p}),i()}d()?f().catch(()=>{}):await f(),o&&typeof o.then=="function"&&o.then(async r=>{!r||!r.authenticated||n.authenticated||(n=r,await f())}).catch(()=>{})}async function ot(t,e,o,n=null){var r;let a=o||w(),i="idle",d=await m(`/polls/${encodeURIComponent(e)}`,{auth:"optional",authSnapshot:a});if(d.status===403||d.status===401){tt(t,e);let l=t.querySelector('[data-dx-poll-action="signin"]');l&&l.addEventListener("click",async()=>{await C(a)});return}if(!d.ok)throw new Error(`Unable to load poll ${e}`);let c=A(((r=d.data)==null?void 0:r.poll)||d.data);if(!c.id)throw new Error("Poll payload is missing id");async function f(){var s;let l=await m(`/polls/${encodeURIComponent(c.id)}/results`,{auth:"optional",authSnapshot:a});if(!l.ok)throw new Error("Unable to load poll results");return G(((s=l.data)==null?void 0:s.results)||l.data)}async function x(){let l=await f();Y(t,c,l,a,i),t.querySelectorAll('[data-dx-poll-action="vote"]').forEach(s=>{s.addEventListener("click",async()=>{let p=Number(s.getAttribute("data-dx-poll-option"));if(!(!Number.isInteger(p)||p<0)){if(a=await E(),!a.authenticated){await C(a);return}i="saving";try{let b=await m(`/polls/${encodeURIComponent(c.id)}/vote`,{method:"POST",auth:"required",authSnapshot:a,body:{optionIndex:p}});if(!b.ok){if(b.status===409){i="error",await x();return}throw new Error("Vote failed")}i="saved",await x(),window.setTimeout(()=>{i="idle",x().catch(()=>{})},900)}catch{i="error",await x()}}})})}await x(),n&&typeof n.then=="function"&&n.then(async l=>{!l||!l.authenticated||a.authenticated||(a=l,await x())}).catch(()=>{})}async function at(){let t=J();if(!t)return;j();let e=performance.now();L(t,"loading");try{let o=w(),n=E(),a=W(t);a.type==="detail"&&a.pollId?await ot(t,a.pollId,o,n):await et(t,o,n),await B(e),L(t,"ready")}catch(o){console.error("[dx-polls] boot error",o),K(t,"Unable to load polls right now. Please try again."),await B(e),L(t,"error")}}let g=null,_=!1;async function nt(){do _=!1,await at();while(_)}function h(){return g?(_=!0,g):(g=nt().catch(t=>{console.error("[dx-polls] queue boot error",t)}).finally(()=>{g=null}),g)}window.__dxPollsQueueBoot=h,window.addEventListener("dx:slotready",()=>{h().catch(()=>{})}),window.addEventListener("popstate",()=>{h().catch(()=>{})}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{h().catch(()=>{})},{once:!0}):h().catch(()=>{})})();})();
