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
    const page = await browser.newPage();
    page.on("pageerror", console.error);
    const calls = new Map();
    let delay = 180;
    await page.route("**/api/music/ytmusic/**", async (route) => {
      const url = new URL(route.request().url()),
        raw = decodeURIComponent(url.pathname.split("/").pop()),
        kind = url.pathname.split("/").at(-2),
        id = "ytmusic:" + (kind === "music" ? "video" : kind) + ":" + raw;
      if (url.searchParams.get("phase") === "core") {
        calls.set(id, (calls.get(id) || 0) + 1);
        await new Promise((r) => setTimeout(r, delay));
      }
      await route.fulfill({
        json: {
          kind,
          catalogId: id,
          title: raw,
          artist: "Artist",
          albumTitle: "Album",
          source: "YouTube Music",
          trackDuration: 279,
          releaseDate: "2018",
          albumTracks: [],
          topTracks: [],
          topAlbums: [],
          genres: [],
        },
      });
    });
    await page.route("**/api/music/recommendations?*", (r) => r.fulfill({ json: { items: [] } }));
    await page.goto("http://127.0.0.1:" + server.address().port + "/#buscar");
    const seed = (kind, id, extra = {}) => ({
      kind,
      catalogId: "ytmusic:" + (kind === "music" ? "video" : kind) + ":" + id,
      title: id,
      artist: "Artist",
      albumTitle: "Album",
      source: "YouTube Music",
      trackDuration: 279,
      ...extra,
    });
    const style = () =>
      page.evaluate(() => {
        const s = getComputedStyle(document.querySelector("#titlePage"));
        return [s.opacity, ...["--bg", "--panel", "--panel2"].map((k) => s.getPropertyValue(k))];
      });
    const open = async (item) => {
      const start = Date.now();
      await page.evaluate((item) => TitlePages.open(item), item);
      await page.waitForFunction(
        (title) => document.querySelector("#titlePage h1")?.textContent === title,
        item.title,
      );
      return Date.now() - start;
    };
    const fast = seed("music", "fast1234567");
    const fastMs = await open(fast);
    assert.equal(await page.locator(".title-timing").textContent(), "4:39");
    await page.waitForFunction(
      () => document.querySelector(".title-timing")?.textContent === "2018 · 4:39",
    );
    assert.equal(calls.get(fast.catalogId), 1);
    const hover = seed("music", "hover123456");
    await page.evaluate((item) => {
      const card = document.createElement("button");
      document.body.append(card);
      Catalog.intentCore(card, item);
      card.dispatchEvent(new Event("pointerenter"));
      card.dispatchEvent(new Event("focus"));
    }, hover);
    await page.waitForTimeout(300);
    const cachedMs = await open(hover);
    assert.ok(cachedMs < 180);
    assert.equal(calls.get(hover.catalogId), 1);
    delay = 1200;
    for (const kind of ["music", "album", "artist"]) {
      const item = seed(
        kind,
        kind === "music" ? "slow1234567" : kind === "album" ? "MPREslow1234" : "UCslow123456",
      );
      console.log("testing", kind);
      const elapsed = await open(item);
      assert.ok(elapsed < 350, elapsed);
      const before = await style();
      assert.equal(before[0], "1");
      assert.equal(await page.locator("#titlePage").getAttribute("aria-busy"), "true");
      if (kind === "music") {
        assert.equal(await page.locator(".title-timing").textContent(), "4:39");
        await page.evaluate(() => {
          window.originalFacts = [...document.querySelector("[data-music-details] dl").children];
          window.initialY = scrollY;
        });
      }
      await page.waitForFunction(
        () => document.querySelector("#titlePage").getAttribute("aria-busy") === "false",
      );
      assert.deepEqual(await style(), before);
      if (kind === "music") {
        assert.equal(await page.locator(".title-timing").textContent(), "2018 · 4:39");
        assert.equal(
          await page.evaluate(
            () => originalFacts.every((n) => n.isConnected) && initialY === scrollY,
          ),
          true,
        );
      }
      assert.equal(calls.get(item.catalogId), 1);
    }
    for (const [id, extra, timing] of [
      ["both1234567", { releaseDate: "2018" }, "2018 · 4:39"],
      ["duration123", {}, "4:39"],
      ["year1234567", { releaseDate: "2018", trackDuration: undefined }, "2018"],
      ["empty123456", { trackDuration: undefined }, ""],
    ]) {
      await open(seed("music", id, extra));
      assert.equal(await page.locator(".title-timing").textContent(), timing);
    }
    const stale = seed("music", "stale123456");
    await page.evaluate((item) => {
      TitlePages.open(item);
      location.hash = "#perfil";
    }, stale);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => location.hash), "#perfil");
    console.log(
      JSON.stringify({
        result: "PASS",
        fastMs,
        cachedMs,
        gate: 0,
        checks:
          "timing combinations, pending dedup, slow core, all entity opacity/theme, node/scroll preservation, stale navigation",
      }),
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
