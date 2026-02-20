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
          authorizationParams: authorizationParams
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

  function ensureAuthUi() {
    var existing = document.getElementById(AUTH_UI_ID);
    if (existing) {
      if (!existing.querySelector("#auth-ui-signin")) {
        existing.innerHTML = ""
          + '<button id="auth-ui-signin" type="button">SIGN IN</button>'
          + '<div id="auth-ui-profile" hidden>'
          + '  <button id="auth-ui-profile-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Profile">'
          + '    <img id="auth-ui-avatar" alt="Profile avatar" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'
          + "  </button>"
          + '  <div id="auth-ui-dropdown" role="menu">'
          + '    <button id="auth-ui-logout" type="button">Log out</button>'
          + "  </div>"
          + "</div>";
      }
      return existing;
    }

    hideLegacyAccountUi();

    var styleId = "dex-auth-style";
    if (!document.getElementById(styleId)) {
      var style = document.createElement("style");
      style.id = styleId;
      style.textContent = ""
        + "#auth-ui{position:relative;display:inline-flex;align-items:center;gap:10px;font-family:inherit;}"
        + "#auth-ui [hidden]{display:none!important;}"
        + "#auth-ui-signin{padding:8px 12px;border:1px solid #111;background:#fff;color:#111;cursor:pointer;font-size:12px;letter-spacing:.08em;text-transform:uppercase;}"
        + "#auth-ui-profile-toggle{display:inline-flex;align-items:center;justify-content:center;border:1px solid #d4d4d4;background:#fff;width:36px;height:36px;border-radius:9999px;cursor:pointer;padding:0;}"
        + "#auth-ui-avatar{width:100%;height:100%;border-radius:9999px;object-fit:cover;display:block;}"
        + "#auth-ui-dropdown{position:absolute;right:0;top:calc(100% + 8px);min-width:160px;border:1px solid #ddd;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:8px;z-index:9999;display:none;}"
        + "#auth-ui-dropdown." + DROPDOWN_OPEN_CLASS + "{display:block;}"
        + "#auth-ui-logout{width:100%;border:1px solid #111;background:#fff;padding:8px 10px;cursor:pointer;font-size:12px;letter-spacing:.08em;text-transform:uppercase;}";
      document.head.appendChild(style);
    }

    var ui = document.createElement("div");
    ui.id = AUTH_UI_ID;
    ui.innerHTML = ""
      + '<button id="auth-ui-signin" type="button">SIGN IN</button>'
      + '<div id="auth-ui-profile" hidden>'
      + '  <button id="auth-ui-profile-toggle" type="button" aria-haspopup="true" aria-expanded="false" title="Profile">'
      + '    <img id="auth-ui-avatar" alt="Profile avatar" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'
      + "  </button>"
      + '  <div id="auth-ui-dropdown" role="menu">'
      + '    <button id="auth-ui-logout" type="button">Log out</button>'
      + "  </div>"
      + "</div>";

    var mount = document.querySelector(".header-actions--right") ||
      document.querySelector(".header-actions") ||
      document.querySelector("header") ||
      document.body;
    mount.appendChild(ui);
    return ui;
  }

  function applyPrimaryButtonStyle(btn) {
    if (!btn) return;

    var candidates = [
      "button.primary",
      "a.primary",
      ".btn--primary",
      ".button--primary",
      ".sqs-block-button-element--primary",
      ".sqs-block-button-element",
      ".button"
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var el = document.querySelector(candidates[i]);
      if (el && el !== btn && el.classList && el.classList.length) {
        btn.className = el.className;
        return;
      }
    }

    btn.style.border = "none";
    btn.style.padding = "8px 12px";
    btn.style.borderRadius = "8px";
    btn.style.cursor = "pointer";
  }

  function setUiState(auth, user) {
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

    if (auth) {
      signInBtn.hidden = true;
      profileWrap.hidden = false;
      if (user && user.picture) {
        avatar.src = user.picture;
      }
      if (user && user.name) {
        profileToggle.title = user.name;
      }
    } else {
      signInBtn.hidden = false;
      profileWrap.hidden = true;
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
      var cacheLocation = (cfg && cfg.cacheLocation) || "localstorage";

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
