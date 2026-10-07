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
  const output = "artifacts/health-pass-3";
  fs.mkdirSync(output, { recursive: true });
  const report = { errors: [], checks: [], layouts: [], fixtures: true };
  let base = "";
  const rows = () =>
    Array.from({ length: 8 }, (_, i) => ({
      kind: i === 7 ? "artist" : "music",
      catalogId: "itunes:" + (i + 10),
      title: i === 7 ? "Artista sem foto" : "Uma faixa com um título mais longo " + (i + 1),
      artist: "Artista de teste",
      source: "iTunes",
      image: i === 7 ? "" : base + "/profile-art.png",
    }));
  const web = createServer({
    music: {
      search: async ({ query }) => ({ items: query === "Empty" ? [] : rows() }),
      summary: async () => ({}),
      recommendations: async () => ({
        items: rows(),
        resolution: { total: 8 },
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
        viewport: { width: 390, height: 900 },
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.goto(base + "/?voiceTransport=local#descobrir");
    const entries = rows();
    await page.evaluate((entries) => {
      CollectionActions.saveMusic(entries[0]);
      CollectionActions.saveMusic(entries[1]);
      Catalog.forCollection = async () => ({
        items: entries,
        seeds: 2,
        failures: 0,
      });
    }, entries);
    await page.evaluate(() => DiscoveryPage.load());
    async function playback() {
      await page.evaluate((image) => {
        SPACEAMP.update(
          {
            title: "Uma faixa com um título mais longo",
            artist: "Artista de teste",
            artwork: image,
            source: "local",
            sourceUrl: "",
          },
          true,
          { available: true, stopped: false },
        );
        SPACEAMP.progress({ duration: 120, position: 10 });
      }, entries[0].image);
    }
    async function appearance() {
      await page.evaluate((image) => {
        document.body.style.setProperty("background-image", "url(" + image + ")", "important");
        document.body.style.backgroundAttachment = "fixed";
        document.body.style.backgroundSize = "cover";
        document.body.classList.add("custom-panels");
        document.documentElement.style.setProperty("--panel-opacity", "82%");
        document.documentElement.style.setProperty("--accent", "#b0dcaa");
      }, entries[0].image);
    }
    async function capture(name) {
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
      );
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        audio: document.querySelectorAll("audio").length,
        dockHeight: document.querySelector("#globalSpaceAmp").offsetHeight,
        wallpaper: getComputedStyle(document.body).backgroundImage,
      }));
      assert.equal(layout.overflow, false, name);
      assert.equal(layout.audio, 1, name);
      report.layouts.push({ name, ...layout });
      await page.screenshot({
        path: output + "/" + name + ".png",
        fullPage: true,
      });
    }
    await playback();
    await appearance();
    const resize = page.locator("#globalSpaceAmp .amp-window-controls button").first();
    assert.equal(await resize.getAttribute("aria-expanded"), "false");
    assert.ok((await page.locator("#globalSpaceAmp").evaluate((e) => e.offsetHeight)) < 165);
    await resize.click();
    assert.equal(await resize.getAttribute("aria-expanded"), "true");
    await capture("dock-expanded-390");
    await resize.click();
    assert.equal(await resize.getAttribute("aria-expanded"), "false");
    await resize.click();
    await page.keyboard.press("Escape");
    assert.equal(await resize.getAttribute("aria-expanded"), "false");
    assert.equal(await resize.evaluate((e) => e === document.activeElement), true);
    report.checks.push("mobile retract/expand/Escape preserves focused control");
    const state = await page.evaluate(() => SPACEAMP.getState());
    await page.getByRole("button", { name: "Ocultar SPACEAMP compacto" }).click();
    assert.equal(
      await page.locator("#ampReopen").evaluate((e) => e === document.activeElement),
      true,
    );
    await page.locator("#ampReopen").click();
    assert.equal(await page.evaluate(() => SPACEAMP.getState().title), state.title);
    report.checks.push("hide/reopen restores focus without changing playback snapshot");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(60);
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("footer").getBoundingClientRect().bottom <=
          document.querySelector("#globalSpaceAmp").getBoundingClientRect().top,
      ),
      true,
    );
    report.checks.push("page footer reachable above mobile dock");
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
        await page.waitForTimeout(100);
        if (name === "search")
          await page.waitForFunction(
            () => document.querySelector(".discover-status")?.dataset.state === "ready",
          );
        if (name !== "profile") await playback();
        await appearance();
        await capture(name + "-" + width);
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => (location.hash = "#descobrir"));
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      Catalog.forCollection = async () => {
        throw Error("HTTP 500 internal secret");
      };
    });
    await page.evaluate(() => DiscoveryPage.load());
    assert.ok(!(await page.locator("#personalizedDiscovery").textContent()).includes("HTTP 500"));
    await capture("discover-error-390");
    report.checks.push("friendly error retains existing suggestions");
    await page.evaluate(() => MusicBridge.link(CollectionActions.getItems()[0]));
    await page.waitForSelector("dialog[open]");
    const dialog = page.locator("dialog[open]");
    assert.ok(
      await dialog.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.width <= innerWidth;
      }),
    );
    await capture("link-dialog-390");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    report.checks.push("mobile playback dialog fits and Escape closes");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await resize.click();
    assert.equal(
      await page
        .locator("#globalSpaceAmp .amp-mini-volume")
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await page.keyboard.press("Escape");
    report.checks.push("reduced motion disables expanded-control motion");
    // Simulate an existing visible embed; presentation must never remove its DOM host.
    await page.evaluate(() => {
      const host = document.createElement("div");
      host.className = "music-embed";
      const provider = document.createElement("div");
      provider.className = "provider-youtube";
      const frame = document.createElement("iframe");
      frame.title = "YouTube fixture";
      provider.append(frame);
      host.append(provider);
      document.querySelector("#music").append(host);
      SPACEAMP.update({ ...SPACEAMP.getState(), source: "YouTube" }, true, {
        available: true,
      });
    });
    await page.waitForTimeout(80);
    assert.equal(await resize.isVisible(), false);
    assert.equal(await page.locator("#music iframe").isVisible(), true);
    assert.ok(
      await page
        .locator("#music iframe")
        .evaluate((e) => e.offsetWidth >= 200 && e.offsetHeight >= 200),
    );
    await capture("youtube-presentation-390");
    report.checks.push("visible YouTube iframe retains viewport and host");
    assert.deepEqual(report.errors, []);
    fs.writeFileSync(output + "/report.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (process.argv.includes("--hold")) {
      console.log("READY");
      const rl = readline.createInterface({ input: process.stdin });
      for await (const line of rl) {
        if (line === "finish") {
          rl.close();
          break;
        }
        try {
          const command = JSON.parse(line);
          if (command.eval) console.log(JSON.stringify(await page.evaluate(command.eval)));
          if (command.reload) {
            await page.reload();
            await page.waitForTimeout(150);
          }
          if (command.capture) await capture(command.capture);
        } catch (error) {
          console.log(error.message);
        }
      }
    }
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
