const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { once } = require("node:events");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs"),
  { createSignalingServer } = require("../../server/party/signaling-server.cjs");
(async () => {
  const web = createServer(),
    signal = createSignalingServer({ port: 0, host: "127.0.0.1" }),
    errors = [];
  let browser;
  try {
    await Promise.all([
      new Promise((r) => web.listen(0, "127.0.0.1", r)),
      once(signal.wss, "listening"),
    ]);
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    async function client(url, name, playlist = false) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addInitScript(
        ({ name, playlist }) => {
          localStorage.setItem("myspace-profile-v1", JSON.stringify({ name, mood: "" }));
          if (playlist)
            localStorage.setItem(
              "myspace-extras-v1",
              JSON.stringify({
                version: 1,
                activeTrack: "local1",
                tracks: [
                  {
                    id: "local1",
                    title: "Blind",
                    artist: "After",
                    local: true,
                    url: "",
                    album: "profile-art.png",
                  },
                  {
                    id: "yt",
                    title: "YouTube track",
                    artist: "Artist",
                    url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
                  },
                  {
                    id: "local2",
                    title: "Next track",
                    artist: "Next artist",
                    local: true,
                    url: "",
                    album: "profile-art.png",
                  },
                ],
              }),
            );
        },
        { name, playlist },
      );
      await context.addInitScript(() => {
        window.__mediaHandlers = {};
        if (navigator.mediaSession) {
          const original = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
          navigator.mediaSession.setActionHandler = (name, fn) => {
            __mediaHandlers[name] = fn;
            original(name, fn);
          };
        }
      });
      // Deterministic YouTube event contract; no external video playback in this test.
      await context.route("https://www.youtube.com/iframe_api", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body: `window.YT={Player:class {constructor(iframe,{events}){this.events=events;this.url='https://www.youtube.com/watch?v=dQw4w9WgXcQ';this.state=-1;window.__ytTest=this;queueMicrotask(()=>{this.ready=true;events.onReady({target:this});});}getVideoUrl(){return this.url;}getPlayerState(){return this.state;}emit(state){this.state=state;this.events.onStateChange({target:this,data:state});}playVideo(){this.emit(1);}pauseVideo(){this.emit(2);}stopVideo(){this.emit(-1);}destroy(){this.destroyed=true;}}};window.onYouTubeIframeAPIReady();`,
        }),
      );
      await context.route("https://www.youtube.com/embed/**", (r) =>
        r.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>YouTube API fixture</title>",
        }),
      );
      await context.route("**/api/media/metadata?**", (r) =>
        r.fulfill({
          json: {
            title: "Changed video",
            artist: "Video artist",
            thumbnail: "",
          },
        }),
      );
      await context.route("**/music/playlist.js", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body:
            fs.readFileSync("dist/music/playlist.js", "utf8") +
            ";const originalPlaylist=createPlaylistController;createPlaylistController=o=>window.__playlist=originalPlaylist(o);",
        }),
      );
      await context.route("**/party/spacevoice.js", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body:
            fs.readFileSync("dist/party/spacevoice.js", "utf8") +
            ";const originalVoice=createSpaceVoice;createSpaceVoice=o=>window.__ui=originalVoice(o);",
        }),
      );
      await context.route("https://i.ytimg.com/**", (r) =>
        r.fulfill({
          contentType: "image/png",
          body: fs.readFileSync("dist/profile-art.png"),
        }),
      );
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(url);
      await page.waitForFunction(() => window.__ui);
      return page;
    }
    const base = `http://127.0.0.1:${web.address().port}/?voiceWsUrl=${encodeURIComponent("ws://127.0.0.1:" + signal.wss.address().port)}`;
    const a = await client(base + "#perfil", "Alice", true);
    await a.waitForFunction(() => window.__playlist);
    await a.evaluate(async () => {
      const rate = 8000,
        size = rate * 60 * 2,
        bytes = new Uint8Array(44 + size),
        v = new DataView(bytes.buffer);
      const str = (at, s) => {
        for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
      };
      str(0, "RIFF");
      v.setUint32(4, 36 + size, true);
      str(8, "WAVE");
      str(12, "fmt ");
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, rate, true);
      v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      str(36, "data");
      v.setUint32(40, size, true);
      const blob = new Blob([bytes], { type: "audio/wav" });
      await MediaStorage.put("local1", blob);
      await MediaStorage.put("local2", blob);
      await __playlist.selectTrack("local1", true);
    });
    await a.waitForFunction(() => SPACEAMP.getState().playing);
    assert.equal(await a.locator("#songSource").innerText(), "local");
    const localBox = await a.locator("#album").boundingBox();
    assert.equal(await a.evaluate(() => navigator.mediaSession.metadata.title), "Blind");
    assert.equal(await a.evaluate(() => navigator.mediaSession.playbackState), "playing");
    await a.evaluate(() => __mediaHandlers.pause());
    await a.waitForFunction(() => !SPACEAMP.getState().playing);
    assert.equal(await a.evaluate(() => navigator.mediaSession.playbackState), "paused");
    await a.evaluate(() => __mediaHandlers.play());
    await a.waitForFunction(() => SPACEAMP.getState().playing);
    fs.mkdirSync("artifacts/party-v15", { recursive: true });
    await a.locator("#music").screenshot({ path: "artifacts/party-v15/local.png" });
    await a.evaluate(() => __playlist.selectTrack("yt"));
    await a.waitForFunction(() => SPACEAMP.getState().source === "YouTube Music");
    assert.equal(await a.evaluate(() => SPACEAMP.getNowPlaying()), null);
    const ytBox = await a.locator("#album").boundingBox();
    assert.ok(Math.abs(localBox.width - ytBox.width) < 1);
    assert.ok(Math.abs(localBox.height - ytBox.height) < 1);
    assert.equal(await a.locator("#music .player-main").isVisible(), true);
    assert.equal(await a.locator("#music .video-launch img").isVisible(), false);
    assert.equal(
      await a.locator("#albumImage").evaluate((n) => getComputedStyle(n).objectFit),
      "cover",
    );
    assert.equal(await a.locator(".playlist-row").count(), 3);
    await a.locator("#music").screenshot({ path: "artifacts/party-v15/youtube.png" });
    await a.evaluate(() => __playlist.selectTrack("local1", true));
    await a.waitForFunction(() => SPACEAMP.getState().playing);
    await a.evaluate(() => (location.hash = "spacevoice"));
    await a.waitForFunction(() => __ui.chat.state.connected);
    const b = await client(a.url(), "Bob");
    await b.waitForFunction(() =>
      __ui.room.state.participants.some((p) => p.nowPlaying?.title === "Blind"),
    );
    await a.evaluate(() => __mediaHandlers.nexttrack());
    await a.waitForFunction(() => SPACEAMP.getState().source === "YouTube Music");
    await a.evaluate(() => __mediaHandlers.nexttrack());
    await a.waitForFunction(
      () => navigator.mediaSession.metadata?.title === "Next track" && SPACEAMP.getState().playing,
    );
    await a.evaluate(() => __mediaHandlers.previoustrack());
    await a.waitForFunction(() => SPACEAMP.getState().source === "YouTube Music");
    await a.evaluate(() => __mediaHandlers.previoustrack());
    await a.waitForFunction(
      () => navigator.mediaSession.metadata?.title === "Blind" && SPACEAMP.getState().playing,
    );
    await b.waitForFunction(() =>
      __ui.room.state.participants.some((p) => p.nowPlaying?.title === "Blind"),
    );
    const remote = b.locator("li[data-peer-id] .party-presence-music");
    assert.equal(await remote.innerText(), "♫ Blind — After");
    await a.evaluate(() => __playlist.selectTrack("local2", true));
    await b.waitForFunction(() =>
      __ui.room.state.participants.some((p) => p.nowPlaying?.title === "Next track"),
    );
    const attack = "<img src=x onerror=window.__xss=1>";
    await a.evaluate((title) => {
      state.song = title;
      render();
    }, attack);
    await b.waitForFunction(
      (title) => __ui.room.state.participants.some((p) => p.nowPlaying?.title === title),
      attack,
    );
    assert.equal(await remote.innerText(), "♫ " + attack + " — Next artist");
    assert.equal(await b.evaluate(() => window.__xss), undefined);
    assert.equal(await b.locator(".party-presence-music img").count(), 0);
    await a.evaluate(() => {
      state.song = "Next track";
      render();
    });
    await b.waitForFunction(() =>
      __ui.room.state.participants.some((p) => p.nowPlaying?.title === "Next track"),
    );
    await a.evaluate(() => audio.pause());
    await b.waitForFunction(
      () =>
        __ui.room.state.participants.find((p) => p.displayName === "Alice")?.nowPlaying === null,
    );
    await a.evaluate(() => audio.play());
    await b.waitForFunction(() => __ui.room.state.participants.some((p) => p.nowPlaying?.playing));
    await a.evaluate(() => document.getElementById("stop").click());
    await b.waitForFunction(
      () =>
        __ui.room.state.participants.find((p) => p.displayName === "Alice")?.nowPlaying === null,
    );
    assert.equal(await a.evaluate(() => audio.currentTime), 0);
    assert.equal(await a.evaluate(() => navigator.mediaSession.playbackState), "none");
    assert.equal(await a.evaluate(() => navigator.mediaSession.metadata), null);
    await a.evaluate(() => audio.play());
    await b.waitForFunction(() => __ui.room.state.participants.some((p) => p.nowPlaying?.playing));
    await a.evaluate(() => {
      const checkbox = document.getElementById("sharePartyMusic");
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event("change"));
    });
    await b.waitForFunction(
      () =>
        __ui.room.state.participants.find((p) => p.displayName === "Alice")?.nowPlaying === null,
    );
    assert.equal(await a.evaluate(() => audio.paused), false);
    assert.equal(await a.evaluate(() => localStorage.getItem("spaceamp-party-music-v1")), "false");
    assert.equal(await a.evaluate(() => navigator.mediaSession.playbackState), "playing");
    assert.equal(await a.evaluate(() => navigator.mediaSession.metadata.title), "Next track");
    await a.evaluate(() => {
      const checkbox = document.getElementById("sharePartyMusic");
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));
    });
    await b.waitForFunction(() => __ui.room.state.participants.some((p) => p.nowPlaying?.playing));
    const received = await b.evaluate(
      () => __ui.room.state.participants.find((p) => p.displayName === "Alice").nowPlaying,
    );
    assert.deepEqual(Object.keys(received), ["title", "artist", "playing"]);
    await b.screenshot({ path: "artifacts/party-v15/now-playing.png" });
    await a.evaluate(() => __playlist.selectTrack("yt"));
    await a.evaluate(() => document.querySelector("#music .video-launch").click());
    await a.waitForFunction(() => window.__ytTest?.ready);
    assert.equal(await a.evaluate(() => SPACEAMP.getNowPlaying()), null);
    const src = await a.locator("#music iframe").getAttribute("src");
    assert.equal(new URL(src).searchParams.get("enablejsapi"), "1");
    assert.equal(new URL(src).searchParams.get("origin"), new URL(a.url()).origin);
    await a.evaluate(() => __ytTest.emit(1));
    await b.waitForFunction(() =>
      __ui.room.state.participants.some((p) => p.nowPlaying?.title === "YouTube track"),
    );
    await a.evaluate(() => __mediaHandlers.pause());
    await b.waitForFunction(
      () =>
        __ui.room.state.participants.find((p) => p.displayName === "Alice")?.nowPlaying === null,
    );
    await a.evaluate(() => __mediaHandlers.play());
    await b.waitForFunction(() => __ui.room.state.participants.some((p) => p.nowPlaying?.playing));
    await a.evaluate(() => __ytTest.emit(0));
    await b.waitForFunction(
      () =>
        __ui.room.state.participants.find((p) => p.displayName === "Alice")?.nowPlaying === null,
    );
    await a.evaluate(() => {
      __ytTest.playVideo();
      __ytTest.events.onError({ target: __ytTest, data: 100 });
    });
    await a.waitForFunction(() => !SPACEAMP.getState().playing);
    await a.evaluate(() => {
      __ytTest.url = "https://www.youtube.com/watch?v=M7lc1UVf-VE";
      __ytTest.emit(1);
    });
    await b.waitForFunction(() =>
      __ui.room.state.participants.some((p) => p.nowPlaying?.title === "Changed video"),
    );
    await a.evaluate(() => {
      state.mood = "mood do perfil";
      window.dispatchEvent(new Event("myspace-profile-change"));
    });
    await b.waitForFunction(() =>
      __ui.room.state.participants.some((p) => p.statusText === "mood do perfil"),
    );
    const metadata = await b.evaluate(() => JSON.stringify(__ui.room.state.participants));
    await b.evaluate(() => {
      __ui.root.dataset.mode = "screen";
      document
        .querySelectorAll(".party-presence-secondary")
        .forEach((n) => n.setAttribute("aria-hidden", "true"));
    });
    await b.evaluate(async () => {
      await Promise.all(
        document
          .querySelector("li[data-peer-id] .party-presence-secondary")
          .getAnimations()
          .map((a) => a.finished),
      );
    });
    assert.equal(
      await b
        .locator("li[data-peer-id] .party-presence-secondary")
        .evaluate((n) => getComputedStyle(n).visibility),
      "hidden",
    );
    assert.ok(
      (await b
        .locator("li[data-peer-id] .party-presence-secondary")
        .evaluate((n) => n.getBoundingClientRect().height)) < 1,
    );
    assert.equal(await b.evaluate(() => JSON.stringify(__ui.room.state.participants)), metadata);
    fs.mkdirSync("artifacts/party-v151", { recursive: true });
    await b.screenshot({ path: "artifacts/party-v151/compact.png" });
    await b.evaluate(() => {
      __ui.root.dataset.mode = "voice";
      document
        .querySelectorAll(".party-presence-secondary")
        .forEach((n) => n.setAttribute("aria-hidden", "false"));
    });
    await b.locator("li[data-peer-id] .party-presence-mood").waitFor({ state: "visible" });
    await b.evaluate(async () => {
      await Promise.all(
        document
          .querySelector("li[data-peer-id] .party-presence-secondary")
          .getAnimations()
          .map((a) => a.finished),
      );
    });
    assert.equal(
      await b.locator("li[data-peer-id] .party-presence-mood").innerText(),
      "mood do perfil",
    );
    assert.equal(await remote.innerText(), "♫ Changed video — Video artist");
    await b.screenshot({ path: "artifacts/party-v151/restored.png" });
    await b.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await b
        .locator(".party-presence-secondary")
        .first()
        .evaluate((n) => getComputedStyle(n).transitionDuration),
      "0s",
    );
    await b.getByRole("button", { name: "[ nova party ]", exact: true }).click();
    await b.waitForFunction(
      () => __ui.chat.state.connected && __ui.room.state.participants.length === 1,
    );
    assert.equal(await b.locator("li[data-peer-id]").count(), 0);
    await a.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await a.locator("#album").evaluate((n) => getComputedStyle(n).animationName),
      "none",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: two contexts; real local audio, common YouTube shell/artwork, mixed playlist, track/play/pause/stop, privacy OFF without pausing, narrow metadata, room isolation, reduced motion; no console errors.",
    );
  } finally {
    await browser?.close();
    for (const c of signal.wss.clients) c.terminate();
    await new Promise((r) => signal.wss.close(r));
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
