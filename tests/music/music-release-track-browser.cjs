const assert = require("node:assert/strict");
const { startRuntime } = require("./music-playback-browser/runtime.cjs");
const audio = {
  kind: "music", title: "Ocean Avenue", artist: "Yellowcard", albumTitle: "Ocean Avenue",
  albumCatalogId: "ytmusic:album:MPREb_K4jlzSGylIm", catalogId: "ytmusic:video:LvyHVgocP_0",
  trackDuration: 199, releaseDate: "2003", image: "profile-art.png", source: "YouTube Music",
  playbackSource: { type: "youtube", videoId: "LvyHVgocP_0", url: "https://music.youtube.com/watch?v=LvyHVgocP_0" },
};
const video = { ...audio, catalogId: "ytmusic:video:X9fLbfzCqWw", mediaType: "video", playbackSource: undefined, trackNumber: 3, albumArtist: "Yellowcard" };
const album = {
  kind: "album", catalogId: audio.albumCatalogId, title: audio.albumTitle, artist: audio.artist,
  image: audio.image, releaseDate: "2003", source: "YouTube Music",
  albumTracks: [
    { ...video, catalogId: "ytmusic:video:abcdefghijk", title: "Way Away", trackNumber: 1 },
    { ...video, catalogId: "ytmusic:video:bcdefghijkl", title: "Breathing", trackNumber: 2 },
    video,
  ],
};
(async () => {
  const runtime = await startRuntime();
  try {
    const context = await runtime.browser.newContext();
    await context.route("https://**/*", (route) => route.abort());
    await context.route("**/api/music/**", (route) => {
      const url = new URL(route.request().url());
      let result = { items: [] };
      if (url.pathname.includes("/ytmusic/album/")) result = album;
      if (url.pathname.includes("/ytmusic/music/")) result = {
        ...audio, ...(url.searchParams.get("phase") === "core" ? {} : { trackNumber: 3, albumArtist: "Yellowcard" }),
      };
      return route.fulfill({ json: result });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:" + runtime.web.address().port + "/?voiceTransport=local#colecao");
    await page.waitForFunction(() => window.TitlePages && window.MusicSourceLink);
    await page.evaluate((item) => TitlePages.open(item), audio);
    await page.waitForFunction(() => [...document.querySelectorAll("[data-music-details] dt")].some((dt) => dt.textContent === "faixa" && dt.nextElementSibling.textContent === "3"));
    await page.waitForFunction(() => document.querySelector(".album-context [aria-current=true]"));
    assert.ok((await page.locator(".album-context [aria-current=true]").textContent()).includes("Ocean Avenue"));
    const result = await page.evaluate(async ({ audio, video }) => {
      const first = CollectionActions.quickAdd(audio);
      const second = CollectionActions.quickAdd(video);
      let metadata;
      let downloads = 0;
      let exports = 0;
      MediaDownload.download = async (url, kind, interval, tags) => {
        downloads++;
        metadata = tags;
        return new Blob(["fixture"], { type: "audio/mpeg" });
      };
      MediaDownload.saveFile = () => { exports++; };
      await MusicSourceLink.download(audio, { sourceUrl: "https://example.org/authorized.mp3" });
      await MusicSourceLink.download(video);
      const items = CollectionActions.getItems();
      return { same: first.id === second.id, count: items.length, tags: { track: metadata.track, artist: metadata.album_artist }, downloads, exports, storedNumber: items[0].trackNumber };
    }, { audio, video });
    assert.deepEqual(result, { same: true, count: 1, tags: { track: "3", artist: "Yellowcard" }, downloads: 1, exports: 2, storedNumber: 3 });
    assert.deepEqual(errors, []);
    console.log("Release track: selected position, search/album dedupe and numbered offline file passed.");
    await context.close();
  } finally { await runtime.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
