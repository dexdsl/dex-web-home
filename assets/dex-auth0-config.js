(function () {
  var host = window.location.hostname;
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
    }
  };

  var config = byHost[host] || null;
  if (!config) {
    console.warn("[dex-auth] No Auth0 config found for host:", host);
  }

  window.DEX_AUTH0_CONFIG = {
    byHost: byHost,
    current: config
  };
})();
