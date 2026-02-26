(()=>{(()=>{if(typeof window=="undefined"||window.__dxMessagesInboxRuntimeLoaded)return;window.__dxMessagesInboxRuntimeLoaded=!0;let A=120,N=2500,S=6e3,P=6e3,j=5e3,J=90,R="https://script.google.com/macros/s/AKfycbyh5TPML3_y5-j1QoOKfju_MayO1_0JErwvVkH3Eba195q_EmWGCEu3CdFFeohWes3Qzw/exec",C="https://dex-api.spring-fog-8edd.workers.dev",U="dex:messages:submission-state:v1:",L="loading",M="ready",X="error";function y(e){return typeof e=="object"&&e!==null}function x(e,t,s){let i=0;return Promise.race([Promise.resolve(e),new Promise(r=>{i=window.setTimeout(()=>r(s),t)})]).finally(()=>{i&&window.clearTimeout(i)})}function $(e){return new Promise(t=>window.setTimeout(t,Math.max(0,e)))}function _(){return new Date().toISOString()}function w(e){let t=Date.parse(String(e||""));return Number.isFinite(t)?t:null}function O(e){let t=w(e);return t===null?_():new Date(t).toISOString()}function u(e,t=""){return String(e==null?"":e).trim()||t}function Y(e){var s;let t=((s=e==null?void 0:e.dataset)==null?void 0:s.api)||window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||C;return String(t||C).trim().replace(/\/+$/,"")}function T(e,t){e&&(e.setAttribute("data-dx-fetch-state",t),t===L?e.setAttribute("aria-busy","true"):e.removeAttribute("aria-busy"))}function q(e){let t=w(e);if(t===null)return"Unknown time";try{return new Date(t).toLocaleString()}catch{return new Date(t).toISOString()}}function m(e){return String(e==null?"":e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function G(e){let t=String(e||"").trim().toLowerCase();return t==="critical"||t==="warning"||t==="info"?t:"info"}function W(e){let t=String(e||"").trim().toLowerCase();return t.includes("rejected")?"critical":t.includes("revision")?"warning":"info"}function K(e){return u(e==null?void 0:e.sub,"")||"anon"}function Q(e){let t=`${U}${e}`;try{let s=window.localStorage.getItem(t);if(!s)return{};let i=JSON.parse(s);return y(i)?i:{}}catch{return{}}}function V(e,t){let s=`${U}${e}`;try{window.localStorage.setItem(s,JSON.stringify(t||{}))}catch{}}async function z(e,t){return new Promise((s,i)=>{let r=`dxMsgCb${Math.random().toString(36).slice(2)}`,a=document.createElement("script"),o=!1,c=0;function n(){c&&window.clearTimeout(c);try{delete window[r]}catch{window[r]=void 0}a.parentNode&&a.parentNode.removeChild(a)}window[r]=p=>{o||(o=!0,n(),s(p))},a.onerror=()=>{o||(o=!0,n(),i(new Error("JSONP request failed")))},c=window.setTimeout(()=>{o||(o=!0,n(),i(new Error("JSONP request timed out")))},t);let l=e.includes("?")?"&":"?";a.src=`${e}${l}callback=${r}`,document.body.appendChild(a)})}async function H(e,t,s){let i=new AbortController,r=window.setTimeout(()=>i.abort(),s);try{let a=await fetch(e,{...t,signal:i.signal}),o=null;try{o=await a.json()}catch{o=null}return{ok:a.ok,status:a.status,payload:o}}finally{window.clearTimeout(r)}}function Z(){return window.DEX_AUTH||window.dexAuth||null}async function ee(e=N){var o;let t=Z();if(!t)return{auth:null,authenticated:!1,token:"",user:null,sub:""};try{typeof t.resolve=="function"?await x(t.resolve(e),e,null):t.ready&&typeof t.ready.then=="function"&&await x(t.ready,e,null)}catch{}let s=!1;try{if(typeof t.isAuthenticated=="function")s=!!await x(t.isAuthenticated(),e,!1);else if(t.ready&&typeof t.ready.then=="function"){let c=await x(t.ready,e,null);s=!!(y(c)&&c.isAuthenticated)}}catch{s=!1}let i=null;try{typeof t.getUser=="function"&&(i=await x(t.getUser(),e,null))}catch{i=null}let r=u((i==null?void 0:i.sub)||window.auth0Sub||((o=window.AUTH0_USER)==null?void 0:o.sub),""),a="";if(s&&typeof t.getAccessToken=="function")try{a=u(await x(t.getAccessToken(),e,""),"")}catch{a=""}return{auth:t,authenticated:s,token:a,user:i,sub:r}}function te(e){let t=String(e||"").trim().toLowerCase();return t==="submission"||t==="system"?t:"system"}function se(e){return String(e||"").trim()||"general"}function ne(e,t){let s=y(e)?e:{},i=u(s.id,`system-${t+1}`),r=O(s.createdAt||s.created_at||s.timestamp);return{id:i,sourceType:te(s.sourceType||s.source_type||"system"),category:se(s.category),severity:G(s.severity),title:u(s.title,"Untitled notification"),body:u(s.body||s.message,""),href:u(s.href,""),metadata:y(s.metadata)?s.metadata:{},createdAt:r,readAt:u(s.readAt||s.read_at,""),archivedAt:u(s.archivedAt||s.archived_at,""),expiresAt:u(s.expiresAt||s.expires_at,""),permanent:!1}}function ie(e){let t=w(e==null?void 0:e.expiresAt);return t===null?!1:t<=Date.now()}function ae(e){if(!e||e.sourceType==="submission")return!1;let t=w(e.createdAt);return t===null?!1:Date.now()-t>J*24*60*60*1e3}function re(e,t,s){let i=u(e==null?void 0:e.row,`${t+1}`),r=u((e==null?void 0:e.timestamp)||(e==null?void 0:e.createdAt)||(e==null?void 0:e.created_at),"unknown");return`submission:${s||"anon"}:${i}:${r}`}function oe(e,t){let s=u((e==null?void 0:e.collectionType)||(e==null?void 0:e.collection_type),"U"),i=u(e==null?void 0:e.row,"0"),r=u(e==null?void 0:e.license,"NA");return`Sub. ${s}${t} ${i}.${r}`}function ce(e,t,s){let i=Array.isArray(e)?e:[],r=new Date().getFullYear();return i.map((a,o)=>{let c=re(a,o,t),n=y(s[c])?s[c]:{},l=u(a==null?void 0:a.status,"Submitted"),p=O((a==null?void 0:a.timestamp)||(a==null?void 0:a.createdAt)||(a==null?void 0:a.created_at));return{id:c,sourceType:"submission",category:"submissions",severity:W(l),title:oe(a,r),body:u(a==null?void 0:a.note,""),href:"/entry/submit/",metadata:{row:a==null?void 0:a.row,status:l,license:a==null?void 0:a.license,collectionType:(a==null?void 0:a.collectionType)||(a==null?void 0:a.collection_type)},createdAt:p,readAt:u(n.readAt,""),archivedAt:u(n.archivedAt,""),expiresAt:"",permanent:!0}})}async function de(e,t){if(!e)return{records:[],warning:""};let s=await x(z(`${R}?action=list&auth0Sub=${encodeURIComponent(e)}`,S),S+100,{status:"timeout",rows:[]}),i=Array.isArray(s==null?void 0:s.rows)?s.rows:[];return{records:ce(i,e,t),warning:""}}async function ue(e,t){if(!t.authenticated||!t.token)return{records:[],warning:""};let s=`${e}/me/messages?limit=200`,i=await H(s,{method:"GET",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/json"}},P);if(!i.ok)return{records:[],warning:"System notifications are temporarily unavailable."};let r=y(i.payload)?i.payload:{};return{records:(Array.isArray(r.messages)?r.messages:Array.isArray(r.data)?r.data:Array.isArray(r.items)?r.items:[]).map((c,n)=>ne(c,n)).filter(c=>!ie(c)).filter(c=>!ae(c)),warning:""}}async function k(e,t,s,i){if(!t.authenticated||!t.token)return{ok:!1,status:401};let r=i==="read-all"?"/me/messages/read-all":`/me/messages/${encodeURIComponent(s)}/${i}`,a=await H(`${e}${r}`,{method:"POST",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/json"}},j);return{ok:a.ok,status:a.status}}function E(){if(document.getElementById("dx-messages-runtime-style"))return;let e=document.createElement("style");e.id="dx-messages-runtime-style",e.textContent=`
      #dex-msg{width:100%;}
      #dex-msg .dx-msg-shell{display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.32);border-radius:10px;background:rgba(255,255,255,.18);backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%);box-shadow:0 8px 24px rgba(0,0,0,.12);font-family:'Courier New',monospace;color:#171a1f;}
      #dex-msg .dx-msg-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
      #dex-msg .dx-msg-title{margin:0;font-family:'Typefesse',sans-serif;font-size:clamp(1.4rem,3.2vw,1.95rem);}
      #dex-msg .dx-msg-sub{margin:0;color:rgba(20,24,31,.78);font-size:.9rem;}
      #dex-msg .dx-msg-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      #dex-msg .dx-msg-btn{appearance:none;border:1px solid rgba(255,255,255,.42);background:rgba(255,255,255,.6);color:#111827;border-radius:8px;padding:7px 10px;font-size:.8rem;line-height:1;cursor:pointer;}
      #dex-msg .dx-msg-btn.is-active{background:#ff1910;color:#fff;border-color:#ff1910;}
      #dex-msg .dx-msg-btn:disabled{opacity:.5;cursor:not-allowed;}
      #dex-msg .dx-msg-toggle{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:#1f2937;}
      #dex-msg .dx-msg-warning{margin:0;padding:10px 12px;border:1px solid rgba(255,180,0,.45);border-radius:8px;background:rgba(255,191,0,.14);font-size:.85rem;}
      #dex-msg .dx-msg-list{display:grid;grid-template-columns:1fr;gap:10px;min-height:120px;}
      #dex-msg .dx-msg-item{border:1px solid rgba(255,255,255,.36);border-radius:9px;background:rgba(255,255,255,.7);padding:12px;display:grid;gap:10px;}
      #dex-msg .dx-msg-item[data-source-type='submission']{border-left:4px solid #ff1910;}
      #dex-msg .dx-msg-item[data-source-type='system']{border-left:4px solid #1f2937;}
      #dex-msg .dx-msg-item[data-dx-msg-read='false']{box-shadow:inset 0 0 0 1px rgba(255,25,16,.3);}
      #dex-msg .dx-msg-item[data-dx-msg-archived='true']{opacity:.62;}
      #dex-msg .dx-msg-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;}
      #dex-msg .dx-msg-kicker{margin:0;font-size:.75rem;letter-spacing:.02em;text-transform:uppercase;color:rgba(17,24,39,.72);}
      #dex-msg .dx-msg-heading{margin:0;font-size:1rem;line-height:1.2;}
      #dex-msg .dx-msg-time{margin:0;font-size:.78rem;color:rgba(17,24,39,.72);}
      #dex-msg .dx-msg-body{margin:0;font-size:.88rem;line-height:1.35;color:#111827;}
      #dex-msg .dx-msg-footer{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
      #dex-msg .dx-msg-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.42);border-radius:7px;padding:4px 8px;font-size:.75rem;background:rgba(255,255,255,.55);}
      #dex-msg .dx-msg-chip--critical{background:rgba(168,27,27,.14);border-color:rgba(168,27,27,.34);}
      #dex-msg .dx-msg-chip--warning{background:rgba(193,116,0,.14);border-color:rgba(193,116,0,.34);}
      #dex-msg .dx-msg-chip--info{background:rgba(22,80,173,.11);border-color:rgba(22,80,173,.26);}
      #dex-msg .dx-msg-actions{display:flex;flex-wrap:wrap;gap:6px;}
      #dex-msg .dx-msg-empty{margin:0;padding:14px 12px;border:1px dashed rgba(17,24,39,.3);border-radius:9px;background:rgba(255,255,255,.45);font-size:.9rem;}
      #dex-msg .dx-msg-link{display:inline-flex;align-items:center;gap:6px;font-size:.84rem;text-decoration:none;color:#111827;}
      #dex-msg .dx-msg-link:hover{text-decoration:underline;}
      #dex-msg .dx-msg-badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#ff1910;color:#fff;font-size:.72rem;line-height:1;}
      @media (max-width:720px){
        #dex-msg .dx-msg-shell{padding:12px;}
        #dex-msg .dx-msg-controls{width:100%;}
      }
    `,document.head.appendChild(e)}function le(e){return e==="critical"?"dx-msg-chip--critical":e==="warning"?"dx-msg-chip--warning":"dx-msg-chip--info"}function ge(e){let t=String(e||"").toLowerCase();return t==="submission"||t==="system"?t:"all"}function B(e,t,s){return e.filter(i=>!s&&i.archivedAt?!1:t==="submission"?i.sourceType==="submission":t==="system"?i.sourceType==="system":!0)}function me(e){return e.filter(t=>!t.archivedAt&&!t.readAt).length}function I(e){let t=Number.isFinite(Number(e))?Math.max(0,Number(e)):0;window.__dxMessagesUnreadCount=t;try{window.dispatchEvent(new CustomEvent("dx:messages:unread-count",{detail:{count:t}}))}catch{}}function pe(e,t){let s=w(e.createdAt)||0;return(w(t.createdAt)||0)-s}function fe(e,t){return[...e,...t].sort(pe)}function be(e,t){return e.find(s=>s.id===t)||null}function v(e,t,s,i){let r=y(t[s])?t[s]:{};t[s]={...r,...i},V(e,t)}function f(e,t){E();let s=B(t.records,t.filter,t.showArchived),i=me(t.records);I(i);let r=t.warnings.filter(Boolean).map(n=>`<p class="dx-msg-warning">${m(n)}</p>`).join(""),o=[{key:"all",label:"All"},{key:"submission",label:"Submissions"},{key:"system",label:"System"}].map(n=>`<button class="dx-msg-btn${t.filter===n.key?" is-active":""}" type="button" data-dx-msg-filter="${n.key}">${n.label}</button>`).join(""),c=s.length===0?'<p class="dx-msg-empty">No messages for this filter yet.</p>':s.map(n=>{var F;let l=n.sourceType==="submission"?"Submission":"System",p=n.readAt?"true":"false",g=n.archivedAt?"true":"false",d=n.readAt?"unread":"read",h=n.readAt?"Mark unread":"Mark read",b=(F=n.metadata)==null?void 0:F.row,he=n.sourceType==="submission"&&Number.isFinite(Number(b)),Ae=n.body?`<p class="dx-msg-body">${m(n.body)}</p>`:"",we=n.href?`<a class="dx-msg-link" href="${m(n.href)}">Open</a>`:"";return`
            <article class="dx-msg-item" data-dx-msg-item data-source-type="${m(n.sourceType)}" data-record-id="${m(n.id)}" data-dx-msg-read="${p}" data-dx-msg-archived="${g}">
              <div class="dx-msg-row">
                <div>
                  <p class="dx-msg-kicker">${m(l)} \xB7 ${m(n.category)}</p>
                  <h3 class="dx-msg-heading">${m(n.title)}</h3>
                </div>
                <p class="dx-msg-time">${m(q(n.createdAt))}</p>
              </div>
              ${Ae}
              <div class="dx-msg-footer">
                <span class="dx-msg-chip ${le(n.severity)}">${m(n.severity)}</span>
                ${we}
                <div class="dx-msg-actions">
                  <button class="dx-msg-btn" type="button" data-dx-msg-action="${d}" data-record-id="${m(n.id)}">${h}</button>
                  <button class="dx-msg-btn" type="button" data-dx-msg-action="archive" data-record-id="${m(n.id)}">Archive</button>
                  ${he?`<button class="dx-msg-btn" type="button" data-dx-msg-action="ack" data-record-id="${m(n.id)}">Acknowledge</button>`:""}
                </div>
              </div>
            </article>
          `}).join("");e.innerHTML=`
      <aside class="dx-msg-shell">
        <section class="dx-msg-head">
          <div>
            <h1 class="dx-msg-title">Inbox</h1>
            <p class="dx-msg-sub">Submission messages and account notifications in one place.</p>
          </div>
          <div class="dx-msg-controls">
            ${o}
            <label class="dx-msg-toggle">
              <input type="checkbox" data-dx-msg-toggle="archived" ${t.showArchived?"checked":""}>
              Show archived
            </label>
            <button class="dx-msg-btn" type="button" data-dx-msg-action="read-all">Mark visible unread as read</button>
            <span class="dx-msg-badge" id="dx-msg-unread-count">${i}</span>
          </div>
        </section>
        ${r}
        <section class="dx-msg-list" id="dx-msg-list">${c}</section>
      </aside>
    `}function xe(e,t,s){e.addEventListener("click",async i=>{var p;let r=i.target;if(!(r instanceof HTMLElement))return;let a=r.getAttribute("data-dx-msg-filter");if(a){t.filter=ge(a),f(e,t);return}let o=r.getAttribute("data-dx-msg-action");if(!o)return;if(o==="read-all"){let g=B(t.records,t.filter,t.showArchived).filter(b=>!b.readAt);if(!g.length)return;r.setAttribute("disabled","disabled");let d=_();for(let b of g)b.readAt=d,b.sourceType==="submission"&&v(s.scope,s.submissionState,b.id,{readAt:d});g.filter(b=>b.sourceType==="system").length&&((await k(s.apiBase,s.authSnapshot,"","read-all")).ok||(t.warnings=[...t.warnings,"Unable to persist bulk read for system notifications right now."])),f(e,t);return}let c=r.getAttribute("data-record-id");if(!c)return;let n=be(t.records,c);if(!n)return;r.setAttribute("disabled","disabled");let l=_();if(o==="read"){let g=n.readAt;n.readAt=l,n.sourceType==="submission"?v(s.scope,s.submissionState,n.id,{readAt:l}):(await k(s.apiBase,s.authSnapshot,n.id,"read")).ok||(n.readAt=g,t.warnings=[...t.warnings,"Unable to mark message as read right now."]),f(e,t);return}if(o==="unread"){let g=n.readAt;n.readAt="",n.sourceType==="submission"?v(s.scope,s.submissionState,n.id,{readAt:""}):(await k(s.apiBase,s.authSnapshot,n.id,"unread")).ok||(n.readAt=g,t.warnings=[...t.warnings,"Unable to mark message as unread right now."]),f(e,t);return}if(o==="archive"){let g=n.archivedAt;n.archivedAt=l,n.sourceType==="submission"?v(s.scope,s.submissionState,n.id,{archivedAt:l}):(await k(s.apiBase,s.authSnapshot,n.id,"archive")).ok||(n.archivedAt=g,t.warnings=[...t.warnings,"Unable to archive message right now."]),f(e,t);return}if(o==="ack"){if(n.sourceType!=="submission"){f(e,t);return}let g=Number((p=n.metadata)==null?void 0:p.row);if(!Number.isFinite(g)){t.warnings=[...t.warnings,"This submission cannot be acknowledged automatically."],f(e,t);return}let d=await x(z(`${R}?action=ack&row=${encodeURIComponent(String(g))}`,S),S+100,{status:"timeout"});String((d==null?void 0:d.status)||"").toLowerCase()==="ok"?(n.readAt=l,v(s.scope,s.submissionState,n.id,{readAt:l})):t.warnings=[...t.warnings,"Unable to acknowledge submission right now."],f(e,t)}}),e.addEventListener("change",i=>{let r=i.target;!(r instanceof HTMLElement)||r.getAttribute("data-dx-msg-toggle")!=="archived"||r instanceof HTMLInputElement&&(t.showArchived=!!r.checked,f(e,t))})}async function ye(e){e.innerHTML=`
      <aside class="dx-msg-shell">
        <section class="dx-msg-head">
          <div>
            <h1 class="dx-msg-title">Inbox</h1>
            <p class="dx-msg-sub">Sign in to view your submission messages and account notifications.</p>
          </div>
        </section>
        <p class="dx-msg-empty" id="dx-msg-signin">Please sign in to view your inbox.</p>
      </aside>
    `,I(0)}async function D(){let e=document.getElementById("dex-msg");if(!(e instanceof HTMLElement))return;let t=performance.now();T(e,L);let s=await ee(N),i=K(s),r=Q(i),a=Y(e);if(!s.authenticated||!i||i==="anon"){E(),await ye(e);let d=performance.now()-t;d<A&&await $(A-d),T(e,M);return}let o=[],c=[],n=[],l=!1;try{let[d,h]=await Promise.all([de(i,r),ue(a,s)]);o=Array.isArray(d.records)?d.records:[],c=Array.isArray(h.records)?h.records:[],d.warning&&n.push(d.warning),h.warning&&n.push(h.warning)}catch{l=!0}if(l){E(),e.innerHTML=`
        <aside class="dx-msg-shell">
          <section class="dx-msg-head">
            <div>
              <h1 class="dx-msg-title">Inbox</h1>
              <p class="dx-msg-sub">Unable to load inbox right now.</p>
            </div>
          </section>
          <p class="dx-msg-empty">Try refreshing this page. If the issue persists, visit support.</p>
        </aside>
      `,I(0);let d=performance.now()-t;d<A&&await $(A-d),T(e,X);return}let p={records:fe(o,c),filter:"all",showArchived:!1,warnings:n};f(e,p),xe(e,p,{apiBase:a,authSnapshot:s,scope:i,submissionState:r});let g=performance.now()-t;g<A&&await $(A-g),T(e,M)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{D().catch(()=>{})},{once:!0}):D().catch(()=>{})})();})();
