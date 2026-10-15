const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const amp = require("../../dist/spaceamp/spaceamp.js");

function setup() {
  const played = [];
  const fetched = [];
  let now = 0;
  let changed;
  const root = {
    document: { hidden: false, body: { dataset: {} }, addEventListener() {} },
    addEventListener() {},
    MutationObserver: class {
      constructor(callback) { changed = callback; }
      observe() {}
    },
    AudioContext: class {
      state = "running";
      destination = {};
      decodeAudioData() { return Promise.resolve({}); }
      createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
      createBufferSource() {
        return {
          connect(gain) { this.gain = gain; }, disconnect() {},
          start() { played.push(this); },
          stop() { this.stopped = true; this.onended?.(); },
        };
      }
    },
    fetch(url) {
      fetched.push(url);
      return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    },
  };
  vm.runInNewContext(fs.readFileSync("dist/spaceamp/system-sounds.js", "utf8"), {
    window: root, performance: { now: () => now },
  });
  const sounds = root.createSystemSounds();
  return { sounds, played, fetched, root, changed: () => changed(), tick: (value) => { now = value; } };
}
const settle = () => new Promise(setImmediate);

test("system effects reuse their sample bank, debounce cursor and keep a separate gain", async () => {
  const h = setup();
  h.sounds.play("cursor");
  h.sounds.play("cursor");
  await settle();
  assert.equal(h.played.length, 1);
  assert.equal(h.played[0].gain.gain.value, 0.7);
  assert.equal(h.fetched.length, 10);
  h.tick(31);
  h.sounds.play("cursor");
  h.sounds.play("confirm");
  await settle();
  assert.equal(h.played.length, 3);
  assert.equal(h.fetched.length, 10);
});

test("peel speed changes replace the loop, including pending decode and stop", async () => {
  const h = setup();
  h.sounds.play("peelMid");
  h.sounds.play("peelFast");
  h.sounds.play("peelMid");
  await settle();
  assert.equal(h.played.length, 1);
  assert.equal(h.played[0].loop, true);
  h.sounds.play("peelFast");
  await settle();
  assert.equal(h.played[0].stopped, true);
  assert.equal(h.played.length, 2);
  h.sounds.play("peelStop");
  assert.equal(h.played[1].stopped, true);
  h.sounds.play("peelMid");
  h.sounds.play("peelStop");
  await settle();
  assert.equal(h.played.length, 2);
});

test("disabling effects stops active and pending effects without affecting SPACEAMP", async () => {
  const h = setup();
  const player = amp.create();
  player.configure({ systemSound: h.sounds.play, stopSystemSounds: h.sounds.stop });
  player.update({ title: "Music" }, true);
  player.setQueue([{ id: "track", title: "Music" }]);
  const state = player.getState();
  player.systemSound("peelMid");
  await settle();
  h.root.document.body.dataset.xmbSystemSounds = "false";
  h.changed();
  assert.equal(h.played[0].stopped, true);
  player.systemSound("confirm");
  await settle();
  assert.equal(h.played.length, 1);
  assert.deepEqual(player.getState(), state);
  h.root.document.body.dataset.xmbSystemSounds = "true";
  player.systemSound("confirm");
  h.root.document.hidden = true;
  await settle();
  assert.equal(h.played.length, 1, "late sample cannot play in background");
});
