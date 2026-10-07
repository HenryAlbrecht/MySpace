const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createMusicCatalog } = require("../../server/music-catalog.cjs");
const { createMusicClient } = require("../../server/music/music.cjs");
const { createMusicBrainzClient } = require("../../server/musicbrainz.cjs");
const song = {
  kind: "song",
  trackId: 1,
  trackName: "Wonderwall",
  artistName: "Oasis",
  artistId: 2,
  collectionId: 3,
  collectionName: "Morning Glory",
  artworkUrl100: "https://example.test/100x100bb.jpg",
  trackViewUrl: "https://music.apple.com/song/1",
  collectionViewUrl: "https://music.apple.com/album/3",
};
test("YouTube canonical search handles all categories, including empty results and failures", async () => {
  const forbidden = {
    search: () => {
      throw Error("must not call secondary catalog");
    },
  };
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
      itunes: forbidden,
      deezer: forbidden,
      lastfm: forbidden,
      musicbrainz: forbidden,
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
    itunes: forbidden,
    deezer: forbidden,
    lastfm: forbidden,
  });
  await assert.rejects(c.search("music", "Wonderwall"), /YouTube offline/);
});
test("legacy Apple adapter title search wins over namesake artist, preserves artwork and song URL", async () => {
  const calls = [];
  const c = createMusicClient({
    fetcher: async (url) => {
      const u = new URL(url);
      calls.push(u);
      return {
        ok: true,
        json: async () => ({
          results:
            u.pathname === "/lookup"
              ? [
                  {
                    ...song,
                    trackId: 4,
                    trackName: "Witchcraft",
                    artistName: "Wonderwall",
                  },
                ]
              : u.searchParams.get("entity") === "musicArtist"
                ? [{ artistId: 9, artistName: "Wonderwall" }]
                : [song],
        }),
      };
    },
  });
  const r = await c.search("music", "Wonderwall");
  assert.equal(r.items[0].artist, "Oasis");
  assert.equal(r.items[0].image, "https://example.test/600x600bb.jpg");
  assert.equal(r.items[0].url, song.trackViewUrl);
  assert.ok(!r.items.some((i) => i.title === "Witchcraft"));
  assert.equal(calls.length, 2);
  assert.ok(calls.every((u) => u.hostname === "itunes.apple.com"));
});
test("legacy Apple adapter artist search and artist expansion work in all three categories", async () => {
  const c = createMusicClient({
    fetcher: async (url) => {
      const u = new URL(url),
        kind = u.searchParams.get("entity");
      return {
        ok: true,
        json: async () => ({
          results:
            kind === "musicArtist"
              ? [{ wrapperType: "artist", artistId: 2, artistName: "Oasis" }]
              : kind === "album"
                ? [
                    {
                      wrapperType: "collection",
                      collectionId: 3,
                      collectionName: "Morning Glory",
                      artistName: "Oasis",
                    },
                  ]
                : [song],
        }),
      };
    },
  });
  assert.ok((await c.search("music", "Oasis")).items.some((i) => i.artist === "Oasis"));
  assert.equal((await c.search("album", "Oasis")).items[0].title, "Morning Glory");
  assert.equal((await c.search("artist", "Oasis")).items[0].title, "Oasis");
});
test("legacy Apple adapter parallel identical searches share requests and cache, no per-result enrichment", async () => {
  let calls = 0;
  const c = createMusicClient({
    fetcher: async (url) => {
      calls++;
      await new Promise((r) => setTimeout(r, 2));
      return {
        ok: true,
        json: async () => ({
          results: new URL(url).searchParams.get("entity") === "musicArtist" ? [] : [song],
        }),
      };
    },
  });
  await Promise.all([c.search("music", "Wonderwall"), c.search("music", "Wonderwall")]);
  assert.equal(calls, 2);
  await c.search("music", "Wonderwall");
  assert.equal(calls, 2);
});
test("legacy Apple artist and album details preserve Apple identities", async () => {
  const c = createMusicClient({
    fetcher: async (url) => ({
      ok: true,
      json: async () => ({
        results:
          new URL(url).searchParams.get("id") === "2"
            ? [
                { wrapperType: "artist", artistId: 2, artistName: "Oasis" },
                {
                  wrapperType: "collection",
                  collectionId: 3,
                  collectionName: "Morning Glory",
                  artistName: "Oasis",
                },
              ]
            : [
                {
                  wrapperType: "collection",
                  collectionId: 3,
                  collectionName: "Morning Glory",
                },
                song,
              ],
      }),
    }),
  });
  assert.equal((await c.details("artist", "2")).topAlbums[0].catalogId, "itunes:3");
  assert.equal((await c.details("album", "3")).albumTracks[0].catalogId, "itunes:1");
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
