(()=>{(()=>{if(typeof window=="undefined")return;if(window.__dxSubmissionTimelineRuntimeLoaded){if(typeof window.__dxSubmissionTimelineMount=="function")try{window.__dxSubmissionTimelineMount()}catch{}return}window.__dxSubmissionTimelineRuntimeLoaded=!0;let _="loading",g="ready",T="error",v=6e3,$=7e3,l=120,L="https://dex-api.spring-fog-8edd.workers.dev";function p(t){return typeof t=="object"&&t!==null}function m(t,e,a){let r=0;return Promise.race([Promise.resolve(t),new Promise(s=>{r=window.setTimeout(()=>s(a),e)})]).finally(()=>{r&&window.clearTimeout(r)})}function x(t){return new Promise(e=>window.setTimeout(e,Math.max(0,t)))}function b(t,e){t&&(t.setAttribute("data-dx-fetch-state",e),e===_?t.setAttribute("aria-busy","true"):t.removeAttribute("aria-busy"))}function U(t){var a;let e=((a=t==null?void 0:t.dataset)==null?void 0:a.api)||window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||L;return String(e||L).trim().replace(/\/+$/,"")}function o(t,e=""){return String(t==null?"":t).trim()||e}function w(t){let e=Date.parse(String(t||""));return Number.isFinite(e)?e:null}function y(t){let e=w(t);if(e===null)return"Unknown time";try{return new Date(e).toLocaleString()}catch{return new Date(e).toISOString()}}function u(t){return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function D(){return window.DEX_AUTH||window.dexAuth||null}async function M(t=v){var d;let e=D();if(!e)return{auth:null,authenticated:!1,token:"",user:null,sub:""};try{typeof e.resolve=="function"?await m(e.resolve(t),t,null):e.ready&&typeof e.ready.then=="function"&&await m(e.ready,t,null)}catch{}let a=!1;try{if(typeof e.isAuthenticated=="function")a=!!await m(e.isAuthenticated(),t,!1);else if(e.ready&&typeof e.ready.then=="function"){let n=await m(e.ready,t,null);a=!!(p(n)&&n.isAuthenticated)}}catch{a=!1}let r=null;try{typeof e.getUser=="function"&&(r=await m(e.getUser(),t,null))}catch{r=null}let s=o((r==null?void 0:r.sub)||window.auth0Sub||((d=window.AUTH0_USER)==null?void 0:d.sub),""),i="";if(a&&typeof e.getAccessToken=="function")try{i=o(await m(e.getAccessToken(),t,""),"")}catch{i=""}return{auth:e,authenticated:a,token:i,user:r,sub:s}}async function E(t,e,a){let r=new AbortController,s=window.setTimeout(()=>r.abort(),a);try{let i=await fetch(t,{...e,signal:r.signal}),d=null;try{d=await i.json()}catch{d=null}return{ok:i.ok,status:i.status,payload:d}}finally{window.clearTimeout(s)}}function j(){let t=new URLSearchParams(window.location.search||"");return o(t.get("sid"),"").replace(/[^a-zA-Z0-9._:-]/g,"")}function R(){if(document.getElementById("dx-submission-runtime-style"))return;let t=document.createElement("style");t.id="dx-submission-runtime-style",t.textContent=`
      #dex-submission{width:100%;}
      #dex-submission .dx-sub-shell{display:grid;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.32);border-radius:10px;background:rgba(255,255,255,.18);backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%);box-shadow:0 8px 24px rgba(0,0,0,.12);font-family:'Courier New',monospace;color:#171a1f;}
      #dex-submission .dx-sub-head{display:grid;gap:8px;}
      #dex-submission .dx-sub-kicker{margin:0;font-size:.75rem;letter-spacing:.04em;text-transform:uppercase;color:rgba(17,24,39,.7);}
      #dex-submission .dx-sub-title{margin:0;font-family:'Typefesse',sans-serif;font-size:clamp(1.2rem,3.1vw,1.9rem);line-height:1.12;}
      #dex-submission .dx-sub-status{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      #dex-submission .dx-sub-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.45);border-radius:7px;padding:4px 8px;font-size:.74rem;background:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.02em;}
      #dex-submission .dx-sub-chip--critical{background:rgba(168,27,27,.14);border-color:rgba(168,27,27,.34);}
      #dex-submission .dx-sub-chip--warning{background:rgba(193,116,0,.14);border-color:rgba(193,116,0,.34);}
      #dex-submission .dx-sub-chip--info{background:rgba(22,80,173,.11);border-color:rgba(22,80,173,.26);}
      #dex-submission .dx-sub-stage-rail{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px;}
      #dex-submission .dx-sub-stage{border:1px solid rgba(255,255,255,.32);border-radius:8px;padding:8px;background:rgba(255,255,255,.5);display:grid;gap:4px;min-height:62px;}
      #dex-submission .dx-sub-stage[data-state='done']{border-color:rgba(18,116,35,.46);background:rgba(27,138,50,.14);}
      #dex-submission .dx-sub-stage[data-state='active']{border-color:rgba(255,25,16,.52);background:rgba(255,25,16,.13);box-shadow:inset 0 0 0 1px rgba(255,25,16,.27);}
      #dex-submission .dx-sub-stage[data-state='todo']{opacity:.76;}
      #dex-submission .dx-sub-stage-label{margin:0;font-size:.82rem;font-weight:700;}
      #dex-submission .dx-sub-stage-time{margin:0;font-size:.74rem;color:rgba(17,24,39,.7);}
      #dex-submission .dx-sub-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
      #dex-submission .dx-sub-card{border:1px solid rgba(255,255,255,.34);border-radius:8px;padding:10px;background:rgba(255,255,255,.58);display:grid;gap:6px;}
      #dex-submission .dx-sub-links{display:flex;gap:8px;flex-wrap:wrap;}
      #dex-submission .dx-sub-link{display:inline-flex;align-items:center;gap:6px;font-size:.84rem;color:#111827;text-decoration:none;}
      #dex-submission .dx-sub-link:hover{text-decoration:underline;}
      #dex-submission .dx-sub-timeline{display:grid;gap:8px;}
      #dex-submission .dx-sub-item{border:1px solid rgba(255,255,255,.32);border-radius:8px;padding:10px;background:rgba(255,255,255,.66);display:grid;gap:6px;}
      #dex-submission .dx-sub-item-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;}
      #dex-submission .dx-sub-item-type{margin:0;font-size:.78rem;letter-spacing:.03em;text-transform:uppercase;color:rgba(17,24,39,.72);}
      #dex-submission .dx-sub-item-time{margin:0;font-size:.74rem;color:rgba(17,24,39,.72);}
      #dex-submission .dx-sub-item-body{margin:0;font-size:.88rem;line-height:1.35;color:#111827;}
      #dex-submission .dx-sub-actions{display:flex;gap:8px;flex-wrap:wrap;}
      #dex-submission .dx-sub-btn{appearance:none;border:1px solid rgba(255,255,255,.42);background:rgba(255,255,255,.6);color:#111827;border-radius:8px;padding:7px 10px;font-size:.8rem;line-height:1;cursor:pointer;}
      #dex-submission .dx-sub-btn:disabled{opacity:.5;cursor:not-allowed;}
      #dex-submission .dx-sub-warning{margin:0;padding:10px 12px;border:1px solid rgba(255,180,0,.45);border-radius:8px;background:rgba(255,191,0,.14);font-size:.85rem;}
      #dex-submission .dx-sub-empty{margin:0;padding:14px 12px;border:1px dashed rgba(17,24,39,.3);border-radius:9px;background:rgba(255,255,255,.45);font-size:.9rem;}
      @media (max-width:880px){
        #dex-submission .dx-sub-grid{grid-template-columns:1fr;}
      }
    `,document.head.appendChild(t)}function H(t){let e=String(t||"").trim().toLowerCase();return e==="critical"?"dx-sub-chip--critical":e==="warning"?"dx-sub-chip--warning":"dx-sub-chip--info"}function C(t){let e=String(t||"").toLowerCase();return e==="rejected"?"critical":e==="revision_requested"?"warning":"info"}function B(t){return(Array.isArray(t)?t:[]).map((a,r)=>{let s=p(a)?a:{},i=o(s.eventType||s.event_type||s.stage,"event"),d=o(s.publicNote||s.public_note,""),n=o(s.statusRaw||s.status_raw,""),c=o(s.libraryHref||s.library_href,""),A=o(s.eventAt||s.event_at||s.createdAt||s.created_at,"");return{id:o(s.id,`timeline-${r+1}`),eventType:i,publicNote:d,statusRaw:n,libraryHref:c,createdAt:A}}).sort((a,r)=>{let s=w(a.createdAt)||0,i=w(r.createdAt)||0;return s-i})}function P(t,e,a){let r=[{key:"sent",label:"Sent"},{key:"received",label:"Received"},{key:"acknowledged",label:"Acknowledged"},{key:"reviewing",label:"Reviewing"},{key:"accepted",label:"Accepted"},{key:"rejected",label:"Rejected"},{key:"in_library",label:"In library"}];if(p(t)&&Array.isArray(t.steps))return t.steps.map((d,n)=>{let c=p(d)?d:{};return{key:o(c.key,`stage-${n+1}`),label:o(c.label,o(c.key,"Stage")),state:o(c.state,"todo"),at:o(c.at,"")}});let s=new Set;for(let d of e)s.add(String(d.eventType||"").toLowerCase());let i=String(a.currentStage||"").toLowerCase();return r.map(d=>{let n=d.key,c="todo";return i===n?c="active":(s.has(n)||n==="accepted"&&i==="in_library")&&(c="done"),{...d,state:c,at:""}})}function N(t){t.innerHTML=`
      <aside class="dx-sub-shell">
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">Submission Timeline</h1>
          <p class="dx-sub-empty" id="dx-sub-signin">Please sign in to view submission details.</p>
        </section>
      </aside>
    `}function h(t,e,a){t.innerHTML=`
      <aside class="dx-sub-shell">
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${u(e||"Submission Timeline")}</h1>
          <p class="dx-sub-empty">${u(a||"Unable to load this submission right now.")}</p>
        </section>
      </aside>
    `}function k(t,e){R();let a=e.timeline.length?e.timeline.map(n=>{let c=o(n.eventType,"event").replace(/_/g," "),A=n.publicNote?`<p class="dx-sub-item-body">${u(n.publicNote)}</p>`:"",I=n.statusRaw?`<span class="dx-sub-chip ${H(C(n.eventType))}">${u(n.statusRaw)}</span>`:"",X=n.libraryHref?`<a class="dx-sub-link" href="${u(n.libraryHref)}">Library link</a>`:"";return`
            <article class="dx-sub-item" data-dx-sub-item data-event-id="${u(n.id)}">
              <div class="dx-sub-item-head">
                <p class="dx-sub-item-type">${u(c)}</p>
                <p class="dx-sub-item-time">${u(y(n.createdAt))}</p>
              </div>
              ${A}
              <div class="dx-sub-links">${I}${X}</div>
            </article>
          `}).join(""):'<p class="dx-sub-empty">No timeline events yet.</p>',r=e.stageRail.map(n=>`
        <article class="dx-sub-stage" data-state="${u(n.state)}">
          <p class="dx-sub-stage-label">${u(n.label)}</p>
          <p class="dx-sub-stage-time">${u(n.at?y(n.at):"")}</p>
        </article>
      `).join(""),s=e.warning?`<p class="dx-sub-warning">${u(e.warning)}</p>`:"",i=e.thread.sourceLink?`<a class="dx-sub-link" href="${u(e.thread.sourceLink)}">Source submission</a>`:"",d=e.thread.libraryHref?`<a class="dx-sub-link" href="${u(e.thread.libraryHref)}">In library</a>`:"";t.innerHTML=`
      <aside class="dx-sub-shell">
        <section class="dx-sub-head">
          <p class="dx-sub-kicker">submission tracker</p>
          <h1 class="dx-sub-title">${u(e.thread.lookup||e.thread.title||"Submission")}</h1>
          <div class="dx-sub-status">
            <span class="dx-sub-chip ${H(C(e.thread.currentStage))}">${u(e.thread.currentStage.replace(/_/g," "))}</span>
            <span class="dx-sub-chip">Updated ${u(y(e.thread.updatedAt))}</span>
          </div>
        </section>

        <section class="dx-sub-stage-rail" id="dx-sub-stage-rail">${r}</section>

        <section class="dx-sub-grid">
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Submission</p>
            <p class="dx-sub-item-body">${u(e.thread.title||"Untitled submission")}</p>
            <p class="dx-sub-item-body">${u(e.thread.creator||"")}</p>
            <p class="dx-sub-item-body">${u(e.thread.currentStatusRaw||"")}</p>
          </article>
          <article class="dx-sub-card">
            <p class="dx-sub-kicker">Links</p>
            <div class="dx-sub-links">${i}${d}</div>
          </article>
        </section>

        ${s}

        <section>
          <div class="dx-sub-actions">
            <button type="button" class="dx-sub-btn" data-dx-sub-action="ack" ${e.thread.acknowledgedAt?"disabled":""}>Acknowledge</button>
            <a class="dx-sub-btn" href="/entry/messages/">Back to inbox</a>
          </div>
        </section>

        <section class="dx-sub-timeline" id="dx-sub-timeline">${a}</section>
      </aside>
    `}async function z(t,e,a){let r=await E(`${t}/me/submissions/${encodeURIComponent(a)}`,{method:"GET",headers:{authorization:`Bearer ${e.token}`,"content-type":"application/json"}},$);if(!r.ok)return{ok:!1,status:r.status,payload:r.payload};let s=p(r.payload)?r.payload:{},i=p(s.thread)?s.thread:{},d=B(s.timeline),n={submissionId:o(i.submissionId||i.submission_id,a),lookup:o(i.lookup,""),title:o(i.title,""),creator:o(i.creator,""),currentStage:o(i.currentStage||i.current_stage,"reviewing"),currentStatusRaw:o(i.currentStatusRaw||i.current_status_raw,""),updatedAt:o(i.updatedAt||i.updated_at,""),acknowledgedAt:o(i.acknowledgedAt||i.acknowledged_at,""),sourceLink:o(i.sourceLink||i.source_link,""),libraryHref:o(i.libraryHref||i.library_href,"")};return{ok:!0,status:r.status,thread:n,timeline:d,stageRail:P(s.stageRail||s.stage_rail,d,n),warning:""}}async function O(t,e,a){return E(`${t}/me/submissions/${encodeURIComponent(a)}/ack`,{method:"POST",headers:{authorization:`Bearer ${e.token}`,"content-type":"application/json"}},$)}function S(t,e){if(t.__dxSubmissionEventAbortController instanceof AbortController)try{t.__dxSubmissionEventAbortController.abort()}catch{}let a=new AbortController;t.__dxSubmissionEventAbortController=a,t.addEventListener("click",async r=>{let s=r.target;if(!(s instanceof HTMLElement)||s.getAttribute("data-dx-sub-action")!=="ack")return;if(s.setAttribute("disabled","disabled"),(await O(e.apiBase,e.authSnapshot,e.sid)).ok){let n=await z(e.apiBase,e.authSnapshot,e.sid);if(n.ok){e.model=n,k(t,e.model),S(t,e);return}}e.model.warning="Unable to acknowledge this submission right now.",k(t,e.model),S(t,e)},{signal:a.signal})}async function F(t){R();let e=performance.now();b(t,_);let a=j();if(!a){h(t,"Submission Timeline","Missing or invalid submission id.");let n=performance.now()-e;n<l&&await x(l-n),b(t,g);return}let r=await M(v);if(!r.authenticated||!r.token){N(t);let n=performance.now()-e;n<l&&await x(l-n),b(t,g);return}let s=U(t),i=await z(s,r,a);if(!i.ok){if(i.status===403||i.status===404){h(t,"Submission Timeline","Submission not found for this account.");let c=performance.now()-e;c<l&&await x(l-c),b(t,g);return}h(t,"Submission Timeline","Unable to load this submission right now.");let n=performance.now()-e;n<l&&await x(l-n),b(t,T);return}k(t,i),S(t,{sid:a,apiBase:s,authSnapshot:r,model:i});let d=performance.now()-e;d<l&&await x(l-d),b(t,g)}async function G(t={}){let e=document.getElementById("dex-submission");if(!(e instanceof HTMLElement))return!1;let a=!!t.force,r=e.getAttribute("data-dx-sub-booting")==="true",s=e.getAttribute("data-dx-sub-mounted")==="true";if(r||s&&!a)return!0;e.setAttribute("data-dx-sub-booting","true"),a&&e.removeAttribute("data-dx-sub-mounted");try{return await F(e),e.setAttribute("data-dx-sub-mounted","true"),!0}catch{return b(e,T),!1}finally{e.removeAttribute("data-dx-sub-booting")}}function f(t={}){G(t).catch(()=>{})}window.__dxSubmissionTimelineMount=()=>{f()},window.addEventListener("dx:slotready",()=>{f({force:!0})}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>f(),{once:!0}):f()})();})();
