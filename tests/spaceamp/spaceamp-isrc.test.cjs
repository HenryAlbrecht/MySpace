const { test } = require("node:test"),
  assert = require("node:assert/strict");
const model = require("../../dist/music/music-model.js"),
  collection = require("../../dist/collection/collection.js"),
  core = require("../../dist/spaceamp/spaceamp.js");
test("catalog ISRC survives Collection persistence, queue conversion and playback snapshot", () => {
  const item = collection.validateItem({
    kind: "music",
    catalogId: "ytmusic:video:dQw4w9WgXcQ",
    title: "Recording",
    artist: "Artist",
    source: "YouTube Music",
    isrc: "jpk652300130",
    status: "planned",
    playbackSource: {
      type: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  });
  const restored = JSON.parse(JSON.stringify(item)),
    track = model.queueTrack(restored),
    snapshot = core.track(track, { provider: "youtube", url: track.url });
  assert.equal(snapshot.isrc, "JPK652300130");
  assert.equal(track.isrc, "JPK652300130");
  assert.equal(model.library({ ...restored, isrc: track.isrc }).isrc, "JPK652300130");
});
test("identifier formatting and absent identifiers keep metadata fallback without inventing an ISRC", () => {
  const base = {
    title: "Song",
    playbackSource: { type: "audio", url: "https://example.com/song.mp3" },
  };
  assert.equal(model.queueTrack({ ...base, isrc: "jp-k65-23-00130" }).isrc, "JPK652300130");
  assert.equal(
    model.queueTrack({ ...base, metadataSources: { isrc: "JPK652300130" } }).isrc,
    "JPK652300130",
  );
  for (const isrc of [undefined, "", "not-an-isrc"])
    assert.equal(model.queueTrack({ ...base, isrc }).isrc, "");
});
