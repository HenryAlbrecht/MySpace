const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
(async () => {
  let browser,
    calls = 0;
  const baseRow = {
    kind: "music",
    title: "iPod Touch",
    artist: "Ninajirachi",
    source: "YouTube Music",
    catalogId: "ytmusic:video:abcdefghijk",
    playbackSource: {
      type: "youtube",
      videoId: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
    },
    image: "profile-art.png",
  };
  const web = createServer({
    music: {
      playbackSource: async () => ({ items: [], status: "not-found" }),
      summary: async () => {
        calls++;
        return {
          summary: "Last.fm biography fixture",
          summarySource: "Last.fm",
        };
      },
      details: async () => ({
        ...baseRow,
        image: "https://example.test/alternate.png",
        summary: "Last.fm biography fixture",
        summarySource: "Last.fm",
      }),
      recommendations: async () => ({
        items: [
          {
            ...baseRow,
            catalogId: "ytmusic:video:lmnopqrstuv",
            title: "New Song",
            playbackSource: {
              type: "youtube",
              videoId: "lmnopqrstuv",
              url: "https://www.youtube.com/watch?v=lmnopqrstuv",
            },
          },
        ],
      }),
    },
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
    await page.goto("http://127.0.0.1:" + web.address().port, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate((row) => {
      CollectionActions.saveMusic(row);
      location.hash = "#colecao";
    }, baseRow);
    await page.getByLabel("Alternar entre capas e lista").click();
    await page.waitForFunction(() =>
      document
        .querySelector(".collection-list-detail")
        ?.textContent.includes("Last.fm biography fixture"),
    );
    assert.equal(calls, 1);
    await page.evaluate(() => TitlePages.open(CollectionActions.getItems()[0]));
    await page.waitForFunction(() =>
      document.querySelector("#titleSynopsis")?.textContent.includes("Last.fm biography fixture"),
    );
    assert.equal(
      await page.locator(".title-layout img").first().getAttribute("src"),
      "profile-art.png",
    );
    const discovery = page.locator("#titlePage [data-title-discovery]");
    await discovery.scrollIntoViewIfNeeded();
    const recommendations = discovery.locator(".music-track-row");
    await recommendations.first().waitFor();
    assert.equal(await recommendations.count(), 1);
    assert.equal(
      await recommendations.locator(".music-track-title").textContent(),
      "New Song",
    );
    assert.equal(
      await page.evaluate(() => CollectionActions.getItems()[0].image),
      "profile-art.png",
    );
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: selected list item gets Last.fm summary once, saved cover stays stable through automatic YouTube Music discovery, zero page errors; one context.",
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
