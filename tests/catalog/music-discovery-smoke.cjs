const assert = require("node:assert/strict");
const { createSteamClient } = require("../../server/media/steam.cjs");
const Catalog = require("../../dist/catalog/catalog.js");
global.Catalog = Catalog;
require("../../dist/catalog/catalog-discovery.js");
(async () => {
  const books = await Catalog.recommendations(
    { kind: "book", catalogId: "ol:/works/OL1W", genres: ["Fantasy"] },
    {
      fetcher: async (url) => {
        assert.ok(url.includes("/subjects/fantasy.json"));
        return {
          ok: true,
          json: async () => ({
            works: [{ key: "/works/OL2W", title: "New book", cover_id: 42 }],
          }),
        };
      },
    },
  );
  assert.equal(books[0].catalogId, "ol:/works/OL2W");
  const steam = createSteamClient({
    fetcher: async (url, options) => {
      if (options.method === "HEAD") return { ok: false };
      if (url.includes("/api/appdetails"))
        return {
          ok: true,
          json: async () => ({
            1: {
              success: true,
              data: {
                steam_appid: 1,
                name: "Game fixture",
                genres: [{ id: "3", description: "RPG" }],
              },
            },
          }),
        };
      if (url.includes("/search/"))
        return {
          ok: true,
          text: async () =>
            '<a class="search_result_row ds_collapse_flag" data-ds-appid="2"><span class="title">New game</span></a>',
        };
      return {
        ok: true,
        text: async () => '<div data-ds-tagids="[122]"></div>',
      };
    },
  });
  assert.equal((await steam.recommendations("1")).items[0].name, "New game");
  console.log("Discovery: book subjects and Steam suggestions OK.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
