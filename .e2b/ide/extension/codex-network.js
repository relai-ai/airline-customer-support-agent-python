// Command traffic may reach only the provisioned session gateway. Codex's
// model transport runs outside this command sandbox and has its own adapter.
function commandNetworkConfig(env) {
  const gateway = new URL(env.RELAI_API_BASE);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(gateway.hostname);
  if (gateway.username || gateway.password || gateway.hash ||
      (gateway.protocol !== "https:" && !(local && gateway.protocol === "http:")))
    throw Error("The session gateway must use HTTPS or local loopback HTTP.");
  return {
    "sandbox_workspace_write.network_access": true,
    "features.network_proxy": {
      enabled: true,
      allow_upstream_proxy: false,
      domains: { [gateway.hostname]: "allow" },
    },
  };
}

// -c values are TOML, including inline tables; JSON objects are not TOML.
function configValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value))
    return "{" + Object.entries(value).map(([key, item]) =>
      JSON.stringify(key) + "=" + configValue(item)).join(",") + "}";
  return JSON.stringify(value);
}

module.exports = { commandNetworkConfig, configValue };
