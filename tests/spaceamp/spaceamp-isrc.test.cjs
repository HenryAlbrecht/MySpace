const { test } = require("node:test"),
  assert = require("node:assert/strict");
const model = require("../../dist/music-model.js"),
  collection = require("../../dist/collection/collection.js"),
  core = require("../../dist/spaceamp/spaceamp.js");
const apple = require("../../server/music/apple-normalize.cjs").normalizeAppleRecord,
  deezer = require("../../server/music/deezer-normalize.cjs").normalizeDeezerRecord;
test("catalog ISRC survives Collection persistence, queue conversion and playback snapshot", () => {
  for (const catalog of [
    apple(
      {
        trackId: 1,
        trackName: "Recording",
        artistName: "Artist",
        isrc: "jpk652300130",
      },
      "music",
    ),
    deezer(
      {
        id: 1,
        title: "Recording",
        artist: { name: "Artist" },
        isrc: "JPK652300130",
      },
      "music",
    ),
  ]) {
    const item = collection.validateItem({
      ...catalog,
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
  }
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
  assert.equal(apple({ trackId: 1, trackName: "Song" }, "music").isrc, undefined);
  assert.equal(deezer({ id: 1, title: "Song" }, "music").isrc, undefined);
});
