(function () {
  var host = window.location.hostname;
  var byHost = {
    "dexdsl.github.io": {
      domain: "YOUR_AUTH0_DOMAIN",
      clientId: "YOUR_AUTH0_CLIENT_ID",
      audience: "",
      redirectUri: "https://dexdsl.github.io/auth/callback/"
    },
    "dexdsl.org": {
      domain: "YOUR_AUTH0_DOMAIN",
      clientId: "YOUR_AUTH0_CLIENT_ID",
      audience: "",
      redirectUri: "https://dexdsl.org/auth/callback/"
    },
    "dexdsl.com": {
      domain: "YOUR_AUTH0_DOMAIN",
      clientId: "YOUR_AUTH0_CLIENT_ID",
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
