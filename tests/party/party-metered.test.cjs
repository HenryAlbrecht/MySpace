const { test } = require("node:test"),
  assert = require("node:assert/strict");
const API = require("../../server/party/ice-config.cjs");
const ICE = require("../../dist/voice/ice-config.js");
const fixture = [
  { urls: "stun:example:80" },
  {
    urls: ["turn:example:80?transport=udp", "turns:example:443?transport=tcp"],
    username: "fixture-user",
    credential: "fixture-password",
    apiKey: "discarded",
  },
];
const config = () =>
  API.readConfig({
    PARTY_ICE_PROVIDER: "metered",
    METERED_DOMAIN: "https://fixture.metered.live",
    METERED_TURN_API_KEY: "fixture-api-key",
  });
const response = (value) => ({
  ok: true,
  text: async () => JSON.stringify(value),
});
test("Metered official GET, validation, cache deduplication and cache refresh; API key never reaches payload", async () => {
  let count = 0,
    time = 1000;
  const provider = API.createProvider(config(), {
    now: () => time,
    fetch: async (url, options) => {
      count++;
      assert.equal(url.pathname, "/api/v1/turn/credentials");
      assert.equal(url.searchParams.get("apiKey"), "fixture-api-key");
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      return response(fixture);
    },
  });
  const [a, b] = await Promise.all([
    provider.getIceConfiguration(),
    provider.getIceConfiguration(),
  ]);
  assert.equal(a, b);
  assert.equal(count, 1);
  assert.equal(a.turn, true);
  assert.ok(!JSON.stringify(a).includes("apiKey"));
  assert.ok(!JSON.stringify(a).includes("fixture-api-key"));
  assert.equal(a.iceServers[1].credential, "fixture-password");
  assert.equal(await provider.getIceConfiguration(), a);
  time = a.expiresAt + 1;
  await provider.getIceConfiguration();
  assert.equal(count, 2);
});
test("invalid shape, URLs, credential, oversized payload and API failures fall back safely; retry after cooldown", async () => {
  for (const value of [
    null,
    {},
    [],
    [{ urls: "https://invalid" }],
    [{ urls: "turn:example" }],
    [{ urls: "turn:example", username: "fixture-api-key", credential: "test" }],
  ])
    assert.throws(() => API.validateMetered(value, "fixture-api-key"));
  for (const fetch of [
    async () => ({ ok: false }),
    async () => {
      throw Error("DO NOT EXPOSE AUTHENTICATED URL");
    },
    async () => response({ error: "private" }),
    async () => ({ ok: true, text: async () => "{".repeat(65537) }),
  ]) {
    const events = [];
    const provider = API.createProvider(config(), {
      fetch,
      onStatus: (e) => events.push(e),
    });
    const data = await provider.getIceConfiguration();
    assert.equal(data.turn, false);
    assert.ok(!JSON.stringify([data, events]).includes("private"));
    assert.deepEqual(events, [{ provider: "metered", ok: false }]);
  }
  let time = 0,
    calls = 0;
  const provider = API.createProvider(config(), {
    now: () => time,
    fetch: async () => {
      calls++;
      return calls === 1 ? { ok: false } : response(fixture);
    },
  });
  await provider.getIceConfiguration();
  await provider.getIceConfiguration();
  assert.equal(calls, 1);
  time = 30001;
  assert.equal((await provider.getIceConfiguration()).turn, true);
  const browser = ICE.createCache({
    now: () => time,
    request: () => provider.getIceConfiguration(),
  });
  assert.equal((await browser.get()).turn, true);
});
test("Coturn HMAC remains default and relay policy remains supported", async () => {
  const config = API.readConfig({
    PARTY_TURN_URLS: "turn:example",
    PARTY_TURN_SECRET: "fixture-secret",
  });
  const provider = API.createProvider(config, {
    fetch: () => assert.fail("Coturn must not fetch Metered"),
  });
  const data = await provider.getIceConfiguration();
  assert.equal(data.turn, true);
  assert.ok(data.iceServers[1].credential);
  assert.equal(ICE.policy("relay"), "relay");
  assert.equal(ICE.policy(), "all");
  assert.throws(() =>
    API.readConfig({
      PARTY_ICE_PROVIDER: "metered",
      METERED_DOMAIN: "http://example",
      METERED_TURN_API_KEY: "fixture",
    }),
  );
});
test("frontend fallback cache retries and frontend code never references the Metered API key", async () => {
  let time = 0,
    count = 0;
  const cache = ICE.createCache({
    now: () => time,
    request: async () => {
      count++;
      return count === 1
        ? {
            iceServers: [{ urls: "stun:example" }],
            turn: false,
            expiresAt: 30000,
          }
        : { iceServers: fixture, turn: true, expiresAt: time + 300000 };
    },
  });
  assert.equal((await cache.get()).turn, false);
  time = 30001;
  assert.equal((await cache.get()).turn, true);
  assert.equal(count, 2);
  const fs = require("node:fs");
  for (const file of ["peer.js", "session.js", "ice-config.js"])
    assert.ok(
      !fs
        .readFileSync(require.resolve("../../dist/voice/" + file), "utf8")
        .includes("METERED_TURN_API_KEY"),
    );
});
