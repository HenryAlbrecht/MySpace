const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const ICE = require("../../dist/voice/ice-config.js");
const serverICE = require("../../server/party/ice-config.cjs");
const network = require("../../dist/voice/network.js");
const createPeer = require("../../dist/voice/peer.js");
const createSession = require("../../dist/voice/session.js");
const createRoom = require("../../dist/voice/room.js");
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
test("env URLs, HMAC, bounded TTL, expiry and secret-free payload", () => {
  const config = serverICE.readConfig({
    PARTY_STUN_URLS: "stun:stun.example:3478, stuns:stun.example:5349",
    PARTY_TURN_URLS:
      "turn:turn.example:3478?transport=udp turn:turn.example:3478?transport=tcp,turns:turn.example:5349?transport=tcp",
    PARTY_TURN_SECRET: "test-only-secret",
    PARTY_TURN_TTL: "3600",
  });
  assert.equal(config.turn.length, 3);
  assert.equal(config.stun.length, 2);
  const result = serverICE.issue(config, { now: 1000000, suffix: "client" }),
    turn = result.iceServers[1];
  assert.equal(turn.username, "4600:client");
  assert.equal(result.expiresAt, 4600000);
  assert.equal(
    turn.credential,
    createHmac("sha1", "test-only-secret").update(turn.username).digest("base64"),
  );
  assert.ok(!JSON.stringify(result).includes("test-only-secret"));
  assert.equal("secret" in result, false);
  assert.equal(serverICE.issue(serverICE.readConfig({})).turn, false);
  assert.deepEqual(serverICE.readConfig({ PARTY_TURN_URLS: "https://invalid turn:valid" }).turn, [
    "turn:valid",
  ]);
  assert.throws(() => serverICE.readConfig({ PARTY_TURN_TTL: "0" }));
  assert.throws(() => serverICE.readConfig({ PARTY_TURN_TTL: "86401" }));
});
test("ICE cache deduplicates, refreshes near expiry, rejects expired responses and never uses storage", async () => {
  let now = 1000000,
    count = 0;
  const config = serverICE.readConfig({
    PARTY_TURN_URLS: "turn:example:3478",
    PARTY_TURN_SECRET: "test",
  });
  const cache = ICE.createCache({
    now: () => now,
    request: () => {
      count++;
      return serverICE.issue(config, { now });
    },
  });
  const [a, b] = await Promise.all([cache.get(), cache.get()]);
  assert.equal(a, b);
  assert.equal(count, 1);
  now += 1000;
  assert.equal(await cache.get(), a);
  now = a.expiresAt - 10000;
  assert.notEqual(await cache.get(), a);
  assert.equal(count, 2);
  now += 4000000;
  await cache.get();
  assert.equal(count, 3);
  const expired = ICE.createCache({ now: () => 999999999, request: () => a });
  await assert.rejects(expired.get());
  const fs = require("node:fs");
  assert.ok(
    !fs
      .readFileSync(require.resolve("../../dist/voice/ice-config.js"), "utf8")
      .includes("localStorage"),
  );
  assert.equal(ICE.policy("relay"), "relay");
  assert.equal(ICE.policy("garbage"), "all");
});
test("selected candidate parsing tolerates host/STUN/relay UDP/TCP and incomplete reports without IPs", async () => {
  for (const [candidateType, protocol, relayProtocol, route] of [
    ["host", "udp", null, "direct"],
    ["host", "tcp", null, "direct"],
    ["srflx", "udp", null, "stun/direct"],
    ["prflx", "udp", null, "direct"],
    ["relay", "udp", "tcp", "relay"],
    ["relay", "udp", "tls", "relay"],
  ]) {
    const stats = new Map([
      ["transport", { type: "transport", selectedCandidatePairId: "pair" }],
      [
        "pair",
        {
          type: "candidate-pair",
          localCandidateId: "local",
          remoteCandidateId: "remote",
          currentRoundTripTime: 0.034,
        },
      ],
      [
        "local",
        {
          type: "local-candidate",
          candidateType,
          protocol,
          relayProtocol,
          address: "SECRET-IP",
        },
      ],
      ["remote", { candidateType: "host", protocol: "tcp" }],
    ]);
    const result = await network.getPeerConnectionDiagnostics({
      getStats: async () => stats,
    });
    assert.equal(result.candidatePair.route, route);
    assert.equal(result.candidatePair.rtt, 34);
    assert.equal(result.candidatePair.relayProtocol, relayProtocol);
    assert.ok(!JSON.stringify(result).includes("SECRET-IP"));
  }
  const nominated = new Map([
    ["p", { type: "candidate-pair", nominated: true, state: "succeeded" }],
  ]);
  assert.equal(
    (
      await network.getPeerConnectionDiagnostics({
        getStats: async () => nominated,
      })
    ).candidatePair.localType,
    null,
  );
  assert.equal(
    (
      await network.getPeerConnectionDiagnostics({
        getStats: async () => {
          throw Error();
        },
      })
    ).candidatePair,
    null,
  );
});
function clock() {
  let id = 0,
    time = 0;
  const tasks = new Map();
  return {
    setTimer(fn, ms) {
      const key = ++id;
      tasks.set(key, { fn, at: time + ms });
      return key;
    },
    clearTimer(key) {
      tasks.delete(key);
    },
    async advance(ms) {
      time += ms;
      for (const [key, task] of [...tasks])
        if (task.at <= time) {
          tasks.delete(key);
          task.fn();
          await tick();
        }
    },
    get pending() {
      return tasks.size;
    },
  };
}
test("disconnected grace, spontaneous recovery, backoff, bounded retries, signaling pause and manual retry", async () => {
  const c = clock(),
    calls = [],
    states = [];
  const r = network.createRecovery({
    ...c,
    restart: async () => calls.push("restart"),
    onState: (s) => states.push(s),
  });
  r.update("connected", "connected");
  r.update("disconnected", "disconnected");
  await c.advance(4999);
  assert.equal(calls.length, 0);
  r.update("connected", "connected");
  await c.advance(1);
  assert.equal(calls.length, 0);
  r.update("disconnected", "disconnected");
  await c.advance(5000);
  assert.equal(calls.length, 1);
  await c.advance(11999);
  assert.equal(calls.length, 1);
  await c.advance(1);
  assert.equal(calls.length, 2);
  await c.advance(15000);
  assert.equal(calls.length, 3);
  await c.advance(18000);
  assert.equal(r.state, "failed");
  assert.equal(c.pending, 0);
  r.retry();
  r.setAvailable(false);
  await c.advance(100000);
  assert.equal(calls.length, 3);
  r.setAvailable(true);
  await c.advance(5000);
  assert.equal(calls.length, 4);
  r.close();
  assert.equal(c.pending, 0);
  assert.ok(states.includes("reconnecting"));
});
test("polite side requests recovery; only elected leader restarts", async () => {
  const c = clock();
  let requests = 0,
    restarts = 0;
  const follower = network.createRecovery({
    ...c,
    leader: false,
    restart: () => restarts++,
    requestRestart: () => requests++,
  });
  follower.update("failed", "failed");
  await c.advance(0);
  assert.equal(requests, 1);
  assert.equal(restarts, 0);
  follower.close();
});
class Peer {
  static all = [];
  constructor(config) {
    this.config = config;
    this.signalingState = "stable";
    this.connectionState = "new";
    this.iceConnectionState = "new";
    this.offers = [];
    Peer.all.push(this);
  }
  addTrack() {
    return {};
  }
  async createOffer(options) {
    this.offers.push(options);
    return { type: "offer", sdp: "mock" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "mock" };
  }
  async setLocalDescription(d) {
    this.localDescription = d;
    this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(d) {
    this.remoteDescription = d;
    this.signalingState = d.type === "answer" ? "stable" : "have-remote-offer";
  }
  setConfiguration(value) {
    this.config = value;
  }
  restartIce() {
    this.restarted = (this.restarted || 0) + 1;
  }
  close() {
    this.closed = true;
  }
}
const stream = { getAudioTracks: () => [], getTracks: () => [] };
test("peer policy/current ICE, refreshed configuration before restart, fallback restart and stable negotiation queue", async () => {
  for (const policy of ["all", "relay"]) {
    const c = clock(),
      initial = [{ urls: ["stun:example"] }],
      fresh = [{ urls: ["turn:example"], username: "temporary", credential: "test" }];
    const endpoint = createPeer({
      Peer,
      localStream: stream,
      iceServers: initial,
      iceTransportPolicy: policy,
      polite: false,
      send() {},
      onStream() {},
      onState() {},
      onError: (e) => assert.fail(e),
      getIceConfiguration: async () => ({ iceServers: fresh }),
      recoveryOptions: c,
    });
    const pc = Peer.all.at(-1);
    assert.deepEqual(pc.config, {
      iceServers: initial,
      iceTransportPolicy: policy,
    });
    await endpoint.start();
    await endpoint.receive("answer", { type: "answer", sdp: "mock" });
    endpoint.retry();
    await c.advance(0);
    assert.equal(pc.restarted, 1);
    assert.deepEqual(pc.config.iceServers, fresh);
    assert.deepEqual(pc.offers.at(-1), { iceRestart: true });
    await endpoint.receive("answer", { type: "answer", sdp: "mock" });
    pc.restartIce = undefined;
    endpoint.retry();
    await c.advance(0);
    assert.deepEqual(pc.offers.at(-1), { iceRestart: true });
    endpoint.close();
    assert.equal(c.pending, 0);
  }
});
test("per-peer failure isolation, current ICE for late joins, retained P2P on signaling outage and explicit leave", async () => {
  let listener,
    lists = [],
    fetches = 0;
  const controllers = new Map();
  const s = createSession({
    clientId: "a",
    getIceConfiguration: async () => ({
      iceServers: [{ urls: ["stun:version-" + ++fetches] }],
    }),
    signaling: (o) => {
      listener = o;
      return {
        send() {
          return true;
        },
        close() {},
      };
    },
    peer: (o) => {
      const controller = {
        config: o.iceServers,
        close() {
          this.closed = true;
        },
        start() {},
        setSignalingAvailable(v) {
          this.available = v;
        },
        receive() {},
        retry() {},
      };
      controllers.set(controllers.size, controller);
      controller.options = o;
      return controller;
    },
    onPeers: (p) => (lists = p),
    onStream() {},
    onRemove() {},
    onError: (e) => assert.fail(e),
  });
  s.start(stream, "geral");
  listener.onStatus("conectado");
  listener.onMessage({ type: "peers", payload: { peers: ["b", "c"] } });
  await tick();
  controllers.get(0).options.onState("connected");
  controllers.get(1).options.onState("failed");
  assert.equal(lists.find((p) => p.id === "b").status, "conectado");
  assert.equal(lists.find((p) => p.id === "c").status, "falha");
  listener.onStatus("desconectado");
  assert.ok([...controllers.values()].every((c) => !c.closed));
  listener.onStatus("conectado");
  listener.onMessage({ type: "join", from: "d" });
  await tick();
  assert.equal(fetches, 3);
  assert.equal(controllers.get(0).config[0].urls[0], "stun:version-1");
  listener.onMessage({
    type: "leave",
    from: "b",
    payload: { reason: "signaling-disconnected" },
  });
  assert.equal(controllers.get(0).closed, undefined);
  listener.onMessage({ type: "join", from: "b", payload: { reply: true } });
  assert.equal(fetches, 3);
  listener.onMessage({ type: "leave", from: "c" });
  assert.equal(controllers.get(1).closed, true);
  assert.equal(controllers.get(0).closed, undefined);
  s.close();
  assert.ok([...controllers.values()].every((c) => c.closed));
});
test("lobby does not request ICE; local config and cache are available only when asked", async () => {
  let messages = [];
  const room = createRoom({
    clientId: "a",
    getMetadata: () => ({ displayName: "Alice", avatar: "" }),
    signaling: () => ({
      local: true,
      send: (type) => {
        messages.push(type);
        return true;
      },
      close() {},
    }),
  });
  await room.enter("geral");
  assert.deepEqual(messages, ["presence-join"]);
  assert.equal((await room.getIceConfiguration()).turn, false);
  assert.equal(messages.includes("ice-config-request"), false);
  room.leave();
});
test("socket and IP rate limits include reconnecting sockets and expire", () => {
  let now = 0;
  const limiter = serverICE.createLimiter({
    now: () => now,
    socketMax: 2,
    ipMax: 3,
  });
  const a = {},
    b = {};
  assert.equal(limiter.allow(a, "ip"), true);
  assert.equal(limiter.allow(a, "ip"), true);
  assert.equal(limiter.allow(a, "ip"), false);
  assert.equal(limiter.allow(b, "ip"), true);
  assert.equal(limiter.allow({}, "ip"), false);
  now = 60001;
  assert.equal(limiter.allow(a, "ip"), true);
});
test("recovery cannot schedule overlapping restarts while credential refresh is pending", async () => {
  const c = clock();
  let resolve,
    restarts = 0;
  const r = network.createRecovery({
    ...c,
    restart: () => {
      restarts++;
      return new Promise((r) => (resolve = r));
    },
  });
  r.update("failed", "failed");
  await c.advance(0);
  r.update("failed", "failed");
  await c.advance(0);
  assert.equal(restarts, 1);
  resolve();
  await tick();
  assert.equal(c.pending, 1);
  r.close();
});
test("perfect negotiation keeps impolite glare rejection and polite rollback during recovery", async () => {
  for (const polite of [false, true]) {
    const sent = [];
    const endpoint = createPeer({
      Peer,
      localStream: stream,
      polite,
      send: (type) => sent.push(type),
      onStream() {},
      onState() {},
      onError: (e) => assert.fail(e),
    });
    const pc = Peer.all.at(-1);
    await endpoint.start();
    await endpoint.receive("offer", { type: "offer", sdp: "colliding" });
    assert.equal(sent.includes("answer"), polite);
    if (polite) assert.equal(pc.signalingState, "stable");
    else assert.equal(pc.signalingState, "have-local-offer");
    endpoint.close();
  }
});
test("answering a remote restart also refreshes local TURN credentials before answering", async () => {
  let fetches = 0;
  const fresh = [{ urls: ["turn:example"], username: "fresh", credential: "test" }];
  const endpoint = createPeer({
    Peer,
    localStream: stream,
    polite: true,
    getIceConfiguration: async () => {
      fetches++;
      return { iceServers: fresh };
    },
    send() {},
    onStream() {},
    onState() {},
    onError: (e) => assert.fail(e),
  });
  await endpoint.receive("offer", { type: "offer", sdp: "remote-restart" });
  assert.equal(fetches, 1);
  assert.deepEqual(Peer.all.at(-1).config.iceServers, fresh);
  endpoint.close();
});
