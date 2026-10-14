const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const { createMusicBrainzClient } = require("../../server/music/musicbrainz.cjs");
test("YouTube canonical search handles all categories, including empty results and failures", async () => {
  for (const kind of ["music", "album", "artist"]) {
    let calls = 0;
    const c = createMusicCatalog({
      youtubeMusic: {
        search: async (k, q) => {
          calls++;
          assert.equal(k, kind);
          assert.equal(q, "Oasis");
          return { items: [] };
        },
      },
    });
    assert.deepEqual((await c.search(kind, "Oasis")).items, []);
    assert.equal(calls, 1);
  }
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => {
        throw Error("YouTube offline");
      },
    },
  });
  await assert.rejects(c.search("music", "Wonderwall"), /YouTube offline/);
});
test("automatic source can be direct audio, never a catalog page or preview inferred from metadata", async () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  const c = createMusicBrainzClient({
    interval: 0,
    fetcher: async (url) => ({
      ok: true,
      json: async () =>
        url.includes("/" + id)
          ? {
              id,
              title: "Song",
              "artist-credit": [{ name: "Artist" }],
              relations: [
                {
                  "target-type": "url",
                  type: "free streaming",
                  url: { resource: "https://artist.example/song.mp3" },
                },
              ],
            }
          : {
              recordings: [{ id, title: "Song", "artist-credit": [{ name: "Artist" }] }],
            },
    }),
  });
  const r = await c.playbackSource("Song", "Artist");
  assert.equal(r.source.type, "audio");
  assert.equal(r.source.url, "https://artist.example/song.mp3");
});
