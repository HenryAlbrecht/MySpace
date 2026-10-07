const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
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
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port,
      root = "artifacts/collection-genres";
    fs.mkdirSync(root, { recursive: true });
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage(),
      errors = [],
      requests = [],
      report = [],
      entities = new Map(),
      cases = new Map();
    page.on("pageerror", (error) => errors.push(error.message));
    const image = base + "/rotation.svg";
    await context.route("**/rotation.svg", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#394652"/><circle cx="220" cy="150" r="110" fill="#60889c"/></svg>',
      }),
    );
    function entity(kind, label, index, type) {
      const token = label.slice(0, 3) + String(index).padStart(8, "0"),
        catalogId =
          kind === "music"
            ? "ytmusic:video:" + token
            : kind === "artist"
              ? "ytmusic:artist:UC" + token
              : "ytmusic:album:MPRE" + token;
      const item = {
        kind,
        catalogId,
        title: label + " " + index,
        artist: "Artist " + index,
        image,
        source: "YouTube Music",
        genres: [label],
        trackDuration: 220 + index,
        releaseDate: "2026",
        ...(type ? { albumType: type } : {}),
        ...(kind === "music" ? { playbackSource: { type: "youtube", videoId: token } } : {}),
      };
      entities.set(catalogId, item);
      return item;
    }
    await context.route("**/api/music/ytmusic/**", (route) => {
      const parts = new URL(route.request().url()).pathname.split("/"),
        kind = parts.at(-2),
        key = "ytmusic:" + (kind === "music" ? "video" : kind) + ":" + parts.at(-1);
      return route.fulfill({ json: entities.get(key) || {} });
    });
    await context.route("**/api/music/recommendations?*", (route) => {
      const url = new URL(route.request().url()),
        title = url.searchParams.get("title"),
        value = cases.get(title);
      if (value) {
        requests.push({
          title,
          force: url.searchParams.get("force"),
          localPool: url.searchParams.get("localPool"),
        });
        return route.fulfill({
          json: {
            items: value.fresh && url.searchParams.has("force") ? value.fresh : value.pool,
          },
        });
      }
      return route.fulfill({ json: { items: [] } });
    });
    await page.goto(base + "/#buscar");
    await page.waitForFunction(() => window.TitlePages && window.CollectionActions);
    async function open(item) {
      await page.evaluate((item) => TitlePages.open(item), item);
      await page.waitForFunction(
        (title) => document.querySelector("#titlePage h1")?.textContent === title,
        item.title,
      );
    }
    const ids = () =>
      page
        .locator("[data-title-discovery] .discovery-grid > [data-catalog-id]")
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.catalogId));
    const ready = () =>
      page.waitForFunction(
        () =>
          document.querySelector("[data-title-discovery]")?.getAttribute("aria-busy") === "false",
      );

    for (const kind of ["music", "artist", "album"]) {
      const seed = entity(kind, "Genre" + kind, 999, kind === "album" ? "album" : undefined);
      seed.genres = [];
      const matches = Array.from({ length: 10 }, (_, i) => ({
        ...entity(
          kind,
          "Genre" + kind,
          i,
          kind === "album" ? ["album", "ep", "single"][i % 3] : undefined,
        ),
        genres: ["shoegaze"],
        updated: i,
      }));
      for (const item of matches)
        await page.evaluate((item) => CollectionActions.quickAdd(item), item);
      await page.evaluate(() => {
        window.originalEnrich = Catalog.enrich;
        Catalog.enrich = (item) =>
          new Promise(
            (resolve) => (window.releaseGenres = () => resolve({ ...item, genres: ["shoegaze"] })),
          );
      });
      await open(seed);
      await page.waitForFunction(
        () =>
          window.releaseGenres &&
          document.querySelector("#titlePage").getAttribute("aria-busy") === "false",
      );
      const section = page.locator("[data-collection-genre-matches]");
      assert.equal(await section.isHidden(), true);
      await page.evaluate(() => {
        window.stableHero = document.querySelector(".title-layout");
        window.stableRecommendations = document.querySelector("[data-title-discovery]");
        releaseGenres();
      });
      await section.waitFor({ state: "visible" });
      assert.equal(await section.locator(".music-track-row,.discover-card").count(), 3);
      assert.equal(
        await page.evaluate(
          () =>
            stableHero === document.querySelector(".title-layout") &&
            stableRecommendations === document.querySelector("[data-title-discovery]"),
        ),
        true,
      );
      await section.screenshot({ path: root + "/" + kind + "-preview.png" });
      await section.getByRole("button", { name: "ver todos (10) →", exact: true }).click();
      assert.equal(await section.locator(".music-track-row,.discover-card").count(), 10);
      if (kind === "album") {
        const labels = await section.locator("small").allTextContents();
        for (const label of ["Álbum", "EP", "Single"])
          assert.ok(labels.some((text) => text.includes(label)));
      }
      await section.screenshot({ path: root + "/" + kind + "-expanded.png" });
      await section.getByRole("button", { name: "recolher ↑", exact: true }).click();
      assert.equal(await section.locator(".music-track-row,.discover-card").count(), 3);
      // Editing shared tags removes only that match; re-adding the tag restores it locally.
      await page.evaluate((item) => {
        window.genreScroll = scrollY;
        const saved = CollectionActions.getItems().find((row) => row.catalogId === item.catalogId);
        CollectionActions.updateItem(saved.id, { genres: [] });
      }, matches[9]);
      assert.equal(
        await section.getByRole("button", { name: "ver todos (9) →", exact: true }).count(),
        1,
      );
      assert.equal(await page.evaluate(() => genreScroll === scrollY), true);
      await page.evaluate((item) => {
        const saved = CollectionActions.getItems().find((row) => row.catalogId === item.catalogId);
        CollectionActions.updateItem(saved.id, { genres: ["shoegaze"] });
      }, matches[9]);
      assert.equal(
        await section.getByRole("button", { name: "ver todos (10) →", exact: true }).count(),
        1,
      );
      await page.evaluate((item) => {
        window.deleteScroll = scrollY;
        CollectionActions.editItem(
          CollectionActions.getItems().find((row) => row.catalogId === item.catalogId),
        );
      }, matches[9]);
      await page.locator("#resourceEditor .dialog-delete").click();
      await page
        .locator("#resourceEditor")
        .getByRole("button", { name: "excluir", exact: true })
        .click();
      assert.equal(
        await section.getByRole("button", { name: "ver todos (9) →", exact: true }).count(),
        1,
      );
      assert.equal(await page.evaluate(() => deleteScroll === scrollY), true);
      await page.evaluate((item) => CollectionActions.quickAdd(item), matches[9]);
      assert.equal(
        await section.getByRole("button", { name: "ver todos (10) →", exact: true }).count(),
        1,
      );
      await page.evaluate(() => {
        Catalog.enrich = originalEnrich;
        window.releaseGenres = null;
      });
      report.push({
        kind,
        preview: 3,
        expanded: 10,
        lateEnrichmentStable: true,
        editRestored: true,
      });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(root + "/report.json", JSON.stringify({ report, errors }, null, 2));
    console.log(JSON.stringify({ report, errors }));
    await context.close();
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
