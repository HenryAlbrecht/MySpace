"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("C:/Users/Halourt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
(async () => {
  let browser;
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:" + process.env.MYSPACE_SMOKE_PORT);
        break;
      } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    assert.ok(browser, "test WebView2 CDP endpoint");
    const context = browser.contexts()[0];
    await context.route("https://**/*", (route) => route.abort());
    const page = context.pages().find((page) => page.url().includes("tauri.localhost"));
    assert.ok(page, "embedded Tauri frontend");
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.waitForFunction(() => window.DesktopMusicLibrary?.tracks().length === 2);
    } catch (error) {
      console.log("Discovery diagnostic", await page.evaluate(async () => ({ folders: await __TAURI__.core.invoke("list_folders"), tracks: window.DesktopMusicLibrary?.tracks(), text: document.querySelector(".desktop-poc")?.textContent })));
      throw error;
    }
    const before = await page.evaluate(() => ({ data: localStorage.getItem("myspace-extras-v1"), audioCount: document.querySelectorAll("audio").length }));
    await page.evaluate(() => {
      document.querySelector(".desktop-poc").close();
      document.querySelector("#audio").muted = true;
      document.querySelector("#spaceAmpOpenLibrary").click();
    });
    const library = page.locator("#spaceAmpLibrary");
    const mp3 = library.getByRole("button", { name: "Reproduzir Fixture MP3", exact: true });
    for (const image of await library.locator("[data-local-music-id] img").all()) {
      await image.evaluate((image) => image.decode());
      assert.equal(await image.evaluate((image) => image.naturalWidth), 1);
    }
    const coverUrl = await page.evaluate(() => DesktopMusicLibrary.tracks()[0].image);
    await mp3.click();
    await page.waitForFunction(() => SPACEAMP.getPlaybackState().playing && document.querySelector("#audio").currentTime > 0.15);
    async function snapshot(label) {
      const state = await page.evaluate(() => ({ title: SPACEAMP.getPlaybackState().title, playing: SPACEAMP.getPlaybackState().playing, time: document.querySelector("#audio").currentTime, duration: document.querySelector("#audio").duration, source: document.querySelector("#audio").currentSrc, queue: SPACEAMP.getState().queue.length }));
      console.log(label, JSON.stringify(state));
      return state;
    }
    await page.evaluate(() => { document.querySelector("#spaceAmpLibrary").close(); SpaceAmpNowPlaying.open(); });
    await page.locator("#spaceampNowPlaying .np-artwork img").first().evaluate((image) => image.decode());
    assert.equal(await page.locator("#spaceampNowPlaying .np-artwork img").first().evaluate((image) => image.naturalWidth), 1);
    await page.evaluate(() => { SpaceAmpNowPlaying.close(); document.querySelector("#spaceAmpOpenLibrary").click(); });
    console.log("Native embedded/folder artwork decoded in library and Now Playing");
    const playingMp3 = await snapshot("MP3 decoded/playing");
    assert.equal(playingMp3.title, "Fixture MP3");
    assert.ok(playingMp3.duration > 40);
    assert.equal(playingMp3.queue, 2);
    assert.match(playingMp3.source, /^http:\/\/myspace-music\.localhost\//);
    const ranges = await page.evaluate(async () => {
      const source = document.querySelector("#audio").currentSrc;
      const result = await fetch(source, { headers: { Range: "bytes=123-456" } });
      const bad = await fetch(source, { headers: { Range: "bytes=999999999999-" } });
      return { status: result.status, range: result.headers.get("Content-Range"), bytes: (await result.arrayBuffer()).byteLength, bad: bad.status };
    });
    assert.equal(ranges.status, 206);
    assert.equal(ranges.bytes, 334);
    assert.match(ranges.range, /^bytes 123-456\//);
    assert.equal(ranges.bad, 416);
    console.log("Native Range", JSON.stringify(ranges));
    await page.evaluate(() => SPACEAMP.pause());
    await page.waitForFunction(() => document.querySelector("#audio").paused);
    await page.evaluate(() => { SPACEAMP.seek(20); SPACEAMP.play(); });
    await page.waitForFunction(() => document.querySelector("#audio").currentTime > 20.1 && !document.querySelector("#audio").paused);
    await snapshot("MP3 pause/resume/seek");
    await page.evaluate(() => SPACEAMP.next());
    await page.waitForFunction(() => SPACEAMP.getPlaybackState().title === "Fixture FLAC" && SPACEAMP.getPlaybackState().playing && document.querySelector("#audio").currentTime > 0.1);
    await snapshot("FLAC decoded/playing");
    await page.evaluate(() => SPACEAMP.seek(30));
    await page.waitForFunction(() => document.querySelector("#audio").currentTime > 30.1);
    await snapshot("FLAC seek");
    await page.evaluate(() => SPACEAMP.seek(0));
    await page.waitForFunction(() => document.querySelector("#audio").currentTime < 1);
    await page.evaluate(() => SPACEAMP.previous());
    await page.waitForFunction(() => SPACEAMP.getPlaybackState().title === "Fixture MP3" && SPACEAMP.getPlaybackState().playing);
    await page.evaluate(() => SPACEAMP.seek(document.querySelector("#audio").duration - 0.3));
    await page.waitForFunction(() => SPACEAMP.getPlaybackState().title === "Fixture FLAC" && SPACEAMP.getPlaybackState().playing);
    console.log("Previous and real ended → next passed");
    const original = path.join(process.env.MYSPACE_PLAYBACK_FIXTURE, "music", "01.mp3");
    const moved = original + ".temporarily-missing";
    await fs.rename(original, moved);
    try {
      await mp3.click();
      await page.waitForFunction(() => SPACEAMP.getPlaybackState().title === "Fixture FLAC" && SPACEAMP.getPlaybackState().playing);
      console.log("Missing file skipped into FLAC without stalling the queue");
    } finally {
      await fs.rename(moved, original);
    }
    await page.evaluate(() => { SPACEAMP.seek(0); });
    await page.waitForFunction(() => document.querySelector("#audio").currentTime < 1);
    await page.evaluate(() => SPACEAMP.previous());
    await page.waitForFunction(() => document.querySelector("#audio").paused && !document.querySelector("#audio").getAttribute("src"));
    console.log("Known failed previous entry: old native buffer cleared, no stale playback");
    await library.getByRole("button", { name: "Reproduzir Fixture FLAC", exact: true }).click();
    await page.waitForFunction(() => SPACEAMP.getPlaybackState().title === "Fixture FLAC" && SPACEAMP.getPlaybackState().playing);
    const staleUrl = await page.locator("#audio").getAttribute("src");
    // Revoke directly in Rust, without updating the JS mirror: buffered audio must stop.
    await page.evaluate(async () => {
      const folders = await __TAURI__.core.invoke("list_folders");
      await __TAURI__.core.invoke("revoke_folder", { id: folders[0].id });
    });
    await page.waitForFunction(() => document.querySelector("#audio").paused && !document.querySelector("#audio").getAttribute("src"));
    const revoked = await page.evaluate(async (url) => (await fetch(url, { headers: { Range: "bytes=0-10" } })).status, staleUrl);
    assert.equal(revoked, 403);
    assert.equal(await page.evaluate(async (url) => (await fetch(url)).status, coverUrl), 403);
    const after = await page.evaluate(() => ({ data: localStorage.getItem("myspace-extras-v1"), audioCount: document.querySelectorAll("audio").length, queue: SPACEAMP.getState().queue.length }));
    assert.equal(after.data, before.data);
    assert.equal(after.audioCount, before.audioCount);
    assert.equal(after.queue, 2);
    assert.deepEqual(errors, []);
    console.log("Revocation while buffered: stopped, old URL denied; single player/queue and personal storage preserved");
  } finally {
    if (browser) await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
