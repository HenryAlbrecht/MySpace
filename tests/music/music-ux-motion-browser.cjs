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
        recordVideo: {
          dir: root + "/recordings",
          size: { width: 1280, height: 900 },
        },
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
            ...(value.metadata || {}),
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

    await page.evaluate(() => {
      window.motionCalls = [];
      const original = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        if (this.parentElement?.matches(".discovery-grid"))
          motionCalls.push({ id: this.dataset.catalogId, frames, options });
        return original.call(this, frames, options);
      };
    });
    for (const [label, kind, type] of [
      ["Music", "music"],
      ["Artist", "artist"],
      ["Album", "album", "album"],
      ["EP", "album", "ep"],
      ["Single", "album", "single"],
    ]) {
      const seed = entity(kind, label, 999, type),
        pool = Array.from({ length: 24 }, (_, i) => entity(kind, label, i, type));
      cases.set(seed.title, {
        pool,
        ...(kind === "artist"
          ? { metadata: { sourceExhausted: true, reserveAvailable: true } }
          : {}),
      });
      await open(seed);
      await page.locator("[data-title-discovery]").scrollIntoViewIfNeeded();
      await ready();
      const first = await ids();
      for (const entry of pool.slice(0, 3))
        await page.evaluate((item) => CollectionActions.quickAdd(item), entry);
      await page.waitForTimeout(500);
      await page
        .locator("[data-title-discovery]")
        .screenshot({ path: root + "/" + label + "-before.png" });
      const snapshot = await page.evaluate(() => {
        window.motionCalls = [];
        window.retained = [...document.querySelectorAll(".discovery-grid > [data-catalog-id]")][3];
        window.retainedImage = retained.querySelector("img");
        window.retainedFocus = retained.querySelector("a,button") || retained;
        retainedFocus.focus({ preventScroll: true });
        const before = [...document.querySelectorAll(".discovery-grid > [data-catalog-id]")].map(
            (row) => row.dataset.catalogId,
          ),
          scroll = scrollY,
          at = performance.now();
        document.querySelector("[data-title-discovery] .discovery-heading button").click();
        const after = [...document.querySelectorAll(".discovery-grid > [data-catalog-id]")].map(
          (row) => row.dataset.catalogId,
        );
        return {
          before,
          after,
          scrollStable: scroll === scrollY,
          immediateMs: performance.now() - at,
          focusStable: document.activeElement === retainedFocus,
          artworkStable: retained.querySelector("img") === retainedImage,
          calls: motionCalls,
          gridOpacity: getComputedStyle(document.querySelector(".discovery-grid")).opacity,
        };
      });
      assert.equal(snapshot.scrollStable, true);
      assert.equal(snapshot.focusStable, true);
      assert.equal(snapshot.artworkStable, true);
      assert.equal(snapshot.gridOpacity, "1");
      assert.equal(snapshot.after.filter((id) => snapshot.before.includes(id)).length, 4);
      assert.equal(snapshot.calls.filter((call) => call.frames[0].opacity === 0).length, 8);
      assert.ok(snapshot.calls.some((call) => call.frames[0].transform.startsWith("translate(")));
      assert.ok(snapshot.calls.every((call) => call.options.duration === 180));
      await page.waitForTimeout(500);
      await page
        .locator("[data-title-discovery]")
        .screenshot({ path: root + "/" + label + "-after.png" });
      assert.equal(
        await page.evaluate(() =>
          [...document.querySelectorAll(".discovery-grid > [data-catalog-id]")].every(
            (row) => row.style.transform === "",
          ),
        ),
        true,
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => {
        motionCalls = [];
        document.querySelector("[data-title-discovery] .discovery-heading button").click();
      });
      await ready();
      assert.equal(await page.evaluate(() => motionCalls.length), 0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      report.push({ label, ...snapshot });
    }
    assert.deepEqual(errors, []);
    const video = page.video();
    await context.close();
    const recording = await video.path();
    fs.copyFileSync(recording, root + "/rotation-five-types.webm");
    fs.writeFileSync(
      root + "/motion-report.json",
      JSON.stringify({ report, requests, errors }, null, 2),
    );
    console.log(
      JSON.stringify({
        checks: report.map((row) => ({
          label: row.label,
          flip: row.calls.filter((call) => call.frames[0].opacity !== 0).length,
          enter: row.calls.filter((call) => call.frames[0].opacity === 0).length,
          immediateMs: row.immediateMs,
          scrollStable: row.scrollStable,
          focusStable: row.focusStable,
        })),
        errors,
      }),
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
