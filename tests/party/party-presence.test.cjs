const { test } = require("node:test"),
  assert = require("node:assert/strict");
const api = require("../../dist/voice/room-metadata.js"),
  presence = require("../../dist/voice/presence.js");
test("presence text and types bounded; activity priority never invents a call", () => {
  assert.deepEqual(
    api.presence({
      statusText: "  tentando terminar Trails ",
      idle: false,
      activity: "room",
    }),
    { statusText: "tentando terminar Trails", idle: false, activity: "room" },
  );
  for (const bad of [
    { statusText: "a".repeat(81) },
    { statusText: "a\nb" },
    { idle: "true" },
    { activity: "Spotify" },
    { statusText: { html: "x" } },
  ])
    assert.equal(api.presence(bad), null);
  assert.equal(
    api.presence({ statusText: "<img src=x onerror=alert(1)>" }).statusText,
    "<img src=x onerror=alert(1)>",
  );
  for (const [activity, label] of [
    ["speaking", "● falando"],
    ["sharing", "compartilhando tela"],
    ["muted", "× mutado"],
    ["call", "em chamada"],
  ])
    assert.equal(api.activityLabel({ inCall: true, idle: true, activity }), label);
  assert.equal(api.activityLabel({ inCall: false, activity: "speaking" }), "na sala");
  assert.equal(api.activityLabel({ idle: true }), "ausente");
});
test("one inactivity deadline; hidden tab does not cause idle, interaction restores active; stop cleans listeners", () => {
  let now = 0,
    seq = 0;
  const timers = new Map(),
    listeners = new Map(),
    changes = [];
  const p = presence.create({
    idleMs: 100,
    now: () => now,
    schedule: (f, ms) => {
      const id = ++seq;
      timers.set(id, { f, at: now + ms });
      return id;
    },
    cancel: (id) => timers.delete(id),
    target: {
      addEventListener: (e, f) => listeners.set(e, f),
      removeEventListener: (e) => listeners.delete(e),
    },
    onIdle: (v) => changes.push(v),
  });
  const advance = (ms) => {
    now += ms;
    for (const [id, item] of [...timers])
      if (item.at <= now) {
        timers.delete(id);
        item.f();
      }
  };
  p.start();
  p.start();
  assert.equal(timers.size, 1);
  assert.equal(listeners.has("visibilitychange"), false);
  advance(60);
  listeners.get("pointermove")();
  assert.equal(timers.size, 1);
  advance(40);
  assert.equal(p.idle, false);
  advance(60);
  assert.equal(p.idle, true);
  assert.deepEqual(changes, [true]);
  listeners.get("keydown")();
  assert.equal(p.idle, false);
  assert.deepEqual(changes, [true, false]);
  assert.equal(timers.size, 1);
  p.stop();
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0);
  p.start();
  assert.equal(p.idle, false);
  p.stop();
});
