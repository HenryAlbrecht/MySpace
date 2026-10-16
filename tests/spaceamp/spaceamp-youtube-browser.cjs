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
    await context.addInitScript(() => {
      localStorage.setItem("spaceamp-youtube-cover-v1", "true");
      window.mockYT = [];
      window.YT = {
        Player: class {
          constructor(frame, { events }) {
            this.events = events;
            this.url = frame.src.replace("/embed/", "/watch?v=");
            window.mockYT.push(this);
            frame.addEventListener("load", () => events.onReady({ target: this }), { once: true });
          }
          getVideoUrl() {
            return this.url;
          }
          getPlayerState() {
            return this.state ?? -1;
          }
          playVideo() {
            this.state = 1;
            this.events.onStateChange({ target: this, data: 1 });
          }
          pauseVideo() {
            this.state = 2;
            this.events.onStateChange({ target: this, data: 2 });
          }
          stopVideo() {
            this.state = 5;
          }
          setVolume() {}
          destroy() {}
          end() {
            this.state = 0;
            this.events.onStateChange({ target: this, data: 0 });
          }
          fail(code) {
            this.events.onError({ target: this, data: code });
          }
        },
      };
    });
    await context.route("https://www.youtube.com/embed/**", (r) =>
      r.fulfill({ body: "<html></html>", contentType: "text/html" }),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + server.address().port, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => {
      document.body.classList.add("custom-panels");
      document.body.style.setProperty("--panel-opacity", "55%");
      const probe = document.createElement("div");
      probe.className = "panel";
      document.body.append(probe);
      if (
        getComputedStyle(probe).backgroundColor !==
        getComputedStyle(document.querySelector("#globalSpaceAmp")).backgroundColor
      )
        throw Error("SPACEAMP opacity differs from panels");
      if (getComputedStyle(document.querySelector("#music")).backgroundColor !== "rgba(0, 0, 0, 0)")
        throw Error("Stacked panel background");
      probe.remove();
    });
    await page.evaluate(async () => {
      const a = {
          title: "First",
          artist: "Artist",
          album: "profile-art.png",
          url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
          playbackSource: {
            type: "youtube",
            videoId: "dQw4w9WgXcQ",
            url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        },
        b = {
          ...a,
          title: "Second",
          url: "https://music.youtube.com/watch?v=CduA0TULnow",
          playbackSource: {
            type: "youtube",
            videoId: "CduA0TULnow",
            url: "https://music.youtube.com/watch?v=CduA0TULnow",
          },
        },
        c = {
          ...a,
          title: "Third",
          url: "https://music.youtube.com/watch?v=9bZkp7q19f0",
          playbackSource: {
            type: "youtube",
            videoId: "9bZkp7q19f0",
            url: "https://music.youtube.com/watch?v=9bZkp7q19f0",
          },
        };
      const id = SPACEAMP.enqueue(a);
      SPACEAMP.enqueue(b);
      SPACEAMP.enqueue(c);
      await SPACEAMP.play(id);
    });
    await page.waitForFunction(
      () => SPACEAMP.getState().playing && SPACEAMP.getState().title === "First",
    );
    const embed = new URL(await page.locator("#music iframe").getAttribute("src"));
    assert.equal(embed.origin, "https://www.youtube.com");
    assert.equal(embed.pathname, "/embed/dQw4w9WgXcQ");
    assert.equal(await page.locator("#music iframe").getAttribute("loading"), "eager");
    const toggle = page.locator(".amp-artwork-toggle");
    assert.ok(
      await page.locator("#globalSpaceAmp").evaluate((e) => e.classList.contains("youtube-cover")),
    );
    assert.equal(
      await page.locator("#music .music-embed").evaluate((e) => getComputedStyle(e).opacity),
      "0",
    );
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
    await page.evaluate(() => (location.hash = "#colecao"));
    await page.waitForFunction(
      () => !document.querySelector("#globalSpaceAmp").classList.contains("in-profile"),
    );
    assert.equal(await page.locator(".amp-mini-cover").isVisible(), true);
    await page.evaluate(() => {
      document.body.classList.add("custom-panels");
      document.body.style.setProperty("--panel-opacity", "55%");
    });
    assert.ok(
      (
        await page.locator("#globalSpaceAmp").evaluate((e) => getComputedStyle(e).backgroundColor)
      ).includes("0.55"),
    );
    assert.equal(
      await page.locator("#globalSpaceAmp").evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    await page.evaluate(() =>
      mockYT.at(-1).events.onStateChange({ target: mockYT.at(-1), data: 3 }),
    );
    assert.equal(await page.locator(".amp-playback-notice").textContent(), "Carregando YouTube…");
    await page.evaluate(() => mockYT.at(-1).events.onAutoplayBlocked({ target: mockYT.at(-1) }));
    assert.equal(
      await page.locator(".amp-playback-notice").textContent(),
      "Clique em play para iniciar",
    );
    await page.evaluate(() => SPACEAMP.play());
    await page.waitForFunction(() => SPACEAMP.getState().playing);
    assert.equal(await page.locator(".amp-playback-notice").isVisible(), false);
    const before = await page.evaluate(() => mockYT.length);
    await page.locator(".amp-artwork-toggle").click();
    assert.equal(await page.evaluate(() => mockYT.length), before);
    assert.equal(await page.locator("#music iframe").isVisible(), true);
    assert.equal(
      await page.locator("#music .music-embed").evaluate((e) => getComputedStyle(e).animationName),
      "amp-video-in",
    );
    await page.locator(".amp-artwork-toggle").click();
    assert.equal(
      await page.locator(".amp-mini-cover").evaluate((e) => getComputedStyle(e).animationName),
      "amp-cover-in",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page.locator(".amp-mini-cover").evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await page.evaluate(() => {
      location.hash = "#perfil";
      CollectionActions.saveMusic({
        title: "First",
        artist: "Artist",
        kind: "music",
        catalogId: "ytmusic:video:dQw4w9WgXcQ",
        playbackSource: {
          type: "youtube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      });
    });
    await page.waitForFunction(() =>
      document.querySelector("#globalSpaceAmp").classList.contains("in-profile"),
    );
    await page.locator("#spaceAmpOpenQueue").click();
    await page.waitForSelector("#spaceAmpQueue[open]");
    const playerCount = await page.evaluate(() => mockYT.length);
    await page.getByLabel("Mover para baixo: First", { exact: true }).click();
    assert.deepEqual(await page.evaluate(() => SPACEAMP.getState().queue.map((t) => t.title)), [
      "Second",
      "First",
      "Third",
    ]);
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
    assert.equal(await page.evaluate(() => mockYT.length), playerCount);
    await page.getByLabel("Remover da fila: First", { exact: true }).click();
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
    assert.equal(await page.evaluate(() => SPACEAMP.getState().title), "First");
    assert.equal(
      await page.evaluate(() => CollectionActions.getItems().some((i) => i.title === "First")),
      true,
    );
    assert.deepEqual(await page.evaluate(() => SPACEAMP.getState().queue.map((t) => t.title)), [
      "Second",
      "Third",
    ]);
    await page.evaluate(() => mockYT.at(-1).end());
    await page.waitForFunction(
      () => SPACEAMP.getState().title === "Second" && SPACEAMP.getState().playing,
    );
    await page.evaluate(() => mockYT.at(-1).fail(100));
    await page.waitForFunction(
      () => SPACEAMP.getState().title === "Third" && SPACEAMP.getState().playing,
    );
    await page.reload();
    await page.waitForFunction(() => window.SPACEAMP);
    assert.deepEqual(await page.evaluate(() => SPACEAMP.getState().queue), []);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: YouTube Music identity uses the existing iframe/player; end and unavailable-source errors advance the queue; zero page errors (mock IFrame API).",
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
