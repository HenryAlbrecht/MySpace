const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  model = require("../../dist/music-model.js"),
  amp = require("../../dist/spaceamp/spaceamp.js");
test("catalog references never become playback and known metadata is retained", () => {
  const item = model.library({
    title: "Song",
    catalogId: "deezer:123",
    url: "https://www.deezer.com/track/123",
    artist: "Artist",
    albumTitle: "Album",
  });
  assert.equal(item.playbackSource, null);
  assert.equal(item.metadataSources.deezerId, "123");
  assert.throws(() => model.queueTrack(item));
  const linked = model.library({
    ...item,
    playbackSource: {
      type: "youtube",
      url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  });
  const q = model.queueTrack(linked);
  assert.equal(q.albumTitle, "Album");
  assert.equal(q.metadataSources.deezerId, "123");
  assert.equal(q.playbackSource.type, "youtube");
  assert.throws(() => model.source({ type: "youtube", url: "javascript:alert(1)" }));
  assert.throws(() => model.source({ type: "local", fileRef: "../file" }));
});
test("one controller delegates queue and controls without privacy affecting playback", () => {
  const calls = [],
    a = amp.create();
  a.configure({
    select: (v) => calls.push(v),
    enqueue: (v) => calls.push(v),
    play: () => calls.push("play"),
    pause: () => calls.push("pause"),
    setVolume: (v) => calls.push(v),
  });
  a.share(false);
  a.play("id");
  a.enqueue("other");
  a.play();
  a.pause();
  a.setVolume(2);
  assert.deepEqual(calls, ["id", "other", "play", "pause", 1]);
  a.setQueue([{ id: "one" }]);
  const state = a.getState();
  state.queue[0].id = "changed";
  assert.equal(a.getState().queue[0].id, "one");
});
