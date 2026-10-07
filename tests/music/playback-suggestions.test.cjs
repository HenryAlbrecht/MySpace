const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music-catalog.cjs");
const catalog = (playbackSource) =>
  createMusicCatalog({
    youtubeMusic: { searchTracks: async () => [] },
    musicbrainz: { playbackSource },
  });
test("confident MusicBrainz YouTube fallback retains its matched source", async () => {
  const source = {
    type: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  };
  const api = catalog(async (title, artist) => {
    assert.equal(title, "Song");
    assert.equal(artist, "Artist");
    return {
      items: [{ title, channel: artist, ...source }],
      source,
      status: "matched",
    };
  });
  const result = await api.playbackSource("Song", "Artist");
  assert.deepEqual(result.source, { ...source, videoId: "dQw4w9WgXcQ" });
  assert.equal(result.status, "matched");
  assert.equal(result.provider, "MusicBrainz");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].catalogId, undefined);
});
test("ambiguous and direct-audio fallbacks require selection", async () => {
  for (const source of [null, { type: "audio", url: "https://artist.example/song.mp3" }]) {
    const result = await catalog(async () => ({
      status: "choose",
      source,
      items: [{ title: "Song" }],
    })).playbackSource("Song", "Artist");
    assert.equal(result.status, "choose");
    assert.equal(result.source, null);
    assert.equal(result.items.length, 1);
  }
});
test("empty and failed providers return an honest nonfatal lookup result", async () => {
  const empty = await catalog(async () => ({ items: [] })).playbackSource("Song", "Artist");
  assert.deepEqual(empty, {
    status: "not-found",
    source: null,
    items: [],
    provider: "MusicBrainz",
  });
  const failed = await catalog(async () => {
    throw Error("offline");
  }).playbackSource("Song", "Artist");
  assert.deepEqual(failed, {
    status: "not-found",
    source: null,
    items: [],
    provider: "MusicBrainz",
    unavailable: true,
  });
});
