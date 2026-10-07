const assert = require("node:assert/strict");
const { createSteamClient } = require("../../server/steam.cjs");
const { createServer } = require("../../server.cjs");
const Catalog = require("../../dist/catalog.js");

(async () => {
  let calls = 0;
  const steam = createSteamClient({
    fetcher: async (url, options) => {
      calls++;
      if (options.method === "HEAD") return { ok: false, status: 404 };
      const parsed = new URL(url);
      if (parsed.pathname.startsWith("/app/"))
        return {
          ok: true,
          text: async () =>
            '<div class="DRM_notice">Incorporates 3rd-party DRM: Denuvo</div><div id="recommended_block"><a href="https://store.steampowered.com/app/99/related/">Related</a><div class="clear"></div></div>',
        };
      if (parsed.pathname.endsWith("storesearch/")) {
        assert.equal(parsed.searchParams.get("term"), "Fixture & appids=99");
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 42,
                type: "app",
                name: "Steam fixture",
                tiny_image: "https://example.com/capsule.jpg",
              },
              { id: 0, type: "app", name: "Invalid" },
              { id: 44, type: "bundle", name: "Bundle" },
            ],
          }),
        };
      }
      assert.equal(parsed.searchParams.get("appids"), "42");
      return {
        ok: true,
        json: async () => ({
          unexpectedKey: {
            success: true,
            data: {
              steam_appid: 42,
              name: "Steam fixture",
              short_description: "Steam synopsis.",
              about_the_game: "<h2>Story</h2><p>Full description with gameplay and characters.</p>",
              supported_languages: "English<strong>*</strong>, Portuguese",
              metacritic: {
                score: 88,
                url: "https://www.metacritic.com/game/fixture/",
              },
              dlc: [51],
              screenshots: [{ path_full: "https://example.com/screenshot.jpg" }],
              pc_requirements: { minimum: "<p>Minimum specs</p>" },
              header_image: "https://example.com/header.jpg",
              developers: ["Developer"],
              release_date: { date: "2020" },
              genres: [{ description: "Adventure" }],
              platforms: { windows: true, mac: false, linux: true },
            },
          },
        }),
      };
    },
  });
  const [first, second] = await Promise.all([
    steam.search("Fixture & appids=99"),
    steam.search("Fixture & appids=99"),
  ]);
  assert.equal(first.items.length, 1);
  assert.deepEqual(first, second);
  assert.equal(calls, 1, "Repeated concurrent queries share one request");
  await assert.rejects(
    () => steam.search("x"),
    (error) => error.status === 400,
  );
  await assert.rejects(
    () => steam.details("42&appids=99"),
    (error) => error.status === 400,
  );

  const server = createServer({ steam });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const fetcher = (url, options) => fetch(new URL(url, base), options);
    const rows = await Catalog.search("game", "Fixture & appids=99", {
      fetcher,
    });
    assert.equal(rows[0].catalogId, "steam:42");
    assert.equal(rows[0].source, "Steam");
    assert.ok(rows[0].url.endsWith("/app/42/"));
    assert.equal(rows[0].score, undefined);
    const detail = await Catalog.details(rows[0], { fetcher });
    assert.ok(detail.summary.includes("Full description"));
    assert.equal(detail.shortSummary, "Steam synopsis.");
    assert.equal(detail.metacriticScore, 88);
    assert.ok(detail.drm.includes("Denuvo"));
    assert.deepEqual(detail.relatedIds, ["99"]);
    assert.deepEqual(detail.dlcIds, ["51"]);
    assert.ok(detail.languages.includes("Portuguese"));
    assert.equal(detail.requirementsMinimum, "<p>Minimum specs</p>");
    assert.equal(
      detail.image,
      "https://example.com/header.jpg",
      "Missing vertical artwork uses the store image",
    );
    assert.deepEqual(detail.platforms, ["Windows", "Linux"]);
    assert.deepEqual(detail.genres, ["Adventure"]);
    assert.equal(detail.total, 0, "Does not invent completion times");
    assert.equal((await fetch(base + "/api/steam/search?q=x")).status, 400);
    assert.equal((await fetch(base + "/api/steam/games/42", { method: "POST" })).status, 405);
    assert.equal(
      (
        await fetch(base + "/api/steam/games/42", {
          headers: { Origin: "https://example.com" },
        })
      ).status,
      403,
    );
    for (const url of [
      "/.env",
      "/server.cjs",
      "/..%2Fserver.cjs",
      "/api/steam/games/42%26appids=99",
    ]) {
      assert.equal((await fetch(base + url)).status, 404);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const limited = createSteamClient({
    fetcher: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(
    () => limited.search("Limited fixture"),
    (error) => error.status === 429,
  );
  const wrongGame = createSteamClient({
    fetcher: async () => ({
      ok: true,
      json: async () => ({ 7: { success: true, data: { steam_appid: 7 } } }),
    }),
  });
  await assert.rejects(
    () => wrongGame.details("42"),
    (error) => error.status === 404,
  );
  console.log(
    "Steam: busca → servidor local → página de detalhes, cache, imagens alternativas e validação OK (API Steam simulada).",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
