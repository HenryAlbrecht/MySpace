const { test } = require("node:test"),
  assert = require("node:assert/strict");
const chat = require("../../dist/voice/chat.js");
function fixture() {
  let time = 10000,
    serial = 0;
  const timers = new Map(),
    sent = [],
    changes = [];
  const c = chat({
    clientId: "a",
    send: (type, payload) => {
      sent.push({ type, payload });
      return true;
    },
    getName: () => " Meu perfil ",
    now: () => time,
    setTimer: (fn, ms) => {
      const id = ++serial;
      timers.set(id, { fn, at: time + ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    onChange: (s, reason) => changes.push(reason),
  });
  c.start("geral");
  c.connection(true);
  return {
    c,
    sent,
    changes,
    timers,
    advance(ms) {
      time += ms;
      for (const [id, t] of [...timers])
        if (t.at <= time) {
          timers.delete(id);
          t.fn();
        }
    },
  };
}
const message = (id, text = "teste", authorId = "b", createdAt = 100) => ({
  type: "chat-message",
  roomId: "geral",
  from: authorId,
  payload: {
    id,
    roomId: "geral",
    authorId,
    authorName: "Convidado",
    text,
    createdAt,
  },
});
test("chat rejects empty/whitespace/overlong messages, trims edges only and enforces connection", () => {
  const f = fixture();
  for (const value of ["", " \n\t ", "x".repeat(2001)]) {
    f.c.draft(value);
    assert.equal(f.c.submit(), false);
  }
  assert.equal(f.sent.filter((m) => m.type === "chat-message").length, 0);
  f.c.draft(" \nprimeira\n segunda\n ");
  assert.equal(f.c.submit(), true);
  assert.deepEqual(f.sent.find((m) => m.type === "chat-message").payload, {
    text: "primeira\n segunda",
    authorName: "Meu perfil",
  });
  f.c.draft("x".repeat(2000));
  assert.equal(f.c.submit(), true);
  f.c.connection(false);
  f.c.draft("draft offline");
  assert.equal(f.c.submit(), false);
  assert.equal(f.c.state.draft, "draft offline");
  f.c.close();
  assert.equal(f.timers.size, 0);
});
test("history/live/reconnect deduplicate IDs, server time sorts stably, messages stay bounded and room isolated", () => {
  const f = fixture(),
    a = message("a", "<script>alert(1)</script>", "b", 200),
    b = message("b", "earlier", "b", 100);
  f.c.receive(a);
  f.c.receive(a);
  f.c.receive({
    type: "chat-history",
    roomId: "geral",
    payload: { messages: [b.payload, a.payload] },
  });
  assert.deepEqual(
    f.c.state.messages.map((m) => m.id),
    ["b", "a"],
  );
  assert.equal(f.c.state.messages[1].text, "<script>alert(1)</script>");
  f.c.receive({ ...message("foreign"), roomId: "other" });
  f.c.receive({ ...message("spoof"), from: "different" });
  assert.equal(f.c.state.messages.length, 2);
  f.c.draft("keep me");
  f.c.connection(false);
  f.c.connection(true);
  f.c.receive({
    type: "chat-history",
    roomId: "geral",
    payload: { messages: [a.payload, b.payload] },
  });
  assert.equal(f.c.state.messages.length, 2);
  assert.equal(f.c.state.draft, "keep me");
  for (let i = 0; i < 150; i++) f.c.receive(message("n" + i, "bounded", "b", 300 + i));
  assert.equal(f.c.state.messages.length, 100);
  f.c.start("other");
  assert.equal(f.c.state.messages.length, 0);
  assert.equal(f.c.state.draft, "");
  f.c.close();
});
test("typing is throttled, stops after inactivity/send/clear and remote states expire/leave/reconnect/room switch", () => {
  const f = fixture();
  f.c.draft("h");
  f.c.draft("he");
  assert.equal(f.sent.filter((m) => m.type === "typing-start").length, 1);
  f.advance(1000);
  f.c.draft("hello");
  assert.equal(f.sent.filter((m) => m.type === "typing-start").length, 2);
  f.advance(2000);
  assert.equal(f.sent.at(-1).type, "typing-stop");
  f.c.receive({
    type: "typing-start",
    roomId: "other",
    from: "x",
    payload: { authorName: "X" },
  });
  assert.equal(f.c.state.typing.length, 0);
  const start = (id) =>
    f.c.receive({
      type: "typing-start",
      roomId: "geral",
      from: id,
      payload: { authorName: id },
    });
  start("b");
  start("c");
  f.c.receive({ type: "leave", roomId: "geral", from: "b" });
  assert.deepEqual(
    f.c.state.typing.map((t) => t.id),
    ["c"],
  );
  f.advance(4000);
  assert.equal(f.c.state.typing.length, 0);
  start("b");
  f.c.receive({ type: "typing-stop", roomId: "geral", from: "b" });
  assert.equal(f.c.state.typing.length, 0);
  start("c");
  f.c.receive(message("sent", "hello", "c"));
  assert.equal(f.c.state.typing.length, 0);
  start("b");
  f.c.connection(false);
  assert.equal(f.c.state.typing.length, 0);
  f.c.connection(true);
  f.c.draft("clear");
  f.c.draft("");
  assert.equal(f.sent.at(-1).type, "typing-stop");
  start("b");
  f.c.close();
  assert.equal(f.timers.size, 0);
});
test("unread depends on visibility/proximity; viewport clears it without stealing manual scroll", () => {
  const f = fixture();
  f.c.receive(message("visible"));
  assert.equal(f.c.state.unread, 0);
  f.c.viewport(true, false);
  f.c.receive(message("scrolled"));
  assert.equal(f.c.state.unread, 1);
  assert.equal(f.c.state.nearBottom, false);
  f.c.receive(message("scrolled"));
  assert.equal(f.c.state.unread, 1);
  f.c.viewport(false, true);
  f.c.receive(message("hidden"));
  assert.equal(f.c.state.unread, 2);
  f.c.receive(message("own", "mine", "a"));
  assert.equal(f.c.state.unread, 2);
  f.c.viewport(true, true);
  assert.equal(f.c.state.unread, 0);
  f.c.close();
});
test("client spam guard has a separate typing throttle, recovers after window and never queues/retries messages", () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    f.c.draft("m" + i);
    assert.equal(f.c.submit(), true);
  }
  f.c.draft("sixth");
  assert.equal(f.c.submit(), false);
  assert.equal(f.c.state.draft, "sixth");
  f.advance(5001);
  assert.equal(f.c.submit(), true);
  f.c.connection(false);
  f.advance(20000);
  assert.equal(f.sent.filter((m) => m.type === "chat-message").length, 6);
  f.c.close();
});
test("initial history is quiet; missed reconnect messages count as unread once; invalid timestamps cannot reach rendering", () => {
  const f = fixture();
  f.c.viewport(false, false);
  const first = message("first").payload,
    missed = message("missed").payload;
  const history = (messages) =>
    f.c.receive({
      type: "chat-history",
      roomId: "geral",
      payload: { messages },
    });
  history([first]);
  assert.equal(f.c.state.unread, 0);
  f.c.connection(false);
  f.c.connection(true);
  history([first, missed]);
  assert.equal(f.c.state.unread, 1);
  history([first, missed]);
  assert.equal(f.c.state.unread, 1);
  for (const createdAt of [Infinity, 1e30, -1, NaN])
    f.c.receive(message("invalid-" + createdAt, "bad", "b", createdAt));
  assert.equal(f.c.state.messages.length, 2);
  f.c.close();
});
