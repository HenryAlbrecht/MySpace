// One browser/context. Catalog → seeded editor → persisted playback boundary.
const assert = require("node:assert/strict"),
  path = require("node:path");
const { chromium } = require(
  path.join(
    require("node:os").homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ),
);
const { createServer } = require("../../server.cjs"),
  { createMusicCatalog } = require("../../server/music/music-catalog.cjs");
const id = "10z6-vQm23w",
  albumId = "MPREb_JmBafQLPQZT",
  artistId = "UCXExK7We8VKsIzFFQYNEgBg";
const song = {
  kind: "music",
  title: "Song",
  artist: "Artist",
  albumTitle: "Album",
  trackDuration: 210,
  catalogId: "ytmusic:video:" + id,
  source: "YouTube Music",
  image: "profile-art.png",
  playbackSource: {
    type: "youtube",
    videoId: id,
    url: "https://www.youtube.com/watch?v=" + id,
  },
  metadataSources: { youtubeMusicId: id },
};
const album = {
  kind: "album",
  title: "Album",
  artist: "Artist",
  catalogId: "ytmusic:album:" + albumId,
  source: "YouTube Music",
  image: "profile-art.png",
  albumTracks: [song],
  trackNames: ["Song"],
};
const artist = {
  kind: "artist",
  title: "Artist",
  catalogId: "ytmusic:artist:" + artistId,
  source: "YouTube Music",
  image: "profile-art.png",
  topTracks: [song],
  topAlbums: [album],
};
let lookups = 0,
  fallback = false;
const music = createMusicCatalog({
  youtubeMusic: {
    search: async (kind) =>
      fallback
        ? { items: [] }
        : {
            provider: "YouTube Music",
            items: [{ music: song, album, artist }[kind]],
          },
    details: async (kind) => ({ music: song, album, artist })[kind],
    searchTracks: async () => {
      lookups++;
      return [];
    },
  },
  itunes: {
    search: async (kind) => ({
      provider: "iTunes",
      items: [{ kind, title: "Fallback", catalogId: "itunes:123", artist: "Artist" }],
    }),
  },
  lastfm: { summary: async () => ({ summary: "Editorial fixture" }) },
  musicbrainz: {
    recordingIsrc: async () => null,
    playbackSource: async () => ({ items: [] }),
  },
  isrcEdition: async () => null,
});
const web = createServer({ music });
let browser;
(async () => {
  try {
    await new Promise((r) => web.listen(0, "127.0.0.1", r));
    browser = await chromium.launch({
      executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.route("https://**/*", (r) => r.abort());
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:" + web.address().port + "/?voiceTransport=local#buscar/music/Song",
    );
    await page.waitForFunction(
      () => window.CollectionActions && window.Catalog && window.MusicBridge,
    );
    const searched = await page.evaluate(async () => {
      const result = {};
      for (const kind of ["music", "album", "artist"]) {
        const rows = await Catalog.search(kind, "Song");
        result[kind] = await Catalog.details(rows[0]);
      }
      return result;
    });
    assert.equal(searched.music.summarySource, "Last.fm");
    assert.equal(searched.album.albumTracks[0].playbackSource.videoId, id);
    assert.equal(searched.artist.topAlbums[0].catalogId, album.catalogId);
    await page.evaluate((row) => CollectionActions.editItem(row), searched.music);
    await page.locator("#resourceEditor button[type=submit]").click();
    await page.waitForFunction(() =>
      CollectionActions.getItems().some((i) => i.catalogId === "ytmusic:video:10z6-vQm23w"),
    );
    const saved = await page.evaluate(() =>
      CollectionActions.getItems().find((i) => i.catalogId === "ytmusic:video:10z6-vQm23w"),
    );
    assert.equal(saved.playbackSource.videoId, id);
    assert.equal(lookups, 0);
    assert.equal(await page.locator(".music-link-dialog[open]").count(), 0);
    const boundary = await page.evaluate(async () => {
      const item = CollectionActions.getItems().find(
        (i) => i.catalogId === "ytmusic:video:10z6-vQm23w",
      );
      let played;
      const original = SPACEAMP.play;
      SPACEAMP.play = (track) => {
        played = track;
      };
      try {
        const actions = MusicBridge.actions(item);
        [...actions.querySelectorAll("button")]
          .find((b) => b.textContent.includes("tocar agora"))
          .click();
        await Promise.resolve();
      } finally {
        SPACEAMP.play = original;
      }
      return played;
    });
    assert.equal(boundary.playbackSource.videoId, id);
    assert.equal(lookups, 0);
    const merged = await page.evaluate((row) => {
      const old = CollectionActions.saveMusic({
        ...row,
        id: undefined,
        catalogId: "itunes:42",
        title: "Equivalent",
        status: "done",
        playbackSource: { type: "local", fileRef: "manual" },
      });
      const next = CollectionActions.saveMusic({
        ...row,
        id: undefined,
        title: "Equivalent",
        catalogId: "ytmusic:video:dQw4w9WgXcQ",
        playbackSource: { type: "youtube", videoId: "dQw4w9WgXcQ" },
      });
      return { old, next };
    }, song);
    assert.equal(merged.next.id, merged.old.id);
    assert.equal(merged.next.catalogId, "itunes:42");
    assert.equal(merged.next.status, "done");
    assert.equal(merged.next.playbackSource.fileRef, "manual");
    assert.equal(merged.next.metadataSources.youtubeMusicId, "dQw4w9WgXcQ");
    await page.reload();
    await page.waitForFunction(() => window.CollectionActions);
    assert.equal(
      await page.evaluate(
        () =>
          CollectionActions.getItems().find((i) => i.catalogId === "itunes:42").playbackSource
            .fileRef,
      ),
      "manual",
    );
    assert.equal(
      await page.evaluate(
        () =>
          CollectionActions.getItems().find((i) => i.catalogId === "ytmusic:video:10z6-vQm23w")
            .playbackSource.videoId,
      ),
      id,
    );
    fallback = true;
    assert.deepEqual(await page.evaluate(() => Catalog.search("music", "Fallback")), []);
    assert.equal(lookups, 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS: one browser/context; typed search/details, seeded save without resolver, play action boundary, Apple ID/status/manual source preserved, persisted reload and no automatic Apple fallback. Actual YouTube playback was not exercised.",
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
