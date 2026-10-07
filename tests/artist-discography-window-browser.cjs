// Large local CORE/FULL fixture; --measure records the unchanged presentation baseline.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../server.cjs");
const measure = process.argv.includes("--measure");
const reports = [];
const artistId = "ytmusic:artist:UCwindowfixture123";
const releases = Array.from({ length: 65 }, (_, i) => ({
  kind: "album",
  catalogId: "ytmusic:album:MPREwindow" + i,
  title: "Release " + String(i).padStart(2, "0"),
  artist: "Window Artist",
  releaseDate: String(2025 - i),
  albumType: i < 31 ? "album" : i < 36 ? "ep" : "single",
  image: "https://example.test/fixture.png",
  source: "YouTube Music",
}));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
(async () => {
  const server = createServer();
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    for (const scenario of measure
      ? ["desktop", "mobile"]
      : ["desktop", "mobile", "expanded-preview", "focused", "partial", "unknown"]) {
      const mobile = scenario === "mobile";
      const context = await browser.newContext({
        viewport: { width: mobile ? 390 : 1280, height: 900 },
      });
      const page = await context.newPage();
      const calls = [],
        errors = [];
      let resolveFull;
      const gate = new Promise((resolve) => {
        resolveFull = resolve;
      });
      const detail = {
        kind: "artist",
        catalogId: artistId,
        title: "Window Artist",
        source: "YouTube Music",
        topAlbums: releases.slice(0, 20),
        similarArtists: [
          {
            kind: "artist",
            catalogId: "ytmusic:artist:UCsimilarfixture123",
            title: "Similar Artist",
          },
        ],
      };
      await context.route("https://**/*", (route) =>
        route.request().url().includes("fixture.png")
          ? route.fulfill({ contentType: "image/png", body: png })
          : route.abort(),
      );
      await context.route("**/api/music/**", async (route) => {
        const url = new URL(route.request().url());
        calls.push(url.pathname + url.search);
        if (url.pathname.includes("/ytmusic/artist/")) {
          if (url.searchParams.get("phase") === "core") return route.fulfill({ json: detail });
          await gate;
          return route.fulfill({
            json: {
              ...detail,
              topAlbums:
                scenario === "unknown"
                  ? releases.map((row, i) => (i === 64 ? { ...row, albumType: undefined } : row))
                  : releases,
              discographyResolution: {
                status: scenario === "partial" ? "partial" : "complete",
              },
            },
          });
        }
        if (url.pathname.includes("/ytmusic/album/"))
          return route.fulfill({
            json: releases.find((row) => url.pathname.endsWith(row.catalogId.split(":")[2])),
          });
        return route.fulfill({ json: { items: [] } });
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://127.0.0.1:" + server.address().port + "/?voiceTransport=local");
      await page.waitForFunction(() => window.TitlePages);
      await page.evaluate(
        (id) =>
          TitlePages.open({
            kind: "artist",
            catalogId: id,
            title: "Window Artist",
          }),
        artistId,
      );
      const section = page.locator(".artist-discography");
      await section.waitFor();
      await page.waitForFunction(() =>
        document
          .querySelector(".artist-discography .title-notice")
          .textContent.includes("20 lançamentos"),
      );
      const size = mobile ? 8 : 18;
      if (!measure) assert.equal(await section.locator(".discover-card").count(), size);
      if (scenario === "expanded-preview")
        await section.getByRole("button", { name: "ver mais 2", exact: true }).click();
      await section.locator(".discography-filter button[data-value=all]").focus();
      await page.evaluate(async () => {
        const section = document.querySelector(".artist-discography");
        section.scrollIntoView();
        // Keep the scroll assertion inside the document, away from native bottom clamping.
        window.scrollBy({ top: -80, behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.before = {
          section,
          cards: [...section.querySelectorAll(".discover-card")],
          focus: document.activeElement,
          scroll: scrollY,
        };
        const update = section.updateReleases;
        section.updateReleases = (...args) => {
          const start = performance.now();
          const result = update(...args);
          window.patchMs = performance.now() - start;
          return result;
        };
      });
      resolveFull();
      await page.waitForFunction(() =>
        document
          .querySelector(".artist-discography .title-notice")
          .textContent.includes("65 lançamentos"),
      );
      const initial = scenario === "expanded-preview" ? 20 : size;
      const snapshot = await page.evaluate(
        (id) => ({
          model: Catalog.peekCore({ kind: "artist", catalogId: id }).topAlbums.length,
          cards: document.querySelectorAll(".artist-discography .discover-card").length,
          images: document.querySelectorAll(".artist-discography img").length,
          stable:
            before.section === document.querySelector(".artist-discography") &&
            before.cards.every((card) => card.isConnected) &&
            before.focus === document.activeElement &&
            before.scroll === scrollY,
          scrollBefore: before.scroll,
          scrollAfter: scrollY,
          retained: before.cards.every((card) => card.isConnected),
          focusRetained: before.focus === document.activeElement,
          patchMs: window.patchMs,
        }),
        artistId,
      );
      reports.push({
        scenario,
        ...snapshot,
        catalogRequests: calls.length,
        perReleaseRequests: calls.filter((url) => url.includes("/ytmusic/album/")).length,
      });
      assert.equal(snapshot.model, 65);
      assert.equal(snapshot.stable, true, JSON.stringify({ scenario, ...snapshot }));
      assert.equal(reports.at(-1).perReleaseRequests, 0);
      if (measure) {
        await context.close();
        continue;
      }
      assert.equal(snapshot.cards, initial);
      assert.equal(snapshot.images, initial);
      assert.match(
        await section.locator(".title-notice").textContent(),
        new RegExp("mostrando " + initial),
      );
      await section.getByRole("button", { name: /^ver mais / }).hover();
      await page.waitForTimeout(500);
      const count = calls.length;
      const retained = await page.evaluate(() => {
        window.retained = [...document.querySelectorAll(".artist-discography .discover-card")];
        return retained.length;
      });
      await section
        .getByRole("button", {
          name: "ver mais " + Math.min(size, 65 - initial),
          exact: true,
        })
        .click();
      assert.equal(await section.locator(".discover-card").count(), initial + size);
      assert.equal(await page.evaluate(() => retained.every((card) => card.isConnected)), true);
      assert.equal(calls.length, count, JSON.stringify(calls));
      await section.locator(".discography-sort").selectOption("old");
      assert.equal(await section.locator(".discover-card").count(), retained + size);
      await section.locator(".discography-sort").selectOption("recent");
      await section.locator(".discography-sort").selectOption("title");
      assert.equal(await section.locator(".discover-card").count(), retained + size);
      assert.equal(
        await section.locator(".discover-card strong").first().textContent(),
        "Release 00",
      );
      await section.locator(".discography-sort").selectOption("recent");
      if (scenario === "focused") {
        await section.locator(".discover-card").first().focus();
        await page.waitForTimeout(100);
        await page.evaluate(() => (window.focusedCard = document.activeElement));
        await section.locator(".discography-sort").evaluate((select) => {
          select.value = "old";
          select.dispatchEvent(new Event("change"));
        });
        assert.equal(
          await page.evaluate(
            () => focusedCard === document.activeElement && focusedCard.isConnected,
          ),
          true,
        );
      } else {
        let visible = retained + size;
        while (await section.getByRole("button", { name: /^ver mais / }).isVisible()) {
          assert.equal(
            await section.getByRole("button", { name: /^ver mais / }).textContent(),
            "ver mais " + Math.min(size, 65 - visible),
          );
          await section.getByRole("button", { name: /^ver mais / }).click();
          visible = Math.min(65, visible + size);
          assert.equal(await section.locator(".discover-card").count(), visible);
        }
        assert.equal(await section.locator(".discover-card").count(), 65);
        assert.equal(calls.length, count);
      }
      const collapse = section.getByRole("button", {
        name: "recolher",
        exact: true,
      });
      // Isolate keyboard disclosure from pointer intent in the independent similar-artists section.
      await page.mouse.move(0, 0);
      await collapse.evaluate((button) => button.focus({ preventScroll: true }));
      await page.waitForTimeout(50);
      const beforeCollapse = calls.length;
      await collapse.press("Enter");
      await page.waitForTimeout(50);
      assert.equal(
        calls.length,
        beforeCollapse,
        JSON.stringify({ scenario, extra: calls.slice(beforeCollapse) }),
      );
      assert.equal(await section.locator(".discover-card").count(), size);
      assert.notEqual(await page.evaluate(() => document.activeElement.tagName), "BODY");
      const collapsePosition = await page.evaluate(() => {
        const actions = document
          .querySelector(".discography-window-actions")
          .getBoundingClientRect();
        return {
          top: actions.top,
          bottom: actions.bottom,
          viewport: innerHeight,
          scroll: scrollY,
          active: document.activeElement.textContent,
        };
      });
      assert.ok(
        collapsePosition.bottom > 0 && collapsePosition.top < collapsePosition.viewport,
        JSON.stringify({ scenario, collapsePosition }),
      );
      for (const [filter, total] of [
        ["album", 31],
        ["ep", 5],
        ["single", scenario === "unknown" ? 28 : 29],
        ["all", 65],
      ]) {
        await section.locator("[data-value=" + filter + "]").click();
        assert.equal(await section.locator(".discover-card").count(), Math.min(size, total));
        assert.match(
          await section.locator(".title-notice").textContent(),
          new RegExp("^" + total + " lançamentos"),
        );
      }
      assert.ok(
        (await page.getByRole("heading", { name: "artistas similares", exact: true }).count()) >= 1,
      );
      assert.deepEqual(errors, []);
      await context.close();
    }
    if (!measure) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      let providerRequests = 0;
      await context.route("https://**/*", (route) => route.abort());
      await context.route("**/api/music/**", (route) => {
        if (route.request().url().includes("/artist/99/albums?offset=20")) {
          providerRequests++;
          return route.fulfill({
            json: { items: releases.slice(20, 23), next: null },
          });
        }
        return route.fulfill({ json: { items: [] } });
      });
      await page.goto("http://127.0.0.1:" + server.address().port);
      await page.waitForFunction(() => window.TitlePages);
      await page.evaluate(
        (rows) =>
          TitlePages.open({
            kind: "artist",
            catalogId: "deezer:99",
            title: "Legacy Artist",
            topAlbums: rows,
            discographyNext: 20,
          }),
        releases.slice(0, 20),
      );
      const section = page.locator(".artist-discography");
      await section.waitFor();
      await section.getByRole("button", { name: "ver mais 2", exact: true }).focus();
      await section.getByRole("button", { name: "ver mais 2", exact: true }).press("Enter");
      assert.equal(await section.locator(".discover-card").count(), 20);
      assert.equal(providerRequests, 0);
      await section.getByRole("button", { name: "carregar mais lançamentos", exact: true }).focus();
      await section
        .getByRole("button", { name: "carregar mais lançamentos", exact: true })
        .press("Enter");
      await page.waitForFunction(() =>
        document
          .querySelector(".artist-discography .title-notice")
          .textContent.includes("23 lançamentos"),
      );
      assert.equal(providerRequests, 1);
      assert.equal(await section.locator(".discover-card").count(), 20);
      assert.equal(
        await section
          .getByRole("button", {
            name: "carregar mais lançamentos",
            exact: true,
          })
          .isVisible(),
        false,
      );
      await section.getByRole("button", { name: "ver mais 3", exact: true }).focus();
      await section.getByRole("button", { name: "ver mais 3", exact: true }).press("Enter");
      assert.equal(await section.locator(".discover-card").count(), 23);
      assert.equal(providerRequests, 1);
      reports.push({ scenario: "legacy", providerRequests, cards: 23 });
      await context.close();
    }
    fs.mkdirSync("artifacts/artist-window", { recursive: true });
    fs.writeFileSync(
      "artifacts/artist-window/" + (measure ? "before" : "after") + ".json",
      JSON.stringify(reports, null, 2),
    );
    console.log(JSON.stringify(reports));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
