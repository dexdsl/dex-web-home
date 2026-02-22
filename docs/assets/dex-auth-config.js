(function () {
  function normalizeHost(value) {
    var raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw.charAt(0) === '[') {
      var end = raw.indexOf(']');
      if (end > 0) return raw.slice(1, end);
      return raw.replace(/^\[|\]$/g, '');
    }
    return raw.split(':')[0];
  }

  var host = normalizeHost(window.location.host || window.location.hostname);
  var localRedirectUri = window.location.origin + '/auth/callback/';
  var byHost = {
    "dexdsl.github.io": {
      domain: "dexdsl.us.auth0.com",
      clientId: "M92hIItt3XQPUvGvK0t2xDtLMCK1mVqc",
      audience: "",
      redirectUri: "https://dexdsl.github.io/auth/callback/"
    },
    "dexdsl.org": {
      domain: "dexdsl.us.auth0.com",
      clientId: "M92hIItt3XQPUvGvK0t2xDtLMCK1mVqc",
      audience: "",
      redirectUri: "https://dexdsl.org/auth/callback/"
    },
    "dexdsl.com": {
      domain: "dexdsl.us.auth0.com",
      clientId: "M92hIItt3XQPUvGvK0t2xDtLMCK1mVqc",
      audience: "",
      redirectUri: "https://dexdsl.com/auth/callback/"
    },
    "localhost": {
      domain: "dexdsl.us.auth0.com",
      clientId: "M92hIItt3XQPUvGvK0t2xDtLMCK1mVqc",
      audience: "",
      redirectUri: localRedirectUri
    },
    "127.0.0.1": {
      domain: "dexdsl.us.auth0.com",
      clientId: "M92hIItt3XQPUvGvK0t2xDtLMCK1mVqc",
      audience: "",
      redirectUri: localRedirectUri
    }
  };

  var config = byHost[host] || null;
  if (!config) {
    console.warn("[dex-auth] No Auth0 config found for host:", host);
  }

  window.DEX_AUTH0_CONFIG = {
    byHost: byHost,
    host: host,
    normalizeHost: normalizeHost,
    current: config
  };
})();
