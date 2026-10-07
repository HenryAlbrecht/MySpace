const assert = require("node:assert/strict");
const { createServer } = require("../../server.cjs");
const { createMusicCatalog } = require("../../server/music-catalog.cjs");
const { createLastfmClient } = require("../../server/lastfm.cjs");
(async () => {
  const lastfm = createLastfmClient({
    env: { LASTFM_API_KEY: "fixture" },
    interval: 0,
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        tag: { name: "dream pop", wiki: { summary: "Tag description" } },
      }),
    }),
  });
  const server = createServer({ music: createMusicCatalog({ lastfm }) });
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = "http://127.0.0.1:" + server.address().port;
    const response = await fetch(base + "/api/music/tag?tag=dream%20pop");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).summary, "Tag description");
    for (const query of [
      "tag=%3Cbad%3E",
      "tag=shoegaze&section=invalid",
      "tag=shoegaze&page=-1",
      "tag=shoegaze&page=NaN",
    ])
      assert.equal((await fetch(base + "/api/music/tag?" + query)).status, 400);
    console.log(
      "PASS: tag HTTP routing, encoded names, editorial response and invalid tag/section/page rejection.",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
