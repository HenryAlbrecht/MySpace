const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../server.cjs");
(async () => {
  const server = createServer();
  let browser;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext(),
      page = await context.newPage(),
      origin = "http://127.0.0.1:" + server.address().port;
    await context.route("**/fixture.png", (r) =>
      r.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await context.route("**/api/music/ytmusic/artist/**", async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const id = new URL(r.request().url()).pathname.split("/").pop();
      await r.fulfill({
        json: {
          kind: "artist",
          catalogId: "ytmusic:artist:" + id,
          title: id,
          image: origin + "/fixture.png",
          summary: "Loaded detail",
        },
      });
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.TitlePages);
    await page.evaluate(
      (origin) =>
        TitlePages.open({
          kind: "artist",
          catalogId: "ytmusic:artist:UCfixtureartistA",
          title: "Artist A",
          image: origin + "/fixture.png",
        }),
      origin,
    );
    await page.waitForFunction(
      () => document.querySelector(".title-cover-column img")?.dataset.artworkReady === "true",
    );
    await page.evaluate(
      () => (window.originalDetailImage = document.querySelector(".title-cover-column img")),
    );
    await page.waitForFunction(
      () => document.querySelector("#titlePage .title-summary")?.textContent === "Loaded detail",
    );
    assert.equal(
      await page.evaluate(
        () => originalDetailImage === document.querySelector(".title-cover-column img"),
      ),
      true,
      "decoded image survives detail enrichment",
    );
    const parent = await page.evaluate(() => location.hash);
    await page.evaluate(
      (origin) =>
        TitlePages.open({
          kind: "artist",
          catalogId: "ytmusic:artist:UCfixtureartistB",
          title: "Artist B",
          image: origin + "/fixture.png",
        }),
      origin,
    );
    await page.waitForFunction(() => location.hash.includes("UCfixtureartistB"));
    await page.locator("#titlePage button").filter({ hasText: "← voltar" }).click();
    await page.waitForFunction((parent) => location.hash === parent, parent);
    let radioRequests = 0;
    let releaseDetails;
    const detailsGate = new Promise((resolve) => {
      releaseDetails = resolve;
    });
    await context.route("**/api/music/ytmusic/music/**", async (r) => {
      await detailsGate;
      await r.fulfill({
        json: {
          kind: "music",
          catalogId: "ytmusic:video:abcdefghijk",
          title: "Radio seed",
          artist: "Artist",
          image: origin + "/fixture.png",
          summary: "Late editorial description",
        },
      });
    });
    await context.route("**/api/music/recommendations?*", (r) => {
      radioRequests++;
      assert.equal(new URL(r.request().url()).searchParams.get("videoId"), "abcdefghijk");
      return r.fulfill({
        json: {
          items: [
            {
              kind: "music",
              catalogId: "ytmusic:video:related1234",
              title: "Radio recommendation",
              artist: "Artist",
              source: "YouTube Music",
              recommendationSource: "YouTube Music",
              image: origin + "/fixture.png",
            },
          ],
          basis: "Rádio da faixa no YouTube Music",
          reserveAvailable: false,
        },
      });
    });
    await page.evaluate(
      (origin) =>
        TitlePages.open({
          kind: "music",
          catalogId: "ytmusic:video:abcdefghijk",
          title: "Radio seed",
          artist: "Artist",
          image: origin + "/fixture.png",
        }),
      origin,
    );
    await page.waitForFunction(
      () => document.querySelector("#titlePage h1")?.textContent === "Radio seed",
    );
    assert.equal(radioRequests, 0);
    assert.equal(await page.locator("#titlePage [data-title-discovery]").count(), 0);
    releaseDetails();
    await page.waitForFunction(
      () =>
        document.querySelector("#titlePage .title-summary")?.textContent ===
        "Late editorial description",
    );
    await page.locator("#titlePage [data-title-discovery]").scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      document
        .querySelector("#titlePage .discovery-grid")
        ?.textContent.includes("Radio recommendation"),
    );
    await page.evaluate(() => {
      window.originalDiscovery = document.querySelector("#titlePage .discovery-grid");
      window.originalRadioButton = originalDiscovery.querySelector("button");
      window.originalDiscoveryTop = originalDiscovery.getBoundingClientRect().top;
    });
    await page.evaluate(() => TitlePages.refresh());
    await page.waitForFunction(
      () =>
        document.querySelector("#titlePage .title-summary")?.textContent ===
        "Late editorial description",
    );
    assert.equal(
      await page.evaluate(
        () => originalDiscovery === document.querySelector("#titlePage .discovery-grid"),
      ),
      true,
      "late editorial metadata preserves loaded recommendations",
    );
    assert.equal(
      await page.evaluate(
        () => originalRadioButton === document.querySelector("#titlePage .discovery-grid button"),
      ),
      true,
      "recommendation card survives enrichment",
    );
    assert.ok(
      await page.evaluate(
        () => Math.abs(originalDiscoveryTop - originalDiscovery.getBoundingClientRect().top) < 2,
      ),
      "recommendations remain at the same viewport position",
    );
    assert.equal(radioRequests, 1);
    console.log(
      "PASS: decoded image and radio cards survive late details; recommendations stay anchored; nested artist back returns to origin.",
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
