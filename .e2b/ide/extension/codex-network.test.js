const test = require("node:test");
const assert = require("node:assert/strict");
const { commandNetworkConfig, configValue } = require("./codex-network");

test("command networking allows only the provisioned gateway host", () => {
  const config = commandNetworkConfig({
    RELAI_API_BASE: "https://platform.relai.ai/playground-api/runtime/session/",
  });
  assert.equal(config["sandbox_workspace_write.network_access"], true);
  assert.deepEqual(config["features.network_proxy"], {
    enabled: true, allow_upstream_proxy: false,
    domains: { "platform.relai.ai": "allow" },
  });
  assert.equal(configValue(config["features.network_proxy"]),
    '{"enabled"=true,"allow_upstream_proxy"=false,"domains"={"platform.relai.ai"="allow"}}');
});

test("gateway configuration refuses unsafe URLs and permits local verification", () => {
  for (const url of ["http://public.example/", "https://user:secret@example.com/",
    "https://example.com/#fragment", "file:///tmp/gateway"])
    assert.throws(() => commandNetworkConfig({ RELAI_API_BASE: url }));
  assert.deepEqual(commandNetworkConfig({ RELAI_API_BASE: "http://127.0.0.1:8894/" })
    ["features.network_proxy"].domains, { "127.0.0.1": "allow" });
});

test('worker access is confined to its loopback HTTP host; unrelated destinations remain absent', () => {
  const env = { RELAI_API_BASE: 'https://platform.relai.ai/runtime/' };
  const config = commandNetworkConfig(env, 'http://127.0.0.1:12345');
  assert.deepEqual(config['features.network_proxy'].domains, { 'platform.relai.ai': 'allow', '127.0.0.1': 'allow' });
  for (const url of ['http://0.0.0.0:12345', 'https://example.com/', 'http://127.0.0.1:12345/path', 'http://user@127.0.0.1:12345'])
    assert.throws(() => commandNetworkConfig(env, url));
});
