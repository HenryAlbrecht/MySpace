const assert = require("node:assert/strict");
const { createLastfmClient } = require("../../server/music/lastfm.cjs");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
(async () => {
  let calls = 0;
  const client = createLastfmClient({
    env: { LASTFM_API_KEY: "fixture-key" },
    interval: 0,
    fetcher: async (url) => {
      calls++;
      const params = new URL(url).searchParams;
      assert.equal(params.get("api_key"), "fixture-key");
      const row = {
        name: "Example",
        artist: "Artist",
        image: [{ "#text": "https://example.com/cover.jpg" }],
      };
      const payloads = {
        "album.search": { results: { albummatches: { album: row } } },
        "album.getInfo": {
          album: {
            ...row,
            wiki: { content: "Original description" },
            tracks: { track: { name: "First track" } },
          },
        },
        "track.getSimilar": { similartracks: { track: row } },
        "artist.getSimilar": { similarartists: { artist: { name: "Artist" } } },
        "artist.getTopAlbums": { topalbums: { album: row } },
        "artist.search": {
          results: { artistmatches: { artist: { name: "Artist" } } },
        },
        "artist.getInfo": {
          artist: {
            name: "Artist",
            bio: { content: "Artist biography" },
            stats: { listeners: "123" },
          },
        },
        "artist.getTopTracks": { toptracks: { track: row } },
      };
      return { ok: true, json: async () => payloads[params.get("method")] };
    },
  });
  assert.equal((await client.search("album", "Example")).items[0].source, "Last.fm");
  const before = calls;
  await client.search("album", "Example");
  assert.equal(calls, before);
  const detail = await client.details("album", "Artist", "Example");
  assert.deepEqual(detail.trackNames, ["First track"]);
  assert.equal(detail.summary, "Original description");
  assert.equal((await client.recommendations("music", "Artist", "Example")).items.length, 1);
  assert.equal((await client.recommendations("album", "Artist", "Example")).items.length, 1);
  const artistSearch = await client.search("artist", "Artist");
  assert.equal(artistSearch.items[0].catalogId, "lastfm-artist:Artist");
  const artistDetail = await client.details("artist", "Artist", "");
  assert.equal(artistDetail.summary, "Artist biography");
  assert.equal(artistDetail.listeners, "123");
  assert.equal(artistDetail.topTracks.length, 1);
  assert.equal(artistDetail.topAlbums.length, 1);
  assert.equal(artistDetail.similarArtists.length, 1);
  await assert.rejects(client.search("invalid", "Example"), (error) => error.status === 400);
  await assert.rejects(
    createLastfmClient({ env: {} }).search("album", "Example"),
    (error) => error.status === 503,
  );
  const catalog = createMusicCatalog({
    lastfm: client,
    youtubeMusic: {
      search: async (kind, query) => {
        assert.equal(kind, "music");
        assert.equal(query, "Example Artist");
        return {
          items: [
            {
              kind: "music",
              catalogId: "ytmusic:video:dQw4w9WgXcQ",
              title: "Example",
              artist: "Artist",
              source: "YouTube Music",
              image: "youtube-artwork",
            },
          ],
        };
      },
    },
  });
  const recommendations = await catalog.recommendations("music", "Artist", "Example");
  assert.equal(recommendations.items.length, 1);
  assert.equal(recommendations.items[0].catalogId, "ytmusic:video:dQw4w9WgXcQ");
  assert.equal(recommendations.items[0].recommendationSource, "Last.fm");
  console.log("Last.fm: search, editorial, cache, recommendations and validation OK.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
