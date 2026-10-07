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
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage(),
      origin = "http://127.0.0.1:" + server.address().port;
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("BROWSER", e.message);
    });
    const art = origin + "/fixture.svg",
      banner = origin + "/banner.svg",
      artistId = "ytmusic:artist:UCfixtureartist123",
      albumId = "ytmusic:album:MPREfixturealbum123";
    await context.route("**/fixture.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#28413e"/><circle cx="180" cy="190" r="130" fill="#728572"/><path d="M0 430L320 180 600 500V600H0" fill="#13282c"/></svg>',
      }),
    );
    await context.route("**/banner.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="500"><rect width="1400" height="500" fill="#334046"/><path d="M0 500L600 100 1400 450V500" fill="#17252e"/></svg>',
      }),
    );
    const song = {
      kind: "music",
      catalogId: "ytmusic:video:abcdefghijk",
      title: "Thanatos",
      artist: "Kinokoteikoku",
      artistCatalogId: artistId,
      albumTitle: "Time Lapse",
      albumCatalogId: albumId,
      image: art,
      source: "YouTube Music",
      releaseDate: "2018",
      trackDuration: 279,
      genres: ["shoegaze", "dream pop"],
      playbackSource: { type: "youtube", videoId: "abcdefghijk" },
      isrc: "JPB451202866",
    };
    const tracks = Array.from({ length: 13 }, (_, i) => ({
      ...song,
      catalogId: "ytmusic:video:track" + String(i).padStart(6, "0"),
      title: i === 3 ? "Thanatos" : "Track " + (i + 1),
      trackDuration: i === 1 ? undefined : 210 + i,
      playbackSource: {
        type: "youtube",
        videoId: "track" + String(i).padStart(6, "0"),
      },
    }));
    const album = {
      kind: "album",
      catalogId: albumId,
      title: "Time Lapse",
      artist: song.artist,
      artistCatalogId: artistId,
      image: art,
      source: "YouTube Music",
      releaseDate: "2018",
      total: 13,
      unit: "faixas",
      albumTracks: tracks,
      trackNames: tracks.map((t) => t.title),
      genres: ["shoegaze"],
    };
    const artist = {
      kind: "artist",
      catalogId: artistId,
      title: song.artist,
      image: art,
      bannerImage: banner,
      source: "YouTube Music",
      genres: ["shoegaze", "japan", "dream pop"],
      summary: "Biografia longa. ".repeat(90),
      topTracks: tracks.slice(0, 5),
      topAlbums: [album],
      relatedArtists: [],
    };
    await context.route("**/api/music/ytmusic/**", (r) => {
      const parts = new URL(r.request().url()).pathname.split("/"),
        kind = parts[4],
        id = parts[5];
      let result = kind === "artist" ? artist : kind === "album" ? album : song;
      if (id.includes("missing"))
        result =
          kind === "artist"
            ? {
                ...artist,
                catalogId: "ytmusic:artist:" + id,
                bannerImage: "",
                summary: "",
                genres: [],
              }
            : kind === "album"
              ? {
                  ...album,
                  catalogId: "ytmusic:album:" + id,
                  summary: "Album description",
                  albumTracks: tracks.slice(0, 2),
                  trackNames: tracks.slice(0, 2).map((t) => t.title),
                  total: 2,
                }
              : {
                  ...song,
                  catalogId: "ytmusic:video:" + id,
                  genres: [],
                  summary: "Track description",
                  playbackSource: null,
                };
      return r.fulfill({ json: result });
    });
    await context.route("**/api/music/tag?*", async (r) => {
      const params = new URL(r.request().url()).searchParams,
        section = params.get("section");
      if (params.get("tag") === "quiet-unlisted")
        return r.fulfill({
          json:
            section === "info"
              ? { summary: "" }
              : section === "related"
                ? { tags: [] }
                : { items: [], next: null },
        });
      if (section === "album")
        return r.fulfill({
          status: 503,
          json: { error: "Álbuns temporariamente indisponíveis." },
        });
      return r.fulfill({
        json:
          section === "info"
            ? { name: "shoegaze", summary: "História da tag. ".repeat(65) }
            : section === "related"
              ? { tags: ["dream pop", "noise pop"] }
              : {
                  items: [section === "music" ? song : artist],
                  next: null,
                  partial: true,
                },
      });
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.TitlePages && window.MusicBridge);
    const open = async (item) => {
      await page.evaluate((item) => TitlePages.open(item), item);
      await page.waitForFunction(
        (title) => document.querySelector("#titlePage h1")?.textContent === title,
        item.title,
      );
      await page.waitForFunction(
        () =>
          !document.querySelector('#titlePage [role="status"]')?.textContent.includes("Carregando"),
      );
    };
    await open(artist);
    assert.equal(await page.locator("#titlePage .title-banner").count(), 1);
    assert.equal(
      await page.locator("#titlePage .title-banner").evaluate((n) => n.style.height),
      "390px",
    );
    assert.equal(await page.getByRole("button", { name: "editar banner", exact: true }).count(), 1);
    assert.equal(await page.locator("#titlePage .music-track-row").count(), 5);
    assert.equal(await page.locator("#titlePage .media-related-grid .discover-card").count(), 1);
    fs.mkdirSync("artifacts/music-pages-evolution", { recursive: true });
    await page.screenshot({
      path: "artifacts/music-pages-evolution/artist-desktop.png",
      fullPage: true,
    });
    await page.evaluate(({ artistId, art }) => TitleBanner.setImage({ catalogId: artistId }, art), {
      artistId,
      art,
    });
    await page.evaluate(() => TitlePages.refresh());
    assert.equal(await page.locator("#titlePage .title-banner img").getAttribute("src"), art);
    await page.evaluate((artistId) => TitleBanner.reset({ catalogId: artistId }), artistId);
    await page.evaluate(({ album, art }) => TitleBanner.setImage(album, art), {
      album,
      art,
    });
    await open(album);
    assert.equal(await page.locator("#titlePage .title-banner").count(), 0);
    assert.equal(await page.locator("#titlePage .music-track-row").count(), 13);
    assert.equal(await page.locator("#titlePage .music-track-duration").count(), 12);
    await page.screenshot({
      path: "artifacts/music-pages-evolution/album-desktop.png",
      fullPage: true,
    });
    assert.equal(await page.getByRole("button", { name: "editar banner", exact: true }).count(), 0);
    assert.equal(await page.locator("#titlePage #titleSynopsis").count(), 0);
    assert.equal(await page.evaluate((album) => TitleBanner.get(album).image, album), art);
    const playlistCount = await page.evaluate(() => SPACEAMP.getState().queue?.length || 0);
    await page.locator("#titlePage .title-actions .primary").click();
    assert.equal(
      await page.evaluate(
        () =>
          CollectionActions.getItems().filter(
            (i) => i.catalogId === "ytmusic:album:MPREfixturealbum123",
          ).length,
      ),
      1,
    );
    assert.equal(
      await page.evaluate(
        () => CollectionActions.getItems().find((i) => i.kind === "album").status,
      ),
      "planned",
    );
    assert.equal(await page.locator("#editor").evaluate((n) => n.open), false);
    await page.locator("#titlePage .music-tag-link").first().click();
    await page.waitForFunction(() => location.hash.startsWith("#tag/"));
    await open(album);
    await page
      .locator("#titlePage .music-track-row")
      .first()
      .getByRole("button", { name: "Adicionar à playlist: Track 1" })
      .click();
    assert.equal(
      await page.evaluate(() =>
        MusicBridge.inPlaylist({
          kind: "music",
          catalogId: "ytmusic:video:track000000",
        }),
      ),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => CollectionActions.getItems().filter((i) => i.kind === "music").length,
      ),
      0,
    );
    await open(song);
    assert.equal(await page.locator("#titlePage #titleSynopsis").count(), 0);
    assert.equal(await page.getByRole("button", { name: "editar banner", exact: true }).count(), 0);
    await page.screenshot({
      path: "artifacts/music-pages-evolution/song-desktop.png",
      fullPage: true,
    });
    await page
      .locator("#titlePage .title-actions button")
      .filter({ hasText: "+ playlist" })
      .click();
    await page.evaluate((song) => MusicBridge.addToPlaylist(song), song);
    assert.equal(
      await page.evaluate(
        () =>
          SPACEAMP.getState().queue.filter((t) => t.catalogId === "ytmusic:video:abcdefghijk")
            .length,
      ),
      1,
    );
    await page.evaluate(() => {
      const audio = document.querySelector("#audio");
      audio.currentTime = 37;
      window.mediaCommands = [];
      for (const name of ["play", "pause", "load"]) {
        const original = audio[name].bind(audio);
        audio[name] = (...args) => {
          mediaCommands.push(name);
          return original(...args);
        };
      }
      SPACEAMP.progress({ position: 37 });
    });
    assert.equal(await page.evaluate(() => document.querySelector("#audio").currentTime), 37);
    await page.evaluate(() => TitlePages.refresh());
    assert.equal(await page.evaluate(() => document.querySelector("#audio").currentTime), 37);
    assert.deepEqual(await page.evaluate(() => mediaCommands), []);
    const preserved = await page.evaluate((song) => {
      const saved = CollectionActions.quickAdd(song);
      CollectionActions.updateItem(saved.id, {
        status: "done",
        score: 8,
        notes: "personal",
        image: song.image + "?custom",
        playbackSource: { type: "local", fileRef: "manual-audio" },
      });
      return CollectionActions.quickAdd({
        ...song,
        title: "New catalog label",
      });
    }, song);
    assert.equal(preserved.status, "done");
    assert.equal(preserved.score, 8);
    assert.equal(preserved.notes, "personal");
    assert.equal(preserved.playbackSource.fileRef, "manual-audio");
    assert.ok(preserved.image.endsWith("?custom"));
    await page.locator("#titlePage .music-tag-link").first().click();
    await page.waitForFunction(() =>
      document.querySelector("#tagPage")?.textContent.includes("noise pop"),
    );
    assert.equal(await page.locator("#tagPage .music-track-row").count(), 1);
    assert.equal(await page.locator("#tagPage .music-tag-link").count(), 2);
    assert.equal(await page.locator("#tagPage .discover-card small").count(), 0);
    assert.ok(
      await page
        .locator("#tagPage")
        .textContent()
        .then((text) => text.includes("Álbuns temporariamente indisponíveis.")),
    );
    assert.equal(await page.locator("#tagPage .title-actions").count(), 0);
    await page.screenshot({
      path: "artifacts/music-pages-evolution/tag-desktop.png",
      fullPage: true,
    });
    await page.locator("#tagPage .music-tag-link").first().click();
    await page.waitForFunction(() => location.hash === "#tag/dream%20pop");
    await page.waitForFunction(() =>
      document.querySelector("#tagPage")?.textContent.includes("noise pop"),
    );
    await open({
      ...artist,
      catalogId: "ytmusic:artist:UCmissingartist123",
      bannerImage: "",
      summary: "",
      genres: [],
    });
    await page.screenshot({
      path: "artifacts/music-pages-evolution/artist-empty-desktop.png",
      fullPage: true,
    });
    await page.evaluate(() => (location.hash = "#tag/shoegaze"));
    await page.waitForFunction(() =>
      document.querySelector("#tagPage")?.textContent.includes("noise pop"),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/music-pages-evolution/tag-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("#tagPage").scrollWidth <=
          document.querySelector("#tagPage").clientWidth,
      ),
      true,
    );
    await open(album);
    await page.screenshot({
      path: "artifacts/music-pages-evolution/album-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("#titlePage").scrollWidth <=
          document.querySelector("#titlePage").clientWidth,
      ),
      true,
    );
    await open({
      ...artist,
      catalogId: "ytmusic:artist:UCmissingartist123",
      bannerImage: "",
      summary: "",
      genres: [],
    });
    assert.equal(await page.locator("#titlePage .title-banner").count(), 0);
    assert.equal(await page.locator("#titlePage .music-tag-link").count(), 0);
    assert.equal(await page.locator("#titlePage #titleSynopsis").count(), 0);
    assert.equal(await page.locator("#titlePage .music-detail-metadata").count(), 0);
    await page.screenshot({
      path: "artifacts/music-pages-evolution/artist-no-banner-mobile.png",
      fullPage: true,
    });
    await open({
      ...album,
      catalogId: "ytmusic:album:MPREmissingalbum123",
      summary: "Album description",
      albumTracks: tracks.slice(0, 2),
      trackNames: tracks.slice(0, 2).map((t) => t.title),
      total: 2,
    });
    assert.equal(await page.locator("#titlePage .music-track-row").count(), 2);
    await page.screenshot({
      path: "artifacts/music-pages-evolution/album-short-mobile.png",
      fullPage: true,
    });
    await open({
      ...song,
      catalogId: "ytmusic:video:missing1234",
      playbackSource: null,
      genres: [],
      summary: "Track description",
    });
    assert.equal(
      await page
        .locator("#titlePage .music-library-actions button")
        .filter({ hasText: "tocar agora" })
        .count(),
      0,
    );
    assert.equal(await page.locator("#titlePage .music-tag-link").count(), 0);
    await page.screenshot({
      path: "artifacts/music-pages-evolution/song-no-playback-mobile.png",
      fullPage: true,
    });
    await page.evaluate(() => (location.hash = "#tag/quiet-unlisted"));
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("#tagPage .title-notice")].filter(
          (n) => n.textContent === "Nenhum resultado disponível agora.",
        ).length === 3,
    );
    assert.equal(
      await page.locator("#tagPage h2").filter({ hasText: "tags relacionadas" }).count(),
      0,
    );
    await page.screenshot({
      path: "artifacts/music-pages-evolution/tag-empty-mobile.png",
      fullPage: true,
    });
    await page.evaluate(() => (location.hash = "#tag/%3Cbad%3E"));
    await page.waitForFunction(() =>
      document.querySelector("#tagPage").textContent.includes("Tag inválida."),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: artist banner, custom priority, tracklists, collection/playlist independence, dedupe, metadata redraw continuity, tags, partial failures and mobile width.",
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
