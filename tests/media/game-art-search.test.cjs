const assert = require("node:assert/strict");
const test = require("node:test");
const { createGameArtSearch } = require("../../server/media/game-art-search.cjs");
const { createSteamGridDbClient } = require("../../server/media/steamgriddb.cjs");

test("SteamGridDB returns all suitable art in resolution-aware order", async () => {
  const client = createSteamGridDbClient({
    env: { STEAMGRIDDB_API_KEY: "fixture-key" },
    fetcher: async (url) => {
      const path = new URL(url).pathname.replace("/api/v2/", "");
      const data =
        path === "search/autocomplete/Game"
          ? [{ id: 7, name: "Game" }]
          : [
              {
                url: "https://cdn2.steamgriddb.com/low.jpg",
                width: 400,
                height: 600,
              },
              {
                url: "https://cdn2.steamgriddb.com/high.jpg",
                width: 1200,
                height: 1800,
              },
              {
                url: "http://cdn2.steamgriddb.com/unsafe.jpg",
                width: 2400,
                height: 3600,
              },
            ];
      return { ok: true, json: async () => ({ data }) };
    },
  });

  const results = await client.findAll("Game", "image");
  assert.deepEqual(
    results.map((item) => item.url),
    ["https://cdn2.steamgriddb.com/high.jpg", "https://cdn2.steamgriddb.com/low.jpg"],
  );
  assert.equal(results[0].width, 1200);
  assert.equal(results[0].source, "SteamGridDB");
  assert.equal(
    (await client.find("Game", "image")).url,
    "https://cdn2.steamgriddb.com/high.jpg",
  );
});

test("game art picker combines SteamGridDB first and IGDB candidates", async () => {
  const steamgriddb = {
    configured: true,
    async findAll(title, slot, presentation, limit) {
      assert.equal(title, "Burnout 3");
      assert.equal(slot, "image");
      assert.equal(presentation, "vertical");
      assert.equal(limit, 50);
      return Array.from({ length: 30 }, (_, index) => ({
        url: `https://cdn2.steamgriddb.com/grid-${index}.jpg`,
        source: "SteamGridDB",
        title: "Burnout 3",
      }));
    },
  };
  const igdb = {
    configured: true,
    async search() {
      return {
        items: Array.from({ length: 30 }, (_, index) => ({
          title: `Burnout 3 ${index}`,
          verticalImage: `https://images.igdb.com/cover-${index}.jpg`,
        })),
      };
    },
  };
  const search = createGameArtSearch({ steamgriddb, igdb });
  const result = await search.searchOptions("Burnout 3", "image");

  assert.equal(result.items.length, 50);
  assert.deepEqual(
    result.items.slice(0, 25).map((item) => item.source),
    Array(25).fill("SteamGridDB"),
  );
  assert.deepEqual(
    result.items.slice(25).map((item) => item.source),
    Array(25).fill("IGDB"),
  );
  assert.deepEqual(result.emptySources, []);
  assert.deepEqual(result.failedSources, []);
  assert.equal(
    (await search.search("Burnout 3", "image")).url,
    "https://cdn2.steamgriddb.com/grid-0.jpg",
    "legacy single-result search keeps SteamGridDB first",
  );
});

test("game art picker keeps IGDB results when SteamGridDB is unavailable", async () => {
  const search = createGameArtSearch({
    steamgriddb: {
      configured: true,
      async findAll() {
        throw new Error("offline");
      },
    },
    igdb: {
      configured: true,
      async search() {
        return {
          items: [{ title: "Persona 3 Reload", verticalImage: "https://images.igdb.com/p3.jpg" }],
        };
      },
    },
  });

  const result = await search.searchOptions("Persona 3 Reload", "bubble");
  assert.equal(result.items[0].source, "IGDB");
  assert.deepEqual(result.emptySources, ["SteamGridDB"]);
  assert.deepEqual(result.failedSources, ["SteamGridDB"]);
});
