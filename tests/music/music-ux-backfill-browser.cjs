const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
(async () => {
  const server = createServer();
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port,
      root = "artifacts/music-ux-genres";
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

    for (const [label, kind, type] of [
      ["Mus", "music"],
      ["Alb", "album", "album"],
      ["Epp", "album", "ep"],
      ["Sng", "album", "single"],
    ]) {
      const seed = entity(kind, label, 999, type);
      seed.genres = [];
      const peer = entity(kind, label, 500, type);
      peer.genres = ["dream pop", "shoegaze"];
      await page.evaluate((item) => CollectionActions.quickAdd(item), peer);
      await page.evaluate((item) => CollectionActions.quickAdd(item), seed);
      await page.evaluate((id) => {
        const row = CollectionActions.getItems().find((item) => item.catalogId === id);
        CollectionActions.updateItem(row.id, {
          status: "paused",
          score: 7,
          featured: true,
          notes: "personal",
          startedAt: "2025-01-01",
          finishedAt: "2025-02-01",
        });
        window.beforeSaved = JSON.parse(
          JSON.stringify(CollectionActions.getItems().find((item) => item.id === row.id)),
        );
        window.beforeHistory = JSON.parse(localStorage.getItem("myspace-extras-v1")).history;
      }, seed.catalogId);
      await page.evaluate(() => {
        window.originalEnrich = Catalog.enrich;
        Catalog.enrich = (item) =>
          new Promise(
            (resolve) =>
              (window.releaseGenres = () =>
                resolve({
                  ...item,
                  genres: ["dream pop", "shoegaze"],
                  genresSource: "Last.fm · artista",
                })),
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
        window.stableActions = document.querySelector(".title-actions");
        window.stableRecommendations = document.querySelector("[data-title-discovery]");
        window.beforeScroll = scrollY;
        window.beforeFocus = document.activeElement;
        releaseGenres();
      });
      await section.waitFor({ state: "visible" });
      const result = await page.evaluate((id) => {
        const after = CollectionActions.getItems().find((item) => item.catalogId === id);
        const { genres, genresSource, ...rest } = after,
          { genres: oldGenres, genresSource: oldSource, ...before } = beforeSaved;
        return {
          onlyGenres: JSON.stringify(rest) === JSON.stringify(before),
          updated: after.updated === beforeSaved.updated,
          history:
            JSON.stringify(JSON.parse(localStorage.getItem("myspace-extras-v1")).history) ===
            JSON.stringify(beforeHistory),
          genres,
          genresSource,
          hero: stableHero === document.querySelector(".title-layout"),
          actions: stableActions === document.querySelector(".title-actions"),
          recommendations:
            stableRecommendations === document.querySelector("[data-title-discovery]"),
          scroll: beforeScroll === scrollY,
          focus: beforeFocus === document.activeElement,
        };
      }, seed.catalogId);
      for (const field of [
        "onlyGenres",
        "updated",
        "history",
        "hero",
        "actions",
        "recommendations",
        "scroll",
        "focus",
      ])
        assert.equal(result[field], true, field);
      assert.equal(result.genresSource, "Last.fm · artista");
      assert.deepEqual(result.genres, ["dream pop", "shoegaze"]);
      // Existing metadata and every non-whitelisted personal field remain protected.
      await page.evaluate((id) => {
        const saved = CollectionActions.getItems().find((item) => item.catalogId === id);
        window.protectedSaved = JSON.stringify(saved);
        CollectionActions.patchCatalogMetadata(saved.id, {
          genres: ["wrong"],
          genresSource: "Wrong",
          updated: 0,
          status: "done",
          score: 10,
        });
      }, seed.catalogId);
      assert.equal(
        await page.evaluate(
          (id) =>
            JSON.stringify(CollectionActions.getItems().find((item) => item.catalogId === id)) ===
            protectedSaved,
          seed.catalogId,
        ),
        true,
      );
      await page.locator("#titlePage").screenshot({ path: root + "/" + label + "-inherited.png" });
      await page.evaluate(() => {
        Catalog.enrich = originalEnrich;
        window.releaseGenres = null;
      });
      await open(peer);
      await page.waitForFunction(
        () =>
          document.querySelector("[data-collection-genre-matches]") &&
          !document.querySelector("[data-collection-genre-matches]").hidden,
      );
      assert.ok(
        (
          await page
            .locator(
              "[data-collection-genre-matches] strong,[data-collection-genre-matches] .music-track-title",
            )
            .allTextContents()
        ).includes(seed.title),
      );
      report.push({ label, ...result });
    }
    // Allowlist protects a previously empty item, including updated/status/history.
    const empty = entity("album", "Allow", 101, "album");
    empty.genres = [];
    await page.evaluate((item) => {
      const row = CollectionActions.quickAdd(item);
      window.safeBefore = { ...row };
      CollectionActions.patchCatalogMetadata(row.id, {
        genres: ["rock"],
        genresSource: "Last.fm",
        updated: 0,
        status: "done",
        score: 10,
        featured: true,
        title: "Wrong",
      });
    }, empty);
    assert.equal(
      await page.evaluate(() => {
        const row = CollectionActions.getItems().find((item) => item.id === safeBefore.id);
        return (
          row.updated === safeBefore.updated &&
          row.status === safeBefore.status &&
          row.score === safeBefore.score &&
          row.featured === safeBefore.featured &&
          row.title === safeBefore.title
        );
      }),
      true,
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(root + "/backfill-report.json", JSON.stringify({ report, errors }, null, 2));
    console.log(
      "PASS: four kinds inherit genres and backfill safely; protected genres, allowlist, updated/history/focus/scroll and subsequent matching.",
    );
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
