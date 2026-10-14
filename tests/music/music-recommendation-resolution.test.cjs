const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
test("recommendation resolution rejects an invalid catalog identity", async () => {
  const c = createMusicCatalog({
    youtubeMusic: {
      search: async () => ({
        items: [
          {
            kind: "album",
            title: "Album",
            artist: "Artist",
            catalogId: "not-a-canonical-id",
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
  vm.runInNewContext(fs.readFileSync("dist/catalog/catalog-discovery.js", "utf8"), context);
  let calls = 0;
  const fetcher = async () => ({
    ok: true,
    json: async () => {
      calls++;
      return {
        items: [{ catalogId: "ytmusic:album:MPREalbum12345", title: "Album" }],
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
    catalogId: "ytmusic:album:MPREseed12345",
  };
  assert.equal((await Catalog.recommendations(item, { fetcher })).resolution.failures, 1);
  assert.equal((await Catalog.recommendations(item, { fetcher })).resolution.failures, 0);
  await Catalog.recommendations(item, { fetcher });
  assert.equal(calls, 2);
});
