const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { once } = require("node:events");
const api = require("../dist/voice/room-metadata.js"),
  roomFactory = require("../dist/voice/room.js"),
  wsFactory = require("../dist/voice/signaling-ws.js");
const WS = require("../server/node_modules/ws"),
  { createSignalingServer } = require("../server/signaling-server.cjs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await delay(5);
  }
  assert.fail("Timeout");
}
test("v1.3 room names, stable visual codes and bounded private recent rooms", () => {
  assert.equal(api.roomName("  "), "geral");
  assert.equal(api.roomName("x".repeat(49)), null);
  assert.equal(api.roomName("a\nb"), null);
  assert.equal(api.shortCode("same-uuid"), api.shortCode("same-uuid"));
  assert.match(api.shortCode("same-uuid"), /^[A-F0-9]{6}$/);
  assert.notEqual(api.shortCode("other"), api.shortCode("same-uuid"));
  let value = "[]";
  const recent = api.createRecents({
    getItem: () => value,
    setItem: (_k, v) => (value = v),
  });
  for (let i = 0; i < 7; i++) recent.visit("room-" + i, "nome " + i, i);
  assert.equal(recent.list().length, 5);
  assert.deepEqual(
    recent.list().map((e) => e.roomId),
    ["room-6", "room-5", "room-4", "room-3", "room-2"],
  );
  recent.visit("room-2", "revista", 10);
  recent.rename("room-2", "cinema");
  assert.equal(recent.list()[0].name, "cinema");
  assert.equal(recent.list()[0].lastVisited, 10);
  assert.deepEqual(Object.keys(JSON.parse(value)[0]), ["roomId", "name", "lastVisited"]);
  recent.remove("room-2");
  assert.equal(recent.list().length, 4);
  value = "invalid";
  assert.deepEqual(recent.list(), []);
});
test("v1.3 real server rename broadcasts only to registered room, validates and expires", async (t) => {
  const s = await service(t),
    a = await s.connect("a"),
    b = await s.connect("b"),
    c = await s.connect("c", "other");
  assert.equal(a.messages.find((m) => m.type === "presence-snapshot").payload.roomName, "geral");
  a.send("room-rename", { name: "cinema" });
  await until(() => b.messages.some((m) => m.payload?.roomName === "cinema"));
  assert.equal(
    c.messages.some((m) => m.payload?.roomName === "cinema"),
    false,
  );
  b.send("room-rename", { name: "x".repeat(49) });
  await until(() => b.messages.some((m) => m.type === "presence-error"));
  assert.equal(s.roomNames.get("one"), "cinema");
  b.send("room-rename", { name: "forged" }, { from: "a" });
  await delay(15);
  assert.equal(s.roomNames.get("one"), "cinema");
  b.send("room-rename", { name: "<img src=x onerror=alert(1)>" });
  await until(() => a.messages.some((m) => m.payload?.roomName === "<img src=x onerror=alert(1)>"));
  a.socket.close();
  b.socket.close();
  await until(() => !s.rooms.has("one"));
  assert.equal(s.roomNames.has("one"), false);
});
test("v1.4 presence metadata validated, isolated, normalized to real room/call membership and reconnect replay", async (t) => {
  const s = await service(t),
    a = await s.connect("a", "one", {
      displayName: "Alice",
      statusText: "<script>text only</script>",
      idle: true,
      activity: "sharing",
    }),
    other = await s.connect("other", "two");
  const first = a.messages.find((m) => m.type === "presence-snapshot").payload.participants[0];
  assert.equal(first.activity, "room");
  assert.equal(first.idle, true);
  a.send("join");
  await until(() => a.messages.some((m) => m.payload?.participants?.[0]?.inCall));
  assert.equal(
    a.messages.filter((m) => m.type === "presence-snapshot").at(-1).payload.participants[0]
      .activity,
    "sharing",
  );
  a.send("presence-update", { displayName: "Alice", idle: "bad" });
  await until(() => a.messages.some((m) => m.type === "presence-error"));
  assert.equal(s.rooms.get("one").get("a").metadata.idle, true);
  a.send("leave");
  await until(
    () =>
      a.messages.filter((m) => m.type === "presence-snapshot").at(-1).payload.participants[0]
        .activity === "room",
  );
  assert.equal(
    other.messages.some((m) => m.payload?.participants?.some((p) => p.clientId === "a")),
    false,
  );
  let messages = [];
  const adapter = wsFactory({
    clientId: "replay",
    roomId: "one",
    url: s.url,
    Socket: WS,
    retryMs: 5,
    onMessage: (m) => messages.push(m),
  });
  t.after(() => adapter.close());
  adapter.send("presence-join", undefined, {
    displayName: "Replay",
    statusText: "mood",
    idle: false,
    activity: "room",
  });
  await until(() => s.rooms.get("one")?.has("replay"));
  adapter.send("presence-update", undefined, {
    displayName: "Replay",
    statusText: "updated",
    idle: true,
    activity: "room",
  });
  await until(() => s.rooms.get("one").get("replay").metadata.idle);
  s.rooms.get("one").get("replay").socket.terminate();
  await until(() => messages.filter((m) => m.type === "chat-history").length === 2);
  assert.equal(s.rooms.get("one").get("replay").metadata.statusText, "updated");
  assert.equal(s.rooms.get("one").get("replay").metadata.idle, true);
});
test("v1.5 real signaling accepts short nowPlaying, rejects private fields and clears on pause without cross-room leak", async (t) => {
  const s = await service(t),
    a = await s.connect("a"),
    b = await s.connect("b"),
    c = await s.connect("c", "other");
  const nowPlaying = {
    title: "<img src=x onerror=alert(1)>",
    artist: "After",
    playing: true,
  };
  a.send("presence-update", { displayName: "A", nowPlaying });
  await until(() =>
    b.messages.some((m) => m.payload?.participants?.some((p) => p.nowPlaying?.playing)),
  );
  assert.equal(
    c.messages.some((m) => m.payload?.participants?.some((p) => p.nowPlaying?.playing)),
    false,
  );
  a.send("presence-update", {
    displayName: "A",
    nowPlaying: { ...nowPlaying, url: "blob:secret" },
  });
  await until(() => a.messages.some((m) => m.type === "presence-error"));
  assert.deepEqual(s.rooms.get("one").get("a").metadata.nowPlaying, nowPlaying);
  a.send("presence-update", { displayName: "A", nowPlaying: null });
  await until(
    () =>
      b.messages
        .filter((m) => m.type === "presence-snapshot")
        .at(-1)
        .payload.participants.find((p) => p.clientId === "a").nowPlaying === null,
  );
});
async function service(t, options = {}) {
  const s = createSignalingServer({ port: 0, host: "127.0.0.1", ...options });
  await once(s.wss, "listening");
  t.after(async () => {
    for (const c of s.wss.clients) c.terminate();
    await new Promise((r) => s.wss.close(r));
  });
  s.url = "ws://127.0.0.1:" + s.wss.address().port;
  s.connect = async (id, roomId = "one", metadata = { displayName: id }) => {
    const socket = new WS(s.url),
      messages = [];
    socket.on("message", (raw) => messages.push(JSON.parse(raw)));
    await once(socket, "open");
    const send = (type, payload, extra = {}) =>
      socket.send(JSON.stringify({ type, roomId, from: id, payload, ...extra }));
    send("presence-join", metadata);
    await until(() => messages.some((m) => m.type === "presence-snapshot"));
    return { socket, messages, send };
  };
  return s;
}
test("secure room IDs and party/invite URLs preserve technical parameters", () => {
  const calls = [];
  assert.equal(
    api.secureId({
      randomUUID: () => {
        calls.push(1);
        return "random-uuid";
      },
    }),
    "random-uuid",
  );
  assert.equal(calls.length, 1);
  assert.throws(() => api.secureId({}));
  assert.match(
    api.secureId({
      getRandomValues: (a) => {
        a.fill(42);
        return a;
      },
    }),
    /^[0-9a-f]{32}$/,
  );
  const base =
    "https://party.example/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787&voiceTransport=local&voiceIcePolicy=relay&other=kept#perfil";
  const changed = new URL(api.roomUrl(base, "new-id"));
  assert.equal(changed.searchParams.get("voiceTransport"), "local");
  assert.equal(changed.searchParams.get("voiceIcePolicy"), "relay");
  assert.equal(changed.searchParams.get("other"), "kept");
  assert.equal(changed.hash, "#spacevoice");
  assert.equal(api.parse(changed.href), "new-id");
  assert.equal(api.parse("http://localhost/"), null);
  assert.equal(api.parse("http://localhost/?party=geral"), null);
  assert.equal(api.parse("https://a/?party=%3Cscript%3E"), null);
  const invite = new URL(api.invite(base, "random"));
  assert.equal(invite.searchParams.get("voiceWsUrl"), "ws://localhost:8787");
  assert.equal(invite.searchParams.get("voiceTransport"), "local");
  assert.equal(invite.searchParams.get("other"), "kept");
  assert.equal(invite.searchParams.get("party"), "random");
});
test("metadata validation bounds names and avatars, safe image types and fallback; HTML name remains text", () => {
  assert.deepEqual(api.metadata({ displayName: "  Alice ", avatar: "" }), {
    displayName: "Alice",
    avatar: "",
  });
  assert.equal(api.metadata({}).displayName, "Convidado");
  assert.equal(
    api.metadata({ displayName: "<img onerror=alert(1)>" }).displayName,
    "<img onerror=alert(1)>",
  );
  for (const value of [
    { displayName: "x".repeat(65) },
    { avatar: "javascript:alert(1)" },
    { avatar: "data:image/svg+xml;base64,PHN2Zz4=" },
    { avatar: "data:text/html;base64,AAAA" },
    { avatar: "data:image/png;base64," + "A".repeat(api.MAX_AVATAR) },
    [],
  ])
    assert.equal(api.metadata(value), null);
  assert.equal(api.avatar("http://localhost/x.png"), null);
  assert.equal(api.avatar("http://localhost/x.png", { allowHttp: true }), "http://localhost/x.png");
  assert.equal(api.avatar("https://example.org/a.jpg"), "https://example.org/a.jpg");
  assert.equal(api.avatar("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(api.avatar("https://user:pass@example.org/a.jpg"), null);
});
test("presence controller snapshots deduplicate, update and leave; call borrows transport and leaves room intact", async () => {
  let hooks,
    closed = 0;
  const sent = [],
    changes = [];
  const room = roomFactory({
    clientId: "a",
    getMetadata: () => ({ displayName: "Alice" }),
    signaling: (o) => {
      hooks = o;
      return {
        send: (...args) => {
          sent.push(args);
          return true;
        },
        close: () => closed++,
      };
    },
    onChange: (s) => changes.push(s.roomId),
  });
  await room.enter("one");
  assert.equal(sent[0][0], "presence-join");
  assert.equal(room.state.roomId, "one");
  const item = { clientId: "b", displayName: "Bob", inCall: false };
  hooks.onMessage({
    type: "presence-snapshot",
    roomId: "one",
    payload: { participants: [item, item] },
  });
  assert.equal(room.state.participants.length, 1);
  hooks.onMessage({
    type: "presence-snapshot",
    roomId: "other",
    payload: { participants: [] },
  });
  assert.equal(room.state.participants.length, 1);
  room.update({ displayName: "Alice 2" });
  assert.equal(sent.at(-1)[0], "presence-update");
  let delivered = 0;
  const transport = room.callTransport({
    roomId: "one",
    onStatus() {},
    onMessage() {
      delivered++;
    },
  });
  transport.send("join");
  assert.equal(room.inCall, true);
  transport.send("leave");
  transport.close();
  assert.equal(room.inCall, false);
  assert.equal(room.state.roomId, "one");
  assert.equal(closed, 0);
  assert.ok(!sent.some((m) => m[0] === "presence-leave"));
  hooks.onStatus("desconectado");
  assert.equal(room.state.participants.length, 0);
  hooks.onMessage({
    type: "presence-snapshot",
    roomId: "one",
    payload: { participants: [item, item] },
  });
  assert.equal(room.state.participants.length, 1);
  room.leave();
  assert.equal(sent.at(-1)[0], "presence-leave");
  assert.equal(closed, 1);
  assert.equal(room.state.roomId, null);
});
test("room change cancels stale metadata completion and isolates callbacks", async () => {
  let resolve;
  let captures = 0;
  const room = roomFactory({
    clientId: "a",
    getMetadata: () => new Promise((r) => (resolve = r)),
    signaling: () => {
      captures++;
      return { send() {}, close() {} };
    },
  });
  const first = room.enter("one");
  room.leave();
  resolve({ displayName: "A" });
  await first;
  assert.equal(captures, 0);
  assert.equal(room.state.roomId, null);
});
test("server presence join/update/snapshot, room isolation, leave-call versus leave-room and socket cleanup", async (t) => {
  const s = await service(t),
    a = await s.connect("a"),
    b = await s.connect("b"),
    c = await s.connect("c", "other");
  await until(() => a.messages.at(-1).payload.participants.length === 2);
  assert.equal(
    a.messages.some((m) => m.type === "chat-history"),
    true,
  );
  assert.equal(
    a.messages.some((m) => ["peers", "offer"].includes(m.type)),
    false,
  );
  assert.equal(s.rooms.get("one").get("a").inCall, false);
  assert.equal(c.messages.at(-1).payload.participants.length, 1);
  a.send(
    "presence-update",
    { displayName: "Alice", avatar: "https://example.org/a.png", inCall: true },
    { from: "b" },
  );
  await delay(15);
  assert.equal(s.rooms.get("one").get("a").metadata.displayName, "a");
  a.send("presence-update", {
    displayName: "Alice",
    avatar: "https://example.org/a.png",
    inCall: true,
  });
  await until(() => s.rooms.get("one").get("a").metadata.displayName === "Alice");
  assert.equal(s.rooms.get("one").get("a").inCall, false);
  a.send("join");
  await until(() => s.rooms.get("one").get("a").inCall);
  assert.deepEqual(a.messages.find((m) => m.type === "peers").payload.peers, []);
  assert.equal(
    b.messages.some((m) => m.type === "join"),
    false,
  );
  a.send("offer", { type: "offer", sdp: "for lobby" }, { to: "b" });
  await delay(15);
  assert.equal(
    b.messages.some((m) => m.type === "offer"),
    false,
  );
  b.send("ice", { candidate: "for call" }, { to: "a" });
  await delay(15);
  assert.equal(
    a.messages.some((m) => m.type === "ice"),
    false,
  );
  b.send("join");
  await until(() => b.messages.some((m) => m.type === "peers"));
  assert.deepEqual(b.messages.find((m) => m.type === "peers").payload.peers, ["a"]);
  await until(() => a.messages.some((m) => m.type === "join" && m.from === "b"));
  a.send("offer", { type: "offer", sdp: "allowed" }, { to: "b" });
  await until(() => b.messages.some((m) => m.type === "offer"));
  assert.equal(
    c.messages.some((m) => m.type === "offer"),
    false,
  );
  a.send("chat-message", { text: "hello", authorName: "forged" });
  await until(() => b.messages.some((m) => m.type === "chat-message"));
  assert.equal(b.messages.find((m) => m.type === "chat-message").payload.authorName, "Alice");
  a.send("leave");
  await until(() => !s.rooms.get("one").get("a").inCall);
  assert.equal(s.rooms.get("one").size, 2);
  assert.equal(a.socket.readyState, 1);
  assert.equal(s.rooms.get("one").get("b").inCall, true);
  await until(() => b.messages.some((m) => m.type === "leave"));
  a.send("chat-message", { text: "lobby permitido" });
  await until(() =>
    b.messages.some((m) => m.type === "chat-message" && m.payload.text === "lobby permitido"),
  );
  assert.equal(
    a.messages.some((m) => m.type === "chat-error"),
    false,
  );
  a.send("presence-leave");
  await until(() => s.rooms.get("one").size === 1);
  b.socket.terminate();
  await until(() => !s.rooms.has("one"));
  assert.equal(s.history.has("one"), false);
});
test("room chat history and typing survive call transitions and never cross rooms", async (t) => {
  const s = await service(t),
    a = await s.connect("a", "one", { displayName: "Alice" }),
    other = await s.connect("other", "two", { displayName: "Other" });
  a.send("chat-message", { text: "antes da call" });
  await until(() => a.messages.some((m) => m.type === "chat-message"));
  const b = await s.connect("b", "one", { displayName: "Bob" });
  await until(() => b.messages.some((m) => m.type === "chat-history"));
  assert.deepEqual(
    b.messages.find((m) => m.type === "chat-history").payload.messages.map((m) => m.text),
    ["antes da call"],
  );
  assert.equal(
    other.messages.some((m) => m.type === "chat-message"),
    false,
  );
  b.send("typing-start", { authorName: "forged" });
  await until(() => a.messages.some((m) => m.type === "typing-start" && m.from === "b"));
  assert.equal(a.messages.find((m) => m.type === "typing-start").payload.authorName, "Bob");
  a.send("join");
  await until(() => s.rooms.get("one").get("a").inCall);
  a.send("leave");
  await until(() => !s.rooms.get("one").get("a").inCall);
  assert.equal(a.messages.filter((m) => m.type === "chat-history").length, 1);
  b.send("chat-message", { text: "depois da call" });
  await until(() =>
    a.messages.some((m) => m.type === "chat-message" && m.payload.text === "depois da call"),
  );
  const c = await s.connect("c", "one", { displayName: "C" });
  await until(() => c.messages.some((m) => m.type === "chat-history"));
  assert.deepEqual(
    c.messages.find((m) => m.type === "chat-history").payload.messages.map((m) => m.text),
    ["antes da call", "depois da call"],
  );
  assert.deepEqual(other.messages.find((m) => m.type === "chat-history").payload.messages, []);
  for (const client of [a, b, c, other]) client.socket.close();
});
test("server rejects bad/oversized metadata and bounds room membership/room count", async (t) => {
  const s = await service(t, { maxRoomMembers: 1, maxRooms: 1 }),
    a = await s.connect("a");
  a.send("presence-update", { avatar: "data:image/svg+xml;base64,AAAA" });
  await until(() => a.messages.some((m) => m.type === "presence-error"));
  assert.equal(s.rooms.get("one").get("a").metadata.avatar, "");
  const tryJoin = async (id, roomId, payload) => {
    const socket = new WS(s.url);
    await once(socket, "open");
    const done = once(socket, "close");
    socket.send(JSON.stringify({ type: "presence-join", roomId, from: id, payload }));
    return (await done)[0];
  };
  assert.equal(
    await tryJoin("bad", "one", {
      avatar: "data:image/png;base64," + "A".repeat(api.MAX_AVATAR),
    }),
    1008,
  );
  assert.equal(await tryJoin("b", "one", { displayName: "B" }), 1013);
  assert.equal(await tryJoin("c", "other", { displayName: "C" }), 1013);
  assert.equal(s.rooms.size, 1);
});
test("WebSocket room reconnect replays presence and active call without duplicate presence", async (t) => {
  const s = await service(t);
  let messages = [];
  const adapter = wsFactory({
    clientId: "a",
    roomId: "one",
    url: s.url,
    Socket: WS,
    retryMs: 5,
    onMessage: (m) => messages.push(m),
  });
  t.after(() => adapter.close());
  adapter.send("presence-join", undefined, { displayName: "Alice" });
  await until(() => s.rooms.get("one")?.has("a"));
  adapter.send("join");
  await until(() => s.rooms.get("one").get("a").inCall);
  s.rooms.get("one").get("a").socket.terminate();
  await until(() => messages.filter((m) => m.type === "peers").length === 2);
  assert.equal(s.rooms.get("one").size, 1);
  assert.equal(s.rooms.get("one").get("a").inCall, true);
  assert.equal(s.rooms.get("one").get("a").metadata.displayName, "Alice");
  adapter.send("leave");
  await until(() => !s.rooms.get("one").get("a").inCall);
  s.rooms.get("one").get("a").socket.terminate();
  await until(
    () =>
      messages.filter((m) => m.type === "presence-snapshot").length >= 4 &&
      s.rooms.get("one")?.has("a"),
  );
  assert.equal(s.rooms.get("one").get("a").inCall, false);
});
test("BroadcastChannel dev lobby announces metadata and call state without sending call messages to lobby", async () => {
  const factory = require("../dist/voice/signaling-local.js");
  class Channel {
    static list = new Set();
    constructor() {
      Channel.list.add(this);
    }
    postMessage(data) {
      for (const c of Channel.list) if (c !== this) queueMicrotask(() => c.onmessage?.({ data }));
    }
    close() {
      Channel.list.delete(this);
    }
  }
  const received = { a: [], b: [], c: [] };
  const make = (id, roomId) =>
    factory({
      clientId: id,
      roomId,
      Channel,
      onMessage: (m) => received[id].push(m),
    });
  const a = make("a", "one"),
    b = make("b", "one"),
    c = make("c", "other");
  a.send("presence-join", undefined, { displayName: "Alice" });
  b.send("presence-join", undefined, { displayName: "Bob" });
  c.send("presence-join", undefined, { displayName: "Other" });
  await delay(5);
  assert.equal(received.a.at(-1).payload.participants.length, 2);
  assert.equal(received.c.at(-1).payload.participants.length, 1);
  a.send("presence-update", undefined, {
    displayName: "Alice",
    statusText: "mood local",
    idle: true,
    activity: "sharing",
  });
  await delay(5);
  const localPresence = received.b
    .filter((m) => m.type === "presence-snapshot")
    .at(-1)
    .payload.participants.find((p) => p.clientId === "a");
  assert.equal(localPresence.statusText, "mood local");
  assert.equal(localPresence.idle, true);
  assert.equal(localPresence.activity, "room");
  a.send("room-rename", undefined, { name: "cinema local" });
  await delay(5);
  assert.equal(
    received.b.filter((m) => m.type === "presence-snapshot").at(-1).payload.roomName,
    "cinema local",
  );
  assert.equal(received.c.at(-1).payload.roomName, "geral");
  a.send("join");
  a.send("offer", "b", { sdp: "lobby must not receive" });
  await delay(5);
  assert.equal(
    received.b.some((m) => m.type === "offer"),
    false,
  );
  b.send("join");
  await delay(5);
  assert.ok(received.b.some((m) => m.type === "peers" && m.payload.peers.includes("a")));
  a.send("leave");
  await delay(5);
  assert.equal(
    received.b
      .filter((m) => m.type === "presence-snapshot")
      .at(-1)
      .payload.participants.find((p) => p.clientId === "a").inCall,
    false,
  );
  a.send("presence-leave");
  a.close();
  await delay(5);
  assert.equal(
    received.b.filter((m) => m.type === "presence-snapshot").at(-1).payload.participants.length,
    1,
  );
  b.close();
  c.close();
  assert.equal(Channel.list.size, 0);
});
