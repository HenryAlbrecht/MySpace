const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../server/music-catalog.cjs");
const row = {
  title: "Song",
  artist: "Artist",
  album: "Album",
  duration: 210,
  videoId: "10z6-vQm23w",
  url: "https://www.youtube.com/watch?v=10z6-vQm23w",
  resultType: "song",
};
test("YouTube Music is primary, with ambiguity retained rather than hidden by fallback", async () => {
  let fallbacks = 0;
  const make = (rows) =>
    createMusicCatalog({
      youtubeMusic: {
        searchTracks: async (target) => {
          assert.equal(target.albumTitle, "Album");
          assert.equal(target.trackDuration, 210);
          return rows;
        },
      },
      musicbrainz: {
        playbackSource: async () => {
          fallbacks++;
          throw Error("not expected");
        },
      },
    });
  assert.equal(
    (
      await make([row]).playbackSource("Song", "Artist", {
        album: "Album",
        duration: 210,
      })
    ).status,
    "matched",
  );
  assert.equal(
    (
      await make([
        row,
        {
          ...row,
          videoId: "dQw4w9WgXcQ",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ]).playbackSource("Song", "Artist", { album: "Album", duration: 210 })
    ).status,
    "choose",
  );
  assert.equal(fallbacks, 0);
});
test("provider failure, empty or malicious results use MusicBrainz; both down is nonfatal", async () => {
  for (const rows of [[], [{ ...row, videoId: "bad" }], null]) {
    let calls = 0;
    const catalog = createMusicCatalog({
      youtubeMusic: {
        searchTracks: async () => {
          if (rows === null) throw Error("timeout");
          return rows;
        },
      },
      musicbrainz: {
        playbackSource: async () => {
          calls++;
          return {
            status: "matched",
            source: { type: "youtube", videoId: row.videoId, url: row.url },
            items: [],
            provider: "MusicBrainz",
          };
        },
      },
    });
    const result = await catalog.playbackSource("Song", "Artist");
    assert.equal(result.provider, "MusicBrainz");
    assert.equal(calls, 1);
  }
  const catalog = createMusicCatalog({
    youtubeMusic: {
      searchTracks: async () => {
        throw Error("offline");
      },
    },
    musicbrainz: {
      playbackSource: async () => {
        throw Error("offline");
      },
    },
  });
  assert.equal((await catalog.playbackSource("Song", "Artist")).unavailable, true);
  for (const args of [
    ["", "Artist"],
    ["Song", "Artist", { duration: NaN }],
    ["Song", "Artist", { duration: -1 }],
    ["Song", "Artist", { album: "x".repeat(301) }],
  ])
    await assert.rejects(catalog.playbackSource(...args), { status: 400 });
});
