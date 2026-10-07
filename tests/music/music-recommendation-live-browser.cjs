const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs"),
  { createMusicCatalog } = require("../../server/music-catalog.cjs"),
  { createYouTubeMusicClient } = require("../../server/youtube-music.cjs");
(async () => {
  try {
    process.loadEnvFile(".env");
  } catch {}
  const root = "artifacts/recommendation-strategy",
    live = JSON.parse(fs.readFileSync(root + "/live.json", "utf8"));
  const music = createMusicCatalog({
      youtubeMusic: createYouTubeMusicClient({ timeout: 20000 }),
    }),
    server = createServer({ music });
  let browser;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage(),
      errors = [],
      responses = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", async (response) => {
      if (response.url().includes("/api/music/recommendations?"))
        responses.push({
          url: response.url(),
          status: response.status(),
          payload: await response.json(),
        });
    });
    await page.goto("http://127.0.0.1:" + server.address().port + "/#buscar");
    await page.waitForFunction(() => window.TitlePages && window.Catalog);
    const settleArtwork = async (selector) => {
      await page
        .locator(selector + " img")
        .evaluateAll((images) => images.forEach((image) => (image.loading = "eager")));
      await page
        .waitForFunction(
          (selector) =>
            [...document.querySelectorAll(selector + " img")].every(
              (image) => image.hidden || image.naturalWidth > 0,
            ),
          selector,
          { timeout: 30000 },
        )
        .catch(() => {});
    };
    const cases = Object.entries(live.cases);
    const render = [];
    for (const [label, { detail }] of cases) {
      await page.evaluate((item) => TitlePages.open(item), detail);
      await page.waitForFunction(
        (title) => document.querySelector("#titlePage h1")?.textContent === title,
        detail.title,
      );
      await page.locator("[data-title-discovery]").scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () =>
          document.querySelector("[data-title-discovery]")?.dataset.started === "true" &&
          document.querySelector("[data-title-discovery]")?.getAttribute("aria-busy") === "false",
        null,
        { timeout: 60000 },
      );
      const cards = await page.locator(".discovery-grid .discover-card strong").allTextContents();
      assert.ok(cards.length > 0);
      render.push({ label, type: detail.albumType, cards });
      await settleArtwork("[data-title-discovery]");
      await page.screenshot({
        path: root + "/" + label + ".png",
        fullPage: true,
      });
    }
    const artist = await music.details("artist", live.cases.mado.detail.artistCatalogId, {
      phase: "core",
    });
    const track = live.cases.album.detail.albumTracks[3];
    const seeds = [
      track,
      live.cases.album.detail,
      artist,
      live.cases.ep.detail,
      live.cases.mado.detail,
      live.cases["whale-net"].detail,
    ];
    await page.evaluate((seeds) => {
      for (const [i, seed] of seeds.entries()) {
        const saved = CollectionActions.quickAdd(seed);
        CollectionActions.updateItem(saved.id, {
          featured: i < 3,
          score: 9 - i,
        });
      }
      location.hash = "#descobrir";
    }, seeds);
    await page.waitForSelector("#personalizedDiscovery:not([hidden])");
    await page
      .locator("#personalizedDiscovery")
      .getByRole("button", { name: "carregar sugestões", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#personalizedDiscovery .discovery-grid")
          .getAttribute("aria-busy") === "false",
      null,
      { timeout: 120000 },
    );
    const globalBefore = await page
      .locator("#personalizedDiscovery .discovery-choice")
      .evaluateAll((nodes) =>
        nodes.slice(0, 12).map((n) => ({
          title: n.querySelector("strong")?.textContent,
          reason: n.querySelector("small")?.textContent,
        })),
      );
    await settleArtwork("#personalizedDiscovery");
    await page.screenshot({ path: root + "/global.png", fullPage: true });
    await page
      .locator("#personalizedDiscovery")
      .getByRole("button", { name: "atualizar sugestões", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#personalizedDiscovery .discovery-grid")
          .getAttribute("aria-busy") === "false",
      null,
      { timeout: 120000 },
    );
    const globalRefresh = await page
      .locator("#personalizedDiscovery .discovery-choice")
      .evaluateAll((nodes) =>
        nodes.slice(0, 12).map((n) => ({
          title: n.querySelector("strong")?.textContent,
          reason: n.querySelector("small")?.textContent,
        })),
      );
    await settleArtwork("#personalizedDiscovery");
    await page.screenshot({
      path: root + "/global-refresh.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: root + "/global-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      root + "/browser.json",
      JSON.stringify({ render, seeds, globalBefore, globalRefresh, errors, responses }, null, 2),
    );
    console.log(JSON.stringify({ render, globalBefore, globalRefresh, errors }));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
