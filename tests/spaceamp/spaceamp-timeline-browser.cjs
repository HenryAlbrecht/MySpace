// Same adapter clock/seek in profile and compact UI; actual local audio and mock IFrame API.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs");
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
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("spaceamp-youtube-cover-v1", "true");
      window.__players = [];
      window.YT = {
        Player: class {
          constructor(frame, { events }) {
            this.events = events;
            this.url =
              "https://www.youtube.com/watch?v=" + new URL(frame.src).pathname.split("/").pop();
            this.position = 12;
            this.duration = 0;
            __players.push(this);
            frame.addEventListener("load", () => events.onReady({ target: this }), { once: true });
          }
          getVideoUrl() {
            return this.url;
          }
          getPlayerState() {
            return this.state ?? -1;
          }
          getCurrentTime() {
            return this.position;
          }
          getDuration() {
            return this.duration;
          }
          seekTo(seconds) {
            this.lastSeek = seconds;
            if (this.seekDelay)
              setTimeout(() => {
                this.position = seconds;
              }, this.seekDelay);
            else this.position = seconds;
          }
          setVolume() {}
          destroy() {
            this.destroyed = true;
          }
          playVideo() {
            this.state = 1;
            this.events.onStateChange({ target: this, data: 1 });
          }
          pauseVideo() {
            this.state = 2;
            this.events.onStateChange({ target: this, data: 2 });
          }
        },
      };
    });
    await context.route("https://**/*", (r) =>
      r.request().url().includes("youtube.com/embed/")
        ? r.fulfill({ contentType: "text/html", body: "<html></html>" })
        : r.abort(),
    );
    const wav = Buffer.alloc(44 + 30 * 16000);
    wav.write("RIFF");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVE", 8);
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(wav.length - 44, 40);
    await context.route("**/fixture.wav", (r) => {
      const range = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range || "");
      const start = range ? Number(range[1]) : 0,
        end = range && range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
      return r.fulfill({
        status: range ? 206 : 200,
        contentType: "audio/wav",
        headers: {
          "accept-ranges": "bytes",
          ...(range ? { "content-range": `bytes ${start}-${end}/${wav.length}` } : {}),
        },
        body: wav.subarray(start, end + 1),
      });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + web.address().port + "/?voiceTransport=local#perfil");
    await page.waitForSelector("#globalSpaceAmp");
    await page.evaluate(async () => {
      const id = SPACEAMP.enqueue({
        title: "Timeline YouTube fixture",
        artist: "Fixture",
        album: "profile-art.png",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      });
      await SPACEAMP.play(id);
    });
    await page.waitForFunction(() => SPACEAMP.getState().playing);
    assert.equal(await page.locator("#seek").isDisabled(), true);
    // The live adapter duration can arrive without a SPACEAMP progress event.
    await page.evaluate(() => {
      __players[0].duration = 180;
    });
    await page.waitForFunction(() => !document.querySelector("#seek").disabled);
    assert.equal(await page.locator("#music .player-progress").isVisible(), true);
    assert.equal(await page.locator("#duration").textContent(), "3:00");
    const geometry = await page.locator("#music .player-progress").boundingBox();
    await page.locator("#seek").fill("50");
    assert.equal(await page.evaluate(() => __players[0].lastSeek), 90);
    await page.evaluate(() => {
      __players[0].position = 96;
      document.querySelector("#seek").blur();
    });
    await page.waitForFunction(() => document.querySelector("#time").textContent === "1:36");
    const originalPlayers = await page.evaluate(() => __players.length);
    await page.evaluate(() => (location.hash = "colecao"));
    await page.waitForFunction(
      () => !document.querySelector("#globalSpaceAmp").classList.contains("in-profile"),
    );
    const mini = page.locator(".amp-mini-seek");
    assert.equal(await mini.isVisible(), true);
    await mini.fill("25");
    assert.equal(await page.evaluate(() => __players[0].lastSeek), 45);
    await mini.focus();
    await page.keyboard.press("ArrowRight");
    assert.ok((await page.evaluate(() => __players[0].lastSeek)) > 45);
    assert.equal(await page.evaluate(() => __players.length), originalPlayers);
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), true);
    await page.evaluate(() => {
      SPACEAMP.pause();
      __players[0].seekDelay = 200;
    });
    await mini.fill("75");
    assert.equal(await mini.inputValue(), "75");
    await page.waitForFunction(
      () => document.querySelector(".amp-mini-progress small").textContent === "2:15 / 3:00",
    );
    assert.equal(await page.evaluate(() => __players[0].lastSeek), 135);
    assert.equal(await page.evaluate(() => SPACEAMP.getState().playing), false);
    fs.mkdirSync("artifacts/spaceamp-timeline", { recursive: true });
    await page.screenshot({
      path: "artifacts/spaceamp-timeline/youtube-compact.png",
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: "artifacts/spaceamp-timeline/youtube-mobile.png",
    });
    assert.equal(await mini.evaluate((n) => n.getBoundingClientRect().right <= innerWidth), true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => (location.hash = "perfil"));
    await page.waitForFunction(() =>
      document.querySelector("#globalSpaceAmp").classList.contains("in-profile"),
    );
    await page.screenshot({
      path: "artifacts/spaceamp-timeline/youtube-profile.png",
    });
    // Local audio keeps the exact same existing profile slider and compact layout.
    await page.evaluate(async () => {
      document.querySelector("#audio").muted = true;
      await SPACEAMP.preview({
        title: "Timeline local audio fixture",
        artist: "Fixture",
        album: "profile-art.png",
        url: location.origin + "/fixture.wav",
      });
    });
    await page.waitForFunction(
      () => SPACEAMP.getState().playing && document.querySelector("#audio").duration === 30,
    );
    assert.equal(await page.locator("#music .player-progress").isVisible(), true);
    const localGeometry = await page.locator("#music .player-progress").boundingBox();
    assert.equal(localGeometry.width, geometry.width);
    assert.equal(localGeometry.height, geometry.height);
    await page.locator("#seek").fill("50");
    await page.waitForFunction(
      () => Math.abs(document.querySelector("#audio").currentTime - 15) < 1,
    );
    assert.ok(
      Math.abs((await page.evaluate(() => document.querySelector("#audio").currentTime)) - 15) < 1,
    );
    await page.evaluate(() => (location.hash = "colecao"));
    await page.waitForFunction(
      () => !document.querySelector("#globalSpaceAmp").classList.contains("in-profile"),
    );
    await mini.fill("20");
    assert.ok(
      Math.abs((await page.evaluate(() => document.querySelector("#audio").currentTime)) - 6) < 1,
    );
    await page.screenshot({
      path: "artifacts/spaceamp-timeline/local-compact.png",
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: "artifacts/spaceamp-timeline/local-mobile.png",
    });
    assert.equal(await mini.isVisible(), true);
    assert.equal(await mini.evaluate((n) => n.getBoundingClientRect().right <= innerWidth), true);
    // Repeated selections of the same local file share one pending storage read.
    const reads = await page.evaluate(async () => {
      const blob = await (await fetch("/fixture.wav")).blob(),
        get = MediaStorage.get;
      let count = 0;
      MediaStorage.get = async (id) => {
        if (id !== "read-dedup-fixture") return get(id);
        count++;
        await new Promise((r) => setTimeout(r, 150));
        return blob;
      };
      try {
        const id = SPACEAMP.enqueue({
          title: "Pending local file",
          artist: "Fixture",
          fileRef: "read-dedup-fixture",
          local: true,
        });
        await Promise.all([SPACEAMP.play(id), SPACEAMP.play(id), SPACEAMP.play(id)]);
        return count;
      } finally {
        MediaStorage.get = get;
      }
    });
    assert.equal(reads, 1, "concurrent requests must share the same file read");
    await page.waitForFunction(
      () => SPACEAMP.getState().playing && SPACEAMP.getState().title === "Pending local file",
    );
    await page.evaluate(async () => {
      await SPACEAMP.play(
        SPACEAMP.enqueue({
          title: "Unsupported fixture",
          artist: "Fixture",
          url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
        }),
      );
    });
    assert.equal(await page.locator("#seek").isDisabled(), true);
    assert.equal(await mini.isVisible(), false);
    assert.equal(await page.locator("audio").count(), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: shared profile/compact timeline, delayed YouTube duration, seek + keyboard + pause, real local audio, same geometry, mobile, unsupported source disabled, single playback host.",
    );
  } finally {
    await browser?.close();
    web.closeAllConnections();
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
