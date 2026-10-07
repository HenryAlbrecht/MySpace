const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const WS = require("../server/node_modules/ws");
const { createSignalingServer } = require("../server/signaling-server.cjs");
const signaling = require("../dist/voice/signaling-ws.js");
const session = require("../dist/voice/session.js");
const peer = require("../dist/voice/peer.js");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await delay(5);
  }
  assert.fail("Timed out waiting for signaling");
}
async function server(t) {
  const service = createSignalingServer({ port: 0, host: "127.0.0.1" });
  await once(service.wss, "listening");
  t.after(async () => {
    for (const s of service.wss.clients) s.terminate();
    await new Promise((r) => service.wss.close(r));
  });
  return { ...service, url: `ws://127.0.0.1:${service.wss.address().port}` };
}
test("real server registers rooms, routes targeted SDP/ICE, rejects spoofing and cleans leave/disconnect", async (t) => {
  const service = await server(t),
    received = { a: [], b: [], c: [], d: [] },
    sockets = {};
  for (const id of Object.keys(received)) {
    const s = (sockets[id] = new WS(service.url));
    await once(s, "open");
    s.on("message", (raw) => received[id].push(JSON.parse(raw)));
    s.send(
      JSON.stringify({
        type: "join",
        roomId: id === "c" ? "other" : "geral",
        from: id,
      }),
    );
  }
  await until(
    () => service.rooms.get("geral")?.size === 3 && received.a.some((m) => m.from === "d"),
  );
  assert.equal(service.rooms.get("other").size, 1);
  assert.deepEqual(received.d.find((m) => m.type === "peers").payload.peers, ["a", "b"]);
  assert.deepEqual(
    received.c.map((m) => m.type),
    ["peers", "chat-history"],
  );
  for (const type of ["offer", "answer", "ice"]) {
    sockets.a.send(
      JSON.stringify({
        type,
        roomId: "geral",
        from: "a",
        to: "b",
        payload: { type, sdp: "test", candidate: "test" },
      }),
    );
    await until(() => received.b.some((m) => m.type === type));
    assert.ok(!received.d.some((m) => m.type === type));
  }
  sockets.a.send(
    JSON.stringify({
      type: "participant-state",
      roomId: "geral",
      from: "a",
      payload: { micMuted: true, ignored: "extra" },
    }),
  );
  await until(
    () =>
      received.b.some((m) => m.type === "participant-state") &&
      received.d.some((m) => m.type === "participant-state"),
  );
  assert.deepEqual(received.b.find((m) => m.type === "participant-state").payload, {
    micMuted: true,
  });
  assert.ok(!received.c.some((m) => m.type === "participant-state"));
  sockets.a.send(
    JSON.stringify({
      type: "participant-state",
      roomId: "geral",
      from: "d",
      payload: { micMuted: false },
    }),
  );
  sockets.a.send(
    JSON.stringify({
      type: "participant-state",
      roomId: "geral",
      from: "a",
      payload: { micMuted: "invalid" },
    }),
  );
  await delay(20);
  assert.equal(received.b.filter((m) => m.type === "participant-state").length, 1);
  sockets.a.send(
    JSON.stringify({
      type: "ice",
      roomId: "other",
      from: "c",
      to: "c",
      payload: { candidate: "spoof" },
    }),
  );
  sockets.a.send("invalid");
  sockets.a.send(JSON.stringify(null));
  sockets.a.send(
    JSON.stringify({
      type: "peers",
      roomId: "geral",
      from: "a",
      to: "b",
      payload: { peers: ["fake"] },
    }),
  );
  await delay(30);
  assert.deepEqual(
    received.c.map((m) => m.type),
    ["peers", "chat-history"],
  );
  sockets.a.send(JSON.stringify({ type: "leave", roomId: "geral", from: "a" }));
  await until(() => received.b.some((m) => m.type === "leave" && m.from === "a"));
  assert.ok(!service.rooms.get("geral").has("a"));
  sockets.b.terminate();
  await until(() => received.d.some((m) => m.type === "leave" && m.from === "b"));
  sockets.c.close();
  sockets.d.close();
  await until(() => service.rooms.size === 0);
});
test("adapter filters invalid input, sends envelope, detaches and reconnects without duplicate listeners", async () => {
  class Socket {
    static all = [];
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      Socket.all.push(this);
    }
    send(value) {
      this.sent.push(JSON.parse(value));
    }
    close() {
      this.closed = true;
    }
    open() {
      this.readyState = 1;
      this.onopen();
    }
  }
  const messages = [],
    statuses = [];
  const adapter = signaling({
    clientId: "a",
    roomId: "geral",
    url: "ws://example.test",
    Socket,
    retryMs: 5,
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
  });
  adapter.send("join", undefined, { reply: false });
  const first = Socket.all[0];
  first.open();
  assert.deepEqual(first.sent[0], {
    type: "join",
    roomId: "geral",
    from: "a",
    payload: { reply: false },
  });
  for (const data of [
    "bad",
    "null",
    JSON.stringify({ type: "join", from: "a", roomId: "geral" }),
    JSON.stringify({ type: "join", from: "b", roomId: "other" }),
    JSON.stringify({ type: "join", from: "b", roomId: "geral", to: "c" }),
  ])
    first.onmessage({ data });
  first.onmessage({
    data: JSON.stringify({ type: "join", from: "b", roomId: "geral", to: "a" }),
  });
  assert.equal(messages.length, 1);
  for (const m of [
    { type: "peers", roomId: "other", to: "a", payload: { peers: ["b"] } },
    { type: "peers", roomId: "geral", to: "c", payload: { peers: ["b"] } },
    { type: "peers", roomId: "geral", to: "a", payload: { peers: [42] } },
  ])
    first.onmessage({ data: JSON.stringify(m) });
  assert.equal(messages.length, 1);
  first.onmessage({
    data: JSON.stringify({
      type: "peers",
      roomId: "geral",
      to: "a",
      payload: { peers: ["b", "c"] },
    }),
  });
  assert.equal(messages.length, 2);
  first.onclose();
  assert.equal(first.onmessage, null);
  await until(() => Socket.all.length === 2);
  const second = Socket.all[1];
  second.open();
  assert.equal(second.sent.length, 1);
  assert.equal(statuses.filter((s) => s === "conectado").length, 2);
  second.onclose();
  adapter.close();
  await delay(20);
  assert.equal(Socket.all.length, 2);
  assert.equal(second.onopen, null);
});
test("two sessions negotiate through real WS; signaling reconnect retains peers without duplicate negotiation", async (t) => {
  const service = await server(t),
    lists = { a: [], b: [] },
    exchanges = [],
    controllers = [];
  class Stream {
    getTracks() {
      return [];
    }
  }
  class Peer {
    constructor() {
      controllers.push(this);
    }
    addTrack() {}
    async createOffer() {
      return { type: "offer", sdp: "test" };
    }
    async createAnswer() {
      return { type: "answer", sdp: "test" };
    }
    async setLocalDescription(value) {
      this.localDescription = value;
    }
    async setRemoteDescription(value) {
      this.remoteDescription = value;
    }
    async addIceCandidate() {
      this.receivedIce = true;
    }
    close() {
      this.closed = true;
    }
  }
  const create = (id) =>
    session({
      clientId: id,
      signaling: (o) => signaling({ ...o, url: service.url, Socket: WS, retryMs: 20 }),
      peer: (o) =>
        peer({
          ...o,
          Peer,
          Stream,
          send: (type, payload) => {
            exchanges.push([id, type]);
            o.send(type, payload);
          },
        }),
      onPeers: (p) => (lists[id] = p),
      onRemove() {},
      onStream() {},
      onError: (e) => assert.fail(e),
    });
  const a = create("a"),
    b = create("b");
  t.after(() => {
    a.close();
    b.close();
  });
  b.start(new Stream(), "geral");
  a.start(new Stream(), "geral");
  await until(() => exchanges.some(([id, type]) => id === "b" && type === "answer"));
  assert.deepEqual(
    exchanges.filter((m) => m[1] === "offer"),
    [["a", "offer"]],
  );
  assert.equal(lists.a.length, 1);
  controllers
    .find((pc) => pc.localDescription?.type === "offer")
    .onicecandidate({ candidate: { candidate: "test" } });
  await until(() => controllers.some((pc) => pc.receivedIce));
  service.rooms.get("geral").get("a").socket.terminate();
  await until(() => service.rooms.get("geral")?.has("a"));
  await delay(60);
  assert.equal(controllers.length, 2);
  assert.ok(controllers.every((c) => !c.closed));
  assert.equal(exchanges.filter((m) => m[1] === "offer").length, 1);
  a.close();
  b.close();
  await until(() => service.rooms.size === 0);
  assert.ok(controllers.every((c) => c.closed));
});
