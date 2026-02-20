(function () {
  "use strict";

  var AUTH_UI_ID = "auth-ui";
  var DROPDOWN_OPEN_CLASS = "is-open";
  var PROTECTED_PATHS = {
    "/press": true,
    "/entry/2-organs-midori-ataka": true,
    "/entry/aidan-yeats": true,
    "/entry/amplified-knives-tyler-jordan": true,
    "/entry/amplified-printer": true,
    "/entry/amplified-tv-sam-pluta": true,
    "/entry/anant-shah": true,
    "/entry/andrew-chanover": true,
    "/entry/as-though-im-slipping": true,
    "/entry/bassoon-and-electronics": true,
    "/entry/bojun-zhang": true,
    "/entry/cello-emmanuel-losa": true,
    "/entry/cybernetic-scat-paul-hermansen": true,
    "/entry/electric-guitar-chris-mann": true,
    "/entry/electric-guitar-pedals-ethan-bailey-gould": true,
    "/entry/hammered-dulcimer-cameron-church": true,
    "/entry/multiperc": true,
    "/entry/no-input-mixer-jared-murphy": true,
    "/entry/prepared-bass-viol-suarez-solis": true,
    "/entry/prepared-harpsichord-suarez-solis": true,
    "/entry/prepared-oboe-sky-macklay": true,
    "/entry/sebastian-suarez-solis": true,
    "/entry/splinterings-jakob-heinemann": true,
    "/entry/this-is-a-tangible-space": true,
    "/entry/tim-feeney": true,
    "/entry/voice-everyday-object-manipulation-levi-lu": true
  };

  var authClient = null;
  var isAuthenticated = false;
  var lastUiAuth = false;
  var lastUiUser = null;
  var uiObserverStarted = false;
  var uiRepairQueued = false;

  function parseCssColorToRgb(value) {
    if (!value) return null;
    var str = String(value).trim().toLowerCase();
    if (!str || str === "transparent") return null;
    var m = str.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    var parts = m[1].split(",");
    if (parts.length < 3) return null;
    var r = parseFloat(parts[0]);
    var g = parseFloat(parts[1]);
    var b = parseFloat(parts[2]);
    var a = parts.length > 3 ? parseFloat(parts[3]) : 1;
    if (!isFinite(r) || !isFinite(g) || !isFinite(b) || !isFinite(a) || a <= 0) return null;
    return { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)), b: Math.max(0, Math.min(255, b)) };
  }

  function relativeLuminance(r, g, b) {
    function toLinear(channel) {
      var c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
  }

  function isLightBg(rgb) {
    if (!rgb) return false;
    return relativeLuminance(rgb.r, rgb.g, rgb.b) >= 0.6;
  }

  function findHeaderBackgroundElement(mount) {
    if (mount && mount.nodeType === 1) return mount;
    var fromMount = mount && mount.closest ? mount.closest("header") : null;
    if (fromMount) return fromMount;
    return document.querySelector("header") || document.body;
  }

  function getEffectiveBackgroundColor(el) {
    var current = el;
    var depth = 0;
    while (current && depth < 8) {
      var rgb = parseCssColorToRgb(window.getComputedStyle(current).backgroundColor);
      if (rgb) return rgb;
      current = current.parentElement;
      depth += 1;
    }
    return parseCssColorToRgb(window.getComputedStyle(document.body).backgroundColor) || { r: 16, g: 18, b: 24 };
  }

  function getAuthUiMarkup() {
    return ""
      + '<button id="auth-ui-signin" class="dex-auth-fallback-btn" type="button">SIGN IN</button>'
      + '<div id="auth-ui-profile" hidden>'
      + '  <button id="auth-ui-profile-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Profile">'
      + '    <span class="dex-avatar-wrap"><img id="auth-ui-avatar" alt="Profile avatar" src=""></span>'
      + '    <span class="dex-profile-chevron" aria-hidden="true"></span>'
      + "  </button>"
      + '  <div id="auth-ui-dropdown" role="menu" aria-label="Account menu">'
      + '    <a class="dex-menu-item" href="/catalog" role="menuitem">Catalog</a>'
      + '    <a class="dex-menu-item" href="/favorites" role="menuitem">Favorites</a>'
      + '    <a class="dex-menu-item" href="/polls" role="menuitem">Polls</a>'
      + '    <div class="dex-menu-sep" role="separator"></div>'
      + '    <a class="dex-menu-item" href="/entry/submit" role="menuitem">Submit Samples</a>'
      + '    <a class="dex-menu-item" href="/entry/messages" role="menuitem">Messages</a>'
      + '    <a class="dex-menu-item" href="/entry/pressroom" role="menuitem">Press Room</a>'
      + '    <div class="dex-menu-sep" role="separator"></div>'
      + '    <a class="dex-menu-item" href="/entry/settings" role="menuitem">Settings</a>'
      + '    <a class="dex-menu-item" href="/entry/achievements" role="menuitem">Achievements</a>'
      + '    <div class="dex-menu-sep" role="separator"></div>'
      + '    <button id="auth-ui-logout" class="dex-menu-item is-logout" type="button" role="menuitem">Log out</button>'
      + "  </div>"
      + "</div>";
  }

  function getDefaultAvatarDataUri(name) {
    var label = typeof name === "string" ? name.trim() : "";
    var initials = "U";
    if (label) {
      var parts = label.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        initials = (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      } else {
        initials = parts[0].slice(0, 2).toUpperCase();
      }
    }
    var safeInitials = initials.replace(/[^A-Z0-9]/gi, "").slice(0, 2) || "U";
    var svg = ""
      + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Avatar">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8cb4ff"/><stop offset="100%" stop-color="#5a78d8"/></linearGradient></defs>'
      + '<rect width="64" height="64" rx="32" fill="url(#g)"/>'
      + '<circle cx="32" cy="24" r="12" fill="rgba(255,255,255,0.22)"/>'
      + '<text x="32" y="42" text-anchor="middle" fill="#ffffff" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="22" font-weight="700">' + safeInitials + "</text>"
      + "</svg>";
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }
    function getCreateAuth0ClientFn() {
      if (typeof window.createAuth0Client === "function") return window.createAuth0Client;
      if (window.auth0 && typeof window.auth0.createAuth0Client === "function") return window.auth0.createAuth0Client;
      return null;
    }
    
    var FALLBACK_AUTH0 = {
      domain: "dexdsl.us.auth0.com",
      clientId: "M92hIItt3XQPUvGvK0t2xDtLMCK1mVqc",
      audience: "",
      redirectUri: window.location.origin + "/auth/callback/"
    };

    function getCfg() {
      var root = window.DEX_AUTH0_CONFIG;
      var cfg = root && root.current;
      if (cfg) return cfg;

      // fallback for your known hosts (covers “config script missing / load order” cases)
      var h = window.location.hostname;
      if (h === "dexdsl.github.io" || h === "dexdsl.org" || h === "dexdsl.com") {
        return FALLBACK_AUTH0;
      }
      return null;
    }
    
    function ensureAuthClient() {
      if (authClient) return Promise.resolve(authClient);

      var cfg = getCfg();
      if (!cfg) {
        return Promise.reject(
          new Error("Missing Auth0 config (host " + window.location.hostname + ")")
        );
      }
        var createAuth0Client = getCreateAuth0ClientFn();
        if (!createAuth0Client) {
          return Promise.reject(new Error("Auth0 SPA SDK missing (createAuth0Client)"));
        }

      var authorizationParams = {
        redirect_uri: cfg.redirectUri,
        scope: "openid profile email"
      };
      if (cfg.audience) authorizationParams.audience = cfg.audience;

        return createAuth0Client({
          domain: cfg.domain,
          clientId: cfg.clientId,
          authorizationParams: authorizationParams,
          cacheLocation: "localstorage",
          useRefreshTokens: !!(cfg && cfg.useRefreshTokens)
        }).then(function (client) {
          authClient = client;
          return client;
        });
    }

  function logError() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[dex-auth]");
    console.error.apply(console, args);
  }

  function normalizePath(pathname) {
    var path = pathname || "/";
    if (typeof path !== "string") {
      path = String(path || "/");
    }
    if (!path) {
      return "/";
    }
    if (path.charAt(0) !== "/") {
      path = "/" + path;
    }
    path = path.replace(/\/+/g, "/");
    if (path.length > 1 && path.charAt(path.length - 1) === "/") {
      path = path.slice(0, -1);
    }
    return path || "/";
  }

  function isProtectedPath(pathname) {
    return !!PROTECTED_PATHS[normalizePath(pathname)];
  }

  function isCallbackPath(pathname) {
    return normalizePath(pathname).indexOf("/auth/callback") === 0;
  }

  function getReturnToFromUrl(urlObj) {
    return (urlObj.pathname || "/") + (urlObj.search || "") + (urlObj.hash || "");
  }

  function hideLegacyAccountUi() {
    var nodes = document.querySelectorAll(
      ".customerAccountLoginDesktop, .customerAccountLoginMobile, [data-controller='UserAccountLink']"
    );
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].style.display = "none";
    }
  }

  function pickMount() {
    var selectors = [
      ".header-actions--right",
      ".header-actions",
      "header"
    ];
    var i;
    for (i = 0; i < selectors.length; i += 1) {
      var el = document.querySelector(selectors[i]);
      if (!el) {
        continue;
      }
      var cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") {
        continue;
      }
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        continue;
      }
      return el;
    }
    return document.body;
  }

  function ensureAuthUi() {
    hideLegacyAccountUi();

    var mount = pickMount();

    var styleId = "dex-auth-style";
    if (!document.getElementById(styleId)) {
      var style = document.createElement("style");
      style.id = styleId;
      style.textContent = ""
        + "#auth-ui{--dex-text:rgba(255,255,255,.92);--dex-text-muted:rgba(255,255,255,.78);--dex-panel-bg:linear-gradient(155deg,rgba(255,255,255,.14),rgba(255,255,255,.1) 42%,rgba(20,24,34,.62));--dex-row-bg:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.06));--dex-row-hover-bg:linear-gradient(140deg,rgba(255,255,255,.2),rgba(255,255,255,.1));--dex-border:rgba(255,255,255,.14);--dex-border-strong:rgba(255,255,255,.26);--dex-shadow:0 16px 44px rgba(0,0,0,.22);--dex-grain-opacity:.08;--dex-text-shadow:0 1px 1px rgba(0,0,0,.22);--dex-signin-bg:linear-gradient(135deg,rgba(125,164,255,.94),rgba(91,134,244,.9));--dex-signin-border:rgba(160,192,255,.54);--dex-signin-shadow:0 8px 22px rgba(40,76,165,.28);--dex-radius:10px;--dex-nav-h:38px;--dex-space-2:var(--space-2,8px);--dex-space-3:var(--space-3,12px);position:relative;top:0;display:inline-flex;align-items:center;align-self:center;vertical-align:middle;line-height:1;overflow:visible;padding:0;margin:0;gap:var(--dex-space-2);font-family:inherit;color:var(--dex-text);transform:translateY(var(--dex-nav-offset-y,0px));}"
        + "#auth-ui[data-dex-scheme='dark']{--dex-text:rgba(255,255,255,.92);--dex-text-muted:rgba(245,248,255,.84);--dex-panel-bg:linear-gradient(155deg,rgba(255,255,255,.14),rgba(255,255,255,.1) 42%,rgba(20,24,34,.62));--dex-row-bg:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.06));--dex-row-hover-bg:linear-gradient(140deg,rgba(255,255,255,.2),rgba(255,255,255,.1));--dex-border:rgba(255,255,255,.14);--dex-border-strong:rgba(255,255,255,.28);--dex-shadow:0 16px 44px rgba(0,0,0,.22);--dex-grain-opacity:.08;--dex-text-shadow:0 1px 1px rgba(0,0,0,.22);--dex-signin-bg:linear-gradient(135deg,rgba(125,164,255,.94),rgba(91,134,244,.9));--dex-signin-border:rgba(160,192,255,.54);--dex-signin-shadow:0 8px 22px rgba(40,76,165,.28);}"
        + "#auth-ui[data-dex-scheme='light']{--dex-text:rgba(15,18,25,.92);--dex-text-muted:rgba(28,35,52,.76);--dex-panel-bg:linear-gradient(150deg,rgba(255,255,255,.82),rgba(249,252,255,.72) 46%,rgba(238,244,255,.66));--dex-row-bg:linear-gradient(145deg,rgba(255,255,255,.72),rgba(246,250,255,.62));--dex-row-hover-bg:linear-gradient(145deg,rgba(255,255,255,.9),rgba(237,244,255,.75));--dex-border:rgba(15,18,25,.1);--dex-border-strong:rgba(15,18,25,.22);--dex-shadow:0 14px 36px rgba(0,0,0,.12);--dex-grain-opacity:0;--dex-text-shadow:none;--dex-signin-bg:linear-gradient(135deg,rgba(83,122,224,.96),rgba(63,97,192,.92));--dex-signin-border:rgba(39,64,130,.26);--dex-signin-shadow:0 7px 18px rgba(42,73,149,.22);}"
        + "#auth-ui,#auth-ui *,#auth-ui *::before,#auth-ui *::after{box-sizing:border-box;}"
        + "#auth-ui [hidden]{display:none!important;}"
        + "#auth-ui-signin,#auth-ui-profile-toggle{display:inline-flex;align-items:center;justify-content:center;min-height:34px;height:var(--dex-nav-h,38px);margin:0;line-height:1;}"
        + "#auth-ui-signin.dex-auth-fallback-btn{padding:0 14px;border:1px solid var(--dex-signin-border);border-radius:var(--dex-radius);background:var(--dex-signin-bg);color:#fff;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;box-shadow:var(--dex-signin-shadow);transition:border-color .2s ease,box-shadow .2s ease,filter .2s ease;}"
        + "#auth-ui-signin.dex-auth-fallback-btn:hover{transform:translateY(-1px);filter:brightness(1.03);box-shadow:0 10px 24px rgba(40,76,165,.28);}"
        + "#auth-ui-signin.dex-auth-fallback-btn:focus-visible,#auth-ui-profile-toggle:focus-visible,#auth-ui-dropdown .dex-menu-item:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(125,170,255,.45),0 0 0 4px rgba(22,26,38,.45);}"
        + "#auth-ui-profile{position:relative;display:inline-flex;align-items:center;overflow:visible;}"
        + "#auth-ui-profile-toggle{position:relative;gap:0;border:1px solid var(--dex-border);background:var(--dex-row-bg);width:auto;min-width:calc(var(--dex-nav-h,38px) + 22px);border-radius:var(--dex-radius);cursor:pointer;justify-content:flex-start;padding:2px 28px 2px 2px;backdrop-filter:blur(8px) saturate(132%);-webkit-backdrop-filter:blur(8px) saturate(132%);transition:border-color .22s ease,filter .22s ease,background .22s ease;overflow:hidden;}"
        + "#auth-ui-profile-toggle::before{content:'';position:absolute;inset:-30%;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,.35),rgba(255,255,255,0) 55%);opacity:0;transition:opacity .22s ease;z-index:0;}"
        + "#auth-ui-profile-toggle:hover{border-color:var(--dex-border-strong);filter:brightness(1.02);background:var(--dex-row-hover-bg);}"
        + "#auth-ui-profile-toggle:hover::before{opacity:1;}"
        + ".dex-avatar-wrap{position:relative;z-index:1;flex:0 0 auto;flex-shrink:0;width:calc(var(--dex-nav-h,38px) - 6px);height:calc(var(--dex-nav-h,38px) - 6px);min-width:calc(var(--dex-nav-h,38px) - 6px);border-radius:999px;overflow:hidden;}"
        + "#auth-ui-avatar{width:100%;height:100%;display:block;object-fit:cover;}"
        + "#auth-ui .dex-profile-chevron{position:absolute;right:10px;top:50%;width:8px;height:8px;border-right:1.5px solid var(--dex-text-muted);border-bottom:1.5px solid var(--dex-text-muted);transform:translateY(-50%) rotate(45deg);opacity:.95;transition:transform .2s ease,border-color .2s ease;pointer-events:none;z-index:2;}"
        + "#auth-ui-dropdown{position:absolute;right:0;top:calc(100% + 10px);width:min(280px,calc(100vw - 20px));max-width:calc(100vw - 20px);max-height:min(70vh,420px);overflow:auto;border:1px solid var(--dex-border);border-top-color:var(--dex-border-strong);border-radius:calc(var(--dex-radius) + 2px);background:var(--dex-panel-bg);box-shadow:var(--dex-shadow);padding:var(--dex-space-2);z-index:1200;opacity:0;transform:translateY(-6px) scale(.985);pointer-events:none;backdrop-filter:blur(12px) saturate(140%);-webkit-backdrop-filter:blur(12px) saturate(140%);transition:opacity .2s ease,transform .2s ease;}"
        + "#auth-ui-dropdown::after{content:'';position:absolute;inset:0;border-radius:inherit;background-image:radial-gradient(rgba(255,255,255,.05) 0.7px,transparent .7px);background-size:3px 3px;opacity:var(--dex-grain-opacity);pointer-events:none;}"
        + "#auth-ui-dropdown." + DROPDOWN_OPEN_CLASS + "{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}"
        + "#auth-ui .dex-menu-item{position:relative;display:flex;align-items:center;width:100%;max-width:100%;border:1px solid var(--dex-border);border-radius:max(6px,calc(var(--dex-radius) - 2px));background:var(--dex-row-bg);box-shadow:inset 0 1px 0 rgba(255,255,255,.2);padding:9px 11px;margin:0 0 6px;color:var(--dex-text);text-shadow:var(--dex-text-shadow);text-decoration:none;font-size:13px;line-height:1.25;cursor:pointer;overflow:hidden;transition:transform .18s ease,border-color .18s ease,background .18s ease;}"
        + "#auth-ui .dex-menu-item::before{content:'';position:absolute;inset:0;transform:translateX(-130%);background:linear-gradient(100deg,transparent,rgba(255,255,255,.27),transparent);transition:transform .46s ease;pointer-events:none;}"
        + "#auth-ui .dex-menu-item:hover{transform:translateY(-1px);border-color:var(--dex-border-strong);background:var(--dex-row-hover-bg);}"
        + "#auth-ui .dex-menu-item:hover::before{transform:translateX(130%);}"
        + "#auth-ui .dex-menu-sep{height:1px;background:linear-gradient(90deg,transparent,var(--dex-border-strong),transparent);margin:8px 2px 10px;}"
        + "#auth-ui .dex-menu-item.is-logout,#auth-ui #auth-ui-logout{margin-bottom:0;color:rgba(255,255,255,0.92);background:linear-gradient(180deg,rgba(0,0,0,0.78),rgba(0,0,0,0.62));border-color:rgba(255,255,255,0.16);}"
        + "#auth-ui .dex-menu-item.is-logout:hover,#auth-ui #auth-ui-logout:hover{background:linear-gradient(180deg,rgba(0,0,0,0.86),rgba(0,0,0,0.70));border-color:rgba(255,255,255,0.24);}"
        + "#auth-ui-profile-toggle[aria-expanded='true'] .dex-profile-chevron{transform:translateY(-45%) rotate(225deg);border-color:var(--dex-text);}"
        + "#auth-ui-profile-toggle[aria-expanded='true']{border-color:var(--dex-border-strong);filter:brightness(1.03);}"
        + "@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){#auth-ui-profile-toggle,#auth-ui-dropdown{background:rgba(28,32,45,.9);}#auth-ui[data-dex-scheme='light'] #auth-ui-profile-toggle,#auth-ui[data-dex-scheme='light'] #auth-ui-dropdown{background:rgba(252,252,255,.95);}}"
        + "@media (prefers-reduced-motion:reduce){#auth-ui *,#auth-ui *::before,#auth-ui *::after{transition:none!important;animation:none!important;transform:none!important;}#auth-ui .dex-menu-item::before{display:none;}}";
      document.head.appendChild(style);
    }

    var existing = document.getElementById(AUTH_UI_ID);
    if (existing) {
      if (!existing.querySelector("#auth-ui-signin")
        || !existing.querySelector("#auth-ui-profile")
        || !existing.querySelector("#auth-ui-dropdown")
        || !existing.querySelector("#auth-ui-logout")) {
        existing.innerHTML = getAuthUiMarkup();
      }

      if (mount && !mount.contains(existing)) {
        mount.appendChild(existing);
      }

      var existingCs = window.getComputedStyle(existing);
      if (existing.hidden) {
        existing.hidden = false;
      }
      if (existingCs.display === "none") {
        existing.style.display = "inline-flex";
      }
      syncAuthUiMetrics(existing, mount);
      requestAnimationFrame(function () {
        syncAuthUiMetrics(existing, mount);
      });
      return existing;
    }

    var ui = document.createElement("div");
    ui.id = AUTH_UI_ID;
    ui.innerHTML = getAuthUiMarkup();

    mount.appendChild(ui);
    syncAuthUiMetrics(ui, mount);
    requestAnimationFrame(function () {
      syncAuthUiMetrics(ui, mount);
    });
    return ui;
  }

  function isVisibleNavReference(el, ui) {
    if (!el || el === ui || (ui && ui.contains(el)) || el.disabled) {
      return false;
    }
    var cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function syncAuthUiMetrics(ui, mount) {
    if (!ui) {
      return;
    }
    var scope = mount && mount.querySelectorAll ? mount : document;
    var ref = null;
    var header = (mount && mount.closest) ? mount.closest("header") : document.querySelector("header");
    if (header && header.querySelectorAll) {
      var headerReferences = header.querySelectorAll("a,button");
      for (var i = 0; i < headerReferences.length; i += 1) {
        if (!isVisibleNavReference(headerReferences[i], ui)) {
          continue;
        }
        var headerRect = headerReferences[i].getBoundingClientRect();
        if (headerRect.height >= 26 && headerRect.height <= 64) {
          ref = headerReferences[i];
          break;
        }
      }
    }
    if (!ref) {
      var references = scope.querySelectorAll("a,button");
      for (var j = 0; j < references.length; j += 1) {
        if (isVisibleNavReference(references[j], ui)) {
          ref = references[j];
          break;
        }
      }
    }
    if (ref) {
      var cs = window.getComputedStyle(ref);
      var radius = cs.borderRadius;
      if (radius && radius !== "0px") {
        ui.style.setProperty("--dex-radius", radius);
      }
      var height = parseFloat(cs.height) || ref.getBoundingClientRect().height;
      var lineHeight = parseFloat(cs.lineHeight);
      var navHeight = Math.max(height || 0, isFinite(lineHeight) ? lineHeight : 0);
      if (navHeight > 0) {
        ui.style.setProperty("--dex-nav-h", Math.round(navHeight) + "px");
      }
      var refRect = ref.getBoundingClientRect();
      var uiRect = ui.getBoundingClientRect();
      var dy = (refRect.top + (refRect.height / 2)) - (uiRect.top + (uiRect.height / 2));
      dy = Math.max(-18, Math.min(18, dy));
      dy = Math.round(dy * 2) / 2;
      ui.style.setProperty("--dex-nav-offset-y", dy + "px");
    } else {
      ui.style.setProperty("--dex-nav-offset-y", "0px");
    }
    var bgTarget = findHeaderBackgroundElement(mount || ui.parentElement || pickMount());
    var bgRgb = getEffectiveBackgroundColor(bgTarget);
    if (bgRgb) {
      ui.dataset.dexScheme = isLightBg(bgRgb) ? "light" : "dark";
    }
  }

  function bindUiResizeSync() {
    if (document.documentElement.dataset.dexAuthResizeBound) {
      return;
    }
    document.documentElement.dataset.dexAuthResizeBound = "1";
    window.addEventListener("resize", function () {
      var ui = document.getElementById(AUTH_UI_ID);
      if (!ui) return;
      syncAuthUiMetrics(ui, pickMount());
    });
  }

  function repairAuthUiIfMissing() {
    if (uiRepairQueued) {
      return;
    }
    uiRepairQueued = true;
    window.setTimeout(function () {
      uiRepairQueued = false;
      var ui = ensureAuthUi();
      if (!ui || !document.getElementById("auth-ui-signin")) {
        ensureAuthUi();
      }
      setUiState(lastUiAuth, lastUiUser);
      bindUiEvents(getCfg());
    }, 0);
  }

  function startAuthUiObserver() {
    if (uiObserverStarted || !document.body || typeof MutationObserver === "undefined") {
      return;
    }
    uiObserverStarted = true;
    var observer = new MutationObserver(function () {
      var ui = document.getElementById(AUTH_UI_ID);
      if (!ui) {
        repairAuthUiIfMissing();
        return;
      }
      if (!document.getElementById("auth-ui-signin")) {
        repairAuthUiIfMissing();
        return;
      }
      var parent = ui.parentNode && ui.parentNode.nodeType === 1 ? ui.parentNode : null;
      if (!parent) {
        repairAuthUiIfMissing();
        return;
      }
      var mountCs = window.getComputedStyle(parent);
      var mountRect = parent.getBoundingClientRect();
      if (mountCs.display === "none" || mountCs.visibility === "hidden" || mountRect.width === 0 || mountRect.height === 0) {
        repairAuthUiIfMissing();
        return;
      }
      syncAuthUiMetrics(ui, parent);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function applyPrimaryButtonStyle(btn) {
    if (!btn) return;

    btn.classList.add("dex-auth-signin");

    if (document.querySelector(".sqs-block-button-element--primary")) {
      btn.classList.add("sqs-block-button-element", "sqs-block-button-element--primary");
      btn.classList.remove("dex-auth-fallback-btn");
      btn.style.border = "";
      btn.style.background = "";
      btn.style.color = "";
      btn.style.padding = "";
      return;
    }

    var matched = false;

    if (document.querySelector(".btn--primary")) {
      btn.classList.add("btn--primary");
      if (document.querySelector(".btn")) {
        btn.classList.add("btn");
      }
      matched = true;
    }

    if (document.querySelector(".button--primary")) {
      btn.classList.add("button--primary");
      matched = true;
    }

    if (document.querySelector("button.primary")) {
      btn.classList.add("primary");
      matched = true;
    }

    if (document.querySelector(".btn-primary")) {
      btn.classList.add("btn-primary");
      matched = true;
    }

    if (document.querySelector(".button-primary")) {
      btn.classList.add("button-primary");
      matched = true;
    }

    if (matched) {
      btn.classList.remove("dex-auth-fallback-btn");
      btn.style.border = "";
      btn.style.background = "";
      btn.style.color = "";
      btn.style.padding = "";
      return;
    }

    btn.classList.add("dex-auth-fallback-btn");
  }

  function setUiState(auth, user) {
    lastUiAuth = !!auth;
    lastUiUser = user || null;

    var ui = ensureAuthUi();
    if (!ui) {
      return;
    }
    var signInBtn = document.getElementById("auth-ui-signin");
    var profileWrap = document.getElementById("auth-ui-profile");
    var profileToggle = document.getElementById("auth-ui-profile-toggle");
    var avatar = document.getElementById("auth-ui-avatar");

    if (!signInBtn || !profileWrap || !profileToggle || !avatar) {
      return;
    }

    applyPrimaryButtonStyle(signInBtn);
    var fallbackAvatar = getDefaultAvatarDataUri(user && user.name);
    avatar.src = fallbackAvatar;

    if (auth) {
      signInBtn.hidden = true;
      signInBtn.setAttribute("hidden", "hidden");
      profileWrap.hidden = false;
      profileWrap.removeAttribute("hidden");
      avatar.src = (user && user.picture) ? user.picture : fallbackAvatar;
      if (user && user.name) {
        profileToggle.title = user.name;
      }
    } else {
      signInBtn.hidden = false;
      signInBtn.removeAttribute("hidden");
      if (window.getComputedStyle(signInBtn).display === "none") {
        signInBtn.style.display = "";
      }
      signInBtn.style.visibility = "";
      profileWrap.hidden = true;
      profileWrap.setAttribute("hidden", "hidden");
      closeDropdown();
    }
  }

  function closeDropdown() {
    var menu = document.getElementById("auth-ui-dropdown");
    var toggle = document.getElementById("auth-ui-profile-toggle");
    if (menu) {
      menu.classList.remove(DROPDOWN_OPEN_CLASS);
    }
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  function bindUiEvents(cfg) {
    var signInBtn = document.getElementById("auth-ui-signin");
    var profileWrap = document.getElementById("auth-ui-profile");
    var profileToggle = document.getElementById("auth-ui-profile-toggle");
    var logoutBtn = document.getElementById("auth-ui-logout");
    var dropdown = document.getElementById("auth-ui-dropdown");

      if (signInBtn && !signInBtn.dataset.bound) {
        signInBtn.dataset.bound = "1";
        signInBtn.addEventListener("click", function (evt) {
          evt.preventDefault();
          evt.stopPropagation();

          var returnTo = window.location.pathname + window.location.search + window.location.hash;

            ensureAuthClient()
              .then(function (client) {
                var cfgNow = getCfg();
                if (!cfgNow) throw new Error("Missing Auth0 config at click-time");
                return client.loginWithRedirect({
                  appState: { returnTo: returnTo },
                  authorizationParams: { redirect_uri: cfgNow.redirectUri }
                });
              })
            .catch(function (err) {
              logError("SIGN IN failed:", err);
            });
        });
      }

    if (profileToggle && !profileToggle.dataset.bound) {
      profileToggle.dataset.bound = "1";
      profileToggle.addEventListener("click", function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (!dropdown) {
          return;
        }
        var open = dropdown.classList.toggle(DROPDOWN_OPEN_CLASS);
        profileToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

      if (logoutBtn && !logoutBtn.dataset.bound) {
        logoutBtn.dataset.bound = "1";
        logoutBtn.addEventListener("click", function () {
          if (!authClient) {
            logError("Auth client unavailable for logout.");
            return;
          }
          authClient.logout({
            logoutParams: {
              returnTo: window.location.origin
            }
          });
        });
      }

    if (!document.documentElement.dataset.dexAuthOutsideBound) {
      document.documentElement.dataset.dexAuthOutsideBound = "1";
      document.addEventListener("click", function (evt) {
        if (!profileWrap || profileWrap.hidden) {
          return;
        }
        var inside = profileWrap.contains(evt.target);
        if (!inside) {
          closeDropdown();
        }
      });
    }

    if (dropdown && !dropdown.dataset.bound) {
      dropdown.dataset.bound = "1";
      dropdown.addEventListener("click", function (evt) {
        var node = evt.target;
        while (node && node !== dropdown) {
          if ((node.tagName && node.tagName.toLowerCase() === "a") || node.id === "auth-ui-logout") {
            closeDropdown();
            return;
          }
          node = node.parentNode;
        }
      });
    }

    if (!document.documentElement.dataset.dexAuthEscBound) {
      document.documentElement.dataset.dexAuthEscBound = "1";
      document.addEventListener("keydown", function (evt) {
        if (evt.key !== "Escape") return;
        var menu = document.getElementById("auth-ui-dropdown");
        var toggle = document.getElementById("auth-ui-profile-toggle");
        if (!menu || !toggle || !menu.classList.contains(DROPDOWN_OPEN_CLASS)) return;
        closeDropdown();
        toggle.focus();
      });
    }

  }

  function parseAnchorFromClick(target) {
    var node = target;
    while (node && node !== document.documentElement) {
      if (node.tagName && node.tagName.toLowerCase() === "a") {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

    function handleGuardedNavIntent(returnTo) {
      ensureAuthClient()
        .then(function (client) {
          var cfgNow = getCfg();
          return client.loginWithRedirect({
            appState: { returnTo: returnTo },
            authorizationParams: cfgNow ? { redirect_uri: cfgNow.redirectUri } : undefined
          });
        })
        .catch(function (err) {
          logError("loginWithRedirect failed:", err);
        });
    }

  function bindClickGuard() {
    if (document.documentElement.dataset.dexAuthClickGuardBound) {
      return;
    }
    document.documentElement.dataset.dexAuthClickGuardBound = "1";

    document.addEventListener("click", function (evt) {
      try {
        var anchor = parseAnchorFromClick(evt.target);
        if (!anchor) {
          return;
        }
        var href = anchor.getAttribute("href");
        if (!href || href.charAt(0) === "#") {
          return;
        }
        var url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) {
          return;
        }
        if (!isProtectedPath(url.pathname)) {
          return;
        }
        if (isAuthenticated) {
          return;
        }
        evt.preventDefault();
        evt.stopPropagation();
        handleGuardedNavIntent(getReturnToFromUrl(url));
      } catch (err) {
        logError("Failed while guarding clicked link:", err);
      }
    }, true);
  }

  function clearAuthQueryParams() {
    var url = new URL(window.location.href);
    if (!url.searchParams.has("code") && !url.searchParams.has("state")) {
      return;
    }
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    var cleaned = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
    window.history.replaceState({}, document.title, cleaned);
  }

  function getCurrentReturnTo() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  async function init() {
    try {
        var cfg = getCfg();
      ensureAuthUi();
      bindUiResizeSync();
      startAuthUiObserver();
      if (!cfg) {
        logError("Missing host Auth0 configuration; auth features disabled.");
        bindUiEvents(cfg);
        bindClickGuard();
        return;
      }
        var createAuth0Client = getCreateAuth0ClientFn();
        if (!createAuth0Client) {
          logError("Auth0 SPA SDK missing; expected createAuth0Client global.");
          bindUiEvents(cfg);
          bindClickGuard();
          return;
        }

      var authorizationParams = {
        redirect_uri: cfg.redirectUri,
        scope: "openid profile email"
      };
      if (cfg.audience) {
        authorizationParams.audience = cfg.audience;
      }

      // optional feature flags (safe defaults)
      var useRefreshTokens = !!(cfg && cfg.useRefreshTokens);
      var cacheLocation = "localstorage";

      authClient = await createAuth0Client({
        domain: cfg.domain,
        clientId: cfg.clientId,
        authorizationParams: authorizationParams,
        cacheLocation: cacheLocation,
        useRefreshTokens: useRefreshTokens
      });

      if (isCallbackPath(window.location.pathname)) {
        var callbackResult = await authClient.handleRedirectCallback();
        clearAuthQueryParams();
        var returnTo = (callbackResult && callbackResult.appState && callbackResult.appState.returnTo) || "/";
        window.location.replace(returnTo);
        return;
      }

      try {
        await authClient.checkSession();
      } catch (e) {
        // Silent auth can fail (ITP / cookie restrictions). Ignore and fall through.
      }

      isAuthenticated = await authClient.isAuthenticated();
      if (isProtectedPath(window.location.pathname) && !isAuthenticated) {
        handleGuardedNavIntent(getCurrentReturnTo());
        return;
      }

      var user = null;
      if (isAuthenticated) {
        user = await authClient.getUser();
      }
      setUiState(isAuthenticated, user);
      bindUiEvents(cfg);
      bindClickGuard();
    } catch (err) {
      logError("Initialization error:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
