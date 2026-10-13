const assert = require("node:assert/strict");
const { test } = require("node:test");
const PlaybackContext = require("../../dist/music/playback-context.js");
globalThis.PlaybackContext = PlaybackContext;
const QueueManager = require("../../dist/music/queue-manager.js");

const tracks = ["one", "two", "three", "four"].map((id) => ({ id, kind: "music" }));

test("PlaybackContext normalizes the source and snapshots track references", () => {
  const context = PlaybackContext.create({
    type: "album",
    sourceId: "release:1",
    title: "Album",
    tracks,
    startIndex: 2,
    getNext: async () => [],
  });

  assert.equal(context.type, "album");
  assert.equal(context.sourceId, "release:1");
  assert.equal(context.startIndex, 2);
  assert.notEqual(context.tracks, tracks);
  assert.notEqual(context.tracks[0], tracks[0]);
  assert.equal(PlaybackContext.create({ type: "video" }).type, "single");
});

test("context playback starts at the selected album track without changing saved tracks", () => {
  const savedTracks = tracks.map((track) => ({ ...track }));
  const queue = QueueManager.create();
  queue.start({ type: "album", sourceId: "album:1", tracks: savedTracks, startIndex: 2 });

  assert.equal(queue.current().id, "three");
  assert.equal(queue.next().track.id, "four");
  assert.deepEqual(savedTracks.map((track) => track.id), ["one", "two", "three", "four"]);
});

test("play next is inserted after the current track and history survives reorder", () => {
  const queue = QueueManager.create();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.append({ id: "priority" }, { next: true });

  assert.equal(queue.next().track.id, "priority");
  assert.equal(queue.next().track.id, "two");
  assert.equal(queue.previous().track.id, "priority");

  const reordered = QueueManager.create();
  reordered.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  reordered.select(1);
  reordered.select(2);
  reordered.reorder(0, 2);
  assert.equal(reordered.current().id, "three");
  assert.equal(reordered.previous().track.id, "two");
});

test("previous follows real playback history without cycling between tracks", () => {
  const queue = QueueManager.create();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.next();
  queue.next();

  assert.equal(queue.previous().track.id, "two");
  assert.equal(queue.previous().track.id, "one");
  assert.equal(queue.previous(), null);
  assert.deepEqual(queue.snapshot().history, []);
});

test("normal playback exposes tracks before its starting position", () => {
  const queue = QueueManager.create();
  queue.start({ type: "album", tracks, startIndex: 2 });

  assert.equal(queue.snapshot().history.length, 0);
  assert.deepEqual(
    queue.previousEntries().map(({ entry }) => entry.id),
    ["one", "two"],
  );
  assert.equal(queue.previous().track.id, "two");
  assert.equal(queue.previous().track.id, "one");
  assert.equal(queue.previous(), null);
  assert.deepEqual(queue.snapshot().history, []);
});

test("selecting an earlier normal track keeps one queue entry and preserves the rest", () => {
  const queue = QueueManager.create();
  queue.start({ type: "playlist", tracks, startIndex: 3 });

  const earlier = queue.previousEntries();
  assert.deepEqual(earlier.map(({ entry }) => entry.id), ["one", "two", "three"]);
  const selected = queue.select(earlier[0].position);

  assert.equal(selected.track.id, "one");
  assert.deepEqual(queue.snapshot().queue.map(({ id }) => id), ["one", "two", "three", "four"]);
  assert.deepEqual(queue.previousEntries().map(({ entry }) => entry.id), []);
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two", "three", "four"]);
});

test("replaying history keeps future tracks queued without duplicating them in history", () => {
  const queue = QueueManager.create();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.next();
  queue.next();
  assert.equal(queue.previous().track.id, "two");

  const replayed = queue.replayFromHistory(0);
  assert.equal(replayed.track.id, "one");
  assert.equal(queue.snapshot().queue.length, 3);
  assert.deepEqual(queue.snapshot().history, []);
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two", "three"]);
  assert.equal(queue.next().track.id, "two");
});

test("replaying the newest history entry preserves only older history and queue order", () => {
  const queue = QueueManager.create();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.next();
  queue.next();

  const replayed = queue.replayFromHistory(1);
  assert.equal(replayed.track.id, "two");
  assert.deepEqual(queue.snapshot().history.map((entry) => entry.id), ["one"]);
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["three"]);
  assert.equal(queue.previous().track.id, "one");
});

test("shuffle history follows playback order instead of queue positions", () => {
  const queue = QueueManager.create();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.setModes({ shuffle: true });
  const previousRandom = Math.random;
  Math.random = () => 0.999;
  try {
    assert.equal(queue.next().track.id, "three");
    assert.equal(queue.next().track.id, "two");
  } finally {
    Math.random = previousRandom;
  }

  assert.deepEqual(queue.snapshot().history.map((entry) => entry.id), ["one", "three"]);
  assert.deepEqual(
    queue.previousEntries().map(({ entry }) => entry.id),
    ["one", "three"],
  );
  assert.equal(queue.previous().track.id, "three");
});

test("upcoming projection excludes current and follows repeat and prioritized next", () => {
  const queue = QueueManager.create();
  queue.start({ type: "album", tracks, startIndex: 2 });
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["four"]);

  queue.setModes({ repeat: "all" });
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["four", "one", "two"]);

  queue.append({ id: "priority" }, { next: true });
  assert.deepEqual(
    queue.upcoming().entries.map(({ track }) => track.id),
    ["priority", "four", "one", "two"],
  );

  queue.setModes({ shuffle: true });
  assert.equal(queue.upcoming().determined, false);
  assert.equal(queue.upcoming().entries[0].track.id, "priority");

  queue.setModes({ repeat: "one" });
  assert.deepEqual(queue.upcoming(), { determined: true, entries: [] });
});

test("finite end, repeat modes, shuffle and stale operation revisions are explicit", () => {
  const queue = QueueManager.create();
  queue.start({ type: "search", tracks: tracks.slice(0, 3), startIndex: 2 });
  assert.equal(queue.next(), null);

  queue.setModes({ repeat: "all" });
  assert.equal(queue.next().track.id, "one");
  queue.setModes({ repeat: "one" });
  assert.equal(queue.next().track.id, "one");

  queue.setModes({ repeat: "off", shuffle: true });
  const previousRandom = Math.random;
  Math.random = () => 0.999;
  try {
    assert.equal(queue.next().track.id, "three");
  } finally {
    Math.random = previousRandom;
  }

  const token = queue.snapshot().revision;
  queue.append({ id: "four" });
  assert.equal(queue.isCurrent(token), false);
});

test("removing the current entry lets playback advance to the remaining queue", () => {
  const queue = QueueManager.create();
  queue.start({ type: "single", tracks: tracks.slice(0, 3) });
  queue.remove(0);

  assert.equal(queue.current(), null);
  assert.equal(queue.next().track.id, "two");
});
