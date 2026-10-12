// Public artist payloads audited this round are replayed; discovery scenarios use isolated fixtures.
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
const root = "artifacts/duration-memory",
  audit = JSON.parse(fs.readFileSync(root + "/audit.json", "utf8"));
(async () => {
  const server = createServer();
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage(),
      errors = [],
      counts = {},
      report = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const art = base + "/memory-fixture.svg";
    await context.route("**/memory-fixture.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#334959"/><circle cx="230" cy="180" r="95" fill="#628597"/></svg>',
      }),
    );
    const entities = new Map(audit.map((row) => [row.detail.catalogId, row.detail]));
    let searchRelease,
      searchGate = new Promise((resolve) => (searchRelease = resolve));
    await context.route("**/api/music/ytmusic/**", (r) => {
      const url = new URL(r.request().url()),
        parts = url.pathname.split("/"),
        kind = parts.at(-2),
        id = parts.at(-1),
        key = "ytmusic:" + (kind === "music" ? "video" : kind) + ":" + id;
      return r.fulfill({
        json: entities.get(key) || {
          kind,
          catalogId: key,
          title: "Intent track",
          trackDuration: 250,
          image: art,
          source: "YouTube Music",
        },
      });
    });
    await context.route("**/api/music/search?*", async (r) => {
      const url = new URL(r.request().url()),
        q = url.searchParams.get("q") || url.searchParams.get("query");
      counts[q] = (counts[q] || 0) + 1;
      const real = audit.find((row) => row.detail.title === q);
      if (real) {
        await searchGate;
        return r.fulfill({ json: { items: real.search } });
      }
      return r.fulfill({ json: { items: [] } });
    });
    await context.route("**/api/music/recommendations?*", (r) =>
      r.fulfill({ json: { items: [] } }),
    );
    await page.goto(base + "/#buscar");
    await page.waitForFunction(() => window.TitlePages && window.CollectionActions);
    for (const real of audit) {
      await page.evaluate((item) => TitlePages.open(item), real.detail);
      await page.waitForSelector(".music-tracklist .music-track-duration", {
        state: "attached",
      });
      await page.evaluate(() => {
        window.topRows = [...document.querySelectorAll(".music-tracklist .music-track-row")];
        window.topSlots = topRows.map((row) => row.querySelector(".music-track-duration"));
        window.hero = document.querySelector(".title-layout");
      });
      assert.equal(await page.locator(".music-tracklist .music-track-duration").count(), 5);
      searchRelease();
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".music-track-duration")].some((slot) => slot.textContent),
      );
      const rows = await page.locator(".music-tracklist .music-track-row").evaluateAll((rows) =>
        rows.map((row) => ({
          title: row.querySelector(".music-track-title").textContent,
          id: row.dataset.catalogId,
          duration: row.querySelector(".music-track-duration").textContent,
        })),
      );
      assert.equal(
        rows.filter((row) => row.duration).length,
        real.name === "Goo Goo Dolls" ? 2 : 3,
      );
      assert.equal(
        await page.evaluate(
          () =>
            hero === document.querySelector(".title-layout") &&
            topRows.every(
              (row, index) =>
                row === document.querySelectorAll(".music-track-row")[index] &&
                topSlots[index] === row.querySelector(".music-track-duration"),
            ),
        ),
        true,
      );
      assert.equal(counts[real.detail.title], 1);
      report.push({
        name: real.name,
        rows,
        extraSearches: counts[real.detail.title],
      });
      await page.locator(".music-tracklist").first().scrollIntoViewIfNeeded();
      await page.screenshot({
        path: root + "/" + real.name.replaceAll(" ", "-") + ".png",
        fullPage: true,
      });
      await page
        .locator(".music-tracklist")
        .first()
        .screenshot({
          path: root + "/" + real.name.replaceAll(" ", "-") + "-tracks.png",
        });
      // A selected unresolved row can patch its existing slot when intent core supplies a clock.
      const unresolved = rows.find((row) => !row.duration);
      await page
        .locator('.music-track-row[data-catalog-id="' + unresolved.id + '"] .music-track-main')
        .focus();
      await page.waitForFunction(
        (id) =>
          [...document.querySelectorAll(".music-track-row")]
            .find((row) => row.dataset.catalogId === id)
            ?.querySelector(".music-track-duration").textContent === "4:10",
        unresolved.id,
      );
      assert.equal(
        await page.evaluate(() =>
          topRows.every(
            (row, index) =>
              row === document.querySelectorAll(".music-track-row")[index] &&
              topSlots[index] === row.querySelector(".music-track-duration"),
          ),
        ),
        true,
      );
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(root + "/browser.json", JSON.stringify({ report, errors, counts }, null, 2));
    console.log("PASS: exact-ID duration batches and stable hero, rows and duration slots.");
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
