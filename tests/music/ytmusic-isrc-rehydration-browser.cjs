const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs");
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
      if (window !== window.top) return;
      localStorage.setItem("spaceamp-youtube-cover-v1", "true");
      sessionStorage.setItem(
        "myspace-catalog-session",
        JSON.stringify([
          {
            key: "music:ytmusic:video:E-UISaL2zgo",
            at: Date.now(),
            value: {
              kind: "music",
              catalogId: "ytmusic:video:E-UISaL2zgo",
              title: "国道スロープ - Kokudouslope",
              artist: "Kinokoteikoku",
              isrc: "JPB451202865",
              isrcSource: "MusicBrainz",
              isrcLookupVersion: 10,
            },
          },
        ]),
      );
      window.mockYT = [];
      window.YT = {
        Player: class {
          constructor(frame, { events }) {
            this.events = events;
            this.url = frame.src.replace("/embed/", "/watch?v=");
            this.position = 80;
            this.volume = 100;
            this.calls = 0;
            this.started = performance.now();
            window.mockYT.push(this);
            frame.addEventListener("load", () => events.onReady({ target: this }), { once: true });
          }
          getVideoUrl() {
            return this.url;
          }
          getPlayerState() {
            return this.state ?? -1;
          }
          getCurrentTime() {
            return (
              this.position + (this.state === 1 ? (performance.now() - this.started) / 1000 : 0)
            );
          }
          getDuration() {
            return 240;
          }
          getVolume() {
            return this.volume;
          }
          playVideo() {
            this.calls++;
            this.started = performance.now();
            this.state = 1;
            this.events.onStateChange({ target: this, data: 1 });
          }
          seekTo(t) {
            this.position = t;
            this.started = performance.now();
            this.seeks = (this.seeks || 0) + 1;
          }
          pauseVideo() {
            this.position = this.getCurrentTime();
            this.state = 2;
            this.events.onStateChange({ target: this, data: 2 });
          }
          stopVideo() {
            this.state = 5;
          }
          setVolume(v) {
            this.volume = v;
          }
          destroy() {}
          end() {
            this.state = 0;
            this.events.onStateChange({ target: this, data: 0 });
          }
        },
      };
    });
    await context.route("https://www.youtube.com/embed/**", (r) =>
      r.fulfill({ body: "<html></html>", contentType: "text/html" }),
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
    const officialPath = "dist/vendor/am-lyrics-1.7.4.js";
    const official = fs.existsSync(officialPath)
      ? fs.readFileSync(officialPath, "utf8")
      : await (
          await fetch(
            "https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics@1.7.4/dist/src/am-lyrics.min.js",
          )
        ).text();
    const page = await context.newPage(),
      errors = [];
    await context.route("**/am-lyrics-1.7.4.js", (r) =>
      r.fulfill({ body: official, contentType: "text/javascript" }),
    );
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:" + server.address().port, {
      waitUntil: "domcontentloaded",
    });

    await context.route("https://lh3.googleusercontent.com/**", (r) => r.abort());
    await context.route("**/api/music/artwork?*", (r) =>
      r.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    let detailRequests = 0;
    await context.route("**/api/music/ytmusic/music/E-UISaL2zgo?*", (r) => {
      detailRequests++;
      return r.fulfill({
        json: {
          kind: "music",
          catalogId: "ytmusic:video:E-UISaL2zgo",
          title: "国道スロープ - Kokudouslope",
          artist: "Kinokoteikoku",
          isrc: "JPB451202866",
          isrcSource: "lrc.red",
          isrcLookupVersion: 11,
        },
      });
    });
    let requests = 0;
    await context.route("https://lrc.red/s/JPB451202866.ttml", (r) => {
      requests++;
      return r.fulfill({
        contentType: "application/xml",
        headers: { "access-control-allow-origin": "*" },
        body: '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:00:01.000" end="00:00:04.000">Fixture lyrics</p></div></body></tt>',
      });
    });
    await page.evaluate(async () => {
      const item = CollectionActions.saveMusic({
        kind: "music",
        catalogId: "ytmusic:video:E-UISaL2zgo",
        title: "国道スロープ - Kokudouslope",
        artist: "Kinokoteikoku",
        isrc: "JPB451202865",
        isrcSource: "MusicBrainz",
        isrcLookupVersion: 10,
        image: "https://lh3.googleusercontent.com/fixture_artwork_123=w800-h800-rj",
        status: "planned",
        playbackSource: {
          type: "youtube",
          url: "https://www.youtube.com/watch?v=E-UISaL2zgo",
        },
      });
      await SPACEAMP.play(MusicModel.queueTrack(item));
    });
    await page.waitForFunction(() => SPACEAMP.getState().playing);
    await page.evaluate(() => SpaceAmpNowPlaying.open());
    await page.waitForFunction(
      () => document.querySelector("am-lyrics")?.getAttribute("isrc") === "JPB451202866",
    );
    await page.waitForFunction(
      () => document.querySelector("am-lyrics")?.lyricsSource === "lrc.red",
    );
    assert.equal(await page.locator("am-lyrics").getAttribute("isrc"), "JPB451202866");
    assert.equal(requests, 1);
    assert.equal(detailRequests, 1, "old metadata cache must refresh identifier");
    assert.equal(await page.evaluate(() => SPACEAMP.getState().isrc), "JPB451202866");
    await page.evaluate(() => {
      SpaceAmpNowPlaying.close();
      SPACEAMP.addToCollection();
    });
    assert.equal(
      await page.evaluate(
        () =>
          CollectionActions.getItems().find((i) => i.title === "国道スロープ - Kokudouslope").isrc,
      ),
      "JPB451202866",
    );
    await page.evaluate(() => {
      const old = CollectionActions.getItems().find(
        (i) => i.title === "国道スロープ - Kokudouslope",
      );
      CollectionActions.updateItem(old.id, { isrc: "" });
      MusicBridge.actions({ ...old, isrc: "JPB451202866" });
    });
    assert.equal(
      await page.evaluate(
        () =>
          CollectionActions.getItems().find((i) => i.title === "国道スロープ - Kokudouslope").isrc,
      ),
      "JPB451202866",
      "opening enriched controls upgrades saved metadata",
    );
    await page.reload();
    await page.waitForFunction(() => window.CollectionActions);
    assert.equal(
      await page.evaluate(
        () =>
          CollectionActions.getItems().find((i) => i.title === "国道スロープ - Kokudouslope").isrc,
      ),
      "JPB451202866",
    );
    assert.equal(
      await page.evaluate(
        () => SPACEAMP.getState().queue.find((t) => t.title === "国道スロープ - Kokudouslope").isrc,
      ),
      "JPB451202866",
    );
    await page.waitForFunction(
      () => document.querySelector(".amp-mini-cover img")?.naturalWidth > 0,
    );
    assert.ok(
      (await page.locator(".amp-mini-cover img").getAttribute("src")).startsWith(
        "/api/music/artwork?",
      ),
    );
    assert.equal(
      await page
        .locator(".amp-mini-cover img")
        .evaluate((image) => !image.hidden && image.dataset.artworkState === "ready"),
      true,
    );
    await page.evaluate(() =>
      CollectionActions.editItem({
        kind: "music",
        title: "Editor artwork fixture",
        image: "https://lh3.googleusercontent.com/editor_fixture_123=w800-h800-rj",
        status: "planned",
      }),
    );
    await page.waitForFunction(
      () => document.querySelector(".cover-preview img")?.dataset.artworkState === "ready",
    );
    assert.ok(
      (await page.locator(".cover-preview img").getAttribute("src")).startsWith(
        "/api/music/artwork?",
      ),
    );
    assert.equal(
      await page
        .locator(".cover-preview img")
        .evaluate((image) => !image.hidden && image.naturalWidth > 0),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: stale MusicBrainz identifier on YouTube catalog item → refreshed identifier → Collection → actual YouTube selection → official am-lyrics ISRC lookup/lrc.red → save back → reload retains Collection/queue ISRC.",
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
