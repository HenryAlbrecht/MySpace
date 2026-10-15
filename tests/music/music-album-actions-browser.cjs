const assert = require("node:assert/strict");
const { startRuntime } = require("./music-playback-browser/runtime.cjs");

(async () => {
  const runtime = await startRuntime();
  try {
    const context = await runtime.browser.newContext();
    await context.route("https://**/*", (route) => route.abort());
    await context.route("**/api/music/**", (route) => route.fulfill({ json: { items: [] } }));
    await context.addInitScript(() => {
      localStorage.setItem("myspace-extras-v1", JSON.stringify({
        version: 1,
        items: [],
        playlists: [{
          id: "saved-playlist",
          name: "Saved playlist",
          tracks: [{ id: "saved-track", kind: "music", title: "Saved only" }],
        }],
      }));
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + runtime.web.address().port + "/?voiceTransport=local#colecao");
    await page.waitForFunction(() => window.MusicAlbumActions && window.MusicBridge);
    await page.evaluate(() => {
      window.albumFixture = {
        kind: "album", title: "Album", catalogId: "ytmusic:album:MPREb_fixture",
        albumTracks: ["abcdefghijk", "bcdefghijkl", "cdefghijklm"].map((id, index) => ({
          kind: "music", catalogId: "ytmusic:video:" + id,
          title: "Track " + (index + 1), artist: "Artist", albumTitle: "Album",
          trackNumber: index + 1, albumArtist: "Artist", image: "profile-art.png",
          playbackSource: { type: "audio", url: "https://example.org/track" + index + ".mp3" },
        })),
      };
      const actions = MusicAlbumActions.actions(albumFixture);
      actions.id = "album-actions-fixture";
      document.body.append(actions);
      window.albumDownloads = [];
      window.albumPlayed = [];
      MusicBridge.playAlbum(albumFixture.albumTracks).catch(() => {});
      MusicSourceLink.download = async (track, options) => {
        albumDownloads.push({ title: track.title, url: options.sourceUrl, interval: options.getDownloadInterval() });
        return "saved";
      };
    });
    await page.waitForFunction(() => SPACEAMP.getState().queue.length === 3);
    assert.deepEqual(await page.evaluate(() => SPACEAMP.getState().queue.map((track) => track.title)), ["Track 1", "Track 2", "Track 3"]);
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("myspace-extras-v1")).playlists),
      [{ id: "saved-playlist", name: "Saved playlist", tracks: [{ id: "saved-track", kind: "music", title: "Saved only" }] }],
      "Starting album playback must leave saved playlists untouched",
    );
    await page.evaluate(() => {
      MusicBridge.playAlbum = async (tracks) => { albumPlayed = tracks.map((track) => track.title); };
    });
    await page.locator("#album-actions-fixture button").filter({ hasText: "ouvir álbum" }).click();
    await page.waitForFunction(() => window.albumPlayed.length === 3);
    assert.deepEqual(await page.evaluate(() => albumPlayed), ["Track 1", "Track 2", "Track 3"]);
    await page.clock.install();
    await page.locator("#album-actions-fixture button").filter({ hasText: "baixar álbum" }).click();
    assert.equal(await page.locator(".music-album-download input").count(), 3);
    await page.locator(".music-album-download button[type=submit]").click();
    await page.waitForFunction(() => albumDownloads.length === 1);
    assert.equal(await page.evaluate(() => albumDownloads[0].interval), 60);
    await page.clock.runFor(59000);
    assert.equal(await page.evaluate(() => albumDownloads.length), 1);
    await page.clock.runFor(1000);
    await page.waitForFunction(() => albumDownloads.length === 2);
    await page.locator(".music-album-download button").filter({ hasText: "cancelar downloads" }).click();
    await page.clock.runFor(60000);
    assert.equal(await page.evaluate(() => albumDownloads.length), 2);
    assert.equal(await page.locator(".music-album-download").count(), 0);
    assert.deepEqual(errors, []);
    console.log("Album actions: track order, authorized URLs, 60-second cooldown and cancellation passed.");
    await context.close();
  } finally {
    await runtime.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
