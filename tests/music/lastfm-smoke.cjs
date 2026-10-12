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
    itunes: {
      search: async () => ({
        items: [
          {
            artist: "Artist",
            title: "Example",
            previewUrl: "https://example.com/preview",
            image: "different",
            url: "https://example.com/album",
          },
        ],
      }),
    },
  });
  const enriched = await catalog.lastfmDetails("album", "Artist", "Example");
  assert.equal(enriched.image, "https://example.com/cover.jpg");
  assert.equal(enriched.previewSource, "iTunes");
  assert.ok(!JSON.stringify(enriched).includes("fixture-key"));
  const recommendations = [
    {
      kind: "music",
      catalogId: "lastfm:A:One",
      artist: "A",
      title: "One",
      image: "",
    },
    {
      kind: "music",
      catalogId: "lastfm:B:Two",
      artist: "B",
      title: "Two",
      image: "",
    },
    {
      kind: "music",
      catalogId: "lastfm:C:Three",
      artist: "C",
      title: "Three",
      image: "existing-cover",
    },
    {
      kind: "music",
      catalogId: "lastfm:D:Four",
      artist: "D",
      title: "Four",
      image: "",
    },
  ];
  let artworkLookups = 0;
  const artworkCatalog = createMusicCatalog({
    deezer: { search: async () => ({ items: [] }) },
    lastfm: {
      search: async () => ({ items: recommendations }),
      recommendations: async () => ({
        items: recommendations,
        basis: "Last.fm",
      }),
      details: async (kind, artist) => {
        if (artist === "D") throw Error("Unavailable");
        return { image: "lastfm-album-cover" };
      },
    },
    itunes: {
      search: async (kind, query) => {
        artworkLookups++;
        return {
          items:
            query === "A One"
              ? [{ artist: "A", title: "One", image: "itunes-cover" }]
              : [
                  {
                    artist: "Wrong artist",
                    title: "Two",
                    image: "wrong-cover",
                  },
                ],
        };
      },
    },
  });
  const withArtwork = await artworkCatalog.recommendations("music", "Artist", "Title");
  assert.deepEqual(
    withArtwork.items.map((row) => row.image),
    ["itunes-cover", "lastfm-album-cover", "existing-cover", ""],
  );
  assert.deepEqual(
    withArtwork.items.map((row) => row.catalogId),
    recommendations.map((row) => row.catalogId),
  );
  assert.equal(artworkLookups, 3);
  assert.equal(recommendations[0].image, "");
  const searchArtwork = await artworkCatalog.search("music", "Artist", "lastfm");
  assert.deepEqual(
    searchArtwork.items.map((row) => row.image),
    ["itunes-cover", "lastfm-album-cover", "existing-cover", ""],
  );
  console.log(
    "Last.fm: search, details, cache, recommendations, validation and iTunes enrichment OK.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
