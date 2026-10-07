const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { createMusicClient } = require("../../server/music/music.cjs"),
  { createMusicCatalog } = require("../../server/music-catalog.cjs");
test("legacy Apple adapter resolution finds title-only exact match beyond UI cutoff without artist expansion", async () => {
  const calls = [];
  const client = createMusicClient({
    fetcher: async (url) => {
      const u = new URL(url);
      calls.push(u);
      return {
        ok: true,
        json: async () => ({
          results:
            u.searchParams.get("term") === "Album Artist"
              ? []
              : [
                  ...Array.from({ length: 30 }, (_, i) => ({
                    trackId: i + 1,
                    trackName: "Wrong " + i,
                    artistName: "Artist",
                  })),
                  { trackId: 99, trackName: "Album", artistName: "Artist" },
                ],
        }),
      };
    },
  });
  const row = await client.resolveRecommendation({
    kind: "music",
    title: "Album",
    artist: "Artist",
  });
  assert.equal(row.catalogId, "itunes:99");
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      (u) => u.searchParams.get("entity") === "song" && u.searchParams.get("limit") === "50",
    ),
  );
  await client.resolveRecommendation({
    kind: "music",
    title: "Album",
    artist: "Artist",
  });
  assert.equal(calls.length, 2);
});
test("resolver preserves edition and artist, never takes a similar cover or a secondary identity", async () => {
  const client = createMusicClient({
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        results: [
          { trackId: 1, trackName: "Album (Deluxe)", artistName: "Artist" },
          { trackId: 2, trackName: "Album", artistName: "Other" },
        ],
      }),
    }),
  });
  assert.equal(
    await client.resolveRecommendation({
      kind: "music",
      title: "Album",
      artist: "Artist",
    }),
    null,
  );
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => ({
        items: [
          {
            kind: "album",
            title: "Album",
            artist: "Artist",
            catalogId: "deezer:1",
          },
        ],
      }),
    },
    lastfm: {
      recommendations: async () => ({
        items: [{ kind: "album", title: "Album", artist: "Artist" }],
      }),
    },
  });
  assert.equal((await c.recommendations("album", "Artist", "Seed")).items.length, 0);
});
test("all YouTube resolution failures are unavailable; mixed failure and missing match is partial", async () => {
  const rows = [
    { kind: "album", title: "A", artist: "Artist" },
    { kind: "album", title: "B", artist: "Artist" },
  ];
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => {
        throw Error("offline");
      },
    },
    lastfm: { recommendations: async () => ({ items: rows }) },
  });
  await assert.rejects(c.recommendations("album", "Artist", "Seed"), {
    status: 503,
  });
  const mixed = createMusicCatalog({
    youtubeMusic: {
      search: async (kind, query) => {
        if (query === "A Artist") throw Error("offline");
        return { items: [] };
      },
    },
    lastfm: { recommendations: async () => ({ items: rows }) },
  });
  const r = await mixed.recommendations("album", "Artist", "Seed");
  assert.deepEqual(r.resolution, {
    failures: 1,
    unmatched: 1,
    total: 2,
    status: "partial",
    causes: [{ type: "unknown" }],
  });
});
test("partial results survive but are not cached; retry can recover", async () => {
  const Catalog = {},
    context = { Catalog, fetch: () => {}, TextEncoder, URLSearchParams };
  vm.runInNewContext(fs.readFileSync("dist/catalog-discovery.js", "utf8"), context);
  let calls = 0;
  const fetcher = async () => ({
    ok: true,
    json: async () => {
      calls++;
      return {
        items: [{ catalogId: "itunes:1", title: "Album" }],
        resolution: {
          failures: calls === 1 ? 1 : 0,
          status: calls === 1 ? "partial" : "complete",
        },
      };
    },
  });
  const item = {
    kind: "album",
    artist: "Artist",
    title: "Seed",
    catalogId: "itunes:2",
  };
  assert.equal((await Catalog.recommendations(item, { fetcher })).resolution.failures, 1);
  assert.equal((await Catalog.recommendations(item, { fetcher })).resolution.failures, 0);
  await Catalog.recommendations(item, { fetcher });
  assert.equal(calls, 2);
});
test("legacy Apple album suggestions share exact artist discography lookup and preserve edition", async () => {
  const calls = [];
  const c = createMusicClient({
    fetcher: async (url) => {
      const u = new URL(url);
      calls.push(u.pathname);
      return {
        ok: true,
        json: async () => ({
          results:
            u.pathname === "/search"
              ? [{ artistId: 10, artistName: "Artist" }]
              : [
                  { wrapperType: "artist", artistId: 10, artistName: "Artist" },
                  ...["A", "B (Deluxe)"].map((title, i) => ({
                    wrapperType: "collection",
                    collectionId: i + 1,
                    collectionName: title,
                    artistName: "Artist",
                  })),
                ],
        }),
      };
    },
  });
  const rows = await Promise.all(
    ["A", "B (Deluxe)", "B"].map((title) =>
      c.resolveRecommendation({ kind: "album", title, artist: "Artist" }),
    ),
  );
  assert.equal(rows[0].catalogId, "itunes:1");
  assert.equal(rows[1].catalogId, "itunes:2");
  assert.equal(rows[2], null);
  assert.deepEqual(calls, ["/search", "/lookup"]);
});
