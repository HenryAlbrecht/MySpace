const assert = require("node:assert/strict");
const { createIgdbClient } = require("../server/igdb.cjs");
const { createServer } = require("../server.cjs");
const Catalog = require("../dist/catalog.js");
(async () => {
  let authCalls = 0, gameCalls = 0;
  const igdb = createIgdbClient({ env: { IGDB_CLIENT_ID: "fixture-client", IGDB_CLIENT_SECRET: "fixture-secret" }, fetcher: async (url, options) => {
    if (url.includes("oauth2")) {
      authCalls++;
      assert.equal(options.body.get("client_secret"), "fixture-secret");
      assert.ok(!url.includes("fixture-secret"));
      return { ok: true, json: async () => ({ access_token: "fixture-token", expires_in: 3600 }) };
    }
    gameCalls++;
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    if (options.body.startsWith("search")) assert.ok(options.body.startsWith('search "Fixture \\"; limit 999;";'));
    return { ok: true, json: async () => [{ id: 42, name: "Game fixture", summary: "IGDB summary", url: "https://www.igdb.com/games/fixture", cover: { image_id: "cover" }, screenshots: [{ image_id: "landscape" }], genres: [{ name: "RPG" }], platforms: [{ name: "PC" }] }] };
  } });
  const server = createServer({ igdb });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const fetcher = (url, options) => fetch(new URL(url, base), options);
    const rows = await Catalog.search("game", 'Fixture "; limit 999;', { provider: "igdb", fetcher });
    assert.equal(rows[0].source, "IGDB");
    assert.equal(rows[0].catalogId, "igdb:42");
    assert.ok(rows[0].verticalImage.includes("cover_big"));
    assert.ok(rows[0].horizontalImage.includes("screenshot_big"));
    assert.equal((await Catalog.details(rows[0], { fetcher })).summary, "IGDB summary");
    assert.equal(authCalls, 1);
    assert.equal(gameCalls, 5);
    await assert.rejects(() => igdb.details("42; limit 999;"), error => error.status === 400);
    const response = await fetch(base + "/api/igdb/search?q=Example");
    assert.ok(!(await response.text()).includes("fixture-secret"));
  } finally { await new Promise(resolve => server.close(resolve)); }
  await assert.rejects(() => createIgdbClient({ env: {} }).search("Unconfigured"), error => error.status === 503);
  const enhanced = createIgdbClient({ env: { IGDB_CLIENT_ID: 'fixture', IGDB_CLIENT_SECRET: 'fixture' }, fetcher: async url => ({ ok: true, json: async () => url.includes('oauth2') ? { access_token: 'fixture', expires_in: 3600 } : [
    { id: 2, name: 'Persona 3 Reload: Expansion', game_type: 2, parent_game: 1 },
    { id: 1, name: 'Persona 3 Reload', game_type: 8, parent_game: 9, rating: 88, aggregated_rating: 90, videos: [{ name: 'Trailer', video_id: 'abcdefghijk' }, { video_id: 'invalid' }], screenshots: [{ image_id: 'shot' }], artworks: [{ image_id: 'art' }], game_localizations: [{ name: 'Japanese edition', region: { name: 'Japan' }, cover: { image_id: 'jp-cover' } }] }
  ] }) });
  const ranked = await enhanced.search('Persona 3 R'); assert.equal(ranked.items[0].title, 'Persona 3 Reload');
  const rich = await enhanced.details('1'); assert.equal(rich.catalogRating, 88); assert.equal(rich.criticRating, 90);
  assert.deepEqual(rich.videoIds, ['abcdefghijk']); assert.equal(rich.artworks.length, 1); assert.ok(rich.localizedCoverLabels[0].includes('Japan'));
  console.log("IGDB: autenticação no servidor, consultas, detalhes e imagens OK (API simulada); ausência de credenciais tratada.");
})().catch(error => { console.error(error); process.exitCode = 1; });
