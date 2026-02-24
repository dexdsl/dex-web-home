(function () {
  "use strict";

  var AUTH_UI_ID = "auth-ui";
  var DROPDOWN_OPEN_CLASS = "is-open";
  var DROPDOWN_BODY_OPEN_CLASS = "dx-auth-dropdown-open";
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
    "/entry/voice-everyday-object-manipulation-levi-lu": true,
    "/favorites": true
  };

  var authClient = null;
  var isAuthenticated = false;
  var lastUiAuth = false;
  var lastUiUser = null;
  var uiObserverStarted = false;
  var uiRepairQueued = false;
  var authReadyResolve;
  var authReady = new Promise(function (resolve) { authReadyResolve = resolve; });
  var authReadyState = { isAuthenticated: false, user: null };
  var authReadyDone = false;

  function publishAuthState(auth, user) {
    authReadyState = { isAuthenticated: !!auth, user: user || null };
    window.auth0Client = authClient || null;
    window.dexAuth = window.DEX_AUTH || null;
    window.auth0Sub = user && (user.sub || user.user_id || user.email) || null;
    if (!authReadyDone) {
      authReadyDone = true;
      if (authReadyResolve) authReadyResolve(authReadyState);
    }
    try {
      if (typeof window.CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("dex-auth:ready", { detail: authReadyState }));
      } else if (document && document.createEvent) {
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("dex-auth:ready", false, false, authReadyState);
        window.dispatchEvent(evt);
      }
    } catch (e) {}
  }

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

  function normalizeCssValue(value) {
    var str = String(value || "").trim();
    if (!str || str === "none" || str === "transparent" || str === "rgba(0, 0, 0, 0)") {
      return "";
    }
    return str;
  }

  function syncAuthUiGlass(ui) {
    if (!ui) {
      return;
    }
    var headerGlass = document.querySelector(".header-announcement-bar-wrapper");
    if (!headerGlass) {
      return;
    }
    var cs = window.getComputedStyle(headerGlass);
    var rootCs = window.getComputedStyle(document.documentElement);
    var cssHeaderBg = normalizeCssValue(cs.getPropertyValue("--dx-header-glass-bg"));
    if (!cssHeaderBg) {
      cssHeaderBg = normalizeCssValue(rootCs.getPropertyValue("--dx-header-glass-bg"));
    }
    var bgImage = normalizeCssValue(cs.backgroundImage);
    var bgColor = normalizeCssValue(cs.backgroundColor);
    var bg = cssHeaderBg || bgImage || bgColor;
    var border = normalizeCssValue(cs.borderColor);
    var shadow = normalizeCssValue(cs.boxShadow);
    var filter = normalizeCssValue(cs.backdropFilter || cs.getPropertyValue("backdrop-filter"));
    var webkitFilter = normalizeCssValue(cs.webkitBackdropFilter || cs.getPropertyValue("-webkit-backdrop-filter"));
    var cssHeaderFilter = normalizeCssValue(cs.getPropertyValue("--dx-header-glass-backdrop"));
    if (!cssHeaderFilter) {
      cssHeaderFilter = normalizeCssValue(rootCs.getPropertyValue("--dx-header-glass-backdrop"));
    }
    var headerFilter = filter || webkitFilter || cssHeaderFilter || "saturate(180%) blur(18px)";

    if (bg) ui.style.setProperty("--dex-header-glass-bg", bg);
    if (border) ui.style.setProperty("--dex-header-glass-border", border);
    if (border) ui.style.setProperty("--dex-header-glass-border-strong", border);
    if (shadow) ui.style.setProperty("--dex-header-glass-shadow", shadow);
    if (headerFilter) ui.style.setProperty("--dex-header-glass-filter", headerFilter);
    if (headerFilter) ui.style.setProperty("--dex-header-glass-webkit-filter", headerFilter);
  }

  function getMenuIcon(iconName) {
    var icons = {
      catalog: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z"></path><path d="M4 6v15"></path><path d="M8 8h8"></path><path d="M8 12h8"></path></svg>',
      favorites: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20.2 4.9 13.7a4.5 4.5 0 0 1 6.3-6.4L12 8l.8-.7a4.5 4.5 0 1 1 6.3 6.4L12 20.2Z"></path></svg>',
      polls: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h16"></path><path d="M7 16V9"></path><path d="M12 16V5"></path><path d="M17 16v-3"></path></svg>',
      submit: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4"></path><path d="M7.5 8.5 12 4l4.5 4.5"></path><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"></path></svg>',
      messages: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 4V6.5Z"></path><path d="M8 9h8"></path><path d="M8 12h5"></path></svg>',
      press: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h3l7-4v8l-7-4H4Z"></path><path d="M14 10.5a3 3 0 0 1 0 3"></path><path d="M6 15v2a2 2 0 0 0 2 2h1"></path></svg>',
      settings: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 1.1 2.2 2.4.3 1.5 1.9-.6 2.3L18 12l-1.6 2.3.6 2.3-1.5 1.9-2.4.3L12 21l-1.1-2.2-2.4-.3-1.5-1.9.6-2.3L6 12l1.6-2.3-.6-2.3 1.5-1.9 2.4-.3L12 3Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      achievements: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5h8v3a4 4 0 1 1-8 0V5Z"></path><path d="M10 15h4"></path><path d="M9 19h6"></path><path d="M8 8H6a2 2 0 0 1-2-2V5h4"></path><path d="M16 8h2a2 2 0 0 0 2-2V5h-4"></path></svg>',
      logout: '<svg class="dex-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"></path><path d="M15 16l5-4-5-4"></path><path d="M20 12H9"></path></svg>',
    };
    return icons[iconName] || "";
  }

  function getMenuLinkMarkup(href, label, iconName) {
    return ''
      + '<a class="dex-menu-item" href="' + href + '" role="menuitem">'
      + '  <span class="dex-menu-icon-wrap" aria-hidden="true">' + getMenuIcon(iconName) + '</span>'
      + '  <span class="dex-menu-label">' + label + '</span>'
      + '</a>';
  }

  function getMenuButtonMarkup(id, label, iconName, extraClass) {
    var cls = "dex-menu-item";
    if (extraClass) {
      cls += " " + extraClass;
    }
    return ''
      + '<button id="' + id + '" class="' + cls + '" type="button" role="menuitem">'
      + '  <span class="dex-menu-icon-wrap" aria-hidden="true">' + getMenuIcon(iconName) + '</span>'
      + '  <span class="dex-menu-label">' + label + '</span>'
      + '</button>';
  }

  function getAuthUiMarkup() {
    return ""
      + '<button id="auth-ui-signin" class="dx-button-element dx-button-element--secondary dx-button-size--md" type="button">SIGN IN</button>'
      + '<div id="auth-ui-profile" hidden>'
      + '  <button id="auth-ui-profile-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Profile">'
      + '    <span class="dex-avatar-wrap"><img id="auth-ui-avatar" alt="Profile avatar" src=""></span>'
      + '    <span class="dex-profile-chevron" aria-hidden="true"></span>'
      + "  </button>"
      + '  <div id="auth-ui-dropdown" role="menu" aria-label="Account menu">'
      + getMenuLinkMarkup("/catalog", "Catalog", "catalog")
      + getMenuLinkMarkup("/entry/favorites/", "Favorites", "favorites")
      + getMenuLinkMarkup("/polls", "Polls", "polls")
      + '    <div class="dex-menu-sep" role="separator"></div>'
      + getMenuLinkMarkup("/entry/submit/", "Submit Samples", "submit")
      + getMenuLinkMarkup("/entry/messages/", "Messages", "messages")
      + getMenuLinkMarkup("/entry/pressroom/", "Press Room", "press")
      + '    <div class="dex-menu-sep" role="separator"></div>'
      + getMenuLinkMarkup("/entry/settings/", "Settings", "settings")
      + getMenuLinkMarkup("/entry/achievements/", "Achievements", "achievements")
      + '    <div class="dex-menu-sep" role="separator"></div>'
      + getMenuButtonMarkup("auth-ui-logout", "Log out", "logout", "is-logout")
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
      + '<rect width="64" height="64" rx="8" fill="url(#g)"/>'
      + '<rect x="8" y="8" width="48" height="48" rx="8" fill="rgba(255,255,255,0.16)"/>'
      + '<text x="32" y="40" text-anchor="middle" fill="#ffffff" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="21" font-weight="700">' + safeInitials + "</text>"
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

    function normalizeHostForLookup(value) {
      var raw = String(value || "").trim().toLowerCase();
      if (!raw) return "";
      if (raw.charAt(0) === "[") {
        var end = raw.indexOf("]");
        if (end > 0) return raw.slice(1, end);
        return raw.replace(/^\[|\]$/g, "");
      }
      return raw.split(":")[0];
    }

    function hostForLookup() {
      return normalizeHostForLookup(window.location.host || window.location.hostname);
    }

    function getCfg() {
      var root = window.DEX_AUTH0_CONFIG;
      var cfg = root && root.current;
      if (cfg) return cfg;
      var byHost = root && root.byHost || {};
      var lookupHost = hostForLookup();
      if (byHost && byHost[lookupHost]) return byHost[lookupHost];

      // fallback for your known hosts (covers “config script missing / load order” cases)
      if (
        lookupHost === "dexdsl.github.io" ||
        lookupHost === "dexdsl.org" ||
        lookupHost === "dexdsl.com" ||
        lookupHost === "localhost" ||
        lookupHost === "127.0.0.1"
      ) {
        return {
          domain: FALLBACK_AUTH0.domain,
          clientId: FALLBACK_AUTH0.clientId,
          audience: FALLBACK_AUTH0.audience,
          redirectUri: window.location.origin + "/auth/callback/"
        };
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
          window.auth0Client = authClient;
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
        + "#auth-ui{--dex-text:rgba(16,24,36,.92);--dex-text-muted:rgba(16,24,36,.72);--dex-glass-bg:var(--dex-header-glass-bg,linear-gradient(120deg,rgba(221,230,240,.36) 0%,rgba(191,208,224,.26) 55%,rgba(232,210,203,.24) 100%));--dex-glass-border:var(--dex-header-glass-border,rgba(255,255,255,.42));--dex-glass-border-strong:var(--dex-header-glass-border-strong,var(--dex-header-glass-border,rgba(255,255,255,.42)));--dex-glass-shadow:var(--dex-header-glass-shadow,0 16px 36px rgba(18,22,30,.22),inset 0 1px 0 rgba(255,255,255,.32));--dex-glass-filter:var(--dex-header-glass-filter,var(--dx-header-glass-backdrop,saturate(180%) blur(18px)));--dex-glass-webkit-filter:var(--dex-header-glass-webkit-filter,var(--dx-header-glass-backdrop,saturate(180%) blur(18px)));--dex-text-shadow:none;--dex-radius:10px;--dex-avatar-radius:4px;--dex-nav-h:38px;--dex-space-2:var(--space-2,8px);--dex-space-3:var(--space-3,12px);position:relative;top:0;display:inline-flex;align-items:center;align-self:center;vertical-align:middle;line-height:1;overflow:visible;padding:0;margin:var(--dex-nav-offset-y,0px) 0 0;gap:var(--dex-space-2);font-family:inherit;color:var(--dex-text);}"
        + "#auth-ui[data-dex-scheme='dark'],#auth-ui[data-dex-scheme='light']{--dex-text:rgba(16,24,36,.92);--dex-text-muted:rgba(16,24,36,.72);}"
        + "#auth-ui,#auth-ui *,#auth-ui *::before,#auth-ui *::after{box-sizing:border-box;}"
        + "#auth-ui [hidden]{display:none!important;}"
        + "#auth-ui-signin{display:inline-flex;align-items:center;justify-content:center;margin:0;line-height:1;}"
        + "#auth-ui-profile-toggle{display:inline-flex;align-items:center;justify-content:center;min-height:34px;height:var(--dex-nav-h,38px);margin:0;line-height:1;}"
        + "#auth-ui-profile-toggle:focus-visible,#auth-ui-dropdown .dex-menu-item:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(255,255,255,.38),0 0 0 4px rgba(255,25,16,.25);}"
        + "#auth-ui-profile{position:relative;display:inline-flex;align-items:center;overflow:visible;}"
        + "#auth-ui-profile-toggle{position:relative;gap:0;border:1px solid var(--dex-glass-border);background:var(--dex-glass-bg);box-shadow:var(--dex-glass-shadow);width:auto;min-width:calc(var(--dex-nav-h,38px) + 22px);border-radius:var(--dex-radius);cursor:pointer;justify-content:flex-start;padding:2px 28px 2px 2px;backdrop-filter:var(--dex-glass-filter)!important;-webkit-backdrop-filter:var(--dex-glass-webkit-filter)!important;transition:border-color .22s ease,filter .22s ease,background .22s ease;overflow:hidden;}"
        + "#auth-ui-profile-toggle:hover{border-color:var(--dex-glass-border-strong);background:var(--dex-glass-bg);}"
        + ".dex-avatar-wrap{position:relative;z-index:1;flex:0 0 auto;flex-shrink:0;width:calc(var(--dex-nav-h,38px) - 6px);height:calc(var(--dex-nav-h,38px) - 6px);min-width:calc(var(--dex-nav-h,38px) - 6px);border-radius:var(--dex-avatar-radius);overflow:hidden;}"
        + "#auth-ui-avatar{width:100%;height:100%;display:block;object-fit:cover;}"
        + "#auth-ui .dex-profile-chevron{position:absolute;right:10px;top:50%;width:8px;height:8px;border-right:1.5px solid var(--dex-text-muted);border-bottom:1.5px solid var(--dex-text-muted);transform:translateY(-50%) rotate(45deg);opacity:.95;transition:transform .2s ease,border-color .2s ease;pointer-events:none;z-index:2;}"
        + "#auth-ui-dropdown{position:absolute;right:0;top:calc(100% + 10px);width:min(292px,calc(100vw - 20px));max-width:calc(100vw - 20px);max-height:min(70vh,420px);overflow:auto;border:1px solid var(--dex-glass-border);border-top-color:var(--dex-glass-border-strong);border-radius:calc(var(--dex-radius) + 2px);background:var(--dex-glass-bg);box-shadow:var(--dex-glass-shadow);padding:var(--dex-space-2);z-index:1200;opacity:0;visibility:hidden;pointer-events:none;backdrop-filter:var(--dex-glass-filter)!important;-webkit-backdrop-filter:var(--dex-glass-webkit-filter)!important;transition:opacity .2s ease,visibility .2s ease;}"
        + "#auth-ui-dropdown." + DROPDOWN_OPEN_CLASS + "{opacity:1;visibility:visible;pointer-events:auto;}"
        + "#auth-ui .dex-menu-item{position:relative;display:grid;grid-template-columns:16px minmax(0,1fr);align-items:center;column-gap:9px;width:100%;max-width:100%;border:1px solid var(--dex-glass-border);border-radius:max(6px,calc(var(--dex-radius) - 2px));background:var(--dex-glass-bg);box-shadow:var(--dex-glass-shadow);padding:9px 11px;margin:0 0 6px;color:var(--dex-text);text-shadow:var(--dex-text-shadow);text-decoration:none;font-size:13px;line-height:1.25;cursor:pointer;overflow:hidden;backdrop-filter:var(--dex-glass-filter)!important;-webkit-backdrop-filter:var(--dex-glass-webkit-filter)!important;transition:transform .18s ease,border-color .18s ease,background .18s ease,filter .18s ease;}"
        + "#auth-ui .dex-menu-icon-wrap{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;opacity:.92;}"
        + "#auth-ui .dex-menu-icon{width:16px;height:16px;display:block;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;fill:none;}"
        + "#auth-ui .dex-menu-label{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}"
        + "#auth-ui .dex-menu-item:hover{transform:translateY(-1px);border-color:var(--dex-glass-border-strong);background:var(--dex-glass-bg);}"
        + "#auth-ui .dex-menu-sep{height:1px;background:linear-gradient(90deg,transparent,var(--dex-glass-border-strong),transparent);margin:8px 2px 10px;}"
        + "#auth-ui .dex-menu-item.is-logout,#auth-ui #auth-ui-logout{margin-bottom:0;color:var(--dex-text);background:var(--dex-glass-bg);border-color:var(--dex-glass-border);}"
        + "#auth-ui .dex-menu-item.is-logout .dex-menu-label,#auth-ui #auth-ui-logout .dex-menu-label{font-weight:700;}"
        + "#auth-ui .dex-menu-item.is-logout:hover,#auth-ui #auth-ui-logout:hover{border-color:var(--dex-glass-border-strong);background:var(--dex-glass-bg);}"
        + "#auth-ui-profile-toggle[aria-expanded='true'] .dex-profile-chevron{transform:translateY(-45%) rotate(225deg);border-color:var(--dex-text);}"
        + "#auth-ui-profile-toggle[aria-expanded='true']{border-color:var(--dex-glass-border-strong);}"
        + "@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){#auth-ui-profile-toggle,#auth-ui-dropdown,#auth-ui .dex-menu-item{background:var(--dex-glass-bg);}}"
        + "@media (prefers-reduced-motion:reduce){#auth-ui *,#auth-ui *::before,#auth-ui *::after{transition:none!important;animation:none!important;transform:none!important;}}";
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
    if (el.classList && el.classList.contains("icon")) {
      return false;
    }
    if (el.closest && (el.closest(".header-actions-action--social") || el.closest(".showOnMobile"))) {
      return false;
    }
    var cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") {
      return false;
    }
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }
    if (rect.height < 24 || rect.height > 72) {
      return false;
    }
    if (rect.width < 36) {
      return false;
    }
    return true;
  }

  function syncAuthUiMetrics(ui, mount) {
    if (!ui) {
      return;
    }
    syncAuthUiGlass(ui);
    var scope = mount && mount.querySelectorAll ? mount : null;
    var ref = null;
    if (scope && scope.querySelectorAll) {
      var scopeReferences = scope.querySelectorAll("a,button");
      for (var s = 0; s < scopeReferences.length; s += 1) {
        if (!isVisibleNavReference(scopeReferences[s], ui)) {
          continue;
        }
        ref = scopeReferences[s];
        break;
      }
    }
    var header = (mount && mount.closest) ? mount.closest("header") : document.querySelector("header");
    if (!ref && header && header.querySelectorAll) {
      var headerReferences = header.querySelectorAll("a,button");
      for (var i = 0; i < headerReferences.length; i += 1) {
        if (!isVisibleNavReference(headerReferences[i], ui)) {
          continue;
        }
        ref = headerReferences[i];
        break;
      }
    }
    if (!ref) {
      var references = document.querySelectorAll("a,button");
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
      var parsedRadius = parseFloat(radius);
      if (isFinite(parsedRadius) && parsedRadius > 0) {
        var clampedRadius = Math.max(4, Math.min(12, parsedRadius));
        ui.style.setProperty("--dex-radius", clampedRadius + "px");
      }
      var height = parseFloat(cs.height) || ref.getBoundingClientRect().height;
      var lineHeight = parseFloat(cs.lineHeight);
      var navHeight = Math.max(height || 0, isFinite(lineHeight) ? lineHeight : 0);
      if (navHeight > 0) {
        var clampedNavHeight = Math.max(32, Math.min(44, Math.round(navHeight)));
        ui.style.setProperty("--dex-nav-h", clampedNavHeight + "px");
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

  function applySecondaryButtonStyle(btn) {
    if (!btn) return;

    btn.classList.add(
      "dex-auth-signin",
      "dx-button-element",
      "dx-button-element--secondary",
      "dx-button-size--md"
    );
    btn.classList.remove(
      "dex-auth-fallback-btn",
      "dx-block-button-element",
      "dx-block-button-element--primary",
      "theme-btn--primary",
      "cta-btn",
      "cta",
      "dex-btn"
    );
    btn.style.border = "";
    btn.style.background = "";
    btn.style.color = "";
    btn.style.padding = "";
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

    applySecondaryButtonStyle(signInBtn);
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
    if (document.body) {
      document.body.classList.remove(DROPDOWN_BODY_OPEN_CLASS);
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
          triggerSignIn(returnTo);
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
        if (document.body) {
          document.body.classList.toggle(DROPDOWN_BODY_OPEN_CLASS, open);
        }
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
      triggerSignIn(returnTo);
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

  function openAuthFlow(returnTo, screenHint) {
    return ensureAuthClient()
      .then(function (client) {
        var cfgNow = getCfg();
        if (!cfgNow) throw new Error("Missing Auth0 config at click-time");
        var authorizationParams = { redirect_uri: cfgNow.redirectUri };
        if (screenHint) authorizationParams.screen_hint = screenHint;
        return client.loginWithRedirect({
          appState: { returnTo: returnTo || getCurrentReturnTo() },
          authorizationParams: authorizationParams
        });
      });
  }

  function triggerSignIn(returnTo) {
    return openAuthFlow(returnTo || getCurrentReturnTo(), null)
      .catch(function (err) {
        logError("SIGN IN failed:", err);
      });
  }

  function triggerSignUp(returnTo) {
    return openAuthFlow(returnTo || getCurrentReturnTo(), "signup")
      .catch(function (err) {
        logError("SIGN UP failed:", err);
      });
  }

  function triggerSignOut(returnTo) {
    var resolvedReturnTo = (typeof returnTo === "string" && returnTo.trim())
      ? returnTo.trim()
      : window.location.origin;
    return ensureAuthClient()
      .then(function (client) {
        return client.logout({
          logoutParams: {
            returnTo: resolvedReturnTo
          }
        });
      })
      .catch(function (err) {
        logError("LOG OUT failed:", err);
      });
  }

  window.DEX_AUTH = {
    ready: authReady.then(function () { return authReadyState; }),
    isAuthenticated: function () {
      return authReady.then(function () { return !!authReadyState.isAuthenticated; });
    },
    signIn: function (returnTo) {
      return triggerSignIn(returnTo || getCurrentReturnTo());
    },
    signUp: function (returnTo) {
      return triggerSignUp(returnTo || getCurrentReturnTo());
    },
    signOut: function (returnTo) {
      return triggerSignOut(returnTo || window.location.origin);
    },
    getUser: function () {
      return authReady.then(function () { return authReadyState.user || null; });
    },
    getAccessToken: function () {
      return ensureAuthClient()
        .then(function (client) { return client.getTokenSilently(); })
        .catch(function () { return null; });
    }
  };
  window.dexAuth = window.DEX_AUTH;

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
        publishAuthState(false, null);
        return;
      }
        var createAuth0Client = getCreateAuth0ClientFn();
        if (!createAuth0Client) {
          logError("Auth0 SPA SDK missing; expected createAuth0Client global.");
          bindUiEvents(cfg);
          bindClickGuard();
          publishAuthState(false, null);
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
        publishAuthState(false, null);
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
        publishAuthState(false, null);
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
      publishAuthState(isAuthenticated, user);
    } catch (err) {
      logError("Initialization error:", err);
      publishAuthState(false, null);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
