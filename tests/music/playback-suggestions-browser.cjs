const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs"),
  { createMusicCatalog } = require("../../server/music-catalog.cjs");
(async () => {
  let browser;
  const web = createServer({
    music: createMusicCatalog({
      youtubeMusic: { searchTracks: async () => [] },
      musicbrainz: {
        playbackSource: async (title) => ({
          items:
            title === "Unknown"
              ? []
              : [
                  {
                    title: "Song",
                    channel: "Artist",
                    type: "youtube",
                    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                  },
                ],
          source: {
            type: "youtube",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        }),
      },
    }),
  });
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let searchCalls = 0;
    await page.route("**/api/music/search?**", (r) => {
      searchCalls++;
      return r.fulfill(
        searchCalls === 1
          ? { status: 503, json: { error: "Catálogo indisponível agora." } }
          : { json: { items: [] } },
      );
    });
    await page.goto("http://127.0.0.1:" + web.address().port + "/#buscar/music/Failure", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => document.querySelector(".discover-status")?.dataset.state === "error",
    );
    await page.getByRole("button", { name: "tentar novamente", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector(".discover-status")?.dataset.state === "empty",
    );
    assert.equal(
      await page.getByRole("button", { name: "tentar novamente", exact: true }).isVisible(),
      false,
    );
    assert.equal(searchCalls, 2);
    await page.evaluate(() =>
      CollectionActions.saveMusic({
        kind: "music",
        catalogId: "itunes:1",
        title: "Song",
        artist: "Artist",
        image: "profile-art.png",
      }),
    );
    await page.waitForFunction(() => CollectionActions.getItems()[0]?.playbackLookup === "choose");
    assert.equal(
      await page.evaluate(() => !!CollectionActions.getItems()[0].playbackSource),
      false,
    );
    await page.waitForSelector(".music-link-dialog[open]");
    assert.equal(await page.getByLabel("Link de reprodução").inputValue(), "");
    const candidate = page
      .locator(".music-source-candidates button")
      .filter({ has: page.locator("strong").filter({ hasText: /^Song$/ }) })
      .filter({
        has: page.locator("span > span").filter({ hasText: /^Artist$/ }),
      });
    assert.equal(await candidate.count(), 1);
    await candidate.click();
    assert.equal(
      await page.getByLabel("Link de reprodução").inputValue(),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    assert.equal(
      await page.evaluate(() => !!CollectionActions.getItems()[0].playbackSource),
      false,
    );
    await page
      .locator(".music-link-dialog")
      .getByRole("button", { name: "salvar", exact: true })
      .click();
    const row = await page.evaluate(() => CollectionActions.getItems()[0]);
    assert.equal(row.catalogId, "itunes:1");
    assert.equal(row.image, "profile-art.png");
    assert.equal(row.playbackSource.type, "youtube");
    await page.evaluate(() =>
      CollectionActions.saveMusic({
        kind: "music",
        catalogId: "itunes:2",
        title: "Unknown",
        artist: "Artist",
      }),
    );
    await page.waitForFunction(
      () =>
        CollectionActions.getItems().find((i) => i.title === "Unknown")?.playbackLookup ===
        "not-found",
    );
    await page.evaluate(() =>
      MusicBridge.link(CollectionActions.getItems().find((i) => i.title === "Unknown")),
    );
    assert.ok(
      (await page.locator(".music-link-notice").textContent()).includes("Nenhum link compatível"),
    );
    await page
      .locator(".music-link-dialog")
      .getByRole("button", { name: "cancelar", exact: true })
      .click();
    await page.evaluate(() =>
      SPACEAMP.play({
        title: "Missing file",
        artist: "Artist",
        local: true,
        fileRef: "missing-local",
      }),
    );
    await page.waitForFunction(() =>
      document.querySelector("#playerNote")?.textContent.includes("Arquivo não disponível"),
    );
    assert.equal(await page.getByLabel("Vincular arquivo da faixa atual").count(), 1);
    await page.reload();
    assert.equal(
      await page.evaluate(
        () =>
          CollectionActions.getItems().find((i) => i.catalogId === "itunes:1").playbackSource.type,
      ),
      "youtube",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: suggested link requires selection and save; catalog identity/artwork preserved; empty fallback and persistence; one context; zero page errors.",
    );
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
