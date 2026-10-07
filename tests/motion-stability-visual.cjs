// One browser/context; consecutive paint measurements, local media fixtures only.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../server.cjs");
const phase = process.argv[2] || "after";
const output = path.resolve("artifacts/motion-stability", phase);
fs.mkdirSync(output, { recursive: true });
const web = createServer({
  music: {
    search: async () => ({ items: [] }),
    details: async () => ({}),
    summary: async () => ({}),
    recommendations: async () => ({ items: [] }),
  },
});
let browser;
(async () => {
  const runs = [],
    errors = [];
  try {
    await new Promise((resolve) => web.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.route("**/spacevoice.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body:
          fs.readFileSync("dist/spacevoice.js", "utf8") +
          ";const originalMotionParty=createSpaceVoice;createSpaceVoice=options=>(window.__motionParty=originalMotionParty(options));",
      }),
    );
    await context.route("https://**/*", (route) => route.abort());
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + web.address().port + "/?voiceTransport=local#perfil");
    await page.waitForSelector("#globalSpaceAmp");
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const provider of ["local", "youtube-video", "youtube-cover"]) {
        await page.evaluate((provider) => {
          const full = document.querySelector("#music");
          full.querySelector(".motion-fixture")?.remove();
          if (provider.startsWith("youtube")) {
            const embed = document.createElement("div");
            embed.className = "music-embed motion-fixture";
            embed.innerHTML =
              '<div class="provider-youtube"><iframe title="YouTube fixture" src="about:blank"></iframe></div>';
            full.append(embed);
          }
          localStorage.setItem("spaceamp-youtube-cover-v1", String(provider === "youtube-cover"));
          window.dispatchEvent(new Event("myspace:preferences-restored"));
          SPACEAMP.update(
            {
              title: "Faixa fixture",
              artist: "Artista",
              artwork: location.origin + "/profile-art.png",
              source: provider === "local" ? "local" : "YouTube",
            },
            true,
            { available: true, stopped: false },
          );
        }, provider);
        for (const hash of [
          "#perfil",
          "#colecao",
          "#perfil",
          "#buscar",
          "#perfil",
          "#descobrir",
          "#perfil",
        ]) {
          const frames = await page.evaluate(async (hash) => {
            if (location.hash !== hash) {
              const routed = new Promise((resolve) =>
                addEventListener("hashchange", resolve, { once: true }),
              );
              location.hash = hash;
              await routed;
            }
            const frames = [];
            const started = performance.now();
            for (let frame = 0; frame < 80; frame++) {
              await new Promise(requestAnimationFrame);
              const dock = document.querySelector("#globalSpaceAmp");
              const artwork = dock.classList.contains("in-profile")
                ? dock.querySelector(".album")
                : dock.querySelector(".amp-mini-cover");
              const controls = dock.querySelector(".amp-mini-controls");
              const rect = dock.getBoundingClientRect();
              frames.push({
                frame,
                profile: dock.classList.contains("in-profile"),
                visible: getComputedStyle(dock).visibility === "visible",
                profilePage: !document.querySelector(".columns").hidden,
                width: rect.width,
                height: rect.height,
                right: innerWidth - rect.right,
                artworkWidth: artwork.offsetWidth,
                artworkHeight: artwork.offsetHeight,
                artworkLeft: artwork.getBoundingClientRect().left - rect.left,
                artworkAnchor: artwork.offsetParent?.id || artwork.offsetParent?.className,
                controlsWidth: controls.offsetWidth,
                controlsColumn: controls.getBoundingClientRect().left - rect.left,
              });
              if (performance.now() - started >= 400) break;
            }
            return frames;
          }, hash);
          const visible = frames.filter((frame) => frame.visible);
          const fields =
            hash === "#perfil"
              ? ["width", "height", "artworkWidth", "artworkHeight"]
              : [
                  "width",
                  "height",
                  "right",
                  "artworkWidth",
                  "artworkHeight",
                  "artworkLeft",
                  "controlsWidth",
                  "controlsColumn",
                ];
          const shifts = fields.filter((field) =>
            visible.some((frame) => Math.abs(frame[field] - visible.at(-1)[field]) > 1),
          );
          runs.push({ width, provider, hash, shifts, frames });
          if (phase === "after") assert.deepEqual(shifts, [], `${width}/${provider}/${hash}`);
          if (width === 1440 && provider === "local" && hash === "#colecao") {
            await page.screenshot({
              path: path.join(output, "compact-final.png"),
            });
          }
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    let releaseArtwork;
    await context.route("**/motion-art.png", async (route) => {
      await new Promise((resolve) => {
        releaseArtwork = resolve;
      });
      await route.fulfill({ path: path.resolve("dist/profile-art.png") });
    });
    const artworkRequested = page.waitForRequest("**/motion-art.png");
    await page.evaluate(() => {
      Catalog.search = async () => [
        {
          id: "motion-art",
          catalogId: "itunes:motion-art",
          kind: "music",
          title: "Artwork atrasada",
          image: location.origin + "/motion-art.png",
        },
      ];
      location.hash = "#buscar/music/motion-fixture";
    });
    await page.waitForSelector(".discover-card .title-cover img", {
      state: "attached",
    });
    await page
      .locator(".discover-card img")
      .first()
      .evaluate((image) => {
        image.loading = "eager";
      });
    await artworkRequested;
    const cardHeightBefore = await page
      .locator(".discover-card")
      .first()
      .evaluate((element) => element.offsetHeight);
    releaseArtwork();
    await page.waitForFunction(
      () => document.querySelector(".discover-card img")?.naturalWidth > 0,
    );
    const cardHeightAfter = await page
      .locator(".discover-card")
      .first()
      .evaluate((element) => element.offsetHeight);
    const artworkShift = cardHeightAfter - cardHeightBefore;
    await page.evaluate(() => {
      Catalog.details = async (item) => item;
      Catalog.summary = async (item) => item;
      return TitlePages.open({
        id: "motion-banner",
        kind: "game",
        source: "Steam",
        catalogId: "steam:motion-banner",
        title: "Banner fixture",
        bannerImage: location.origin + "/motion-missing-banner.png",
      });
    });
    await page.waitForSelector(".title-banner", { state: "attached" });
    await page.locator(".title-banner img").evaluate((image) => {
      image.loading = "eager";
    });
    await page.waitForFunction(() => document.querySelector(".title-banner img").complete);
    if (phase === "after") {
      assert.ok(
        (await page.locator(".title-banner").evaluate((element) => element.offsetHeight)) > 150,
      );
    }
    // A failed image preserves its reserved slot; no real provider is queried.
    const bannerFallback = await page.locator(".title-banner").evaluate((element) => ({
      height: element.offsetHeight,
      hidden: element.hidden,
    }));
    await page.evaluate(() => (location.hash = "#spacevoice"));
    await page.waitForSelector("#spaceVoicePage", { state: "visible" });
    const railFrames = await page.evaluate(async () => {
      document.querySelector(".party-chat-toggle").click();
      const frames = [];
      for (let frame = 0; frame < 20; frame++) {
        await new Promise(requestAnimationFrame);
        const body = document.querySelector(".spacevoice-body");
        frames.push({
          width: body.offsetWidth,
          height: body.offsetHeight,
          columns: getComputedStyle(body).gridTemplateColumns,
        });
      }
      return frames;
    });
    const railShift = railFrames.some(
      (frame) =>
        frame.columns !== railFrames.at(-1).columns || frame.height !== railFrames.at(-1).height,
    );
    console.log(JSON.stringify({ artworkShift, railShift, bannerFallback }));
    if (phase === "after") {
      assert.equal(artworkShift, 0, "artwork arrival must not resize card");
      assert.equal(railShift, false, "context rail establishes columns before entrance");
    }
    assert.deepEqual(errors, []);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotion = await page.evaluate(
      () => getComputedStyle(document.querySelector("#globalSpaceAmp")).transitionDuration,
    );
    assert.ok(reducedMotion.split(",").every((duration) => parseFloat(duration) === 0));
    fs.writeFileSync(
      path.join(output, "frames.json"),
      JSON.stringify(
        {
          errors,
          runs,
          artworkShift,
          railFrames,
          bannerFallback,
          reducedMotion,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        errors,
        runs: runs.length,
        shifts: runs
          .filter((run) => run.shifts.length)
          .map(({ width, provider, hash, shifts }) => ({
            width,
            provider,
            hash,
            shifts,
          })),
      }),
    );
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((resolve) => web.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
