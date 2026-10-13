const assert = require("node:assert/strict");
const { test } = require("node:test");
const PlaybackContext = require("../../dist/music/playback-context.js");
globalThis.PlaybackContext = PlaybackContext;
const QueueManager = require("../../dist/music/queue-manager.js");

const tracks = ["one", "two", "three", "four"].map((id) => ({ id, kind: "music" }));
const createQueue = (values = []) => {
  const randomValues = values.slice();
  return QueueManager.create({ random: () => randomValues.shift() ?? 0.999 });
};

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
  const queue = createQueue([0.34, 0.99]);
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.setModes({ shuffle: true });
  assert.equal(queue.next().track.id, "three");
  assert.equal(queue.next().track.id, "two");

  assert.deepEqual(queue.snapshot().history.map((entry) => entry.id), ["one", "three"]);
  assert.deepEqual(
    queue.previousEntries().map(({ entry }) => entry.id),
    ["one", "three"],
  );
  assert.equal(queue.previous().track.id, "three");
});

test("upcoming projection excludes current and follows repeat and prioritized next", () => {
  const queue = createQueue();
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
  assert.equal(queue.upcoming().determined, true);
  assert.equal(queue.upcoming().entries[0].track.id, "priority");

  queue.setModes({ repeat: "one" });
  assert.equal(queue.upcoming().entries[0].track.id, "priority");
});

test("finite end, repeat modes, shuffle and stale operation revisions are explicit", () => {
  const queue = createQueue();
  queue.start({ type: "search", tracks: tracks.slice(0, 3), startIndex: 2 });
  assert.equal(queue.next(), null);

  queue.setModes({ repeat: "all" });
  assert.equal(queue.next().track.id, "one");
  queue.setModes({ repeat: "one" });
  assert.equal(queue.next().track.id, "two", "manual Next remains distinct from ended replay");

  queue.start({ type: "search", tracks: tracks.slice(0, 3) });
  queue.setModes({ repeat: "off", shuffle: true });
  assert.equal(queue.next().track.id, "two");
  assert.equal(queue.next().track.id, "three");
  assert.equal(queue.next(), null);

  const token = queue.snapshot().revision;
  queue.append({ id: "four" });
  assert.equal(queue.isCurrent(token), false);
});

test("shuffle bag plays each entry once and Repeat OFF stops at cycle end", () => {
  const savedTracks = tracks.map((track) => ({ ...track }));
  const queue = createQueue();
  queue.start({ type: "playlist", tracks: savedTracks });
  queue.setModes({ shuffle: true });

  assert.deepEqual(
    [queue.current().id, queue.next().track.id, queue.next().track.id, queue.next().track.id],
    ["one", "two", "three", "four"],
  );
  assert.equal(queue.next(), null);
  assert.deepEqual(savedTracks.map((track) => track.id), ["one", "two", "three", "four"]);
});

test("Repeat ALL starts a fresh cycle without repeating its boundary track", () => {
  const queue = createQueue();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 4) });
  queue.setModes({ shuffle: true, repeat: "all" });
  const cycle = [queue.current().id];
  for (let count = 0; count < 3; count++) cycle.push(queue.next().track.id);

  assert.equal(new Set(cycle).size, 4);
  const nextCycle = queue.next().track.id;
  assert.notEqual(nextCycle, cycle.at(-1));
  assert.deepEqual(
    queue.snapshot().queue.map((track) => track.id),
    ["one", "two", "three", "four"],
  );
});

test("Repeat ONE preserves the pending bag while manual Next still advances", () => {
  const queue = createQueue();
  queue.start({ type: "playlist", tracks });
  queue.setModes({ shuffle: true });
  const pending = queue.upcoming().entries.map(({ track }) => track.id);
  queue.setModes({ repeat: "one" });

  assert.equal(queue.current().id, "one");
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), pending);
  assert.equal(queue.next().track.id, "two");
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["three", "four"]);
});

test("reapplying shuffle does not rebuild the bag", () => {
  let randomCalls = 0;
  const queue = QueueManager.create({ random: () => (randomCalls++, 0.999) });
  queue.start({ type: "playlist", tracks });
  queue.setModes({ shuffle: true });
  const callsAfterBuild = randomCalls;
  const pending = queue.upcoming().entries.map(({ track }) => track.id);
  queue.setModes({ shuffle: true });

  assert.equal(randomCalls, callsAfterBuild);
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), pending);
});

test("starting at the third track leaves earlier unplayed entries in the shuffle bag", () => {
  const queue = createQueue();
  queue.start({ type: "album", tracks, startIndex: 2 });
  queue.setModes({ shuffle: true });

  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["one", "two", "four"]);
  assert.deepEqual(
    [queue.next().track.id, queue.next().track.id, queue.next().track.id],
    ["one", "two", "four"],
  );
});

test("shuffle Previous and Next follow the already traversed path before the bag", () => {
  const queue = createQueue([0.34, 0.99]);
  queue.start({ type: "playlist", tracks, startIndex: 2 });
  queue.setModes({ shuffle: true });
  assert.deepEqual(
    [queue.current().id, queue.next().track.id, queue.next().track.id],
    ["three", "one", "four"],
  );

  assert.deepEqual(queue.previousEntries().map(({ entry }) => entry.id), ["three", "one"]);
  assert.equal(queue.previous().track.id, "one");
  assert.equal(queue.next().track.id, "four");
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two"]);
  assert.equal(queue.next().track.id, "two");
});

test("manual selection consumes pending entries and allows replaying consumed entries", () => {
  const queue = createQueue();
  queue.start({ type: "playlist", tracks });
  queue.setModes({ shuffle: true });
  queue.select(2);

  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two", "four"]);
  queue.select(0);
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two", "four"]);
  assert.equal(queue.next().track.id, "two");
});

test("appended tracks join the active bag without resetting its existing order", () => {
  const queue = createQueue();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.setModes({ shuffle: true });
  queue.append({ id: "four" });

  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two", "three", "four"]);
  assert.deepEqual(
    [queue.next().track.id, queue.next().track.id, queue.next().track.id],
    ["two", "three", "four"],
  );
});

test("multiple Play Next entries preserve insertion order and outrank the bag", () => {
  const queue = createQueue();
  queue.start({ type: "playlist", tracks: tracks.slice(0, 3) });
  queue.setModes({ shuffle: true });
  queue.append({ id: "priority-one" }, { next: true });
  queue.append({ id: "priority-two" }, { next: true });

  assert.deepEqual(
    queue.upcoming().entries.slice(0, 2).map(({ track }) => track.id),
    ["priority-one", "priority-two"],
  );
  assert.deepEqual(
    [queue.next().track.id, queue.next().track.id, queue.next().track.id],
    ["priority-one", "priority-two", "two"],
  );
});

test("removing a pending entry cleans the bag without affecting other entries", () => {
  const queue = createQueue();
  queue.start({ type: "playlist", tracks });
  queue.setModes({ shuffle: true });
  queue.remove(2);

  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two", "four"]);
  assert.deepEqual([queue.next().track.id, queue.next().track.id], ["two", "four"]);
  assert.equal(queue.next(), null);
});

test("reordering the visible queue preserves shuffle entry order", () => {
  const queue = createQueue();
  queue.start({ type: "playlist", tracks });
  queue.setModes({ shuffle: true });
  queue.reorder(3, 1);

  assert.deepEqual(
    queue.snapshot().queue.map((track) => track.id),
    ["one", "four", "two", "three"],
  );
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["two", "three", "four"]);
  assert.deepEqual(
    [queue.next().track.id, queue.next().track.id, queue.next().track.id],
    ["two", "three", "four"],
  );
});

test(
  "shuffle mode toggles preserve current playback and account for actually played entries",
  () => {
    const queue = createQueue();
    queue.start({ type: "playlist", tracks, startIndex: 2 });
    assert.equal(queue.next().track.id, "four");
    queue.previous();
    assert.equal(queue.current().id, "three");
    queue.setModes({ shuffle: true });

    assert.equal(queue.current().id, "three");
    assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["one", "two"]);
    queue.setModes({ shuffle: false });
    assert.equal(queue.current().id, "three");
    assert.equal(queue.next().track.id, "four");
  },
);

test("single and two-entry shuffle queues respect repeat modes", () => {
  const single = createQueue();
  single.start({ type: "single", tracks: tracks.slice(0, 1) });
  single.setModes({ shuffle: true });
  assert.equal(single.next(), null);
  single.setModes({ repeat: "all" });
  assert.deepEqual(single.upcoming().entries.map(({ track }) => track.id), ["one"]);
  assert.equal(single.next().track.id, "one");

  const pair = createQueue();
  pair.start({ type: "playlist", tracks: tracks.slice(0, 2) });
  pair.setModes({ shuffle: true, repeat: "all" });
  assert.deepEqual(
    [pair.current().id, pair.next().track.id, pair.next().track.id, pair.next().track.id],
    ["one", "two", "one", "two"],
  );
  pair.setModes({ repeat: "off" });
  assert.equal(pair.next(), null);
});

test("empty queues and duplicate musical identities remain safe and distinct", () => {
  const empty = createQueue();
  empty.start({ type: "playlist", tracks: [] });
  empty.setModes({ shuffle: true });
  assert.equal(empty.next(), null);
  assert.equal(empty.previous(), null);

  const duplicates = createQueue();
  duplicates.start({
    type: "playlist",
    tracks: [
      { id: "same", title: "Same recording" },
      { id: "same", title: "Same recording" },
    ],
  });
  duplicates.setModes({ shuffle: true });
  assert.equal(duplicates.next().track.id, "same");
  assert.equal(duplicates.next(), null);
});

test("new playback contexts reset shuffle state without mutating saved playlist order", () => {
  const savedTracks = tracks.map((track) => ({ ...track }));
  const queue = createQueue();
  queue.start({ type: "playlist", tracks: savedTracks });
  queue.setModes({ shuffle: true });
  queue.next();
  queue.start({ type: "collection", tracks: savedTracks.slice(0, 3), startIndex: 1 });

  assert.equal(queue.current().id, "two");
  assert.deepEqual(queue.snapshot().history, []);
  assert.deepEqual(queue.upcoming().entries.map(({ track }) => track.id), ["one", "three"]);
  assert.deepEqual(savedTracks.map((track) => track.id), ["one", "two", "three", "four"]);
});

test("removing the current entry lets playback advance to the remaining queue", () => {
  const queue = QueueManager.create();
  queue.start({ type: "single", tracks: tracks.slice(0, 3) });
  queue.remove(0);

  assert.equal(queue.current(), null);
  assert.equal(queue.next().track.id, "two");
});
