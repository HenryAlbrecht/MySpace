const assert = require("node:assert/strict");
const { startRuntime } = require("./music-playback-browser/runtime.cjs");
const videoId = "oJL-lCzEXgI";
const audioId = "DjcCQsRCHUs";
const song = {
  kind: "music", title: "Hungry Like the Wolf (2009 Remaster)", artist: "Duran Duran",
  albumTitle: "Rio (Collector's Edition)", albumCatalogId: "ytmusic:album:MPREb_RUR0rUOX6ug",
  catalogId: "ytmusic:video:" + videoId, mediaType: "video", trackDuration: 221,
  source: "YouTube Music", image: "profile-art.png", releaseDate: "1982",
  url: "https://music.youtube.com/watch?v=" + videoId,
};
const source = { type: "youtube", videoId: audioId, url: "https://music.youtube.com/watch?v=" + audioId };
(async () => {
  const runtime = await startRuntime();
  try {
    const context = await runtime.browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.route("https://**/*", (route) => route.abort());
    const radioSeeds = [];
    let links = 0;
    let fullLookups = 0;
    await context.route("**/api/music/**", (route) => {
      const url = new URL(route.request().url());
      let result = {};
      if (url.pathname.includes("/ytmusic/music/")) {
        if (url.searchParams.get("phase") !== "core") fullLookups++;
        result = { ...song, ...(url.searchParams.get("phase") === "core" ? { image: "video-thumbnail.jpg" } : { playbackSource: source }) };
      } else if (url.pathname.endsWith("/playback-source")) {
        links++;
        result = { status: "matched", source, items: [{ title: song.title, artist: song.artist, ...source }] };
      } else if (url.pathname.endsWith("/recommendations")) {
        radioSeeds.push(url.searchParams.get("videoId"));
        result = { items: [] };
      } else result = { items: [] };
      return route.fulfill({ json: result });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + runtime.web.address().port + "/?voiceTransport=local#colecao");
    await page.waitForFunction(() => window.TitlePages && window.MusicSourceLink);
    const retainedCover = await page.evaluate(async (row) => {
      await Catalog.prefetchCore({ kind: row.kind, catalogId: row.catalogId });
      return (await Catalog.prefetchCore(row)).image;
    }, song);
    assert.equal(retainedCover, song.image);
    const concurrentSources = await page.evaluate(async (row) => {
      const tracks = await Promise.all([
        MusicBridge.prepareTrack(row), MusicBridge.prepareTrack(row), MusicBridge.prepareTrack(row),
      ]);
      return tracks.map((track) => track.playbackSource.videoId);
    }, song);
    assert.deepEqual(concurrentSources, [audioId, audioId, audioId]);
    assert.equal(fullLookups, 1, "concurrent preparation shares Catalog enrichment");
    await page.evaluate((row) => MusicBridge.prepareTrack(row), song);
    assert.equal(fullLookups, 1, "resolved Catalog cache skips another FULL request");
    await page.evaluate((row) => {
      const list = MusicPageUI.tracklist([row], { artwork: false, context: false });
      list.id = "audio-version-test-list";
      document.body.append(list);
    }, song);
    const playlistButton = page.locator("#audio-version-test-list .music-track-playlist");
    assert.equal(await playlistButton.count(), 1);
    assert.equal(await page.locator("#audio-version-test-list .music-track-play").count(), 1);
    await page.evaluate(() => {
      window.rowPlayed = null;
      window.originalBridgePlay = MusicBridge.play;
      MusicBridge.play = async (track) => { window.rowPlayed = track.playbackSource; };
    });
    await page.locator("#audio-version-test-list .music-track-play").click();
    await page.waitForFunction(() => window.rowPlayed?.videoId === "DjcCQsRCHUs");
    await page.evaluate(() => { MusicBridge.play = originalBridgePlay; });
    await playlistButton.click();
    await page.waitForFunction(() => document.querySelector("#audio-version-test-list .music-track-playlist")?.textContent === "✓ na playlist");
    await page.evaluate(() => document.querySelector("#audio-version-test-list").remove());
    await page.evaluate((row) => TitlePages.open(row), song);
    await page.waitForFunction(() => [...document.querySelectorAll(".music-library-actions button")]
      .some((button) => button.textContent.includes("tocar agora")));
    assert.equal(await page.locator(".title-actions .catalog-credit").getAttribute("href"), source.url);
    await page.locator("[data-title-discovery]").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-title-discovery][data-started="true"]'));
    assert.ok(radioSeeds.length > 0);
    assert.ok(radioSeeds.every((id) => id === audioId));
    await page.locator(".music-library-actions button").filter({ hasText: "trocar reprodução" }).click();
    assert.equal(await page.locator('.music-link-dialog input[type="url"]').inputValue(), source.url);
    await page.locator(".music-link-dialog button[type=submit]").click();
    const saved = await page.evaluate(() => CollectionActions.getItems()[0]);
    assert.equal(saved.catalogId, song.catalogId);
    assert.equal(saved.playbackSource.videoId, audioId);
    assert.equal(saved.playbackSourceOrigin, "manual");
    assert.equal(saved.albumTitle, song.albumTitle);
    const corrected = await page.evaluate(({ row, source, videoId }) => {
      const stored = CollectionActions.getItems()[0];
      CollectionActions.updateItem(stored.id, {
        playbackSource: { type: "youtube", videoId }, playbackSourceOrigin: "catalog",
      });
      MusicBridge.actions({ ...row, playbackSource: source });
      const automatic = CollectionActions.getItems()[0].playbackSource;
      CollectionActions.updateItem(stored.id, {
        playbackSource: { type: "local", fileRef: "manual-local" }, playbackSourceOrigin: "manual",
      });
      MusicBridge.actions({ ...row, playbackSource: source });
      const manual = CollectionActions.getItems()[0].playbackSource;
      return { automatic, manual };
    }, { row: song, source, videoId });
    assert.equal(corrected.automatic.videoId, audioId);
    assert.equal(corrected.manual.fileRef, "manual-local");
    const lookupsBeforeManual = fullLookups;
    const manualPrepared = await page.evaluate((row) => MusicBridge.prepareTrack(row), song);
    assert.equal(manualPrepared.playbackSource.fileRef, "manual-local");
    assert.equal(fullLookups, lookupsBeforeManual, "manual sources do not repeat lookups");
    // An unsaved album row also gets a matched URL when the dialog opens.
    await page.evaluate((row) => MusicSourceLink.link({ ...row, catalogId: "ytmusic:video:abcdefghijk" }), song);
    await page.waitForFunction((url) => document.querySelector('.music-link-dialog input[type="url"]')?.value === url, source.url);
    assert.equal(links, 1);
    await page.locator(".music-link-dialog button").filter({ hasText: "cancelar" }).click();
    assert.equal(await page.evaluate(() => CollectionActions.getItems().length), 1);
    assert.deepEqual(errors, []);
    console.log("Audio version UI: correct default link, independent saved source, audio radio seed, automatic lookup and cancel passed.");
    await context.close();
  } finally {
    await runtime.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
