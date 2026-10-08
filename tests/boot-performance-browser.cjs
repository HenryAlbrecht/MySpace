// Local deterministic work counts; timings are diagnostic, never thresholds.
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
const phase = process.argv[2] || "after";
const output = path.resolve("artifacts/performance");
const countsOnly = phase !== "before";
const domain = (file) =>
  file.startsWith("voice/") || /^(spacevoice|party-chat-ui)/.test(file)
    ? "PARTY"
    : file.startsWith("xmb")
      ? "XMB"
      : /^(?:spaceamp\/)?spaceamp-(?:now-playing|visualizer|lyrics-profile)/.test(file)
        ? "Now Playing"
        : file.startsWith("catalog/") ||
          /^(catalog|title-|music-(page|discovery|collection)|tag-page|discovery-page|editor-ui)/.test(
              file,
            )
          ? "Catalog/TitlePages"
          : file.startsWith("collection")
            ? "Collection"
            : "CORE/profile";
const factories = {
  "spacevoice.js": "createSpaceVoice",
  "voice/media.js": "createVoiceMedia",
  "voice/devices.js": "createVoiceDevices",
  "voice/levels.js": "createVoiceLevels",
};
const seed = {
  version: 1,
  items: Array.from({ length: 100 }, (_, i) => ({
    id: "boot-" + i,
    kind: "book",
    title: "Book " + i,
    status: "planned",
    progress: 0,
    total: 10,
    image: "https://example.test/fixture.png",
    updated: i,
    lists: [],
  })),
  photos: Array.from({ length: 24 }, (_, i) => ({
    id: "photo-" + i,
    image: "https://example.test/fixture.png",
    caption: "Photo " + i,
  })),
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
  "base64",
);
(async () => {
  const server = createServer({
    music: {
      search: async () => ({ items: [] }),
      recommendations: async () => ({ items: [] }),
    },
  });
  let browser;
  const reports = [];
  const served = [];
  server.on("request", (req, res) =>
    res.on("finish", () => served.push({ url: req.url, status: res.statusCode })),
  );
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = "http://127.0.0.1:" + server.address().port;
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    for (const routeName of ["perfil", "colecao", "buscar", "spacevoice", "party-link"]) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      await context.addInitScript((seed) => {
        localStorage.setItem("myspace-extras-v1", JSON.stringify(seed));
        window.__boot = {
          counts: {},
          tasks: [],
          started: {},
          evaluation: {},
          count(name) {
            this.counts[name] = (this.counts[name] || 0) + 1;
          },
        };
        try {
          new PerformanceObserver((list) =>
            __boot.tasks.push(
              ...list.getEntries().map((row) => ({
                start: row.startTime,
                duration: row.duration,
              })),
            ),
          ).observe({ type: "longtask", buffered: true });
        } catch {}
        new MutationObserver(() => {
          const page = document.body?.dataset.page;
          const selectors = {
            perfil: ".columns button",
            colecao: "#collectionPage .collection-controls",
            buscar: "#discoverPage input",
            spacevoice: "#spaceVoicePage .spacevoice button",
          };
          const control = document.querySelector(selectors[page] || "boot-not-ready");
          if (!__boot.usable && control && control.getClientRects().length)
            __boot.usable = performance.now();
        }).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["data-page", "hidden"],
        });
      }, seed);
      const scripts = [],
        styles = [],
        external = [],
        errors = [];
      await context.route("https://**/*", (route) => {
        external.push({
          url: route.request().url(),
          type: route.request().resourceType(),
        });
        return route.request().url().endsWith("fixture.png")
          ? route.fulfill({ contentType: "image/png", body: png })
          : route.abort();
      });
      await context.route("**/*.js", async (route) => {
        const file = new URL(route.request().url()).pathname.slice(1);
        const source = fs.readFileSync(path.join("dist", file), "utf8");
        scripts.push({
          file,
          bytes: Buffer.byteLength(source),
          domain: domain(file),
        });
        let code = source;
        if (file === "app.js")
          code = code.replace(
            "window.SPACEAMP = SpaceAmp.create",
            'window.__boot.count("SPACEAMP");window.SPACEAMP = SpaceAmp.create',
          );
        for (const name of file === "extras.js"
          ? ["renderExtras", "applyRoute"]
          : file === "profile-extras-view.js"
            ? ["renderGallery"]
            : file === "collection/collection-view.js"
              ? ["renderCollection", "renderCollectionContents"]
              : file === "app.js"
                ? ["render"]
                : []) {
          code = code.replace(
            new RegExp("function " + name + "\\(\\) \\{"),
            (match) => match + 'window.__boot.count("' + name + '");',
          );
        }
        if (factories[file]) {
          const factory = JSON.stringify(factories[file]);
          code += `
if (typeof window[${factory}] !== "function") {
  throw new TypeError("Boot factory unavailable: " + ${factory});
}
window[${factory}] = new Proxy(window[${factory}], {
  apply(target, thisArg, args) {
    window.__boot.count(${factory});
    return Reflect.apply(target, thisArg, args);
  },
});
`;
        }
        code =
          "window.__boot.started[" +
          JSON.stringify(file) +
          "] = performance.now();\n" +
          code +
          "\nwindow.__boot.evaluation[" +
          JSON.stringify(file) +
          "] = performance.now() - window.__boot.started[" +
          JSON.stringify(file) +
          "];";
        await route.fulfill({
          contentType: "text/javascript; charset=utf-8",
          body: code,
        });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.resourceType() === "stylesheet")
          styles.push(new URL(request.url()).pathname.slice(1));
      });
      await page.goto(
        origin +
          (routeName === "party-link"
            ? "/?party&voiceTransport=local"
            : "/?voiceTransport=local#" + routeName),
      );
      const expected = routeName === "party-link" ? "spacevoice" : routeName;
      await page.waitForFunction(
        (expected) => document.body.dataset.page === expected && document.readyState === "complete",
        expected,
      );
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      // Allow buffered paint/long-task entries to be delivered; no timing threshold is asserted.
      await page.waitForTimeout(100);
      const snapshot = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          nodes: document.querySelectorAll("*").length,
          images: document.images.length,
          collectionCards: document.querySelectorAll("#collectionPage .shelf-card").length,
          galleryImages: document.querySelectorAll("#photosPage img").length,
          counts: { ...__boot.counts },
          evaluation: __boot.evaluation,
          usable: __boot.usable,
          dcl: nav.domContentLoadedEventEnd,
          load: nav.loadEventEnd,
          paints: performance
            .getEntriesByType("paint")
            .map((row) => ({ name: row.name, start: row.startTime })),
          longTasks: __boot.tasks,
          resources: performance.getEntriesByType("resource").map((row) => ({
            name: row.name,
            initiator: row.initiatorType,
            start: row.startTime,
            end: row.responseEnd,
            bytes: row.transferSize,
          })),
          transferBytes: performance
            .getEntriesByType("resource")
            .reduce((sum, row) => sum + row.transferSize, 0),
        };
      });
      assert.deepEqual(errors, []);
      if (countsOnly) {
        assert.equal(snapshot.counts.renderCollectionContents || 0, expected === "colecao" ? 1 : 0);
        assert.equal(snapshot.counts.renderCollection || 0, expected === "colecao" ? 1 : 0);
        assert.equal(snapshot.counts.renderGallery || 0, 0);
        assert.equal(snapshot.counts.createSpaceVoice || 0, expected === "spacevoice" ? 1 : 0);
      }
      reports.push({
        route: routeName,
        ...snapshot,
        scripts,
        css: styles,
        external,
      });
      if (countsOnly && routeName === "perfil") {
        await page.evaluate(() => (location.hash = "#colecao"));
        await page.waitForFunction(() => document.body.dataset.page === "colecao");
        assert.equal(await page.evaluate(() => __boot.counts.renderCollectionContents), 1);
        assert.equal(await page.locator("#collectionPage .shelf-card").count(), 100);
        await page.evaluate(() => (location.hash = "#perfil"));
        await page.waitForFunction(() => document.body.dataset.page === "perfil");
        await page.evaluate(() =>
          CollectionActions.updateItem("boot-0", { title: "Updated Book" }),
        );
        assert.equal(
          await page.evaluate(() => __boot.counts.renderCollectionContents),
          1,
          "hidden mutation marks dirty without rendering",
        );
        await page.evaluate(() => (location.hash = "#colecao"));
        await page.waitForFunction(() => document.body.dataset.page === "colecao");
        assert.equal(await page.evaluate(() => __boot.counts.renderCollectionContents), 2);
        assert.ok((await page.locator("#collectionPage").textContent()).includes("Updated Book"));
        await page.evaluate(() => (location.hash = "#fotos"));
        await page.waitForFunction(() => document.body.dataset.page === "fotos");
        assert.equal(await page.locator("#photosPage img").count(), 24);
        assert.equal(await page.evaluate(() => __boot.counts.renderGallery), 1);
        await page
          .locator("#gallery .mini-actions button")
          .filter({ hasText: "editar" })
          .first()
          .click();
        await page.evaluate(() => (location.hash = "#perfil"));
        await page.waitForFunction(() => document.body.dataset.page === "perfil");
        await page.locator('#resourceEditor [name="caption"]').fill("Updated photo");
        await page.locator('#resourceEditor button[type="submit"]').click();
        await page.waitForFunction(() => !document.querySelector("#resourceEditor").open);
        assert.equal(
          await page.evaluate(() => __boot.counts.renderGallery),
          1,
          "hidden photo mutation only marks dirty",
        );
        await page.evaluate(() => (location.hash = "#fotos"));
        await page.waitForFunction(() => document.body.dataset.page === "fotos");
        assert.equal(await page.evaluate(() => __boot.counts.renderGallery), 2);
        assert.equal(
          await page.locator("#gallery .gallery-caption").first().textContent(),
          "Updated photo",
        );
        await page.evaluate(() => (location.hash = "#perfil"));
        await page.waitForFunction(() => document.body.dataset.page === "perfil");
        await page.evaluate(() => (location.hash = "#fotos"));
        await page.waitForFunction(() => document.body.dataset.page === "fotos");
        assert.equal(
          await page.evaluate(() => __boot.counts.renderGallery),
          2,
          "unchanged Gallery is reused",
        );
        await page.evaluate(() => (location.hash = "#spacevoice"));
        await page.waitForFunction(() => document.body.dataset.page === "spacevoice");
        await page.evaluate(() => (window.partyNode = document.querySelector(".spacevoice")));
        await page.evaluate(() => (location.hash = "#perfil"));
        await page.waitForFunction(() => document.body.dataset.page === "perfil");
        await page.evaluate(() => (location.hash = "#spacevoice"));
        await page.waitForFunction(() => document.body.dataset.page === "spacevoice");
        assert.equal(await page.evaluate(() => __boot.counts.createSpaceVoice), 1);
        assert.equal(
          await page.evaluate(() => partyNode === document.querySelector(".spacevoice")),
          true,
        );
      }
      await context.close();
    }
    const first = await fetch(origin + "/app.js");
    const etag = first.headers.get("etag");
    const firstBytes = (await first.arrayBuffer()).byteLength;
    const reload = await fetch(origin + "/app.js", {
      headers: etag ? { "If-None-Match": etag } : {},
    });
    const reloadBytes = (await reload.arrayBuffer()).byteLength;
    const head = await fetch(origin + "/app.js", { method: "HEAD" });
    if (phase === "after") {
      assert.equal(reload.status, 304);
      assert.equal(reloadBytes, 0);
      assert.equal((await head.arrayBuffer()).byteLength, 0);
    }
    const cachedContext = await browser.newContext();
    const cachedPage = await cachedContext.newPage();
    const session = await cachedContext.newCDPSession(cachedPage);
    await session.send("Network.enable");
    await session.send("Network.setBlockedURLs", { urls: ["https://*"] });
    const start = served.length;
    await cachedPage.goto(origin);
    const cold = served.slice(start);
    const coldTiming = await cachedPage.evaluate(() => ({
      dcl: performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd,
      jsTransfer: performance
        .getEntriesByType("resource")
        .filter((row) => row.name.endsWith(".js"))
        .reduce((sum, row) => sum + row.transferSize, 0),
    }));
    const split = served.length;
    await cachedPage.reload();
    const reloaded = served.slice(split);
    const reloadTiming = await cachedPage.evaluate(() => ({
      dcl: performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd,
      jsTransfer: performance
        .getEntriesByType("resource")
        .filter((row) => row.name.endsWith(".js"))
        .reduce((sum, row) => sum + row.transferSize, 0),
    }));
    if (phase === "after") {
      assert.equal(
        reloaded.filter((row) => row.url.endsWith(".js") && row.status === 304).length,
        cold.filter((row) => row.url.endsWith(".js")).length,
      );
    }
    await cachedContext.close();
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(
      path.join(output, phase + ".json"),
      JSON.stringify(
        {
          reports,
          static: {
            first: first.status,
            firstBytes,
            reload: reload.status,
            reloadBytes,
            head: head.status,
            etag,
          },
          browserReload: { cold, reloaded, coldTiming, reloadTiming },
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        reports.map(({ route, nodes, counts, scripts, dcl, usable }) => ({
          route,
          nodes,
          counts,
          js: scripts.length,
          jsBytes: scripts.reduce((sum, row) => sum + row.bytes, 0),
          dcl,
          usable,
        })),
      ),
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
