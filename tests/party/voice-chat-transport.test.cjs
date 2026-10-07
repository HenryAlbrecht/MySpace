const { test } = require("node:test"),
  assert = require("node:assert/strict");
const local = require("../../dist/voice/signaling-local.js"),
  ws = require("../../dist/voice/signaling-ws.js"),
  session = require("../../dist/voice/session.js");
test("WS application accepts confirmed self echo/targeted history/error, rejects foreign rooms/targets and reports dropped sends", () => {
  let socket;
  class Socket {
    constructor() {
      socket = this;
      this.readyState = 0;
    }
    send(data) {
      this.sent = JSON.parse(data);
    }
    close() {}
  }
  const messages = [],
    t = ws({
      clientId: "a",
      roomId: "r",
      Socket,
      onMessage: (m) => messages.push(m),
    });
  assert.equal(t.send("chat-message", undefined, { text: "offline" }), false);
  socket.readyState = 1;
  socket.onopen();
  for (const type of ["chat-message", "typing-start", "typing-stop"])
    socket.onmessage({
      data: JSON.stringify({ type, roomId: "r", from: "a", payload: {} }),
    });
  for (const type of ["chat-history", "chat-error"])
    socket.onmessage({
      data: JSON.stringify({ type, roomId: "r", to: "a", payload: {} }),
    });
  for (const m of [
    { type: "chat-message", roomId: "other", from: "b" },
    { type: "chat-history", roomId: "r", to: "other" },
    { type: "chat-error", roomId: "r" },
    { type: "typing-start", roomId: "r", from: "b", to: "other" },
  ])
    socket.onmessage({ data: JSON.stringify(m) });
  assert.equal(messages.length, 5);
  assert.equal(t.send("chat-message", undefined, { text: "test" }), true);
  assert.equal(socket.sent.from, "a");
  t.close();
  assert.equal(t.send("chat-message", undefined, {}), false);
});
test("BroadcastChannel application uses one channel, echoes confirmed local message and isolates typing/chat rooms", () => {
  const channels = [];
  class Channel {
    constructor() {
      channels.push(this);
    }
    postMessage(data) {
      for (const other of channels)
        if (other !== this && !other.closed) other.onmessage?.({ data });
    }
    close() {
      this.closed = true;
    }
  }
  const messages = { a: [], b: [], c: [] },
    adapters = {};
  for (const id of ["a", "b", "c"])
    adapters[id] = local({
      clientId: id,
      roomId: id === "c" ? "other" : "r",
      Channel,
      onMessage: (m) => messages[id].push(m),
    });
  adapters.a.send("presence-join", undefined, { displayName: "Alice" });
  adapters.b.send("presence-join", undefined, { displayName: "Bob" });
  adapters.c.send("presence-join", undefined, { displayName: "Other" });
  for (const id of ["a", "b", "c"]) messages[id] = [];
  adapters.a.send("chat-message", undefined, {
    text: " Hi ",
    authorName: "Alice",
    authorId: "forged",
  });
  assert.equal(messages.a.length, 1);
  assert.deepEqual(messages.a, messages.b);
  assert.equal(messages.c.length, 0);
  assert.equal(messages.a[0].payload.authorId, "a");
  assert.equal(messages.a[0].payload.text, "Hi");
  adapters.b.send("typing-start", undefined, { authorName: "B" });
  adapters.b.send("typing-stop");
  assert.deepEqual(
    messages.a.map((m) => m.type),
    ["chat-message", "typing-start", "typing-stop"],
  );
  assert.equal(messages.c.length, 0);
  for (const t of Object.values(adapters)) t.close();
  assert.ok(channels.every((c) => c.closed && c.onmessage === null));
});
test("session dispatches chat separately without starting peers or forwarding it to WebRTC", () => {
  let options,
    creates = 0;
  const received = [],
    sent = [];
  const s = session({
    clientId: "a",
    signaling: (o) => {
      options = o;
      return {
        send: (...m) => {
          sent.push(m);
          return true;
        },
        close() {},
      };
    },
    peer: () => {
      creates++;
      throw Error("No peer expected");
    },
    onApplication: (m) => received.push(m),
    onPeers() {},
    onStream() {},
    onRemove() {},
    onError: (e) => assert.fail(e),
  });
  s.start({ getAudioTracks: () => [] }, "r");
  for (const type of ["chat-message", "chat-history", "chat-error", "typing-start", "typing-stop"])
    options.onMessage({ type, from: "b", roomId: "r", payload: {} });
  assert.equal(received.length, 5);
  assert.equal(creates, 0);
  assert.equal(s.sendApplication("chat-message", { text: "hi" }), true);
  assert.equal(sent.at(-1)[0], "chat-message");
  assert.equal(s.sendApplication("offer", {}), false);
  s.close();
  assert.equal(s.sendApplication("chat-message", {}), false);
});
