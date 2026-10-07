const assert = require("node:assert/strict");
const { createIgdbClient } = require("../server/igdb.cjs");
(async () => {
  const client = createIgdbClient({
    env: { IGDB_CLIENT_ID: "fixture", IGDB_CLIENT_SECRET: "fixture" },
    fetcher: async (url, options) => {
      if (url.includes("oauth2"))
        return {
          ok: true,
          json: async () => ({ access_token: "fixture", expires_in: 3600 }),
        };
      let rows = [];
      if (options.body.includes("where id = 1;"))
        rows = [
          {
            id: 1,
            name: "Base",
            remakes: [{ id: 2, name: "Remake", first_release_date: 1704067200 }],
            expanded_games: [{ id: 3, name: "Expanded" }],
            bundles: [{ id: 4, name: "Pack" }],
          },
        ];
      if (options.body.includes("where parent_game = 1")) {
        assert.ok(options.body.includes("13"));
        rows = [
          { id: 4, name: "Pack", game_type: 13 },
          { id: 5, name: "Mod", game_type: 5 },
        ];
      }
      if (options.body.includes("where version_parent = 1"))
        rows = [{ id: 6, name: "Deluxe", game_type: 0 }];
      return { ok: true, json: async () => rows };
    },
  });
  const game = await client.details("1");
  assert.equal(game.relatedGameTypes.filter((type) => type === "Pacote").length, 1);
  assert.ok(game.relatedGameTypes.includes("Remake"));
  assert.ok(game.relatedGameTypes.includes("Versão expandida"));
  assert.ok(game.relatedGameTypes.includes("Mod"));
  assert.ok(game.relatedGameTypes.includes("Edição"));
  assert.equal(game.relatedGameYears[game.relatedGameIds.indexOf("igdb:2")], "2024");
  assert.equal(game.relatedGameIds.length, game.relatedGameYears.length);
  console.log(
    "IGDB relationships: packages, remake, expanded version, editions, mods, dates and deduplication OK.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
