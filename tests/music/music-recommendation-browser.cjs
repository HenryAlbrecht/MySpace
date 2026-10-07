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
  const server = createServer();
  let browser;
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext();
    await context.route(/^https?:\/\//, (route) =>
      ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const seed = {
      kind: "album",
      catalogId: "ytmusic:album:MPREfixtureseed",
      title: "Seed",
      albumType: "single",
      artist: "A",
      source: "YouTube Music",
    };
    const a = {
        ...seed,
        catalogId: "ytmusic:album:MPREfixtureaaa",
        title: "A",
      },
      b = { ...seed, catalogId: "ytmusic:album:MPREfixturebbb", title: "B" };
    await page.goto("http://127.0.0.1:" + server.address().port + "/#buscar");
    await page.waitForFunction(() => window.Catalog && window.CollectionActions);
    // Collection discovery remains distinct from title-page reserve/rotation coverage.
    const result = await page.evaluate(async () => {
      const kinds = ["music", "album", "artist", "game", "anime", "manga"];
      const seeds = kinds.map((kind, i) => ({
        kind,
        catalogId: "seed:" + kind,
        title: kind,
        featured: true,
        updated: i,
      }));
      const partials = [];
      const recommend = async (seed) =>
        Array.from({ length: 4 }, (_, i) => ({
          kind: seed.kind,
          catalogId: "new:" + seed.kind + ":" + i,
          title: seed.kind + i,
          artistCatalogId:
            seed.kind === "music" || seed.kind === "album"
              ? "ytmusic:artist:UCartist" + (i % 2)
              : undefined,
          albumType: seed.kind === "album" ? ["album", "ep", "single"][i % 3] : undefined,
        }));
      const output = await Catalog.forCollection(seeds, {
        recommend,
        partial: (rows) => partials.push(rows.map((row) => row.catalogId)),
      });
      return { items: output.items, partial: partials.at(-1) };
    });
    assert.deepEqual(
      result.partial,
      result.items.map((row) => row.catalogId),
    );
    assert.equal(new Set(result.items.slice(0, 12).map((row) => row.kind)).size, 6);
    assert.equal(result.items.length, 24);
    await page.evaluate(
      ({ seed, a, b }) => {
        CollectionActions.quickAdd(seed);
        Catalog.recommendations = async () => [a, b];
        location.hash = "#descobrir";
      },
      { seed, a, b },
    );
    const global = page.locator("#personalizedDiscovery");
    await global.getByRole("button", { name: "carregar sugestões", exact: true }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#personalizedDiscovery .discovery-grid")
          .getAttribute("aria-busy") === "false",
    );
    const count = await global.locator(".discovery-choice").count();
    assert.equal(count, 2);
    await global.locator(".discovery-dismiss").first().click();
    assert.equal(await global.locator(".discovery-choice").count(), count - 1);
    await global.getByRole("button", { name: "rever sugestões descartadas", exact: true }).click();
    assert.equal(await global.locator(".discovery-choice").count(), count);
    await global.getByLabel("Tipo de sugestão").selectOption("album");
    await page.waitForFunction(
      () =>
        document
          .querySelector("#personalizedDiscovery .discovery-grid")
          .getAttribute("aria-busy") === "false",
    );
    assert.equal(await global.locator(".discovery-choice").count(), count);
    const retained = await global.locator(".discovery-choice strong").allTextContents();
    await page.evaluate(
      () =>
        (Catalog.recommendations = async () => {
          throw Error("controlled provider outage");
        }),
    );
    await global.getByRole("button", { name: "atualizar sugestões", exact: true }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#personalizedDiscovery .discovery-grid")
          .getAttribute("aria-busy") === "false",
    );
    assert.equal(await global.locator(".discovery-choice").count(), count);
    assert.deepEqual(await global.locator(".discovery-choice strong").allTextContents(), retained);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: Collection discovery, six media kinds, partial/final ordering, dismiss/restore/filter and outage retention; no browser errors.",
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
