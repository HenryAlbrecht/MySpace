const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  readline = require("node:readline");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../server.cjs");
(async () => {
  let browser;
  const output = "artifacts/health-pass-2";
  fs.mkdirSync(output, { recursive: true });
  const report = { errors: [], checks: [], layouts: [], fixtures: true };
  let base = "";
  const rows = () =>
    Array.from({ length: 4 }, (_, i) => ({
      kind: "music",
      catalogId: "itunes:" + (i + 10),
      title: "Resultado " + (i + 1),
      artist: "Artista de teste",
      source: "iTunes",
      image: base + "/profile-art.png",
    }));
  const web = createServer({
    music: {
      search: async () => ({ items: rows() }),
      summary: async () => ({}),
      recommendations: async () => ({
        items: rows(),
        resolution: { total: 4 },
        reserveAvailable: false,
      }),
      details: async () => rows()[0],
      playbackSource: async () => ({ items: [], status: "not-found" }),
    },
  });
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + web.address().port;
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(base + "/?voiceTransport=local#descobrir");
    const entries = rows();
    await page.evaluate(() => {
      window.__requests = [];
      Catalog.forCollection = (_items, options) =>
        new Promise((resolve) => __requests.push({ options, resolve }));
      DiscoveryPage.load();
    });
    await page.evaluate((entries) => __requests[0].options.partial(entries.slice(0, 1)), entries);
    const first = page.locator("#personalizedDiscovery button.discover-card").first();
    await first.focus();
    await page.evaluate(() => (window.__focused = document.activeElement));
    await page.evaluate((entries) => __requests[0].options.partial(entries.slice(0, 2)), entries);
    assert.equal(await page.evaluate(() => document.activeElement === __focused), true);
    report.checks.push("partial batch preserves card and keyboard focus");
    await page.evaluate(() => (location.hash = "#perfil"));
    await page.waitForFunction(() => document.querySelector("#personalizedDiscovery").hidden);
    await page.evaluate(() => (location.hash = "#descobrir"));
    await page.waitForFunction(() => !document.querySelector("#personalizedDiscovery").hidden);
    await page.evaluate(() => {
      DiscoveryPage.load();
    });
    await page.evaluate(
      (entries) =>
        __requests[0].resolve({
          items: [{ ...entries[0], title: "STALE" }],
          seeds: 1,
          failures: 0,
        }),
      entries,
    );
    await page.waitForTimeout(30);
    assert.ok(!(await page.locator("#personalizedDiscovery").textContent()).includes("STALE"));
    await page.evaluate(
      (entries) => __requests[1].resolve({ items: entries, seeds: 1, failures: 0 }),
      entries,
    );
    await page.waitForFunction(
      () => !document.querySelector("#personalizedDiscovery .small").disabled,
    );
    report.checks.push("late response ignored after leave/reenter");
    await page.evaluate(() => {
      DiscoveryPage.load();
    });
    await page.evaluate(() => __requests[2].resolve({ items: [], seeds: 1, failures: 1 }));
    await page.waitForFunction(() =>
      document
        .querySelector("#personalizedDiscovery")
        .textContent.includes("anteriores foram mantidas"),
    );
    assert.equal(await page.locator("#personalizedDiscovery .discover-card").count(), 4);
    report.checks.push("failed refresh retains cards");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    assert.notEqual(
      await page.evaluate(() => document.activeElement.textContent),
      entries[0].title,
    );
    report.checks.push("spatial arrows navigate retained cards");
    await page.evaluate((entries) => {
      CollectionActions.saveMusic(entries[0]);
      CollectionActions.saveMusic(entries[1]);
      SPACEAMP.update(
        {
          title: "Faixa de apresentação",
          artist: "Artista de teste",
          artwork: entries[0].image,
          source: "local",
          sourceUrl: "",
        },
        true,
        { available: true },
      );
      SPACEAMP.progress({ duration: 120, position: 10 });
      document.body.style.backgroundImage = "url(" + entries[0].image + ")";
      document.documentElement.style.setProperty("--panel", "rgba(21,25,35,.82)");
    }, entries);
    async function capture(name) {
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
      );
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        audio: document.querySelectorAll("audio").length,
      }));
      assert.equal(layout.overflow, false, name);
      assert.equal(layout.audio, 1, name);
      report.layouts.push({ name, ...layout });
      await page.screenshot({
        path: output + "/" + name + ".png",
        fullPage: true,
      });
    }
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [hash, name] of [
        ["#perfil", "profile"],
        ["#colecao", "collection"],
        ["#buscar/music/Fixture", "search"],
        ["#descobrir", "discover"],
        ["#spacevoice", "party"],
      ]) {
        await page.evaluate((hash) => {
          location.hash = hash;
        }, hash);
        await page.waitForTimeout(60);
        if (name === "search")
          await page.waitForFunction(
            () => document.querySelector(".discover-status")?.dataset.state === "ready",
          );
        await capture(name + "-" + width);
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => (location.hash = "#buscar/music/Fixture"));
    await page.waitForFunction(
      () => document.querySelector(".discover-status")?.dataset.state === "ready",
    );
    assert.equal(
      await page
        .locator(".discover-results>.discover-card")
        .first()
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    report.checks.push("reduced motion disables search entry");
    await page.evaluate(() => document.documentElement.style.setProperty("--accent", "#b0dcaa"));
    await page.evaluate(() => (location.hash = "#descobrir"));
    await page.waitForFunction(() => !document.querySelector("#personalizedDiscovery").hidden);
    const dismiss = page.locator(".discovery-dismiss").first();
    await dismiss.focus();
    assert.equal(
      await dismiss.evaluate((e) => getComputedStyle(e).outlineColor),
      "rgb(176, 220, 170)",
    );
    await dismiss.click();
    assert.equal(
      await page.evaluate(() => document.activeElement.classList.contains("discover-card")),
      true,
    );
    report.checks.push("dismiss returns focus to remaining card; configurable accent");
    assert.deepEqual(report.errors, []);
    fs.writeFileSync(output + "/report.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (process.argv.includes("--hold")) {
      console.log("READY: same browser/context remains available");
      const rl = readline.createInterface({ input: process.stdin });
      for await (const line of rl) {
        if (line === "finish") {
          rl.close();
          break;
        }
        if (line === "capture") {
          await capture("review");
          console.log("captured");
        }
      }
    }
  } finally {
    fs.writeFileSync(output + "/report.json", JSON.stringify(report, null, 2));
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
