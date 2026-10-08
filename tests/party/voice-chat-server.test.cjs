const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { once } = require("node:events");
const WS = require("../../server/node_modules/ws"),
  { createSignalingServer } = require("../../server/party/signaling-server.cjs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await delay(5);
  }
  assert.fail("Timeout");
}
async function fixture(t) {
  const service = createSignalingServer({ port: 0, host: "127.0.0.1" });
  await once(service.wss, "listening");
  t.after(async () => {
    for (const s of service.wss.clients) s.terminate();
    await new Promise((r) => service.wss.close(r));
  });
  async function connect(id, room = "geral", join = true) {
    const socket = new WS("ws://127.0.0.1:" + service.wss.address().port),
      messages = [];
    socket.on("message", (raw) => messages.push(JSON.parse(raw)));
    await once(socket, "open");
    const send = (type, payload, extra = {}) =>
      socket.send(JSON.stringify({ type, roomId: room, from: id, payload, ...extra }));
    if (join) {
      send("join");
      await until(() => messages.some((m) => m.type === "chat-history"));
    }
    return { socket, messages, send };
  }
  return { ...service, connect };
}
test("server owns message identity/time/ID, rejects invalid/nonmember sends and isolates room/history broadcasts", async (t) => {
  const s = await fixture(t),
    a = await s.connect("a"),
    b = await s.connect("b"),
    c = await s.connect("c", "private"),
    outsider = await s.connect("outside", "geral", false);
  const before = Date.now();
  a.send(
    "chat-message",
    {
      text: " hi\nthere ",
      authorName: " Alice ",
      id: "forged",
      authorId: "b",
      createdAt: 1,
    },
    { from: "b" },
  );
  await until(() => b.messages.some((m) => m.type === "chat-message"));
  const m = b.messages.find((m) => m.type === "chat-message");
  assert.equal(m.from, "a");
  assert.equal(m.payload.authorId, "a");
  assert.equal(m.payload.authorName, "Alice");
  assert.equal(m.payload.text, "hi\nthere");
  assert.notEqual(m.payload.id, "forged");
  assert.ok(m.payload.createdAt >= before);
  assert.equal(m.payload.roomId, "geral");
  assert.equal(a.messages.filter((m) => m.type === "chat-message").length, 1);
  assert.equal(c.messages.filter((m) => m.type === "chat-message").length, 0);
  const d = await s.connect("d");
  assert.deepEqual(d.messages.find((m) => m.type === "chat-history").payload.messages, [m.payload]);
  assert.equal(b.messages.filter((m) => m.type === "chat-history").length, 1);
  for (const payload of [
    { text: "" },
    { text: "  " },
    { text: 3 },
    { text: "x".repeat(2001) },
    { text: "x", authorName: "n".repeat(65) },
  ])
    a.send("chat-message", payload);
  outsider.send("chat-message", { text: "outside" });
  a.send("chat-message", { text: "cross-room" }, { roomId: "private" });
  await until(
    () =>
      a.messages.filter((m) => m.type === "chat-error").length === 6 &&
      outsider.messages.some((m) => m.type === "chat-error"),
  );
  assert.equal(b.messages.filter((m) => m.type === "chat-message").length, 1);
  assert.equal(a.socket.readyState, 1);
  a.send("chat-message", { text: "<script>alert(1)</script>" });
  await until(() => b.messages.filter((m) => m.type === "chat-message").length === 2);
  assert.equal(b.messages.at(-1).payload.text, "<script>alert(1)</script>");
  assert.notEqual(b.messages.at(-1).payload.id, m.payload.id);
});
test("server retains only 50 messages, targets snapshots, rate limits chat/typing independently without closing WS", async (t) => {
  let time = 100000;
  t.mock.method(Date, "now", () => time);
  const s = await fixture(t),
    a = await s.connect("a"),
    b = await s.connect("b"),
    c = await s.connect("c", "private");
  for (let batch = 0; batch < 11; batch++) {
    for (let i = 0; i < 5; i++) a.send("chat-message", { text: "m" + (batch * 5 + i) });
    await until(
      () => b.messages.filter((m) => m.type === "chat-message").length === (batch + 1) * 5,
    );
    time += 5001;
  }
  assert.equal(s.history.get("geral").length, 50);
  assert.equal(s.history.get("geral")[0].text, "m5");
  assert.equal(new Set(s.history.get("geral").map((m) => m.id)).size, 50);
  const d = await s.connect("d");
  assert.equal(d.messages.find((m) => m.type === "chat-history").payload.messages.length, 50);
  assert.equal(a.messages.filter((m) => m.type === "chat-history").length, 1);
  for (let i = 0; i < 6; i++) a.send("chat-message", { text: "spam" + i });
  await until(() =>
    a.messages.some((m) => m.type === "chat-error" && m.payload.code === "rate-limit"),
  );
  assert.equal(a.socket.readyState, 1);
  assert.equal(b.messages.filter((m) => m.type === "chat-message").length, 60);
  for (let i = 0; i < 12; i++) a.send("typing-start", { authorName: "Alice" });
  await until(() => b.messages.filter((m) => m.type === "typing-start").length === 8);
  await delay(15);
  assert.equal(b.messages.filter((m) => m.type === "typing-start").length, 8);
  assert.equal(c.messages.filter((m) => m.type === "typing-start").length, 0);
  time += 5001;
  a.send("typing-stop");
  await until(() => b.messages.some((m) => m.type === "typing-stop"));
  a.send("leave");
  await until(() => b.messages.some((m) => m.type === "leave"));
  assert.equal(s.history.get("geral").length, 50);
  b.socket.close();
  d.socket.close();
  await until(() => !s.rooms.has("geral"));
  assert.equal(s.history.has("geral"), false);
});
